// 아이템 12종: 사용, 던지는 물풍선, 바닥 함정(바나나·꿀·얼음 벽), 맞았을 때 처리, 지속 효과
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

const SHOT_SPEED = 70; // 물풍선이 날아가는 속도 (초당 거리)
const HAZARD = { banana: { r: 2.4, life: 45, effect: 'spin', msg: '미끄덩! 🍌' }, honey: { r: 4.5, life: 20, effect: 'sticky', msg: '끈적끈적! 🍯' },
  ice: { r: 3, life: 10, effect: 'bump', msg: '쿵! 🧊' } };

// ---------- 카트 공통 (플레이어 p 와 컴퓨터 a 를 같은 방식으로 다룸) ----------
const allKarts = () => [game.p].concat(game.ais);
const kartProg = (k) => (k === game.p ? game.p.laps * N + game.p.idxF : aiTotal(k)); // 출발부터 달린 샘플 수
const rankOf = (k) => 1 + allKarts().filter((o) => o !== k && kartProg(o) > kartProg(k)).length;
function kartAhead(k) {
  let best = null, bd = Infinity;
  for (const o of allKarts()) { const d = kartProg(o) - kartProg(k); if (o !== k && d > 0 && d < bd) { bd = d; best = o; } }
  return best ? [best, bd * game.T.segLen] : [null, Infinity];
}
function kartBehind(k) {
  let best = null, bd = Infinity;
  for (const o of allKarts()) { const d = kartProg(k) - kartProg(o); if (o !== k && d > 0 && d < bd) { bd = d; best = o; } }
  return best ? [best, bd * game.T.segLen] : [null, Infinity];
}
const kartIdx = (k) => (k === game.p ? game.p.idx : k.idx);

function resetEffects(k) {
  Object.assign(k, { item: null, charges: 0, shield: 0, star: 0, magnet: 0, sticky: 0, bubble: 0, bubbleT: 0, hint: false, itemHeld: 0, itemT: 0, shieldMesh: null });
}
function countUse(id, me) {
  const s = game.stats.items;
  (s[id] = s[id] || [0, 0])[me ? 0 : 1]++;
}

// 맞음: 무지개 별이면 무시, 방패가 있으면 막고 방패가 사라짐
function hitKart(k, effect, msg) {
  if (k.star > 0 || k.finished) return false;
  const me = k === game.p;
  const hs = game.stats.hits; hs[effect] = (hs[effect] || 0) + 1; // 점검용: 효과별 맞은 횟수 (방패로 막은 것 포함)
  if (k.shield > 0) {
    k.shield = 0; game.stats.shieldBlocks++;
    Particles.burst(kartPoint(k.kart, 0, 1.4, 0), 18, 0x7fd4ff, 8);
    if (me) { flash('방패로 막았어요! 🛡️', 'good'); Sound.sfx.block(); }
    return false;
  }
  if (effect === 'spin') {
    k.spin = me ? 1.1 : 1.0;
    if (me) { flash(msg || '미끄덩!', 'bad'); Sound.sfx.spin(); game.stats.spins = (game.stats.spins || 0) + 1; if (k.drift.on) endDrift(false); }
  } else if (effect === 'sticky') {
    k.sticky = 3;
    if (me) { flash(msg, 'bad'); Sound.sfx.honey(); }
  } else if (effect === 'bump') {
    if (me) { k.vel.multiplyScalar(0.3); k.slow = Math.max(k.slow, 0.8); k.shake = 0.7; flash(msg, 'bad'); Sound.sfx.bump(); if (k.drift.on) endDrift(false); }
    else { k.slow = Math.max(k.slow, 0.8); k.speed *= 0.4; }
  } else if (effect === 'bubble') {
    k.bubble = 3; k.bubbleT = 0;
    if (me) { flash('앞이 안 보여요! 🫧', 'bad'); Sound.sfx.bubble(); }
  }
  return true;
}

