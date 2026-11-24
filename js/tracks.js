// 트랙 정의 데이터. 브라우저에서는 window.TRACKS, node 에서는 module.exports.
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrapU = (d) => d - Math.round(d); // 한 바퀴 비율 차이를 -0.5~0.5 로
  const bump = (u, c, w) => Math.exp(-((wrapU(u - c) / w) ** 2));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // turtle: 직선 ['S', 길이] / 원호 ['A', 반경, 각도(+왼쪽)] 를 이어 붙인 모양 (끝은 자동으로 출발점에 닫힘, js/trackgen.js)
  // elev(u): 한 바퀴 비율 u → 높이. 나머지는 u 위치의 볼거리. 위치는 모두 직선 구간에 오도록 반경을 재서 골랐음.
  const TRACKS = [
    {
      theme: 'meadow', name: '초원 서킷', skyTop: 0x3b8cff, skyBottom: 0xd4f1ff, ground: ['#5cbf4a', '#52b043', '#68c955', '#4aa63c'],
      shoulder: '#b08a58', skirt: 0x58b247, skirtSlope: 2.2,
      // 8자: 출발 직선 → 다리(위로 교차) → 오른쪽 커브 → 급커브(반경 45) → S자 → 다리 밑 통과 → 긴 직선과 언덕 → 헤어핀(반경 40) → 개울 → 꽃 터널 → 마지막 헤어핀
      turtle: [['A', 200, 15], ['S', 250], ['A', 60, -90], ['S', 150], ['A', 90, -60], ['A', 45, -110], ['S', 100], ['A', 60, 35], ['A', 60, -35],
        ['S', 100], ['A', 120, -100], ['S', 260], ['A', 110, 80], ['S', 120], ['A', 40, 130], ['S', 160], ['A', 80, -50], ['A', 150, 50], ['S', 60]],
      elev: (u) => 11 * bump(u, 0.068, 0.025) + 6 * bump(u, 0.52, 0.018),
      bridge: [0.02, 0.12],
      gates: [0.16, 0.32, 0.48, 0.7, 0.88], // 0.29 → 0.32: 지름길 출구(0.28)에서 100 이상, 점프대(0.34) 앞
      items: [0.195, 0.56, 0.8],
      pads: [[0.455, 0], [0.685, 0]],
      ramps: [[0.34, 9, 11, 1.6, 9], [0.845, -9, 11, 1.6, 9]],
      movers: { u: 0.615, kind: 'sheep', count: 3 },
      tunnel: [0.9, 0.95, 'flower'],
      river: 0.725,
      shortcut: { from: 0.18, to: 0.28, R: 30, surface: 'mud' }, // 진흙 지름길: 입구가 급해서 드리프트나 감속이 필요, 짧지만 느림 → 부스터를 쓰면 이득
    },
    {
      theme: 'desert', name: '사막 협곡', skyTop: 0x4f9be6, skyBottom: 0xffe6bd, ground: ['#e9c98c', '#dfbb78', '#f1d59f', '#d6b06d'],
      shoulder: '#c4925c', skirt: 0xc8743f, skirtSlope: 0.35, fog: 0xf3d6a8,
      // 출발 직선 → 중간 커브 → 빠른 꺾임 → 메사 오르막 → 메사 위 커브 → 절벽 점프 → S자 → 헤어핀(반경 30) → 바위 아치 협곡 → 반대 방향 커브 2개
      turtle: [['S', 300], ['A', 90, -90], ['S', 120], ['A', 220, -25], ['S', 260], ['A', 60, -70], ['S', 280], ['A', 50, 45], ['A', 50, -45],
        ['S', 80], ['A', 30, -150], ['S', 220], ['A', 130, 40], ['A', 70, -60]],
      elev: (u) => 13 * sstep(0.28, 0.37, u) * (1 - sstep(0.48, 0.497, u)),
      bridge: null,
      gates: [0.08, 0.2, 0.33, 0.44, 0.575, 0.87], // 첫 문은 출발 격자 앞쪽
      items: [0.1, 0.415, 0.66],
      pads: [[0.3, 9], [0.64, -9]],
      ramps: [[0.468, 0, 38, 1.8, 10], [0.885, 8, 11, 1.6, 9]],
      movers: { u: 0.685, kind: 'boulder', count: 3 },
      tunnel: [0.635, 0.705, 'rock'],
      river: null,
      shortcut: { from: 0.91, to: 0.01, R: 45, surface: 'sand' }, // 모래 지름길 (출발선을 가로지름)
    },
    {
      theme: 'snow', name: '눈 산길', skyTop: 0x5d8fd6, skyBottom: 0xe8f2ff, ground: ['#eef4fb', '#e2ebf5', '#f8fbff', '#d6e2ee'],
      shoulder: '#c9d6e3', skirt: 0xe9f0f7, skirtSlope: 1.6, fog: 0xe3edf8,
      // 출발 직선 → 큰 왼쪽 커브 → 헤어핀(반경 45) → 오르막 언덕 → 긴 커브 → S자(반경 60) → 두 번째 언덕 → 얼음 호수 → 눈 터널
      turtle: [['S', 240], ['A', 90, 95], ['S', 130], ['A', 45, -130], ['S', 110], ['A', 55, 150], ['S', 180], ['A', 140, 45], ['S', 140],
        ['A', 60, -110], ['A', 60, 110], ['S', 120], ['A', 70, 90], ['S', 100], ['A', 110, -50], ['S', 80]],
      elev: (u) => 9 * bump(u, 0.3, 0.04) + 12 * bump(u, 0.63, 0.035),
      bridge: null,
      gates: [0.07, 0.17, 0.36, 0.465, 0.68, 0.9], // 첫 문은 출발 격자 앞쪽
      items: [0.1, 0.45, 0.865],
      pads: [[0.345, -9], [0.75, 0]],
      ramps: [[0.252, 8, 11, 1.6, 9], [0.84, -8, 11, 1.6, 9]], // 점프대 끝에서 다음 문까지 100 이상
      movers: { u: 0.6, kind: 'snowball', count: 3 },
      tunnel: [0.92, 0.96, 'snow'],
      river: null,
      surface: [[0.5, 0.56, 'ice']],
      shortcut: { from: 0.74, to: 0.82, R: 55, surface: 'ice' }, // 얼어붙은 호수 가로지르기
    },
    {
      theme: 'coast', name: '해안 도로', skyTop: 0x2f8fe8, skyBottom: 0xc8ecff, ground: ['#f2dca8', '#ead09a', '#f7e6bd', '#e3c58b'],
      shoulder: '#d9bf8a', skirt: 0xc9a46e, skirtSlope: 0.6, fog: 0xd2efff,
      // 바닷가 긴 직선(물웅덩이, 게) → 오른쪽 커브 → 안쪽 언덕길 → 헤어핀 → 해안 절벽 위 다리 → 긴 커브 → 마지막 커브
      turtle: [['S', 480], ['A', 90, -100], ['S', 200], ['A', 60, 70], ['S', 140], ['A', 50, -150], ['S', 260], ['A', 120, -40], ['S', 190],
        ['A', 70, 60], ['S', 120], ['A', 60, -110]],
      elev: (u) => 10 * sstep(0.49, 0.53, u) * (1 - sstep(0.585, 0.625, u)),
      bridge: [0.49, 0.63],
      gates: [0.1, 0.3, 0.41, 0.55, 0.67, 0.9],
      items: [0.075, 0.53, 0.8], // 첫 줄은 출발 격자 앞쪽
      pads: [[0.29, -9], [0.76, 0]],
      ramps: [[0.32, 8, 11, 1.6, 9], [0.92, -8, 11, 1.6, 9]], // 점프대 끝에서 다음 문까지 100 이상
      movers: { u: 0.13, kind: 'crab', count: 3 },
      tunnel: null,
      river: 0.18,
      shortcut: { from: 0.77, to: 0.85, R: 55, surface: 'sand' }, // 모래사장 지름길
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = TRACKS;
  else root.TRACKS = TRACKS;
})(this);
