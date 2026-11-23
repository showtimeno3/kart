// 아이템 종류와 순위별 확률표. 브라우저에서는 window.ItemTable, node 에서는 module.exports.
(function (root) {
  'use strict';
  // w: 순위 버킷별 가중치 [앞, 중간, 뒤, 꼴찌]. 뒤에 있을수록 센 아이템이 잘 나옴
  const ITEMS = {
    boost: { icon: '🚀', name: '부스터', w: [20, 15, 10, 5] },
    banana: { icon: '🍌', name: '바나나', w: [25, 10, 3, 0] },
    boost3: { icon: '🚀', name: '부스터 3개', w: [0, 10, 15, 15] },
    shield: { icon: '🛡️', name: '방패', w: [15, 12, 5, 0] },
    balloon: { icon: '🎈', name: '물풍선', w: [20, 15, 8, 0] },
    homing: { icon: '🎯', name: '따라가는 물풍선', w: [0, 10, 15, 10] },
    magnet: { icon: '🧲', name: '자석', w: [0, 5, 15, 15] },
    honey: { icon: '🍯', name: '꿀 웅덩이', w: [15, 8, 3, 0] },
    ice: { icon: '🧊', name: '얼음 벽', w: [10, 8, 3, 0] },
    bubble: { icon: '🫧', name: '비눗방울 구름', w: [0, 3, 12, 15] },
    star: { icon: '🌈', name: '무지개 별', w: [0, 0, 6, 25] },
    hint: { icon: '💡', name: '힌트 전구', w: [8, 8, 8, 8] },
  };
  const IDS = Object.keys(ITEMS);

  function bucket(rank, total) {
    if (total <= 1) return 0;
    if (rank >= total) return 3;
    const r = (rank - 1) / (total - 1);
    return r < 0.34 ? 0 : r <= 0.67 ? 1 : 2;
  }

  // 정답 콤보 3 이상이면 한 칸 뒤 버킷(더 좋은 아이템)
  function roll(rank, total, combo, rnd = Math.random) {
    const b = Math.min(3, bucket(rank, total) + (combo >= 3 ? 1 : 0));
    const sum = IDS.reduce((s, id) => s + ITEMS[id].w[b], 0);
    let x = rnd() * sum;
    for (const id of IDS) { x -= ITEMS[id].w[b]; if (x < 0) return id; }
    return IDS[IDS.length - 1];
  }

  const api = { ITEMS, IDS, bucket, roll };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ItemTable = api;
})(this);