// ---------- 아이템 얻기 / 쓰기 ----------
function giveItem(k, id) {
  k.item = id; k.charges = id === 'boost3' ? 3 : 0; k.itemHeld = 0; k.itemT = 1 + Math.random() * 2;
  if (k === game.p) updateItemSlot();
}
function updateItemSlot() {
  const p = game.p, el = $('item');
  if (!p.item) { el.textContent = '-'; return; }
  el.innerHTML = ItemTable.ITEMS[p.item].icon + (p.item === 'boost3' ? `<b class="cnt">${p.charges}</b>` : '');
}

// 플레이어 아이템 키
function useItem() {
  if (!game || game.state !== 'race') return;
  const p = game.p;
  if (!p.item || p.rolling > 0 || p.finished) return;
  useItemFor(p);
}

function useItemFor(k) {
  const id = k.item, me = k === game.p;
  if (!id) return;
  countUse(id, me);
  if (id === 'boost' || id === 'boost3') { k.boost = Math.max(k.boost, me ? 2 : 1.6); if (me) { flash('부스터! 🚀', 'info'); Sound.sfx.boost(); } }
  else if (id === 'banana' || id === 'honey' || id === 'ice') dropHazard(id, k);
  else if (id === 'shield') { k.shield = 8; if (me) { flash('방패! 🛡️', 'info'); Sound.sfx.shield(); } }
  else if (id === 'balloon') throwShot('balloon', k, null);
  else if (id === 'homing') throwShot('homing', k, kartAhead(k)[0]);
  else if (id === 'magnet') { k.magnet = 3; if (me) { flash('자석! 🧲', 'info'); Sound.sfx.magnet(); } }
  else if (id === 'bubble') {
    for (const o of allKarts()) if (o !== k && kartProg(o) > kartProg(k)) hitKart(o, 'bubble');
    if (me) { flash('비눗방울 구름! 🫧', 'info'); Sound.sfx.bubble(); }
  } else if (id === 'star') { k.star = 6; if (me) { flash('무지개 별! 🌈', 'info'); Sound.sfx.star(); } }
  else if (id === 'hint') {
    k.hint = true;
    if (me) { Sound.sfx.hint(); if (game.nextGate && game.nextGate.q) applyHint(game.nextGate); else flash('💡 다음 문제에서 오답 하나를 지워 줄게요', 'info'); }
  }
  if (id === 'boost3' && --k.charges > 0) { k.itemHeld = 0; k.itemT = 1; } // 남은 부스터는 그대로 들고 있음
  else k.item = null;
  if (me) updateItemSlot();
}

// 💡: 다음 문(지금 보이는 문)의 오답 하나를 회색으로 지움
function applyHint(g) {
  const q = g.q;
  if (!q || g.hintOff != null) return;
  const wrong = [0, 1, 2].filter((i) => i !== q.answer);
  const w = wrong[Math.floor(Math.random() * 2)];
  g.hintOff = w;
  const m = g.panels[w];
  drawLabel(m.userData.canvas, '✖', '#9aa0a6', '#ffffff'); m.userData.tex.needsUpdate = true;
  document.querySelectorAll('.choice')[w].classList.add('off');
  game.p.hint = false;
  flash('💡 오답 하나를 지웠어요!', 'info');
}

// ---------- 바닥 함정 ----------
function dropHazard(kind, k) {
  const { T, A } = game, cfg = HAZARD[kind];
  const at = kartPoint(k.kart, 0, 0, kind === 'honey' ? -5.5 : -3.2);
  const i = nearest(T, at, kartIdx(k));
  const lat = (at.x - T.pos[i].x) * T.right[i].x + (at.z - T.pos[i].z) * T.right[i].z;
  const mesh = kind === 'banana' ? M.makeBanana() : kind === 'honey' ? M.honeyPuddle() : M.iceWall();
  mesh.position.set(at.x, groundY(T, A, i, lat), at.z); mesh.rotation.y = T.head[i];
  game.scene.add(mesh);
  game.hazards.push({ kind, mesh, owner: k, age: 0, r: cfg.r, life: cfg.life, touched: new Set() });
  if (k === game.p) { if (kind === 'ice') Sound.sfx.ice(); else if (kind === 'honey') Sound.sfx.honey(); }
}

