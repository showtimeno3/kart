// 3D 모델: 카툰(toon) 재질의 카트, 동물 캐릭터, 배경 장식. window.Models 로 공개.
(function (root) {
  'use strict';
  const V3 = THREE.Vector3;

  const GRAD = (() => {
    const t = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  })();
  const matCache = new Map();
  function toon(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: GRAD }, opts)));
    return matCache.get(key);
  }
  const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1b1b2f, side: THREE.BackSide });
  const basic = (color) => new THREE.MeshBasicMaterial({ color });

  // 메시 생성 + 배치. geometry는 원점 중심이어야 외곽선이 고르게 나온다.
  function part(geo, mat, parent, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rz) m.rotation.z = o.rz;
    if (o.s) Array.isArray(o.s) ? m.scale.set(o.s[0], o.s[1], o.s[2]) : m.scale.setScalar(o.s);
    m.castShadow = o.cast !== false;
    if (o.outline) {
      const ol = new THREE.Mesh(geo, OUTLINE); ol.scale.setScalar(o.outline); ol.castShadow = false; m.add(ol);
    }
    parent.add(m);
    return m;
  }
  function limb(parent, mat, a, b, r) {
    const dir = b.clone().sub(a), len = dir.length();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.normalize());
    m.castShadow = true; parent.add(m);
    return m;
  }

  // ---------- 캐릭터 ----------
  const SPECIES = {
    bear: { name: '곰', fur: 0x9b6a3f, light: 0xe8c79a, kart: 0xe53935 },
    cat: { name: '고양이', fur: 0xf2a03a, light: 0xfff1d6, kart: 0x1e88e5 },
    rabbit: { name: '토끼', fur: 0xf4f4f8, light: 0xffffff, kart: 0xec407a },
    frog: { name: '개구리', fur: 0x5cbf3a, light: 0xd8f5a2, kart: 0xfdd835 },
    penguin: { name: '펭귄', fur: 0x2d3550, light: 0xffffff, kart: 0x26c6da },
    fox: { name: '여우', fur: 0xe8732c, light: 0xfff1e0, kart: 0x8e24aa },
    panda: { name: '판다', fur: 0xf5f5f5, light: 0xffffff, kart: 0x43a047 },
    duck: { name: '오리', fur: 0xffd54f, light: 0xfff8e1, kart: 0xff7043 },
  };
  const PINK = 0xff9aa2, DARK = 0x1b1b2f;

  function makeDriver(species, shirt) {
    const sp = SPECIES[species], g = new THREE.Group();
    const fur = toon(sp.fur), light = toon(sp.light), dark = toon(DARK), white = toon(0xffffff), pink = toon(PINK);
    // 몸통, 목도리
    part(new THREE.SphereGeometry(0.48, 16, 12), toon(shirt), g, 0, 0.4, 0, { s: [1, 1.1, 0.85], outline: 1.06 });
    part(new THREE.TorusGeometry(0.36, 0.11, 8, 18), toon(0xffd84d), g, 0, 0.84, 0.02, { rx: Math.PI / 2 });
    // 팔과 장갑 (핸들을 잡은 자세)
    for (const s of [-1, 1]) {
      limb(g, toon(shirt), new V3(s * 0.38, 0.62, 0.05), new V3(s * 0.24, 0.34, 0.8), 0.11);
      part(new THREE.SphereGeometry(0.14, 10, 8), white, g, s * 0.22, 0.32, 0.86, { outline: 1.12 });
    }
    // 머리
    const head = new THREE.Group(); head.position.set(0, 1.3, 0.05); g.add(head);
    part(new THREE.SphereGeometry(0.6, 20, 16), fur, head, 0, 0, 0, { outline: 1.05 });
    const frog = species === 'frog', penguin = species === 'penguin', duck = species === 'duck';
    if (duck) { // 납작한 주황 부리 + 머리 위 깃털
      part(new THREE.SphereGeometry(0.3, 14, 10), toon(0xff9f1c), head, 0, -0.16, 0.56, { s: [1.15, 0.38, 1], outline: 1.08 });
      part(new THREE.ConeGeometry(0.08, 0.3, 6), fur, head, 0.04, 0.66, 0, { rz: -0.3, outline: 1.1 });
    } else if (penguin) {
      part(new THREE.SphereGeometry(0.5, 16, 12), white, head, 0, -0.08, 0.28, { s: [1, 0.85, 0.55], cast: false });
      part(new THREE.ConeGeometry(0.12, 0.32, 8), toon(0xff9f1c), head, 0, -0.12, 0.7, { rx: Math.PI / 2, outline: 1.1 });
    } else if (!frog) {
      part(new THREE.SphereGeometry(0.27, 14, 10), light, head, 0, -0.17, 0.46, { s: [1.25, 0.85, 0.75], cast: false });
      part(new THREE.SphereGeometry(0.085, 8, 6), dark, head, 0, -0.08, 0.66, { cast: false });
      part(new THREE.TorusGeometry(0.07, 0.018, 4, 10, Math.PI), dark, head, 0, -0.25, 0.64, { rz: Math.PI, cast: false });
    }
    // 눈 (개구리는 머리 위로 툭 튀어나온 눈)
    for (const s of [-1, 1]) {
      if (frog) {
        part(new THREE.SphereGeometry(0.22, 12, 10), fur, head, s * 0.27, 0.46, 0.22, { outline: 1.06 });
        part(new THREE.SphereGeometry(0.15, 12, 10), white, head, s * 0.27, 0.52, 0.35, { cast: false });
        part(new THREE.SphereGeometry(0.08, 8, 6), dark, head, s * 0.27, 0.53, 0.47, { cast: false });
        part(new THREE.SphereGeometry(0.03, 6, 4), white, head, s * 0.24, 0.57, 0.53, { cast: false });
      } else {
        part(new THREE.SphereGeometry(0.14, 12, 10), white, head, s * 0.24, 0.12, 0.5, { s: [1, 1.25, 0.5], cast: false });
        part(new THREE.SphereGeometry(0.075, 8, 6), dark, head, s * 0.24, 0.1, 0.57, { cast: false });
        part(new THREE.SphereGeometry(0.028, 6, 4), white, head, s * 0.21, 0.15, 0.62, { cast: false });
      }
      part(new THREE.SphereGeometry(0.1, 8, 6), pink, head, s * 0.4, -0.12, 0.4, { s: [1, 0.6, 0.4], cast: false });
    }
    if (frog) part(new THREE.TorusGeometry(0.25, 0.025, 4, 16, Math.PI), dark, head, 0, -0.12, 0.55, { rz: Math.PI, cast: false });
    // 귀
    for (const s of [-1, 1]) {
      if (species === 'bear') {
        part(new THREE.SphereGeometry(0.2, 12, 10), fur, head, s * 0.42, 0.45, -0.05, { outline: 1.08 });
        part(new THREE.SphereGeometry(0.11, 10, 8), pink, head, s * 0.42, 0.45, 0.08, { s: [1, 1, 0.4], cast: false });
      } else if (species === 'cat') {
        part(new THREE.ConeGeometry(0.2, 0.42, 8), fur, head, s * 0.36, 0.55, 0, { rz: -s * 0.35, outline: 1.08 });
        part(new THREE.ConeGeometry(0.1, 0.24, 8), pink, head, s * 0.35, 0.52, 0.09, { rz: -s * 0.35, cast: false });
      } else if (species === 'fox') { // 크고 뾰족한 귀, 끝은 짙은 색
        part(new THREE.ConeGeometry(0.24, 0.55, 8), fur, head, s * 0.36, 0.58, 0, { rz: -s * 0.32, outline: 1.08 });
        part(new THREE.ConeGeometry(0.12, 0.3, 8), toon(0xfff1e0), head, s * 0.35, 0.53, 0.1, { rz: -s * 0.32, cast: false });
        part(new THREE.ConeGeometry(0.1, 0.16, 8), dark, head, s * 0.46, 0.83, 0, { rz: -s * 0.32, cast: false });
      } else if (species === 'panda') { // 검은 둥근 귀 + 눈 주위 검은 무늬
        part(new THREE.SphereGeometry(0.21, 12, 10), dark, head, s * 0.42, 0.45, -0.05, { outline: 1.08 });
        part(new THREE.SphereGeometry(0.17, 12, 10), dark, head, s * 0.24, 0.1, 0.47, { s: [1, 1.3, 0.5], rz: s * 0.5, cast: false });
      } else if (species === 'rabbit') {
        part(new THREE.CapsuleGeometry(0.11, 0.55, 4, 8), fur, head, s * 0.2, 0.95, -0.05, { rz: -s * 0.15, outline: 1.08 });
        part(new THREE.CapsuleGeometry(0.06, 0.42, 4, 8), pink, head, s * 0.2, 0.93, 0.04, { rz: -s * 0.15, cast: false });
      }
    }
    // 레이서 고글 (이마 위)
    if (!frog) {
      part(new THREE.TorusGeometry(0.6, 0.045, 6, 28), dark, head, 0, 0.3, 0, { rx: Math.PI / 2 + 0.3, cast: false });
      for (const s of [-1, 1]) {
        part(new THREE.TorusGeometry(0.13, 0.045, 6, 14), toon(0xaab4c3), head, s * 0.2, 0.47, 0.42, { rx: -0.55, cast: false });
        part(new THREE.CircleGeometry(0.12, 14), basic(0x9fe3ff), head, s * 0.2, 0.47, 0.43, { rx: -0.55, cast: false });
      }
    }
    return { group: g, head };
  }

  // ---------- 카트 ----------
  function wheel(r, w, rim) {
    const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
    const tg = new THREE.CylinderGeometry(r, r, w, 20); tg.rotateZ(Math.PI / 2);
    part(tg, toon(0x2a2a35), spin, 0, 0, 0, { outline: 1.05 });
    const rg = new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.04, 12); rg.rotateZ(Math.PI / 2);
    part(rg, rim, spin, 0, 0, 0, { cast: false });
    const hg = new THREE.BoxGeometry(w + 0.08, r * 0.95, 0.12);
    part(hg, toon(0xaab4c3), spin, 0, 0, 0, { cast: false }); // 바퀴 살: 회전이 눈에 보이도록
    return { g, spin };
  }

  function makeKart(species) {
    const sp = SPECIES[species], color = sp.kart;
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const paint = toon(color), white = toon(0xffffff), dark = toon(0x2a2a35), metal = toon(0xaab4c3);

    // 차체: 옆모습 윤곽을 둥글게 돌출
    const s = new THREE.Shape();
    s.moveTo(-1.75, 0.3); s.lineTo(1.55, 0.3); s.quadraticCurveTo(2.15, 0.32, 1.95, 0.62);
    s.lineTo(0.9, 0.85); s.lineTo(0.5, 0.85); s.lineTo(0.3, 0.6); s.lineTo(-0.75, 0.6);
    s.lineTo(-0.95, 1.15); s.lineTo(-1.4, 1.15); s.lineTo(-1.75, 0.75); s.lineTo(-1.75, 0.3);
    const cg = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 3, curveSegments: 10 });
    cg.translate(0, 0, -0.8); cg.rotateY(-Math.PI / 2);
    cg.computeBoundingBox();
    const c = cg.boundingBox.getCenter(new V3()); cg.translate(-c.x, -c.y, -c.z);
    part(cg, paint, body, c.x, c.y, c.z, { outline: 1.035 });

    // 옆 범퍼, 앞 범퍼, 좌석
    for (const x of [-1, 1]) part(new THREE.CapsuleGeometry(0.3, 1.5, 4, 10), white, body, x * 1.02, 0.5, -0.1, { rx: Math.PI / 2, outline: 1.06 });
    part(new THREE.CapsuleGeometry(0.2, 1.6, 4, 8), dark, body, 0, 0.38, 2.15, { rz: Math.PI / 2, outline: 1.06 });
    part(new THREE.BoxGeometry(1.15, 0.22, 0.7), toon(0x3a3a48), body, 0, 0.8, -0.5, { cast: false });
    part(new THREE.BoxGeometry(1.15, 0.6, 0.2), toon(0x3a3a48), body, 0, 1.08, -0.92, { rx: -0.2 });

    // 엔진, 배기구, 부스터 불꽃
    part(new THREE.BoxGeometry(1.0, 0.5, 0.55), metal, body, 0, 0.85, -1.85, { outline: 1.05 });
    part(new THREE.BoxGeometry(0.8, 0.2, 0.4), dark, body, 0, 1.15, -1.85);
    const flames = [];
    for (const x of [-1, 1]) {
      part(new THREE.CylinderGeometry(0.13, 0.17, 0.55, 10), metal, body, x * 0.32, 0.8, -2.2, { rx: Math.PI / 2, outline: 1.08 });
      const fg = new THREE.ConeGeometry(0.2, 1.1, 8); fg.rotateX(-Math.PI / 2); fg.translate(0, 0, -0.55);
      const f = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0x3fd4ff, transparent: true, opacity: 0.9 }));
      f.position.set(x * 0.32, 0.8, -2.45); f.visible = false; body.add(f); flames.push(f);
    }

    // 스포일러
    // 낮고 뒤쪽에 둬서 뒤 카메라에서 운전자가 가려지지 않게 함
    part(new THREE.BoxGeometry(1.9, 0.1, 0.45), paint, body, 0, 1.45, -2.05, { outline: 1.04 });
    for (const x of [-1, 1]) {
      part(new THREE.BoxGeometry(0.1, 0.25, 0.1), dark, body, x * 0.45, 1.3, -2.0);
      part(new THREE.BoxGeometry(0.08, 0.34, 0.55), white, body, x * 0.95, 1.42, -2.05, { outline: 1.08 });
    }
    // 전조등
    for (const x of [-1, 1]) part(new THREE.SphereGeometry(0.13, 10, 8), basic(0xfff3a0), body, x * 0.55, 0.62, 2.08, { cast: false });

    // 핸들
    const sw = new THREE.Group(); sw.position.set(0, 1.08, 0.38); sw.rotation.x = -0.55; body.add(sw);
    const steer = part(new THREE.TorusGeometry(0.26, 0.05, 6, 16), dark, sw, 0, 0, 0, { cast: false });
    part(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), dark, sw, 0, 0, 0.25, { rx: Math.PI / 2, cast: false });

    // 운전자
    const driver = makeDriver(species, color);
    driver.group.position.set(0, 0.8, -0.55); driver.group.scale.setScalar(1.12); body.add(driver.group);

    // 바퀴 (차체가 기울어도 바퀴는 땅에 붙도록 root 에 붙임)
    const rim = toon(0xffd84d);
    const wheels = { front: [], all: [] };
    for (const x of [-1, 1]) {
      const fw = wheel(0.5, 0.55, rim); fw.g.position.set(x * 1.15, 0.5, 1.3); root.add(fw.g);
      const rw = wheel(0.6, 0.72, rim); rw.g.position.set(x * 1.24, 0.6, -1.2); root.add(rw.g);
      wheels.front.push(fw.g); wheels.all.push(fw.spin, rw.spin);
    }
    return { root, body, steer, flames, wheels, head: driver.head };
  }

  function makeBanana() {
    const g = new THREE.Group();
    const geo = new THREE.TorusGeometry(0.7, 0.28, 8, 16, Math.PI * 0.9);
    part(geo, toon(0xffe135), g, 0, 0.75, 0, { rz: Math.PI * 0.55, outline: 1.06 });
    part(new THREE.SphereGeometry(0.12, 6, 4), toon(0x6b4a2b), g, 0.55, 1.25, 0, { cast: false });
    return g;
  }

  // ---------- 아이템 ----------
  function waterBalloon(color) { // 물풍선 (던지는 것)
    const g = new THREE.Group();
    part(new THREE.SphereGeometry(0.9, 14, 10), toon(color), g, 0, 0, 0, { s: [1, 1.15, 1], outline: 1.06 });
    part(new THREE.ConeGeometry(0.22, 0.35, 8), toon(color), g, 0, 1.05, 0, { rx: Math.PI, cast: false });
    part(new THREE.SphereGeometry(0.22, 8, 6), toon(0xffffff), g, -0.32, 0.35, 0.55, { cast: false });
    return g;
  }
  function honeyPuddle() { // 꿀 웅덩이 (바닥에 넓게)
    const g = new THREE.Group();
    const m = new THREE.MeshToonMaterial({ color: 0xf2a91a, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const d = new THREE.Mesh(new THREE.CircleGeometry(4.5, 24), m); d.rotation.x = -Math.PI / 2; d.position.y = 0.14; g.add(d);
    for (let k = 0; k < 5; k++) { const a = k * 1.3; part(new THREE.SphereGeometry(0.5 + (k % 2) * 0.3, 8, 6), toon(0xffc93c), g, Math.cos(a) * 2.6, 0.15, Math.sin(a) * 2.6, { s: [1, 0.35, 1], cast: false }); }
    return g;
  }
  function iceWall() { // 얼음 벽 (도로를 가로로 막는 작은 벽)
    const g = new THREE.Group();
    const m = new THREE.MeshToonMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.85 });
    for (let k = -1; k <= 1; k++) part(new THREE.BoxGeometry(1.9, 2.4 + (k === 0 ? 0.5 : 0), 1.3), m, g, k * 1.85, 1.2, 0, { outline: 1.04 });
    return g;
  }
  function bees() { // 벌 다섯 마리 무리
    const g = new THREE.Group(), y = toon(0xffd84d), k = toon(0x1b1b2f), wing = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    for (let n = 0; n < 5; n++) {
      const b = new THREE.Group(), a = (n / 5) * Math.PI * 2; b.position.set(Math.cos(a) * 1.1, (n % 2) * 0.5, Math.sin(a) * 1.1); g.add(b);
      part(new THREE.SphereGeometry(0.35, 10, 8), y, b, 0, 0, 0, { s: [1, 0.9, 1.4], outline: 1.1 });
      part(new THREE.TorusGeometry(0.3, 0.07, 4, 10), k, b, 0, 0, 0.1, { cast: false });
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10), wing); w.position.set(s * 0.3, 0.3, 0); w.rotation.set(-1.2, 0, s * 0.6); b.add(w); }
    }
    return g;
  }
  function tornado() { // 위로 넓어지며 도는 바람 기둥
    const g = new THREE.Group();
    [[1.2, 3.2, 0], [2.0, 2.8, 2.6], [2.8, 2.4, 4.8]].forEach(([r, h, y], n) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.55, h, 14, 1, true), new THREE.MeshBasicMaterial({ color: [0xdfe9f5, 0xc9d8ea, 0xb4c7de][n], transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      m.position.y = y + h / 2; g.add(m);
    });
    return g;
  }
  function boomerang() { // 나무 V 모양
    const g = new THREE.Group(), wood = toon(0xc98b4b, { flatShading: true });
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(2.2, 0.25, 0.6), wood, g, s * 0.75, 0, 0.45, { ry: s * 0.6, outline: 1.08 });
    return g;
  }
  function shieldBubble() { // 방패: 카트를 감싸는 투명한 공
    return new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.28, depthWrite: false }));
  }

  // ---------- 배경 장식 ----------
  const GREENS = [0x3fa34d, 0x4cb85c, 0x2f8f43, 0x5cc46a];
  const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
  function tree() {
    const g = new THREE.Group();
    part(new THREE.CylinderGeometry(0.5, 0.8, 5, 7), toon(0x8b5a2b), g, 0, 2.5, 0);
    const leaf = toon(pickOf(GREENS), { flatShading: true });
    part(new THREE.IcosahedronGeometry(2.8, 1), leaf, g, 0, 6.2, 0);
    part(new THREE.IcosahedronGeometry(2.0, 1), leaf, g, 1.5, 5.0, 0.6);
    part(new THREE.IcosahedronGeometry(2.1, 1), leaf, g, -1.3, 5.4, -0.7);
    return g;
  }
  function pine() {
    const g = new THREE.Group();
    part(new THREE.CylinderGeometry(0.4, 0.6, 3, 6), toon(0x7a4b25), g, 0, 1.5, 0);
    const leaf = toon(0x2c7a3f, { flatShading: true });
    [[3.2, 4, 4], [2.5, 3.4, 6.2], [1.7, 2.8, 8.2]].forEach(([r, h, y]) => part(new THREE.ConeGeometry(r, h, 7), leaf, g, 0, y, 0));
    return g;
  }
  function bush() {
    const g = new THREE.Group(), m = toon(pickOf(GREENS), { flatShading: true });
    part(new THREE.IcosahedronGeometry(1.4, 1), m, g, 0, 0.9, 0);
    part(new THREE.IcosahedronGeometry(1.0, 1), m, g, 1.2, 0.7, 0.3);
    part(new THREE.IcosahedronGeometry(1.0, 1), m, g, -1.1, 0.6, -0.2);
    return g;
  }
  function rock(color) {
    const g = new THREE.Group();
    part(new THREE.DodecahedronGeometry(2.2, 0), toon(color || 0x9a9aa6, { flatShading: true }), g, 0, 1.2, 0, { s: [1.2, 0.8, 1] });
    return g;
  }
  function cactus() {
    const g = new THREE.Group(), m = toon(0x3e9b4f);
    part(new THREE.CapsuleGeometry(0.65, 4, 4, 10), m, g, 0, 2.7, 0, { outline: 1.05 });
    for (const s of [-1, 1]) {
      const y = 2.2 + Math.random() * 1.2;
      part(new THREE.CapsuleGeometry(0.4, 0.8, 4, 8), m, g, s * 0.9, y, 0, { rz: Math.PI / 2 });
      part(new THREE.CapsuleGeometry(0.4, 1.2, 4, 8), m, g, s * 1.4, y + 0.8, 0);
    }
    part(new THREE.SphereGeometry(0.3, 8, 6), toon(0xff6fa8), g, 0, 5.1, 0);
    return g;
  }
  function mesa(h) {
    const g = new THREE.Group(), r = 10 + Math.random() * 14;
    part(new THREE.CylinderGeometry(r * 0.8, r, h, 7), toon(0xd9824a, { flatShading: true }), g, 0, h / 2, 0);
    part(new THREE.CylinderGeometry(r * 0.86, r * 0.92, h * 0.12, 7), toon(0xb8623a, { flatShading: true }), g, 0, h * 0.42, 0);
    return g;
  }
  function cloud() {
    const g = new THREE.Group(), m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD, fog: false, emissive: 0x666666 });
    [[0, 0, 0, 9], [9, -1, 2, 7], [-9, -2, 1, 6.5], [4, 4, -1, 6], [-4, 3, 2, 5.5]].forEach(([x, y, z, r]) =>
      part(new THREE.IcosahedronGeometry(r, 1), m, g, x, y, z, { cast: false }));
    return g;
  }
  function mountain(h, color, snow) {
    const g = new THREE.Group(), r = h * (0.9 + Math.random() * 0.5);
    part(new THREE.ConeGeometry(r, h, 7), toon(color, { flatShading: true }), g, 0, h / 2, 0, { cast: false });
    if (snow) part(new THREE.ConeGeometry(r * 0.3, h * 0.3, 7), toon(0xffffff, { flatShading: true }), g, 0, h * 0.85 + 0.5, 0, { cast: false });
    return g;
  }
  function grandstand(len) {
    const g = new THREE.Group();
    const steps = 4;
    for (let k = 0; k < steps; k++) part(new THREE.BoxGeometry(len, 1.2, 2.2), toon(k % 2 ? 0xdedede : 0xc8c8d2), g, 0, 0.6 + k * 1.2, -k * 2.2);
    // 관중: 머리 + 몸 (인스턴스로 그리기 횟수 절약)
    const count = Math.floor(len / 1.3) * steps;
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), toon(0xffffff), count);
    const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.42, 0.5, 3, 8), toon(0xffffff), count);
    const d = new THREE.Object3D(), col = new THREE.Color();
    const SKIN = [0xf1c27d, 0xe0ac69, 0xffdbac, 0x9b6a3f, 0xf4f4f8, 0xf2a03a];
    const SHIRT = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0x8e24aa, 0xff7043, 0x26c6da];
    let n = 0;
    for (let k = 0; k < steps; k++) for (let x = -len / 2 + 0.8; x < len / 2 - 0.5 && n < count; x += 1.3, n++) {
      const jx = x + (Math.random() - 0.5) * 0.3;
      d.position.set(jx, 1.2 + k * 1.2 + 0.55, -k * 2.2); d.updateMatrix(); bodies.setMatrixAt(n, d.matrix); bodies.setColorAt(n, col.setHex(pickOf(SHIRT)));
      d.position.y += 0.85; d.updateMatrix(); heads.setMatrixAt(n, d.matrix); heads.setColorAt(n, col.setHex(pickOf(SKIN)));
    }
    heads.count = bodies.count = n;
    g.add(heads, bodies);
    // 지붕
    part(new THREE.BoxGeometry(len + 1, 0.4, 10), toon(0xe53935), g, 0, 8.2, -3.5);
    for (const x of [-len / 2, len / 2]) part(new THREE.CylinderGeometry(0.25, 0.25, 8, 6), toon(0xffffff), g, x, 4, -7.5);
    return g;
  }

  function sheep() {
    const g = new THREE.Group(), wool = toon(0xffffff, { flatShading: true }), face = toon(0x2b2b36);
    [[0, 1.6, 0, 1.1], [0.6, 1.7, 0.5, 0.8], [-0.6, 1.7, 0.5, 0.8], [0.6, 1.6, -0.6, 0.8], [-0.6, 1.6, -0.6, 0.8], [0, 2.2, 0, 0.8]]
      .forEach(([x, y, z, r]) => part(new THREE.IcosahedronGeometry(r, 1), wool, g, x, y, z));
    const head = part(new THREE.SphereGeometry(0.55, 12, 10), face, g, 0, 2.0, 1.25, { s: [1, 1, 1.2], outline: 1.06 });
    for (const s of [-1, 1]) {
      part(new THREE.SphereGeometry(0.13, 8, 6), toon(0xffffff), head, s * 0.22, 0.12, 0.42, { cast: false });
      part(new THREE.SphereGeometry(0.2, 8, 6), face, head, s * 0.55, 0.1, 0, { s: [1.4, 0.6, 0.8], cast: false });
    }
    const legs = [];
    for (const [x, z] of [[0.5, 0.6], [-0.5, 0.6], [0.5, -0.6], [-0.5, -0.6]]) {
      const l = new THREE.Group(); l.position.set(x, 1.0, z); g.add(l);
      part(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 6), face, l, 0, -0.5, 0);
      legs.push(l);
    }
    g.userData.legs = legs;
    g.scale.setScalar(1.3);
    return g;
  }
  function boulder(color = 0x8d6e63) {
    const g = new THREE.Group();
    part(new THREE.DodecahedronGeometry(2.3, 1), toon(color, { flatShading: true }), g, 0, 0, 0, { outline: 1.04 });
    return g;
  }
  // ---------- 눈 산길 ----------
  function snowPine() { // 가지마다 눈이 쌓인 전나무
    const g = new THREE.Group();
    part(new THREE.CylinderGeometry(0.4, 0.6, 3, 6), toon(0x6b4423), g, 0, 1.5, 0);
    const leaf = toon(0x1f5f3a, { flatShading: true }), snow = toon(0xf4f8ff, { flatShading: true });
    [[3.2, 4, 4], [2.5, 3.4, 6.2], [1.7, 2.8, 8.2]].forEach(([r, h, y]) => {
      part(new THREE.ConeGeometry(r, h, 7), leaf, g, 0, y, 0);
      part(new THREE.ConeGeometry(r * 0.62, h * 0.42, 7), snow, g, 0, y + h * 0.3, 0, { cast: false });
    });
    return g;
  }
  function snowman() {
    const g = new THREE.Group(), white = toon(0xffffff), coal = toon(0x222233);
    part(new THREE.SphereGeometry(1.6, 14, 12), white, g, 0, 1.4, 0, { outline: 1.04 });
    part(new THREE.SphereGeometry(1.15, 14, 12), white, g, 0, 3.4, 0, { outline: 1.05 });
    part(new THREE.SphereGeometry(0.8, 14, 12), white, g, 0, 4.85, 0, { outline: 1.06 });
    part(new THREE.ConeGeometry(0.14, 0.7, 8), toon(0xff7f27), g, 0, 4.85, 0.95, { rx: Math.PI / 2, cast: false });
    for (const x of [-0.28, 0.28]) part(new THREE.SphereGeometry(0.09, 6, 4), coal, g, x, 5.05, 0.68, { cast: false });
    part(new THREE.TorusGeometry(0.75, 0.18, 6, 16), toon(0xe53935), g, 0, 4.2, 0, { rx: Math.PI / 2 });
    part(new THREE.CylinderGeometry(0.55, 0.55, 0.7, 12), coal, g, 0, 5.75, 0);
    return g;
  }
  // ---------- 해안 도로 ----------
  function lighthouse() { // 빨강·흰 줄무늬 등대
    const g = new THREE.Group();
    part(new THREE.CylinderGeometry(7, 8, 3, 12), toon(0x9a9aa6, { flatShading: true }), g, 0, 1.5, 0);
    for (let k = 0; k < 6; k++) part(new THREE.CylinderGeometry(3.6 - k * 0.3, 3.9 - k * 0.3, 5, 14), toon(k % 2 ? 0xffffff : 0xe53935), g, 0, 5.5 + k * 5, 0, { outline: 1.02 });
    part(new THREE.CylinderGeometry(2.4, 2.4, 3, 12), new THREE.MeshBasicMaterial({ color: 0xfff3a0 }), g, 0, 35.5, 0, { cast: false });
    part(new THREE.ConeGeometry(3.2, 3.2, 12), toon(0x1d2b53), g, 0, 38.6, 0, { outline: 1.03 });
    return g;
  }
  function palm() {
    const g = new THREE.Group(), bark = toon(0x9c6b3c, { flatShading: true }), leaf = toon(0x2fa84f, { flatShading: true, side: THREE.DoubleSide });
    let x = 0;
    for (let k = 0; k < 6; k++) { x += 0.25 * k * 0.3; part(new THREE.CylinderGeometry(0.42 - k * 0.03, 0.5 - k * 0.03, 1.8, 7), bark, g, x, 0.9 + k * 1.7, 0, { rz: -0.08 * k }); }
    const top = new THREE.Vector3(x + 0.5, 10.6, 0);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, lf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5.5, 4), leaf);
      lf.scale.set(1, 1, 0.18); lf.position.copy(top).add(new THREE.Vector3(Math.cos(a) * 2.4, -0.6, Math.sin(a) * 2.4));
      lf.rotation.set(0, -a, Math.PI / 2 - 0.35); lf.rotateZ(0); g.add(lf);
    }
    for (let k = 0; k < 3; k++) part(new THREE.SphereGeometry(0.35, 8, 6), toon(0x6b4423), g, top.x + Math.cos(k * 2.1) * 0.5, top.y - 0.5, Math.sin(k * 2.1) * 0.5, { cast: false });
    return g;
  }
  function parasol(color) { // 파라솔 + 돗자리
    const g = new THREE.Group();
    part(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 6), toon(0xffffff), g, 0, 2.1, 0);
    part(new THREE.ConeGeometry(2.6, 1.2, 10), toon(color, { flatShading: true }), g, 0, 4.4, 0, { outline: 1.03 });
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.6), toon(0xffffff - color + 0x202020)); towel.rotation.x = -Math.PI / 2; towel.position.set(1.8, 0.05, 0); g.add(towel);
    return g;
  }
  function crab() { // 옆으로 걷는 게 (다리는 userData.legs)
    const g = new THREE.Group(), shell = toon(0xff5a36, { flatShading: true }), dark = toon(0x1b1b2f);
    part(new THREE.SphereGeometry(1.4, 12, 8), shell, g, 0, 1.4, 0, { s: [1.3, 0.6, 1], outline: 1.05 });
    for (const s of [-1, 1]) {
      part(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 5), shell, g, s * 0.45, 2.1, 0.7, { cast: false });
      part(new THREE.SphereGeometry(0.2, 8, 6), toon(0xffffff), g, s * 0.45, 2.55, 0.7, { cast: false });
      part(new THREE.SphereGeometry(0.1, 6, 4), dark, g, s * 0.45, 2.58, 0.86, { cast: false });
      part(new THREE.SphereGeometry(0.55, 10, 8), shell, g, s * 1.9, 1.6, 1.0, { s: [1, 0.7, 1.2], outline: 1.06 }); // 집게
    }
    const legs = [];
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const l = new THREE.Group(); l.position.set(s * 1.4, 1.2, -0.6 + k * 0.6); g.add(l);
      part(new THREE.CylinderGeometry(0.1, 0.08, 1.3, 5), shell, l, s * 0.4, -0.5, 0, { rz: s * 0.6, cast: false });
      legs.push(l);
    }
    g.userData.legs = legs;
    g.scale.setScalar(1.2);
    return g;
  }
  function gull() { // 갈매기
    const g = new THREE.Group(), white = toon(0xffffff), grey = toon(0xb9c3cf, { side: THREE.DoubleSide });
    part(new THREE.CapsuleGeometry(0.35, 1.2, 4, 8), white, g, 0, 0, 0, { rx: Math.PI / 2 });
    part(new THREE.ConeGeometry(0.12, 0.4, 6), toon(0xffb300), g, 0, 0.05, 1.05, { rx: Math.PI / 2, cast: false });
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), grey); w.position.set(s * 1.2, 0.1, 0); w.rotation.set(-Math.PI / 2, 0, s * 0.25); g.add(w); }
    return g;
  }

  function windmill() {
    const g = new THREE.Group();
    part(new THREE.CylinderGeometry(3, 5, 22, 8), toon(0xfff3e0), g, 0, 11, 0, { outline: 1.02 });
    part(new THREE.ConeGeometry(4.4, 6, 8), toon(0xe53935), g, 0, 25, 0, { outline: 1.03 });
    const rotor = new THREE.Group(); rotor.position.set(0, 20, 3.8); g.add(rotor);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; rotor.add(arm);
      part(new THREE.BoxGeometry(2.6, 11, 0.3), toon(0xffffff), arm, 1.0, 6.5, 0, { outline: 1.03 });
    }
    part(new THREE.SphereGeometry(1, 10, 8), toon(0x6d4c41), rotor, 0, 0, 0.2);
    g.userData.rotor = rotor;
    return g;
  }
  function balloon(color) {
    const g = new THREE.Group();
    part(new THREE.SphereGeometry(7, 16, 12), toon(color), g, 0, 10, 0, { s: [1, 1.15, 1], outline: 1.02, cast: false });
    part(new THREE.CylinderGeometry(5.5, 2, 4, 12), toon(0xffffff), g, 0, 3.5, 0, { cast: false });
    part(new THREE.BoxGeometry(2.4, 1.8, 2.4), toon(0x8b5a2b), g, 0, -1.5, 0, { outline: 1.05, cast: false });
    return g;
  }
  // 점프대: 앞이 낮고 뒤가 높은 쐐기 (길이 len, 높이 h, 폭 w), 원점이 낮은 쪽 가운데
  function ramp(w, h, len, color) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, h); s.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2); geo.rotateY(-Math.PI / 2);
    const m = new THREE.Mesh(geo, toon(color || 0xff7043)); m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // 트랙 옆 광고판 (게임 안 가상의 대회 문구)
  function billboard(text, bg, fg) {
    const g = new THREE.Group();
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#1d2b53'; x.fillRect(0, 0, 512, 160);
    x.fillStyle = bg; x.fillRect(10, 10, 492, 140);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 70; x.font = `${size}px 'Jua', sans-serif`;
    while (x.measureText(text).width > 460 && size > 20) { size -= 4; x.font = `${size}px 'Jua', sans-serif`; }
    x.fillText(text, 256, 84);
    const tex = new THREE.CanvasTexture(c);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.y = 7.5; g.add(board);
    part(new THREE.BoxGeometry(16.6, 5.6, 0.5), toon(0x1d2b53), g, 0, 7.5, -0.3);
    for (const s of [-1, 1]) part(new THREE.CylinderGeometry(0.3, 0.3, 5, 6), toon(0x9e9e9e), g, s * 6, 2.5, -0.3);
    return g;
  }

  // 같은 모양을 여러 번 그릴 때 한 번에 그리기 (그리기 호출 수 절약)
  const tmpM = new THREE.Matrix4();
  function instanceScatter(scene, template, matrices) {
    template.updateMatrixWorld(true);
    template.traverse((o) => {
      if (!o.isMesh || o.material === OUTLINE) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, matrices.length);
      matrices.forEach((m, k) => im.setMatrixAt(k, tmpM.multiplyMatrices(m, o.matrixWorld)));
      im.castShadow = o.castShadow; im.receiveShadow = true; im.frustumCulled = false;
      scene.add(im);
    });
  }

  root.Models = { SPECIES, toon, part, makeKart, makeBanana, waterBalloon, honeyPuddle, iceWall, shieldBubble, bees, tornado, boomerang, snowPine, snowman, lighthouse, palm, parasol, crab, gull, tree, pine, bush, rock, cactus, mesa, cloud, mountain, grandstand, OUTLINE,
    sheep, boulder, windmill, balloon, ramp, instanceScatter, billboard };
})(this);
