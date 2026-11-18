// 실행: node test/questions.test.js
const assert = require('assert');
const Q = require('../js/questions.js');

function check(q) {
  assert.strictEqual(q.choices.length, 3, q.prompt);
  assert.strictEqual(new Set(q.choices).size, 3, 'duplicate choices: ' + q.choices);
  assert.ok(q.answer >= 0 && q.answer < 3, q.prompt);
}

for (const level of [1, 2, 3]) {
  for (let i = 0; i < 3000; i++) {
    const q = Q.math(level);
    check(q);
    const [a, op, b] = q.prompt.split(' ');
    const x = +a, y = +b;
    const ans = op === '+' ? x + y : op === '-' ? x - y : op === '×' ? x * y : x / y;
    assert.strictEqual(q.choices[q.answer], String(ans), q.prompt);
    assert.ok(Number.isInteger(ans) && ans >= 0, q.prompt);
    q.choices.forEach((c) => assert.ok(+c >= 0, 'negative choice ' + q.prompt));

    const e = Q.english(level);
    check(e);
    const r = Q.reshuffle(e);
    assert.strictEqual(r.choices[r.answer], e.choices[e.answer]);
  }
}
// 뜻은 서로 달라야 보기가 헷갈리지 않음
assert.strictEqual(new Set(Q.WORDS.map((w) => w[1])).size, Q.WORDS.length);
assert.strictEqual(new Set(Q.WORDS.map((w) => w[0])).size, Q.WORDS.length);
const bank = [Q.math(1)];
for (let i = 0; i < 200; i++) check(Q.next('math', 2, bank));
console.log('questions: all tests passed');
