const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("map separates official warnings, radar observations and radar forecasts",()=>{
 const html=fs.readFileSync("index.html","utf8");
 for(const token of [
  'id="officialMapLayerStatus"',
  "https://www.weather.go.kr/w/special-report/overall.do",
  "https://www.weather.go.kr/w/weather/radar/radar.do",
  "https://www.weather.go.kr/w/weather/radar/rain.do",
  "레이더 관측",
  "레이더 강수 예측",
  "관측 기준시각·범례"
 ])assert.ok(html.includes(token),token);
 assert.match(html,/앱 내부 지도 레이어는 이용권·관측시각·범례 연동을 검증한 뒤 활성화/);
});

test("official data is resolved from a key-free licensed snapshot and cached offline",()=>{
 const ui=fs.readFileSync("official-data-ui.js","utf8");
 const worker=fs.readFileSync("sw.js","utf8");
 assert.match(ui,/WeatherHannunOfficialData/);
 assert.match(ui,/data\/official\/latest\.json/);
 assert.match(ui,/weatherhannun:official-data/);
 for(const asset of ["official-data-core.js?v=39","official-data.css?v=39","official-data-ui.js?v=39","data/official/latest.json"])assert.ok(worker.includes(asset),asset);
});

test("deployment sync keeps credentials server-side and publishes evidence metadata",()=>{
 const sync=fs.readFileSync("scripts/sync-official-data.mjs","utf8");
 const workflow=fs.readFileSync(".github/workflows/pages.yml","utf8");
 assert.match(sync,/KMA_API_HUB_KEY/);
 assert.match(sync,/DATA_GO_KR_SERVICE_KEY/);
 assert.match(sync,/kma_sfctm5\.php/);
 assert.match(sync,/wrn_now_data\.php/);
 assert.match(sync,/nph-rdr_cmp1_img/);
 assert.match(sync,/getCtprvnRltmMesureDnsty/);
 assert.match(workflow,/secrets\.KMA_API_HUB_KEY/);
 assert.doesNotMatch(fs.readFileSync("index.html","utf8"),/KMA_API_HUB_KEY|DATA_GO_KR_SERVICE_KEY/);
});

test("users can inspect official source, approval and license evidence",()=>{
 const page=fs.readFileSync("official-rights.html","utf8");
 const index=fs.readFileSync("index.html","utf8");
 for(const token of ["공식 자료·이용권 증빙","승인·응답 검증 상태 공개","official-rights.html"])assert.ok(index.includes(token),token);
 for(const token of ["data/official/latest.json","공급자·이용조건","GitHub Actions Secrets","동일 기상청 관측소"])assert.ok(page.includes(token),token);
});
