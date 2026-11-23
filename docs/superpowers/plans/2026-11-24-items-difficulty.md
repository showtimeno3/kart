# 아이템·난이도 개편 (7차 ①) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 3바퀴, 아이템 2칸, 새 공격 아이템 3종, 5묶음 확률표, 금색 상자, 공격 경고, 더 공격적인 컴퓨터, 난이도 상향.

**구조:** 날아가는 아이템(물풍선·벌떼·회오리·부메랑)은 새 파일 `js/shots.js` 로 옮겨 `items.js` 를 600줄 아래로 유지. 판정·선택 로직은 작은 함수로 두고 `test/items-hit.test.js` 의 vm 가짜 환경에서 검사. 균형은 headless sim 으로 확인.

**기술:** 기존과 같음 (바닐라 JS 일반 script, Three.js 0.149 vendor, node 테스트, headless Chrome sim).

**설계 문서:** `docs/superpowers/specs/2026-11-24-items-difficulty-design.md`

## 전역 제약
- `index.html` 더블클릭 실행, 새 의존성 없음, 파일 600줄 이하(`test/globals.test.js`).
- 주석·문서·커밋 한글, 식별자 영문.
- 경고·효과가 문제 카드(`#question`)를 가리지 않음.
- 균형 기준: 보통 난이도 자율주행(정답 100%) 시드 6개 중 5개 이상 3등 안, 플레이어가 맞는 공격 평균 2~6회/경주.

## 리뷰 초점
1. 아이템 2칸에서 부스터 3개가 첫 칸에 있을 때 둘째 칸이 당겨지지 않아야 함 → Task 3 테스트.
2. 경고 중에도 Space 는 첫 칸만 씀 (방패가 둘째 칸이면 방패를 쓰지 않음) → Task 6 테스트.
3. 벌떼를 쓴 카트가 그 사이 1등이 되었거나 1등이 골인한 경우 → 벌떼는 사라짐(오류 없음) → Task 5 테스트.
4. 부메랑이 돌아오는 중 쓴 카트가 지름길로 들어가 거리가 멀어짐 → 4초 지나면 사라짐 → Task 5 테스트(age 제한).
5. 금색 상자를 두 칸 모두 찬 상태에서 먹음 → 아무것도 안 받고 상자만 사라짐(일반 상자와 같음) → Task 3 테스트.

---

### Task 1: 3바퀴 + 난이도

**파일:** 수정 `js/core.js`(LAPS), `js/race.js`(DIFF), `js/ai.js`(따라붙기)

- [ ] **Step 1:** sim 으로 현재 상태 확인. Run: `node test/sim.mjs "sim=400&track=0"` → `laps:2`.
- [ ] **Step 2:** `LAPS = 3`. `DIFF = [{ speed: 0.97, skill: 0.55 }, { speed: 1.07, skill: 0.73 }, { speed: 1.13, skill: 0.9 }]` (지금 `skill` 은 기본값 + 무작위 0~0.12 가 더해짐 — 그대로). 따라붙기: `gap > 160 → 0.88` 는 그대로, `gap < -120 → 1.15` (지금 `-160 → 1.12`).
- [ ] **Step 3:** Run: `node test/sim.mjs "sim=600&track=0" "sim=600&track=3"` → `laps:3`, 콘솔 오류 0. (sim 초 400 → 600: 3바퀴는 약 200초)
- [ ] **Step 4:** `test/sim.mjs` 기본 해시를 `sim=600` 으로, README 의 sim 예시도. 커밋 `feat: 3바퀴, 컴퓨터 속도·정답률 상향`.

### Task 2: 확률표 5묶음, 15종

**파일:** 수정 `js/itemtable.js`, `test/items.test.js`

