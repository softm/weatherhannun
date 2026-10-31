const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('상단 조작은 좌측 햄버거 메뉴에 한 번씩 배치된다',()=>{
  const html=read('index.html');
  assert.match(html,/id="headerMenuButton"[^>]+aria-controls="headerMenuDrawer"/);
  assert.match(html,/id="headerMenuDrawer"[^>]+aria-hidden="true"/);
  for(const id of ['locationButton','refreshButton','settingsButton']){
    assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id);
  }
  assert.match(html,/class="desktop-nav header-menu-nav"/);
});

test('햄버거 메뉴는 바깥 클릭과 ESC 및 기능 선택으로 닫힌다',()=>{
  const js=read('header-menu.js');
  assert.match(js,/backdrop\.addEventListener\('click'/);
  assert.match(js,/event\.key==='Escape'/);
  assert.match(js,/\[data-view\],#locationButton,#refreshButton/);
  assert.match(js,/aria-expanded/);
});

test('햄버거 메뉴 자산은 오프라인 셸에 포함된다',()=>{
  const sw=read('sw.js');
  assert.match(sw,/weatherhannun-shell-v66-clean-weather/);
  assert.match(sw,/header-menu\.css\?v=1/);
  assert.match(sw,/header-menu\.js\?v=1/);
});
