const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("first-screen forecast uses the common Firebase API and keeps the official snapshot enhancement", () => {
  const app = read("app.js");
  const provider = read("weather-provider-core.js");
  assert.match(provider, /cloudfunctions\.net\/weatherApi/);
  assert.match(app, /buildForecastUrl/);
  assert.doesNotMatch(app, /buildLegacyForecastUrl/);
  assert.match(app, /staticOfficial:true/);
});

test("production clients contain no direct Open-Meteo endpoint", () => {
  for (const file of ["weather-provider-core.js", "app.js", "location-compare-core.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /api\.open-meteo\.com|air-quality-api\.open-meteo\.com/, file);
  }
});

test("official workflow snapshot is restored locally before network refresh", () => {
  const source = read("official-data-ui.js");
  assert.match(source, /weatherhannun_official_snapshot_v1/);
  assert.ok(source.indexOf("feed = storedFeed()") < source.indexOf("loadFeed();"));
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY/);
});

test("scheduled official resources overwrite stable latest files", () => {
  const workflow = read(".github/workflows/pages.yml");
  const collector = read("scripts/sync-official-data.mjs");
  assert.match(workflow, /cron: '7,22,37,52 \* \* \* \*'/);
  assert.match(collector, /writeFile\(latestFile/);
  assert.match(collector, /writeFile\(radarFile/);
  assert.doesNotMatch(collector, /appendFile/);
});

test("GitHub Pages publishes only the explicit public artifact", () => {
  const workflow = read(".github/workflows/pages.yml");
  assert.match(workflow, /Build public Pages artifact/);
  assert.match(workflow, /path: '\.pages-public'/);
  assert.doesNotMatch(workflow, /path: '\.'/);
  for (const privatePath of ["services", "scripts", "tests", ".github", "firebase.json"]) {
    assert.match(workflow, new RegExp(`test ! -e \\.pages-public/${privatePath.replace(".", "\\.")}`));
  }
});
