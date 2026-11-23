// 카트 자세, 세계 갱신, 카메라, 문제 카드 위치
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

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
  const { p, ais, boxes, scene, deco } = game;
  const total = ais.length + 1;
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
      if (!a.item) giveItem(a, ItemTable.roll(rankOf(a), total, 0));
    }
  }
  if (p.rolling > 0) { // 아이템 룰렛
    p.rolling -= dt; p.rollTick -= dt;
    if (p.rollTick <= 0) { p.rollTick = 0.07; $('item').textContent = ItemTable.ITEMS[ItemTable.IDS[Math.floor(Math.random() * ItemTable.IDS.length)]].icon; Sound.sfx.roll(); }
    if (p.rolling <= 0) {
      giveItem(p, ItemTable.roll(p.rank, total, p.combo));
      $('item').classList.remove('rolling'); Sound.sfx.item();
    }
  }
  updateItems(dt);
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
