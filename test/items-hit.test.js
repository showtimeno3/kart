// 실행: node test/items-hit.test.js
// js/items.js 의 맞음 처리(blocked, hitKart, starBump)를 브라우저 없이 검사. 게임 전역은 작은 가짜로 대신함.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const ctx = vm.createContext({
  console, Math, Set, Object, Array,
  N: 1600, HW: 20, EDGE: 25.2,
  aiTotal: (a) => a.d, kartPoint: () => ({}), flash: noop, endDrift: noop,
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)), approach: (a, b) => b,
  Particles: { burst: noop, emit: noop }, Sound: { sfx: new Proxy({}, { get: () => noop }) },
  M: {}, ItemTable: { ITEMS: new Proxy({}, { get: () => ({ icon: '?' }) }) }, $: () => ({ classList: { toggle: noop } }),
});
for (const f of ['items.js', 'shots.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);

const kart = (o = {}) => Object.assign({ pos: { x: 0, z: 0 }, y: 0, lat: 0, d: 0, shield: 0, star: 0, spin: 0, slow: 0, finished: false, kart: {} }, o);
function setup(...ais) {
  ctx.game = { p: kart({ drift: { on: false }, vel: { multiplyScalar: noop }, laps: 0, idxF: 0 }), ais, stats: { hits: {}, shieldBlocks: 0, items: {}, spins: 0 } };
}

// 방패: 한 번 막고 사라짐 / 무지개 별: 계속 막음 (방패는 그대로)
{
  const a = kart({ shield: 5 });
  setup(a);
  assert.strictEqual(ctx.blocked(a), true);
  assert.strictEqual(a.shield, 0);
  assert.strictEqual(ctx.game.stats.shieldBlocks, 1);
  assert.strictEqual(ctx.blocked(a), false, '방패가 두 번 막음');
  const s = kart({ star: 3, shield: 5 });
  assert.strictEqual(ctx.blocked(s), true);
  assert.strictEqual(ctx.blocked(s), true);
  assert.strictEqual(s.shield, 5, '별이 있는데 방패가 소모됨');
}
// hitKart: 방패가 막으면 효과 없음, 다음에는 맞음
{
  const a = kart({ shield: 5 });
  setup(a);
  assert.strictEqual(ctx.hitKart(a, 'spin'), false);
  assert.strictEqual(a.spin, 0);
  assert.strictEqual(ctx.hitKart(a, 'spin'), true);
  assert.ok(a.spin > 0);
}
// 무지개 별: 한 번 쓰는 동안 같은 카트는 한 번만 침 → 방패로 막은 다음 프레임에 다시 맞지 않음
{
  const k = kart({ star: 6, starHit: new Set() });
  const o = kart({ shield: 5, pos: { x: 1, z: 0 } });
  const far = kart({ pos: { x: 50, z: 0 } });
  const bare = kart({ pos: { x: 0, z: 1 } });
  setup(k, o, far, bare);
  const all = [k, o, far, bare];
  ctx.starBump(k, all);
  assert.strictEqual(o.shield, 0, '방패가 막지 않음');
  assert.strictEqual(o.spin, 0);
  assert.ok(bare.spin > 0, '방패 없는 카트가 안 돎');
  assert.strictEqual(far.spin, 0);
  bare.spin = 0;
  ctx.starBump(k, all);
  ctx.starBump(k, all);
  assert.strictEqual(o.spin, 0, '방패로 막은 뒤 다음 프레임에 다시 맞음');
  assert.strictEqual(bare.spin, 0, '같은 별에 두 번 맞음');
}
// 물풍선 명중은 실제 거리로: 진행도·옆 위치가 같아도 다른 길(지름길)에 멀리 있으면 안 맞음
{
  const shot = { mesh: { position: { x: 0, y: 1.3, z: 0 } } };
  assert.strictEqual(ctx.shotHits(shot, kart({ pos: { x: 1.5, z: 1 } })), true);
  assert.strictEqual(ctx.shotHits(shot, kart({ pos: { x: 40, z: 0 } })), false, '멀리 있는 카트가 맞음');
  assert.strictEqual(ctx.shotHits(shot, kart({ pos: { x: 0, z: 0 }, y: 9 })), false, '높이가 다른 카트(다리 위/아래)가 맞음');
}
// 아이템 2칸: 빈 칸에 들어감, 첫 칸부터 씀, 쓰면 뒤 칸이 당겨짐. 부스터 3개는 다 쓸 때까지 첫 칸에 남음
{
  const a = kart({ items: [], charges: 0 });
  setup(a);
  assert.strictEqual(ctx.giveItem(a, 'hint'), true);
  assert.strictEqual(ctx.giveItem(a, 'boost3'), true);
  assert.strictEqual(ctx.giveItem(a, 'hint'), false, '세 번째가 들어감');
  ctx.useItemFor(a);
  assert.deepStrictEqual([...a.items], ['boost3']);
  assert.strictEqual(a.charges, 3, '당겨진 부스터 3개');
  assert.strictEqual(a.hint, true);
  ctx.giveItem(a, 'hint'); ctx.useItemFor(a); ctx.useItemFor(a);
  assert.deepStrictEqual([...a.items], ['boost3', 'hint'], '부스터가 남았는데 둘째 칸이 당겨짐');
  ctx.useItemFor(a);
  assert.deepStrictEqual([...a.items], ['hint']);
  ctx.useItemFor(a);
  assert.deepStrictEqual([...a.items], []);
}
// 뒤로 던지기: 물풍선이 뒤쪽에서 시작해 뒤로 감
{
  const fakeMesh = () => ({ position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } });
  ctx.M.waterBalloon = fakeMesh;
  const k = kart({ d: 500, lat: 3 });
  setup(k);
  Object.assign(ctx.game, { shots: [], scene: { add: noop, remove: noop }, T: { segLen: 1.7, sc: null, head: new Array(1600).fill(0) } });
  ctx.throwShot('balloon', k, null, -1);
  const s = ctx.game.shots[0];
  assert.strictEqual(s.dir, -1);
  assert.ok(s.s < 500, '뒤로 던졌는데 앞에서 시작');
  ctx.throwShot('balloon', k, null);
  assert.strictEqual(ctx.game.shots[1].dir, 1);
  assert.ok(ctx.game.shots[1].s > 500);
}
// 새 공격 아이템: 벌떼(1등만), 회오리(지나는 카트 모두, 한 번씩), 부메랑(가는 길·오는 길 각 한 대)
{
  const at = (x, z) => ({ x, y: 1.3, z });
  const a = kart({ d: 100 }), b = kart({ d: 200, pos: { x: 0, z: 0 } }), c = kart({ d: 150, pos: { x: 1, z: 0 } });
  setup(a, b, c);
  assert.strictEqual(ctx.leaderOf(a), b, '1등을 못 찾음');
  assert.strictEqual(ctx.leaderOf(b), null, '자기 자신을 1등으로 노림');
  b.finished = true;
  assert.strictEqual(ctx.leaderOf(a), c, '골인한 카트를 노림');
  b.finished = false;
  // 벌떼: 대상이 아니면 가까워도 안 맞음
  const bee = { kind: 'bee', target: b, owner: a, mesh: { position: at(0, 0) } };
  assert.strictEqual(ctx.shotTryHit(bee, c), false);
  assert.strictEqual(ctx.shotTryHit(bee, b), true); assert.ok(bee.gone && b.spin > 0);
  // 회오리: 두 카트 모두 돌리고 같은 카트는 한 번, 맞혀도 계속 감
  b.spin = 0;
  const tor = { kind: 'tornado', owner: a, hitSet: new Set(), mesh: { position: at(0, 0) } };
  assert.strictEqual(ctx.shotTryHit(tor, b), true); assert.strictEqual(ctx.shotTryHit(tor, c), true);
  b.spin = 0; assert.strictEqual(ctx.shotTryHit(tor, b), false, '회오리가 같은 카트를 두 번'); assert.ok(!tor.gone);
  // 부메랑: 가는 길에 한 대, 오는 길에 한 대
  b.spin = c.spin = 0;
  const boo = { kind: 'boomerang', owner: a, phase: 'out', mesh: { position: at(0, 0) } };
  assert.strictEqual(ctx.shotTryHit(boo, b), true); assert.strictEqual(ctx.shotTryHit(boo, c), false, '가는 길에 두 대');
  boo.phase = 'back';
  assert.strictEqual(ctx.shotTryHit(boo, c), true); assert.ok(!boo.gone);
}
// 수명: 부메랑은 4초, 대상이 골인한 벌떼는 바로 사라짐 (오류 없음)
{
  const pos = () => { const p = { x: 0, y: 0, z: 0, lerpVectors() { return p; }, addScaledVector() { return p; }, clone() { return { x: 0, y: 0, z: 0 }; } }; return p; };
  const mesh = () => ({ position: pos(), rotation: { y: 0 } });
  Object.assign(ctx.M, { waterBalloon: mesh, bees: mesh, tornado: mesh, boomerang: mesh });
  ctx.groundY = () => 0;
  const a = kart({ d: 100 }), b = kart({ d: 900, pos: { x: 500, z: 0 } });
  setup(a, b);
  Object.assign(ctx.game, { shots: [], scene: { add: noop, remove: noop }, A: {}, T: { segLen: 1.7, sc: null, head: new Array(1600).fill(0), pos: new Array(1600).fill({}), right: new Array(1600).fill({}) } });
  ctx.game.p.pos = { x: 900, z: 900, distanceTo: () => 999 };
  ctx.throwShot('boomerang', a, null, 1);
  ctx.throwShot('bee', a, b, 1);
  b.finished = true;
  ctx.updateShots(0.1, [a, b]);
  assert.ok(!ctx.game.shots.some((s) => s.kind === 'bee'), '골인한 대상을 쫓는 벌떼가 남음');
  for (let k = 0; k < 45; k++) ctx.updateShots(0.1, [a, b]);
  assert.strictEqual(ctx.game.shots.length, 0, '부메랑이 4초 넘게 남음');
}
// 공격 경고: 나를 노리는 따라가는 아이템, 같은 길 뒤에서 다가오는 아이템 (120 안)
{
  const k = kart({ d: 1000, pos: { x: 0, z: 0 } }), o = kart({ d: 0 });
  setup(k, o);
  ctx.game.T = { segLen: 1, sc: null };
  const shot = (o2) => Object.assign({ owner: o, target: null, dir: 1, sc: null, gone: false, mesh: { position: { x: 0, y: 1.3, z: 0 } } }, o2);
  ctx.game.shots = [shot({ kind: 'homing', target: k, mesh: { position: { x: 100, y: 1.3, z: 0 } } })];
  const w = ctx.incomingThreat(k);
  assert.ok(w && Math.abs(w.dist - 100) < 1, '노리는 물풍선 경고 없음');
  ctx.game.shots = [shot({ kind: 'homing', target: k, mesh: { position: { x: 150, y: 1.3, z: 0 } } })];
  assert.strictEqual(ctx.incomingThreat(k), null, '150 거리에서 경고');
  ctx.game.shots = [shot({ kind: 'balloon', s: 940 })];
  assert.ok(ctx.incomingThreat(k), '뒤 60 에서 다가오는 물풍선 경고 없음');
  ctx.game.shots = [shot({ kind: 'balloon', s: 1060 })];
  assert.strictEqual(ctx.incomingThreat(k), null, '앞으로 멀어지는 물풍선에 경고');
  ctx.game.shots = [shot({ kind: 'balloon', s: 940, owner: k })];
  assert.strictEqual(ctx.incomingThreat(k), null, '내가 던진 것에 경고');
}
// 경고 중에도 Space 는 첫 칸 (방패가 둘째 칸이면 방패를 쓰지 않음)
{
  setup();
  const p = ctx.game.p;
  Object.assign(p, { items: ['hint', 'shield'], rolling: 0, finished: false, hint: false, shield: 0 });
  ctx.game.state = 'race';
  ctx.game.shots = [{ kind: 'homing', owner: kart(), target: p, dir: 1, sc: null, mesh: { position: { x: 10, y: 1.3, z: 0 } } }];
  p.pos = { x: 0, z: 0 };
  ctx.useItem();
  assert.deepStrictEqual([...p.items], ['shield'], '경고 중에 방패를 먼저 씀');
  assert.strictEqual(p.shield, 0);
}
// 룰렛이 둘째 칸을 채우는 동안에도 첫 칸은 쓸 수 있어야 함 (경고 중 방패)
{
  setup();
  const p = ctx.game.p;
  Object.assign(p, { items: ['shield'], rolling: 0.5, finished: false, shield: 0 });
  ctx.game.state = 'race';
  ctx.useItem();
  assert.strictEqual(p.shield, 8, '룰렛 중에 Space 가 무시됨');
  assert.deepStrictEqual([...p.items], []);
}
// 앞으로 던진 얼음 벽에는 던진 사람이 맞지 않음, 바로 뒤에 놓은 벽은 기존대로 1.5초만 면제
{
  const v = () => ({ x: 0, y: 0, z: 0, copy() { return this; } });
  Object.assign(ctx, { kartPoint: v, nearest: () => 0, groundY: () => 0 });
  ctx.M.iceWall = () => ({ position: { set: noop }, rotation: {} });
  const k = kart({ idx: 0 });
  setup(k);
  Object.assign(ctx.game, { hazards: [], scene: { add: noop }, A: {}, T: { pos: [{ x: 0, y: 0, z: 0 }], right: [{ x: 1, z: 0 }], head: [0], sc: null } });
  ctx.dropHazard('ice', k, 50);
  assert.ok(ctx.game.hazards[0].touched.has(k), '앞으로 던진 얼음 벽에 내가 맞음');
  ctx.dropHazard('ice', k, 0);
  assert.ok(!ctx.game.hazards[1].touched.has(k));
}
console.log('items-hit: all tests passed');
