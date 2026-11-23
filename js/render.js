// 렌더러, 후처리, 라벨, 하늘, 파티클
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

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
