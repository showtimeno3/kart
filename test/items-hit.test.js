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
  M: {}, ItemTable: { ITEMS: {} }, $: () => ({}),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'items.js'), 'utf8'), ctx);

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
console.log('items-hit: all tests passed');
