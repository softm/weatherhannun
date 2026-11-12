const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('personal sync is mounted in the weather web entrypoint', () => {
  const html = read('index.html');
  assert.match(html, /<script\s+defer\s+src="\.\/personal-sync\.js\?v=\d+"/);
  assert.match(html, /cloudflare-weather-boot\.mjs/);
});

test('saved places use the per-service Cloudflare personal API with explicit consent', () => {
  const source = read('personal-sync.js');
  assert.match(source, /requestPersonal\('\/api\/personal\/places'\)/);
  assert.match(source, /requestPersonal\('\/api\/personal\/places','PUT'/);
  assert.match(source, /if\(!confirm\(message\)\)return/);
  assert.match(source, /p\.source!=='gps'/);
  assert.match(source, /mergeCloudPlaces\(incoming\)/);
});

test('personal sync stays opt-in, never silently runs on login or page load', () => {
  const source = read('personal-sync.js');
  assert.match(source, /upload\.addEventListener\('click'/);
  assert.match(source, /restore\.addEventListener\('click'/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /setTimeout\s*\(/);
});
