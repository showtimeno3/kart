// 실행: node test/items.test.js
const assert = require('assert');
const T = require('../js/itemtable.js');

const IDS = ['boost', 'banana', 'boost3', 'shield', 'balloon', 'homing', 'magnet', 'honey', 'ice', 'bubble', 'star', 'hint', 'bee', 'tornado', 'boomerang'];
assert.deepStrictEqual(Object.keys(T.ITEMS), IDS);
for (const id of IDS) {
  const it = T.ITEMS[id];
  assert.ok(it.icon && it.name, id);
  assert.strictEqual(it.w.length, 5, `${id} 묶음 5개`);
}

// 순위 묶음: 1등(0) / 2~3등(1) / 중간(2) / 뒤(3) / 꼴찌(4)
assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 7, 8].map((r) => T.bucket(r, 8)), [0, 1, 1, 2, 2, 3, 3, 4]);
assert.strictEqual(T.bucket(1, 1), 0);

let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function dist(rank, opts = {}) {
  const c = {}, n = 20000;
  for (let k = 0; k < n; k++) { const id = T.roll(rank, 8, opts.combo || 0, rnd, !!opts.firstLap); c[id] = (c[id] || 0) + 1 / n; }
  return c;
}
const first = dist(1);
for (const id of ['star', 'bubble', 'bee']) assert.ok(!first[id], `1등에게 ${id}`);
assert.ok((first.banana || 0) + (first.shield || 0) + (first.honey || 0) >= 0.75, '1등은 바나나·방패·꿀 위주');
assert.ok(!first.boomerang, '1등(첫 바퀴 아님)에게 부메랑');
// 첫 바퀴 동안 1등은 2~3등 표
assert.ok(dist(1, { firstLap: true }).boomerang > 0, '첫 바퀴 1등이 2~3등 표를 안 씀');
// 정답 콤보 3 이상이면 한 묶음 뒤 → 1등도 2~3등 표
assert.ok(dist(1, { combo: 3 }).boomerang > 0, '콤보 3 의 1등이 2~3등 표를 안 씀');
// 꼴찌에 바나나 없음, 벌떼는 1등·2~3등에서는 안 나옴 (중간부터, 사용자 결정)
assert.ok(!dist(8).banana);
assert.ok(!dist(2).bee && dist(4).bee > 0 && dist(6).bee > 0 && dist(8).bee > 0);
// 15종 모두 어딘가에서 나옴
const seen = new Set();
for (let r = 1; r <= 8; r++) Object.keys(dist(r)).forEach((id) => seen.add(id));
assert.strictEqual(seen.size, 15);
// 힌트는 어느 순위에서나
for (let r = 1; r <= 8; r++) assert.ok(dist(r).hint > 0, `${r}등 힌트 없음`);
console.log('items: all tests passed');
