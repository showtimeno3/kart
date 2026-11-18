(() => {
  'use strict';
  const M = window.Models;
  const LAPS = 2, N = 1600, HW = 20, LANE = 12, EDGE = HW + 5.2, AI_COUNT = 4;
  const MAX_SPEED = 38, BOOST_MUL = 1.4, G = 30, KMH = 3.2;
  const LANE_COLORS = ['#e74c3c', '#2e86de', '#1e8449'];
  const FONT = "'Jua', 'Malgun Gothic', sans-serif";
  const SPECIES_KEYS = Object.keys(M.SPECIES);
  const ITEM_ICON = { boost: '🚀', banana: '🍌' };

  const $ = (id) => document.getElementById(id);
  const textCache = {};
  const setText = (id, v) => { v = String(v); if (textCache[id] !== v) { textCache[id] = v; $(id).textContent = v; } };
  const styleCache = {};
  const setStyle = (id, prop, v) => { const k = id + prop; if (styleCache[k] !== v) { styleCache[k] = v; $(id).style[prop] = v; } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt)); // 프레임 속도와 무관한 부드러운 접근
  const approach = (a, b, step) => (a < b ? Math.min(b, a + step) : Math.max(b, a - step));
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const wrapU = (d) => d - Math.round(d); // 한 바퀴 비율 차이를 -0.5~0.5 로
  const bump = (u, c, w) => Math.exp(-((wrapU(u - c) / w) ** 2));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const UP = new THREE.Vector3(0, 1, 0);
  const SUN_DIR = new THREE.Vector3(-0.45, 0.5, 0.75).normalize(); // 햇빛 방향 (그림자와 하늘의 해 위치가 같게)
  const tmpV = new THREE.Vector3();

  // ---------- 트랙 정의 ----------
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
      gates: [0.16, 0.29, 0.48, 0.7, 0.88],
      items: [0.195, 0.56, 0.8],
      pads: [[0.03, 0], [0.455, 0], [0.685, 0]],
      ramps: [[0.34, 9, 11, 1.6, 9], [0.845, -9, 11, 1.6, 9]],
      movers: { u: 0.615, kind: 'sheep', count: 3 },
      tunnel: [0.9, 0.95, 'flower'],
      river: 0.725,
    },
    {
      theme: 'desert', name: '사막 협곡', skyTop: 0x4f9be6, skyBottom: 0xffe6bd, ground: ['#e9c98c', '#dfbb78', '#f1d59f', '#d6b06d'],
      shoulder: '#c4925c', skirt: 0xc8743f, skirtSlope: 0.35, fog: 0xf3d6a8,
      // 출발 직선 → 중간 커브 → 빠른 꺾임 → 메사 오르막 → 메사 위 커브 → 절벽 점프 → S자 → 헤어핀(반경 30) → 바위 아치 협곡 → 반대 방향 커브 2개
      turtle: [['S', 300], ['A', 90, -90], ['S', 120], ['A', 220, -25], ['S', 260], ['A', 60, -70], ['S', 280], ['A', 50, 45], ['A', 50, -45],
        ['S', 80], ['A', 30, -150], ['S', 220], ['A', 130, 40], ['A', 70, -60]],
      elev: (u) => 13 * sstep(0.28, 0.37, u) * (1 - sstep(0.48, 0.497, u)),
      bridge: null,
      gates: [0.06, 0.2, 0.33, 0.44, 0.575, 0.87],
      items: [0.1, 0.415, 0.66],
      pads: [[0.02, 0], [0.3, 9], [0.64, -9]],
      ramps: [[0.468, 0, 38, 1.8, 10], [0.885, 8, 11, 1.6, 9]],
      movers: { u: 0.685, kind: 'boulder', count: 3 },
      tunnel: [0.635, 0.705, 'rock'],
      river: null,
    },
  ];

  // ---------- 설정 ----------
  const settings = { subject: 'math', level: 1, track: 0, species: 'bear', quality: 'high', difficulty: 1, volMusic: 55, volSfx: 80 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('eduKart.settings')) || {}); } catch (e) { /* 저장소 없음 */ }
  if (!M.SPECIES[settings.species]) settings.species = 'bear';
  const saveSettings = () => { try { localStorage.setItem('eduKart.settings', JSON.stringify(settings)); } catch (e) { /* 무시 */ } };
  const STRING_GROUPS = ['subject', 'species', 'quality'];
  function refreshMenu() {
    document.querySelectorAll('.opt').forEach((b) => b.classList.toggle('on', String(settings[b.dataset.group]) === b.dataset.v));
    const best = loadBest(settings.track);
    $('best').textContent = best ? `🏆 최고 기록 ${fmtTime(best)}` : '';
  }
  document.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
    const grp = b.dataset.group, v = b.dataset.v;
    settings[grp] = STRING_GROUPS.includes(grp) ? v : Number(v);
    refreshMenu(); saveSettings(); Sound.sfx.click();
    if (grp === 'species') showcase.setSpecies(v);
    if (grp === 'quality') applyQuality();
  }));

  const bankKey = () => `eduKart.wrong.${settings.subject}.${settings.level}`;
  function loadBank() { try { return JSON.parse(localStorage.getItem(bankKey())) || []; } catch (e) { return []; } }
  function saveBank(b) { try { localStorage.setItem(bankKey(), JSON.stringify(b.slice(-30))); } catch (e) { /* 무시 */ } }
  function loadBest(track) { try { return +localStorage.getItem(`eduKart.best.${track}`) || 0; } catch (e) { return 0; } }
  function saveBest(track, t) { try { localStorage.setItem(`eduKart.best.${track}`, String(t)); } catch (e) { /* 무시 */ } }

  function speak(text) {
    if (!window.speechSynthesis || Sound.muted || settings.volSfx === 0) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.85; u.volume = settings.volSfx / 100;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  // ---------- 소리 (WebAudio 합성, 파일 없음): 효과음 / 음악 버스를 따로 두어 음량을 따로 조절 ----------
  const Sound = (() => {
    let ctx = null, master = null, sfxBus = null, musicBus = null, eng = null, muted = false;
    try { muted = localStorage.getItem('eduKart.muted') === '1'; } catch (e) { /* 무시 */ }
    function levels() {
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(muted ? 0 : 0.6, t, 0.05);
      sfxBus.gain.setTargetAtTime(settings.volSfx / 100, t, 0.05);
      musicBus.gain.setTargetAtTime((settings.volMusic / 100) * 0.7, t, 0.05);
    }
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
      // 큰 소리가 겹쳐도 찢어지지 않게 압축
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
      sfxBus = ctx.createGain(); sfxBus.connect(comp); musicBus = ctx.createGain(); musicBus.connect(comp);
      levels();
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus); o1.start(); o2.start();
      eng = { o1, o2, f, g };
      if (window.Music) Music.attach(ctx, musicBus);
    }
    function engine(ratio, on) {
      if (!ctx) return;
      const t = ctx.currentTime, fr = 48 + ratio * 105;
      eng.o1.frequency.setTargetAtTime(fr, t, 0.08); eng.o2.frequency.setTargetAtTime(fr * 0.502, t, 0.08);
      eng.f.frequency.setTargetAtTime(350 + ratio * 900, t, 0.1);
      eng.g.gain.setTargetAtTime(on ? 0.045 + ratio * 0.035 : 0, t, 0.12);
    }
    function tone(freq, dur, type = 'sine', vol = 0.2, delay = 0, slide = 0) {
      if (!ctx) return;
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
    }
    function noise(dur, vol, freq) {
      if (!ctx) return;
      const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    }
    const sfx = {
      correct() { tone(784, 0.12, 'triangle', 0.25); tone(988, 0.12, 'triangle', 0.25, 0.09); tone(1319, 0.3, 'triangle', 0.25, 0.18); },
      wrong() { tone(320, 0.18, 'square', 0.1); tone(240, 0.35, 'square', 0.1, 0.16, -80); },
      boost() { noise(0.7, 0.35, 900); tone(180, 0.6, 'sawtooth', 0.07, 0, 500); },
      item() { tone(660, 0.07, 'square', 0.08); tone(990, 0.12, 'square', 0.08, 0.07); },
      roll() { tone(500 + Math.random() * 500, 0.04, 'square', 0.04); },
      beep() { tone(440, 0.25, 'square', 0.14); },
      go() { tone(880, 0.6, 'square', 0.14); },
      hit() { noise(0.25, 0.5, 400); },
      bump() { noise(0.15, 0.35, 250); },
      spin() { tone(700, 0.7, 'sine', 0.15, 0, -550); },
      hop() { tone(300, 0.1, 'sine', 0.12, 0, 200); },
      jump() { tone(260, 0.35, 'triangle', 0.15, 0, 500); },
      land() { noise(0.18, 0.4, 300); },
      trick() { tone(900, 0.08, 'square', 0.08); tone(1200, 0.15, 'square', 0.08, 0.07); },
      splash() { noise(0.4, 0.3, 1800); },
      baa() { tone(420, 0.35, 'sawtooth', 0.06, 0, -60); },
      click() { tone(1100, 0.05, 'triangle', 0.12); },
      lap() { [660, 880, 1100].forEach((f, i) => tone(f, 0.18, 'square', 0.1, i * 0.1)); },
      pass() { tone(740, 0.08, 'triangle', 0.14); tone(988, 0.14, 'triangle', 0.14, 0.07); },
      finish() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.22, i * 0.12)); },
    };
    return {
      init, engine, sfx, levels,
      get engineLevel() { return eng ? eng.g.gain.value : 0; }, // 점검용
      get muted() { return muted; },
      toggle() {
        muted = !muted; levels();
        try { localStorage.setItem('eduKart.muted', muted ? '1' : '0'); } catch (e) { /* 무시 */ }
        if (muted && window.speechSynthesis) speechSynthesis.cancel();
        return muted;
      },
    };
  })();
  // 첫 클릭/키 입력 때 오디오 시작 (브라우저 정책) + 메뉴 음악
  const unlockAudio = () => { Sound.init(); if (!game && window.Music && !Music.playing) Music.play('menu'); };
  addEventListener('pointerdown', unlockAudio); addEventListener('keydown', unlockAudio);

  // ---------- 입력 ----------
  const keys = {}, pressed = {};
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'drift', ShiftRight: 'drift', Space: 'item' };
  function press(k) {
    if (k === 'item' && !keys.item) useItem();
    if (k === 'up' && !keys.up && game) game.p.gasAt = game.t; // 스타트 대시 판정용
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
  }
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) { Sound.toggle(); flashTip(Sound.muted ? '🔇 소리 끔' : '🔊 소리 켬', 1.2); return; }
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { togglePause(); return; }
    if (game && game.state === 'intro' && !e.repeat) skipIntro();
    const k = KEYMAP[e.code]; if (!k) return;
    e.preventDefault(); press(k);
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (game && game.state === 'race' && !game.paused) togglePause(); });
  const touchMode = 'ontouchstart' in window;
  document.querySelectorAll('#touch button').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(k); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { keys[k] = false; }));
  });
  $('q-speak').addEventListener('click', () => { const g = game && game.nextGate; if (g && g.q && g.q.speak) speak(g.q.speak); });

  // ---------- 렌더러 + 후처리 (빛 번짐, 색 보정, 비네트, 속도 블러, FXAA) ----------
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('app').appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.8, 5000);
  const GradeShader = {
    uniforms: { tDiffuse: { value: null }, speed: { value: 0 }, vig: { value: 0.9 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float speed; uniform float vig; varying vec2 vUv;
      void main(){
        vec2 d = vUv - 0.5; vec4 c = texture2D(tDiffuse, vUv);
        if (speed > 0.001) { // 가장자리만 방사형으로 번지게 (가운데 차와 문제는 선명)
          float w = smoothstep(0.12, 0.5, length(d)) * speed;
          for (int i = 1; i <= 5; i++) c += texture2D(tDiffuse, vUv - d * w * 0.022 * float(i));
          c /= 6.0;
        }
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb = mix(vec3(l), c.rgb, 1.12);
        c.rgb = (c.rgb - 0.5) * 1.04 + 0.5;
        c.rgb *= 1.0 - vig * dot(d, d) * 0.9;
        gl_FragColor = vec4(c.rgb, 1.0);
      }`,
  };
  let composer = null, bloomPass = null, gradePass = null, fxaaPass = null, renderPass = null;
  function applyQuality() {
    const high = settings.quality === 'high';
    // 빠르게: 해상도 75% + 먼 곳 안 그리기 (안개로 가림)
    renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 1) * 0.75);
    camera.far = high ? 5000 : 950; camera.updateProjectionMatrix();
    if (game) { game.scene.fog.near = high ? 320 : 180; game.scene.fog.far = high ? 1700 : 900; game.sky.scale.setScalar(high ? 1 : 0.25); } // 하늘 구도 그리는 거리 안으로
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = high;
    if (high && THREE.EffectComposer && !composer) {
      composer = new THREE.EffectComposer(renderer);
      renderPass = new THREE.RenderPass(new THREE.Scene(), camera); composer.addPass(renderPass);
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.45, 0.93); composer.addPass(bloomPass);
      gradePass = new THREE.ShaderPass(GradeShader); composer.addPass(gradePass);
      fxaaPass = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaaPass);
    }
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
      const pr = renderer.getPixelRatio();
      fxaaPass.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
    }
    if (game) game.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); // 그림자 켜고 끈 것 반영
  }
  function draw(scene, cam, speed = 0) {
    if (settings.quality === 'high' && composer) {
      renderPass.scene = scene; renderPass.camera = cam; gradePass.uniforms.speed.value = speed;
      composer.render();
    } else renderer.render(scene, cam);
  }
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    applyQuality();
  });

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function drawLabel(canvas, text, bg, fg) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, b = Math.round(h * 0.07);
    ctx.fillStyle = '#1d2b53'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = bg; ctx.fillRect(b, b, w - 2 * b, h - 2 * b);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = Math.round(h * 0.68);
    ctx.font = `${size}px ${FONT}`;
    while (ctx.measureText(text).width > w - 6 * b && size > 16) { size -= 4; ctx.font = `${size}px ${FONT}`; }
    ctx.fillText(text, w / 2, h / 2 + h * 0.04);
  }
  function labelMesh(w, h, cw, ch, text, bg, fg) {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    drawLabel(c, text, bg, fg);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    m.userData = { canvas: c, tex, bg, fg };
    return m;
  }
  function relabel(m, text) { drawLabel(m.userData.canvas, text, m.userData.bg, m.userData.fg); m.userData.tex.needsUpdate = true; }

  function makeSky(top, bottom) {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.8 + 0.04, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0); }',
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3500, 24, 16), mat);
    sky.renderOrder = -1;
    return sky;
  }

  // ---------- 파티클 (스프라이트 풀) ----------
  const SOFT = canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  const Particles = {
    pool: [], next: 0,
    init(scene) {
      this.pool = []; this.next = 0;
      for (let i = 0; i < 360; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, transparent: true, depthWrite: false }));
        s.visible = false; scene.add(s);
        this.pool.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), grow: 0, grav: 0, size: 1, alpha: 1 });
      }
    },
    emit(pos, o) {
      const p = this.pool[this.next]; this.next = (this.next + 1) % this.pool.length;
      p.s.position.copy(pos); p.s.visible = true;
      p.s.material.color.setHex(o.color); p.s.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
      p.vel.set(o.vx || 0, o.vy || 0, o.vz || 0);
      p.life = p.max = o.life || 0.5; p.size = o.size || 0.5; p.grow = o.grow || 0; p.grav = o.grav || 0; p.alpha = o.alpha || 1;
      p.s.scale.setScalar(p.size);
    },
    burst(pos, n, color, speed, o = {}) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, u = Math.random();
        this.emit(pos, Object.assign({ color, vx: Math.cos(a) * speed * (0.4 + u), vy: speed * (0.3 + Math.random()), vz: Math.sin(a) * speed * (0.4 + u),
          life: 0.5 + Math.random() * 0.4, size: 0.5, grav: 14, add: true }, o));
      }
    },
    update(dt) {
      for (const p of this.pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.s.visible = false; continue; }
        p.vel.y -= p.grav * dt;
        p.s.position.addScaledVector(p.vel, dt);
        p.size += p.grow * dt; p.s.scale.setScalar(p.size);
        p.s.material.opacity = p.alpha * Math.min(1, (p.life / p.max) * 2);
      }
    },
  };

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

  // ---------- 게임 시작 ----------
  let game = null;

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
      item: null, rolling: 0, rollTick: 0, combo: 0, finished: false, finishTime: 0, rank: 5, gasAt: -99 };
    const others = SPECIES_KEYS.filter((s) => s !== settings.species);
    const grid = [[44, -9], [44, 9], [26, -9], [26, 9]];
    const ais = grid.slice(0, AI_COUNT).map(([i, lat], k) => {
      const kart = M.makeKart(others[k]); scene.add(kart.root);
      return { kart, species: others[k], name: M.SPECIES[others[k]].name, color: M.SPECIES[others[k]].kart, d: i * T.segLen, idx: i, lat, latT: lat, latV: 0, speed: 0,
        base: (33 + k * 1.1 + Math.random() * 2) * DIFF.speed, skill: DIFF.skill + Math.random() * 0.12, itemT: 0,
        boost: 0, slow: 0, spin: 0, banana: 12 + Math.random() * 14, finished: false, finishTime: 0,
        roll: 0, bodyYaw: 0, wheel: 0, planGate: null, planLane: -1, pos: new THREE.Vector3(), y: T.pos[i].y, vy: 0, gy: T.pos[i].y, padCd: 0 };
    });

    game = { scene, sky, sun, T, A, deco, gates, boxes, p, ais, bananas: [], t: -3.5, state: 'intro', introT: 0, paused: false, lastRank: 5, lastLap: 0, wrongT: 0, fps: [], def, bank: loadBank(),
      stats: { total: 0, correct: 0, wrong: [] }, nextGate: null, endTimer: 0, lastCount: 99, camYaw: p.h, camY: p.y, qx: null, qy: null,
      minimap: buildMinimap(T) };

    $('menu').classList.add('hidden'); $('result').classList.add('hidden');
    $('hud').classList.remove('hidden'); $('touch').classList.toggle('hidden', !touchMode);
    $('question').classList.add('hidden'); $('item').textContent = '-'; $('countdown').textContent = '';
    $('intro').classList.remove('hidden'); $('intro-name').textContent = def.name;
    $('intro-sub').textContent = `${LAPS}바퀴 · 문제 ${def.gates.length * LAPS}개`;
    $('lights').classList.add('hidden'); $('lights').className = 'hidden'; $('banner').className = ''; $('wrongway').classList.add('hidden');
    applyQuality();
    if (bloomPass) bloomPass.strength = def.theme === 'desert' ? 0.1 : 0.22; // 밝은 모래 지평선이 하얗게 번지지 않게
    if (window.Music) Music.play(def.theme);
    updateKartMeshes();
    camera.position.set(p.pos.x - Math.sin(p.h) * 9, p.y + 3.6, p.pos.z - Math.cos(p.h) * 9);
    camera.lookAt(p.pos.x, p.y + 1.4, p.pos.z);
  }

  // ---------- 미니맵 ----------
  function buildMinimap(T) {
    const cv = $('minimap'), W = cv.width, pad = 12, b = T.box;
    const s = (W - 2 * pad) / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    const ox = (W - (b.max.x - b.min.x) * s) / 2, oz = (W - (b.max.z - b.min.z) * s) / 2;
    // 위에서 내려다본 지도 (x 오른쪽, z 아래쪽 = 거울상 아님)
    const map = (v) => [ox + (v.x - b.min.x) * s, oz + (v.z - b.min.z) * s];
    const bg = document.createElement('canvas'); bg.width = bg.height = W;
    const c = bg.getContext('2d');
    c.lineJoin = 'round';
    const path = () => { c.beginPath(); T.pos.forEach((v, i) => { const [x, y] = map(v); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); };
    path(); c.strokeStyle = '#1d2b53'; c.lineWidth = 11; c.stroke();
    path(); c.strokeStyle = '#fffdf5'; c.lineWidth = 6; c.stroke();
    return { bg, map, ctx: cv.getContext('2d'), W };
  }
  function drawMinimap() {
    const { bg, map, ctx, W } = game.minimap;
    ctx.clearRect(0, 0, W, W); ctx.drawImage(bg, 0, 0);
    for (const g of game.gates) {
      const [x, y] = map(game.T.pos[g.i]); ctx.fillStyle = g === game.nextGate ? '#ff7043' : '#ffd84d';
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
    const dot = (v, color, r) => {
      const [x, y] = map(v); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#1d2b53'; ctx.stroke();
    };
    for (const a of game.ais) dot(a.pos, '#' + a.color.toString(16).padStart(6, '0'), 5);
    dot(game.p.pos, '#ffffff', 7);
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

  function useItem() {
    if (!game || game.state !== 'race') return;
    const p = game.p;
    if (!p.item || p.rolling > 0 || p.finished) return;
    if (p.item === 'boost') { p.boost = Math.max(p.boost, 2); flash('부스터! 🚀', 'info'); Sound.sfx.boost(); }
    else dropBanana(kartPoint(p.kart, 0, 0, -3.2), 'player');
    p.item = null; $('item').textContent = '-';
  }
  function dropBanana(at, owner) {
    const m = M.makeBanana(); m.position.copy(at);
    const i = nearest(game.T, at, owner === 'player' ? game.p.idx : owner.idx);
    m.position.y = groundY(game.T, game.A, i, 0);
    game.scene.add(m); game.bananas.push({ mesh: m, owner, age: 0 });
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
      best.q = Questions.next(settings.subject, settings.level, game.bank);
      best.panels.forEach((m, k) => relabel(m, best.q.choices[k]));
      relabel(best.banner, best.q.prompt);
      if (best.q.speak) speak(best.q.speak);
    }
    $('q-prompt').textContent = best.q.prompt;
    $('q-speak').classList.toggle('hidden', !best.q.speak);
    document.querySelectorAll('.choice').forEach((el, k) => { el.textContent = best.q.choices[k]; });
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
      s.wrong.push({ prompt: q.prompt, answer: answerText, chosen: q.choices[lane], lat: Math.round(p.lat), want: q.answer });
      if (bankIdx < 0) game.bank.push(q);
    }
    if (q.speakAfter) speak(q.speakAfter);
    saveBank(game.bank);
    g.q = null;
    g.panels.forEach((m) => relabel(m, '?'));
    relabel(g.banner, '?');
    game.nextGate = null;
  }

  // ---------- 플레이어 물리 ----------
  function endDrift(withBoost) {
    const p = game.p, d = p.drift;
    if (withBoost && d.charge >= 0.75) game.stats.drifts = (game.stats.drifts || 0) + 1;
    if (withBoost && d.charge >= 1.6) { p.boost = Math.max(p.boost, 1.3); flash('슈퍼 드리프트 부스터!', 'info'); Sound.sfx.boost(); }
    else if (withBoost && d.charge >= 0.75) { p.boost = Math.max(p.boost, 0.7); Sound.sfx.boost(); }
    d.on = false; d.charge = 0;
  }

  function updatePlayer(dt) {
    const { p, T, A } = game;
    const racing = game.state === 'race' && !p.finished;
    const ctrl = racing && p.spin <= 0;
    const onGround = p.air < 0.05;
    const steerIn = ctrl ? (keys.left ? 1 : 0) - (keys.right ? 1 : 0) : 0;
    const gas = ctrl && (keys.up || touchMode);
    const brake = ctrl && keys.down;
    // 핸들 입력은 즉시 반응, 대신 최대로 꺾이는 정도를 낮춤
    p.steer = approach(p.steer, steerIn, dt * (steerIn === 0 ? 12 : 9));
    p.boost = Math.max(0, p.boost - dt); p.slow = Math.max(0, p.slow - dt); p.hopCd = Math.max(0, p.hopCd - dt);
    p.padCd = Math.max(0, p.padCd - dt); p.wet = Math.max(0, p.wet - dt);

    const fx = Math.sin(p.h), fz = Math.cos(p.h), rx = -fz, rz = fx;
    let vF = p.vel.x * fx + p.vel.z * fz, vR = p.vel.x * rx + p.vel.z * rz;
    const offroad = onGround && Math.abs(p.lat) > HW + 0.8;
    const max = MAX_SPEED * (p.boost > 0 ? BOOST_MUL : 1) * (p.slow > 0 ? 0.6 : 1) * (offroad && p.boost <= 0 ? 0.6 : 1) * (p.wet > 0 ? 0.85 : 1);
    if (onGround) {
      if (p.boost > 0) vF = Math.min(max, vF + 55 * dt);
      else if (gas) vF += 17 * Math.max(0.1, 1 - vF / max) * dt; // 빠를수록 가속이 줄어듦
      if (brake) vF = vF > 0 ? Math.max(0, vF - 32 * dt) : Math.max(-10, vF - 10 * dt);
      if (!gas && !brake && p.boost <= 0) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 5 * dt);
      if (vF > max) vF = Math.max(max, vF - 18 * dt);
      vF -= T.slope[p.idx] * G * 0.35 * dt; // 오르막은 느려지고 내리막은 빨라짐
    }
    if (p.spin > 0) { p.spin -= dt; p.spinA += dt * 12.5; vF *= Math.exp(-2.4 * dt); vR *= Math.exp(-2 * dt); } else p.spinA = 0;

    // 드리프트: Shift + 방향키, 깡충 뛰고 미끄러지며 충전, 떼면 부스터
    const d = p.drift;
    if (!d.on && ctrl && keys.drift && steerIn !== 0 && vF > 15 && onGround && p.hopCd === 0) {
      d.on = true; d.dir = steerIn; d.charge = 0; p.vy = 5; p.hopCd = 0.4; Sound.sfx.hop();
    }
    if (d.on) {
      if (!ctrl || vF < 10) endDrift(false);
      else if (!keys.drift) endDrift(true);
      else if (onGround) { d.charge += dt * (p.steer * d.dir > 0.3 ? 1.3 : 0.8); vF -= 1.2 * dt; }
    }
    // 공중 트릭: 점프대·언덕에서 뜬 상태로 Shift → 착지할 때 부스터
    if (pressed.drift && !onGround && p.canTrick && !p.tricked && ctrl) {
      p.tricked = true; p.trick = 0.45; Sound.sfx.trick(); flash('트릭!', 'info');
    }
    vR *= Math.exp(-(d.on ? 2.0 : onGround ? 9 : 1) * dt); // 옆미끄러짐을 잡아주는 접지력

    const sr = clamp(vF / MAX_SPEED, 0, 1);
    // 멈춰 있어도 가속/브레이크를 누르면 제자리에서 돌 수 있게 (벽에 막혔을 때 빠져나오기)
    const turnF = Math.max(clamp(Math.abs(vF) / 8, 0, 1), gas || brake ? 0.5 : 0) * (1 - 0.2 * sr) * (onGround ? 1 : 0.5);
    let target = p.steer * 1.25 * turnF * (vF < 0 ? -1 : 1);
    if (d.on) target = d.dir * (0.85 + 0.45 * p.steer * d.dir) * turnF * 1.15;
    if (p.spin > 0) target = 0;
    p.yawRate = damp(p.yawRate, target, 12, dt);
    // 속도는 이전 방향 기준으로 다시 만들고 차 방향만 돌림 → 다음 프레임에 옆미끄러짐 발생
    p.vel.set(fx * vF + rx * vR, 0, fz * vF + rz * vR);
    p.h += p.yawRate * dt;
    p.pos.addScaledVector(p.vel, dt);
    p.vF = vF;

    // 트랙 위치와 벽
    const prev = p.idx;
    p.idx = nearest(T, p.pos, p.idx);
    const c = T.pos[p.idx], rv = T.right[p.idx];
    const fwdOff = (p.pos.x - c.x) * rv.z - (p.pos.z - c.z) * rv.x; // 샘플 앞뒤 어긋남 (진행 방향 = (right.z, -right.x))
    p.idxF = (p.idx + clamp(fwdOff / T.segLen, -0.5, 0.5) + N) % N;
    p.lat = (p.pos.x - c.x) * rv.x + (p.pos.z - c.z) * rv.z;
    const lim = EDGE - 1.4;
    if (Math.abs(p.lat) > lim) {
      const s = Math.sign(p.lat);
      p.pos.addScaledVector(rv, s * lim - p.lat); p.lat = s * lim;
      const vn = (p.vel.x * rv.x + p.vel.z * rv.z) * s;
      if (vn > 0) {
        p.vel.x -= rv.x * s * vn * 1.35; p.vel.z -= rv.z * s * vn * 1.35;
        if (vn > 4) {
          p.vel.multiplyScalar(0.82); p.shake = Math.min(1, vn / 14);
          Sound.sfx.hit(); game.stats.walls = (game.stats.walls || 0) + 1;
          Particles.burst(kartPoint(p.kart, s < 0 ? 1.3 : -1.3, 0.6, 0.8), 14, 0xffc04d, 7);
          if (d.on) endDrift(false);
        }
      }
      p.vel.multiplyScalar(Math.exp(-0.9 * dt));
    }

    // 구조: 가속 중인데 2.5초 넘게 거의 못 움직이면 도로 가운데 쪽으로 방향을 바로잡아 줌
    p.stuckT = gas && Math.abs(vF) < 3 ? (p.stuckT || 0) + dt : 0;
    if (p.stuckT > 2.5) {
      p.stuckT = 0; p.h = T.head[p.idx]; p.yawRate = 0; p.vel.set(0, 0, 0);
      p.pos.addScaledVector(rv, -p.lat * 0.6); p.lat *= 0.4;
      flash('다시 출발! 🚩', 'info'); Sound.sfx.hop();
    }

    // 높이: 점프대 끝에서 위로 튕겨줌
    for (const r of A.ramps) {
      if (onGround && crossed(prev, p.idx, r.i1) && Math.abs(p.lat - r.lat) < r.w / 2 && vF > 8) {
        p.vy = 8 + r.h * 2 + vF * 0.08; p.canTrick = true; Sound.sfx.jump();
      }
    }
    const impact = vertical(p, groundY(T, A, p.idxF, p.lat), dt);
    p.air = p.y - p.gy;
    if (p.air > 0.05) { p.airT += dt; if (p.airT > 0.35) p.canTrick = true; }
    if (impact) {
      if (p.airT > 0.3) {
        p.land = 0.18; Sound.sfx.land(); p.shake = Math.max(p.shake, Math.min(0.6, impact / 25));
        Particles.burst(kartPoint(p.kart, 0, 0.3, 0), 10, 0xd9c7a0, 4, { add: false, grav: 2, size: 1, grow: 2, alpha: 0.6 });
      }
      if (p.tricked) { p.boost = Math.max(p.boost, 1.0); flash('트릭 부스터! 🚀', 'info'); Sound.sfx.boost(); }
      p.airT = 0; p.canTrick = false; p.tricked = false;
    }
    p.trick = Math.max(0, p.trick - dt);

    // 부스터 발판, 개울
    for (const pd of A.pads) {
      if (onGround && p.padCd === 0 && inRange(p.idx, pd.i0 - 4, 8) && Math.abs(p.lat - pd.lat) < 5) {
        p.boost = Math.max(p.boost, 1.1); p.padCd = 0.6; Sound.sfx.boost();
      }
    }
    if (A.river && onGround && inRange(p.idx, A.river.i0 - A.river.n, 2 * A.river.n)) {
      if (p.wet <= 0) Sound.sfx.splash();
      p.wet = 0.3;
      for (let k = 0; k < 3; k++) Particles.emit(kartPoint(p.kart, (Math.random() - 0.5) * 3, 0.3, -1), { color: 0xcfefff, vx: (Math.random() - 0.5) * 10, vy: 5 + Math.random() * 5, vz: (Math.random() - 0.5) * 10, life: 0.6, size: 0.7, grav: 22, alpha: 0.9 });
    }

    const dl = p.idx - prev;
    if (dl < -N / 2) p.laps++;
    else if (dl > N / 2) p.laps--;
    for (const g of game.gates) if (crossed(prev, p.idx, g.i)) onPlayerGate(g);

    // 차체 움직임: 기울기, 들림, 미끄러지는 각도
    const accel = (vF - p.prevVF) / Math.max(dt, 1e-4); p.prevVF = vF;
    p.roll = damp(p.roll, clamp(p.yawRate * vF * 0.004, -0.12, 0.12), 8, dt);
    p.pitch = damp(p.pitch, clamp(-accel * 0.003, -0.07, 0.06), 6, dt);
    const slopeTarget = p.air > 0.3 ? -Math.atan(p.vy / Math.max(10, vF)) * 0.6 : -Math.atan(T.slope[p.idx]);
    p.slopeP = damp(p.slopeP, slopeTarget, 10, dt);
    const slip = clamp(Math.atan2(vR, Math.max(6, Math.abs(vF))), -0.35, 0.35);
    p.bodyYaw = damp(p.bodyYaw, d.on ? d.dir * 0.42 : -slip * 0.8, 9, dt);
    p.wheel += (vF * dt) / 0.55;
    p.land = Math.max(0, p.land - dt);
    p.shake *= Math.exp(-6 * dt);

    if (!p.finished && p.laps >= LAPS) {
      p.finished = true; p.finishTime = game.t;
      p.rank = 1 + game.ais.filter((a) => a.finished).length;
      game.endTimer = 3;
      flash('골인! 🏁', 'info'); Sound.sfx.finish();
      for (let k = 0; k < 4; k++) Particles.burst(kartPoint(p.kart, 0, 3, 0), 20, [0xff6fa8, 0xffd84d, 0x4fc3ff, 0x7dff8a][k], 12);
      $('question').classList.add('hidden');
      if (d.on) endDrift(false);
    }
    if (!p.finished && game.state === 'race') updateNextGate();
  }

  function playerEffects() {
    const p = game.p, k = p.kart, d = p.drift;
    if (d.on && p.air < 0.05) {
      const col = d.charge >= 1.6 ? 0xff8a1c : d.charge >= 0.75 ? 0x3fa9ff : 0xe8f0ff;
      for (const x of [-1.24, 1.24]) {
        const at = kartPoint(k, x, 0.15, -1.5);
        Particles.emit(at, { color: col, vx: p.vel.x * 0.7 + (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 3, vz: p.vel.z * 0.7 + (Math.random() - 0.5) * 6, life: 0.25, size: d.charge >= 0.75 ? 0.55 : 0.35, grav: 12, add: true });
      }
      if (Math.random() < 0.5) Particles.emit(kartPoint(k, d.dir * 1.2, 0.3, -1.4), { color: 0xdddddd, vy: 1, life: 0.7, size: 0.8, grow: 2.5, alpha: 0.5 });
    }
    if (p.boost > 0) {
      // 차 속도를 대부분 물려받아 불꽃이 배기구 가까이 머물게 함
      for (const x of [-0.32, 0.32]) Particles.emit(kartPoint(k, x, 0.8, -2.7), { color: Math.random() < 0.5 ? 0xff9f1c : 0xffe066, vx: p.vel.x * 0.85, vy: 0.5, vz: p.vel.z * 0.85, life: 0.18, size: 0.6, grow: -2, add: true });
    }
    if (p.spin > 0 && Math.random() < 0.5) Particles.emit(kartPoint(k, 0, 2.6, 0), { color: 0xffe135, vy: 3, life: 0.5, size: 0.4, add: true });
    if (Math.abs(p.lat) > HW + 0.8 && p.air < 0.05 && Math.abs(p.vF) > 10 && Math.random() < 0.6) {
      Particles.emit(kartPoint(k, 0, 0.3, -1.6), { color: 0xc8a46a, vy: 1.5, life: 0.6, size: 0.9, grow: 2, alpha: 0.6 });
    }
  }

  // ---------- 컴퓨터 ----------
  function updateAIs(dt) {
    const { ais, T, A, p } = game;
    const pt = playerTotal(), racing = game.state === 'race';
    for (const a of ais) {
      a.boost = Math.max(0, a.boost - dt); a.slow = Math.max(0, a.slow - dt); a.padCd = Math.max(0, a.padCd - dt);
      if (a.spin > 0) a.spin -= dt;
      let target = racing ? a.base * (a.boost > 0 ? 1.35 : 1) * (a.slow > 0 ? 0.6 : 1) * (a.spin > 0 ? 0.25 : 1) : 0;
      const gap = aiTotal(a) - pt; // 고무줄: 격차가 크면 조금 조절
      if (!p.finished) { if (gap > 160) target *= 0.88; else if (gap < -160) target *= 1.12; }
      a.speed = approach(a.speed, target, (target > a.speed ? 10 : 25) * dt);
      const prev = a.idx;
      a.d += a.speed * dt;
      const f = (a.d / T.segLen) % N;
      a.idx = Math.floor(f);
      // 다가오는 문의 문제가 보이면 정답(또는 실수로 오답) 차선으로 이동
      const [g, dist] = nextGateFrom(a.idx);
      if (g && dist < 110 && a.planGate !== g) {
        a.planGate = g;
        if (g.q) {
          a.planLane = Math.random() < a.skill ? g.q.answer : (g.q.answer + 1 + Math.floor(Math.random() * 2)) % 3;
          a.latT = [-LANE, 0, LANE][a.planLane];
        } else a.planLane = -1;
      }
      for (const gg of game.gates) {
        if (!crossed(prev, a.idx, gg.i)) continue;
        const ok = gg.q && a.planGate === gg && a.planLane >= 0 ? laneOf(a.lat) === gg.q.answer : Math.random() < a.skill;
        if (ok) a.boost = 1.3; else a.slow = 1.0;
        a.planGate = null; a.latT = (Math.random() * 2 - 1) * 12;
      }
      for (const pd of A.pads) if (a.padCd === 0 && inRange(a.idx, pd.i0 - 4, 8) && Math.abs(a.lat - pd.lat) < 5) { a.boost = Math.max(a.boost, 1.0); a.padCd = 0.6; }
      for (const r of A.ramps) if (crossed(prev, a.idx, r.i1) && Math.abs(a.lat - r.lat) < r.w / 2) a.vy = 8 + r.h * 2 + a.speed * 0.08;
      a.latV = damp(a.latV, (a.latT - a.lat) * 1.4, 3.5, dt);
      a.lat = clamp(a.lat + a.latV * dt, -(HW - 1.5), HW - 1.5);
      if (racing && a.item && (a.itemT -= dt) <= 0) { // 컴퓨터도 주운 아이템을 씀
        if (a.item === 'boost') a.boost = Math.max(a.boost, 1.6); else dropBanana(kartPoint(a.kart, 0, 0, -3.2), a);
        a.item = null;
      }
      if (racing) {
        a.banana -= dt;
        if (a.banana <= 0) { a.banana = 14 + Math.random() * 16; dropBanana(kartPoint(a.kart, 0, 0, -3.2), a); }
      }
      if (!a.finished && aiTotal(a) >= LAPS * N) { a.finished = true; a.finishTime = game.t; }

      // 위치 계산
      const i0 = Math.floor(f) % N, i1 = (i0 + 1) % N;
      a.pos.lerpVectors(T.pos[i0], T.pos[i1], f - Math.floor(f)).addScaledVector(T.right[i0], a.lat);
      vertical(a, groundY(T, A, f, a.lat), dt);
      a.pos.y = a.y;
      const curv = T.curv[i0], drifting = Math.abs(curv) > 0.22 && a.speed > 26 && a.spin <= 0 && a.y - a.gy < 0.1;
      a.bodyYaw = damp(a.bodyYaw, drifting ? Math.sign(curv) * 0.36 : 0, 5, dt);
      a.roll = damp(a.roll, clamp(curv * a.speed * 0.012, -0.12, 0.12), 6, dt);
      a.wheel += (a.speed * dt) / 0.55;
      if (drifting && Math.random() < 0.6) {
        Particles.emit(kartPoint(a.kart, Math.sign(curv) * 1.2, 0.2, -1.5), { color: 0x9fd0ff, vx: (Math.random() - 0.5) * 5, vy: 2.5, vz: (Math.random() - 0.5) * 5, life: 0.22, size: 0.4, grav: 12, add: true });
      }
      if (A.river && inRange(a.idx, A.river.i0 - A.river.n, 2 * A.river.n) && Math.random() < 0.7) {
        Particles.emit(a.pos.clone().setY(a.y + 0.3), { color: 0xcfefff, vx: (Math.random() - 0.5) * 9, vy: 5 + Math.random() * 4, vz: (Math.random() - 0.5) * 9, life: 0.5, size: 0.6, grav: 22 });
      }

      // 플레이어와 부딪힘: 서로 밀어냄 (높이가 비슷할 때만)
      const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z, dd = Math.hypot(dx, dz);
      if (dd < 3 && dd > 0.01 && Math.abs(p.y - a.y) < 2.5) {
        const nx = dx / dd, nz = dz / dd, over = 3 - dd;
        p.pos.x += nx * over * 0.7; p.pos.z += nz * over * 0.7;
        const t = T.right[i0];
        const avx = t.z * a.speed, avz = -t.x * a.speed; // 진행 방향 = (right.z, -right.x)
        const vrel = (p.vel.x - avx) * nx + (p.vel.z - avz) * nz;
        if (vrel < 0) {
          p.vel.x -= nx * vrel * 1.2; p.vel.z -= nz * vrel * 1.2;
          a.latV -= (nx * t.x + nz * t.z) * -vrel * 0.6;
          if (-vrel > 4) { Sound.sfx.bump(); p.shake = Math.max(p.shake, 0.3); }
        }
      }
    }
  }

  // 길을 가로지르는 양떼 / 굴러오는 바위
  function updateMovers(dt) {
    const { A, T, p, ais } = game;
    for (const m of A.movers) {
      m.cd = Math.max(0, m.cd - dt);
      const ph = game.t * m.w + m.ph, lat = Math.sin(ph) * m.amp, vlat = Math.cos(ph);
      m.pos.copy(roadPoint(T, m.i, lat));
      m.mesh.position.copy(m.pos);
      if (m.kind === 'sheep') {
        m.mesh.position.y += Math.abs(Math.sin(game.t * 9 + m.ph)) * 0.3;
        m.mesh.rotation.y = T.head[m.i] + (vlat > 0 ? -Math.PI / 2 : Math.PI / 2);
        m.mesh.userData.legs.forEach((l, k) => { l.rotation.x = Math.sin(game.t * 12 + k * Math.PI) * 0.5; });
      } else {
        m.mesh.position.y += 2.3;
        m.mesh.rotation.y = T.head[m.i];
        m.mesh.rotation.z -= vlat * m.w * m.amp * dt / 2.3; // 굴러가는 회전
      }
      const dx = p.pos.x - m.pos.x, dz = p.pos.z - m.pos.z, dd = Math.hypot(dx, dz);
      if (dd < 3.4 && m.cd === 0 && p.air < 1.5) {
        m.cd = 1; p.vel.multiplyScalar(0.3); p.vel.x += (dx / dd) * 6; p.vel.z += (dz / dd) * 6; p.slow = Math.max(p.slow, 0.8);
        p.shake = 0.7; Sound.sfx.bump(); flash(m.kind === 'sheep' ? '음매~ 🐑' : '쿵! 🪨', 'bad');
        if (m.kind === 'sheep') Sound.sfx.baa();
        if (p.drift.on) endDrift(false);
      }
      for (const a of ais) if (Math.hypot(a.pos.x - m.pos.x, a.pos.z - m.pos.z) < 3.4 && a.slow <= 0) { a.slow = 0.8; a.latV += Math.sign(a.lat - lat || 1) * 8; }
    }
  }

  function poseKart(k, x, y, z, yaw, slopeP, roll, pitch, steer, wheel, bounce, trickA) {
    k.root.position.set(x, y, z); k.root.rotation.set(slopeP, yaw, 0, 'YXZ');
    k.body.rotation.set(pitch, trickA, roll); k.body.position.y = bounce;
    for (const fw of k.wheels.front) fw.rotation.y = steer * 0.45;
    for (const w of k.wheels.all) w.rotation.x = wheel;
    k.steer.rotation.z = -steer * 1.3;
    k.head.rotation.z = -roll * 1.6 - steer * 0.12;
  }

  function updateKartMeshes() {
    const { p, ais, T } = game;
    const sr = clamp(p.vF / MAX_SPEED, 0, 1.4);
    const bounce = Math.sin(game.t * 31) * 0.025 * sr - (p.land > 0 ? Math.sin((p.land / 0.18) * Math.PI) * 0.15 : 0);
    const trickA = p.trick > 0 ? (1 - p.trick / 0.45) * Math.PI * 2 : 0;
    poseKart(p.kart, p.pos.x, p.y, p.pos.z, p.h + p.bodyYaw + p.spinA, p.slopeP, p.roll, p.pitch,
      p.drift.on ? -p.drift.dir * 0.3 + p.steer * 0.3 : p.steer, p.wheel, bounce, trickA);
    p.kart.flames.forEach((f) => { f.visible = p.boost > 0; f.scale.set(1, 1, 0.8 + Math.random() * 0.6); });
    p.kart.root.updateMatrixWorld();
    for (const a of ais) {
      const i0 = Math.floor((a.d / T.segLen) % N) % N;
      const spin = a.spin > 0 ? a.spin * 12.5 : 0;
      const air = a.y - a.gy;
      poseKart(a.kart, a.pos.x, a.y, a.pos.z, T.head[i0] + a.latV * 0.03 + a.bodyYaw + spin,
        air > 0.3 ? -Math.atan(a.vy / Math.max(10, a.speed)) * 0.6 : -Math.atan(T.slope[i0]), a.roll, 0,
        clamp(T.curv[i0] * 2.2, -1, 1), a.wheel, Math.sin(game.t * 29 + a.d) * 0.02, 0);
      a.kart.flames.forEach((f) => { f.visible = a.boost > 0; });
      a.kart.root.updateMatrixWorld();
    }
  }

  function updateWorld(dt) {
    const { p, ais, boxes, bananas, scene, deco } = game;
    for (const b of boxes) {
      b.mesh.rotation.y += dt * 1.4; b.mesh.rotation.x += dt * 0.6;
      b.mesh.position.y = b.baseY + Math.sin(game.t * 2.5 + b.phase) * 0.35;
      if (b.respawn > 0) { b.respawn -= dt; b.mesh.visible = b.respawn <= 0; continue; }
      if (b.mesh.position.distanceTo(tmpV.set(p.pos.x, p.y + 1.6, p.pos.z)) < 3) {
        b.respawn = 4; b.mesh.visible = false;
        Particles.burst(b.mesh.position, 16, [0xff6fa8, 0xffd84d, 0x4fc3ff][Math.floor(Math.random() * 3)], 8);
        if (!p.item && !p.finished && p.rolling <= 0) { p.rolling = 1.0; $('item').classList.add('rolling'); }
      }
      for (const a of ais) if (b.mesh.visible && b.mesh.position.distanceTo(tmpV.set(a.pos.x, a.y + 1.6, a.pos.z)) < 3) {
        b.respawn = 4; b.mesh.visible = false;
        if (!a.item) { a.item = Math.random() < 0.6 ? 'boost' : 'banana'; a.itemT = 1 + Math.random() * 3; }
      }
    }
    if (p.rolling > 0) {
      p.rolling -= dt; p.rollTick -= dt;
      if (p.rollTick <= 0) { p.rollTick = 0.07; $('item').textContent = Math.random() < 0.5 ? '🚀' : '🍌'; Sound.sfx.roll(); }
      if (p.rolling <= 0) {
        p.item = Math.random() < 0.5 ? 'boost' : 'banana';
        $('item').textContent = ITEM_ICON[p.item]; $('item').classList.remove('rolling'); Sound.sfx.item();
      }
    }
    for (let k = bananas.length - 1; k >= 0; k--) {
      const b = bananas[k]; b.age += dt; b.mesh.rotation.y += dt * 1.5;
      let hit = false;
      const bp = b.mesh.position;
      if (!(b.owner === 'player' && b.age < 1.5) && Math.hypot(bp.x - p.pos.x, bp.z - p.pos.z) < 2.4 && Math.abs(bp.y - p.y) < 1.2) {
        p.spin = 1.1; flash('미끄덩! 🍌', 'bad'); hit = true; Sound.sfx.spin(); game.stats.spins = (game.stats.spins || 0) + 1;
        if (p.drift.on) endDrift(false);
      }
      for (const a of ais) {
        if (hit || (b.owner === a && b.age < 1.5)) continue;
        if (Math.hypot(bp.x - a.pos.x, bp.z - a.pos.z) < 2.4 && Math.abs(bp.y - a.y) < 1.2) { a.spin = 1.0; hit = true; }
      }
      if (hit || b.age > 45) { scene.remove(b.mesh); bananas.splice(k, 1); }
    }
    for (const o of scene.children) if (o.userData.cloud) o.position.x += dt * 2;
    for (const bl of deco.balloons) { bl.position.y = bl.userData.baseY + Math.sin(game.t * 0.4 + bl.userData.phase) * 6; bl.rotation.y += dt * 0.1; }
    for (const r of deco.spinners) r.rotation.z += dt * 0.8;
    updateMovers(dt);
    Particles.update(dt);
  }

  const INTRO = 3.2;
  function updateCamera(dt) {
    const p = game.p, sr = clamp(p.vF / MAX_SPEED, 0, 1.4);
    if (game.state === 'intro') {
      // 출발 전: 출발선 위 하늘에서 크게 돌며 차 뒤로 내려옴
      const k = clamp(game.introT / INTRO, 0, 1), e = k * k * (3 - 2 * k);
      const ang = p.h + Math.PI * 1.3 * (1 - e), r = lerp(80, 8.5, e), h = lerp(45, 3.7, e);
      camera.position.set(p.pos.x - Math.sin(ang) * r, p.y + h, p.pos.z - Math.cos(ang) * r);
      camera.lookAt(p.pos.x, p.y + 1.5, p.pos.z);
      game.camYaw = p.h; game.camY = p.y;
    } else if (p.finished) {
      // 골인 후: 차 주위를 천천히 돌며 축하
      game.finA = (game.finA || 0) + dt * 0.6;
      const a = p.h + Math.PI + game.finA;
      camera.position.lerp(tmpV.set(p.pos.x - Math.sin(a) * 9, p.y + 3.2, p.pos.z - Math.cos(a) * 9), 1 - Math.exp(-4 * dt));
      camera.lookAt(p.pos.x, p.y + 1.6, p.pos.z);
    } else {
      // 카메라는 차 방향을 빠르게 따라가서 화면이 휙휙 돌지 않게 함
      game.camYaw += wrapAngle(p.h + p.bodyYaw * 0.3 - game.camYaw) * (1 - Math.exp(-7 * dt));
      game.camY = damp(game.camY, p.y, p.air > 0.3 ? 3 : 10, dt);
      const dist = 7.4 + sr * 1.3, height = 3.6 + sr * 0.3;
      const want = tmpV.set(p.pos.x - Math.sin(game.camYaw) * dist, game.camY + height, p.pos.z - Math.cos(game.camYaw) * dist);
      camera.position.lerp(want, 1 - Math.exp(-14 * dt));
      const sh = p.shake * 0.45;
      camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh;
      camera.lookAt(p.pos.x + Math.sin(game.camYaw) * 6, game.camY + 1.5 + (p.y - game.camY) * 0.5, p.pos.z + Math.cos(game.camYaw) * 6);
    }
    const fov = 62 + sr * 6 + (p.boost > 0 ? 6 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); }
    game.sky.position.copy(camera.position);
    game.sun.position.copy(p.pos).addScaledVector(SUN_DIR, 220); game.sun.target.position.copy(p.pos);
    game.deco.sunSprite.position.copy(camera.position).addScaledVector(SUN_DIR, 3000);
    const racingView = game.state === 'race' && !p.finished;
    game.blur = racingView ? (p.boost > 0 ? 1 : clamp((sr - 0.9) * 3, 0, 0.5)) : 0;
    const sl = $('speedlines');
    const slo = racingView ? (p.boost > 0 ? 0.85 : clamp((sr - 0.9) * 2.5, 0, 0.3)) : 0;
    setStyle('speedlines', 'opacity', String(Math.round(slo * 20) / 20));
    if (slo > 0) sl.style.transform = `rotate(${Math.random() * 6}deg)`;
    Sound.engine(clamp(sr, 0, 1.3), game.state !== 'done' && !game.paused);
  }

  // 문제 카드를 다가오는 문 바로 위에 띄움: 시선이 가는 곳(지평선·문)에 문제가 보이도록
  function placeQuestion(g, dt) {
    const qe = $('question'), W = innerWidth, H = innerHeight;
    camera.updateMatrixWorld();
    tmpV.copy(game.T.pos[g.i]); tmpV.y += 13.8; tmpV.project(camera);
    let sx = W / 2, sy = 0;
    if (tmpV.z < 1) { sx = (tmpV.x * 0.5 + 0.5) * W; sy = (-tmpV.y * 0.5 + 0.5) * H; }
    if (!game.qSize) game.qSize = [qe.offsetWidth, qe.offsetHeight];
    const half = game.qSize[0] / 2 + 8; // 카드가 화면 밖으로 잘리지 않게
    sx = half * 2 >= W ? W / 2 : clamp(sx, Math.max(W * 0.32, half), Math.min(W * 0.68, W - half));
    sy = clamp(sy, game.qSize[1] + 14, H * 0.48); // 카드 아래 끝 = 문 꼭대기, 화면 밖으로는 안 나감
    if (game.qx == null) { game.qx = sx; game.qy = sy; }
    game.qx = damp(game.qx, sx, 8, dt); game.qy = damp(game.qy, sy, 8, dt);
    setStyle('question', 'left', `${Math.round(game.qx)}px`); setStyle('question', 'top', `${Math.round(game.qy)}px`);
  }

  function fmtTime(t) { t = Math.max(0, t); return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`; }

  let bannerTimer = 0, tipTimer = 0;
  function showBanner(text, dur = 1.8) { const b = $('banner'); b.textContent = text; b.className = 'show'; bannerTimer = dur; }
  function flashTip(text, dur = 4) { const t = $('tip'); t.textContent = text; t.classList.remove('hidden'); tipTimer = dur; }
  const TUTORIAL = [[0.6, '정답이 적힌 문으로 지나가면 부스터! 🚀'], [9, 'Shift 를 누른 채 꺾으면 드리프트! 떼면 부스터 💨'],
    [18, '? 상자를 먹고 Space 로 아이템을 써 보세요 🍌'], [27, '점프대에서 뜨면 Shift 로 트릭! ✨']];

  function updateHUD(dt) {
    const { p, ais } = game;
    if (!p.finished) p.rank = 1 + ais.filter((a) => aiTotal(a) > playerTotal()).length;
    if (p.rank !== game.lastRank) {
      const r = $('rank'); r.classList.remove('bump'); void r.offsetWidth; r.classList.add('bump');
      if (p.rank < game.lastRank && game.state === 'race') Sound.sfx.pass();
      game.lastRank = p.rank;
    }
    setText('rank', p.rank); setText('rank-of', `/${ais.length + 1}`);
    setText('lap', `랩 ${Math.min(p.laps + 1, LAPS)}/${LAPS}`);
    if (p.laps !== game.lastLap && game.state === 'race') {
      if (p.laps > game.lastLap && p.laps === LAPS - 1) { showBanner('마지막 바퀴!'); Sound.sfx.lap(); if (window.Music) Music.setTempo(1.08); }
      game.lastLap = p.laps;
    }
    setText('time', fmtTime(p.finished ? p.finishTime : Math.max(0, game.t)));
    setText('speed-num', Math.max(0, Math.round(p.vF * KMH)));
    const ch = p.drift.on ? p.drift.charge : 0, gf = $('gauge-fill');
    setStyle('gauge-fill', 'width', `${Math.round(clamp(ch / 1.6, 0, 1) * 100)}%`);
    const gc = ch >= 1.6 ? 'orange' : ch >= 0.75 ? 'blue' : ''; if (gf.className !== gc) gf.className = gc;
    if (game.nextGate && !p.finished) {
      const dd = (game.nextGate.i - p.idx + N) % N, span = N / game.gates.length; // 문 사이 평균 간격
      setStyle('q-dist-fill', 'width', `${Math.round(clamp(1 - dd / span, 0, 1) * 100)}%`);
      placeQuestion(game.nextGate, dt);
    }
    // 출발 신호등 + 숫자
    const cd = $('countdown'), lights = $('lights');
    if (game.state === 'countdown') {
      const n = Math.ceil(-game.t);
      if (n !== game.lastCount && n <= 3) {
        game.lastCount = n; cd.textContent = n; cd.classList.remove('tick'); void cd.offsetWidth; cd.classList.add('tick'); Sound.sfx.beep();
        lights.className = ''; lights.querySelectorAll('i').forEach((el, k) => el.classList.toggle('red', k < 4 - n));
      }
    } else if (game.t < 1.2) {
      if (game.lastCount !== 0) {
        game.lastCount = 0; cd.textContent = '출발!'; cd.classList.remove('tick'); void cd.offsetWidth; cd.classList.add('tick');
        lights.className = 'go'; lights.querySelectorAll('i').forEach((el) => el.classList.remove('red'));
      }
    } else { cd.textContent = ''; lights.className = 'hidden'; }
    // 거꾸로 가기 경고
    const t = game.T.right[p.idx], dot = Math.sin(p.h) * t.z - Math.cos(p.h) * t.x;
    game.wrongT = game.state === 'race' && !p.finished && dot < -0.3 && Math.abs(p.vF) > 3 ? game.wrongT + dt : 0;
    $('wrongway').classList.toggle('hidden', game.wrongT < 1);
    // 첫 경기 안내
    if (game.tutorial && game.state === 'race') {
      while (game.tutorial.length && game.t >= game.tutorial[0][0]) flashTip(game.tutorial.shift()[1], 6);
    }
    if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('banner').className = ''; }
    if (tipTimer > 0) { tipTimer -= dt; if (tipTimer <= 0) $('tip').classList.add('hidden'); }
    if (flashTimer > 0) { flashTimer -= dt; if (flashTimer <= 0) $('feedback').classList.remove('show'); }
    game.mmTick = (game.mmTick || 0) + 1;
    if (game.mmTick % 2 === 0) drawMinimap(); // 지도는 두 프레임에 한 번
  }

  function showResult() {
    const { p, stats, ais, T } = game;
    game.state = 'done';
    Sound.engine(0, false);
    try { localStorage.setItem('eduKart.tutorial', '1'); } catch (e) { /* 무시 */ }
    // 순위표: 아직 못 들어온 컴퓨터는 남은 거리로 도착 시간을 추정
    const entries = [{ name: `${M.SPECIES[settings.species].name} (나)`, species: settings.species, time: p.finishTime, me: true }]
      .concat(ais.map((a) => ({ name: a.name, species: a.species, time: a.finished ? a.finishTime : game.t + ((LAPS * N - aiTotal(a)) * T.segLen) / Math.max(a.speed, 20) })))
      .sort((x, y) => x.time - y.time);
    p.rank = entries.findIndex((e) => e.me) + 1;
    const medal = ['🥇', '🥈', '🥉'][p.rank - 1] || '🏁';
    $('r-title').textContent = `${medal} ${p.rank}등!`;
    const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
    $('r-stars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < stars ? '' : 'off'}">⭐</span>`).join('');
    const best = loadBest(settings.track);
    if (!best || p.finishTime < best) { saveBest(settings.track, p.finishTime); $('r-record').textContent = best ? '🎉 신기록!' : '🏆 첫 기록 달성!'; }
    else $('r-record').textContent = `최고 기록 ${fmtTime(best)}`;
    $('r-stats').innerHTML = `기록 ${fmtTime(p.finishTime)} · 정답 ${stats.correct}/${stats.total} (${pct}%)`;
    $('r-rank').innerHTML = '';
    entries.forEach((e, k) => {
      const li = document.createElement('li'); if (e.me) li.className = 'me';
      li.innerHTML = `<span>${['🥇', '🥈', '🥉'][k] || `${k + 1}.`} ${e.name}</span><span>${fmtTime(e.time)}</span>`;
      $('r-rank').appendChild(li);
    });
    const w = $('r-wrong'); w.innerHTML = '';
    if (stats.wrong.length) {
      const h = document.createElement('div'); h.innerHTML = '<b>다시 보기</b>'; w.appendChild(h);
      for (const x of stats.wrong) {
        const row = document.createElement('div');
        row.textContent = `${x.prompt}  →  ${x.answer}  (고른 답: ${x.chosen})`;
        w.appendChild(row);
      }
    } else if (stats.total) w.textContent = '모두 맞혔어요! 최고! 🎉';
    $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('speedlines').style.opacity = 0;
    $('result').classList.remove('hidden');
    showcase.setPodium(entries.slice(0, 3).map((e) => e.species));
    if (window.Music) { Music.jingle(p.rank <= 3 ? 'win' : 'good'); setTimeout(() => { if (game && game.state === 'done') Music.play('menu'); }, 2600); }
  }

  // ---------- 메뉴 배경(고른 캐릭터) / 결과 시상대 ----------
  const showcase = (() => {
    const scene = new THREE.Scene();
    scene.add(makeSky(0x3b8cff, 0xd4f1ff));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7a55, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(6, 12, -8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    const stage = new THREE.Group(); scene.add(stage);
    const podium = M.part(new THREE.CylinderGeometry(4.2, 4.6, 1, 32), M.toon(0xffd84d), stage, 0, -0.5, 0, { outline: 1.02 });
    podium.receiveShadow = true;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 32), M.toon(0x5cbf4a)); ground.rotation.x = -Math.PI / 2; ground.position.y = -1; ground.receiveShadow = true; scene.add(ground);
    for (let k = 0; k < 14; k++) {
      const t = k % 3 ? M.tree() : M.pine(), a = (k / 14) * Math.PI * 2;
      t.position.set(Math.cos(a) * (22 + (k % 4) * 6), -1, Math.sin(a) * (22 + (k % 4) * 6) + 6); scene.add(t);
    }
    for (let k = 0; k < 5; k++) { const c = M.cloud(); c.position.set(-60 + k * 30, 30 + (k % 2) * 8, 80); c.scale.setScalar(0.6); scene.add(c); }
    let kart = null;
    function setSpecies(s) {
      if (kart) stage.remove(kart.root);
      kart = M.makeKart(s); stage.add(kart.root);
      stage.visible = true; podiumGroup.visible = false;
    }
    // 시상대: 1등 가운데, 2등 화면 왼쪽(+x), 3등 오른쪽(-x)
    const podiumGroup = new THREE.Group(); podiumGroup.visible = false; scene.add(podiumGroup);
    const SLOTS = [[0, 2.4], [3.4, 1.6], [-3.4, 1.0]];
    let podiumKarts = [];
    SLOTS.forEach(([x, h], k) => {
      M.part(new THREE.BoxGeometry(3.2, h, 3.2), M.toon([0xffd84d, 0xd9dde6, 0xe0a060][k]), podiumGroup, x, h / 2 - 1, 0, { outline: 1.02 }).receiveShadow = true;
      const num = labelMesh(1.4, 1.4, 128, 128, String(k + 1), '#1d2b53', '#ffffff');
      num.position.set(x, h / 2 - 1, -1.62); num.rotation.y = Math.PI; podiumGroup.add(num);
    });
    const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 140);
    const cf = []; const col = new THREE.Color(), dm = new THREE.Object3D();
    for (let k = 0; k < 140; k++) { cf.push([Math.random() * 14 - 7, Math.random() * 14, Math.random() * 6 - 3, Math.random() * 6]); confetti.setColorAt(k, col.setHex([0xff6fa8, 0xffd84d, 0x4fc3ff, 0x7dff8a, 0xff7043][k % 5])); }
    confetti.frustumCulled = false; podiumGroup.add(confetti);
    function setPodium(list) {
      podiumKarts.forEach((k) => podiumGroup.remove(k.root));
      podiumKarts = list.map((s, k) => {
        const kt = M.makeKart(s); kt.root.scale.setScalar(0.62);
        kt.root.position.set(SLOTS[k][0], SLOTS[k][1] - 1, 0); kt.root.rotation.y = Math.PI; podiumGroup.add(kt.root);
        return kt;
      });
      stage.visible = false; podiumGroup.visible = true;
    }
    setSpecies(settings.species);
    const cam = new THREE.PerspectiveCamera(42, 1, 0.5, 5000);
    return {
      setSpecies, setPodium,
      render(t, dt) {
        const wide = innerWidth > 760;
        cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
        if (podiumGroup.visible) {
          podiumGroup.position.x = wide ? -4.2 : 0;
          podiumKarts.forEach((k, i) => { k.body.position.y = Math.abs(Math.sin(t * 4 + i)) * 0.25; k.head.rotation.z = Math.sin(t * 3 + i) * 0.2; });
          cf.forEach((c, k) => {
            c[1] -= dt * 2.2; if (c[1] < -1) c[1] = 14;
            dm.position.set(c[0] + Math.sin(t + c[3]) * 0.6, c[1], c[2]); dm.rotation.set(t * 3 + c[3], t * 2 + c[3], 0); dm.updateMatrix(); confetti.setMatrixAt(k, dm.matrix);
          });
          confetti.instanceMatrix.needsUpdate = true;
          cam.position.set(wide ? -1.8 : 0, 5, -15); cam.lookAt(wide ? -1.8 : 0, 1.4, 0);
        } else {
          stage.rotation.y = t * 0.6;
          if (kart) { kart.body.position.y = Math.abs(Math.sin(t * 3)) * 0.15; kart.head.rotation.z = Math.sin(t * 2) * 0.15; }
          stage.position.x = wide ? -3.6 : 0; // 오른쪽에 보이도록 (카메라가 +z 를 바라봄 → 화면 오른쪽 = -x)
          cam.position.set(wide ? -1.5 : 0, 4.2, -11.5); cam.lookAt(wide ? -1.5 : 0, 1.2, 0);
        }
        draw(scene, cam);
      },
    };
  })();

  // ---------- 일시정지 / 설정 / 화면 전환 ----------
  function togglePause() {
    if (!game || game.state === 'done') return;
    game.paused = !game.paused;
    $('pause').classList.toggle('hidden', !game.paused);
    if (!game.paused) $('settings').classList.add('hidden');
    for (const k in keys) keys[k] = false;
    if (window.Music) Music.pause(game.paused);
    if (game.paused) Sound.engine(0, false); // 멈춘 동안은 매 프레임 갱신이 없어서 여기서 꺼야 함
    if (window.speechSynthesis && game.paused) speechSynthesis.cancel();
  }
  function openSettings() {
    $('vol-music').value = settings.volMusic; $('vol-sfx').value = settings.volSfx;
    refreshMenu(); $('settings').classList.remove('hidden');
  }
  $('vol-music').addEventListener('input', (e) => { settings.volMusic = +e.target.value; Sound.levels(); saveSettings(); });
  $('vol-sfx').addEventListener('input', (e) => { settings.volSfx = +e.target.value; Sound.levels(); saveSettings(); });
  $('vol-sfx').addEventListener('change', () => Sound.sfx.correct());
  $('open-settings').addEventListener('click', openSettings);
  $('pause-settings').addEventListener('click', openSettings);
  $('close-settings').addEventListener('click', () => { $('settings').classList.add('hidden'); Sound.sfx.click(); });
  $('pause-btn').addEventListener('click', () => togglePause());
  $('resume').addEventListener('click', () => togglePause());
  function goMenu() {
    ['result', 'pause', 'settings', 'hud', 'touch'].forEach((id) => $(id).classList.add('hidden'));
    $('menu').classList.remove('hidden'); $('speedlines').style.opacity = 0;
    game = null; showcase.setSpecies(settings.species); refreshMenu();
    Sound.engine(0, false); // 메뉴에서는 엔진 소리 끔
    if (bloomPass) bloomPass.strength = 0.22;
    if (window.Music) Music.play('menu');
  }
  $('quit').addEventListener('click', goMenu);
  $('to-menu').addEventListener('click', goMenu);
  // 트랙을 만드는 동안 화면이 멈춘 듯 보이지 않게 로딩 화면을 먼저 그림
  function launch() {
    Sound.init(); Sound.sfx.click();
    ['menu', 'result', 'pause', 'settings'].forEach((id) => $(id).classList.add('hidden'));
    $('loading').classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      startRace();
      $('loading').classList.add('hidden');
      try { if (localStorage.getItem('eduKart.tutorial') !== '1') game.tutorial = TUTORIAL.slice(); } catch (e) { /* 무시 */ }
    }));
  }
  $('start').addEventListener('click', launch);
  $('again').addEventListener('click', launch);
  $('restart').addEventListener('click', launch);
  function skipIntro() { if (game && game.state === 'intro') game.introT = INTRO; }
  addEventListener('pointerdown', () => skipIntro());

  // ---------- 루프 ----------
  let last = performance.now(), slowTime = 0, bench = null;
  function frame(now) {
    requestAnimationFrame(frame);
    // rAF 시각이 스크립트 시작 시각보다 이를 수 있어 음수 방지
    const raw = (now - last) / 1000, dt = clamp(raw, 0, 0.05); last = now;
    if (!game || game.state === 'done') { showcase.render(now / 1000, dt); return; }
    const w0 = performance.now();
    if (bench) autopilot();
    step(dt);
    draw(game.scene, camera, game.blur || 0);
    if (bench) { bench.push(raw * 1000); (bench.work = bench.work || []).push(performance.now() - w0); }
    // 계속 느리면(30fps 미만이 3초 이상) 그래픽을 자동으로 낮춤
    if (game.state === 'race' && !game.paused && settings.quality === 'high' && (!location.hash || /auto=1/.test(location.hash))) {
      // 탭 전환 같은 한 번의 긴 멈춤(0.25초 이상)은 세지 않음
      if (raw < 0.25) slowTime = raw > 1 / 30 ? slowTime + raw : Math.max(0, slowTime - raw * 0.5);
      if (slowTime > 3) { settings.quality = 'low'; saveSettings(); applyQuality(); flashTip('부드럽게 달리도록 그래픽을 낮췄어요 ⚡', 3); slowTime = 0; }
    }
  }
  function step(dt) {
    if (game.state === 'done' || game.paused) return;
    if (game.state === 'intro') {
      game.introT += dt;
      updateKartMeshes(); updateCamera(dt); drawMinimap();
      if (game.introT >= INTRO) { game.state = 'countdown'; $('intro').classList.add('hidden'); $('lights').className = ''; }
      return;
    }
    game.t += dt;
    if (game.state === 'countdown' && game.t >= 0) {
      game.state = 'race'; updateNextGate(); Sound.sfx.go();
      const p = game.p; // 스타트 대시: 출발 직전(1초 안)에 가속을 누르기 시작하면 부스터
      if ((keys.up || touchMode) && p.gasAt > -1.0) { p.boost = 1.2; flash('스타트 대시!', 'info'); Sound.sfx.boost(); }
    }
    updatePlayer(dt); updateAIs(dt); updateKartMeshes(); playerEffects(); updateWorld(dt); updateCamera(dt); updateHUD(dt);
    for (const k in pressed) pressed[k] = false;
    if (game.p.finished) { game.endTimer -= dt; if (game.endTimer <= 0) showResult(); }
  }
  applyQuality();
  refreshMenu();
  requestAnimationFrame(frame);

  // 자동 점검용 자율주행: index.html#sim=초 → 그 시간만큼 빠르게 진행 후 결과를 콘솔에 출력
  const simDrift = /drift=1/.test(location.hash);
  // 앞쪽 목표점을 따라가는 단순 추종 (회전 지연을 고려해 yawRate 로 보정), 정답 차선으로 이동
  function autopilot() {
    const { T, p } = game, g = game.nextGate;
    const target = g && g.q && ((g.i - p.idx + N) % N) * T.segLen < 320 ? [-LANE, 0, LANE][g.q.answer] : 0;
    const ahead = (p.idx + 10 + Math.round(Math.max(0, p.vF) * 0.4)) % N, aim = T.pos[ahead].clone().addScaledVector(T.right[ahead], target);
    const err = wrapAngle(Math.atan2(aim.x - p.pos.x, aim.z - p.pos.z) - p.h) - p.yawRate * 0.1;
    keys.up = true; keys.left = err > 0.015; keys.right = err < -0.015;
  }
  function simulate(seconds) {
    skipIntro(); step(1 / 30);
    keys.up = true;
    const { T, p } = game;
    let vSum = 0, steps = 0, airMax = 0;
    for (let k = 0; k < seconds * 30 && game.state !== 'done'; k++) {
      autopilot();
      if (simDrift) keys.drift = Math.abs(T.curv[(p.idx + 8) % N]) > 0.16 && p.vF > 22; // 드리프트 경로 점검용
      if (!simDrift && p.air > 0.5 && p.canTrick) press('drift'); // 트릭 경로 점검용
      else if (!simDrift) keys.drift = false;
      step(1 / 30);
      if (game.state === 'race' && !p.finished) { vSum += p.vF; steps++; airMax = Math.max(airMax, p.air); }
    }
    keys.up = keys.left = keys.right = keys.drift = false;
    const lapGates = game.gates.map((g) => g.i).sort((x, y) => x - y);
    const gaps = lapGates.map((x, k) => Math.round((((lapGates[(k + 1) % lapGates.length] - x + N) % N) * T.segLen)));
    console.log('SIM ' + JSON.stringify({ state: game.state, t: game.t.toFixed(1), laps: p.laps, rank: p.rank,
      stats: game.stats.total + '/' + game.stats.correct, drifts: game.stats.drifts || 0, walls: game.stats.walls || 0, spins: game.stats.spins || 0,
      miss: game.stats.wrong.map((w) => w.want + ':' + w.lat), len: Math.round(T.length), gateGaps: gaps,
      airMax: +airMax.toFixed(1), avgKmh: Math.round((vSum / Math.max(1, steps)) * KMH), ai: game.ais.map((a) => (aiTotal(a) / N).toFixed(2)) }));
  }
  window.__eduKart = { get game() { return game; }, startRace, settings, Sound };

  // #sim=초[&track=n][&subject=s][&species=s] : 자동 점검, #race=초 : 그 시간만큼 진행 후 화면 유지(스크린샷용)
  // #intro / #pause / #result 처럼 화면 점검용 상태도 지원
  const sim = /^#(sim|race)=(\d+)(?:&track=(\d))?(?:&subject=(\w+))?(?:&species=(\w+))?/.exec(location.hash);
  if (sim) {
    if (sim[3]) settings.track = +sim[3];
    if (sim[4]) settings.subject = sim[4];
    if (sim[5]) settings.species = sim[5];
    startRace(); simulate(+sim[2]);
    if (sim[1] === 'race') { keys.up = true; }
    if (/&pause=1/.test(location.hash)) togglePause();
  } else if (location.hash === '#intro') { startRace(); game.introT = 1.2; step(0); }
  else if (/^#bench/.test(location.hash)) { // #bench[&track=n][&quality=low]: 실제 시간 성능 측정
    const m = /track=(\d)/.exec(location.hash); if (m) settings.track = +m[1];
    settings.quality = /quality=low/.test(location.hash) ? 'low' : 'high';
    startRace(); skipIntro(); bench = [];
    window.__benchReport = () => { const a = bench.slice(60).sort((x, y) => x - y), avg = a.reduce((s, v) => s + v, 0) / a.length;
      const wk = bench.work.slice(60).sort((x, y) => x - y), gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { quality: settings.quality, frames: a.length, avgMs: +avg.toFixed(2), fps: Math.round(1000 / avg), p95Ms: +a[Math.floor(a.length * 0.95)].toFixed(2),
        workAvgMs: +(wk.reduce((s, v) => s + v, 0) / wk.length).toFixed(2), workP95Ms: +wk[Math.floor(wk.length * 0.95)].toFixed(2), gpuName: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?', calls: renderer.info.render.calls, tris: renderer.info.render.triangles, gpu: renderer.getContext().getParameter(renderer.getContext().RENDERER) }; };
  } else if (location.hash === '#audiotest') { // 음악을 오프라인으로 녹음해 소리 크기 확인
    (async () => { const out = {};
      for (const name of Music.SONGS) { const ctx = new OfflineAudioContext(1, 44100 * 6, 44100); Music.attach(ctx, ctx.destination); Music.prerender(name, 6);
        const d = (await ctx.startRendering()).getChannelData(0); let pk = 0, sq = 0, bad = 0;
        for (const v of d) { if (!Number.isFinite(v)) bad++; else { pk = Math.max(pk, Math.abs(v)); sq += v * v; } }
        out[name] = { peak: +pk.toFixed(3), rms: +Math.sqrt(sq / d.length).toFixed(3), bad }; }
      console.log('AUDIO ' + JSON.stringify(out)); })();
  }
})();
