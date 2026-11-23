// 날아가는 아이템: 물풍선(앞·뒤), 따라가는 물풍선
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

const SHOT = { // 종류별 속도(초당 거리)와 수명(초)
  balloon: { speed: 70, life: 4 },
  homing: { speed: 70, life: 6 },
};

// dir: +1 앞으로, -1 뒤로
function throwShot(kind, k, target, dir = 1) {
  const { T } = game, me = k === game.p, i = kartIdx(k);
  const sc = onSc(k) ? { s: scDist(k) + 4 * dir } : null; // 지름길에서 던지면 지름길을 따라 날아감
  const head = sc ? T.sc.head[clamp(Math.round(sc.s / T.sc.step), 0, T.sc.n - 1)] : T.head[i];
  // 플레이어가 비스듬히 앞으로 던지면 옆으로도 날아가고 벽에 튕김 (도로 방향과 차 방향의 차이). 뒤로는 똑바로
  const latV = me && dir > 0 ? clamp(SHOT[kind].speed * Math.sin(head - game.p.h), -25, 25) : 0;
  const mesh = M.waterBalloon(kind === 'homing' ? 0xff5a5a : 0x4fb3ff);
  game.scene.add(mesh);
  game.shots.push({ kind, mesh, owner: k, target, dir, s: kartProg(k) + (4 * dir) / T.segLen, sc, lat: k.lat, latV, age: 0 });
  if (me) { Sound.sfx.throw(); flash(kind === 'homing' ? '따라가는 물풍선! 🎯' : dir < 0 ? '뒤로 물풍선! 🎈' : '물풍선! 🎈', 'info'); }
}
// 명중: 실제 거리로 판정 (진행도·옆 위치로 하면 다른 길에 있는 카트가 맞을 수 있음)
function shotHits(s, k) {
  const p = s.mesh.position;
  return Math.hypot(p.x - k.pos.x, p.z - k.pos.z) < 2.8 && Math.abs(k.y + 1.3 - p.y) < 3;
}
function splash(at) {
  Particles.burst(at, 20, 0x8fd8ff, 9, { add: false, grav: 18, size: 0.7 });
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
  if (s.kind === 'homing' && s.target && onSc(s.target) === !!s.sc) s.lat = approach(s.lat, s.target.lat, 14 * dt); // 같은 길에 있을 때만 따라감
  else {
    s.lat += s.latV * dt;
    if (Math.abs(s.lat) > lim) { s.lat = Math.sign(s.lat) * lim; s.latV = -s.latV * 0.8; } // 벽에 튕김
  }
  if (s.sc) {
    s.mesh.position.lerpVectors(sc.pos[k0], sc.pos[k0 + 1], kf - k0).addScaledVector(sc.right[k0], s.lat);
    s.mesh.position.y = sc.pos[k0].y + 1.3 + Math.sin(s.age * 14) * 0.15;
  } else {
    const f = ((s.s % N) + N) % N, i0 = Math.floor(f), i1 = (i0 + 1) % N;
    s.mesh.position.lerpVectors(T.pos[i0], T.pos[i1], f - i0).addScaledVector(T.right[i0], s.lat);
    s.mesh.position.y = groundY(T, A, f, s.lat) + 1.3 + Math.sin(s.age * 14) * 0.15;
  }
  s.mesh.rotation.y += dt * 6;
}

function updateShots(dt, karts) {
  const sh = game.shots;
  for (let n = sh.length - 1; n >= 0; n--) {
    const s = sh[n];
    s.age += dt;
    moveShot(s, dt);
    placeShot(s, dt);
    let gone = s.age > SHOT[s.kind].life;
    for (const k of karts) {
      if (gone || k === s.owner || (s.kind === 'homing' && s.target && k !== s.target && s.age < 5)) continue;
      if (shotHits(s, k)) { hitKart(k, 'spin', '풍덩! 🎈'); gone = true; }
    }
    if (gone) { splash(s.mesh.position.clone()); game.scene.remove(s.mesh); sh.splice(n, 1); }
  }
}
