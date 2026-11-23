// 트랙, 지형, 장식, 볼거리
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

// ---------- 트랙 ----------
function sampleTrack(def) {
  const ctrl = TrackGen.build(def.turtle).pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const pos = [], tan = [];
  for (let i = 0; i < N; i++) { pos.push(curve.getPointAt(i / N)); tan.push(curve.getTangentAt(i / N)); }
  const right = [], head = [];
  pos.forEach((p, i) => {
    p.y = def.elev(i / N);
    right.push(new THREE.Vector3().crossVectors(tan[i], UP).setY(0).normalize());
    head.push(Math.atan2(tan[i].x, tan[i].z));
  });
  const segLen = curve.getLength() / N;
  const slope = pos.map((p, i) => (pos[(i + 1) % N].y - pos[(i + N - 1) % N].y) / (2 * segLen));
  const curv = head.map((h, i) => wrapAngle(head[(i + 16) % N] - h));
  const bridge = pos.map((p, i) => !!def.bridge && i / N > def.bridge[0] && i / N < def.bridge[1] && p.y > 1.2);
  const box = new THREE.Box3().setFromPoints(pos);
  return { pos, right, head, slope, curv, segLen, bridge, box, length: curve.getLength() };
}
const uIdx = (u) => ((Math.round(u * N) % N) + N) % N;
// 도로 위 한 점 (i 번째 샘플, 좌우 lat, 높이 dy)
const roadPoint = (T, i, lat, dy = 0) => {
  const j = ((i % N) + N) % N;
  return T.pos[j].clone().addScaledVector(T.right[j], lat).setY(T.pos[j].y + dy);
};

// 두 줄(a(i), b(i)) 사이를 잇는 띠. cond(i) 가 거짓인 구간은 비움.
function strip(scene, a, b, mat, uvLen, cond) {
  const v = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const A = a(i), B = b(i);
    v.push(A.x, A.y, A.z, B.x, B.y, B.z);
    const vv = (i * (scene.userData.segLen || 1)) / uvLen; uv.push(0, vv, 1, vv);
  }
  for (let i = 0; i < N; i++) {
    if (cond && !(cond(i) && cond((i + 1) % N))) continue;
    const k = 2 * i; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
  return m;
}