**인터페이스:**
- `ITEMS[id].w`: 길이 5 `[1등, 2~3등, 중간, 뒤, 꼴찌]`, 설계 문서 표의 숫자 그대로. 새 id: `bee`, `tornado`, `boomerang` (아이콘 🐝 🌀 🪃, 이름 벌떼/회오리/부메랑).
- `bucket(rank, total) -> 0..4`: rank 1 → 0, rank 2~3 → 1, 꼴찌(total>1) → 4, 나머지 `r = (rank-1)/(total-1)`: `r <= 0.67` → 2, 그 외 3. total 1 → 0.
- `roll(rank, total, combo, rnd = Math.random, firstLap = false) -> id`: `b = bucket(...)`; `firstLap && b === 0` 이면 1; `combo >= 3` 이면 `b + 1`(최대 4).

- [ ] **Step 1: 실패 테스트** `test/items.test.js` 를 새 표에 맞게 고침:
  ```js
  assert.deepStrictEqual(Object.keys(T.ITEMS), [...기존 12, 'bee', 'tornado', 'boomerang']);
  for (const id in T.ITEMS) assert.strictEqual(T.ITEMS[id].w.length, 5);
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 7, 8].map((r) => T.bucket(r, 8)), [0, 1, 1, 2, 2, 3, 3, 4]);
  // 1등: 🌈🫧🐝 0, 바나나·방패·꿀 ≥ 75%
  // 20000번 뽑아: 1등에 star/bubble/bee 없음, 1등 banana+shield+honey 비율 ≥ 0.75
  // firstLap=true 면 1등도 boomerang 이 나옴(2~3등 표), firstLap=false 면 1등에 boomerang 없음
  // 꼴찌에 banana 없음, 15종 모두 어딘가에서 나옴, 콤보 3 이면 1등도 2~3등 표(boomerang 나옴)
  ```
- [ ] **Step 2:** Run `node test/items.test.js` → FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** Run → PASS. (`bucket(4,8)`: r=3/7=0.43 → 2, `bucket(6,8)`: 0.71 → 3)
- [ ] **Step 5:** 커밋 `feat: 확률표 5묶음과 새 아이템 3종 항목`.

### Task 3: 아이템 2칸 + 금색 상자

**파일:** 수정 `js/items.js`, `js/view.js`(상자), `js/race.js`(상자 만들기, HUD 초기화), `js/hud.js`, `js/main.js`(sim), `index.html`(`#item2`), `style.css`, `test/items-hit.test.js`

**인터페이스:**
- 카트 필드 `items: string[]` (0~2개), `charges` 는 첫 칸이 `boost3` 일 때 남은 수. `item` 필드는 없앰.
- `giveItem(k, id) -> boolean`: 빈 칸 없으면 false. 첫 칸에 처음 들어간 `boost3` 이면 `charges = 3`; 둘째 칸 `boost3` 은 당겨질 때 `charges = 3`.
- `useItemFor(k, slot = 0, back = false)`: `items[slot]` 사용. 쓴 뒤 그 칸이 비면 뒤 칸이 당겨짐. `boost3` 은 `charges` 가 0 이 될 때까지 칸에 남음.
- `useItem(back = false)`: 플레이어, 항상 첫 칸.
- 금색 상자: `boxes[i].gold` (줄마다 무작위 1개), 모양은 기존 상자 텍스처를 금색 그라데이션(`#ffd84d`→`#ff9f1c`)으로, 먹으면 `giveItem` 을 빈 칸 수만큼(최대 2). 플레이어 룰렛은 그대로 1초, 끝날 때 2개 지급.
- HUD: `#item` 옆에 작은 `#item2`(56px, 모바일 40px). `updateItemSlot()` 이 둘 다 그림.
- sim 자율주행: `p.items.length && p.rolling <= 0` 이면 `useItem()`.

