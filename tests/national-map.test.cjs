const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('전국지도는 기온·강수·바람을 비교하는 핵심 브리핑을 제공한다',()=>{const html=read('index.html'),app=read('app.js'),css=read('national-map.css');assert.match(html,/id="nationalOverview"/);assert.match(html,/data-map-metric="temperature"/);assert.match(html,/data-map-metric="rain"/);assert.match(html,/data-map-metric="wind"/);assert.match(app,/function renderNationalOverview/);assert.match(app,/precipitation>0/);assert.match(app,/gust>=35/);assert.match(app,/function selectMapMetric/);assert.match(css,/\.national-overview\{/);assert.match(css,/\.metric-rain/);assert.match(css,/\.metric-wind/);});
test('전국 비교용 단기 예보는 체감·강수·바람·돌풍을 요청하고 오프라인 셸에 포함된다',()=>{const provider=read('weather-provider-core.js'),shell=read('sw.js');assert.match(provider,/current","temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day/);assert.match(shell,/national-map\.css\?v=41/);assert.match(shell,/weatherhannun-shell-v43-region-hub/);});
