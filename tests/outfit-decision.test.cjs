const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {RULE_VERSION, evaluate} = require('../outfit-decision-core.js');

function weather(options = {}) {
  const times = Array.from({length: 16}, (_, index) => {
    const utc = new Date(Date.UTC(2026, 9, 26, 18 + index));
    return utc.toISOString().slice(0, 16);
  });
  const series = (key, fallback) => times.map((_, index) => options[key] && Object.hasOwn(options[key], index) ? options[key][index] : fallback);
  return {
    current: {
      time: '2026-10-26T18:30',
      apparent_temperature: options.feels ?? 12,
      wind_speed_10m: options.currentWind ?? 7
    },
    hourly: {
      time: times,
      precipitation_probability: series('probability', 0),
      precipitation: series('precipitation', 0),
      wind_speed_10m: series('wind', 8),
      wind_gusts_10m: series('gust', 12)
    }
  };
}

test('publishes a stable WH-H03 rule version and evidence', () => {
  const answer = evaluate(weather({feels: 12}));
  assert.equal(RULE_VERSION, 'WH-H03-v1');
  assert.equal(answer.ruleVersion, RULE_VERSION);
  assert.match(answer.clothing.title, /가벼운 겉옷/);
  assert.deepEqual(answer.evidence.map(item => item.label), ['현재 모델 체감', '6시간 최대 바람', '12시간 강수']);
});

test('extreme cold and heat use conservative clothing wording', () => {
  const cold = evaluate(weather({feels: -12}));
  const hot = evaluate(weather({feels: 35}));
  assert.equal(cold.clothing.state, 'extreme-cold');
  assert.match(cold.clothing.title, /보온 소품/);
  assert.equal(hot.clothing.state, 'extreme-hot');
  assert.match(hot.clothing.title, /통풍/);
  assert.match(hot.clothing.detail, /최신 상태 재확인/);
});

test('strong wind adds a windbreaker using the six-hour forecast', () => {
  const answer = evaluate(weather({feels: 17, gust: {4: 35}}));
  assert.equal(answer.strongWind, true);
  assert.match(answer.clothing.title, /바람막이/);
  assert.match(answer.clothing.detail, /6시간 강한 바람/);
});

test('50 percent or 0.3mm per hour each trigger the umbrella rule', () => {
  const probability = evaluate(weather({probability: {2: 50}}));
  const precipitation = evaluate(weather({precipitation: {3: 0.3}}));
  assert.equal(probability.umbrella.state, 'needed');
  assert.equal(precipitation.umbrella.state, 'needed');
  assert.match(probability.umbrella.title, /우산 챙기기/);
  assert.match(precipitation.umbrella.detail, /0\.3mm/);
});

test('current-hour forecast is a rain signal, never an observation claim', () => {
  const answer = evaluate(weather({probability: {0: 80}}));
  assert.match(answer.umbrella.detail, /현재 시간대 강수 신호/);
  assert.doesNotMatch(answer.umbrella.detail, /비가 옵니다|관측/);
});

test('low rain values keep cautious optional wording', () => {
  const answer = evaluate(weather({probability: {2: 49}, precipitation: {2: 0.2}}));
  assert.equal(answer.umbrella.state, 'optional');
  assert.match(answer.umbrella.detail, /뚜렷한 강수 신호 낮음/);
  assert.match(answer.caution, /최신 예보와 실제 환경/);
});

test('missing feels-like does not invent clothing while rain remains usable', () => {
  const sample = weather({probability: {1: 70}});
  delete sample.current.apparent_temperature;
  const answer = evaluate(sample);
  assert.equal(answer.state, 'partial');
  assert.equal(answer.clothing.state, 'unknown');
  assert.match(answer.clothing.detail, /임의로 추천하지 않습니다/);
  assert.equal(answer.umbrella.state, 'needed');
});

test('missing rain arrays never become a no-rain recommendation', () => {
  const sample = weather();
  sample.hourly.precipitation_probability = null;
  sample.hourly.precipitation = undefined;
  const answer = evaluate(sample);
  assert.equal(answer.umbrella.state, 'unknown');
  assert.match(answer.umbrella.detail, /단정하지 않습니다/);
});

test('one available rain or wind field produces clean evidence text', () => {
  const sample = weather({precipitation: {2: 0.4}, gust: {2: 36}});
  sample.hourly.precipitation_probability = null;
  sample.hourly.wind_speed_10m = null;
  delete sample.current.wind_speed_10m;
  const answer = evaluate(sample);
  assert.equal(answer.evidence[1].value, '돌풍 36km/h');
  assert.equal(answer.evidence[2].value, '시간당 0.4mm');
});

test('malformed weather is fully unknown without throwing', () => {
  const answer = evaluate({});
  assert.equal(answer.state, 'unknown');
  assert.equal(answer.clothing.state, 'unknown');
  assert.equal(answer.umbrella.state, 'unknown');
});

test('page and offline shell load the complete outfit guide', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const asset of ['outfit-decision.css?v=24', 'outfit-decision-core.js?v=24', 'outfit-decision-ui.js?v=24']) {
    assert.ok(html.includes(asset), `page must load ${asset}`);
    assert.ok(worker.includes(asset), `offline shell must warm ${asset}`);
  }
  assert.ok(html.indexOf('rain-decision-ui.js?v=21') < html.indexOf('outfit-decision-ui.js?v=24'));
});
