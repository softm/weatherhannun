"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");

test("screen weather is an explicit Android-only opt-in", () => {
  const html = read("index.html");
  const script = read("screen-weather-settings.js");

  assert.match(html, /id="screenWeatherEnabled"[^>]*type="checkbox"[^>]*role="switch"/);
  assert.match(html, /기본 OFF/);
  assert.match(script, /enabled:\s*false/);
  assert.match(script, /requestScreenWeatherPermission/);
  assert.match(script, /웹 브라우저에서는 동작하지 않습니다/);
  assert.match(script, /permissionScreenMode/);
  assert.match(script, /목록에서 날씨한눈을 선택/);
});

test("duration and cooldown choices match WH-O01", () => {
  const html = read("index.html");
  const script = read("screen-weather-settings.js");

  for (const value of ["0", "3", "5", "10", "15", "30", "60"]) {
    assert.ok(html.includes(`value="${value}"`), `missing option ${value}`);
  }
  assert.match(script, /\[0, 3, 5, 10\]/);
  assert.match(script, /\[0, 15, 30, 60\]/);
});

test("snapshot bridge preserves source and missing-value safety", () => {
  const script = read("screen-weather-settings.js");

  assert.match(script, /finite\(current\.temperature_2m\)/);
  assert.match(script, /Open-Meteo 모델 예보/);
  assert.match(script, /WeatherHannunRainDecision\.summarise/);
  assert.match(script, /updateWidgetSnapshot/);
  assert.match(script, /latitude:/);
  assert.match(script, /longitude:/);
  assert.match(script, /nativeState\?\.enabled === true \|\| previewRequested === true/);
  assert.doesNotMatch(script, /temperature_2m\s*\|\|\s*0/);
});

test("Android home widget receives current location and all three size fields", () => {
  const html = read("index.html");
  const script = read("screen-weather-settings.js");
  for (const field of ["weatherCode", "isDay", "high", "low", "rainGuidance", "updatedAt", "sourceLabel"]) {
    assert.ok(script.includes(field), `missing widget field ${field}`);
  }
  assert.match(script, /WeatherHannunWidgets/);
  assert.match(script, /requestPinWeatherWidget/);
  assert.match(script, /activeWidgetCount/);
  assert.match(html, /id="homeWidgetAdd"/);
  assert.match(html, /id="homeWidgetTheme" disabled/);
  assert.match(script, /premiumThemesAllowed/);
  assert.match(script, /saveWidgetTheme/);
  assert.match(script, /option\.disabled = !premiumAllowed && option\.value !== 'default'/);
  for (const size of ["2×1", "4×2", "4×3"]) assert.ok(html.includes(size));
});

test("offline shell contains both settings assets", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["screen-weather-settings.css?v=34", "screen-weather-settings.js?v=35"]) {
    assert.ok(html.includes(asset));
    assert.ok(worker.includes(asset));
  }
});
