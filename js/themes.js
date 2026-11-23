// 테마별 지형 높이·색, 장식, 광고판 문구, 빛 번짐 세기 (초원, 사막, 눈 산길, 해안 도로)
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

// decorate(ctx) 의 ctx: { def, T, scene, TR, spots, scatter, rand, dens, few, forest, spinners, flyers }
const THEMES = {
  meadow: {
    bloom: 0.22,
    signs: ['🏁 공부 카트 그랑프리', '정답 = 부스터 🚀', '구구단 챔피언 도전!', 'ABC 레이싱 리그', '천천히, 정확하게!', '오늘도 최고야 ⭐'],
    height: (x, z, far) => lerp(Math.max(0, (fbm(x / 240, z / 240, 7) - 0.38) * 46), Math.pow(fbm(x / 380, z / 380, 11, 5), 1.5) * 340, far),
    color(c, h, n) {
      const G = [0x5cbf4a, 0x4aa63c, 0x72cf5a];
      if (h < 40) c.setHex(G[n < 0.4 ? 1 : n > 0.62 ? 2 : 0]).lerp(new THREE.Color(0x3f8f3f), clamp(h / 40, 0, 1) * 0.5);
      else if (h < 150) c.setHex(0x3f8f3f).lerp(new THREE.Color(0x7d8a74), clamp((h - 90) / 60, 0, 1));
      else if (h < 220) c.setHex(0x8d8f86);
      else c.setHex(0xf4f7fb); // 눈
    },
    decorate({ T, scene, spots, scatter, rand, dens, forest, spinners }) {
      scatter(spots(Math.round(420 * dens), EDGE + 12, 420, forest), M.tree);
      scatter(spots(Math.round(200 * dens), EDGE + 12, 420, forest, 120), M.pine, 2);
      scatter(spots(160, EDGE + 7, 250), M.bush);
      scatter(spots(40, EDGE + 10, 300), () => M.rock(0x9a9aa6), 2, 0.6, 1.6);
      for (const [x, y, z] of spots(4, EDGE + 45, 220, null, 25)) {
        const w = M.windmill(); w.position.set(x, y, z); w.rotation.y = Math.random() * 6; scene.add(w); spinners.push(w.userData.rotor);
      }
      // 반짝이는 호수 (평평한 곳에만)
      for (const [x, , z] of spots(4, EDGE + 40, 200, null, 0.5)) {
        const r = rand(22, 38), pg = new THREE.CircleGeometry(r, 36); pg.rotateX(-Math.PI / 2);
        const pond = new THREE.Mesh(pg, new THREE.MeshPhongMaterial({ color: 0x3fa9f5, shininess: 90, specular: 0xffffff, transparent: true, opacity: 0.92 }));
        pond.position.set(x, 0.05, z); pond.scale.set(1, 1, rand(0.6, 1)); scene.add(pond);
        const rg = new THREE.RingGeometry(r, r + 3, 36); rg.rotateX(-Math.PI / 2);
        const rim = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: 0xe8d9a0 })); rim.position.set(x, 0.06, z); rim.scale.copy(pond.scale); scene.add(rim);
      }
      // 꽃과 풀숲 (각각 한 번에 그림)
      const tuft = (count, geo, colors, margin, spread, yOff) => {
        const pts = spots(count, margin, spread, null, 30);
        const im = new THREE.InstancedMesh(geo, M.toon(0xffffff, { flatShading: true }), pts.length);
        const dm = new THREE.Object3D(), cc = new THREE.Color();
        pts.forEach(([x, y, z], n) => { dm.position.set(x, y + yOff, z); dm.rotation.set(0, Math.random() * 6, 0); dm.scale.setScalar(rand(0.7, 1.4)); dm.updateMatrix(); im.setMatrixAt(n, dm.matrix); im.setColorAt(n, cc.setHex(colors[n % colors.length])); });
        im.frustumCulled = false; scene.add(im);
      };
      const few = settings.quality === 'high' ? 1 : 0.35;
      tuft(Math.round(1400 * few), new THREE.SphereGeometry(0.42, 6, 4), [0xff6fa8, 0xffd84d, 0xffffff, 0xb57bff, 0xff7043], EDGE + 4, 140, 0.3);
      tuft(Math.round(2600 * few), new THREE.ConeGeometry(0.5, 1.8, 4), [0x3f9a3a, 0x56b847, 0x2f7f35], EDGE + 4, 180, 0.8);
    },
  },
  desert: {
    bloom: 0.1, // 밝은 모래 지평선이 하얗게 번지지 않게
    fill: false, // 메사는 깎아지른 절벽이 특징: 길 옆 땅을 채우지 않음
    signs: ['🏜️ 사막 수학 랠리', '정답 = 부스터 🚀', '구구단 챔피언 도전!', 'ABC 레이싱 리그', '천천히, 정확하게!', '오늘도 최고야 ⭐'],
    height(x, z, far) {
      const hills = Math.max(0, (fbm(x / 160, z / 160, 3) - 0.4) * 34);
      let mount = Math.pow(fbm(x / 380, z / 380, 11, 5), 1.5) * 260;
      mount = Math.floor(mount / 38) * 38 + sstep(0.7, 1, (mount % 38) / 38) * 38; // 계단 모양 메사
      return lerp(hills, mount, far);
    },
    color(c, h, n) {
      const G = [0xe9c98c, 0xdcb574, 0xf2d7a2];
      if (h < 6) c.setHex(G[n < 0.4 ? 1 : n > 0.62 ? 2 : 0]);
      else c.setHex(Math.floor(h / 13) % 2 ? 0xd9824a : 0xc0683a).lerp(new THREE.Color(0xf0b070), clamp((h - 150) / 120, 0, 1)); // 층층이 띠
    },
    decorate({ def, T, scene, spots, scatter, rand, dens }) {
      scatter(spots(Math.round(200 * dens), EDGE + 8, 350), M.cactus);
      scatter(spots(120, EDGE + 8, 400, null, 120), () => M.rock(0xc0783f), 2, 0.7, 2.2);
      for (const [x, y, z] of spots(14, EDGE + 60, 380, null, 30)) { const m = M.mesa(rand(30, 70)); m.position.set(x, y, z); scene.add(m); }
      const tuft = spots(900, EDGE + 4, 200, null, 20);
      const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.9, 0), M.toon(0xffffff, { flatShading: true }), tuft.length);
      const dm = new THREE.Object3D(), cc = new THREE.Color(), DRY = [0xb59a5a, 0x9c8a4a, 0xc7a96a];
      tuft.forEach(([x, y, z], n) => { dm.position.set(x, y + 0.5, z); dm.scale.set(rand(0.8, 1.6), rand(0.5, 0.9), rand(0.8, 1.6)); dm.updateMatrix(); im.setMatrixAt(n, dm.matrix); im.setColorAt(n, cc.setHex(DRY[n % 3])); });
      im.frustumCulled = false; scene.add(im);
      // 협곡 구간 양옆 바위 절벽
      if (def.tunnel) {
        const [u0, u1] = def.tunnel, i0 = uIdx(u0 - 0.03), i1 = uIdx(u1 + 0.03), mats = [];
        for (let i = i0; i !== i1; i = (i + 1) % N) {
          if (((i - i0 + N) % N) % 7) continue;
          for (const s of [-1, 1]) {
            const p = roadPoint(T, i, s * (EDGE + rand(12, 22)));
            mats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, rand(4, 10), p.z), new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * 6), new THREE.Vector3(rand(8, 13), rand(22, 40), rand(8, 13))));
          }
        }
        const tpl = new THREE.Group(); M.part(new THREE.DodecahedronGeometry(1, 0), M.toon(0xc8743f, { flatShading: true }), tpl);
        M.instanceScatter(scene, tpl, mats);
      }
    },
  },
  snow: {
    bloom: 0.06, // 눈밭이 하얗게 번지지 않게
    signs: ['❄️ 눈꽃 산악 레이스', '정답 = 부스터 🚀', '얼음은 미끄러워요 🧊', 'ABC 레이싱 리그', '천천히, 정확하게!', '오늘도 최고야 ⭐'],
    height: (x, z, far) => lerp(Math.max(0, (fbm(x / 220, z / 220, 5) - 0.36) * 56), Math.pow(fbm(x / 360, z / 360, 13, 5), 1.4) * 400, far),
    color(c, h, n) {
      if (h < 60) c.setHex(n < 0.4 ? 0xe6eef7 : n > 0.62 ? 0xffffff : 0xf2f6fb);
      else if (h < 190) c.setHex(n > 0.55 ? 0x8e9aa8 : 0xdfe7f0).lerp(new THREE.Color(0xa7b3c0), clamp((h - 60) / 130, 0, 1) * 0.5); // 눈 사이 바위
      else c.setHex(0xffffff);
    },
    decorate({ T, scene, spots, scatter, rand, dens, few, forest }) {
      scatter(spots(Math.round(480 * dens), EDGE + 12, 420, forest, 140), M.snowPine, 3);
      scatter(spots(60, EDGE + 10, 300), () => M.rock(0x8e9aa8), 2, 0.6, 1.8);
      for (const [x, y, z] of spots(8, EDGE + 14, 160, null, 10)) { const m = M.snowman(); m.position.set(x, y, z); m.rotation.y = Math.random() * 6; scene.add(m); }
      if (T.sc && T.sc.surf === 'ice') { // 얼어붙은 호수: 얼음 지름길이 가로지름
        const mid = T.sc.pos[T.sc.n >> 1], r = T.sc.len * 0.42, g = new THREE.CircleGeometry(r, 40); g.rotateX(-Math.PI / 2);
        const lake = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0xcdeeff, shininess: 120, specular: 0xffffff, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }));
        lake.position.set(mid.x, 0.02, mid.z); lake.scale.set(1, 1, 0.75); lake.rotation.y = rand(0, 3); scene.add(lake);
      }
      const pts = spots(Math.round(900 * few), EDGE + 4, 200, null, 30); // 눈 더미
      const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.9, 0), M.toon(0xffffff, { flatShading: true }), pts.length);
      const dm = new THREE.Object3D();
      pts.forEach(([x, y, z], n) => { dm.position.set(x, y + 0.3, z); dm.scale.set(rand(0.8, 1.8), rand(0.4, 0.8), rand(0.8, 1.8)); dm.updateMatrix(); im.setMatrixAt(n, dm.matrix); });
      im.frustumCulled = false; scene.add(im);
    },
  },
  coast: {
    bloom: 0.15,
    signs: ['🌊 바닷가 수학 축제', '정답 = 부스터 🚀', '모래사장은 느려요 🏖️', 'ABC 레이싱 리그', '천천히, 정확하게!', '오늘도 최고야 ⭐'],
    // 바다: 첫 긴 직선(u=0.1)에서 트랙 바깥쪽 방향
    prepare(TR) {
      const T = TR.T, i = uIdx(0.1), p = T.pos[i], r = T.right[i];
      const side = Math.sign((p.x - TR.cx) * r.x + (p.z - TR.cz) * r.z) || 1;
      TR.sea = { x: p.x, z: p.z, nx: r.x * side, nz: r.z * side };
    },
    seaDist: (TR, x, z) => (x - TR.sea.x) * TR.sea.nx + (z - TR.sea.z) * TR.sea.nz,
    height(x, z, far, TR) {
      const land = lerp(Math.max(0, (fbm(x / 200, z / 200, 9) - 0.4) * 30), Math.pow(fbm(x / 380, z / 380, 17, 5), 1.5) * 240, far);
      return lerp(land, -8, sstep(EDGE + 30, EDGE + 120, THEMES.coast.seaDist(TR, x, z)));
    },
    color(c, h, n) {
      if (h < 2.5) c.setHex(h < -0.5 ? 0xd9c08a : n < 0.4 ? 0xead09a : n > 0.62 ? 0xf7e6bd : 0xf2dca8); // 모래 (물속은 짙게)
      else if (h < 35) c.setHex(n > 0.55 ? 0x6bb85a : 0x7cc46a);
      else if (h < 120) c.setHex(0xb5835a).lerp(new THREE.Color(0x9a8f86), clamp((h - 60) / 60, 0, 1));
      else c.setHex(0x9a8f86);
    },
    decorate({ T, TR, scene, spots, scatter, rand, dens, few, flyers }) {
      const sea = TR.sea, ang = Math.atan2(sea.nx, sea.nz);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2),
        new THREE.MeshPhongMaterial({ color: 0x2a9df4, shininess: 100, specular: 0xffffff, transparent: true, opacity: 0.88 }));
      water.position.set(sea.x + sea.nx * (4500 + EDGE + 70), -0.3, sea.z + sea.nz * (4500 + EDGE + 70)); water.rotation.y = ang; scene.add(water);
      const land = (all) => all.filter(([, y]) => y > 0.3); // 물속 자리는 뺌
      scatter(land(spots(Math.round(200 * dens), EDGE + 8, 350, null, 25)), M.palm, 3, 0.8, 1.3);
      scatter(land(spots(90, EDGE + 7, 250, null, 30)), M.bush);
      scatter(spots(50, EDGE + 10, 300, null, 60), () => M.rock(0xa08c7a), 2, 0.7, 2);
      // 해변 파라솔: 첫 직선의 바다 쪽 모래사장
      const COL = [0xff6fa8, 0xffd84d, 0x4fc3ff, 0xff7043, 0x7dff8a];
      for (let k = 0; k < 14; k++) {
        const i = uIdx(rand(0.02, 0.17)), lat = EDGE + rand(10, 38), side = Math.sign(T.right[i].x * sea.nx + T.right[i].z * sea.nz) || 1;
        const p = roadPoint(T, i, side * lat); if (TR.height(p.x, p.z) < 0) continue;
        const m = M.parasol(COL[k % COL.length]); m.position.set(p.x, 0, p.z); m.rotation.y = rand(0, 6); scene.add(m);
      }
      { // 등대: 첫 직선 끝 바다 쪽 바위섬
        const i = uIdx(0.02), side = Math.sign(T.right[i].x * sea.nx + T.right[i].z * sea.nz) || 1, p = roadPoint(T, i, side * (EDGE + 95));
        const lh = M.lighthouse(); lh.position.set(p.x, -0.5, p.z); scene.add(lh);
      }
      for (let k = 0; k < 3; k++) { // 갈매기 떼: 하늘에서 천천히 돎
        const i = uIdx(0.03 + k * 0.06), p = roadPoint(T, i, 0), flock = new THREE.Group();
        flock.position.set(p.x + sea.nx * 60, 38 + k * 6, p.z + sea.nz * 60);
        for (let j = 0; j < 4; j++) { const gl = M.gull(), a = (j / 4) * Math.PI * 2; gl.position.set(Math.cos(a) * 26, (j % 2) * 3, Math.sin(a) * 26); gl.rotation.y = -a; flock.add(gl); }
        scene.add(flock); flyers.push(flock);
      }
      const pts = land(spots(Math.round(700 * few), EDGE + 4, 180, null, 20)); // 바닷가 풀
      const im = new THREE.InstancedMesh(new THREE.ConeGeometry(0.4, 1.6, 4), M.toon(0xffffff, { flatShading: true }), pts.length);
      const dm = new THREE.Object3D(), cc = new THREE.Color(), GR = [0x8fbf5a, 0x6fa84a, 0xb5c46a];
      pts.forEach(([x, y, z], n) => { dm.position.set(x, y + 0.7, z); dm.rotation.set(0, rand(0, 6), 0); dm.scale.setScalar(rand(0.7, 1.3)); dm.updateMatrix(); im.setMatrixAt(n, dm.matrix); im.setColorAt(n, cc.setHex(GR[n % 3])); });
      im.frustumCulled = false; scene.add(im);
    },
  },
};
