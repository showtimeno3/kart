# 공부 카트 레이스 확장 (6차) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** `js/game.js` 를 파일 여러 개로 나누고, 문제 유형·아이템 12종·컴퓨터 7명·지형(기울기/노면/지름길)·새 트랙 2개를 추가한다.

**구조:** 일반 `<script>` 파일들이 전역 lexical scope(최상위 `const`/`let`/`function`)를 공유하는 방식으로 나눈다. 순수 로직(문제, 아이템 확률표, 트랙 데이터)은 `questions.js` 처럼 UMD 로 만들어 node 로 테스트한다. 게임 전체 동작은 headless Chrome 으로 `#sim` 을 돌려 확인한다.

**기술:** Three.js 0.149 (vendor 번들), WebAudio, 바닐라 JS, node 24 (테스트만), Chrome headless (sim 실행만).

**설계 문서:** `docs/superpowers/specs/2026-11-23-edu-kart-expansion-design.md`

## 전역 제약
- `index.html` 더블클릭(`file://`)으로 실행되어야 한다. ES modules, 빌드 도구, 새 의존성 금지.
- 인터넷 없이 동작 (vendor 로컬 로드 유지).
- 그래픽 '빠르게' 모드, 소프트웨어 렌더링에서 16fps 이상.
- 기존 게임의 이름·캐릭터·트랙·아이템 모양을 따라 하지 않는다.
- 코드 주석·문서는 한글, 식별자는 영문. 커밋 메시지 한글.
- 비눗방울 등 화면 효과는 가운데 문제 카드(`#question`)를 가리지 않는다.

## 설계 문서와 다른 점 (내 결정)
- 설계 문서는 공용 namespace `window.EK` 를 적었지만, 최상위 선언을 파일끼리 공유하는 방식으로 바꾼다. 결과(더블클릭 실행, 파일 분리)는 같고, 기존 코드의 `game`, `settings` 참조를 하나도 고치지 않아도 되어 분리 중 실수가 줄어든다. 단점: 파일끼리 이름이 겹치면 SyntaxError 가 나므로 Task 2 에서 이름 겹침을 검사한다.

## 리뷰 초점
1. 지름길 진입·이탈 지점에서 벽에 걸리거나, 진행도(바퀴 수)가 튀어서 바퀴가 잘못 세어지는 경우 → Task 7 의 sim 에서 플레이어를 지름길로 강제 주행시켜 `laps` 와 `walls` 를 확인.
2. 방패를 가진 상태에서 꿀/얼음벽/물풍선이 동시에 닿을 때 한 번만 막고 방패가 사라져야 함 → Task 4 의 `hitKart` 단위 동작을 sim 로그(`shieldBlocks`)로 확인.
3. 컴퓨터 8대가 출발 격자에서 서로 겹쳐 시작하거나 첫 커브에서 엉켜 멈추는 경우 → Task 5 sim 에서 모든 컴퓨터의 진행도가 2바퀴에 도달하는지 확인.
4. 💡 힌트를 들고 있는데 다음 문이 이미 지나갔거나 경주가 끝나는 경우 → 힌트는 다음 문 문제 표시 때 소모, 남은 채로 끝나도 오류 없음 (sim 콘솔 오류 0건).
5. 새 문제 유형의 보기 글자가 문 판(512×210 캔버스)에 안 들어가는 경우 → Task 3 테스트에서 보기 최대 길이 검사.

---

### Task 1: 결정적 sim 과 headless 실행기

**파일:**
- 수정: `index.html` (스크립트 태그들 바로 앞에 인라인 스크립트)
- 수정: `js/game.js` (SIM 출력에 `items` 필드는 Task 4 에서, 지금은 손대지 않음)
- 생성: `test/sim.mjs`
- 생성: `test/sim-baseline.json` (Task 2 비교용, Task 2 끝나면 삭제)

**인터페이스:**
- 생성: `node test/sim.mjs [hash...]` → 해시마다 headless Chrome 으로 `index.html#<hash>` 를 열고 콘솔의 `SIM {...}` 한 줄을 JSON 으로 받아 출력. 콘솔 오류(`Uncaught`, `ERROR:CONSOLE`)가 있으면 exit 1. 인자 없으면 기본 세트: `sim=400&track=0`, `sim=400&track=1`, `sim=400&track=0&subject=english`, `sim=400&track=1&drift=1`.
- 생성: `--save <file>` 이면 결과를 파일에 저장, `--compare <file>` 이면 저장된 결과와 다르면 차이를 출력하고 exit 1.

- [ ] **Step 1: 시드 고정 난수 넣기**
  `index.html` 의 `<script src="vendor/three-bundle.js">` 앞에 인라인 스크립트: 해시가 `#sim` 또는 `#race` 로 시작하면 `Math.random` 을 mulberry32(시드) 로 바꾼다. 시드는 해시의 `seed=숫자`, 없으면 1. 그 외 해시에서는 아무것도 안 함.
