import test from "node:test";
import assert from "node:assert/strict";
import {coordinates, dfsGrid, isSouthKorea, kmaBase, kmaConditionCode, parseKmaPrecipitation, validateContract} from "../core.mjs";
import {normalizeMetNorway} from "../providers.mjs";

test("coordinates rejects malformed values", () => { assert.throws(() => coordinates({lat: "x", lon: 127}), /invalid_coordinates/); assert.deepEqual(coordinates({lat: "37.5", lon: "127"}), {lat: 37.5, lon: 127}); });
test("South Korea classification is conservative", () => { assert.equal(isSouthKorea({lat: 37.5665, lon: 126.978}), true); assert.equal(isSouthKorea({lat: 33.4996, lon: 126.5312}), true); assert.equal(isSouthKorea({lat: 35.6812, lon: 139.7671}), false); });
test("DFS conversion matches Seoul reference grid", () => assert.deepEqual(dfsGrid(37.5665, 126.978), {nx: 60, ny: 127}));
test("KMA base times honor publication latency", () => { assert.deepEqual(kmaBase("village", new Date("2026-11-01T17:35:00Z")), {baseDate: "20261102", baseTime: "0200"}); assert.deepEqual(kmaBase("village", new Date("2026-11-01T15:05:00Z")), {baseDate: "20261101", baseTime: "2300"}); assert.deepEqual(kmaBase("ultraObservation", new Date("2026-11-01T03:55:00Z")), {baseDate: "20261101", baseTime: "1200"}); });
test("KMA missing values stay missing", () => { assert.equal(kmaConditionCode("1", "0"), 0); assert.equal(kmaConditionCode("4", "1"), 61); assert.equal(parseKmaPrecipitation("강수없음"), 0); assert.equal(parseKmaPrecipitation("1.0mm 미만"), 1); assert.equal(parseKmaPrecipitation("자료없음"), null); });
test("MET normalization satisfies common contract", () => { const payload = normalizeMetNorway({properties: {meta: {updated_at: "2026-11-01T00:00:00Z"}, timeseries: [{time: "2026-11-01T01:00:00Z", data: {instant: {details: {air_temperature: 12, relative_humidity: 70, wind_speed: 2}}, next_1_hours: {summary: {symbol_code: "clearsky_day"}, details: {precipitation_amount: 0}}}}]}}, {lat: 51.5, lon: -0.1, name: "London"}); assert.equal(payload.current.temperature, 12); assert.equal(payload.current.conditionCode, 0); assert.equal(validateContract(payload).valid, true); });
