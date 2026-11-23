// 플레이어 물리
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

// ---------- 플레이어 물리 ----------
function endDrift(withBoost) {
  const p = game.p, d = p.drift;
  if (withBoost && d.charge >= 0.75) game.stats.drifts = (game.stats.drifts || 0) + 1;
  if (withBoost && d.charge >= 1.6) { p.boost = Math.max(p.boost, 1.3); flash('슈퍼 드리프트 부스터!', 'info'); Sound.sfx.boost(); }
  else if (withBoost && d.charge >= 0.75) { p.boost = Math.max(p.boost, 0.7); Sound.sfx.boost(); }
  d.on = false; d.charge = 0;
}

const SURF_SPEED = { sand: 0.8, mud: 0.7 }; // 모래·진흙: 최고 속도 배율
function updatePlayer(dt) {
  const { p, T, A } = game;
  const racing = game.state === 'race' && !p.finished;
  const ctrl = racing && p.spin <= 0;
  const onGround = p.air < 0.05;
  const surf = onGround ? (p.onSc ? T.sc.surf : T.surf[p.idx]) : null; // 노면: 얼음은 미끄럽고, 모래·진흙은 느림
  const steerIn = (ctrl ? (keys.left ? 1 : 0) - (keys.right ? 1 : 0) : 0) * (p.bubble > 0 ? 0.5 : 1); // 비눗방울: 핸들이 둔해짐
  const gas = ctrl && (keys.up || touchMode);
  const brake = ctrl && keys.down;
  // 핸들 입력은 즉시 반응, 대신 최대로 꺾이는 정도를 낮춤
  p.steer = approach(p.steer, steerIn, dt * (steerIn === 0 ? 12 : 9));
  p.boost = Math.max(0, p.boost - dt); p.slow = Math.max(0, p.slow - dt); p.hopCd = Math.max(0, p.hopCd - dt);
  p.padCd = Math.max(0, p.padCd - dt); p.wet = Math.max(0, p.wet - dt);

  const fx = Math.sin(p.h), fz = Math.cos(p.h), rx = -fz, rz = fx;
  let vF = p.vel.x * fx + p.vel.z * fz, vR = p.vel.x * rx + p.vel.z * rz;
  const offroad = onGround && Math.abs(p.lat) > HW + 0.8;
  const max = MAX_SPEED * (p.boost > 0 ? BOOST_MUL : 1) * (p.slow > 0 ? 0.6 : 1) * (offroad && p.boost <= 0 ? 0.6 : 1) * (p.wet > 0 ? 0.85 : 1) * (p.sticky > 0 ? 0.5 : 1) * (SURF_SPEED[surf] || 1);
  if (onGround) {
    if (p.boost > 0) vF = Math.min(max, vF + 55 * dt);
    else if (gas) vF += 17 * (surf === 'ice' ? 0.8 : 1) * Math.max(0.1, 1 - vF / max) * dt; // 빠를수록 가속이 줄어듦
    if (brake) vF = vF > 0 ? Math.max(0, vF - 32 * dt) : Math.max(-10, vF - 10 * dt);
    if (!gas && !brake && p.boost <= 0) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 5 * dt);
    if (vF > max) vF = Math.max(max, vF - 18 * dt);
    vF -= (p.onSc ? 0 : T.slope[p.idx]) * G * 0.35 * dt; // 오르막은 느려지고 내리막은 빨라짐
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
  vR *= Math.exp(-(d.on ? 2.0 : onGround ? (surf === 'ice' ? 2.5 : 9) : 1) * dt); // 옆미끄러짐을 잡아주는 접지력

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

  // 트랙 위치와 벽. 지름길이 있으면 본 도로와 지름길 중 어느 쪽 길 안에 있는지 봄
  const prev = p.idx;
  const mi = nearest(T, p.pos, p.idx), c = T.pos[mi], rvM = T.right[mi];
  const fwdOff = (p.pos.x - c.x) * rvM.z - (p.pos.z - c.z) * rvM.x; // 샘플 앞뒤 어긋남 (진행 방향 = (right.z, -right.x))
  const latM = (p.pos.x - c.x) * rvM.x + (p.pos.z - c.z) * rvM.z;
  const lim = EDGE - 1.4;
  const inMain = Math.abs(latM) <= lim && Math.abs(fwdOff) < 3 * T.segLen;
  let k = 0, latS = 0, sd = Infinity;
  if (T.sc) [k, latS, sd] = scNearest(T, p.pos);
  const scLim = T.sc ? T.sc.half[k] + 0.6 : 0; // 지름길 반폭 (갈림길에서 넓음)
  const inSc = !!T.sc && Math.abs(latS) <= scLim && sd < scLim + 3;
  const wasSc = p.onSc;
  p.onSc = inSc && !inMain; p.scK = k;
  if (p.onSc && !wasSc) game.stats.scUsed = (game.stats.scUsed || 0) + 1; // 점검용: 지름길에 들어간 횟수
  if (p.onSc) { // 지름길 위: 진행도는 지름길 비율만큼 본 도로 갈림점 사이로 옮김
    p.idx = (T.sc.i0 + Math.round((k / (T.sc.n - 1)) * T.sc.span)) % N; p.idxF = p.idx; p.lat = latS;
  } else {
    p.idx = mi; p.idxF = (mi + clamp(fwdOff / T.segLen, -0.5, 0.5) + N) % N; p.lat = latM;
  }
  if (!inMain && !inSc) { // 길 밖: 더 가까운 쪽 길의 벽으로 밀어냄
    const useSc = T.sc && sd < scLim + 14 && Math.abs(latS) - scLim < Math.abs(latM) - lim;
    const rv = useSc ? T.sc.right[k] : rvM, lat = useSc ? latS : latM, L = useSc ? scLim : lim, s = Math.sign(lat);
    p.pos.addScaledVector(rv, s * L - lat); p.lat = s * L;
    if (useSc) { p.onSc = true; p.idx = (T.sc.i0 + Math.round((k / (T.sc.n - 1)) * T.sc.span)) % N; p.idxF = p.idx; } // 지름길 벽에 붙음
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
  const rv = p.onSc ? T.sc.right[k] : rvM;

  // 구조: 가속 중인데 2.5초 넘게 거의 못 움직이면 도로 가운데 쪽으로 방향을 바로잡아 줌
  p.stuckT = gas && Math.abs(vF) < 3 ? (p.stuckT || 0) + dt : 0;
  if (p.stuckT > 2.5) {
    p.stuckT = 0; p.h = p.onSc ? T.sc.head[k] : T.head[p.idx]; p.yawRate = 0; p.vel.set(0, 0, 0);
    p.pos.addScaledVector(rv, -p.lat * 0.6); p.lat *= 0.4;
    flash('다시 출발! 🚩', 'info'); Sound.sfx.hop();
  }

  // 높이: 점프대 끝에서 위로 튕겨줌
  for (const r of A.ramps) {
    if (onGround && !p.onSc && crossed(prev, p.idx, r.i1) && Math.abs(p.lat - r.lat) < r.w / 2 && vF > 8) {
      p.vy = 8 + r.h * 2 + vF * 0.08; p.canTrick = true; Sound.sfx.jump();
    }
  }
  const impact = vertical(p, p.onSc ? T.sc.pos[k].y : groundY(T, A, p.idxF, p.lat), dt);
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
    if (onGround && !p.onSc && p.padCd === 0 && inRange(p.idx, pd.i0 - 4, 8) && Math.abs(p.lat - pd.lat) < 5) {
      p.boost = Math.max(p.boost, 1.1); p.padCd = 0.6; Sound.sfx.boost();
    }
  }
  if (A.river && onGround && !p.onSc && inRange(p.idx, A.river.i0 - A.river.n, 2 * A.river.n)) {
    if (p.wet <= 0) Sound.sfx.splash();
    p.wet = 0.3;
    for (let k = 0; k < 3; k++) Particles.emit(kartPoint(p.kart, (Math.random() - 0.5) * 3, 0.3, -1), { color: 0xcfefff, vx: (Math.random() - 0.5) * 10, vy: 5 + Math.random() * 5, vz: (Math.random() - 0.5) * 10, life: 0.6, size: 0.7, grav: 22, alpha: 0.9 });
  }

  const dl = p.idx - prev;
  if (dl < -N / 2) p.laps++;
  else if (dl > N / 2) p.laps--;
  if (!p.onSc) for (const g of game.gates) if (crossed(prev, p.idx, g.i)) onPlayerGate(g); // 지름길로 건너뛴 구간의 문은 지나간 것이 아님

  // 차체 움직임: 기울기, 들림, 미끄러지는 각도
  const accel = (vF - p.prevVF) / Math.max(dt, 1e-4); p.prevVF = vF;
  p.roll = damp(p.roll, clamp(p.yawRate * vF * 0.004, -0.12, 0.12) - (p.onSc ? 0 : Math.atan(T.bank[p.idx])), 8, dt); // 기울어진 커브에서는 차도 기울어짐
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
  const surf = p.air < 0.05 ? (p.onSc ? game.T.sc.surf : game.T.surf[p.idx]) : null;
  if ((surf === 'sand' || surf === 'mud') && Math.abs(p.vF) > 8 && Math.random() < 0.7) {
    for (const x of [-1.1, 1.1]) Particles.emit(kartPoint(k, x, 0.3, -1.5), { color: surf === 'mud' ? 0x6b4423 : 0xe0c08a, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 4, life: 0.5, size: 0.7, grav: 8, alpha: 0.8 });
  }
  if (Math.abs(p.lat) > HW + 0.8 && p.air < 0.05 && Math.abs(p.vF) > 10 && Math.random() < 0.6) {
    Particles.emit(kartPoint(k, 0, 0.3, -1.6), { color: 0xc8a46a, vy: 1.5, life: 0.6, size: 0.9, grow: 2, alpha: 0.6 });
  }
}
