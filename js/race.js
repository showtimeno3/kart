// 경주 시작, 보조 함수, 아이템, 문제 문
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

function startRace() {
  const def = TRACKS[settings.track];
  saveSettings();
  Sound.init();
  const DIFF = [{ speed: 0.88, skill: 0.5 }, { speed: 1, skill: 0.68 }, { speed: 1.09, skill: 0.85 }][settings.difficulty] || { speed: 1, skill: 0.68 };
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(def.fog || def.skyBottom, 320, 1700);
  scene.userData.fogColor = def.fog || def.skyBottom;
  const sky = makeSky(def.skyTop, def.skyBottom); scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7a55, 0.75));
  const sun = new THREE.DirectionalLight(0xfff4dd, 0.85);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 400 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const groundTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = def.ground[0]; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) {
      c.fillStyle = def.ground[1 + (k % 3)]; c.beginPath();
      c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 0, Math.PI * 2); c.fill();
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(500, 500);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshLambertMaterial({ map: groundTex, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 })); // 도로보다 항상 뒤에 그려지게
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; scene.add(ground); // 지형 바깥 먼 바닥

  const T = buildTrack(def, scene);
  const deco = decorate(def, T, scene);
  const A = buildAttractions(def, T, scene);
  Particles.init(scene);

  // 정답 문: 꼭대기에 큰 문제판, 아래에 보기 3개
  const gates = def.gates.map((u, gi) => {
    const i = uIdx(u), g = new THREE.Group();
    g.position.copy(T.pos[i]); g.rotation.y = T.head[i]; scene.add(g);
    const postColor = [0xff7043, 0xab47bc, 0x26a69a, 0xffb300, 0x42a5f5][gi % 5];
    for (const x of [-1, 1]) {
      M.part(new THREE.CylinderGeometry(0.9, 1.0, 13, 12), M.toon(postColor), g, x * (EDGE + 1), 6.5, 0, { outline: 1.04 });
      M.part(new THREE.SphereGeometry(1.3, 12, 10), M.toon(0xffd84d), g, x * (EDGE + 1), 13.4, 0, { outline: 1.05 });
    }
    M.part(new THREE.BoxGeometry(2 * EDGE + 4, 3.6, 0.9), M.toon(0x1d2b53), g, 0, 11.6, 0);
    const banner = labelMesh(2 * EDGE, 3.0, 1024, 76, '?', '#fffdf5', '#1d2b53');
    banner.position.set(0, 11.6, -0.5); banner.rotation.y = Math.PI; g.add(banner);
    // 그룹 안에서 +x 는 도로의 왼쪽이므로 보기 k (왼쪽부터) 는 x = -lat
    const panels = [-LANE, 0, LANE].map((lat, k) => {
      const x = -lat;
      M.part(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 5), M.toon(0x1d2b53), g, x - 3.8, 8.2, 0, { cast: false });
      M.part(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 5), M.toon(0x1d2b53), g, x + 3.8, 8.2, 0, { cast: false });
      const m = labelMesh(10, 4.2, 512, 210, '?', LANE_COLORS[k], '#ffffff');
      m.position.set(x, 5.4, -0.1); m.rotation.y = Math.PI; g.add(m);
      const sg = new THREE.PlaneGeometry(LANE - 1.2, 16); sg.rotateX(-Math.PI / 2);
      const strip2 = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: LANE_COLORS[k], transparent: true, opacity: 0.55,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      strip2.position.set(x, 0.12, -9); g.add(strip2);
      return m;
    });
    return { i, panels, banner, q: null };
  });

  // 아이템 박스
  const boxTex = canvasTex(128, 128, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#ff6fa8'); gr.addColorStop(0.5, '#ffd84d'); gr.addColorStop(1, '#4fc3ff');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = '#fff'; c.font = `92px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', w / 2, h / 2 + 6);
  });
  const boxMat = new THREE.MeshLambertMaterial({ map: boxTex, transparent: true, opacity: 0.92, emissive: 0x333333 });
  const boxGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
  const boxes = [];
  for (const u of def.items) {
    const i = uIdx(u);
    for (const lat of [-15, -5, 5, 15]) {
      const m = new THREE.Mesh(boxGeo, boxMat);
      const base = roadPoint(T, i, lat, 2);
      m.position.copy(base); m.castShadow = true; scene.add(m);
      boxes.push({ mesh: m, respawn: 0, phase: Math.random() * 6, baseY: base.y });
    }
  }

  // 플레이어 & 컴퓨터 (플레이어는 맨 뒤에서 출발)
  const pk = M.makeKart(settings.species); scene.add(pk.root);
  const p = { kart: pk, pos: T.pos[8].clone(), vel: new THREE.Vector3(), h: T.head[8], yawRate: 0, steer: 0, vF: 0, prevVF: 0,
    idx: 8, idxF: 8, lat: 0, laps: 0, drift: { on: false, dir: 0, charge: 0 }, boost: 0, slow: 0, spin: 0, spinA: 0,
    y: T.pos[8].y, vy: 0, gy: T.pos[8].y, air: 0, airT: 0, land: 0, hopCd: 0, canTrick: false, trick: 0, tricked: false,
    roll: 0, pitch: 0, slopeP: 0, bodyYaw: 0, wheel: 0, shake: 0, padCd: 0, wet: 0,
    rolling: 0, rollTick: 0, combo: 0, finished: false, finishTime: 0, rank: AI_COUNT + 1, gasAt: -99 };
  resetEffects(p);
  const others = SPECIES_KEYS.filter((s) => s !== settings.species);
  const grid = [[98, -9], [98, 9], [80, -9], [80, 9], [62, -9], [62, 9], [44, 0]]; // 플레이어는 [8, 0]
  const PERSONAS = ['aggro', 'steady', 'prank']; // 공격형, 안정형, 장난꾸러기
  const ais = grid.slice(0, AI_COUNT).map(([i, lat], k) => {
    const kart = M.makeKart(others[k]); scene.add(kart.root);
    return { kart, species: others[k], name: M.SPECIES[others[k]].name, color: M.SPECIES[others[k]].kart, d: i * T.segLen, idx: i, lat, latT: lat, latV: 0, speed: 0,
      persona: PERSONAS[k % 3], base: (33 + k * 0.6 + Math.random() * 2 + (k % 3 === 0 ? 0.6 : 0)) * DIFF.speed, skill: DIFF.skill + Math.random() * 0.12 + (k % 3 === 1 ? 0.08 : 0),
      boost: 0, slow: 0, spin: 0, banana: 12 + Math.random() * 14, finished: false, finishTime: 0,
      roll: 0, bodyYaw: 0, wheel: 0, planGate: null, planLane: -1, pos: new THREE.Vector3(), y: T.pos[i].y, vy: 0, gy: T.pos[i].y, padCd: 0 };
  });
  ais.forEach(resetEffects);

  game = { scene, sky, sun, T, A, deco, gates, boxes, p, ais, hazards: [], shots: [], t: -3.5, state: 'intro', introT: 0, paused: false, lastRank: AI_COUNT + 1, lastLap: 0, wrongT: 0, fps: [], def, bank: loadBank(),
    stats: { total: 0, correct: 0, wrong: [], items: {}, hits: {}, shieldBlocks: 0 }, nextGate: null, endTimer: 0, lastCount: 99, camYaw: p.h, camY: p.y, qx: null, qy: null,
    minimap: buildMinimap(T) };

  $('menu').classList.add('hidden'); $('result').classList.add('hidden');
  $('hud').classList.remove('hidden'); $('touch').classList.toggle('hidden', !touchMode);
  $('question').classList.add('hidden'); $('item').textContent = '-'; $('fx').textContent = ''; $('countdown').textContent = '';
  $('intro').classList.remove('hidden'); $('intro-name').textContent = def.name;
  $('intro-sub').textContent = `${LAPS}바퀴 · 문제 ${def.gates.length * LAPS}개`;
  $('lights').classList.add('hidden'); $('lights').className = 'hidden'; $('banner').className = ''; $('wrongway').classList.add('hidden');
  applyQuality();
  if (bloomPass) bloomPass.strength = THEMES[def.theme].bloom;
  if (window.Music) Music.play(def.theme);
  updateKartMeshes();
  camera.position.set(p.pos.x - Math.sin(p.h) * 9, p.y + 3.6, p.pos.z - Math.cos(p.h) * 9);
  camera.lookAt(p.pos.x, p.y + 1.4, p.pos.z);
}

