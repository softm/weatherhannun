const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('오늘 화면은 한 줄 흐름과 얇은 구분선 중심의 간결한 정보 구조를 쓴다',()=>{
  const css=read('clean-weather.css');
  assert.match(css,/\.stitch-dashboard-grid\{display:flex;gap:0/);
  assert.match(css,/border-width:0 0 1px/);
  assert.match(css,/box-shadow:none/);
  assert.match(css,/\.stitch-hour-cell\{min-width:64px/);
  assert.match(css,/\.section-overline\{display:none/);
});

test('간결한 화면 자산은 페이지와 오프라인 셸에 포함된다',()=>{
  const html=read('index.html'),sw=read('sw.js');
  assert.match(html,/clean-weather\.css\?v=1/);
  assert.match(sw,/clean-weather\.css\?v=1/);
  assert.match(sw,/weatherhannun-shell-v66-clean-weather/);
});