- [ ] **Step 1b: sim 해시 파서를 순서 무관하게** `js/game.js` 끝의 `/^#(sim|race)=.../` 정규식을 `new URLSearchParams(location.hash.slice(1))` 로 바꿔 `track, subject, species, level, difficulty, seed, drift, shortcut, pause` 를 아무 순서로 받게 한다 (기존 해시들은 그대로 동작). `simDrift` 도 같은 파서를 씀.
- [ ] **Step 2: `test/sim.mjs` 작성**
  Chrome 경로: `C:/Program Files/Google/Chrome/Application/chrome.exe`, 없으면 Edge. 인자: `--headless=new --enable-logging=stderr --v=0 --user-data-dir=<새 임시 폴더> --no-first-run --autoplay-policy=no-user-gesture-required file:///.../index.html#<hash>`. stderr 에서 `"SIM {` 를 찾으면 프로세스를 끝냄. 해시마다 60초 제한. 임시 폴더는 매번 새로 만들어 localStorage(틀린 문제 bank)가 결과에 섞이지 않게 함.
- [ ] **Step 3: 결정성 확인**
  Run: `node test/sim.mjs --save test/sim-baseline.json` 를 두 번, 두 번째는 `--compare test/sim-baseline.json`
  Expected: 두 번째 실행 exit 0 (같은 시드 → 같은 결과). 다르면 sim 경로에 남은 비결정 요소(시간, 이벤트)를 찾아 제거.
- [ ] **Step 4: 커밋** `test: sim 시드 고정과 headless 실행기 추가` (sim-baseline.json 은 커밋하지 않음, `.gitignore` 에 추가)

### Task 2: `game.js` 분리 (동작 변화 없음)

**파일:**
- 생성: `js/tracks.js`, `js/core.js`, `js/audio.js`, `js/input.js`, `js/render.js`, `js/world.js`, `js/race.js`, `js/player.js`, `js/ai.js`, `js/view.js`, `js/hud.js`, `js/menu.js`, `js/main.js`
- 삭제: `js/game.js`
- 수정: `index.html` 스크립트 태그 (아래 순서)
- 생성: `test/globals.test.js`

**나누는 단위 (원래 game.js 줄 번호):**
| 파일 | 내용 |
|------|------|
| `tracks.js` | `TRACKS` 데이터(28–64). UMD(`window.TRACKS` / `module.exports`). 쓰는 `bump`, `sstep`, `wrapU` 는 파일 안에 따로 정의 |
| `core.js` | 상수·유틸(3–26), 설정·저장·`speak`(66–96), `let game = null` (원래 798 에서 옮김) |
| `audio.js` | `Sound`, 오디오 잠금 해제(98–183) |
| `input.js` | 키·터치 입력(185–210) |
| `render.js` | 렌더러·후처리·라벨·하늘·파티클(212–353) |
| `world.js` | 트랙·지형·장식·볼거리·`groundY`(355–795) |
| `race.js` | `startRace`, 보조 함수, 아이템 사용, 문제 문(800–915, 946–1052) |
| `player.js` | 플레이어 물리·효과(1054–1229) |
| `ai.js` | 컴퓨터·움직이는 장애물(1231–1334) |
| `view.js` | 카트 자세·세계 갱신·카메라·문제 카드 위치(1336–1466) |
| `hud.js` | 미니맵(916–944), HUD·결과(1468–1567) |
| `menu.js` | 메뉴 쇼케이스·일시정지·설정·화면 전환(1569–1688) |
| `main.js` | 루프·sim·bench·audiotest(1690–1790) |

**규칙:**
- 각 파일 맨 위 `'use strict';`, IIFE 로 감싸지 않음 (최상위 선언을 파일끼리 공유하기 위해).
- 최상위에서 바로 실행되는 문장(설정 읽기, `Sound` IIFE, 이벤트 등록, 렌더러 생성, `showcase` IIFE, 마지막 `applyQuality(); refreshMenu(); requestAnimationFrame(frame);`, sim 시작)은 원래 순서를 그대로 지킨다. 함수 선언은 자유롭게 옮겨도 된다. (난수 호출 순서가 같아야 baseline 과 결과가 같음)
- 스크립트 순서: `three-bundle, questions, trackgen, models, music, tracks, core, audio, input, render, world, race, player, ai, view, hud, menu, main`.

- [ ] **Step 1: 이름 겹침 검사 테스트 작성** `test/globals.test.js`
  `js/` 의 게임 파일들(UMD 제외)에서 최상위 `const|let|function|class` 이름을 정규식으로 모아, (a) 파일끼리 같은 이름이 없고 (b) `window` 의 바꿀 수 없는 속성(`top, location, document, window, self, parent, frames, name, status, closed, length, origin, event, history, navigator`) 과 겹치지 않는지 assert. 아직 파일이 없으므로 Step 2 전에는 FAIL.
- [ ] **Step 2: 파일 나누기** 위 표대로 잘라 옮기고 `index.html` 수정, `js/game.js` 삭제.
- [ ] **Step 3: 검사**
  Run: `node test/globals.test.js && node test/questions.test.js && node test/sim.mjs --compare test/sim-baseline.json`
  Expected: 셋 다 PASS. sim 결과가 baseline 과 완전히 같음.
