// 실행: node test/items.test.js
const assert = require('assert');
const T = require('../js/itemtable.js');

const IDS = ['boost', 'banana', 'boost3', 'shield', 'balloon', 'homing', 'magnet', 'honey', 'ice', 'bubble', 'star', 'hint'];
assert.deepStrictEqual(Object.keys(T.ITEMS), IDS);
for (const id of IDS) {
  const it = T.ITEMS[id];
  assert.ok(it.icon && it.name, id);
  assert.strictEqual(it.w.length, 4, id);
}

// 순위 버킷: 앞(0) / 중간(1) / 뒤(2) / 꼴찌(3)
assert.strictEqual(T.bucket(1, 8), 0);
assert.strictEqual(T.bucket(3, 8), 0);
assert.strictEqual(T.bucket(4, 8), 1);
assert.strictEqual(T.bucket(5, 8), 1);
assert.strictEqual(T.bucket(6, 8), 2);
assert.strictEqual(T.bucket(7, 8), 2);
assert.strictEqual(T.bucket(8, 8), 3);
assert.strictEqual(T.bucket(1, 1), 0);

let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const seen = new Set(), byRank = {};
for (let k = 0; k < 20000; k++) {
  for (let rank = 1; rank <= 8; rank++) {
    const id = T.roll(rank, 8, 0, rnd);
    assert.ok(IDS.includes(id), id);
    seen.add(id);
    (byRank[rank] = byRank[rank] || {})[id] = (byRank[rank][id] || 0) + 1;
    if (rank === 1) assert.notStrictEqual(id, 'star', '1등에게 무지개 별');
    if (rank === 8) assert.notStrictEqual(id, 'banana', '꼴찌에게 바나나');
  }
}
assert.strictEqual(seen.size, 12, '12종이 모두 나와야 함');
// 힌트 전구는 어느 순위에서나 나옴
for (let rank = 1; rank <= 8; rank++) assert.ok(byRank[rank].hint > 0, `${rank}등 힌트 없음`);
// 정답 콤보 3 이상이면 한 칸 뒤 버킷: 1등도 부스터 3개를 받을 수 있음 (콤보 없으면 못 받음)
assert.ok(!byRank[1].boost3);
let got = false;
for (let k = 0; k < 5000 && !got; k++) got = T.roll(1, 8, 3, rnd) === 'boost3';
assert.ok(got, '콤보 3 의 1등이 boost3 를 못 받음');
// 버킷 3(꼴찌)은 콤보가 있어도 그대로
for (let k = 0; k < 3000; k++) assert.notStrictEqual(T.roll(8, 8, 5, rnd), 'banana');
console.log('items: all tests passed');
