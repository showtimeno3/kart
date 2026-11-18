// 배경음악: WebAudio 로 직접 연주하는 작은 시퀀서 (음원 파일 없음). window.Music 으로 공개.
(function (root) {
  'use strict';
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const parseNote = (s) => { const m = /^([A-G]#?)(\d)$/.exec(s); return m ? NOTE[m[1]] + (+m[2] + 1) * 12 : null; };
  // 화음: 아르페지오 음(4개)과 베이스 근음
  const CHORD = {
    C: [[60, 64, 67, 72], 36], G: [[59, 62, 67, 71], 43], Am: [[57, 60, 64, 69], 45], F: [[57, 60, 65, 69], 41],
    E: [[56, 59, 64, 68], 40], Dm: [[57, 62, 65, 69], 38], Em: [[59, 64, 67, 71], 40],
  };

  // 멜로디: 한 마디 = 8분음표 8칸. '-' 는 앞 음 늘이기, '.' 는 쉼표.
  const SONGS = {
    menu: { bpm: 112, chords: ['C', 'Am', 'F', 'G'], lead: 'triangle', drums: 'soft',
      mel: ['G4 . C5 . E5 . G5 .', 'A5 - G5 . E5 . C5 .', 'F5 . A5 . C6 - A5 .', 'G5 - - . D5 . B4 .'] },
    meadow: { bpm: 140, chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'], lead: 'square', drums: 'bouncy',
      mel: ['E5 . G5 . C6 B5 A5 G5', 'D5 - - . B4 . D5 G5', 'C5 - E5 . A5 G5 E5 C5', 'F5 - - . A5 . G5 F5',
        'E5 . G5 . C6 . E6 D6', 'B5 - G5 . D5 . G5 A5', 'A5 G5 F5 E5 D5 . C5 D5', 'G5 - - - - . . .'] },
    desert: { bpm: 132, chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'E'], lead: 'sawtooth', drums: 'rock',
      mel: ['A4 . E5 . A5 G#5 E5 C5', 'F5 - E5 . D5 C5 D5 .', 'B4 . D5 G5 F5 - D5 B4', 'G#4 - B4 . E5 - - .',
        'C5 . E5 A5 C6 B5 A5 E5', 'F5 - A5 . G5 F5 E5 D5', 'E5 . D5 C5 B4 . C5 D5', 'E5 - - - G#4 . B4 .'] },
  };
  const JINGLES = {
    win: [['C5', 0, 0.12], ['E5', 0.12, 0.12], ['G5', 0.24, 0.12], ['C6', 0.36, 0.3], ['G5', 0.7, 0.12], ['C6', 0.84, 0.6]],
    good: [['G4', 0, 0.15], ['C5', 0.16, 0.15], ['E5', 0.32, 0.15], ['D5', 0.5, 0.35], ['C5', 0.9, 0.5]],
  };

  let ctx = null, bus = null, noiseBuf = null, timer = null, song = null, step = 0, nextT = 0, tempo = 1;

  function attach(audioCtx, dest) {
    ctx = audioCtx; bus = ctx.createGain(); bus.gain.value = 1; bus.connect(dest);
    const len = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function voice(n, t, dur, type, vol, cutoff) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = midi(n);
    f.type = 'lowpass'; f.frequency.value = cutoff || 3000;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(vol * 0.55, t + Math.min(0.12, dur * 0.5));
    g.gain.setValueAtTime(vol * 0.55, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.1);
  }
  function kick(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.2);
  }
  function hiss(t, dur, vol, type, freq) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  function schedule(s, t, sixteenth) {
    const bar = Math.floor(s / 16), k = s % 16;
    const [arp, root] = CHORD[song.chords[bar % song.chords.length]];
    // 베이스
    if (k % 4 === 0 || (song.drums !== 'soft' && k % 8 === 6)) voice(root + (k === 8 && song.drums === 'bouncy' ? 12 : 0), t, sixteenth * 1.6, 'triangle', 0.32, 900);
    // 아르페지오 (작게)
    voice(arp[k % 4] + 12, t, sixteenth * 0.8, 'triangle', song.drums === 'soft' ? 0.05 : 0.04, 2500);
    // 멜로디
    if (k % 2 === 0) {
      const toks = song.parsed[bar % song.parsed.length], i = k / 2, tok = toks[i];
      const n = parseNote(tok);
      if (n !== null) {
        let len = 1; while (toks[i + len] === '-') len++;
        voice(n, t, sixteenth * 2 * len * 0.9, song.lead, song.lead === 'square' ? 0.07 : song.lead === 'sawtooth' ? 0.06 : 0.12, song.lead === 'sawtooth' ? 1800 : 3200);
      }
    }
    // 드럼
    if (song.drums === 'soft') { if (k === 0) kick(t, 0.25); if (k % 4 === 2) hiss(t, 0.03, 0.05, 'highpass', 8000); return; }
    if (k === 0 || k === 8 || (song.drums === 'bouncy' && k === 10) || (song.drums === 'rock' && k === 7)) kick(t, 0.6);
    if (k === 4 || k === 12) { hiss(t, 0.14, 0.28, 'bandpass', 1800); }
    if (k % 2 === 0) hiss(t, 0.035, k % 4 === 2 ? 0.1 : 0.06, 'highpass', 7500);
  }

  function tick() {
    if (!ctx || !song) return;
    const sixteenth = 60 / (song.bpm * tempo) / 4;
    while (nextT < ctx.currentTime + 0.15) {
      schedule(step, nextT, sixteenth);
      nextT += sixteenth; step = (step + 1) % (song.parsed.length * 16);
    }
  }
  function play(name) {
    if (!ctx) return;
    const def = SONGS[name]; if (!def) return;
    if (song && song.name === name && timer) return;
    stop();
    song = Object.assign({ name, parsed: def.mel.map((m) => m.trim().split(/\s+/)) }, def);
    step = 0; tempo = 1; nextT = ctx.currentTime + 0.08;
    timer = setInterval(tick, 25); tick();
  }
  function stop() { if (timer) clearInterval(timer); timer = null; song = null; }
  function jingle(name) {
    if (!ctx) return;
    stop();
    const t0 = ctx.currentTime + 0.05;
    for (const [n, at, dur] of JINGLES[name]) { voice(parseNote(n), t0 + at, dur, 'square', 0.09, 3000); voice(parseNote(n) - 12, t0 + at, dur, 'triangle', 0.15, 2000); }
  }
  // 점검용: 곡을 처음부터 seconds 초까지 한꺼번에 예약 (OfflineAudioContext 로 녹음해 소리 확인)
  function prerender(name, seconds) {
    const def = SONGS[name];
    song = Object.assign({ name, parsed: def.mel.map((m) => m.trim().split(/\s+/)) }, def);
    const sixteenth = 60 / def.bpm / 4; let t = 0.05, s = 0;
    while (t < seconds) { schedule(s, t, sixteenth); t += sixteenth; s = (s + 1) % (song.parsed.length * 16); }
    song = null;
  }
  root.Music = {
    attach, play, stop, jingle, prerender, SONGS: Object.keys(SONGS),
    setTempo(x) { tempo = x; },
    pause(on) { if (on) { if (timer) clearInterval(timer); timer = null; } else if (song && !timer) { nextT = ctx.currentTime + 0.05; timer = setInterval(tick, 25); } },
    get playing() { return song && song.name; },
  };
})(this);
