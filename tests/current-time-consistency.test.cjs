const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('공통 API의 stale 예보는 거부하고 실제 수집 시각이 최신인 경우만 사용한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  assert.match(source,/MAX_SAVED_FORECAST_AGE_MS = 60 \* 60 \* 1000/);
  assert.match(source,/canonical\.stale===true\|\|canonical\.cache\?\.fallback===true\|\|!freshForecastTimestamp\(fetchedAt\)/);
  assert.match(source,/if\(!freshForecastTimestamp\(cache\.at\)\)return false/);
  assert.match(source,/fetchedAt:fetchedAt/);
  assert.match(source,/STATE\.fetchedAt=result\.fetchedAt\|\|new Date\(\)\.toISOString\(\)/);
});
