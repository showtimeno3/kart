// 아이템 12종: 사용, 던지는 물풍선, 바닥 함정(바나나·꿀·얼음 벽), 맞았을 때 처리, 지속 효과
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

const SHOT_SPEED = 70; // 물풍선이 날아가는 속도 (초당 거리)
const HAZARD = { banana: { r: 2.4, life: 25, effect: 'spin', msg: '미끄덩! 🍌' }, honey: { r: 4.5, life: 20, effect: 'sticky', msg: '끈적끈적! 🍯' },
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
const onSc = (k) => (k === game.p ? !!game.p.onSc : !!k.sc); // 지름길 위에 있는가
const scDist = (k) => (k === game.p ? game.p.scK * game.T.sc.step : k.sc.s); // 지름길 시작부터 간 거리

function resetEffects(k) {
  Object.assign(k, { items: [], charges: 0, shield: 0, star: 0, magnet: 0, sticky: 0, bubble: 0, bubbleT: 0, hint: false, itemHeld: 0, itemT: 0, shieldMesh: null });
}
function countUse(id, me) {
  const s = game.stats.items;
  (s[id] = s[id] || [0, 0])[me ? 0 : 1]++;
}

// 막힘: 무지개 별이면 막음, 방패가 있으면 한 번 막고 방패가 사라짐 (아이템·움직이는 장애물 공통)
function blocked(k) {
  if (k.star > 0) return true;
  if (k.shield <= 0) return false;
  k.shield = 0; game.stats.shieldBlocks++;
  Particles.burst(kartPoint(k.kart, 0, 1.4, 0), 18, 0x7fd4ff, 8);
  if (k === game.p) { flash('방패로 막았어요! 🛡️', 'good'); Sound.sfx.block(); }
  return true;
}

// 맞음: 막히면 false, 아니면 효과를 주고 true. attack: 다른 카트의 공격(점검용 집계)
function hitKart(k, effect, msg, attack = false) {
  if (k.finished) return false;
  const me = k === game.p;
  const hs = game.stats.hits; hs[effect] = (hs[effect] || 0) + 1; // 점검용: 효과별 맞은 횟수 (막은 것 포함)
  if (blocked(k)) return false;
  if (me && attack) game.stats.pAtk = (game.stats.pAtk || 0) + 1;
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
// 아이템 2칸: 빈 칸에 넣음 (두 칸이 차 있으면 false)
function giveItem(k, id) {
  if (k.items.length >= 2) return false;
  k.items.push(id);
  if (k.items.length === 1) armFirst(k);
  if (k === game.p) updateItemSlot();
  return true;
}
// 첫 칸에 새 아이템이 왔을 때: 부스터 3개 횟수, 컴퓨터가 쓰기까지 기다리는 시간
function armFirst(k) {
  k.charges = k.items[0] === 'boost3' ? 3 : 0; k.itemHeld = 0; k.itemT = 1 + Math.random() * 2;
}
function updateItemSlot() {
  const p = game.p, [a, b] = p.items;
  $('item').innerHTML = a ? ItemTable.ITEMS[a].icon + (a === 'boost3' ? `<b class="cnt">${p.charges}</b>` : '') : '-';
  $('item2').textContent = b ? ItemTable.ITEMS[b].icon : '';
}

// 플레이어 아이템 키
function useItem(back = false) {
  if (!game || game.state !== 'race') return;
  const p = game.p;
  if (!p.items.length || p.rolling > 0 || p.finished) return;
  useItemFor(p, back);
}

// 첫 칸 아이템 사용. back: 뒤로 던지기 (물풍선, 얼음 벽)
function useItemFor(k, back = false) {
  const id = k.items[0], me = k === game.p;
  if (!id) return;
  if (id === 'bee' && !leaderOf(k)) { if (me) flash('앞에 아무도 없어요 🐝', 'info'); return; } // 내가 1등이면 벌떼는 그대로 들고 있음
  countUse(id, me);
  if (id === 'boost' || id === 'boost3') { k.boost = Math.max(k.boost, me ? 2 : 1.6); if (me) { flash('부스터! 🚀', 'info'); Sound.sfx.boost(); } }
  else if (id === 'banana' || id === 'honey') dropHazard(id, k);
  else if (id === 'ice') dropHazard('ice', k, back ? 0 : 50); // 얼음 벽: 앞으로 던짐, ↓ 면 바로 뒤
  else if (id === 'shield') { k.shield = 8; if (me) { flash('방패! 🛡️', 'info'); Sound.sfx.shield(); } }
  else if (id === 'balloon') throwShot('balloon', k, null, back ? -1 : 1);
  else if (id === 'homing') throwShot('homing', k, kartAhead(k)[0]);
  else if (id === 'bee') throwShot('bee', k, leaderOf(k));
  else if (id === 'tornado' || id === 'boomerang') throwShot(id, k, null);
  else if (id === 'magnet') { k.magnet = 3; if (me) { flash('자석! 🧲', 'info'); Sound.sfx.magnet(); } }
  else if (id === 'bubble') {
    for (const o of allKarts()) if (o !== k && kartProg(o) > kartProg(k)) hitKart(o, 'bubble', null, true);
    if (me) { flash('비눗방울 구름! 🫧', 'info'); Sound.sfx.bubble(); }
  } else if (id === 'star') { k.star = 6; k.starHit = new Set(); if (me) { flash('무지개 별! 🌈', 'info'); Sound.sfx.star(); } }
  else if (id === 'hint') {
    k.hint = true;
    if (me) { Sound.sfx.hint(); if (game.nextGate && game.nextGate.q) applyHint(game.nextGate); else flash('💡 다음 문제에서 오답 하나를 지워 줄게요', 'info'); }
  }
  if (id === 'boost3' && --k.charges > 0) { k.itemHeld = 0; k.itemT = 1; } // 남은 부스터는 그대로 첫 칸에
  else { k.items.shift(); if (k.items.length) armFirst(k); } // 뒤 칸이 당겨짐
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
// ahead > 0 이면 그만큼 앞에 던져 놓음 (얼음 벽), 아니면 바로 뒤
function dropHazard(kind, k, ahead = 0) {
  const { T, A } = game, cfg = HAZARD[kind];
  const at = kartPoint(k.kart, 0, 0, ahead > 0 ? ahead : kind === 'honey' ? -5.5 : -3.2);
  if (ahead > 0) keepOnRoad(at, k); // 커브에서 앞으로 던지면 도로 밖에 떨어질 수 있음
  const mesh = kind === 'banana' ? M.makeBanana() : kind === 'honey' ? M.honeyPuddle() : M.iceWall();
  if (onSc(k)) { // 지름길 위: 지름길 높이·방향
    const [kk] = scNearest(T, at);
    mesh.position.set(at.x, T.sc.pos[kk].y, at.z); mesh.rotation.y = T.sc.head[kk];
  } else {
    const i = nearest(T, at, kartIdx(k));
    const lat = (at.x - T.pos[i].x) * T.right[i].x + (at.z - T.pos[i].z) * T.right[i].z;
    mesh.position.set(at.x, groundY(T, A, i, lat), at.z); mesh.rotation.y = T.head[i];
  }
  game.scene.add(mesh);
  game.hazards.push({ kind, mesh, owner: k, age: 0, r: cfg.r, life: cfg.life, touched: new Set() });
  if (k === game.p) { if (kind === 'ice') Sound.sfx.ice(); else if (kind === 'honey') Sound.sfx.honey(); }
}

// 점 at 이 도로(또는 지름길) 밖이면 도로 안쪽 가장자리로 옮김
function keepOnRoad(at, k) {
  const { T } = game;
  if (onSc(k)) {
    const [kk, lat] = scNearest(T, at), lim = T.sc.half[kk] - 2;
    if (Math.abs(lat) > lim) at.copy(scPoint(T, kk, Math.sign(lat) * lim));
  } else {
    const i = nearest(T, at, kartIdx(k)), lat = (at.x - T.pos[i].x) * T.right[i].x + (at.z - T.pos[i].z) * T.right[i].z;
    if (Math.abs(lat) > HW - 2) at.copy(roadPoint(T, i, Math.sign(lat) * (HW - 2)));
  }
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
      if (t && gap < 120 && onSc(t) === onSc(k)) { // 같은 길에 있을 때만 끌려감
        k.boost = Math.max(k.boost, 0.15);
        if (me) { const rv = k.onSc ? T.sc.right[k.scK] : T.right[k.idx], d = clamp(t.lat - k.lat, -1, 1) * 8 * dt; k.pos.addScaledVector(rv, d); }
        else k.latT = t.lat;
        if (Math.random() < 0.4) Particles.emit(kartPoint(k.kart, 0, 1.2, 2.5), { color: 0xff5a7a, vx: 0, vy: 0, life: 0.3, size: 0.5, add: true });
      }
    }
    if (k.star > 0) {
      k.boost = Math.max(k.boost, 0.15);
      if (Math.random() < 0.8) Particles.emit(kartPoint(k.kart, (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2, -1), { color: [0xff6fa8, 0xffd84d, 0x7dff8a, 0x4fc3ff, 0xb57bff][Math.floor(Math.random() * 5)], vy: 2, life: 0.4, size: 0.5, add: true });
      starBump(k, karts);
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
  updateShots(dt, karts); // js/shots.js
  if (racing) for (const a of game.ais) if (a.items.length) aiUseItems(a, dt);
}

// 무지개 별: 부딪힌 카트를 돌게 함. 별 한 번에 같은 카트는 한 번만 (방패로 막은 다음 프레임에 다시 맞지 않게)
function starBump(k, karts) {
  for (const o of karts) {
    if (o === k || k.starHit.has(o)) continue;
    if (Math.hypot(o.pos.x - k.pos.x, o.pos.z - k.pos.z) < 3.2 && Math.abs(o.y - k.y) < 2.5) { k.starHit.add(o); hitKart(o, 'spin', '쿵! 🌈', true); }
  }
}

// 컴퓨터 아이템 쓰기 (첫 칸만): 앞 카트가 사거리 안이면 공격, 1등이면 뒤로 던짐, 방패는 공격이 날아올 때
const AI_REACH = 200, AI_REACH_AGGRO = 260; // 공격 아이템 사거리 (공격형은 더 멀리서)
function aiUseItems(a, dt) {
  a.itemHeld += dt;
  const id = a.items[0], [ahead, gapA] = kartAhead(a), [behind, gapB] = kartBehind(a);
  const reach = a.persona === 'aggro' ? AI_REACH_AGGRO : AI_REACH, canHit = !!ahead && gapA < reach;
  let use = false, back = false;
  if (id === 'balloon' || id === 'ice') { // 앞 카트가 사거리 안이면 앞으로, 내가 1등이면 가까운 뒤 카트에게 뒤로
    if (canHit) use = true;
    else if (!ahead && behind && gapB < 80) use = back = true;
  } else if (id === 'homing' || id === 'tornado' || id === 'boomerang') use = canHit;
  else if (id === 'bee') use = a.itemHeld > a.itemT && !!leaderOf(a); // 내가 1등이면 들고 있음
  else if (id === 'bubble') use = !!ahead && gapA < 80;
  else if (id === 'magnet') use = !!ahead && gapA < 120;
  else if (id === 'banana' || id === 'honey') use = a.persona === 'prank' ? a.itemHeld > 1 : !!behind && gapB < 60;
  else if (id === 'shield') { const th = incomingThreat(a); use = !!th && th.dist <= (a.persona === 'steady' ? 120 : 30); } // 위협 없으면 계속 들고 있음
  else use = a.itemHeld > a.itemT; // 부스터, 무지개 별, 힌트
  if (!use && id !== 'shield' && id !== 'bee' && a.itemHeld > 8) use = true; // 8초 넘게 쓸 곳이 없으면 그냥 씀
  if (use) useItemFor(a, back);
}
