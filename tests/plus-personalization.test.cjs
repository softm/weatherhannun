const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('../plus-personalization-core.js');

test('Plus priority keeps at most three declared activities without score mutation or unsafe promotion', () => {
  assert.deepEqual(core.normalizePriority(['walk', 'walk', 'bad', 'spray', 'harvest', 'laundry']), ['walk', 'spray', 'harvest']);
  const items = [
    {key: 'walk', data: {score: 20}},
    {key: 'harvest', data: {score: 95}},
    {key: 'laundry', data: {score: 80}}
  ];
  const ordered = core.order(items, ['walk']);
  assert.deepEqual(ordered.map(item => item.key), ['harvest', 'laundry', 'walk']);
  assert.equal(ordered[2].data.score, 20);

  const suitable = core.order(items.concat({key: 'spray', data: {score: 65}}), ['spray']);
  assert.deepEqual(suitable.map(item => item.key), ['spray', 'harvest', 'laundry', 'walk']);
  assert.equal(core.SUITABLE_SCORE, 60);
});

test('alert presets use only existing selectable thresholds and preserve explicit save', () => {
  for (const profile of Object.values(core.PROFILES)) {
    assert.ok([30, 50, 65, 70, 80].includes(profile.rainThreshold));
    assert.ok([70, 80, 90].includes(profile.dryThreshold));
    assert.ok([2, 3, 4, 6].includes(profile.clearHours));
  }
  const ui = fs.readFileSync('plus-personalization.js', 'utf8');
  assert.match(ui, /알림 조건 저장/);
  assert.doesNotMatch(ui, /saveAlertConfiguration/);
});

test('Plus personalization is entitlement and commercial-rights gated and cached offline', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const ui = fs.readFileSync('plus-personalization.js', 'utf8');
  const worker = fs.readFileSync('sw.js', 'utf8');
  assert.match(html, /id="plusPersonalizationControls" disabled/);
  assert.match(ui, /plans\?\.plus\?\.entitled===true&&releaseAllowed\(\)/);
  for (const asset of ['plus-personalization-core.js?v=34', 'plus-personalization.js?v=34']) {
    assert.ok(html.includes(asset));
    assert.ok(worker.includes(asset));
  }
});
