const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('공통 API의 stale 예보는 기본 화면에서 거부하고 명시한 전국지도만 마지막 정상값을 사용한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  assert.match(source,/MAX_SAVED_FORECAST_AGE_MS = 60 \* 60 \* 1000/);
  assert.match(source,/var stale=canonical\.stale===true\|\|canonical\.cache\?\.fallback===true/);
  assert.match(source,/!freshForecastTimestamp\(fetchedAt\)\|\|\(stale&&!options\?\.allowStale\)/);
  assert.match(source,/if\(!freshForecastTimestamp\(cache\.at\)\)return false/);
  assert.match(source,/fetchedAt:fetchedAt/);
  assert.match(source,/STATE\.fetchedAt=result\.fetchedAt\|\|new Date\(\)\.toISOString\(\)/);
});