- [ ] **Step 4: 브라우저 수동 확인** `#race=20` 을 headless 스크린샷(`--screenshot`)으로 찍어 화면이 그려지는지 확인. `#intro` 도 같은 방법.
- [ ] **Step 5: 커밋** `refactor: game.js 를 역할별 파일 13개로 분리` 후 `test/sim-baseline.json` 삭제.

### Task 3: 문제 유형 다양화

**파일:**
- 수정: `js/questions.js`
- 수정: `test/questions.test.js`

**인터페이스:**
- 기존 유지: `Questions.math(level)`, `Questions.english(level)`, `Questions.next(subject, level, bank)`, `Questions.reshuffle(q)`, `Questions.WORDS`.
- 생성: `Questions.TYPES` = `{ math: {1: [...], 2: [...], 3: [...]}, english: {1: [...], 2: [...], 3: [...]} }`, 각 값은 유형 이름 배열.
- 생성: `Questions.make(subject, level, type)` → 문제 객체 `{ id, prompt, choices: string[3], answer: 0|1|2, speak?, speakAfter? }`.
- `math(level)`, `english(level)` 은 그 수준의 유형 중 하나를 무작위로 골라 `make` 를 부른다.

**유형 이름과 형식 (설계 문서 표 그대로):**
| subject.level | type | prompt 예 | 보기 예 |
|---|---|---|---|
| math.1 | `add`, `sub` (기존) | `7 + 5 = ?` | |
| math.1 | `blank` | `□ + 3 = 7` | `4`, `5`, `3` |
| math.1 | `compare` | `8 ○ 5` | `>`, `<`, `=` (항상 이 셋) |
| math.1 | `count` | `🍎🍎🍎🍎🍎🍎🍎` (3~9개) | `7`, `6`, `8` |
| math.2 | `mul`, `add2`, `sub2` (기존) | | |
| math.2 | `blankMul` | `4 × □ = 28` | |
| math.2 | `clock` | `짧은바늘 3, 긴바늘 6` | `3:30`, `6:15`, `3:06` |
| math.2 | `unit` | `1m = □cm` / `2m 5cm = □cm` | `100`, `10`, `1000` |
| math.3 | `mul3`, `div`, `add3`, `sub3` (기존) | | |
| math.3 | `fracCompare` | `2/5 ○ 3/5` (분모 같거나 분자 같음) | `>`, `<`, `=` |
| math.3 | `fracAdd` | `1/5 + 2/5 = ?` (분모 같음, 약분 안 함, 합 < 1) | `3/5`, `3/10`, `2/5` |
| math.3 | `decimal` | `1.2 + 0.5 = ?` (소수 한 자리) | `1.7`, `1.6`, `0.7` |
| math.3 | `order` | `2 + 3 × 4 = ?` | `14`, `20`, `24` |
| english.1 | `picture` (기존 e1) | | |
| english.1 | `listen` | `🔊 잘 듣고 골라요` + `speak: en` | 그림 3개 |
| english.1 | `firstLetter` | `🐱 _at` | `c`, `b`, `h` |
| english.2 | `meaning` (기존 e2) | | |
| english.2 | `missing` | `c_t` (가운데 모음 하나를 뺌) | `a`, `o`, `u` |
| english.3 | `spell` (기존 e3) | | |
| english.3 | `spelling` | `🐘 코끼리` | `elephant`, `elefant`, `elephent` (오답은 글자 바꾸기 규칙으로 생성, 정답과 다름) |
| english.3 | `opposite` | `big ↔ ?` | `small`, `tall`, `long` |

- `clock`: 긴바늘은 3·6·9·12 중 하나(15·30·45·0분). 오답은 시·분 바꾸기(`6:15`)와 긴바늘 숫자를 분으로 그대로 읽기(`3:06`). 둘이 겹치거나 정답과 같으면 ±1시간으로 채움.
- 단어: `WORDS` 를 약 120개로 늘림 (동물·음식·학교·날씨·색깔·숫자·몸). 형식 `[영어, 뜻, 그림, 수준]` 그대로. 반대말은 따로 `OPPOSITES = [['big','small'], ...]` 15쌍 이상.
- id 규칙: `<type>:<문제를 구별하는 문자열>` (틀린 문제 bank 에서 중복 판별에 씀).

- [ ] **Step 1: 실패하는 테스트 작성** `test/questions.test.js` 에 추가:
  ```js
  for (const subject of ['math', 'english']) for (const level of [1, 2, 3]) for (const type of Q.TYPES[subject][level]) {
    for (let k = 0; k < 300; k++) {
      const q = Q.make(subject, level, type);
      assert.strictEqual(q.choices.length, 3);
      assert.strictEqual(new Set(q.choices).size, 3, `${type} 보기 중복: ${q.choices}`);
      assert.ok([0, 1, 2].includes(q.answer));
      assert.ok(q.choices.every((c) => [...c].length <= 12), `${type} 보기가 너무 김: ${q.choices}`);
      assert.ok([...q.prompt].length <= 22, `${type} 문제가 너무 김: ${q.prompt}`);
      assert.ok(q.id.startsWith(type + ':'));
    }
  }
  // 정답 검증: 계산 유형은 다시 계산해서 비교
  ```
  유형별 정답 재계산 검사: `blank`, `blankMul`, `order`, `decimal`, `fracAdd`, `compare`, `fracCompare`, `count`, `unit` 은 prompt 를 파싱해 정답을 다시 구하고 `q.choices[q.answer]` 와 같은지 assert. 영어는 `WORDS`/`OPPOSITES` 에서 정답을 찾아 비교. `assert.ok(Q.WORDS.length >= 110)`.
