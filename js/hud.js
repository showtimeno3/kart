// 미니맵, HUD, 결과 화면
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

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
  if (T.sc) { // 지름길: 가는 점선
    c.beginPath(); T.sc.pos.forEach((v, k) => { const [x, y] = map(v); k ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.setLineDash([4, 3]); c.strokeStyle = '#c8a46a'; c.lineWidth = 3; c.stroke(); c.setLineDash([]);
  }
  return { bg, map, ctx: cv.getContext('2d'), W };
}
// 뒤에서 날아오는 공격 경고: 아이템 칸 왼쪽, 가까워질수록 막대가 차고 빨개짐, 첫 칸이 방패면 안내
let warnBeep = 0, warnOn = false;
function updateWarn(dt) {
  const p = game.p, th = game.state === 'race' && !p.finished ? incomingThreat(p) : null;
  $('warn').classList.toggle('hidden', !th);
  if (!th) { warnOn = false; return; }
  const k = 1 - th.dist / WARN_RANGE;
  setText('warn-text', `⚠️ ${th.front ? '앞' : '뒤'}에서 ${th.icon}!${p.items[0] === 'shield' ? (touchMode ? ' 아이템 버튼으로 🛡️!' : ' Space 로 🛡️!') : ''}`);
  setStyle('warn-fill', 'width', `${Math.round(k * 100)}%`);
  setStyle('warn-fill', 'background', k > 0.6 ? '#ff3b30' : '#ffb300');
  if (!warnOn) { warnOn = true; warnBeep = 0; game.stats.warns = (game.stats.warns || 0) + 1; }
  if ((warnBeep -= dt) <= 0) { Sound.sfx.warn(); warnBeep = th.dist < 40 ? 0.25 : 0.8; }
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
  for (const s of game.shots) {
    if (s.kind === 'bee') dot(s.mesh.position, '#ffd84d', 6); // 벌떼는 크게 (누가 던졌든)
    else if (s.owner !== game.p) dot(s.mesh.position, '#ff3b30', 3); // 다른 카트가 던진 공격 아이템
  }
  dot(game.p.pos, '#ffffff', 7);
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
  const t = p.onSc ? game.T.sc.right[p.scK] : game.T.right[p.idx], dot = Math.sin(p.h) * t.z - Math.cos(p.h) * t.x;
  game.wrongT = game.state === 'race' && !p.finished && dot < -0.3 && Math.abs(p.vF) > 3 ? game.wrongT + dt : 0;
  $('wrongway').classList.toggle('hidden', game.wrongT < 1);
  // 첫 경기 안내
  if (game.tutorial && game.state === 'race') {
    while (game.tutorial.length && game.t >= game.tutorial[0][0]) flashTip(game.tutorial.shift()[1], 6);
  }
  // 아이템 지속 효과 표시 (남은 초) + 비눗방울 화면 가장자리
  const fx = [['shield', '🛡️'], ['star', '🌈'], ['sticky', '🍯'], ['bubble', '🫧']].filter(([f]) => p[f] > 0).map(([f, i]) => `${i}${Math.ceil(p[f])}`);
  if (p.hint) fx.push('💡');
  setText('fx', fx.join(' '));
  setStyle('bubbles', 'opacity', p.bubble > 0 ? '1' : '0');
  updateWarn(dt);
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