- [ ] **Step 1: 실패 테스트** `test/items-hit.test.js` 에 추가 (가짜 환경에서 `hint` 아이템으로 — 쓰면 `k.hint = true` 만 하는 아이템):
  ```js
  const a = kart({ items: [], charges: 0 }); setup(a);
  assert.strictEqual(ctx.giveItem(a, 'hint'), true);
  assert.strictEqual(ctx.giveItem(a, 'boost3'), true);
  assert.strictEqual(ctx.giveItem(a, 'hint'), false, '세 번째가 들어감');
  ctx.useItemFor(a); // hint 사용
  assert.deepStrictEqual(a.items, ['boost3']); assert.strictEqual(a.charges, 3, '당겨진 부스터 3개');
  // boost3 첫 칸: 세 번 써야 사라지고 그동안 둘째 칸은 그대로
  ctx.giveItem(a, 'hint'); ctx.useItemFor(a); ctx.useItemFor(a);
  assert.deepStrictEqual(a.items, ['boost3', 'hint']);
  ctx.useItemFor(a); assert.deepStrictEqual(a.items, ['hint']);
  ```
  (가짜 환경에 `updateItemSlot` 이 플레이어에만 쓰이므로 AI 카트로 검사. `boost3` 사용은 `k.boost` 만 바꿈)
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현 (`k.item` 을 쓰던 모든 곳: `grep -n "\.item\b" js/*.js`). **Step 4:** PASS + `node test/globals.test.js` + `node test/sim.mjs` (콘솔 오류 0).
- [ ] **Step 5:** 스크린샷 `node test/shot.mjs out.png "race=30&use=boost3"` 로 2칸 표시 확인. 커밋 `feat: 아이템 2칸과 금색 상자`.

### Task 4: 앞/뒤로 던지기 (물풍선, 얼음 벽) + shots.js 분리

**파일:** 생성 `js/shots.js` (items.js 의 `throwShot`, `shotHits`, `splash`, 물풍선 갱신 부분을 옮김), 수정 `js/items.js`, `js/input.js`, `index.html`(스크립트 순서: items 다음 shots), `test/items-hit.test.js`

**인터페이스:**
- `throwShot(kind, k, target, dir = 1)`: `dir` +1 앞, -1 뒤. 샷 필드 `dir`. 진행도는 `s.s += dir * SHOT_SPEED/segLen*dt`, 뒤로 던질 때 시작 `kartProg(k) - 4/segLen`. 지름길 위에서 뒤로 던지면 지름길 거리도 `dir` 방향.
- `updateShots(dt, karts)`: shots.js, `updateItems` 가 부름.
- 얼음 벽 앞으로: `dropHazard('ice', k, ahead = 50)` — 놓는 지점을 `kartPoint(k.kart, 0, 0, +50)` (도로 밖이면 가장 가까운 도로 점 lat 을 ±(HW-2) 로 자름).
- 입력: Space 누를 때 `keys.down` 이면 `useItem(true)`.
- 컴퓨터: `useItemFor(a, 0, back)` — back 은 Task 7 에서 정함.

- [ ] **Step 1: 실패 테스트** (가짜 환경에 `M.waterBalloon = () => fakeMesh()`, `game.scene = { add(){}, remove(){} }`, `game.T = { segLen: 1.7, sc: null, head: [0], ... }` 추가):
  ```js
  const k = kart({ d: 500, lat: 3 }); setup(k);
  ctx.throwShot('balloon', k, null, -1);
  const s = ctx.game.shots[0];
  assert.strictEqual(s.dir, -1); assert.ok(s.s < 500, '뒤로 던졌는데 앞에서 시작');
  ```
- [ ] **Step 2:** FAIL. **Step 3:** 구현 + 옮기기. **Step 4:** PASS, globals, sim. 스크린샷 `race=25&use=ice`(앞 얼음 벽 보임).
- [ ] **Step 5:** 커밋 `feat: 물풍선·얼음 벽 앞으로/뒤로 던지기, shots.js 분리`.

### Task 5: 새 공격 아이템 벌떼·회오리·부메랑

