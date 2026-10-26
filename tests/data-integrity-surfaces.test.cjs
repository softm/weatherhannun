const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("Stitch TOP 3 uses the shared activity contract instead of zero-filled legacy scoring", () => {
  const source = read("stitch-today.js");
  assert.match(source, /WeatherActivityCore/);
  assert.match(source, /core\.evaluate\(kind,activityRow\(h\)/);
  assert.doesNotMatch(source, /\+h\.(?:rain|wind|mm|humid|uv)\|\|0/);
});

test("forecast summaries distinguish complete low-risk evidence from missing data", () => {
  const source = read("forecast-insights.js");
  assert.match(source, /강수 자료 일부 누락/);
  assert.match(source, /위험 없음으로 판단하지 않습니다/);
  assert.match(source, /rainComplete=hours\.every\(h=>finite\(h\.rain\)&&finite\(h\.mm\)\)/);
  assert.doesNotMatch(source, /Math\.max\(0,\.\.\.hours\.map/);
  assert.doesNotMatch(source, /sum\+\(r\.mm\|\|0\)/);
});

test("hourly and weekly views keep missing aggregates unknown", () => {
  const source = read("app.js");
  assert.match(source, /coordinates=h\.map\(function\(x,i\)\{return finite\(x\.temp\)/);
  assert.match(source, /precipitationRows\.length===len&&precipitationRows\.every\(finite\)/);
  assert.match(source, /일부 기온·강수 자료가 없어 위험 없음으로 판단하지 않습니다/);
  assert.equal((source.match(/weatherhannun:data/g) || []).length, 1, "weather data is dispatched once per render");
});

test("cache-busted shell ships the data-integrity implementations", () => {
  const page = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["app.js?v=34", "stitch-today.js?v=31", "forecast-insights.js?v=31", "alert-rules-core.js?v=31"]) {
    assert.match(page, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.ok(worker.includes(asset));
  }
});