// ---------- 보조 ----------
function nearest(T, v, guess) {
  let best = guess, bd = Infinity;
  for (let k = -40; k <= 40; k++) {
    const j = (guess + k + N) % N, q = T.pos[j];
    const dd = (q.x - v.x) ** 2 + (q.z - v.z) ** 2;
    if (dd < bd) { bd = dd; best = j; }
  }
  return best;
}
// prev -> cur 로 앞으로 이동하며 g 를 지났는가
function crossed(prev, cur, g) {
  const delta = (cur - prev + N) % N;
  if (delta === 0 || delta > N / 2) return false;
  const dg = (g - prev + N) % N;
  return dg > 0 && dg <= delta;
}
const inRange = (idx, i0, n) => (idx - i0 + N) % N <= n;
const laneOf = (lat) => (lat < -LANE / 2 ? 0 : lat > LANE / 2 ? 2 : 1);
let flashTimer = 0;
function flash(text, cls) {
  const f = $('feedback'); f.textContent = text; f.className = 'show ' + cls; flashTimer = 1.3;
}
const playerTotal = () => game.p.laps * N + game.p.idx;
const aiTotal = (a) => a.d / game.T.segLen;
const kartPoint = (kart, x, y, z) => kart.root.localToWorld(tmpV.set(x, y, z)).clone();

