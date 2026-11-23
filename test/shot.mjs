// 화면 점검용 스크린샷: node test/shot.mjs <출력.png> <hash> [폭x높이]
// 콘솔 오류가 있으면 출력하고 exit 1
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const [out, hash = '', size = '1280,720'] = process.argv.slice(2);
const page = pathToFileURL(resolve(import.meta.dirname, '..', 'index.html')).href + (hash ? '#' + hash : '');
const r = spawnSync(browser, ['--headless=new', '--enable-logging=stderr', '--v=0', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edukart-'))}`,
  '--no-first-run', `--window-size=${size}`, '--virtual-time-budget=4000', `--screenshot=${resolve(out)}`, page], { encoding: 'utf8', timeout: 120000 });
const errs = (r.stderr || '').split('\n').filter((l) => /CONSOLE/.test(l) && /Uncaught|Error/.test(l));
errs.forEach((e) => console.log('콘솔 오류: ' + e.trim().slice(0, 300)));
console.log(existsSync(resolve(out)) ? `저장: ${out}` : '스크린샷 실패');
process.exit(errs.length || !existsSync(resolve(out)) ? 1 : 0);
