"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");

test("Stitch light visual system and typography are the default", () => {
  const html = read("index.html");
  const layout = read("stitch-layout.js");
  const design = read("DESIGN.md");

  assert.match(html, /family=DM\+Sans/);
  assert.match(html, /family=Space\+Grotesk/);
  assert.match(layout, /\?saved:"light"/);
  assert.match(design, /#2589F5/i);
  assert.match(design, /#10B981/i);
});

test("hourly, weekly, and activity screens expose the aligned content hierarchy", () => {
  const html = read("index.html");
  const app = read("app.js");
  const css = read("stitch-mobile.css");

  for (const token of [
    "hourly-period-dock",
    "hourly-countdown-card",
    'id="hourlyDetailRows"',
    'id="weekendScoreRing"',
    'id="weeklyAlertTitle"',
    'id="weeklyAlertText"'
  ]) assert.ok(html.includes(token), `missing ${token}`);

  assert.ok(app.includes("week-row-badge"));
  assert.ok(app.includes("feed-metrics"));
  assert.ok(app.includes("data-hour-window"));
  assert.match(css, /\.hourly-insight \.insight-window\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});

test("saved-place switcher stays compact at app breakpoints", () => {
  const css = read("stitch-mobile.css");

  assert.match(css, /@media \(max-width: 920px\)[\s\S]*?#locationQuickBar\.location-shortcuts/);
  assert.match(css, /#locationQuickBar \.location-current-label,[\s\S]*?display:\s*none\s*!important/);
});

test("map redraws responsively and Leaflet tiles keep absolute positioning", () => {
  const app = read("app.js");
  const css = read("stitch-theme.css");

  assert.ok(app.includes("ResizeObserver"));
  assert.ok(app.includes("invalidateSize"));
  assert.ok(app.includes("tile.openstreetmap.de"));
  assert.match(css, /#map \.leaflet-pane,[\s\S]*?position:absolute!important/);
  assert.match(css, /#map \.leaflet-tile\{width:256px!important;height:256px!important/);
});

test("service worker version tracks the aligned shell", () => {
  const html = read("index.html");
  const worker = read("sw.js");

  assert.ok(worker.includes("weatherhannun-shell-v15-hour-card-contrast"));
  for (const asset of ["stitch-today.css?v=15", "stitch-today.js?v=15", "stitch-mobile.css?v=14", "region-search.css?v=14"]) {
    assert.ok(html.includes(asset), `page must request ${asset}`);
    assert.ok(worker.includes(asset), `service worker must warm ${asset}`);
  }
});

test("current hour card has an explicit high-contrast state and descriptive rain label", () => {
  const today = read("stitch-today.css");
  const script = read("stitch-today.js");
  const template = read("stitch-today.template.html");

  assert.match(today, /\.stitch-hour-cell\s*\{[\s\S]*?appearance:none;[\s\S]*?border:1px solid/);
  assert.match(today, /\.stitch-hour-current\s*\{[\s\S]*?background:linear-gradient[\s\S]*?!important/);
  assert.ok(script.includes("stitch-hour-current"));
  assert.ok(script.includes("aria-current','time"));
  assert.ok(script.includes("textContent='비 "));
  assert.match(template, /stitch-hour-current[\s\S]*?aria-current="time"[\s\S]*?>현재</);
});

test("light and dark themes cover the mobile header, Today template, and location dialog", () => {
  const today = read("stitch-today.css");
  const mobile = read("stitch-mobile.css");
  const search = read("region-search.css");

  assert.match(today, /data-weather-theme="dark"[^\n]*#stitch-live-dashboard/);
  assert.match(today, /\[class~="bg-white"\][\s\S]*?var\(--st-surface\)/);
  assert.match(today, /\[class~="text-slate-900"\][\s\S]*?var\(--st-fg\)/);
  assert.match(mobile, /\.location-button\s*\{[\s\S]*?background:\s*var\(--st-surface\)/);
  assert.match(mobile, /data-weather-theme="light"[^\n]*\.map-shell \.leaflet-container/);
  assert.match(search, /#locationDialog\s*\{[\s\S]*?background:var\(--st-surface\)!important/);
  assert.match(search, /data-weather-theme="dark"[^\n]*#locationDialog \.search-box button/);
});
