"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const compare = require("../location-compare-core.js");
const delta = require("../daily-delta-core.js");

function weather(temp, rain, mm, wind, gust) {
  return {
    current: { time: "2026-10-26T14:00" },
    hourly: {
      time: ["2026-10-26T13:00", "2026-10-26T14:00", "2026-10-26T15:00"],
      temperature_2m: [temp - 1, temp, temp + 1],
      precipitation_probability: [10, rain, 20],
      precipitation: [0, mm, 0],
      weather_code: [1, 61, 2],
      wind_speed_10m: [wind - 1, wind, wind + 1],
      wind_gusts_10m: [gust - 1, gust, gust + 1],
      is_day: [1, 1, 1]
    }
  };
}

test("WH-L01 compares only the exact shared forecast time", () => {
  const origin = { name: "서울", lat: 37.5665, lon: 126.978 };
  const destination = { name: "부산", lat: 35.1796, lon: 129.0756 };
  const result = compare.compare(origin, weather(17, 40, 0.1, 11, 19), destination, weather(21, 55, 0.4, 17, 28), "2026-10-26T14:00");

  assert.equal(result.status, "ready");
  assert.equal(result.time, "2026-10-26T14:00");
  assert.equal(result.sourceKind, "forecast");
  assert.equal(result.delta.temperature, 4);
  assert.equal(result.delta.wind, 6);
  assert.equal(result.origin.rain.triggered, false);
  assert.equal(result.destination.rain.triggered, true);
  assert.equal(result.officialAlerts.status, "unavailable");
});

test("50 percent or 0.3 mm/h are independent rain signals; missing stays unknown", () => {
  assert.equal(compare.rainSignal({ rainProbability: 50, precipitation: 0 }).triggered, true);
  assert.equal(compare.rainSignal({ rainProbability: 10, precipitation: 0.3 }).triggered, true);
  assert.deepEqual(compare.rainSignal({ rainProbability: null, precipitation: undefined }), {
    available: false, complete: false, known: false, triggered: false, probability: null, precipitation: null
  });
  const partial = compare.rainSignal({ rainProbability: 10, precipitation: null });
  assert.equal(partial.available, true);
  assert.equal(partial.complete, false);
  assert.equal(partial.known, false);
  assert.equal(partial.triggered, false);
});

test("comparison rejects same place and a time not present in both forecasts", () => {
  const place = { name: "서울", lat: 37.5665, lon: 126.978 };
  const other = { name: "부산", lat: 35.1796, lon: 129.0756 };
  assert.equal(compare.compare(place, weather(17, 0, 0, 10, 15), place, weather(18, 0, 0, 11, 16), "2026-10-26T14:00").reason, "same_location");
  assert.equal(compare.compare(place, weather(17, 0, 0, 10, 15), other, weather(18, 0, 0, 11, 16), "2026-10-27T14:00").reason, "time_not_shared");
});

test("destination request uses the forecast endpoint without embedding a secret", () => {
  const url = new URL(compare.buildForecastUrl({ name: "서울", lat: 37.5665, lon: 126.978 }));
  assert.equal(url.origin + url.pathname, compare.FORECAST_ENDPOINT);
  assert.equal(url.searchParams.get("timezone"), "Asia/Seoul");
  assert.equal(url.searchParams.get("apikey"), null);
  assert.equal(url.searchParams.get("key"), null);
});

test("WH-H02 calculates deltas only for equivalent observation records", () => {
  const current = {
    sourceKind: "observation", providerId: "kma", providerName: "기상청",
    stationId: "108", stationName: "서울", locationKey: "seoul",
    observedAt: "2026-10-26T14:00+09:00", temperature: 18.2, precipitation: 0.4
  };
  const previous = { ...current, observedAt: "2026-10-25T14:00+09:00", temperature: 15.2, precipitation: 0 };
  const result = delta.compare({ current, previous });
  assert.equal(result.status, "ready");
  assert.equal(result.temperatureDelta, 3);
  assert.equal(result.precipitationDelta, 0.4);
});

test("WH-H02 never turns forecasts, station mismatches, or time mismatches into a delta", () => {
  const base = {
    sourceKind: "observation", providerId: "kma", stationId: "108", stationName: "서울",
    locationKey: "seoul", observedAt: "2026-10-26T14:00+09:00", temperature: 18
  };
  assert.equal(delta.compare({ current: { ...base, sourceKind: "forecast" }, previous: base }).status, "unavailable");
  assert.equal(delta.compare({ current: base, previous: { ...base, stationId: "159", observedAt: "2026-10-25T14:00+09:00" } }).reason, "station_mismatch");
  assert.equal(delta.compare({ current: base, previous: { ...base, observedAt: "2026-10-25T13:00+09:00" } }).reason, "time_mismatch");
});
