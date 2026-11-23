// 문제 생성기: 브라우저에서는 window.Questions, node에서는 module.exports
// 문제 = { id: '<유형>:<구별 문자열>', prompt, choices: [3개], answer: 정답 위치, speak?(보여줄 때 읽기), speakAfter?(지난 뒤 읽기) }
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
  function numWrongs(ans, hints = []) {
    const out = [];
    const cands = shuffle(hints).concat(shuffle([ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10]));
    for (const c of cands) {
      if (c >= 0 && c !== ans && !out.includes(c)) out.push(c);
      if (out.length === 2) break;
    }
    return out;
  }
  // 후보에서 정답과 다르고 서로 다른 것 2개
  function twoOf(ans, cands) {
    const out = [];
    for (const c of cands) if (c !== ans && !out.includes(c)) { out.push(c); if (out.length === 2) break; }
    return out;
  }
  const arith = (type, a, op, b, ans, hints) => build(`${type}:${a}${op}${b}`, `${a} ${op} ${b} = ?`, String(ans), numWrongs(ans, hints).map(String));
  const SIGNS = ['>', '<', '='];
  const sign = (x, y) => (x === y ? '=' : x > y ? '>' : '<');
  const pad2 = (n) => String(n).padStart(2, '0');
  const COUNT_EMOJI = ['🍎', '🐟', '⭐', '🌸', '🐞', '🍓', '🍩', '🐥'];

  const MATH = {
    // 1~2학년
    add() { const a = rint(1, 10), b = rint(1, 10); return arith('add', a, '+', b, a + b); },
    sub() { const a = rint(5, 20), b = rint(1, a); return arith('sub', a, '-', b, a - b); },
    blank() {
      const a = rint(1, 9), b = rint(1, 9), c = a + b, form = rint(0, 2);
      const [prompt, ans] = form === 0 ? [`□ + ${b} = ${c}`, a] : form === 1 ? [`${a} + □ = ${c}`, b] : [`${c} - □ = ${a}`, b];
      return build('blank:' + prompt, prompt, String(ans), numWrongs(ans, [c]).map(String));
    },
    compare() {
      const a = rint(0, 20), b = Math.random() < 0.25 ? a : rint(0, 20), s = sign(a, b);
      return build(`compare:${a}?${b}`, `${a} ○ ${b}`, s, SIGNS.filter((x) => x !== s));
    },
    count() {
      const e = pick(COUNT_EMOJI), n = rint(3, 9);
      return build(`count:${e}${n}`, `${e.repeat(n)} 몇 개?`, String(n), numWrongs(n, [n + 1, n - 1]).map(String));
    },
    // 3~4학년
    mul() { const a = rint(2, 9), b = rint(2, 9); return arith('mul', a, '×', b, a * b, [a * (b + 1), a * (b - 1)]); },
    add2() { const a = rint(10, 79), b = rint(10, 99 - a); return arith('add2', a, '+', b, a + b); },
    sub2() { const a = rint(30, 99), b = rint(10, a - 10); return arith('sub2', a, '-', b, a - b); },
    blankMul() {
      const a = rint(2, 9), b = rint(2, 9), c = a * b;
      const [prompt, ans] = Math.random() < 0.5 ? [`${a} × □ = ${c}`, b] : [`□ × ${b} = ${c}`, a];
      return build('blankMul:' + prompt, prompt, String(ans), numWrongs(ans, [ans + 1, ans - 1]).map(String));
    },
    clock() {
      const h = rint(1, 12), hand = pick([3, 6, 9, 12]), mm = pad2((hand % 12) * 5), ans = `${h}:${mm}`;
      const wrongs = twoOf(ans, [`${hand}:${pad2((h * 5) % 60)}`, `${h}:${pad2(hand)}`, `${(h % 12) + 1}:${mm}`, `${((h + 10) % 12) + 1}:${mm}`]);
      return build(`clock:${h}-${hand}`, `짧은바늘 ${h}, 긴바늘 ${hand}`, ans, wrongs);
    },
    unit() {
      const form = rint(0, 2);
      let prompt, ans, cands;
      if (form === 0) { const a = rint(1, 9); prompt = `${a}m = □cm`; ans = a * 100; cands = [a * 10, a * 1000, a * 100 + 10]; }
      else if (form === 1) { const a = rint(1, 5), b = rint(1, 99); prompt = `${a}m ${b}cm = □cm`; ans = a * 100 + b; cands = [a * 10 + b, a * 1000 + b, a * 100 + b + 10, a * 100 + b - 1]; }
      else { const a = rint(1, 30); prompt = `${a}cm = □mm`; ans = a * 10; cands = [a * 100, a, a * 10 + 10]; }
      return build('unit:' + prompt, prompt, String(ans), twoOf(String(ans), cands.map(String)));
    },
    // 5~6학년
    mul3() { const a = rint(11, 25), b = rint(3, 9); return arith('mul3', a, '×', b, a * b, [a * (b + 1), (a + 1) * b]); },
    div() { const b = rint(2, 9), ans = rint(2, 12); return arith('div', b * ans, '÷', b, ans, [ans + 1, ans - 1]); },
    add3() { const a = rint(100, 799), b = rint(100, 999 - a), ans = a + b; return arith('add3', a, '+', b, ans, [ans + 100, ans - 100]); },
    sub3() { const a = rint(300, 999), b = rint(100, a - 100), ans = a - b; return arith('sub3', a, '-', b, ans, [ans + 100, ans - 100]); },
    fracCompare() {
      let a, b, da, db;
      if (Math.random() < 0.5) { da = db = rint(3, 9); a = rint(1, da - 1); b = Math.random() < 0.2 ? a : rint(1, da - 1); } // 분모가 같음
      else { a = b = rint(1, 4); da = rint(a + 1, 9); db = Math.random() < 0.2 ? da : rint(a + 1, 9); } // 분자가 같음
      const s = sign(a / da, b / db);
      return build(`fracCompare:${a}/${da}?${b}/${db}`, `${a}/${da} ○ ${b}/${db}`, s, SIGNS.filter((x) => x !== s));
    },
    fracAdd() {
      const d = rint(3, 9), a = rint(1, d - 2), b = rint(1, d - 1 - a), s = a + b, ans = `${s}/${d}`;
      return build(`fracAdd:${a}+${b}/${d}`, `${a}/${d} + ${b}/${d} = ?`, ans, twoOf(ans, [`${s}/${d * 2}`, `${s > 1 ? s - 1 : s + 1}/${d}`, `${s}/${d + 1}`]));
    },
    decimal() {
      let x, y, op, r;
      do { op = pick(['+', '-']); x = rint(1, 99); y = rint(1, 99); if (op === '-' && x < y) [x, y] = [y, x]; r = op === '+' ? x + y : x - y; } while (r % 10 === 0 || r <= 0);
      const f = (n) => (n / 10).toFixed(1), ans = f(r);
      return build(`decimal:${x}${op}${y}`, `${f(x)} ${op} ${f(y)} = ?`, ans, twoOf(ans, shuffle([r + 1, r - 1, r + 10, r - 10]).filter((n) => n > 0 && n % 10).map(f)));
    },
    order() {
      const a = rint(2, 20), b = rint(2, 9), c = rint(2, 9);
      if (Math.random() < 0.5) return build(`order:${a}+${b}x${c}`, `${a} + ${b} × ${c} = ?`, String(a + b * c), numWrongs(a + b * c, [(a + b) * c]).map(String));
      return build(`order:${a}x${b}+${c}`, `${a} × ${b} + ${c} = ?`, String(a * b + c), numWrongs(a * b + c, [a * (b + c)]).map(String));
    },
  };

  // [영어, 뜻, 그림, 수준]. 영어·뜻·그림은 모두 서로 달라야 함
  const WORDS = [
    ['apple', '사과', '🍎', 1], ['banana', '바나나', '🍌', 1], ['cat', '고양이', '🐱', 1], ['dog', '개', '🐶', 1],
    ['fish', '물고기', '🐟', 1], ['bird', '새', '🐦', 1], ['car', '자동차', '🚗', 1], ['sun', '해', '☀️', 1],
    ['moon', '달', '🌙', 1], ['star', '별', '⭐', 1], ['tree', '나무', '🌳', 1], ['book', '책', '📖', 1],
    ['ball', '공', '⚽', 1], ['cake', '케이크', '🍰', 1], ['egg', '달걀', '🥚', 1], ['milk', '우유', '🥛', 1],
    ['pig', '돼지', '🐷', 1], ['cow', '소', '🐮', 1], ['duck', '오리', '🦆', 1], ['bus', '버스', '🚌', 1],
    ['hat', '모자', '🎩', 1], ['key', '열쇠', '🔑', 1], ['cup', '컵', '🥤', 1], ['bed', '침대', '🛏️', 1],
    ['bee', '벌', '🐝', 1], ['ant', '개미', '🐜', 1], ['fox', '여우', '🦊', 1], ['owl', '부엉이', '🦉', 1],
    ['hen', '암탉', '🐔', 1], ['bag', '가방', '🎒', 1], ['pen', '펜', '🖊️', 1], ['box', '상자', '📦', 1],
    ['map', '지도', '🗺️', 1], ['red', '빨강', '🟥', 1], ['one', '하나', '1️⃣', 1], ['two', '둘', '2️⃣', 1],
    ['ten', '열', '🔟', 1], ['eye', '눈(몸)', '👁️', 1], ['ear', '귀', '👂', 1], ['leg', '다리(몸)', '🦵', 1],
    ['arm', '팔', '💪', 1], ['nose', '코', '👃', 1], ['hand', '손', '✋', 1], ['foot', '발', '🦶', 1],
    ['frog', '개구리', '🐸', 1], ['bear', '곰', '🐻', 1], ['corn', '옥수수', '🌽', 1], ['rice', '밥', '🍚', 1],
    ['kite', '연', '🪁', 1], ['boat', '배(탈것)', '⛵', 1],
    ['house', '집', '🏠', 2], ['flower', '꽃', '🌸', 2], ['rabbit', '토끼', '🐰', 2], ['lion', '사자', '🦁', 2],
    ['tiger', '호랑이', '🐯', 2], ['horse', '말', '🐴', 2], ['chair', '의자', '🪑', 2], ['water', '물', '💧', 2],
    ['rain', '비', '🌧️', 2], ['snow', '눈(날씨)', '❄️', 2], ['train', '기차', '🚆', 2], ['school', '학교', '🏫', 2],
    ['pencil', '연필', '✏️', 2], ['window', '창문', '🪟', 2], ['bread', '빵', '🍞', 2],
    ['monkey', '원숭이', '🐒', 2], ['turtle', '거북', '🐢', 2], ['snake', '뱀', '🐍', 2], ['whale', '고래', '🐳', 2],
    ['penguin', '펭귄', '🐧', 2], ['mouse', '쥐', '🐭', 2], ['sheep', '양', '🐑', 2], ['grape', '포도', '🍇', 2],
    ['lemon', '레몬', '🍋', 2], ['peach', '복숭아', '🍑', 2], ['cookie', '쿠키', '🍪', 2], ['pizza', '피자', '🍕', 2],
    ['candy', '사탕', '🍬', 2], ['juice', '주스', '🧃', 2], ['cloud', '구름', '☁️', 2], ['wind', '바람', '🌬️', 2],
    ['clock', '시계', '🕰️', 2], ['phone', '전화기', '📱', 2], ['shoes', '신발', '👟', 2], ['shirt', '셔츠', '👕', 2],
    ['green', '초록', '🟩', 2], ['blue', '파랑', '🟦', 2], ['yellow', '노랑', '🟨', 2], ['three', '셋', '3️⃣', 2],
    ['five', '다섯', '5️⃣', 2], ['piano', '피아노', '🎹', 2], ['heart', '하트', '❤️', 2], ['mouth', '입', '👄', 2],
    ['tooth', '이(치아)', '🦷', 2], ['tomato', '토마토', '🍅', 2], ['carrot', '당근', '🥕', 2],
    ['elephant', '코끼리', '🐘', 3], ['umbrella', '우산', '☂️', 3], ['library', '도서관', '📚', 3],
    ['airplane', '비행기', '✈️', 3], ['strawberry', '딸기', '🍓', 3], ['mountain', '산', '⛰️', 3],
    ['ocean', '바다', '🌊', 3], ['hospital', '병원', '🏥', 3], ['butterfly', '나비', '🦋', 3],
    ['computer', '컴퓨터', '💻', 3], ['birthday', '생일', '🎂', 3], ['breakfast', '아침 식사', '🍳', 3],
    ['island', '섬', '🏝️', 3], ['rainbow', '무지개', '🌈', 3], ['dinosaur', '공룡', '🦕', 3],
    ['giraffe', '기린', '🦒', 3], ['octopus', '문어', '🐙', 3], ['dolphin', '돌고래', '🐬', 3], ['kangaroo', '캥거루', '🦘', 3],
    ['pineapple', '파인애플', '🍍', 3], ['watermelon', '수박', '🍉', 3], ['sandwich', '샌드위치', '🥪', 3], ['scissors', '가위', '✂️', 3],
    ['bicycle', '자전거', '🚲', 3], ['rocket', '로켓', '🚀', 3], ['volcano', '화산', '🌋', 3], ['thunder', '천둥', '⚡', 3],
    ['calendar', '달력', '📅', 3], ['telescope', '망원경', '🔭', 3], ['helicopter', '헬리콥터', '🚁', 3], ['snowman', '눈사람', '⛄', 3],
    ['purple', '보라', '🟪', 3], ['orange', '주황', '🟧', 3], ['castle', '성', '🏰', 3], ['tent', '텐트', '⛺', 3], ['guitar', '기타(악기)', '🎸', 3],
  ];
  const OPPOSITES = [['big', 'small'], ['hot', 'cold'], ['up', 'down'], ['fast', 'slow'], ['happy', 'sad'], ['old', 'young'], ['open', 'close'],
    ['tall', 'short'], ['day', 'night'], ['left', 'right'], ['in', 'out'], ['black', 'white'], ['full', 'empty'], ['wet', 'dry'], ['hard', 'soft'], ['push', 'pull']];
  const EN = new Set(WORDS.map((w) => w[0]));
  const VOWELS = ['a', 'e', 'i', 'o', 'u'];
  const LETTERS = 'bcdfghjklmnprstw'.split('');
  const pool = (level) => WORDS.filter((w) => (level === 1 ? w[3] === 1 : level === 2 ? w[3] <= 2 : w[3] >= 2));
  // 그럴듯한 틀린 철자: 글자 두 번 쓰기, 옆 글자 바꾸기, 모음 바꾸기, 글자 빼기
  function misspell(w) {
    const k = rint(0, w.length - 1), r = rint(0, 3);
    if (r === 0) return w.slice(0, k + 1) + w[k] + w.slice(k + 1);
    if (r === 1 && k < w.length - 1) return w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2);
    if (r === 2) { const vs = [...w].map((c, i) => (VOWELS.includes(c) ? i : -1)).filter((i) => i >= 0); const i = pick(vs); return w.slice(0, i) + pick(VOWELS.filter((v) => v !== w[i])) + w.slice(i + 1); }
    return w.length > 4 ? w.slice(0, k) + w.slice(k + 1) : w;
  }

  const ENGLISH = {
    picture(level) { const [w, ...o] = shuffle(pool(level)); return build('picture:' + w[0], w[2], w[0], o.slice(0, 2).map((x) => x[0]), { speakAfter: w[0] }); },
    listen(level) { const [w, ...o] = shuffle(pool(level)); return build('listen:' + w[0], '🔊 잘 듣고 골라요', w[2], o.slice(0, 2).map((x) => x[2]), { speak: w[0] }); },
    firstLetter(level) {
      const w = pick(pool(level).filter((x) => x[0].length >= 3)), en = w[0];
      return build('firstLetter:' + en, `${w[2]} _${en.slice(1)}`, en[0], shuffle(LETTERS.filter((c) => c !== en[0])).slice(0, 2), { speakAfter: en });
    },
    meaning(level) { const [w, ...o] = shuffle(pool(level)); return build('meaning:' + w[0], w[0], w[1], o.slice(0, 2).map((x) => x[1]), { speak: w[0] }); },
    missing(level) {
      const w = pick(pool(level)), en = w[0];
      const k = pick([...en].map((c, i) => (VOWELS.includes(c) ? i : -1)).filter((i) => i >= 0));
      return build(`missing:${en}${k}`, `${w[2]} ${en.slice(0, k)}_${en.slice(k + 1)}`, en[k], shuffle(VOWELS.filter((v) => v !== en[k])).slice(0, 2), { speakAfter: en });
    },
    spell(level) { const [w, ...o] = shuffle(pool(level)); return build('spell:' + w[0], `${w[2]} ${w[1]}`, w[0], o.slice(0, 2).map((x) => x[0]), { speakAfter: w[0] }); },
    spelling(level) {
      const w = pick(pool(level)), en = w[0], wrongs = [];
      while (wrongs.length < 2) { const m = misspell(en); if (m !== en && !EN.has(m) && !wrongs.includes(m) && m.length <= 12) wrongs.push(m); }
      return build('spelling:' + en, `${w[2]} ${w[1]}`, en, wrongs, { speakAfter: en });
    },
    opposite() {
      const [pair, ...others] = shuffle(OPPOSITES), flip = Math.random() < 0.5, word = pair[flip ? 1 : 0], ans = pair[flip ? 0 : 1];
      return build(`opposite:${word}`, `${word} ↔ ?`, ans, others.slice(0, 2).map((p) => pick(p)), { speak: word });
    },
  };

  const TYPES = {
    math: { 1: ['add', 'sub', 'blank', 'compare', 'count'], 2: ['mul', 'add2', 'sub2', 'blankMul', 'clock', 'unit'], 3: ['mul3', 'div', 'add3', 'sub3', 'fracCompare', 'fracAdd', 'decimal', 'order'] },
    english: { 1: ['picture', 'listen', 'firstLetter'], 2: ['meaning', 'missing'], 3: ['spell', 'spelling', 'opposite'] },
  };
  const make = (subject, level, type) => (subject === 'english' ? ENGLISH[type](level) : MATH[type]());
  const math = (level) => make('math', level, pick(TYPES.math[level]));
  const english = (level) => make('english', level, pick(TYPES.english[level]));

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

  const api = { math, english, make, next, reshuffle, TYPES, WORDS, OPPOSITES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Questions = api;
})(this);