function buildTrack(def, scene) {
  const T = sampleTrack(def);
  scene.userData.segLen = T.segLen;
  const { pos, right, head } = T;
  const off = (lat, dy = 0) => (i) => roadPoint(T, i, lat, dy);
  const flat = (color, f = -1) => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f });

  const asphalt = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5b5f69'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 2600; k++) { const l = 70 + Math.random() * 40; c.fillStyle = `rgb(${l},${l + 2},${l + 8})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  strip(scene, off(-EDGE), off(-HW), flat(def.shoulder), 10);
  strip(scene, off(HW), off(EDGE), flat(def.shoulder), 10);
  strip(scene, off(-HW, 0.04), off(HW, 0.04), new THREE.MeshLambertMaterial({ map: asphalt, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 40);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  strip(scene, off(-HW + 0.8, 0.08), off(-HW + 1.4, 0.08), lineMat, 10);
  strip(scene, off(HW - 1.4, 0.08), off(HW - 0.8, 0.08), lineMat, 10);

  // 바깥 울타리(빨강/흰 줄무늬 벽)
  const wallTex = canvasTex(128, 32, (c) => { for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#e53935' : '#ffffff'; c.fillRect(k * 32, 0, 32, 32); } });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.DoubleSide });
  strip(scene, off(-EDGE, -1.2), off(-EDGE, 1.3), wallMat, 8);
  strip(scene, off(EDGE, -1.2), off(EDGE, 1.3), wallMat, 8);
  // 다리: 바닥판과 기둥 / 언덕: 흙 비탈
  const deck = flat(0xc9c3b6, 0);
  strip(scene, off(-EDGE, -1.2), off(EDGE, -1.2), deck, 10, (i) => T.bridge[i]);
  const skirtMat = M.toon(def.skirt, { side: THREE.DoubleSide, flatShading: true });
  for (const s of [-1, 1]) {
    strip(scene, off(s * EDGE, -1.2), (i) => roadPoint(T, i, s * (EDGE + pos[i % N].y * def.skirtSlope), 0).setY(-0.1), skirtMat, 10,
      (i) => !T.bridge[i] && pos[i].y > 0.3);
  }
  const pillarMats = [];
  for (let i = 0; i < N; i += 14) {
    if (!T.bridge[i]) continue;
    for (const s of [-1, 1]) {
      const p = roadPoint(T, i, s * (HW - 3));
      let clear = true;
      for (let j = 0; j < N; j += 4) {
        if (Math.abs(((j - i + N + N / 2) % N) - N / 2) < 80) continue;
        if ((pos[j].x - p.x) ** 2 + (pos[j].z - p.z) ** 2 < (EDGE + 3) ** 2) { clear = false; break; }
      }
      if (!clear) continue; // 아래로 지나가는 도로 위에는 기둥을 세우지 않음
      const h = pos[i].y - 1.2;
      pillarMats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, h / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
    }
  }
  if (pillarMats.length) {
    const tpl = new THREE.Group(); M.part(new THREE.CylinderGeometry(1.3, 1.5, 1, 10), M.toon(0xb0aaa0), tpl);
    M.instanceScatter(scene, tpl, pillarMats);
  }

  // 연석과 차선 점선
  const dummy = new THREE.Object3D();
  const curbs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.3, T.segLen * 3.1), M.toon(0xffffff), N);
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.04, T.segLen * 4), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), Math.ceil(N / 8) * 2);
  const red = new THREE.Color(0xe53935), white = new THREE.Color(0xffffff);
  let c = 0, d = 0;
  for (let i = 0; i < N; i += 3) {
    const pitch = -Math.atan(T.slope[i]);
    for (const s of [-1, 1]) {
      dummy.position.copy(roadPoint(T, i, s * (HW + 0.7), 0.12));
      dummy.rotation.set(pitch, head[i], s * 0.12, 'YXZ'); dummy.updateMatrix();
      curbs.setMatrixAt(c, dummy.matrix); curbs.setColorAt(c, (i / 3) % 2 ? red : white); c++;
    }
    if (i % 9 === 0) {
      for (const s of [-1, 1]) {
        dummy.position.copy(roadPoint(T, i, (s * LANE) / 2, 0.09));
        dummy.rotation.set(pitch, head[i], 0, 'YXZ'); dummy.updateMatrix(); dashes.setMatrixAt(d++, dummy.matrix);
      }
    }
  }
  curbs.count = c; dashes.count = d; curbs.receiveShadow = true; curbs.frustumCulled = dashes.frustumCulled = false;
  scene.add(curbs, dashes);

  // 출발선 + 출발 아치 + 관중석
  const checker = canvasTex(256, 32, (cx) => {
    for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { cx.fillStyle = (x + y) % 2 ? '#111' : '#fff'; cx.fillRect(x * 8, y * 8, 8, 8); }
  });
  const lineGeo = new THREE.PlaneGeometry(HW * 2, 3); lineGeo.rotateX(-Math.PI / 2);
  const line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ map: checker, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  line.position.copy(pos[0]); line.position.y += 0.1; line.rotation.y = head[0];
  scene.add(line);
  const arch = new THREE.Group(); arch.position.copy(pos[0]); arch.rotation.y = head[0]; scene.add(arch);
  for (const x of [-1, 1]) {
    M.part(new THREE.CylinderGeometry(0.9, 1.0, 13, 12), M.toon(0xffffff), arch, x * (EDGE + 1), 6.5, 0, { outline: 1.04 });
    M.part(new THREE.SphereGeometry(1.3, 12, 10), M.toon(0xffd84d), arch, x * (EDGE + 1), 13.4, 0, { outline: 1.05 });
  }
  M.part(new THREE.BoxGeometry(2 * EDGE + 4, 3.6, 1), M.toon(0x1d2b53), arch, 0, 12, 0);
  const startBanner = labelMesh(2 * EDGE, 3, 1024, 100, '🏁  START  ·  출발  🏁', '#ffd84d', '#1d2b53');
  startBanner.position.set(0, 12, -0.55); startBanner.rotation.y = Math.PI; arch.add(startBanner);
  const back = startBanner.clone(); back.position.z = 0.55; back.rotation.y = 0; arch.add(back);
  const si = N - 40, stand = M.grandstand(60);
  stand.position.copy(roadPoint(T, si, -(EDGE + 6))); stand.rotation.y = head[si] - Math.PI / 2;
  scene.add(stand);
  return T;
}

