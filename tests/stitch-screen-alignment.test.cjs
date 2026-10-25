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
  assert.ok(read("sw.js").includes("weatherhannun-shell-v13-stitch-light-alignment"));
});
