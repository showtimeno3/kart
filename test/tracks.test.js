// 실행: node test/tracks.test.js
// 트랙 모양 검사: 닫힌 고리, 도로끼리 겹침 없음(다리 제외), 볼거리는 직선 위, 지름길 조건
const assert = require('assert');
const TRACKS = require('../js/tracks.js');
const G = require('../js/trackgen.js');

const EDGE = 25.2, SC_HALF = 9, SC_OFFSET = 16; // 주 도로 반폭(갓길 포함), 지름길 반폭(갓길 포함), 지름길 시작점을 옆으로 옮기는 거리 (js/world.js 와 같게)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// 한 바퀴 비율 u ↔ 점: 게임처럼 길이 기준으로 고르게
function sample(def) {
  const pts = G.build(def.turtle).pts, n = pts.length, cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i % n]));
  const L = cum[n];
  const at = (u) => { // u 위치의 점과 방향(표준 각도 φ)
    const s = (((u % 1) + 1) % 1) * L;
    let i = 0; while (cum[i + 1] < s) i++;
    const a = pts[i], b = pts[(i + 1) % n], f = (s - cum[i]) / (cum[i + 1] - cum[i]);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  return { pts, cum, L, at, n };
}
const headingChange = (S, u, span) => { // u 앞뒤 span 거리 사이 방향 변화
  const d = span / S.L, a = S.at(u - d)[2], b = S.at(u + d)[2];
  return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
};
const inSpan = (u, u0, u1) => (u0 <= u1 ? u >= u0 && u <= u1 : u >= u0 || u <= u1);

TRACKS.forEach((def, t) => {
  const S = sample(def), name = `${t}:${def.name}`;
  // (a) 닫힌 고리, 길이
  assert.ok(dist(S.pts[0], S.pts[S.n - 1]) < 8, `${name} 고리가 안 닫힘`);
  assert.ok(S.L > 2000 && S.L < 3400, `${name} 길이 ${Math.round(S.L)}`);
  // (b) 도로끼리 겹침: 길 따라 150 이상 떨어진 두 점은 2*EDGE+2 이상 떨어져야 함. 다리 교차는 높이 차 6 이상
  for (let i = 0; i < S.n; i += 2) for (let j = i + 2; j < S.n; j += 2) {
    const along = Math.min(S.cum[j] - S.cum[i], S.L - (S.cum[j] - S.cum[i]));
    if (along < 150) continue;
    const d = dist(S.pts[i], S.pts[j]);
    if (d >= 2 * EDGE + 2) continue;
    const dy = Math.abs(def.elev(S.cum[i] / S.L) - def.elev(S.cum[j] / S.L));
    assert.ok(dy >= 6, `${name} 도로 겹침: u=${(S.cum[i] / S.L).toFixed(3)} 과 u=${(S.cum[j] / S.L).toFixed(3)} 거리 ${d.toFixed(1)}, 높이 차 ${dy.toFixed(1)}`);
  }
  // (c) 점프대·부스터 발판은 직선 위 (앞뒤 20 사이 방향 변화 < 0.05 rad), 문은 완만한 커브까지 (< 0.25 rad, 반경 약 160 이상)
  const spots = def.gates.map((u) => ['문', u, 0.25]).concat(def.ramps.map((r) => ['점프대', r[0], 0.05]), def.pads.map((p) => ['발판', p[0], 0.05]));
  for (const [kind, u, lim] of spots) assert.ok(headingChange(S, u, 20) < lim, `${name} ${kind} u=${u} 가 커브 위 (${headingChange(S, u, 20).toFixed(3)})`);

  // (d) 지름길
  const sc = def.shortcut;
  assert.ok(sc, `${name} 지름길 없음`);
  const a = S.at(sc.from), b = S.at(sc.to);
  const path = G.shortcutPath(a, b, sc.R, 4, SC_OFFSET);
  let len = 0; for (let k = 1; k < path.length; k++) len += dist(path[k - 1], path[k]);
  const mainLen = ((((sc.to - sc.from) % 1) + 1) % 1) * S.L;
  assert.ok(len < mainLen * 0.8, `${name} 지름길이 충분히 짧지 않음: ${Math.round(len)} / 본 도로 ${Math.round(mainLen)}`);
  assert.ok(Math.abs(def.elev(sc.from)) < 0.3 && Math.abs(def.elev(sc.to)) < 0.3, `${name} 지름길 양 끝이 평지가 아님`);
  assert.ok(['mud', 'sand', 'ice'].includes(sc.surface), `${name} 지름길 노면`);
  // 갈라지는 곳(지름길 앞뒤 70, 본 도로 갈림점 앞뒤 110)을 빼면 지름길과 본 도로는 EDGE+SC_HALF+4 이상 떨어져야 함
  const jA = sc.from * S.L, jB = sc.to * S.L;
  let along = 0;
  for (let k = 0; k < path.length; k++) {
    if (k) along += dist(path[k - 1], path[k]);
    const nearEnd = along < 70 || len - along < 70;
    for (let i = 0; i < S.n; i++) {
      const m = S.cum[i], dj = Math.min(...[jA, jB].map((j) => Math.min(Math.abs(m - j), S.L - Math.abs(m - j))));
      if (nearEnd && dj < 110) continue;
      const d = dist(path[k], S.pts[i]);
      assert.ok(d >= EDGE + SC_HALF + 4, `${name} 지름길(${Math.round(along)}/${Math.round(len)})이 본 도로 u=${(m / S.L).toFixed(3)} 와 ${d.toFixed(1)} 거리`);
    }
  }
  // 지름길로 건너뛰는 본 도로 구간에 문이 있으면 그 문제는 못 풂 → 문은 없어야 함
  for (const u of def.gates) assert.ok(!inSpan(u, sc.from, sc.to), `${name} 건너뛰는 구간에 문 u=${u}`);
  // 지름길에서 나오자마자 문이 있으면 문제를 읽고 차선을 고를 시간이 없음: 출구에서 다음 문까지 100 이상
  for (const u of def.gates) { const after = ((((u - sc.to) % 1) + 1) % 1) * S.L; assert.ok(after >= 100, `${name} 지름길 출구 바로 뒤에 문 u=${u} (${Math.round(after)})`); }
});
console.log(`tracks: all tests passed (${TRACKS.length} tracks)`);