function farFromTrack(T, x, z, margin) {
  for (let i = 0; i < N; i += 6) { const p = T.pos[i]; if ((p.x - x) ** 2 + (p.z - z) ** 2 < margin * margin) return false; }
  return true;
}

// ---------- 지형: 트랙 근처는 평평, 멀어질수록 언덕, 가장자리는 산맥 ----------
function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
const fbm = (x, z, seed, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { s += a * vnoise(x * f, z * f, seed + o); f *= 2.03; a *= 0.5; } return s / 0.9375; };

function makeTerrain(def, T) {
  const b = T.box, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  const coarse = T.pos.filter((_, i) => i % 6 === 0);
  const desert = def.theme === 'desert';
  const distTrack = (x, z) => {
    if (x < b.min.x - 300 || x > b.max.x + 300 || z < b.min.z - 300 || z > b.max.z + 300) return 1e4;
    let m = Infinity; for (const p of coarse) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < m) m = d; }
    return Math.sqrt(m);
  };
  const height = (x, z) => {
    const d = distTrack(x, z), near = sstep(EDGE + 18, EDGE + 120, d);
    if (near <= 0) return 0;
    const rc = Math.hypot(x - cx, z - cz), far = sstep(Math.max(b.max.x - cx, b.max.z - cz) + 250, Math.max(b.max.x - cx, b.max.z - cz) + 750, rc);
    let hills = desert ? (fbm(x / 160, z / 160, 3) - 0.4) * 34 : (fbm(x / 240, z / 240, 7) - 0.38) * 46;
    hills = Math.max(0, hills);
    let mount = Math.pow(fbm(x / 380, z / 380, 11, 5), 1.5) * (desert ? 260 : 340);
    if (desert) mount = Math.floor(mount / 38) * 38 + sstep(0.7, 1, (mount % 38) / 38) * 38; // 계단 모양 메사
    return near * lerp(hills, mount, far);
  };
  return { height, distTrack, cx, cz };
}

function buildTerrain(def, T, scene, TR) {
  const SIZE = 4200, SEG = settings.quality === 'high' ? 230 : 110; // 빠르게: 지형을 덜 촘촘하게
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2); geo.translate(TR.cx, 0, TR.cz);
  const P = geo.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color();
  const desert = def.theme === 'desert';
  const G = desert ? [0xe9c98c, 0xdcb574, 0xf2d7a2] : [0x5cbf4a, 0x4aa63c, 0x72cf5a];
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), h = TR.height(x, z), n = fbm(x / 60, z / 60, 21, 3);
    P.setY(i, h - 0.15);
    if (desert) {
      if (h < 6) c.setHex(G[n < 0.4 ? 1 : n > 0.62 ? 2 : 0]);
      else c.setHex(Math.floor(h / 13) % 2 ? 0xd9824a : 0xc0683a).lerp(new THREE.Color(0xf0b070), clamp((h - 150) / 120, 0, 1)); // 층층이 띠
    } else if (h < 40) c.setHex(G[n < 0.4 ? 1 : n > 0.62 ? 2 : 0]).lerp(new THREE.Color(0x3f8f3f), clamp(h / 40, 0, 1) * 0.5);
    else if (h < 150) c.setHex(0x3f8f3f).lerp(new THREE.Color(0x7d8a74), clamp((h - 90) / 60, 0, 1));
    else if (h < 220) c.setHex(0x8d8f86);
    else c.setHex(0xf4f7fb); // 눈
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const detail = canvasTex(256, 256, (cx, w, h) => {
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
    for (let k = 0; k < 1400; k++) { const l = 200 + Math.random() * 55; cx.fillStyle = `rgb(${l},${l},${l})`; cx.beginPath(); cx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, 7); cx.fill(); }
  });
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.repeat.set(SIZE / 14, SIZE / 14);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: detail, vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 }));
  mesh.receiveShadow = true; scene.add(mesh);
}

