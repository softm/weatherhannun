const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('화면날씨 다이얼로그의 색상·테두리·칩·버튼 언어를 전체 화면에 공유한다',()=>{
  const html=read('index.html'),css=read('dialog-inspired-theme.css'),sw=read('sw.js');
  assert.match(html,/dialog-inspired-theme\.css\?v=1/);
  assert.match(sw,/dialog-inspired-theme\.css\?v=1/);
  assert.match(css,/--ui-primary:#2376e8/);
  assert.match(css,/--ui-border:#bed8ec/);
  assert.match(css,/--ui-positive-soft:#e5f7f1/);
  assert.match(css,/box-shadow:var\(--ui-shadow-raised\)/);
  assert.match(css,/\.settings-card/);
  assert.match(css,/\.notification-preview-live/);
  assert.match(css,/@media\(max-width:710px\)/);
});
