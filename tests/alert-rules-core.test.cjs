const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../alert-rules-core.js");

function row(hour, values = {}) {
  return { time: `2026-10-26T${String(hour).padStart(2, "0")}:00`, rain: 10, mm: 0, temp: 15, gust: 10, code: 0, isDay: 1, ...values };
}

test("legacy alert preferences do not silently enable daily summaries", () => {
  const prefs = rules.normalizePreferences({ rain: true, frost: false, wind: false });
  assert.equal(prefs.configured, true);
  assert.equal(prefs.morning, false);
  assert.equal(prefs.evening, false);
});

test("rain threshold is configurable while the existing 1mm rule remains", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(i));
  rows[4] = row(4, { rain: 55, mm: 0 });
  assert.equal(rules.pick(rows, { version: 2, rain: true, rainThreshold: 60 }).some(x => x.id === "rain"), false);
  rows[4].mm = 1;
  assert.equal(rules.pick(rows, { version: 2, rain: true, rainThreshold: 60 }).some(x => x.id === "rain"), true);
});

test("dry and clear rules require the whole configured forecast window", () => {
  const rows = Array.from({ length: 24 }, (_, i) => row(i, { rain: 15, code: 1, isDay: i < 12 ? 1 : 0 }));
  const alerts = rules.pick(rows, { version: 2, dry: true, dryThreshold: 80, clear: true, clearHours: 3 });
  assert.deepEqual(alerts.map(x => x.id), ["dry", "clear"]);
  rows[2].rain = 30;
  assert.equal(rules.pick(rows, { version: 2, dry: true, dryThreshold: 80 }).some(x => x.id === "dry"), false);
});
