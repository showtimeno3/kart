// 아이템 종류와 순위별 확률표. 브라우저에서는 window.ItemTable, node 에서는 module.exports.
(function (root) {
  'use strict';
  // w: 순위 묶음별 가중치 [1등, 2~3등, 중간, 뒤, 꼴찌]. 1등은 막고 까는 아이템 위주, 뒤로 갈수록 공격·역전 아이템
  const ITEMS = {
    boost: { icon: '🚀', name: '부스터', w: [6, 14, 10, 6, 3] },
    banana: { icon: '🍌', name: '바나나', w: [30, 14, 6, 2, 0] },
    boost3: { icon: '🚀', name: '부스터 3개', w: [0, 0, 8, 12, 12] },
    shield: { icon: '🛡️', name: '방패', w: [28, 14, 10, 4, 0] },
    balloon: { icon: '🎈', name: '물풍선', w: [4, 16, 12, 8, 0] },
    homing: { icon: '🎯', name: '따라가는 물풍선', w: [0, 4, 10, 12, 8] },
    magnet: { icon: '🧲', name: '자석', w: [0, 0, 4, 10, 12] },
    honey: { icon: '🍯', name: '꿀 웅덩이', w: [22, 10, 5, 2, 0] },
    ice: { icon: '🧊', name: '얼음 벽', w: [4, 8, 5, 2, 0] },
    bubble: { icon: '🫧', name: '비눗방울 구름', w: [0, 0, 3, 8, 10] },
    star: { icon: '🌈', name: '무지개 별', w: [0, 0, 0, 6, 20] },
    hint: { icon: '💡', name: '힌트 전구', w: [6, 7, 7, 7, 7] },
    bee: { icon: '🐝', name: '벌떼', w: [0, 0, 0, 6, 14] },
    tornado: { icon: '🌀', name: '회오리', w: [0, 6, 8, 8, 6] },
    boomerang: { icon: '🪃', name: '부메랑', w: [0, 10, 8, 6, 0] },
  };
  const IDS = Object.keys(ITEMS);

  // 묶음: 1등 0, 2~3등 1, 꼴찌 4, 나머지는 상대 위치로 중간 2 / 뒤 3
  function bucket(rank, total) {
    if (total <= 1 || rank <= 1) return 0;
    if (rank >= total) return 4;
    if (rank <= 3) return 1;
    return (rank - 1) / (total - 1) <= 0.67 ? 2 : 3;
  }

  // 첫 바퀴 동안 1등은 2~3등 표, 정답 콤보 3 이상이면 한 묶음 뒤(더 좋은 아이템)
  function roll(rank, total, combo, rnd = Math.random, firstLap = false) {
    let b = bucket(rank, total);
    if (firstLap && b === 0) b = 1;
    if (combo >= 3) b = Math.min(4, b + 1);
    const sum = IDS.reduce((s, id) => s + ITEMS[id].w[b], 0);
    let x = rnd() * sum;
    for (const id of IDS) { x -= ITEMS[id].w[b]; if (x < 0) return id; }
    return IDS[IDS.length - 1];
  }

  const api = { ITEMS, IDS, bucket, roll };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ItemTable = api;
})(this);
