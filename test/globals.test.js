// 게임 스크립트들은 최상위 선언(const/let/function)을 서로 공유한다.
// 1) index.html 순서대로 이어 붙여 한 스크립트로 파싱 → 같은 이름을 두 파일에서 선언하면 SyntaxError
// 2) 브라우저 window 의 바꿀 수 없는 이름과 겹치지 않는지
// 3) 파일 하나가 너무 커지지 않았는지 (분리 목표: 600줄 이하)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1]);
assert.ok(files.length > 0, 'index.html 에서 js 스크립트를 못 찾음');

const sources = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8'));
const joined = sources.join('\n;\n');
try { new vm.Script(joined, { filename: 'joined.js' }); } catch (e) { assert.fail(`이어 붙인 스크립트 파싱 실패 (이름 겹침?): ${e.message}`); }

const RESTRICTED = ['top', 'location', 'document', 'window', 'self', 'parent', 'frames', 'name', 'status', 'closed', 'length', 'origin', 'event', 'history', 'navigator'];
for (const n of RESTRICTED) {
  try { new vm.Script(`${joined}\n;let ${n};`); } catch (e) { assert.fail(`window 의 '${n}' 과 같은 이름을 최상위에서 선언함`); }
}

// 같은 이름의 function 선언은 이어 붙여도 문법 오류가 아니라서(뒤 파일이 조용히 덮어씀) 따로 검사
const fnOwner = {};
files.forEach((f, k) => {
  for (const m of sources[k].matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
    assert.ok(!fnOwner[m[1]], `function ${m[1]} 이 ${fnOwner[m[1]]} 와 ${f} 에 둘 다 있음`);
    fnOwner[m[1]] = f;
  }
});
files.forEach((f, k) => {
  const lines = sources[k].split('\n').length;
  assert.ok(lines <= 600, `${f} 가 ${lines}줄 (600줄 이하로 나눌 것)`);
});
console.log(`globals: all tests passed (${files.length} files)`);
