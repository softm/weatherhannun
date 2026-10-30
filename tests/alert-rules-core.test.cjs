const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../alert-rules-core.js");

function row(hour, values = {}) {
  return { time: `2026-10-26T${String(hour).padStart(2, "0")}:00`, rain: 10, mm: 0, temp: 15, gust: 10, code: 0, isDay: 1, ...values };
}

test("new users start with all five weather conditions selected", () => {
  const prefs = rules.defaults();
  assert.deepEqual(
    [prefs.rain, prefs.dry, prefs.clear, prefs.frost, prefs.wind],
    [true, true, true, true, true]
  );
});

test("an explicitly disabled saved condition stays disabled", () => {
  const prefs = rules.normalizePreferences({ version: 2, rain: false, dry: false, clear: false, frost: false, wind: false });
  assert.deepEqual(
    [prefs.rain, prefs.dry, prefs.clear, prefs.frost, prefs.wind],
    [false, false, false, false, false]
  );
});

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

test("missing precipitation never becomes a dry or clear signal", () => {
  const rows = Array.from({ length: 3 }, (_, i) => row(i, { rain: 5, mm: 0, code: 0, isDay: 1 }));
  rows[1].mm = null;
  assert.equal(rules.pick(rows, { version: 2, dry: true, dryThreshold: 80 }).some(x => x.id === "dry"), false);
  assert.equal(rules.pick(rows, { version: 2, clear: true, clearHours: 3 }).some(x => x.id === "clear"), false);
});

test("missing risk fields never create frost or wind alerts", () => {
  const rows = Array.from({ length: 24 }, (_, i) => row(i, { temp: null, gust: null }));
  const alerts = rules.pick(rows, { version: 2, frost: true, wind: true });
  assert.equal(alerts.some(alert => alert.id === "frost" || alert.id === "wind"), false);
});
