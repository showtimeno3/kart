// 날아가는 아이템: 물풍선(앞·뒤), 따라가는 물풍선, 벌떼(1등 추적), 회오리(지나는 카트 모두), 부메랑(갔다가 돌아옴)
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

const SHOT = { // 종류별 속도(초당 거리), 수명(초), 맞혔을 때 문구
  balloon: { speed: 70, life: 4, msg: '풍덩! 🎈' },
  homing: { speed: 70, life: 6, msg: '풍덩! 🎯' },
  bee: { speed: 90, life: 8, msg: '따끔! 🐝' },
  tornado: { speed: 45, life: 6, msg: '빙글빙글! 🌀' },
  boomerang: { speed: 70, life: 4, msg: '딱! 🪃' },
};
const BOOMERANG_OUT = 1.5; // 부메랑이 앞으로 날아가는 시간(초), 그 뒤 돌아옴

// 1등 카트 (골인한 카트 제외). k 자신이 1등이면 null
function leaderOf(k) {
  let best = null;
  for (const o of allKarts()) if (!o.finished && (!best || kartProg(o) > kartProg(best))) best = o;
  return best === k ? null : best;
}

// dir: +1 앞으로, -1 뒤로
function throwShot(kind, k, target, dir = 1) {
  const { T } = game, me = k === game.p, i = kartIdx(k);
  const sc = onSc(k) ? { s: scDist(k) + 4 * dir } : null; // 지름길에서 던지면 지름길을 따라 날아감
  const head = sc ? T.sc.head[clamp(Math.round(sc.s / T.sc.step), 0, T.sc.n - 1)] : T.head[i];
  // 플레이어가 비스듬히 앞으로 던지는 물풍선은 옆으로도 날아가고 벽에 튕김 (도로 방향과 차 방향의 차이)
  const latV = me && dir > 0 && kind === 'balloon' ? clamp(SHOT[kind].speed * Math.sin(head - game.p.h), -25, 25) : 0;
  const mesh = kind === 'bee' ? M.bees() : kind === 'tornado' ? M.tornado() : kind === 'boomerang' ? M.boomerang() : M.waterBalloon(kind === 'homing' ? 0xff5a5a : 0x4fb3ff);
  game.scene.add(mesh);
  game.shots.push({ kind, mesh, owner: k, target, dir, s: kartProg(k) + (4 * dir) / T.segLen, sc, lat: k.lat, latV, age: 0,
    phase: 'out', hitSet: new Set(), gone: false });
  if (me) {
    const say = { homing: '따라가는 물풍선! 🎯', bee: '벌떼 출동! 🐝', tornado: '회오리! 🌀', boomerang: '부메랑! 🪃' }[kind] || (dir < 0 ? '뒤로 물풍선! 🎈' : '물풍선! 🎈');
    flash(say, 'info');
    (kind === 'bee' ? Sound.sfx.buzz : kind === 'tornado' ? Sound.sfx.whoosh : kind === 'boomerang' ? Sound.sfx.swish : Sound.sfx.throw)();
  }
}

// 명중 거리: 실제 거리로 판정 (진행도·옆 위치로 하면 다른 길에 있는 카트가 맞을 수 있음)
function shotHits(s, k, r = 2.8) {
  const p = s.mesh.position;
  return Math.hypot(p.x - k.pos.x, p.z - k.pos.z) < r && Math.abs(k.y + 1.3 - p.y) < 3;
}
// 종류별로 맞히는 규칙. 맞히면 true, 한 대만 맞히는 종류는 s.gone 을 켬
function shotTryHit(s, k) {
  if (k === s.owner) return false;
  if (s.kind === 'bee') {
    if (k !== s.target || !shotHits(s, k, 3)) return false;
    s.gone = true;
  } else if (s.kind === 'tornado') {
    if (s.hitSet.has(k) || !shotHits(s, k, 5)) return false;
    s.hitSet.add(k); // 같은 카트는 한 번, 회오리는 계속 굴러감
  } else if (s.kind === 'boomerang') {
    const key = s.phase === 'out' ? 'hitOut' : 'hitBack';
    if (s[key] || !shotHits(s, k)) return false;
    s[key] = true; // 가는 길·오는 길 각각 한 대
  } else {
    if (s.kind === 'homing' && s.target && k !== s.target && s.age < 5) return false; // 처음 5초는 대상만
    if (!shotHits(s, k)) return false;
    s.gone = true;
  }
  hitKart(k, 'spin', SHOT[s.kind].msg, true);
  return true;
}
function splash(s) {
  const at = s.mesh.position.clone();
  if (s.kind === 'balloon' || s.kind === 'homing') Particles.burst(at, 20, 0x8fd8ff, 9, { add: false, grav: 18, size: 0.7 });
  else Particles.burst(at, 12, s.kind === 'bee' ? 0xffd84d : 0xdddddd, 6, { add: false, grav: 4, size: 0.8 });
  if (game.p.pos.distanceTo(at) < 60) Sound.sfx.splat();
}

