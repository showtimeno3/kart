// 문제 생성기: 브라우저에서는 window.Questions, node에서는 module.exports
(function (root) {
  'use strict';
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function build(id, prompt, answer, wrongs, extra) {
    const choices = shuffle([answer, wrongs[0], wrongs[1]]);
    return Object.assign({ id, prompt, choices, answer: choices.indexOf(answer) }, extra);
  }
  // 오답 보기: 흔한 실수(hints) 우선, 그다음 가까운 수
  function numWrongs(ans, hints) {
    const out = [];
    const cands = shuffle(hints).concat(shuffle([ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10]));
    for (const c of cands) {
      if (c >= 0 && c !== ans && !out.includes(c)) out.push(c);
      if (out.length === 2) break;
    }
    return out;
  }

  function math(level) {
    let a, b, op, ans, hints = [];
    if (level === 1) {
      op = pick(['+', '-']);
      if (op === '+') { a = rint(1, 10); b = rint(1, 10); ans = a + b; }
      else { a = rint(5, 20); b = rint(1, a); ans = a - b; }
    } else if (level === 2) {
      op = pick(['×', '×', '+', '-']);
      if (op === '×') { a = rint(2, 9); b = rint(2, 9); ans = a * b; hints = [a * (b + 1), a * (b - 1)]; }
      else if (op === '+') { a = rint(10, 79); b = rint(10, 99 - a); ans = a + b; }
      else { a = rint(30, 99); b = rint(10, a - 10); ans = a - b; }
    } else {
      op = pick(['×', '÷', '+', '-']);
      if (op === '×') { a = rint(11, 25); b = rint(3, 9); ans = a * b; hints = [a * (b + 1), (a + 1) * b]; }
      else if (op === '÷') { b = rint(2, 9); ans = rint(2, 12); a = b * ans; hints = [ans + 1, ans - 1]; }
      else if (op === '+') { a = rint(100, 799); b = rint(100, 999 - a); ans = a + b; hints = [ans + 100, ans - 100]; }
      else { a = rint(300, 999); b = rint(100, a - 100); ans = a - b; hints = [ans + 100, ans - 100]; }
    }
    const prompt = `${a} ${op} ${b} = ?`;
    return build('m:' + prompt, prompt, String(ans), numWrongs(ans, hints).map(String));
  }

  // [영어, 뜻, 그림, 수준]
  const WORDS = [
    ['apple', '사과', '🍎', 1], ['banana', '바나나', '🍌', 1], ['cat', '고양이', '🐱', 1], ['dog', '개', '🐶', 1],
    ['fish', '물고기', '🐟', 1], ['bird', '새', '🐦', 1], ['car', '자동차', '🚗', 1], ['sun', '해', '☀️', 1],
    ['moon', '달', '🌙', 1], ['star', '별', '⭐', 1], ['tree', '나무', '🌳', 1], ['book', '책', '📖', 1],
    ['ball', '공', '⚽', 1], ['cake', '케이크', '🍰', 1], ['egg', '달걀', '🥚', 1], ['milk', '우유', '🥛', 1],
    ['pig', '돼지', '🐷', 1], ['cow', '소', '🐮', 1], ['duck', '오리', '🦆', 1], ['bus', '버스', '🚌', 1],
    ['house', '집', '🏠', 2], ['flower', '꽃', '🌸', 2], ['rabbit', '토끼', '🐰', 2], ['lion', '사자', '🦁', 2],
    ['tiger', '호랑이', '🐯', 2], ['horse', '말', '🐴', 2], ['chair', '의자', '🪑', 2], ['water', '물', '💧', 2],
    ['rain', '비', '🌧️', 2], ['snow', '눈(날씨)', '❄️', 2], ['train', '기차', '🚆', 2], ['school', '학교', '🏫', 2],
    ['pencil', '연필', '✏️', 2], ['window', '창문', '🪟', 2], ['bread', '빵', '🍞', 2],
    ['elephant', '코끼리', '🐘', 3], ['umbrella', '우산', '☂️', 3], ['library', '도서관', '📚', 3],
    ['airplane', '비행기', '✈️', 3], ['strawberry', '딸기', '🍓', 3], ['mountain', '산', '⛰️', 3],
    ['ocean', '바다', '🌊', 3], ['hospital', '병원', '🏥', 3], ['butterfly', '나비', '🦋', 3],
    ['computer', '컴퓨터', '💻', 3], ['birthday', '생일', '🎂', 3], ['breakfast', '아침 식사', '🍳', 3],
    ['island', '섬', '🏝️', 3], ['rainbow', '무지개', '🌈', 3], ['dinosaur', '공룡', '🦕', 3],
  ];

  function english(level) {
    const pool = WORDS.filter((w) => (level === 1 ? w[3] === 1 : level === 2 ? w[3] <= 2 : w[3] >= 2));
    const w = pick(pool);
    const others = shuffle(pool.filter((o) => o !== w)).slice(0, 2);
    const [en, ko, emoji] = w;
    if (level === 1) return build('e1:' + en, emoji, en, others.map((o) => o[0]), { speakAfter: en });
    if (level === 2) return build('e2:' + en, en, ko, others.map((o) => o[1]), { speak: en });
    return build('e3:' + en, `${emoji} ${ko}`, en, others.map((o) => o[0]), { speakAfter: en });
  }

  function reshuffle(q) {
    const ans = q.choices[q.answer];
    const choices = shuffle(q.choices);
    return Object.assign({}, q, { choices, answer: choices.indexOf(ans) });
  }

  // 틀린 문제(bank)는 30% 확률로 다시 출제
  function next(subject, level, bank) {
    if (bank && bank.length && Math.random() < 0.3) return reshuffle(pick(bank));
    return subject === 'english' ? english(level) : math(level);
  }

  const api = { math, english, next, reshuffle, WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Questions = api;
})(this);
