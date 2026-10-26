"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");

test("location comparison is a dedicated same-time screen reachable from location settings", () => {
  const html = read("index.html");
  const app = read("app.js");
  const manager = read("location-manager.js");

  for (const token of [
    'id="view-compare"', 'id="compareDestination"', 'id="compareTime"',
    'id="compareResults"', 'data-view="compare"', "50% 이상 또는 0.3 mm/h 이상"
  ]) assert.ok(html.includes(token), `missing comparison control ${token}`);
  assert.match(app, /"map","compare","settings"/);
  assert.match(app, /weatherhannun:view/);
  assert.match(app, /data:STATE\.weather\?/);
  assert.match(manager, /getSavedPlaces/);
  assert.match(manager, /data-location-compare/);
});

test("comparison preserves the selected origin and guards destination request races", () => {
  const script = read("location-compare-ui.js");
  assert.match(script, /requestTicket/);
  assert.match(script, /AbortController/);
  assert.match(script, /ticket !== requestTicket/);
  assert.match(script, /destination\.rain\.complete && comparison\.origin\.rain\.complete/);
  assert.doesNotMatch(script, /weatherhannun:change-location/);
  assert.doesNotMatch(script, /history\.(pushState|replaceState)/);
  assert.doesNotMatch(script, /searchParams\.set\("(?:lat|lon|name)"/);
});

test("forecast-only yesterday view is explicit and never invents an observation delta", () => {
  const html = read("index.html");
  const template = read("stitch-today.template.html");
  const script = read("daily-delta-ui.js");
  assert.match(html, /data-daily-delta/);
  assert.match(template, /data-daily-delta/);
  assert.match(script, /현재 연결된 값은 모델 예보입니다/);
  assert.match(script, /core\.compare\(latest && latest\.observations\)/);
  assert.match(script, /weatherhannun:stitch-ready/);
  assert.doesNotMatch(script, /MutationObserver/);
  assert.doesNotMatch(script, /weather\.current\.temperature_2m\s*-/);
});
