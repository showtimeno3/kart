// 루프, 자동 점검(sim/bench/audiotest)
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

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
const hashArgs = new URLSearchParams(location.hash.slice(1)); // 순서 상관없이 받음
const simDrift = hashArgs.get('drift') === '1', simShortcut = hashArgs.get('shortcut') === '1';
// 앞쪽 목표점을 따라가는 단순 추종 (회전 지연을 고려해 yawRate 로 보정), 정답 차선으로 이동
function autopilot() {
  const { T, p } = game, g = game.nextGate;
  const target = g && g.q && ((g.i - p.idx + N) % N) * T.segLen < 320 ? [-LANE, 0, LANE][g.q.answer] : 0;
  const ahead = (p.idx + 10 + Math.round(Math.max(0, p.vF) * 0.4)) % N;
  let aim = T.pos[ahead].clone().addScaledVector(T.right[ahead], target);
  const sc = T.sc; // shortcut=1: 갈림점을 지나면 지름길 중심선을 따라감
  if (simShortcut && sc && (sc.i0 - p.idx + N) % N < 60) aim = T.pos[ahead].clone().addScaledVector(T.right[ahead], sc.lat0); // 갈림점 전에 그쪽 차선으로
  if (simShortcut && sc && (p.idx - sc.i0 + N) % N < 12) p.scGo = true; // 갈림점에서 지름길로 가기로 함
  if (p.scGo && !p.onSc && (p.idx - sc.i1 + N) % N < 30) p.scGo = false; // 출구를 지남
  if (p.scGo) aim = sc.pos[Math.min(sc.n - 1, scNearest(T, p.pos)[0] + 10 + Math.round(Math.max(0, p.vF) * 0.4))].clone();
  const err = wrapAngle(Math.atan2(aim.x - p.pos.x, aim.z - p.pos.z) - p.h) - p.yawRate * 0.1;
  keys.up = true; keys.left = err > 0.015; keys.right = err < -0.015;
  keys.down = !!p.scGo && Math.abs(err) > 0.35 && p.vF > 20; // 지름길 급한 입구: 많이 틀어지면 감속
  if (keys.down) keys.up = false;
}
function simulate(seconds) {
  skipIntro(); step(1 / 30);
  keys.up = true;
  const { T, p } = game;
  let vSum = 0, steps = 0, airMax = 0;
  for (let k = 0; k < seconds * 30 && game.state !== 'done'; k++) {
    autopilot();
    if (p.items.length && p.rolling <= 0) useItem(); // 아이템은 들자마자 사용
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
    airMax: +airMax.toFixed(1), items: game.stats.items, shieldBlocks: game.stats.shieldBlocks, hits: game.stats.hits, scUsed: game.stats.scUsed || 0, warns: game.stats.warns || 0, pAtk: game.stats.pAtk || 0, aiJump: +(game.stats.aiJump || 0).toFixed(1), avgKmh: Math.round((vSum / Math.max(1, steps)) * KMH), ai: game.ais.map((a) => (aiTotal(a) / N).toFixed(2)) }));
}
window.__eduKart = { get game() { return game; }, startRace, settings, Sound };

// #sim=초[&track=n][&subject=s][&species=s] : 자동 점검, #race=초 : 그 시간만큼 진행 후 화면 유지(스크린샷용)
// #intro / #pause / #result 처럼 화면 점검용 상태도 지원
const simMode = hashArgs.has('sim') ? 'sim' : hashArgs.has('race') ? 'race' : null;
if (simMode) {
  for (const k of ['track', 'level', 'difficulty']) if (hashArgs.has(k)) settings[k] = +hashArgs.get(k);
  for (const k of ['subject', 'species']) if (hashArgs.has(k)) settings[k] = hashArgs.get(k);
  startRace(); simulate(+hashArgs.get(simMode));
  if (simMode === 'race') { keys.up = true; if (hashArgs.has('use')) { giveItem(game.p, hashArgs.get('use')); useItem(hashArgs.get('back') === '1'); } if (hashArgs.has('give')) hashArgs.get('give').split(',').forEach((id) => giveItem(game.p, id));
    if (hashArgs.get('threat') === 'bee') throwShot('bee', game.ais[game.ais.length - 1], game.p); // threat=bee: 나를 노리는 벌떼
    else if (hashArgs.has('threat')) { throwShot('homing', game.ais[0], game.p); const s = game.shots[game.shots.length - 1]; s.s = kartProg(game.p) - 70 / game.T.segLen; s.sc = null; s.lat = game.p.lat; } } // threat=1: 뒤 70 에서 나를 노리는 물풍선 (경고 화면 점검용) // use=아이템: 화면 점검용
  if (hashArgs.get('pause') === '1') togglePause();
} else if (hashArgs.has('showcase')) { showcase.setSpecies(hashArgs.get('showcase')); showcase.angle = +(hashArgs.get('ang') || 2.6); // 메뉴 캐릭터 화면 점검용
} else if (hashArgs.has('intro')) { if (hashArgs.has('track')) settings.track = +hashArgs.get('track'); startRace(); game.introT = 1.2; step(0); } // #intro[&track=n]: 출발 전 연출 화면
else if (/^#bench/.test(location.hash)) { // #bench[&track=n][&quality=low]: 실제 시간 성능 측정
  const m = /track=(\d)/.exec(location.hash); if (m) settings.track = +m[1];
  settings.quality = /quality=low/.test(location.hash) ? 'low' : 'high';
  startRace(); skipIntro(); bench = [];
  setTimeout(() => console.log('BENCH ' + JSON.stringify(window.__benchReport())), 20000); // 20초 뒤 결과를 콘솔에 (test/sim.mjs 가 읽음)
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
