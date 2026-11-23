// headless Chrome 으로 index.html#<hash> 를 열고 콘솔의 SIM 결과를 받아 온다.
// 사용: node test/sim.mjs [--save 파일 | --compare 파일] [hash ...]
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BROWSERS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) { console.error('Chrome/Edge 를 찾지 못함'); process.exit(2); }

const args = process.argv.slice(2);
let save = null, compare = null, extra = [];
const hashes = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--save') save = args[++i];
  else if (args[i] === '--compare') compare = args[++i];
  else if (args[i] === '--swiftshader') extra = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720']; // 그래픽카드 없이 소프트웨어 렌더링
  else hashes.push(args[i]);
}
if (!hashes.length) hashes.push('sim=600&track=0', 'sim=600&track=1', 'sim=600&track=0&subject=english', 'sim=600&track=1&drift=1');

const page = pathToFileURL(resolve(import.meta.dirname, '..', 'index.html')).href;

function run(hash, extra = []) {
  return new Promise((done) => {
    const dir = mkdtempSync(join(tmpdir(), 'edukart-')); // 매번 새 저장소: 틀린 문제 bank 가 섞이지 않게
    const proc = spawn(browser, ['--headless=new', '--enable-logging=stderr', '--v=0', `--user-data-dir=${dir}`, '--no-first-run',
      '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', ...extra, `${page}#${hash}`]);
    let buf = '', result = null;
    const errors = [];
    const finish = (why) => {
      clearTimeout(timer); proc.kill();
      setTimeout(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* 잠김 무시 */ } }, 500);
      done({ hash, result, errors, why });
    };
    proc.stderr.on('data', (d) => {
      buf += d;
      let k;
      while ((k = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, k); buf = buf.slice(k + 1);
        if (/CONSOLE/.test(line) && /Uncaught|Error/.test(line) && !/runtime\.lastError|chrome-extension:\/\//.test(line)) errors.push(line.trim().slice(0, 300));
        const m = /"(?:SIM|BENCH|AUDIO) (\{.*\})"/.exec(line); // #bench 는 BENCH, #audiotest 는 AUDIO 로 출력
        if (m) { result = JSON.parse(m[1].replace(/\\"/g, '"')); finish('ok'); return; }
      }
    });
    const timer = setTimeout(() => finish('timeout'), 90000);
    proc.on('exit', () => { if (!result) finish('exit'); });
  });
}

let failed = false;
const out = {};
for (const h of hashes) {
  const r = await run(h, extra);
  out[h] = r.result;
  console.log(`${h} → ${r.result ? JSON.stringify(r.result) : '결과 없음 (' + r.why + ')'}`);
  if (!r.result || r.errors.length) failed = true;
  for (const e of r.errors) console.log('  콘솔 오류: ' + e);
  // 컴퓨터가 한 프레임에 크게 튀면(지름길 드나들 때 순간이동 등) 실패
  if (r.result && r.result.aiJump > 3) { failed = true; console.log(`  컴퓨터 위치가 한 프레임에 ${r.result.aiJump} 튐 (3 초과)`); }
}
if (save) writeFileSync(save, JSON.stringify(out, null, 1));
if (compare) {
  const base = JSON.parse(readFileSync(compare, 'utf8'));
  for (const h of hashes) {
    const a = JSON.stringify(base[h]), b = JSON.stringify(out[h]);
    if (a !== b) { failed = true; console.log(`차이 ${h}\n  기준: ${a}\n  지금: ${b}`); }
  }
  if (!failed) console.log('기준과 같음');
}
process.exit(failed ? 1 : 0);