- [ ] **Step 2: FAIL 확인** Run: `node test/questions.test.js` → `Q.TYPES` undefined 로 FAIL.
- [ ] **Step 3: 구현** 위 인터페이스대로 `js/questions.js` 수정.
- [ ] **Step 4: PASS 확인** Run: `node test/questions.test.js` → `questions: all tests passed`.
- [ ] **Step 5: 화면 확인** `node test/sim.mjs` (기본 세트) 콘솔 오류 0. `#race=40&subject=english` 스크린샷에서 문제 카드와 문 판 글자가 잘리지 않는지 확인.
- [ ] **Step 6: 커밋** `feat: 산수·영어 문제 유형 추가와 단어 120개`

### Task 4: 아이템 12종

**파일:**
- 생성: `js/itemtable.js` (UMD, 순수 로직)
- 생성: `js/items.js` (게임 안 동작: 사용, 발사체, 바닥 함정, 맞음 처리)
- 생성: `test/items.test.js`
- 수정: `js/models.js` (아이템 3D 모양), `js/audio.js` (효과음), `js/race.js` (`useItem`, `dropBanana` 를 items.js 로 옮김, 문제 표시에 힌트), `js/player.js`, `js/ai.js`, `js/view.js` (`updateWorld` 의 바나나·아이템 상자 부분), `js/hud.js`, `js/main.js` (sim 에서 아이템 사용, SIM 출력), `index.html` (`#bubbles` 화면 가장자리 효과, 스크립트 태그), `style.css`

**인터페이스:**
- `itemtable.js` → `window.ItemTable` / `module.exports`:
  - `ITEMS`: `{ [id]: { icon: string, name: string, w: [front, mid, back, last] } }`, id 와 값:
    | id | icon | name | w |
    |---|---|---|---|
    | `boost` | 🚀 | 부스터 | 20,15,10,5 |
    | `banana` | 🍌 | 바나나 | 25,10,3,0 |
    | `boost3` | 🚀×3 (아이템 칸 표시는 `🚀3`) | 부스터 3개 | 0,10,15,15 |
    | `shield` | 🛡️ | 방패 | 15,12,5,0 |
    | `balloon` | 🎈 | 물풍선 | 20,15,8,0 |
    | `homing` | 🎯 | 따라가는 물풍선 | 0,10,15,10 |
    | `magnet` | 🧲 | 자석 | 0,5,15,15 |
    | `honey` | 🍯 | 꿀 웅덩이 | 15,8,3,0 |
    | `ice` | 🧊 | 얼음 벽 | 10,8,3,0 |
    | `bubble` | 🫧 | 비눗방울 구름 | 0,3,12,15 |
    | `star` | 🌈 | 무지개 별 | 0,0,6,25 |
    | `hint` | 💡 | 힌트 전구 | 8,8,8,8 |
  - `bucket(rank, total) -> 0|1|2|3`: `rank === total` (꼴찌, total>1) → 3, 아니면 `r = (rank-1)/(total-1)`; `r < 0.34` → 0, `r <= 0.67` → 1, 그 외 2. total 1 이면 0.
  - `roll(rank, total, combo, rnd = Math.random) -> id`: 버킷의 가중치로 뽑음. `combo >= 3` 이면 버킷을 한 칸 뒤로(최대 3).
