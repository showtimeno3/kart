// 실행: node test/questions.test.js
const assert = require('assert');
const Q = require('../js/questions.js');

function check(q, label) {
  assert.strictEqual(q.choices.length, 3, label + ' ' + q.prompt);
  assert.strictEqual(new Set(q.choices).size, 3, `${label} 보기 중복: ${q.choices}`);
  assert.ok([0, 1, 2].includes(q.answer), label + ' ' + q.prompt);
  assert.ok(q.choices.every((c) => typeof c === 'string' && c.length > 0), `${label} 빈 보기: ${q.choices}`);
  assert.ok(q.choices.every((c) => [...c].length <= 12), `${label} 보기가 너무 김: ${q.choices}`);
  assert.ok([...q.prompt].length <= 22, `${label} 문제가 너무 김: ${q.prompt}`);
}

const num = (s) => Number(s);
const frac = (s) => { const [a, b] = s.split('/').map(Number); return a / b; };
const cmp = (x, y) => (Math.abs(x - y) < 1e-9 ? '=' : x > y ? '>' : '<');
const arith = (x, op, y) => (op === '+' ? x + y : op === '-' ? x - y : op === '×' ? x * y : x / y);
// □ 가 하나 있는 식 "x op y = z" 를 풀어서 □ 값을 구함
function solveBlank(prompt) {
  const [x, op, y, eq, z] = prompt.split(' ');
  assert.strictEqual(eq, '=', prompt);
  if (z === '□') return arith(num(x), op, num(y));
  const inv = { '+': '-', '-': '+', '×': '÷', '÷': '×' }[op];
  if (x === '□') return arith(num(z), inv, num(y));
  return op === '+' || op === '×' ? arith(num(z), inv, num(x)) : arith(num(x), op, num(z)); // x - □ = z → □ = x - z
}
const byEmoji = (e) => Q.WORDS.find((w) => w[2] === e);
const opposite = (w) => { for (const [a, b] of Q.OPPOSITES) { if (a === w) return b; if (b === w) return a; } return null; };

// 유형마다 문제를 보고 정답을 다시 구함
const EXPECT = {
  arith: (q) => { const [a, op, b] = q.prompt.split(' '); const v = arith(num(a), op, num(b)); assert.ok(Number.isInteger(v) && v >= 0, q.prompt); return String(v); },
  blank: (q) => String(solveBlank(q.prompt)),
  compare: (q) => { const [a, , b] = q.prompt.split(' '); return cmp(num(a), num(b)); },
  count: (q) => { const e = [...q.prompt][0]; return String([...q.prompt].filter((c) => c === e).length); },
  clock: (q) => { const m = /^짧은바늘 (\d+), 긴바늘 (\d+)$/.exec(q.prompt); assert.ok(m, q.prompt); return `${m[1]}:${String((+m[2] % 12) * 5).padStart(2, '0')}`; },
  unit: (q) => {
    let m = /^(\d+)m = □cm$/.exec(q.prompt); if (m) return String(+m[1] * 100);
    m = /^(\d+)m (\d+)cm = □cm$/.exec(q.prompt); if (m) return String(+m[1] * 100 + +m[2]);
    m = /^(\d+)cm = □mm$/.exec(q.prompt); if (m) return String(+m[1] * 10);
    assert.fail('모르는 단위 문제: ' + q.prompt);
  },
  fracCompare: (q) => { const [a, , b] = q.prompt.split(' '); return cmp(frac(a), frac(b)); },
  fracAdd: (q) => { const [a, , b] = q.prompt.split(' '); const [x, d] = a.split('/').map(Number), [y, d2] = b.split('/').map(Number); assert.strictEqual(d, d2); assert.ok(x + y < d, q.prompt); return `${x + y}/${d}`; },
  decimal: (q) => { const [a, op, b] = q.prompt.split(' '); return (Math.round(arith(num(a) * 10, op, num(b) * 10)) / 10).toFixed(1); },
  order: (q) => { const v = Function(`return ${q.prompt.replace(' = ?', '').replace(/×/g, '*')}`)(); return String(v); },
  picture: (q) => byEmoji(q.prompt)[0],
  listen: (q) => Q.WORDS.find((w) => w[0] === q.speak)[2],
  firstLetter: (q) => { const [e, rest] = q.prompt.split(' '); const w = byEmoji(e)[0]; assert.strictEqual('_' + w.slice(1), rest); return w[0]; },
  meaning: (q) => Q.WORDS.find((w) => w[0] === q.prompt)[1],
  missing: (q) => { const [e, pat] = q.prompt.split(' '); const w = byEmoji(e)[0]; const k = pat.indexOf('_'); assert.strictEqual(pat.slice(0, k) + w[k] + pat.slice(k + 1), w); return w[k]; },
  spell: (q) => byEmoji(q.prompt.split(' ')[0])[0],
  opposite: (q) => { const w = q.prompt.split(' ')[0]; const o = opposite(w); assert.ok(o, q.prompt); return o; },
};
const VERIFY = { add: 'arith', sub: 'arith', mul: 'arith', add2: 'arith', sub2: 'arith', mul3: 'arith', div: 'arith', add3: 'arith', sub3: 'arith',
  blank: 'blank', blankMul: 'blank', compare: 'compare', count: 'count', clock: 'clock', unit: 'unit', fracCompare: 'fracCompare', fracAdd: 'fracAdd',
  decimal: 'decimal', order: 'order', picture: 'picture', listen: 'listen', firstLetter: 'firstLetter', meaning: 'meaning', missing: 'missing',
  spell: 'spell', spelling: 'spell', opposite: 'opposite' };

