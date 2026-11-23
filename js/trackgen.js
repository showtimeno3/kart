// 트랙 모양 만들기: 직선/원호 조각을 이어 붙이고(거북이 방식), 마지막은 출발점으로 자동으로 닫음(Dubins 경로).
// 조각: ['S', 길이] 직선, ['A', 반경, 각도(도, +는 왼쪽)] 원호. 결과는 [x, z] 점 목록 (닫힌 고리, 마지막 점 = 첫 점 제외).
// 브라우저에서는 window.TrackGen, node 에서는 module.exports.
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const mod = (a) => ((a % TAU) + TAU) % TAU;

  // 게임 좌표: 방향 h 일 때 진행 = (sin h, cos h), 왼쪽 회전 = h 증가.
  // 계산은 표준 평면 (x, y=z) 에서 각도 φ = atan2(dz, dx) 로 함. 게임의 왼쪽 회전 = 표준의 시계 방향.
  function build(spec, step = 4, closeR = 70) {
    let x = 0, z = 0, h = 0;
    const pts = [[0, 0]], marks = [];
    for (const seg of spec) {
      marks.push(pts.length - 1);
      if (seg[0] === 'S') {
        const n = Math.max(2, Math.round(seg[1] / step));
        for (let i = 1; i <= n; i++) pts.push([x + Math.sin(h) * seg[1] * i / n, z + Math.cos(h) * seg[1] * i / n]);
        x += Math.sin(h) * seg[1]; z += Math.cos(h) * seg[1];
      } else {
        const R = seg[1], ang = (seg[2] * Math.PI) / 180, s = Math.sign(ang);
        const n = Math.max(3, Math.round((Math.abs(ang) * R) / step));
        const cx = x + Math.cos(h) * R * s, cz = z - Math.sin(h) * R * s; // 왼쪽(s>0) 중심
        for (let i = 1; i <= n; i++) { const hh = h + (ang * i) / n; pts.push([cx - Math.cos(hh) * R * s, cz + Math.sin(hh) * R * s]); }
        h += ang; x = pts[pts.length - 1][0]; z = pts[pts.length - 1][1];
      }
    }
    const closeStart = pts.length - 1;
    const close = dubins([x, z, Math.atan2(Math.cos(h), Math.sin(h))], [0, 0, Math.atan2(1, 0)], closeR, step);
    for (const p of close.slice(1)) pts.push(p);
    pts.pop(); // 마지막 = 출발점
    return { pts, marks, closeStart, closeLen: close.length * step };
  }

  // 두 자세(위치 + 표준 각도) 사이를 반경 R 원호-직선-원호로 잇는 가장 짧은 길
  function dubins(a, b, R, step) {
    let best = null;
    const circle = (p, s) => [p[0] - Math.sin(p[2]) * R * s, p[1] + Math.cos(p[2]) * R * s]; // s=+1 반시계(표준 왼쪽)
    const onC = (c, phi, s) => [c[0] + R * s * Math.sin(phi), c[1] - R * s * Math.cos(phi)];
    for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
      const c1 = circle(a, s1), c2 = circle(b, s2), dx = c2[0] - c1[0], dy = c2[1] - c1[1], D = Math.hypot(dx, dy), base = Math.atan2(dy, dx);
      const cands = s1 === s2 ? [base] : D >= 2 * R ? [base + Math.asin((2 * R) / D), base - Math.asin((2 * R) / D)] : [];
      for (const psi of cands) {
        const t1 = onC(c1, psi, s1), t2 = onC(c2, psi, s2);
        const lx = t2[0] - t1[0], ly = t2[1] - t1[1], L = lx * Math.cos(psi) + ly * Math.sin(psi);
        if (L < 0 || Math.abs(lx * Math.sin(psi) - ly * Math.cos(psi)) > 1e-6 * (1 + Math.abs(L))) continue;
        const sweep = (f, t, s) => (s > 0 ? mod(t - f) : -mod(f - t));
        const w1 = sweep(a[2], psi, s1), w2 = sweep(psi, b[2], s2);
        const total = (Math.abs(w1) + Math.abs(w2)) * R + L;
        if (!best || total < best.total) best = { total, s1, s2, c1, c2, w1, w2, psi, t1, t2, L };
      }
    }
    const out = [[a[0], a[1]]];
    const arc = (c, f, w, s) => { const n = Math.max(1, Math.round((Math.abs(w) * R) / step)); for (let i = 1; i <= n; i++) out.push(onC(c, f + (w * i) / n, s)); };
    arc(best.c1, a[2], best.w1, best.s1);
    const n = Math.max(1, Math.round(best.L / step));
    for (let i = 1; i <= n; i++) out.push([best.t1[0] + ((best.t2[0] - best.t1[0]) * i) / n, best.t1[1] + ((best.t2[1] - best.t1[1]) * i) / n]);
    arc(best.c2, best.psi, best.w2, best.s2);
    return out;
  }

  // 커브 기울기(tan 값): 방향 변화가 클수록 바깥쪽을 높임, 최대 0.14(약 8도). 앞뒤 20 샘플 평균으로 부드럽게. 닫힌 고리.
  function bank(curv) {
    const n = curv.length, raw = curv.map((c) => Math.max(-0.14, Math.min(0.14, c * 0.25))), W = 20;
    return raw.map((_, i) => { let s = 0; for (let k = -W; k <= W; k++) s += raw[(i + k + n) % n]; return s / (2 * W + 1); });
  }
  // 노면 종류: [[u0, u1, 'ice'|'sand'|'mud'], ...] 에서 u 의 노면 (u1 < u0 이면 출발선을 넘는 구간)
  function surfaceAt(list, u) {
    for (const [u0, u1, kind] of list || []) if (u0 <= u1 ? u >= u0 && u < u1 : u >= u0 || u < u1) return kind;
    return null;
  }

  const api = { build, dubins, bank, surfaceAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrackGen = api;
})(this);