// 길을 따라 한 프레임 이동 (지름길 위면 지름길, 끝·시작에 닿으면 본 도로로)
function moveShot(s, dt) {
  const { T } = game, sc = T.sc, step = SHOT[s.kind].speed * dt * s.dir;
  if (s.sc) {
    s.sc.s += step; s.s += (step / T.segLen) * ((sc.span * T.segLen) / sc.len);
    if (s.sc.s >= sc.len) { s.sc = null; s.lat += sc.lat1; } else if (s.sc.s <= 0) { s.sc = null; s.lat += sc.lat0; }
  } else s.s += step / T.segLen;
}
// 옆 위치와 화면 위치
function placeShot(s, dt) {
  const { T, A } = game, sc = T.sc;
  const kf = s.sc ? Math.min(s.sc.s / sc.step, sc.n - 1.001) : 0, k0 = Math.floor(kf);
  const lim = (s.sc ? sc.half[k0] : HW) - 1;
  const chase = s.kind === 'boomerang' && s.phase === 'back' ? s.owner : s.target; // 부메랑은 돌아올 때 던진 카트 쪽으로
  if ((s.kind === 'homing' || s.kind === 'bee' || s.kind === 'boomerang') && chase && onSc(chase) === !!s.sc) {
    s.lat = approach(s.lat, chase.lat, (s.kind === 'bee' ? 20 : 14) * dt); // 같은 길에 있을 때만 따라감
  } else if (s.kind === 'tornado') s.lat = approach(s.lat, 0, 5 * dt); // 회오리는 도로 가운데로
  else {
    s.lat += s.latV * dt;
    if (Math.abs(s.lat) > lim) { s.lat = Math.sign(s.lat) * lim; s.latV = -s.latV * 0.8; } // 벽에 튕김
  }
  const hover = s.kind === 'tornado' ? 0 : 1.3 + Math.sin(s.age * 14) * 0.15;
  if (s.sc) {
    s.mesh.position.lerpVectors(sc.pos[k0], sc.pos[k0 + 1], kf - k0).addScaledVector(sc.right[k0], s.lat);
    s.mesh.position.y = sc.pos[k0].y + hover;
  } else {
    const f = ((s.s % N) + N) % N, i0 = Math.floor(f), i1 = (i0 + 1) % N;
    s.mesh.position.lerpVectors(T.pos[i0], T.pos[i1], f - i0).addScaledVector(T.right[i0], s.lat);
    s.mesh.position.y = groundY(T, A, f, s.lat) + hover;
  }
  s.mesh.rotation.y += dt * (s.kind === 'tornado' || s.kind === 'boomerang' ? 14 : 6);
}

// 나에게 날아오는 공격 (경고용): 나를 노리는 따라가는 아이템, 같은 길 뒤에서(부메랑은 앞에서 돌아오며) 다가오는 아이템. 120 안, 가장 가까운 것
const WARN_RANGE = 120;
function incomingThreat(k) {
  let best = null;
  for (const s of game.shots) {
    if (s.owner === k || s.gone) continue;
    let dist = null;
    if (s.kind === 'homing' || s.kind === 'bee') {
      if (s.target === k) dist = Math.hypot(s.mesh.position.x - k.pos.x, s.mesh.position.z - k.pos.z);
    } else if (onSc(k) === !!s.sc) {
      const d = (kartProg(k) - s.s) * game.T.segLen; // + 면 샷이 내 뒤
      if (d * s.dir > 0) dist = Math.abs(d); // 나를 향해 오는 중
    }
    if (dist != null && dist <= WARN_RANGE && (!best || dist < best.dist)) best = { icon: ItemTable.ITEMS[s.kind].icon, dist };
  }
  return best;
}

function updateShots(dt, karts) {
  const sh = game.shots;
  for (let n = sh.length - 1; n >= 0; n--) {
    const s = sh[n];
    s.age += dt;
    if (s.kind === 'boomerang' && s.phase === 'out' && s.age > BOOMERANG_OUT) { s.phase = 'back'; s.dir = -s.dir; }
    if (s.kind === 'bee' && (!s.target || s.target.finished)) s.gone = true; // 쫓던 1등이 골인
    if (!s.gone) {
      moveShot(s, dt);
      placeShot(s, dt);
      for (const k of karts) if (!s.gone) shotTryHit(s, k);
      if (s.kind === 'boomerang' && s.phase === 'back' && shotHits(s, s.owner, 3)) s.gone = true; // 던진 카트에게 돌아옴
    }
    if (s.gone || s.age > SHOT[s.kind].life) { splash(s); game.scene.remove(s.mesh); sh.splice(n, 1); }
  }
}