- `items.js` (게임 안, 전역 함수):
  - 카트 공통 효과 필드 (플레이어 `p`, 컴퓨터 `a` 둘 다 `startRace` 에서 0 으로 초기화): `shield`, `star`, `magnet`, `sticky`, `bubble` (남은 초), `hint` (bool), `charges` (boost3 남은 횟수).
  - `giveItem(k, id)`: 아이템 지급 (`boost3` 이면 `charges = 3`).
  - `useItemFor(k)`: k 가 들고 있는 아이템 사용. 플레이어의 `useItem()` 은 이것을 부름.
  - `hitKart(k, effect, from)`: `effect` 는 `'spin' | 'sticky' | 'bump' | 'bubble'`. `k.star > 0` 이면 무시, `k.shield > 0` 이면 `shield = 0` 으로 막고 `game.stats.shieldBlocks++`, 아니면 효과 적용(플레이어 spin 1.1초/컴퓨터 1.0초는 기존 바나나와 같음, sticky 3초, bump 는 기존 장애물 부딪힘과 같음, bubble 3초).
  - `game.hazards`: 기존 `game.bananas` 를 대체. 원소 `{ kind: 'banana'|'honey'|'ice', mesh, owner, age, r, life }`. 반경 r: banana 2.4, honey 4.5, ice 2.8. 수명 life: banana 45, honey 20, ice 10. 효과: banana→spin, honey→sticky, ice→bump.
  - `game.shots`: `{ kind: 'balloon'|'homing', mesh, owner, d, lat, latV, target, age }`. 트랙 진행 거리 `d` 를 따라 초속 70 으로 앞으로 감. balloon 은 lat 고정, `|lat| > HW-1` 이면 `latV` 반사(벽에 튕김), 4초 뒤 사라짐. homing 은 `target`(던질 때 바로 앞 순위 카트)의 lat 로 다가가며 6초 뒤 사라짐. 진행 거리 차 < 3, lat 차 < 2.4 이면 맞음 → `hitKart(target, 'spin')`.
  - `updateItems(dt)`: 효과 시간 감소, hazards/shots 이동·충돌, 자석 끌림. `view.js` 의 `updateWorld` 에서 부름.
  - 효과 세부: magnet 3초 동안 바로 앞 카트(진행 거리 120 이내) 쪽으로 플레이어는 속도 +8 과 방향 보정, 컴퓨터는 속도 ×1.3, `latT` = 대상 lat. star 6초: 최고 속도 ×1.3, 부딪힌 카트 `hitKart(_, 'spin')`. bubble: 사용한 카트보다 앞 순위 전부 `hitKart(_, 'bubble')`; 플레이어가 bubble 이면 핸들 입력 ×0.5 와 `#bubbles` 표시, 컴퓨터는 `latT` 를 1초마다 무작위로 흔듦. hint: 플레이어는 다음 문 표시 때 오답 하나를 회색(문 판 relabel `✖` 회색, HTML `.choice` 에 `off` 클래스) 처리, 컴퓨터는 다음 문 정답 확률 +0.25. sticky: 최고 속도 ×0.5.
  - 아이템 상자를 먹으면 플레이어는 기존 룰렛(1초) 뒤 `roll(p.rank, total, p.combo)`, 컴퓨터는 바로 `roll(rank, total, 0)`.
- 컴퓨터 사용 규칙(기본, Task 5 에서 성격이 조절): 공격 아이템(balloon, homing, bubble)은 앞 카트가 진행 거리 80 이내일 때, magnet 은 앞 카트가 120 이내일 때, 함정(banana, honey, ice)은 뒤 카트가 60 이내일 때, 나머지는 1~3초 뒤 사용. 들고 있는 시간이 8초를 넘으면 그냥 사용.
- SIM 출력에 `items: { [id]: [플레이어 사용 수, 컴퓨터 사용 수] }`, `shieldBlocks` 추가. sim 자율주행은 아이템을 들면 바로 사용.

- [ ] **Step 1: 실패하는 테스트 작성** `test/items.test.js`:
  ```js
  const T = require('../js/itemtable.js');
  assert.strictEqual(Object.keys(T.ITEMS).length, 12);
  assert.strictEqual(T.bucket(1, 8), 0); assert.strictEqual(T.bucket(8, 8), 3); assert.strictEqual(T.bucket(5, 8), 1); assert.strictEqual(T.bucket(6, 8), 2);
  const seen = new Set(); let r = 1; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 20000; k++) for (let rank = 1; rank <= 8; rank++) {
    const id = T.roll(rank, 8, 0, rnd); seen.add(id);
    if (rank === 1) assert.notStrictEqual(id, 'star');
    if (rank === 8) assert.notStrictEqual(id, 'banana');
  }
  assert.strictEqual(seen.size, 12);
  // 콤보 3 이상이면 1등도 버킷 1 → star 는 여전히 안 나오고 boost3 는 나올 수 있음
  ```
- [ ] **Step 2: FAIL 확인** Run: `node test/items.test.js` → 모듈 없음 FAIL.
- [ ] **Step 3: `itemtable.js` 구현 → PASS 확인.**
- [ ] **Step 4: `items.js` 와 모델·효과음·HUD 구현.** 아이템 칸(`#item`)에 아이콘, 효과 중이면 남은 시간 막대(CSS). `#bubbles` 는 화면 네 가장자리만 덮는 방사형 그라데이션(가운데 60% 투명).
- [ ] **Step 5: sim 확인** Run: `node test/sim.mjs sim=400&track=0 sim=400&track=1 sim=400&track=0&seed=2 sim=400&track=1&seed=3`
  Expected: 콘솔 오류 0, 4번 합쳐 컴퓨터가 12종 모두 1회 이상 사용(없으면 seed 를 더 돌려 확인하고, 그래도 안 나오면 확률표/사용 조건 버그). 플레이어 `laps` 2, 컴퓨터 모두 진행도 ≥ 2.0 (아이템 때문에 경주가 끝나지 않는 일이 없어야 함).
- [ ] **Step 6: 커밋** `feat: 아이템 12종과 순위별 확률표`

### Task 5: 컴퓨터 7명, 동물 3종, 성격