// 수직 움직임: 중력 + 도로를 따라감. 도로가 갑자기 내려가면(언덕 꼭대기, 점프대 끝) 공중에 뜸.
function vertical(o, gy, dt) {
  const prevGy = o.gy; o.gy = gy;
  const wasAir = o.y > prevGy + 0.05;
  o.vy -= G * dt; o.y += o.vy * dt;
  if (o.y <= gy) {
    const impact = -o.vy;
    // 도로를 따라 올라가는 속도만 이어받음. 한 프레임에 땅이 크게 바뀌면(구조, 샘플 건너뜀) 튀어 오르지 않게 제한
    o.y = gy; o.vy = dt > 0 && Math.abs(gy - prevGy) < 1.5 ? clamp((gy - prevGy) / dt, -20, 12) : 0;
    return wasAir ? Math.max(impact, 0.01) : 0; // 착지 세기 (0 이면 계속 땅 위)
  }
  return 0;
}


// ---------- 문제 ----------
function nextGateFrom(idx) {
  let best = null, bd = Infinity;
  for (const g of game.gates) { const dd = (g.i - idx + N) % N; if (dd > 0 && dd < bd) { bd = dd; best = g; } }
  return [best, bd];
}
function updateNextGate() {
  const [best] = nextGateFrom(game.p.idx);
  if (best === game.nextGate) return;
  game.nextGate = best;
  if (!best.q) {
    best.q = Questions.next(settings.subject, settings.level, game.bank, { canSpeak: canSpeak() });
    best.panels.forEach((m, k) => relabel(m, best.q.choices[k]));
    relabel(best.banner, best.q.prompt);
    if (best.q.speak) speak(best.q.speak);
  }
  $('q-prompt').textContent = best.q.prompt;
  $('q-prompt').classList.toggle('long', [...best.q.prompt].length > 9); // 긴 문제(시계, 듣기 등)는 한 줄에 들어가게 작게
  $('q-speak').classList.toggle('hidden', !best.q.speak);
  document.querySelectorAll('.choice').forEach((el, k) => { el.textContent = best.q.choices[k]; el.classList.remove('off'); });
  if (best.hintOff != null) document.querySelectorAll('.choice')[best.hintOff].classList.add('off');
  else if (game.p.hint) applyHint(best);
  const qe = $('question'); qe.classList.remove('hidden', 'pop'); void qe.offsetWidth; qe.classList.add('pop'); game.qSize = null;
}

function onPlayerGate(g) {
  const q = g.q, p = game.p, s = game.stats;
  if (!q) return;
  const lane = laneOf(p.lat), answerText = q.choices[q.answer];
  s.total++;
  const bankIdx = game.bank.findIndex((b) => b.id === q.id);
  const at = kartPoint(p.kart, 0, 1.5, 0);
  if (lane === q.answer) {
    s.correct++; p.combo++;
    p.boost = Math.max(p.boost, 1.2 + 0.3 * Math.min(p.combo, 4));
    flash(p.combo >= 2 ? `정답! ${p.combo}콤보 🚀` : '정답! 🚀', 'good');
    Sound.sfx.correct(); Sound.sfx.boost();
    Particles.burst(at, 26, 0xffd84d, 9);
    if (bankIdx >= 0) game.bank.splice(bankIdx, 1);
  } else {
    p.combo = 0; p.slow = 1.2;
    flash(`정답은 ${answerText}`, 'bad');
    Sound.sfx.wrong();
    Particles.burst(at, 14, 0x777788, 4, { add: false, grav: -2, size: 1.2, grow: 2 });
    s.wrong.push({ prompt: q.id.startsWith('listen:') ? `🔊 ${q.speak}` : q.prompt, answer: answerText, chosen: q.choices[lane], lat: Math.round(p.lat), want: q.answer });
    if (bankIdx < 0) game.bank.push(q);
  }
  if (q.speakAfter) speak(q.speakAfter);
  saveBank(game.bank);
  g.q = null; g.hintOff = null;
  g.panels.forEach((m) => relabel(m, '?'));
  relabel(g.banner, '?');
  game.nextGate = null;
}
