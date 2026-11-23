// 소리
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

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
    throw() { noise(0.25, 0.25, 1400); tone(500, 0.2, 'sine', 0.08, 0, 300); },
    splat() { noise(0.35, 0.4, 1600); tone(300, 0.25, 'sine', 0.1, 0, -150); },
    shield() { tone(520, 0.12, 'triangle', 0.14); tone(780, 0.25, 'triangle', 0.14, 0.08); },
    block() { tone(1200, 0.2, 'triangle', 0.16, 0, -400); },
    magnet() { tone(300, 0.5, 'sawtooth', 0.06, 0, 400); },
    honey() { tone(180, 0.4, 'sine', 0.16, 0, -60); },
    ice() { [1500, 1900, 2300].forEach((f, i) => tone(f, 0.12, 'triangle', 0.08, i * 0.05)); },
    bubble() { [700, 1100, 850, 1300, 950].forEach((f, i) => tone(f, 0.06, 'sine', 0.1, i * 0.07)); },
    star() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.07, i * 0.06)); },
    hint() { tone(1319, 0.15, 'sine', 0.16); tone(1760, 0.3, 'sine', 0.14, 0.1); },
    buzz() { [0, 0.08, 0.16, 0.24].forEach((d) => tone(220 + d * 200, 0.12, 'sawtooth', 0.06, d, 40)); },
    whoosh() { noise(0.7, 0.35, 600); tone(150, 0.6, 'sine', 0.08, 0, 250); },
    swish() { noise(0.3, 0.25, 2200); tone(700, 0.25, 'triangle', 0.08, 0, -300); },
    warn() { tone(1046, 0.08, 'square', 0.09); },
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