**파일:**
- 수정: `js/models.js` (`SPECIES` 에 fox, panda, duck; `makeDriver` 에 종별 분기)
- 수정: `js/core.js` (`AI_COUNT = 7`), `js/race.js` (출발 격자, 성격 지정), `js/ai.js` (성격, 컴퓨터끼리 부딪힘), `js/items.js` (성격별 사용 규칙)
- 수정: `index.html` (캐릭터 버튼 3개 추가)

**인터페이스:**
- `SPECIES` 추가: `fox: { name: '여우', fur: 0xe8732c, light: 0xfff1e0, kart: 0x8e24aa }`, `panda: { name: '판다', fur: 0xf5f5f5, light: 0xffffff, kart: 0x43a047 }`, `duck: { name: '오리', fur: 0xffd54f, light: 0xfff8e1, kart: 0xff7043 }`. 모양: 여우는 뾰족한 귀 + 흰 주둥이, 판다는 검은 둥근 귀 + 검은 눈 주위 무늬, 오리는 펭귄처럼 주둥이(납작한 주황 부리) 분기.
- 출발 격자 (`[트랙 샘플 번호, lat]`, 플레이어는 기존처럼 `[8, 0]`): `[[98,-9],[98,9],[80,-9],[80,9],[62,-9],[62,9],[44,0]]`. (원래 4명 격자 `[[44,-9],[44,9],[26,-9],[26,9]]` 를 앞으로 밀고 늘림. 플레이어와 뒤쪽 줄 간격은 원래 18 샘플 유지)
- 컴퓨터 필드 `a.persona`: `'aggro' | 'steady' | 'prank'`, 순서대로 돌아가며 지정.
  - aggro: `base +0.6`, 공격 아이템 거리 조건 80→120, 안쪽 길(커브 안쪽 lat 쪽으로 latT 를 4 치우침).
  - steady: `skill +0.08`, 방패는 앞 6 이내에 함정/발사체가 있을 때만 사용, 그 외 아이템은 기본 규칙.
  - prank: 혼자 바나나 떨어뜨리는 간격 `14~30초` → `8~14초`, 함정 아이템은 뒤 카트 거리 조건 없이 1초 뒤 사용.
- 컴퓨터끼리 부딪힘: 진행 거리 차 < 3.5, lat 차 < 2.6 인 쌍은 `latV` 를 서로 반대로 4 만큼 밀고 뒤 카트 `speed` 를 앞 카트 속도로 제한. 8대 28쌍 전부 검사(가벼움).

- [ ] **Step 1: 모델과 메뉴 버튼 추가.** `#race=20&species=fox`, `species=panda`, `species=duck` 스크린샷으로 세 동물 확인.
- [ ] **Step 2: 컴퓨터 수·격자·성격·부딪힘 구현.**
- [ ] **Step 3: sim 확인** Run: `node test/sim.mjs` (기본 세트) + `sim=400&track=0&seed=4`
  Expected: 콘솔 오류 0, `ai` 배열 길이 7, 모든 값 ≥ 2.00 (모두 완주), `rank-of` 는 `/8`. 쉬움/보통/어려움 각각 `#sim=400&difficulty=0..2` (Task 1 해시 파서에 `difficulty` 추가) 에서 보통 난이도 플레이어(자율주행) 순위가 1~8 중 한쪽 끝에 몰리지 않는지 기록.
- [ ] **Step 4: 성능 확인** `#bench&quality=low` 를 소프트웨어 렌더링(`--use-angle=swiftshader --enable-unsafe-swiftshader`)으로 20초, `__benchReport()` fps ≥ 16.
- [ ] **Step 5: 커밋** `feat: 컴퓨터 7명, 여우·판다·오리, 성격 3가지`

### Task 6: 커브 기울기와 노면 종류

**파일:**
- 수정: `js/world.js` (`sampleTrack`, `roadPoint`, `groundY`, `buildTrack` 의 흙 비탈 조건, 노면 띠)
- 수정: `js/player.js`, `js/ai.js`, `js/view.js` (차체 기울기)
- 수정: `js/tracks.js` (`surface` 필드 형식만 정의, 기존 두 트랙에는 넣지 않음)

**인터페이스:**
- `T.bank[i]`: 기울기(tan 값). `raw = clamp(T.curv[i] * 0.25, -0.14, 0.14)` 를 앞뒤 20 샘플 평균으로 부드럽게. `curv > 0` (왼쪽 커브) 이면 오른쪽(+lat)이 높아짐.
- `roadPoint(T, i, lat, dy)`: y 에 `lat * T.bank[j]` 를 더함. `groundY` 도 같은 양을 더함 (두 샘플 사이 보간).
- `buildTrack` 의 흙 비탈 조건을 `pos[i].y > 0.3` → `roadPoint(T, i, s * EDGE).y > 0.3` 로 바꿔 기울어 올라간 바깥쪽 벽 밑이 비지 않게 함.
- 차체: 플레이어 `p.roll` 목표와 컴퓨터 `a.roll` 목표에 `-Math.atan(T.bank[idx])` 를 더함.
- `def.surface`: `[[u0, u1, 'ice'|'sand'|'mud'], ...]` → `T.surf[i]` (null 이면 보통 길). 화면: 해당 구간 도로 위에 반투명 띠 (ice `#cfefff` 0.6, sand `#e9c98c` 0.85, mud `#7a5230` 0.85).
- 물리: ice → 옆미끄러짐을 잡는 값 `9 → 2.5`, 가속 ×0.8. sand → 최고 속도 ×0.8 + 모래 먼지. mud → 최고 속도 ×0.7 + 흙 튐. 컴퓨터는 목표 속도에 같은 배율, ice 에서는 `latV` 감쇠를 3.5 → 1.2.

