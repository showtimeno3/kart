// 공용 상수·유틸, 설정·저장, 음성
// 게임 스크립트들은 최상위 선언을 서로 공유한다 (index.html 의 순서대로 읽힘).
'use strict';

const M = window.Models;
const LAPS = 3, N = 1600, HW = 20, LANE = 12, EDGE = HW + 5.2, AI_COUNT = 7;
const MAX_SPEED = 38, BOOST_MUL = 1.4, G = 30, KMH = 3.2;
const LANE_COLORS = ['#e74c3c', '#2e86de', '#1e8449'];
const FONT = "'Jua', 'Malgun Gothic', sans-serif";
const SPECIES_KEYS = Object.keys(M.SPECIES);

const $ = (id) => document.getElementById(id);
const textCache = {};
const setText = (id, v) => { v = String(v); if (textCache[id] !== v) { textCache[id] = v; $(id).textContent = v; } };
const styleCache = {};
const setStyle = (id, prop, v) => { const k = id + prop; if (styleCache[k] !== v) { styleCache[k] = v; $(id).style[prop] = v; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt)); // 프레임 속도와 무관한 부드러운 접근
const approach = (a, b, step) => (a < b ? Math.min(b, a + step) : Math.max(b, a - step));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const wrapU = (d) => d - Math.round(d); // 한 바퀴 비율 차이를 -0.5~0.5 로
const bump = (u, c, w) => Math.exp(-((wrapU(u - c) / w) ** 2));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const UP = new THREE.Vector3(0, 1, 0);
const SUN_DIR = new THREE.Vector3(-0.45, 0.5, 0.75).normalize(); // 햇빛 방향 (그림자와 하늘의 해 위치가 같게)
const tmpV = new THREE.Vector3();

const TRACKS = window.TRACKS;
let game = null; // 지금 경주 상태 (메뉴에서는 null)

// ---------- 설정 ----------
const settings = { subject: 'math', level: 1, track: 0, species: 'bear', quality: 'high', difficulty: 1, volMusic: 55, volSfx: 80 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('eduKart.settings')) || {}); } catch (e) { /* 저장소 없음 */ }
if (!M.SPECIES[settings.species]) settings.species = 'bear';
const saveSettings = () => { try { localStorage.setItem('eduKart.settings', JSON.stringify(settings)); } catch (e) { /* 무시 */ } };
const STRING_GROUPS = ['subject', 'species', 'quality'];
function refreshMenu() {
  document.querySelectorAll('.opt').forEach((b) => b.classList.toggle('on', String(settings[b.dataset.group]) === b.dataset.v));
  const best = loadBest(settings.track);
  $('best').textContent = best ? `🏆 최고 기록 ${fmtTime(best)}` : '';
}
document.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
  const grp = b.dataset.group, v = b.dataset.v;
  settings[grp] = STRING_GROUPS.includes(grp) ? v : Number(v);
  refreshMenu(); saveSettings(); Sound.sfx.click();
  if (grp === 'species') showcase.setSpecies(v);
  if (grp === 'quality') applyQuality();
}));

const bankKey = () => `eduKart.wrong.${settings.subject}.${settings.level}`;
function loadBank() { try { return JSON.parse(localStorage.getItem(bankKey())) || []; } catch (e) { return []; } }
function saveBank(b) { try { localStorage.setItem(bankKey(), JSON.stringify(b.slice(-30))); } catch (e) { /* 무시 */ } }
function loadBest(track) { try { return +localStorage.getItem(`eduKart.best.${track}`) || 0; } catch (e) { return 0; } }
function saveBest(track, t) { try { localStorage.setItem(`eduKart.best.${track}`, String(t)); } catch (e) { /* 무시 */ } }

// 영어 단어를 소리 내어 읽을 수 있는가 (음성 기능, 음소거, 효과음 음량)
const canSpeak = () => !!window.speechSynthesis && !Sound.muted && settings.volSfx > 0;
// interrupt=false: 읽고 있던 말(앞 문제 정답 단어)을 끊지 않고 뒤에 이어 읽음
function speak(text, interrupt = true) {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.85; u.volume = settings.volSfx / 100;
  if (interrupt) speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
