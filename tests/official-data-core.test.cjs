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
  assert.equal(stale.reason, "official_observation_stale");
  assert.equal(stale.latestAvailable.observedAt, "2026-10-28T10:00:00+09:00");
  assert.equal(stale.current, null);
  assert.equal(stale.observations, null);
  assert.equal(delta.compare(stale.observations).status, "unavailable");
  assert.equal(core.resolve({ schemaVersion: 1, status: "unconfigured" }, { lat: 36.7, lon: 126.4 }).status, "unavailable");
});

test("distance is calculated in kilometers", () => {
  assert.ok(core.distanceKm(37.5665, 126.978, 35.1796, 129.0756) > 300);
});

test("official warnings are matched to the selected region only while the snapshot is fresh", () => {
  const source = feed();
  source.kma.warnings = [
    { upperRegionName: "충청남도", regionName: "서산시", warningCode: "WIND" },
    { upperRegionName: "서울특별시", regionName: "서울 동북권", warningCode: "RAIN" }
  ];
  const local = core.resolve(source, { name: "서산", address: "충청남도 서산시", lat: 36.78, lon: 126.45 }, "2026-10-28T01:20:00Z");
  assert.equal(local.warningFeedReady, true);
  assert.equal(local.warnings.length, 2);
  assert.equal(local.localWarnings.length, 1);
  assert.equal(local.localWarnings[0].regionName, "서산시");

  const stale = core.resolve(source, { name: "서산", address: "충청남도 서산시", lat: 36.78, lon: 126.45 }, "2026-10-28T02:00:01Z");
  assert.equal(stale.warningFeedReady, false);
  assert.deepEqual(stale.localWarnings, []);
});

test("a fresh dedicated warning timestamp does not depend on a delayed full snapshot", () => {
  const source = feed();
  source.generatedAt = "2026-10-27T20:00:00Z";
  source.warningGeneratedAt = "2026-10-28T01:10:00Z";
  source.kma.warnings = [{ upperRegionName: "충청남도", regionName: "서산시", warningCode: "W", level: "2", command: "1" }];
  const result = core.resolve(source, { name: "서산", address: "충청남도 서산시", lat: 36.78, lon: 126.45 }, "2026-10-28T01:20:00Z");
  assert.equal(result.warningFeedReady, true);
  assert.equal(result.localWarnings.length, 1);
});

test("official warning insight keeps source level, action, and narrow region matching", () => {
  const source = feed();
  source.kma.warnings = [
    { upperRegionName: "인천광역시", regionName: "인천(옹진)", regionCode: "L101", warningCode: "W", level: "2", command: "1", announcedAt: "2026-10-28T09:00:00+09:00", effectiveAt: "2026-10-28T10:00:00+09:00" },
    { upperRegionName: "충청남도", regionName: "서산시", regionCode: "L102", warningCode: "S", level: "3", command: "3" }
  ];
  const elsewhere = core.resolve(source, { name: "구월동", address: "인천광역시 남동구 구월동", lat: 37.45, lon: 126.7 }, "2026-10-28T01:20:00Z");
  assert.deepEqual(elsewhere.localWarnings, []);
  const local = core.resolve(source, { name: "백령면", address: "인천광역시 옹진군 백령면", lat: 37.96, lon: 124.63 }, "2026-10-28T01:20:00Z");
  assert.equal(local.warnings.length, 1, "해제 명령은 현재 특보에서 제외");
  assert.equal(local.localWarnings.length, 1);
  const insight = core.warningInsight(local.localWarnings[0]);
  assert.equal(insight.title, "강풍주의보");
  assert.match(insight.action, /날릴 물건/);
  assert.equal(insight.area, "인천광역시 · 인천(옹진)");
  assert.equal(core.warningStatus(insight, "2026-10-28T00:30:00Z"), "발효 예정");
  assert.equal(core.warningStatus(insight, "2026-10-28T01:30:00Z"), "발효 중");
  assert.equal(core.warningStatus({ ...insight, level: "예비특보" }, "2026-10-28T00:30:00Z"), "발표");
});

test("compound island warning areas match each named island without matching all of Incheon", () => {
  const source = feed();
  source.kma.warnings = [
    { upperRegionName: "인천광역시", regionName: "서해5도(백령도.대청도)", regionCode: "L201", warningCode: "W", level: "2", command: "1" }
  ];
  const baengnyeong = core.resolve(source, { name: "백령면", address: "인천광역시 옹진군 백령면", lat: 37.96, lon: 124.63 }, "2026-10-28T01:20:00Z");
  const mainland = core.resolve(source, { name: "구월동", address: "인천광역시 남동구 구월동", lat: 37.45, lon: 126.7 }, "2026-10-28T01:20:00Z");
  assert.equal(baengnyeong.localWarnings.length, 1);
  assert.deepEqual(mainland.localWarnings, []);
});