**파일:** 수정 `js/shots.js`, `js/items.js`(useItemFor 분기), `js/models.js`(`bees()`, `tornado()`, `boomerang()`), `js/audio.js`(`buzz`, `whoosh`, `swish`), `test/items-hit.test.js`

**인터페이스 (shots.js):**
- 샷 종류 추가: `'bee'`(속도 90, 대상 = 쏠 때 1등, 8초), `'tornado'`(속도 45, lat 0 으로 서서히, 반경 5, 6초), `'boomerang'`(속도 70, 1.5초 뒤 `phase = 'back'` 으로 쓴 카트를 향해 돌아옴, 4초 제한).
- `leaderOf(k) -> kart|null`: 1등(진행도 최대), 그게 k 자신이거나 골인했으면 null.
- `shotTryHit(sh, k) -> boolean`: 종류별 규칙 — balloon/homing: 기존(homing 은 대상 우선), bee: `k === sh.target` 만, tornado: 반경 5 + `sh.hitSet` 에 없을 때(넣고 계속 굴러감), boomerang: 반경 2.8, `phase` 별로 한 대(`sh.hitOut`/`sh.hitBack`), 쓴 카트 제외. 맞힌 뒤 샷이 사라지는지 반환값 대신 `sh.gone` 으로.
- 플레이어·컴퓨터 둘 다 같은 `useItemFor` 로 씀.

- [ ] **Step 1: 실패 테스트:**
  ```js
  // leaderOf: 진행도 최대인 카트, 자기 자신이면 null, 골인한 1등이면 null
  // bee: 대상 아닌 카트는 가까워도 안 맞음
  // tornado: 같은 카트 두 번 안 돌림, 두 카트 모두 돌림, 맞혀도 sh.gone 아님
  // boomerang: phase 'out' 에서 한 대 맞히면 그 phase 에서 다른 카트는 안 맞음, 'back' 에서 또 한 대, 쓴 카트는 안 맞음
  // age 제한: updateShots 를 4초 넘게 돌리면 부메랑 제거 (리뷰 초점 4)
  // 1등이 골인한 뒤 벌떼: leaderOf null → 샷 사라짐, 오류 없음 (리뷰 초점 3)
  ```
- [ ] **Step 2:** FAIL. **Step 3:** 구현 (모양: 벌떼 = 노랑·검정 작은 공 5개 + 날개, 회오리 = 위로 넓어지는 반투명 원뿔 3겹 회전, 부메랑 = 나무색 V 모양 회전). **Step 4:** PASS, globals, sim(콘솔 0). 스크린샷 `race=25&use=tornado`, `use=boomerang`, `use=bee`(1등 아닐 때: `difficulty=2`).
- [ ] **Step 5:** 커밋 `feat: 새 공격 아이템 벌떼·회오리·부메랑`.

### Task 6: 공격 경고

**파일:** 수정 `js/shots.js`(`incomingThreat`), `js/hud.js`(표시, 미니맵 점), `js/audio.js`(`warn`), `index.html`(`#warn`), `style.css`, `js/main.js`(SIM `warns`), `test/items-hit.test.js`

**인터페이스:**
- `incomingThreat(k) -> { icon, dist } | null`: `game.shots` 중 `owner !== k` 이고 (a) `target === k` 인 homing/bee, 또는 (b) balloon/tornado/boomerang 이 같은 길에서 k 뒤 120 거리 안 + 다가오는 방향(`dir` 기준). 가장 가까운 것.
- `#warn`: 아이템 칸 왼쪽 아래, "⚠️ 뒤에서 {icon}!" + 막대(폭 = 1 - dist/120) + 첫 칸이 방패면 " Space 로 🛡️!". 처음 뜰 때 `Sound.sfx.warn()`, 거리 40 안이면 0.25초마다.
- 미니맵: 공격 샷을 빨간 점(반지름 3).
- SIM: `game.stats.warns` (경고가 새로 뜬 횟수).

