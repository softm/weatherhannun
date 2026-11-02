const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("first-screen forecast never waits for the Firebase weather collector", () => {
  const app = read("app.js");
  assert.doesNotMatch(app, /cloudfunctions\.net\/weatherApi/);
  assert.match(app, /buildLegacyForecastUrl/);
  assert.match(app, /staticOfficial:true/);
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
