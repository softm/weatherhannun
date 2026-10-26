"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const read = file => fs.readFileSync(file, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(read("weather-icons.js"), sandbox, { filename: "weather-icons.js" });
const icons = sandbox.window.WeatherIcons;

test("shared weather visual classifies every Open-Meteo WMO group", () => {
  const expected = new Map([
    [0, "clear"], [1, "mostly-clear"], [2, "partly-cloudy"], [3, "overcast"],
    [45, "fog"], [48, "rime-fog"], [51, "drizzle"], [53, "drizzle"], [55, "drizzle"],
    [56, "freezing-drizzle"], [57, "freezing-drizzle"], [61, "rain"], [63, "rain"], [65, "rain"],
    [66, "freezing-rain"], [67, "freezing-rain"], [71, "snow"], [73, "snow"], [75, "snow"],
    [77, "snow-grains"], [80, "showers"], [81, "showers"], [82, "showers"],
    [85, "snow-showers"], [86, "snow-showers"], [95, "thunderstorm"], [96, "thunder-hail"], [99, "thunder-hail"]
  ]);

  for (const [code, family] of expected) {
    const state = icons.describe(code, 1);
    assert.equal(state.family, family, `WMO ${code}`);
    assert.notEqual(state.name, "날씨 정보 없음", `WMO ${code} needs a Korean label`);
  }
  assert.equal(icons.describe(undefined, 1).family, "unknown");
  assert.equal(icons.describe(999, 1).family, "unknown");
});

test("day and night weather states use different graphical layers", () => {
  for (const code of [0, 1, 2, 80, 85]) {
    const day = icons.describe(code, 1);
    const night = icons.describe(code, 0);
    assert.notEqual(day.key, night.key, `WMO ${code} day/night key`);
    assert.match(icons.markup(code, 1), /wi-sun/);
    assert.match(icons.markup(code, 0), /wi-moon/);
  }
});

test("precipitation, fog, snow and hail remain shape-distinguishable", () => {
  assert.match(icons.markup(63, 1), /wi-rain/);
  assert.match(icons.markup(73, 1), /wi-snow/);
  assert.match(icons.markup(45, 1), /wi-fog-lines/);
  assert.match(icons.markup(67, 1), /wi-rain[\s\S]*wi-ice/);
  assert.match(icons.markup(99, 1), /wi-lightning[\s\S]*wi-hail/);
  assert.match(icons.markup(null, 1), /wi-unknown-mark/);
});

test("all forecast surfaces load the shared inline SVG system", () => {
  const html = read("index.html");
  const app = read("app.js");
  const today = read("stitch-today.js");
  const layout = read("stitch-layout.js");
  const forecast = read("forecast-insights.js");
  const css = read("weather-icons.css");

  assert.ok(html.indexOf("weather-icons.js?v=17") < html.indexOf("app.js?v=31"));
  assert.ok(html.indexOf("weather-icons.css?v=17") > html.indexOf("stitch-mobile.css?v=16"));
  assert.match(app, /WeatherIcons\.markup/);
  assert.match(today, /WeatherIcons\.render/);
  assert.match(forecast, /weather-glyph--insight/);
  assert.doesNotMatch(layout, /\/⛈\|⚡\|🌩\//);
  assert.match(css, /data-weather-theme="dark"[\s\S]*--wi-rain:\s*#6ab8ff/i);
  assert.match(css, /\.weather-map-pin > \.weather-pin-card/);
});