// ---------- 물풍선 ----------
function throwShot(kind, k, target) {
  const { T } = game, me = k === game.p, i = kartIdx(k);
  // 플레이어가 비스듬히 던지면 옆으로도 날아가고 벽에 튕김 (도로 방향과 차 방향의 차이)
  const latV = me ? clamp(SHOT_SPEED * Math.sin(T.head[i] - game.p.h), -25, 25) : 0;
  const mesh = M.waterBalloon(kind === 'homing' ? 0xff5a5a : 0x4fb3ff);
  game.scene.add(mesh);
  game.shots.push({ kind, mesh, owner: k, target, s: kartProg(k) + 4 / T.segLen, lat: k.lat, latV, age: 0 });
  if (me) { Sound.sfx.throw(); flash(kind === 'homing' ? '따라가는 물풍선! 🎯' : '물풍선! 🎈', 'info'); }
}
function splash(at) {
  Particles.burst(at, 20, 0x8fd8ff, 9, { add: false, grav: 18, size: 0.7 });
  if (game.p.pos.distanceTo(at) < 60) Sound.sfx.splat();
}

// ---------- 매 프레임 ----------
function updateItems(dt) {
  const { T, A, scene } = game, karts = allKarts(), racing = game.state === 'race';
  // 지속 효과
  for (const k of karts) {
    const me = k === game.p;
    for (const f of ['shield', 'star', 'magnet', 'sticky', 'bubble']) k[f] = Math.max(0, k[f] - dt);
    if (k.magnet > 0) {
      const [t, gap] = kartAhead(k);
      if (t && gap < 120) {
        k.boost = Math.max(k.boost, 0.15);
        if (me) { const rv = T.right[k.idx], d = clamp(t.lat - k.lat, -1, 1) * 8 * dt; k.pos.addScaledVector(rv, d); }
        else k.latT = t.lat;
        if (Math.random() < 0.4) Particles.emit(kartPoint(k.kart, 0, 1.2, 2.5), { color: 0xff5a7a, vx: 0, vy: 0, life: 0.3, size: 0.5, add: true });
      }
    }
    if (k.star > 0) {
      k.boost = Math.max(k.boost, 0.15);
      if (Math.random() < 0.8) Particles.emit(kartPoint(k.kart, (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2, -1), { color: [0xff6fa8, 0xffd84d, 0x7dff8a, 0x4fc3ff, 0xb57bff][Math.floor(Math.random() * 5)], vy: 2, life: 0.4, size: 0.5, add: true });
      for (const o of karts) {
        if (o === k || o.spin > 0) continue;
        if (Math.hypot(o.pos.x - k.pos.x, o.pos.z - k.pos.z) < 3.2 && Math.abs(o.y - k.y) < 2.5) hitKart(o, 'spin', '쿵! 🌈');
      }
    }
    if (!me && k.bubble > 0 && (k.bubbleT -= dt) <= 0) { k.bubbleT = 1; k.latT = (Math.random() * 2 - 1) * 12; } // 앞이 안 보여 흔들림
    // 방패 공
    if (k.shield > 0 && !k.shieldMesh) { k.shieldMesh = M.shieldBubble(); k.shieldMesh.position.y = 1.3; k.kart.root.add(k.shieldMesh); }
    if (k.shieldMesh) k.shieldMesh.visible = k.shield > 0;
  }
  // 바닥 함정
  const hz = game.hazards;
  for (let n = hz.length - 1; n >= 0; n--) {
    const h = hz[n], cfg = HAZARD[h.kind], hp = h.mesh.position;
    h.age += dt;
    if (h.kind === 'banana') h.mesh.rotation.y += dt * 1.5;
    if (h.kind === 'ice' && h.age > h.life - 1) h.mesh.scale.y = Math.max(0.05, h.life - h.age); // 녹아내림
    let gone = h.age > h.life;
    for (const k of karts) {
      if (gone || h.touched.has(k) || (h.owner === k && h.age < 1.5)) continue;
      if (Math.hypot(hp.x - k.pos.x, hp.z - k.pos.z) < h.r && Math.abs(hp.y - k.y) < 1.5) {
        h.touched.add(k); hitKart(k, cfg.effect, cfg.msg);
        if (h.kind === 'banana') gone = true;
      }
    }
    if (gone) { scene.remove(h.mesh); hz.splice(n, 1); }
  }
  // 물풍선
  const sh = game.shots;
  for (let n = sh.length - 1; n >= 0; n--) {
    const s = sh[n];
    s.age += dt; s.s += (SHOT_SPEED / T.segLen) * dt;
    if (s.kind === 'homing' && s.target) s.lat = approach(s.lat, s.target.lat, 14 * dt);
    else {
      s.lat += s.latV * dt;
      if (Math.abs(s.lat) > HW - 1) { s.lat = Math.sign(s.lat) * (HW - 1); s.latV = -s.latV * 0.8; } // 벽에 튕김
    }
    const f = ((s.s % N) + N) % N, i0 = Math.floor(f), i1 = (i0 + 1) % N;
    s.mesh.position.lerpVectors(T.pos[i0], T.pos[i1], f - i0).addScaledVector(T.right[i0], s.lat);
    s.mesh.position.y = groundY(T, A, f, s.lat) + 1.3 + Math.sin(s.age * 14) * 0.15;
    s.mesh.rotation.y += dt * 6;
    let gone = s.age > (s.kind === 'homing' ? 6 : 4);
    for (const k of karts) {
      if (gone || k === s.owner || (s.kind === 'homing' && s.target && k !== s.target && s.age < 5)) continue;
      if (Math.abs(kartProg(k) - s.s) * T.segLen < 3 && Math.abs(k.lat - s.lat) < 2.4 && Math.abs(k.y + 1.3 - s.mesh.position.y) < 3) {
        hitKart(k, 'spin', '풍덩! 🎈'); gone = true;
      }
    }
    if (gone) { splash(s.mesh.position.clone()); scene.remove(s.mesh); sh.splice(n, 1); }
  }
  if (racing) for (const a of game.ais) if (a.item) aiUseItems(a, dt);
}

// 앞쪽 가까이에 함정이나 날아오는 물풍선이 있는가 (안정형 방패용)
function dangerNear(a) {
  const segLen = game.T.segLen, me = kartProg(a);
  for (const s of game.shots) if (s.owner !== a && Math.abs(s.s - me) * segLen < 25) return true;
  for (const h of game.hazards) {
    const dx = h.mesh.position.x - a.pos.x, dz = h.mesh.position.z - a.pos.z;
    if (h.owner !== a && dx * dx + dz * dz < 25 * 25) return true;
  }
  return false;
}

// 컴퓨터 아이템 쓰기: 앞 카트가 가까우면 공격, 뒤 카트가 가까우면 함정, 나머지는 잠깐 뒤
function aiUseItems(a, dt) {
  a.itemHeld += dt;
  const id = a.item;
  let use = a.itemHeld > 8;
  const reach = a.persona === 'aggro' ? 120 : 80; // 공격형은 더 멀리서도 던짐
  if (id === 'balloon' || id === 'homing' || id === 'bubble') { const [t, gap] = kartAhead(a); use = use || (t && gap < reach); }
  else if (id === 'magnet') { const [t, gap] = kartAhead(a); use = use || (t && gap < 120); }
  else if (id === 'banana' || id === 'honey' || id === 'ice') { const [t, gap] = kartBehind(a); use = use || (a.persona === 'prank' ? a.itemHeld > 1 : t && gap < 60); }
  else if (id === 'shield') use = use || (a.persona === 'steady' ? dangerNear(a) : a.itemHeld > 1); // 안정형은 위험할 때만 방패
  else use = use || a.itemHeld > a.itemT;
  if (use) useItemFor(a);
}