// 설계 문서의 유형 표
const WANT = {
  math: { 1: ['add', 'sub', 'blank', 'compare', 'count'], 2: ['mul', 'add2', 'sub2', 'blankMul', 'clock', 'unit'], 3: ['mul3', 'div', 'add3', 'sub3', 'fracCompare', 'fracAdd', 'decimal', 'order'] },
  english: { 1: ['picture', 'listen', 'firstLetter'], 2: ['meaning', 'missing'], 3: ['spell', 'spelling', 'opposite'] },
};
assert.deepStrictEqual(Q.TYPES, WANT);

for (const subject of ['math', 'english']) for (const level of [1, 2, 3]) for (const type of Q.TYPES[subject][level]) {
  for (let k = 0; k < 400; k++) {
    const q = Q.make(subject, level, type), label = `${subject}.${level}.${type}`;
    check(q, label);
    assert.ok(q.id.startsWith(type + ':'), `${label} id: ${q.id}`);
    assert.strictEqual(q.choices[q.answer], EXPECT[VERIFY[type]](q), `${label} 정답 틀림: ${q.prompt} → ${q.choices}`);
    if (type === 'spelling') q.choices.forEach((c, i) => i !== q.answer && assert.ok(!Q.WORDS.some((w) => w[0] === c), `철자 오답이 진짜 단어: ${c}`));
    if (type === 'listen') assert.ok(q.speak);
    const r = Q.reshuffle(q);
    assert.strictEqual(r.choices[r.answer], q.choices[q.answer]);
  }
}

// 수준별 math()/english() 는 그 수준의 유형만 냄, 여러 유형이 섞여 나옴
for (const subject of ['math', 'english']) for (const level of [1, 2, 3]) {
  const seen = new Set();
  for (let k = 0; k < 2000; k++) { const q = Q[subject](level); check(q, subject); seen.add(q.id.split(':')[0]); }
  assert.deepStrictEqual([...seen].sort(), [...Q.TYPES[subject][level]].sort(), `${subject}.${level} 유형이 다 안 나옴`);
}

// 단어: 영어·뜻·그림이 모두 서로 달라야 보기가 헷갈리지 않음
assert.ok(Q.WORDS.length >= 110, `단어 ${Q.WORDS.length}개`);
for (const k of [0, 1, 2]) assert.strictEqual(new Set(Q.WORDS.map((w) => w[k])).size, Q.WORDS.length, `WORDS[${k}] 중복`);
assert.ok(Q.OPPOSITES.length >= 15);

const bank = [Q.math(1)];
for (let i = 0; i < 200; i++) check(Q.next('math', 2, bank), 'bank');
// 소리를 낼 수 없으면(음소거, 효과음 0, 음성 기능 없음) 듣기 문제는 풀 수 없음 → 내지 않음 (틀린 문제 목록에 있어도)
{
  const listenBank = [Q.make('english', 1, 'listen')];
  for (let i = 0; i < 3000; i++) {
    const q = Q.next('english', 1, listenBank, { canSpeak: false });
    check(q, 'mute');
    assert.ok(!q.id.startsWith('listen:'), '소리 없이 듣기 문제가 나옴');
  }
  let seen = false; // 소리가 나면 계속 나옴
  for (let i = 0; i < 3000 && !seen; i++) seen = Q.next('english', 1, null, { canSpeak: true }).id.startsWith('listen:');
  assert.ok(seen);
}
console.log('questions: all tests passed');
