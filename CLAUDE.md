# 공부 카트 레이스 — 작업 메모

게임 설명·조작·파일 구조·점검 방법은 `README.md`. 설계 기록은 `docs/superpowers/specs/`, 구현 계획은 `docs/superpowers/plans/`.

## 작업 규칙
- `index.html` 더블클릭(`file://`)으로 실행되어야 함: ES modules·빌드 도구·새 의존성 금지. Three.js 0.149 는 `vendor/`.
- 게임 스크립트(`js/*.js`)는 일반 `<script>` 로, 최상위 `const`/`let`/`function` 을 파일끼리 공유함. 새 파일은 `index.html` 의 순서에 맞게 넣기. 이름 겹침·600줄 제한은 `node test/globals.test.js` 가 검사.
- 순수 로직(`questions.js`, `itemtable.js`, `trackgen.js`, `tracks.js`)은 UMD 라 node 테스트에서 바로 읽음. `items.js`·`shots.js` 는 `test/items-hit.test.js` 가 vm 가짜 환경으로 읽음 — 새 전역을 쓰면 그 테스트의 가짜 환경에도 추가해야 함.
- 주석·문서·커밋 메시지는 한글, 식별자는 영문.
- 일부 파일은 CRLF. 문자열 치환으로 고칠 때 줄바꿈을 맞추거나 Edit 도구를 쓰기 (이모지가 든 줄은 sed 가 자주 실패함).

## 점검
- node: `for t in questions items items-hit tracks trackgen globals; do node test/$t.test.js; done`
- 자율주행 sim: `node test/sim.mjs` (기본 4가지, `sim=600` = 3바퀴). 시드 고정이라 같은 해시면 같은 결과. 콘솔 오류나 컴퓨터 위치 튐(`aiJump` > 3)이 있으면 실패.
- 화면: `node test/shot.mjs 출력.png "race=30&track=2"` (`--touch` 터치 화면, 해시 인자 `use=`, `give=`, `threat=1|bee`, `intro&track=n`, `showcase=종`).
- 자율주행은 정답 100% 라 실제 플레이보다 앞서 나감 — 맞는 횟수·순위는 실제 플레이로 다시 볼 것.

## 다음 할 일
- **7차 ② 트랙 개편 (설계 전)**: 사용자 결정 — 트랙 길이 약 1.3배(3바퀴 유지), 맵 특색 C(맵마다 주행 장치 + 길 모양). 제안했던 예: 사막 모래바람·모래 웅덩이·넓은 흙길, 눈 산길 긴 빙판·눈사태·눈더미 벽, 해안 파도·나무 데크, 초원 양떼·꽃 터널 가속·나무 울타리. 길이를 늘리면 한 바퀴 아이템 줄 5~6, 문 7~8 로 다시 배치 (`test/tracks.test.js` 조건 지킬 것).
- 사용자가 실제 플레이로 확인할 것: 다른 카트 공격에 맞는 횟수(sim 평균 1.6), 날아가는 아이템 소리 크기, 난이도.
- 남은 작은 문제: 둘째 칸의 부스터 3개가 일반 부스터와 같은 아이콘 / 벌떼를 든 채 1등이 되면 첫 칸이 막힘 / 출발 때 인트로 카메라에 격자 일부만 보임.
