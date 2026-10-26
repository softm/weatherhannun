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

test("official data status is driven by the centralized release gate and cached offline",()=>{
 const ui=fs.readFileSync("official-data-ui.js","utf8");
 const worker=fs.readFileSync("sw.js","utf8");
 assert.match(ui,/WeatherProviderCore/);
 assert.match(ui,/gate\.officialWarnings\.reason/);
 assert.match(ui,/gate\.radar\.reason/);
 for(const asset of ["official-data.css?v=30","official-data-ui.js?v=30"])assert.ok(worker.includes(asset),asset);
});