- [ ] **Step 1: 기울기 구현 후 sim** Run: `node test/sim.mjs` → 콘솔 오류 0, 두 트랙 `walls` 가 Task 5 결과보다 크게(2배 이상) 늘지 않음, `avgKmh` 변화 ±10% 이내.
- [ ] **Step 2: 화면 확인** 급커브 지점 스크린샷 (`#race=초` 로 헤어핀 근처 시간) 에서 벽과 흙 비탈 사이 틈이 없는지.
- [ ] **Step 3: 노면 구현.** 임시로 초원 트랙에 `surface: [[0.3, 0.33, 'ice']]` 를 넣어 sim 이 완주하는지 확인한 뒤 지운다 (실제 노면은 Task 7, 8 에서 지름길과 새 트랙에 씀).
- [ ] **Step 4: 커밋** `feat: 커브 기울기와 노면 종류(얼음·모래·진흙)`

### Task 7: 지름길

**파일:**
- 수정: `js/trackgen.js` (`dubins` 내보내기)
- 수정: `js/tracks.js` (트랙마다 `shortcut`)
- 수정: `js/world.js` (지름길 도로·벽·지형 평탄화), `js/player.js` (벽·진행도), `js/ai.js` (지름길 주행), `js/hud.js` (미니맵에 지름길 선)
- 생성: `test/tracks.test.js`

**인터페이스:**
- `TrackGen.dubins(a, b, R, step)` 를 api 에 추가 (지금 내부 함수, 형식 그대로).
- `def.shortcut = { from: u0, to: u1, R: 반경, surface: 'mud'|'sand'|'ice' }`. 지름길 중심선 = `dubins(주 도로 u0 자세, u1 자세, R, 4)`.
- 제약 (테스트로 검사): 지름길 길이 < 주 도로 u0→u1 길이 × 0.8. 양 끝(앞뒤 25 단위 제외) 지름길 점과 주 도로 다른 구간 점 거리 ≥ `2*EDGE + 6`. 양 끝의 주 도로 높이 < 0.3 (평지에서만 갈라짐). 지름길 안에는 문·점프대·부스터 발판 없음.
- `T.sc`: `{ pos: Vector3[], right: Vector3[], head: number[], n, i0, i1, len, surf, SHW: 7 }` (폭 14, 갓길 2).
- 플레이어: 매 프레임 주 도로 lat(`latM`)과 지름길 lat(`latS`, 가장 가까운 지름길 점 기준)을 둘 다 구함. `|latM| <= EDGE-1.4` 이거나 `|latS| <= SHW+0.6` 이면 벽 없음. 둘 다 밖이면 더 가까운 쪽 벽으로 밀어냄 (기존 벽 반사 코드 재사용). 지름길 위에 있으면(`|latS| <= SHW+0.6` 이고 `|latM| > EDGE`) `p.idx = i0 + round((k / n) * ((i1 - i0 + N) % N))` 로 진행도 투영. 높이는 0, 노면은 `T.sc.surf`.
- 주 도로 벽: 갈라지는 쪽의 벽 strip 은 `i0 - 15 ~ i0 + 15`, `i1 - 15 ~ i1 + 15` 구간을 비움.
- 컴퓨터: u0 근처에서 확률(aggro 0.5, steady 0.1, prank 0.3)로 지름길 선택. 선택하면 `a.sc = { s: 0 }` 로 지름길 거리 `s` 를 따라 이동, `a.d` 는 `(i1 - i0) * segLen / len` 배율로 같이 증가해서 진행도가 맞음. 끝나면 `a.sc = null`.
- 지형 `distTrack` 과 장식 배치는 지름길 점도 포함 (지름길 주변이 평평하고 나무가 안 남).
- 초원 지름길: 진흙, 사막 지름길: 모래. 위치는 만드는 사람이 테스트를 통과하도록 고름.

- [ ] **Step 1: 실패하는 테스트 작성** `test/tracks.test.js`: `require('../js/tracks.js')`, `require('../js/trackgen.js')` 로 모든 트랙에 대해 (a) 닫힌 고리 길이 (b) 주 도로 자기 겹침 0 (다리 구간 제외; 다리 구간에서는 높이 차 ≥ 6) (c) 문·점프대·부스터 발판 위치의 앞뒤 20 단위 방향 변화 < 0.05 rad (직선 위) (d) 위 지름길 제약. 지금은 `shortcut` 이 없어서 (d) FAIL.
- [ ] **Step 2: FAIL 확인** Run: `node test/tracks.test.js`
- [ ] **Step 3: 두 트랙에 지름길 정의 → 테스트 PASS.**
- [ ] **Step 4: 게임 안 구현.**
- [ ] **Step 5: sim 확인** sim 자율주행에 `&shortcut=1` 옵션 추가: 지름길 시작 근처에서 목표점을 지름길 점으로 바꿈. Run: `node test/sim.mjs sim=400&track=0&shortcut=1 sim=400&track=1&shortcut=1` 와 기본 세트.
  Expected: 콘솔 오류 0, `laps` 2 (바퀴 수 정상), 지름길 주행 sim 의 `walls` 가 기본 sim 대비 +5 이하, SIM 출력의 새 필드 `scUsed` (플레이어 지름길 통과 수) = 2.
