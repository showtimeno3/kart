// 메뉴 쇼케이스, 일시정지, 설정, 화면 전환
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

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
        stage.rotation.y = showcase.angle != null ? showcase.angle : t * 0.6; // angle: 화면 점검용 고정 각도
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
  setStyle('bubbles', 'opacity', '0'); // 비눗방울을 맞은 채 그만둬도 메뉴에 남지 않게
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
