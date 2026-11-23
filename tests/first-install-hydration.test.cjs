const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const today = fs.readFileSync(path.join(root, 'stitch-today.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('late Stitch surface is hydrated again from the validated app state', () => {
  assert.match(app, /weatherhannun:stitch-ready[\s\S]*?if\(STATE\.weather\)renderAll\(\)/);
});

test('prototype hourly sample values are removed before first forecast render', () => {
  assert.match(today, /nodes\.track\?\.replaceChildren\(\)/);
  assert.match(today, /실제 시간별 예보를 불러오는 중/);
});

test('startup screen waits for forecast outcome and deployed versions stay aligned', () => {
  assert.match(html, /addEventListener\('weatherhannun:data',f,\{once:true\}\)/);
  assert.match(html, /weatherhannun:forecast-result/);
  assert.match(html, /app\.js\?v=57/);
  assert.match(html, /stitch-today\.js\?v=46/);
  assert.match(sw, /app\.js\?v=57/);
  assert.match(sw, /stitch-today\.js\?v=46/);
});
