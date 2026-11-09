const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('공통 API의 stale 상태와 실제 수집 시각을 화면 상태에 보존한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  assert.match(source,/fallback:canonical\.stale===true\|\|canonical\.cache\?\.fallback===true/);
  assert.match(source,/fetchedAt:canonical\.source\?\.fetchedAt\|\|null/);
  assert.match(source,/STATE\.fetchedAt=result\.fetchedAt\|\|new Date\(\)\.toISOString\(\)/);
});