function decorate(def, T, scene) {
  const b = T.box;
  const TR = makeTerrain(def, T);
  buildTerrain(def, T, scene, TR);
  const rand = (a, c) => a + Math.random() * (c - a);
  const desert = def.theme === 'desert';
  // 지형 위 자리 찾기: 트랙에서 margin 이상, 너무 높지 않은 곳. mask(x,z) 로 숲처럼 모이게.
  const spots = (count, margin, spread, mask, maxH = 60) => {
    const out = [];
    for (let t = 0; t < count * 40 && out.length < count; t++) {
      const x = rand(b.min.x - spread, b.max.x + spread), z = rand(b.min.z - spread, b.max.z + spread);
      if (mask && Math.random() > mask(x, z)) continue;
      if (TR.distTrack(x, z) < margin) continue;
      const y = TR.height(x, z); if (y > maxH) continue;
      out.push([x, y - 0.2, z]);
    }
    return out;
  };
  const scatter = (all, make, variants = 3, sMin = 0.8, sMax = 1.4) => {
    for (let v = 0; v < variants; v++) {
      const mats = all.filter((_, k) => k % variants === v).map(([x, y, z]) =>
        new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * 6.28), new THREE.Vector3().setScalar(rand(sMin, sMax))));
      if (mats.length) M.instanceScatter(scene, make(), mats);
    }
  };
  const dens = settings.quality === 'high' ? 1 : 0.45; // 빠르게: 나무·선인장 수를 줄임
  const forest = (x, z) => (fbm(x / 170, z / 170, 33) > 0.55 ? 0.95 : 0.08); // 숲 덩어리
  // 하늘: 해, 구름, 열기구
  const sunTex = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,250,200,1)'); g.addColorStop(0.45, 'rgba(255,230,150,.35)'); g.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(900); sunSprite.renderOrder = -0.5; scene.add(sunSprite);
  for (let k = 0; k < 30; k++) {
    const cl = M.cloud(), a = Math.random() * Math.PI * 2, r = rand(200, 1500);
    cl.position.set(TR.cx + Math.cos(a) * r, rand(160, 320), TR.cz + Math.sin(a) * r);
    cl.scale.set(rand(1.2, 2.6), rand(0.7, 1.1), rand(1.2, 2)); cl.userData.cloud = true; scene.add(cl);
  }
  const balloons = [];
  for (let k = 0; k < 6; k++) {
    const bl = M.balloon([0xff6fa8, 0xffd84d, 0x4fc3ff, 0x7dff8a, 0xff7043, 0xb57bff][k]);
    const a = Math.random() * Math.PI * 2, r = rand(150, 600);
    bl.position.set(TR.cx + Math.cos(a) * r, rand(60, 120), TR.cz + Math.sin(a) * r); bl.userData.baseY = bl.position.y; bl.userData.phase = k;
    scene.add(bl); balloons.push(bl);
  }
  const spinners = [];
  if (!desert) {
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
  } else {
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
  }
  // 급커브 바깥쪽 타이어 벽 (빨강/흰 줄무늬)
  {
    const tires = [];
    for (let i = 0; i < N; i += 5) {
      const c = T.curv[i]; if (Math.abs(c) < 0.3 || T.bridge[i]) continue;
      const p = roadPoint(T, i, Math.sign(c) * (EDGE + 2.2));
      for (let k = 0; k < 3; k++) tires.push([p.x, p.y + 0.55 + k * 1.05, p.z, (i / 5 + k) % 2]);
    }
    if (tires.length) {
      const im = new THREE.InstancedMesh(new THREE.TorusGeometry(1.1, 0.5, 6, 12).rotateX(Math.PI / 2), M.toon(0xffffff), tires.length);
      const dm = new THREE.Object3D(), red = new THREE.Color(0xe53935), wht = new THREE.Color(0xf5f5f5);
      tires.forEach(([x, y, z, k], n) => { dm.position.set(x, y, z); dm.updateMatrix(); im.setMatrixAt(n, dm.matrix); im.setColorAt(n, k ? red : wht); });
      im.castShadow = true; im.frustumCulled = false; scene.add(im);
    }
  }
  // 직선 구간 광고판 (가상의 대회 문구)
  {
    const TEXT = desert ? ['🏜️ 사막 수학 랠리', '정답 = 부스터 🚀', '구구단 챔피언 도전!', 'ABC 레이싱 리그', '천천히, 정확하게!', '오늘도 최고야 ⭐']
      : ['🏁 공부 카트 그랑프리', '정답 = 부스터 🚀', '구구단 챔피언 도전!', 'ABC 레이싱 리그', '천천히, 정확하게!', '오늘도 최고야 ⭐'];
    const COL = [['#ffd84d', '#1d2b53'], ['#ff7043', '#ffffff'], ['#2e86de', '#ffffff'], ['#fffdf5', '#1d2b53'], ['#1e8449', '#ffffff'], ['#ab47bc', '#ffffff']];
    let k = 0;
    for (let i = 60; i < N && k < TEXT.length; i += 37) {
      if (Math.abs(T.curv[i]) > 0.05 || T.bridge[i] || T.pos[i].y > 1) continue;
      const s = k % 2 ? 1 : -1, p = roadPoint(T, i, s * (EDGE + 9));
      if (TR.distTrack(p.x, p.z) < EDGE + 6) continue;
      const bb = M.billboard(TEXT[k], COL[k][0], COL[k][1]);
      bb.position.set(p.x, 0, p.z);
      const c0 = T.pos[i], f = { x: T.right[i].z, z: -T.right[i].x }; // 트랙 쪽을 보되 다가오는 차 쪽으로 살짝 돌림
      bb.rotation.y = Math.atan2(c0.x - p.x - f.x * 12, c0.z - p.z - f.z * 12);
      scene.add(bb); k++; i += 120;
    }
  }
  // 트랙 바깥 깃발
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 7, 5);
  const flagShape = new THREE.Shape(); flagShape.moveTo(0, 0); flagShape.lineTo(2.6, -0.8); flagShape.lineTo(0, -1.6);
  const count = Math.floor(N / 40) * 2;
  const poles = new THREE.InstancedMesh(poleGeo, M.toon(0xffffff), count);
  const flags = new THREE.InstancedMesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshToonMaterial({ color: 0xffffff, side: THREE.DoubleSide }), count);
  const dm = new THREE.Object3D(), col = new THREE.Color(), FLAGC = [0xe53935, 0xffd84d, 0x1e88e5, 0x43a047, 0xff7043, 0xab47bc];
  let n = 0;
  for (let i = 0; i < N; i += 40) {
    if (T.bridge[i]) continue;
    for (const s of [-1, 1]) {
      const p = roadPoint(T, i, s * (EDGE + 3 + T.pos[i].y * def.skirtSlope));
      dm.position.set(p.x, 3.5, p.z); dm.rotation.set(0, T.head[i], 0); dm.updateMatrix(); poles.setMatrixAt(n, dm.matrix);
      dm.position.y = 6.8; dm.rotation.set(0, T.head[i] + Math.PI / 2, 0); dm.updateMatrix(); flags.setMatrixAt(n, dm.matrix);
      flags.setColorAt(n, col.setHex(FLAGC[n % FLAGC.length])); n++;
    }
  }
  poles.count = flags.count = n; poles.frustumCulled = flags.frustumCulled = false;
  scene.add(poles, flags);
  return { balloons, spinners, sunSprite };
}