- [ ] **Step 6: 커밋** `feat: 트랙마다 지름길`

### Task 8: 새 트랙 — 눈 산길, 해안 도로

**파일:**
- 수정: `js/tracks.js` (트랙 2개), `js/world.js` (테마별 분기: `desert` 불리언들을 `def.theme` 분기로), `js/models.js` (눈 덮인 침엽수, 눈사람, 눈덩이, 등대, 야자수, 갈매기, 파라솔), `js/music.js` (곡 `snow`, `coast`), `js/race.js` (`bloomPass` 세기 테마별), `index.html` (트랙 버튼 2개)

**인터페이스:**
- 테마 이름: `'snow'`, `'coast'`. `def.theme` 로 갈리는 곳: 지형 높이·색(`makeTerrain`, `buildTerrain`), 장식(`decorate`), 터널 종류(`tunnel[2]` 에 `'snow'` 추가: 흰 아치), 움직이는 장애물(`movers.kind` 에 `'snowball'`: boulder 모양 흰색, `'crab'`: 해안, 양떼처럼 좌우 이동), 개울(`river` 를 해안에서는 물웅덩이로 재사용), 광고판 문구, 음악(`Music.play(def.theme)`), bloom 세기.
- 눈 산길: 길이 2,400~2,700, 언덕 2곳 이상(`elev`), 얼음 호수 구간 `surface: [[a, b, 'ice']]` 1곳, 눈 터널, 굴러오는 눈덩이, 지름길(얼음, 호수 가로지르기), 문 5~6개, 아이템 줄 3곳, 점프대 1~2, 부스터 발판 3.
- 해안 도로: 길이 2,400~2,700, 바다 쪽 지형은 높이 0 + 모래색, 그 너머 큰 물 평면(y 0.02), 등대 1, 야자수, 물웅덩이(감속·물보라), 해안 절벽 위 다리 1곳(`bridge`), 게(crab) 장애물, 지름길(모래사장), 문 5~6개.
- `TRACKS` 순서: 0 초원, 1 사막, 2 눈 산길, 3 해안 도로. 최고 기록 키 `eduKart.best.<번호>` 그대로.

- [ ] **Step 1: 트랙 모양 정의 → `node test/tracks.test.js` PASS.**
- [ ] **Step 2: 테마·모델·음악 구현.**
- [ ] **Step 3: sim 확인** Run: `node test/sim.mjs sim=400&track=2 sim=400&track=3 sim=400&track=2&shortcut=1 sim=400&track=3&shortcut=1 sim=400&track=2&drift=1`
  Expected: 콘솔 오류 0, 모두 `laps` 2, `gateGaps` 의 최소 간격 ≥ 250 (문 사이 10초 이상).
- [ ] **Step 4: 화면 확인** 두 트랙 `#intro`, `#race=30`, `#race=90` 스크린샷.
- [ ] **Step 5: 성능 확인** 두 트랙 `#bench&track=2&quality=low`, `track=3` 소프트웨어 렌더링 fps ≥ 16.
- [ ] **Step 6: `#audiotest`** → 새 곡 2개 `peak` < 0.9, `rms` > 0.05, `bad` 0.
- [ ] **Step 7: 커밋** `feat: 새 트랙 눈 산길과 해안 도로`

### Task 9: 마무리

**파일:**
- 수정: `README.md`, `docs/superpowers/specs/2026-11-23-edu-kart-expansion-design.md` (끝에 "구현 결과" 절)

- [ ] **Step 1: 전체 점검** Run: `node test/questions.test.js && node test/items.test.js && node test/tracks.test.js && node test/globals.test.js && node test/sim.mjs` 그리고 트랙 4개 × (`math`, `english`) sim.
  Expected: 모두 PASS, 콘솔 오류 0.
- [ ] **Step 2: README 갱신** 트랙 4개, 아이템 12종 표, 캐릭터 8종, 컴퓨터 7명, 문제 유형, 파일 구조(13+3 파일), 점검 명령(`node test/*.test.js`, `node test/sim.mjs`). "인터넷이 필요하다" 문구를 "인터넷 없이 실행된다" 로 고침. 점검 결과 절에 이번 sim·bench 숫자.
- [ ] **Step 3: 설계 문서에 구현 결과와 설계와 달라진 점 기록.**
- [ ] **Step 4: 커밋** `docs: README 와 설계 문서에 6차 확장 결과 반영`
