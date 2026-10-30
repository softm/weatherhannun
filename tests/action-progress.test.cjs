const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const source=fs.readFileSync(path.join(__dirname,"../action-progress.js"),"utf8");
const app=fs.readFileSync(path.join(__dirname,"../app.js"),"utf8");
const locationManager=fs.readFileSync(path.join(__dirname,"../location-manager.js"),"utf8");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const css=fs.readFileSync(path.join(__dirname,"../action-progress.css"),"utf8");
const sw=fs.readFileSync(path.join(__dirname,"../sw.js"),"utf8");

test("공통 진행 표시가 화면 이동과 버튼 동작을 감지하고 접근성 상태를 제공한다",()=>{
  assert.match(source,/role\",\"status/);
  assert.match(source,/aria-live\",\"polite/);
  assert.match(source,/closest\(\"a\[href\],button,\[role=button\]\"\)/);
  assert.match(source,/WeatherActionProgress=\{begin:begin,end:end,pulse:pulse,track:track\}/);
  assert.match(css,/\.action-progress\{/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test("실제 비동기 날씨·지도·GPS 동작은 완료 시점까지 진행 상태를 유지한다",()=>{
  assert.match(app,/begin\("날씨 정보를 불러오는 중…"\)/);
  assert.match(app,/begin\("전국 날씨를 불러오는 중…"\)/);
  assert.match(app,/WeatherActionProgress\?\.end\(progressId\)/);
  assert.match(locationManager,/begin\("현재 위치를 확인하는 중…"\)/);
  assert.match(locationManager,/WeatherActionProgress\?\.end\(progressId\)/);
});

test("진행 표시 자산이 페이지와 오프라인 셸에 포함된다",()=>{
  assert.match(html,/action-progress\.js\?v=40/);
  assert.match(html,/action-progress\.css\?v=40/);
  assert.match(sw,/action-progress\.js\?v=40/);
  assert.match(sw,/action-progress\.css\?v=40/);
  assert.match(sw,/weatherhannun-shell-v62-location-save/);
});