// ---------- 볼거리: 점프대, 부스터 발판, 터널, 개울, 움직이는 장애물 ----------
function buildAttractions(def, T, scene) {
  const A = { ramps: [], pads: [], movers: [], river: null };
  for (const [u, lat, w, h, len] of def.ramps) {
    const i0 = uIdx(u), n = Math.round(len / T.segLen);
    const m = M.ramp(w, h, len, 0xff7043);
    m.position.copy(roadPoint(T, i0, lat, 0.05)); m.rotation.set(-Math.atan(T.slope[i0]), T.head[i0], 0, 'YXZ'); scene.add(m);
    const stripeTex = canvasTex(64, 64, (c) => { c.fillStyle = '#ffd84d'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#1d2b53'; for (let k = -64; k < 64; k += 22) { c.beginPath(); c.moveTo(k, 64); c.lineTo(k + 11, 64); c.lineTo(k + 75, 0); c.lineTo(k + 64, 0); c.fill(); } });
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: stripeTex, side: THREE.DoubleSide }));
    lip.position.set(0, h / 2, len + 0.02); m.add(lip);
    A.ramps.push({ i0, i1: (i0 + n) % N, n, lat, w, h });
  }
  const padTex = canvasTex(128, 160, (c, w, h) => {
    c.fillStyle = '#ff9f1c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffe066';
    for (let k = 0; k < 3; k++) { const y = 20 + k * 48; c.beginPath(); c.moveTo(14, y); c.lineTo(64, y + 34); c.lineTo(114, y); c.lineTo(114, y + 16); c.lineTo(64, y + 50); c.lineTo(14, y + 16); c.fill(); }
    c.strokeStyle = '#fff'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
  });
  for (const [u, lat] of def.pads) {
    const i0 = uIdx(u), g = new THREE.PlaneGeometry(9, 12); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: padTex, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
    m.position.copy(roadPoint(T, i0, lat, 0.12)); m.rotation.set(-Math.atan(T.slope[i0]), T.head[i0], 0, 'YXZ'); scene.add(m);
    A.pads.push({ i0, lat, mesh: m });
  }
  if (def.tunnel) {
    const [u0, u1, kind] = def.tunnel, i0 = uIdx(u0), i1 = uIdx(u1);
    const step = kind === 'flower' ? 10 : 22, mats = [], cols = [];
    for (let i = i0; i !== i1; i = (i + 1) % N) {
      if (((i - i0 + N) % N) % step) continue;
      const sc = kind === 'rock' ? 0.9 + Math.random() * 0.35 : 1;
      mats.push(new THREE.Matrix4().compose(T.pos[i].clone().setY(T.pos[i].y - 0.5), new THREE.Quaternion().setFromAxisAngle(UP, T.head[i]), new THREE.Vector3(1, sc, 1)));
      cols.push(((i - i0 + N) % N) / step % 2);
    }
    const geo = kind === 'flower' ? new THREE.TorusGeometry(EDGE + 1.5, 1.1, 8, 28, Math.PI) : new THREE.TorusGeometry(EDGE + 6, 4.5, 6, 14, Math.PI);
    const mat = kind === 'flower' ? M.toon(0xffffff) : M.toon(0xc8743f, { flatShading: true });
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    const PAL = [new THREE.Color(0xff6fa8), new THREE.Color(0xffd84d)];
    mats.forEach((m, k) => { im.setMatrixAt(k, m); if (kind === 'flower') im.setColorAt(k, PAL[cols[k]]); });
    im.castShadow = true; im.frustumCulled = false; scene.add(im);
    if (kind === 'flower') { // 아치에 꽃송이
      const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.4, 0), M.toon(0xffffff, { flatShading: true }), mats.length * 9);
      const dm = new THREE.Matrix4(), q = new THREE.Vector3(), col = new THREE.Color(); let n = 0;
      mats.forEach((m) => { for (let k = 0; k < 9; k++) { const a = (k + 0.5) / 9 * Math.PI; q.set(Math.cos(a) * (EDGE + 1.5), Math.sin(a) * (EDGE + 1.5), 0).applyMatrix4(m); dm.makeTranslation(q.x, q.y, q.z); fl.setMatrixAt(n, dm); fl.setColorAt(n++, col.setHex([0xffffff, 0xff7043, 0xb57bff][k % 3])); } });
      fl.frustumCulled = false; scene.add(fl);
    }
  }
  if (def.river) {
    const i0 = uIdx(def.river), g = new THREE.PlaneGeometry(2 * EDGE + 30, 16); g.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x4fb3ff, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    water.position.copy(roadPoint(T, i0, 0, 0.15)); water.rotation.y = T.head[i0]; scene.add(water);
    for (const s of [-1, 1]) { // 개울이 도로 밖으로 이어지게
      const ext = new THREE.Mesh(new THREE.PlaneGeometry(100, 16).rotateX(-Math.PI / 2), water.material);
      ext.position.copy(roadPoint(T, i0, s * (EDGE + 65), 0.05)); ext.position.y = 0.05; ext.rotation.y = T.head[i0]; scene.add(ext);
    }
    A.river = { i0, n: Math.round(8 / T.segLen) };
  }
  if (def.movers) {
    const { u, kind, count } = def.movers;
    for (let k = 0; k < count; k++) {
      const mesh = kind === 'sheep' ? M.sheep() : M.boulder();
      scene.add(mesh);
      A.movers.push({ mesh, kind, i: (uIdx(u) + k * 14) % N, amp: HW - 2, w: 0.45 + k * 0.17, ph: k * 2.1, lat: 0, cd: 0, pos: new THREE.Vector3() });
    }
  }
  return A;
}

// 도로 높이 (점프대 경사 포함)
function groundY(T, A, idxF, lat) {
  const i0 = Math.floor(idxF) % N, i1 = (i0 + 1) % N, f = idxF - Math.floor(idxF);
  let y = lerp(T.pos[i0].y, T.pos[i1].y, f);
  for (const r of A.ramps) {
    const s = ((idxF - r.i0 + N) % N) / r.n;
    if (s >= 0 && s <= 1 && Math.abs(lat - r.lat) < r.w / 2) y += r.h * s;
  }
  return y;
}