- [ ] **Step 1: 실패 테스트:**
  ```js
  // homing 이 플레이어를 노리고 거리 100 → incomingThreat 가 dist≈100 반환, 거리 150 → null
  // balloon 이 플레이어 뒤 60 에서 앞으로(dir +1) → 위협, 플레이어 앞 60 에서 앞으로 → null
  // 경고 중 useItem: items ['hint','shield'] 이면 hint 를 씀 (리뷰 초점 2) — 가짜 환경에서 플레이어로 검사
  ```
- [ ] **Step 2:** FAIL. **Step 3:** 구현. **Step 4:** PASS, globals, sim. 스크린샷으로 경고 표시 확인(`race=40&difficulty=2&seed=…` 중 warns 가 있는 시드).
- [ ] **Step 5:** 커밋 `feat: 뒤에서 날아오는 공격 경고`.

### Task 7: 컴퓨터 공격 규칙

**파일:** 수정 `js/items.js`(`aiUseItems`, `dangerNear` → `incomingThreat` 사용)

**규칙 (설계 문서 그대로):**
- balloon/homing/tornado/boomerang: 앞 카트 200 안(공격형 260) → 앞으로. 앞에 아무도 없으면(1등) balloon 은 뒤 카트 80 안일 때 뒤로.
- ice: 앞 카트 200 안이면 앞으로, 1등이면 뒤 카트 80 안일 때 뒤로.
- bee: 1~2초 뒤 사용 (`leaderOf(a)` 가 null 이면 들고 있음).
- bubble/magnet: 지금과 같음 (magnet 120).
- shield (첫 칸일 때): 안정형은 `incomingThreat(a)` 의 dist ≤ 120, 나머지는 ≤ 30 일 때. 위협 없으면 계속 들고 있음 (8초 지나도 버리지 않음).
- 그 외: 지금과 같음. 판단은 첫 칸만.

- [ ] **Step 1:** sim 지표 추가: `game.stats.pAtk` (플레이어가 공격 아이템에 맞은 횟수, 방패로 막은 것 제외) — `hitKart` 에 4번째 인자 `attack` (balloon/homing/bee/tornado/boomerang/star 가 true).
- [ ] **Step 2:** 규칙 구현 전 측정: `node test/sim.mjs "sim=600&track=0&seed=1" ... seed=6` → `pAtk` 기록(기대: 낮음).
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** 같은 측정 → `pAtk` 평균 2~6, 컴퓨터 `items` 사용에 bee/tornado/boomerang 모두 등장(여러 시드 합).
- [ ] **Step 5:** 커밋 `feat: 컴퓨터가 앞 카트를 적극 공격, 1등이면 뒤로, 위협 때 방패`.

### Task 8: 균형 맞추기 + 문서

**파일:** 수정 `js/itemtable.js`(필요하면 숫자), `README.md`, 설계 문서 끝에 결과

- [ ] **Step 1:** 균형 측정: 4트랙 × 보통 난이도 × 시드 6개(트랙 0·3 은 시드 1~6, 1·2 는 1~3) → 플레이어 순위, `pAtk`, `spins`, `warns`. 기준: 보통 시드 중 5/6 이상 3등 안, `pAtk` 평균 2~6. 쉬움·어려움 각 2시드 기록.
- [ ] **Step 2:** 기준을 벗어나면 확률표·사거리·쿨다운 조정 후 다시 측정 (조정 내용은 결과에 기록).
- [ ] **Step 3:** README: 3바퀴, 아이템 15종 표(새 3종, 던지기 방향), 2칸, 금색 상자, 경고, 확률 묶음 5개, 난이도 숫자, 테스트·sim 600. 설계 문서 끝에 "구현 결과".
- [ ] **Step 4:** 전체: 모든 node 테스트 + `node test/sim.mjs` + 위 균형 측정 결과. 커밋 `docs: 7차 ① 결과`.
