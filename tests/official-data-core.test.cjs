const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../official-data-core.js");
const delta = require("../daily-delta-core.js");

function feed() {
  return {
    schemaVersion: 1, status: "ready", generatedAt: "2026-10-28T01:10:00Z", rights: [{ verified: true }],
    kma: {
      observations: {
        current: [{ stationId: "129", stationName: "서산", lat: 36.77, lon: 126.49, observedAt: "2026-10-28T10:00:00+09:00", temperature: 15.2, precipitation: 0 }],
        previous: [{ stationId: "129", stationName: "서산", lat: 36.77, lon: 126.49, observedAt: "2026-10-27T10:00:00+09:00", temperature: 12.1, precipitation: 1.2 }]
      },
      warnings: [], radar: { status: "ready", observedAt: "2026-10-28T10:00:00+09:00", imagePath: "./radar.png" }
    },
    airKorea: { measurements: [{ stationId: "독곶리", stationName: "독곶리", lat: 36.99, lon: 126.35, measuredAt: "2026-10-28T10:00:00+09:00", pm10: 22, pm25: 11 }] }
  };
}

test("resolves nearby fresh official observations and WH-H02 equivalent pair", () => {
  const result = core.resolve(feed(), { lat: 36.78, lon: 126.45 }, "2026-10-28T01:20:00Z");
  assert.equal(result.status, "ready");
  assert.equal(result.current.stationId, "129");
  assert.equal(result.air.stationId, "독곶리");
  const compared = delta.compare(result.observations);
  assert.equal(compared.status, "ready");
  assert.ok(Math.abs(compared.temperatureDelta - 3.1) < 1e-9);
  assert.equal(compared.precipitationDelta, -1.2);
});

test("never substitutes stale, distant or unconfigured data for an observation", () => {
  const stale = core.resolve(feed(), { lat: 36.78, lon: 126.45 }, "2026-10-28T05:30:00Z");
  assert.equal(stale.status, "partial");
  assert.equal(stale.current, null);
  assert.equal(stale.observations, null);
  assert.equal(delta.compare(stale.observations).status, "unavailable");
  assert.equal(core.resolve({ schemaVersion: 1, status: "unconfigured" }, { lat: 36.7, lon: 126.4 }).status, "unavailable");
});

test("distance is calculated in kilometers", () => {
  assert.ok(core.distanceKm(37.5665, 126.978, 35.1796, 129.0756) > 300);
});
