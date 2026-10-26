const test = require('node:test');
const assert = require('node:assert/strict');
const planner = require('../agriculture-planner-core.js');
const activities = require('../activity-decision-core.js');

function forecast(overrides = {}) {
  const time = Array.from({length: 48}, (_, index) => `2026-04-${String(10 + Math.floor(index / 24)).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:00`);
  const series = (value) => Array.from({length: 48}, (_, index) => typeof value === 'function' ? value(index) : value);
  return {
    current: {time: time[0]},
    hourly: {
      time,
      temperature_2m: series(18),
      precipitation_probability: series(10),
      precipitation: series(0),
      wind_speed_10m: series(6),
      wind_gusts_10m: series(12),
      relative_humidity_2m: series(62),
      is_day: series(index => index % 24 >= 6 && index % 24 < 19 ? 1 : 0),
      ...overrides
    }
  };
}

test('fruit flowering thresholds use the published crop-specific values and source', () => {
  const data = forecast({temperature_2m: Array.from({length: 48}, (_, index) => index === 5 ? -2.2 : 8)});
  const result = planner.evaluate(data, {crop: 'apple', stage: 'flowering', activityCore: activities});
  const cold = result.risks.find(item => item.type === 'crop_low_temperature');
  assert.equal(result.cropRuleAvailable, true);
  assert.equal(cold.threshold, -2.2);
  assert.match(cold.source.url, /rda\.go\.kr/);
  assert.match(cold.evidence, /-2\.2°C/);
});

test('rice flowering heat signal starts at the official 35 degree threshold', () => {
  const data = forecast({temperature_2m: Array.from({length: 48}, (_, index) => index === 8 ? 35 : 26)});
  const result = planner.evaluate(data, {crop: 'rice', stage: 'flowering'});
  const heat = result.risks.find(item => item.type === 'crop_high_temperature');
  assert.equal(heat.threshold, 35);
  assert.match(heat.source.url, /rda\.go\.kr/);
});

test('missing temperatures never create a crop-safe or crop-risk verdict', () => {
  const data = forecast({temperature_2m: Array(48).fill(null)});
  const result = planner.evaluate(data, {crop: 'pear', stage: 'flowering'});
  assert.equal(result.coverage.temperature, 0);
  assert.equal(result.risks.some(item => item.type.includes('temperature')), false);
  assert.equal(result.risks.length, 0);
});

test('stages without a verified crop threshold expose only shared weather signals', () => {
  const rain = Array(48).fill(0); rain[3] = 0.3;
  const result = planner.evaluate(forecast({precipitation: rain}), {crop: 'peach', stage: 'harvest'});
  assert.equal(result.cropRuleAvailable, false);
  assert.match(result.profileMessage, /전용 온도 기준이 없어/);
  assert.deepEqual(result.risks.map(item => item.type), ['rain_work_signal']);
});

test('three-hour work windows and export retain evidence without claiming field safety', () => {
  const result = planner.evaluate(forecast(), {crop: 'rice', stage: 'growth', activityCore: activities});
  assert.ok(result.windows.harvest.length > 0);
  assert.ok(result.windows.spray.length > 0);
  assert.ok(result.windows.irrigation.length > 0);
  const report = planner.report({site: '서산 농장', result, generatedAt: '2026-10-27 09:00', sourceLabel: 'Open-Meteo 모델 예보'});
  assert.match(report, /서산 농장/);
  assert.match(report, /규칙: WH-P02-RISK-v1/);
  assert.match(report, /모델 예보 기반 사전 점검/);
  assert.doesNotMatch(report, /안전합니다|피해가 없습니다/);
});

test('low scoring work periods are not presented as recommended windows', () => {
  const result = planner.evaluate(forecast({
    precipitation_probability: Array(48).fill(100),
    precipitation: Array(48).fill(8),
    wind_speed_10m: Array(48).fill(45),
    wind_gusts_10m: Array(48).fill(70),
    relative_humidity_2m: Array(48).fill(98)
  }), {crop: 'rice', stage: 'growth', activityCore: activities});
  assert.equal(planner.MIN_WORK_WINDOW_SCORE, 60);
  assert.equal(result.windows.harvest.length, 0);
  assert.equal(result.windows.spray.length, 0);
  assert.equal(result.windows.irrigation.length, 0);
});

test('unsupported crop or stage is explicit rather than silently falling back', () => {
  const result = planner.evaluate(forecast(), {crop: 'unknown', stage: 'flowering'});
  assert.equal(result.available, false);
  assert.match(result.reason, /지원하지 않는/);
});
