// 입력
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

// ---------- 입력 ----------
const keys = {}, pressed = {};
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'drift', ShiftRight: 'drift', Space: 'item' };
function press(k) {
  if (k === 'item' && !keys.item) useItem(keys.down); // ↓ 누른 채면 뒤로 던짐
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
