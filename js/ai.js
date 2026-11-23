// 컴퓨터, 움직이는 장애물
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

// ---------- 컴퓨터 ----------
const SC_PROB = { aggro: 0.5, steady: 0.1, prank: 0.3 }; // 성격별 지름길로 갈 확률
function updateAIs(dt) {
  const { ais, T, A, p } = game;
  const pt = playerTotal(), racing = game.state === 'race';
  for (const a of ais) {
    a.boost = Math.max(0, a.boost - dt); a.slow = Math.max(0, a.slow - dt); a.padCd = Math.max(0, a.padCd - dt);
    if (a.spin > 0) a.spin -= dt;
    let target = racing ? a.base * (a.boost > 0 ? 1.35 : 1) * (a.slow > 0 ? 0.6 : 1) * (a.spin > 0 ? 0.25 : 1) * (a.sticky > 0 ? 0.5 : 1) * (SURF_SPEED[a.sc ? T.sc.surf : T.surf[a.idx]] || 1) : 0;
    const gap = aiTotal(a) - pt; // 고무줄: 격차가 크면 조금 조절
    if (!p.finished) { if (gap > 160) target *= 0.88; else if (gap < -160) target *= 1.12; }
    a.speed = approach(a.speed, target, (target > a.speed ? 10 : 25) * dt);
    const prev = a.idx, sc = T.sc;
    if (a.sc) { // 지름길: 지름길 거리만큼 가면 본 도로 갈림점 사이 거리만큼 진행한 것으로 셈
      a.sc.s += a.speed * dt; a.d += a.speed * dt * (sc.span * T.segLen) / sc.len;
      if (a.sc.s >= sc.len) a.sc = null;
    } else a.d += a.speed * dt;
    const f = (a.d / T.segLen) % N;
    a.idx = Math.floor(f);
    if (!a.sc && sc && racing && crossed(prev, a.idx, sc.i0) && Math.random() < SC_PROB[a.persona]) { a.sc = { s: 0 }; a.planGate = null; }
    // 다가오는 문의 문제가 보이면 정답(또는 실수로 오답) 차선으로 이동
    const [g, dist] = nextGateFrom(a.idx);
    if (!a.sc && g && dist < 110 && a.planGate !== g) {
      a.planGate = g;
      if (g.q) {
        a.planLane = Math.random() < a.skill + (a.hint ? 0.25 : 0) ? g.q.answer : (g.q.answer + 1 + Math.floor(Math.random() * 2)) % 3;
        a.latT = [-LANE, 0, LANE][a.planLane];
      } else a.planLane = -1;
    }
    for (const gg of game.gates) {
      if (a.sc || !crossed(prev, a.idx, gg.i)) continue; // 지름길로 건너뛴 문은 안 셈
      const ok = gg.q && a.planGate === gg && a.planLane >= 0 ? laneOf(a.lat) === gg.q.answer : Math.random() < a.skill;
      if (ok) a.boost = 1.3; else a.slow = 1.0;
      a.planGate = null; a.hint = false; a.latT = (Math.random() * 2 - 1) * 12;
    }
    for (const pd of A.pads) if (!a.sc && a.padCd === 0 && inRange(a.idx, pd.i0 - 4, 8) && Math.abs(a.lat - pd.lat) < 5) { a.boost = Math.max(a.boost, 1.0); a.padCd = 0.6; }
    for (const r of A.ramps) if (!a.sc && crossed(prev, a.idx, r.i1) && Math.abs(a.lat - r.lat) < r.w / 2) a.vy = 8 + r.h * 2 + a.speed * 0.08;
    const inside = a.persona === 'aggro' && Math.abs(T.curv[a.idx]) > 0.1 ? -Math.sign(T.curv[a.idx]) * 4 : 0; // 공격형은 커브 안쪽
    a.latV = damp(a.latV, (a.latT + inside - a.lat) * 1.4, (a.sc ? T.sc.surf : T.surf[a.idx]) === 'ice' ? 1.2 : 3.5, dt); // 얼음에서는 옆으로 미끄러짐
    const half = a.sc ? SHW - 1.5 : HW - 1.5;
    a.lat = clamp(a.lat + a.latV * dt, -half, half);
    if (racing) {
      a.banana -= dt;
      if (a.banana <= 0) { a.banana = a.persona === 'prank' ? 8 + Math.random() * 6 : 14 + Math.random() * 16; dropHazard('banana', a); }
    }
    if (!a.finished && aiTotal(a) >= LAPS * N) { a.finished = true; a.finishTime = game.t; }

    // 위치 계산
    const i0 = Math.floor(f) % N, i1 = (i0 + 1) % N;
    if (a.sc) {
      const kf = Math.min(a.sc.s / sc.step, sc.n - 1.001), k0 = Math.floor(kf);
      a.scK = k0;
      a.pos.lerpVectors(sc.pos[k0], sc.pos[k0 + 1], kf - k0).addScaledVector(sc.right[k0], a.lat);
      vertical(a, sc.pos[k0].y, dt);
    } else {
      a.pos.lerpVectors(T.pos[i0], T.pos[i1], f - Math.floor(f)).addScaledVector(T.right[i0], a.lat);
      vertical(a, groundY(T, A, f, a.lat), dt);
    }
    a.pos.y = a.y;
    const curv = a.sc ? 0 : T.curv[i0], drifting = Math.abs(curv) > 0.22 && a.speed > 26 && a.spin <= 0 && a.y - a.gy < 0.1;
    a.bodyYaw = damp(a.bodyYaw, drifting ? Math.sign(curv) * 0.36 : 0, 5, dt);
    a.roll = damp(a.roll, clamp(curv * a.speed * 0.012, -0.12, 0.12) - (a.sc ? 0 : Math.atan(T.bank[i0])), 6, dt);
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

// 컴퓨터끼리 부딪힘: 가까우면 옆으로 밀어내고, 뒤 카트는 앞 카트보다 빨리 못 감
function separateAIs(dt) {
  const { ais, T } = game;
  for (let i = 0; i < ais.length; i++) for (let j = i + 1; j < ais.length; j++) {
    const a = ais[i], b = ais[j], dd = (aiTotal(a) - aiTotal(b)) * T.segLen, dl = a.lat - b.lat;
    if (!!a.sc !== !!b.sc || Math.abs(dd) > 3.5 || Math.abs(dl) > 2.6 || Math.abs(a.y - b.y) > 2.5) continue; // 한쪽만 지름길이면 다른 길
    const s = dl >= 0 ? 1 : -1;
    a.latV += s * 20 * dt; b.latV -= s * 20 * dt;
    const [front, back] = dd >= 0 ? [a, b] : [b, a];
    back.speed = Math.min(back.speed, front.speed);
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
