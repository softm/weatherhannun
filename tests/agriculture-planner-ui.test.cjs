const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('agriculture Premium planner is entitlement and commercial-rights gated', () => {
  const html = read('index.html');
  const ui = read('agriculture-planner.js');
  assert.match(html, /id="agriculturePlannerControls" disabled/);
  assert.match(html, /농업 Premium 권한과 상업 데이터 이용권/);
  assert.match(ui, /entitled\(\)&&releaseAllowed\(\)/);
  assert.match(ui, /if\(!usable\(\)\)return renderGate\(\)/);
  assert.match(ui, /WeatherProviderCore/);
  assert.match(ui, /freshness==="fresh"/);
  assert.doesNotMatch(ui, /api[_-]?key|Authorization/i);
});

test('planner ships crop, stage, multiple-site, evidence and export surfaces offline', () => {
  const html = read('index.html');
  const worker = read('sw.js');
  for (const token of ['agricultureCrop', 'agricultureStage', 'agricultureSites', 'agriculturePlanRun', 'agriculturePlanExport']) {
    assert.ok(html.includes(token), token);
  }
  for (const asset of ['agriculture-planner.css?v=34', 'agriculture-planner-core.js?v=34', 'agriculture-planner.js?v=34']) {
    assert.ok(html.includes(asset), asset);
    assert.ok(worker.includes(asset), asset);
  }
  assert.ok(html.indexOf('activity-decision-core.js?v=28') < html.indexOf('agriculture-planner-core.js?v=34'));
  assert.ok(html.indexOf('agriculture-planner-core.js?v=34') < html.indexOf('agriculture-planner.js?v=34'));
});

test('official crop thresholds keep direct RDA or Nongsaro evidence links', () => {
  const core = read('agriculture-planner-core.js');
  assert.match(core, /rda\.go\.kr/);
  assert.match(core, /nongsaro\.go\.kr/);
  assert.match(core, /-2\.2/);
  assert.match(core, /35/);
  assert.match(core, /전용 온도 기준이 없어 공통 강수·돌풍 신호만 표시/);
});
