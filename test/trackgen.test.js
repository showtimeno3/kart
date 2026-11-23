// 실행: node test/trackgen.test.js
const assert = require('assert');
const G = require('../js/trackgen.js');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// 커브 기울기: curv(샘플마다 방향 변화) → bank(tan 값). 왼쪽 커브(curv>0)면 + (오른쪽 바깥이 높음)
{
  const N = 200;
  assert.ok(G.bank(new Array(N).fill(0)).every((b) => b === 0), '직선은 기울기 0');
  const left = G.bank(new Array(N).fill(0.4));
  assert.ok(left.every((b) => near(b, 0.1)), `반경이 작은 왼쪽 커브: ${left[0]}`); // 0.4 * 0.25
  const sharp = G.bank(new Array(N).fill(-2));
  assert.ok(sharp.every((b) => near(b, -0.14)), '최대 0.14 (약 8도)');
  // 직선 → 커브로 바뀌는 곳은 앞뒤 20 샘플에 걸쳐 서서히
  const step = new Array(N).fill(0).map((_, i) => (i >= 100 ? 0.4 : 0));
  const b = G.bank(step);
  assert.ok(near(b[60], 0) && near(b[140], 0.1), '멀리서는 원래 값');
  assert.ok(b[95] > 0 && b[95] < b[100] && b[100] < b[105] && b[105] < 0.1, `서서히 바뀜: ${b[95]}, ${b[100]}, ${b[105]}`);
  // 닫힌 고리: 끝과 처음이 이어짐
  const wrap = new Array(N).fill(0).map((_, i) => (i < 5 ? 0.4 : 0));
  assert.ok(G.bank(wrap)[N - 3] > 0, '고리 끝에서 처음 커브를 봄');
}

// 노면: [[u0, u1, kind]] → 한 바퀴 비율 u 의 노면 (없으면 null). u1 < u0 이면 출발선을 넘는 구간
{
  const sf = [[0.2, 0.3, 'ice'], [0.95, 0.05, 'mud']];
  assert.strictEqual(G.surfaceAt(sf, 0.25), 'ice');
  assert.strictEqual(G.surfaceAt(sf, 0.31), null);
  assert.strictEqual(G.surfaceAt(sf, 0.97), 'mud');
  assert.strictEqual(G.surfaceAt(sf, 0.02), 'mud');
  assert.strictEqual(G.surfaceAt(sf, 0.5), null);
  assert.strictEqual(G.surfaceAt(undefined, 0.5), null);
}
console.log('trackgen: all tests passed');
