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

function periodWeather(baseTemp, rainAt, missingAt) {
  const time = Array.from({ length: 14 }, (_, index) => `2026-10-26T${String(index + 8).padStart(2, "0")}:00`);
  const values = Array.from({ length: 14 }, (_, index) => index);
  const payload = {
    current: { time: time[0] },
    hourly: {
      time,
      temperature_2m: values.map(index => baseTemp + index * 0.5),
      precipitation_probability: values.map(index => index === rainAt ? 60 : 10),
      precipitation: values.map(index => index === rainAt ? 0.4 : 0),
      weather_code: values.map(index => index === rainAt ? 61 : 1),
      wind_speed_10m: values.map(index => 5 + index),
      wind_gusts_10m: values.map(index => 10 + index),
      is_day: values.map(() => 1)
    }
  };
  if (Number.isInteger(missingAt)) {
    payload.hourly.temperature_2m[missingAt] = null;
    payload.hourly.precipitation_probability[missingAt] = null;
    payload.hourly.precipitation[missingAt] = null;
  }
  return payload;
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

test("WH-L01 compares the same complete 12-hour period without shifting either place", () => {
  const origin = { name: "서울", lat: 37.5665, lon: 126.978 };
  const destination = { name: "부산", lat: 35.1796, lon: 129.0756 };
  const result = compare.comparePeriod(
    origin,
    periodWeather(10, -1),
    destination,
    periodWeather(12, 3),
    "2026-10-26T08:00",
    12
  );

  assert.equal(result.status, "ready");
  assert.equal(result.complete, true);
  assert.equal(result.startTime, "2026-10-26T08:00");
  assert.equal(result.endTime, "2026-10-26T19:00");
  assert.equal(result.origin.summary.availableHours, 12);
  assert.equal(result.origin.summary.temperatureMin, 10);
  assert.equal(result.origin.summary.temperatureMax, 15.5);
  assert.equal(result.destination.summary.temperatureMin, 12);
  assert.equal(result.destination.summary.temperatureMax, 17.5);
  assert.equal(result.destination.summary.rain.triggered, true);
  assert.equal(result.destination.summary.rain.firstSignalTime, "2026-10-26T11:00");
  assert.equal(result.destination.summary.rainProbabilityMax, 60);
  assert.equal(result.destination.summary.precipitationTotal, 0.4);
  assert.equal(result.delta.temperatureMax, 2);
  assert.equal(result.delta.windMax, 0);
  assert.equal(result.officialAlerts.status, "unavailable");
});

test("12-hour comparison keeps incomplete metrics unknown instead of filling missing cells", () => {
  const origin = { name: "서울", lat: 37.5665, lon: 126.978 };
  const destination = { name: "부산", lat: 35.1796, lon: 129.0756 };
  const result = compare.comparePeriod(
    origin,
    periodWeather(10, -1),
    destination,
    periodWeather(12, 3, 5),
    "2026-10-26T08:00",
    12
  );

  assert.equal(result.status, "ready");
  assert.equal(result.complete, false);
  assert.equal(result.destination.summary.temperatureMin, null);
  assert.equal(result.destination.summary.temperatureMax, null);
  assert.equal(result.destination.summary.precipitationTotal, null);
  assert.equal(result.destination.summary.rain.complete, false);
  assert.equal(result.destination.summary.rain.triggered, true);
  assert.equal(result.delta.temperatureMax, null);
  assert.equal(result.delta.precipitationTotal, null);
});

test("a short shared horizon is explicit and an unshared period start is rejected", () => {
  const origin = { name: "서울", lat: 37.5665, lon: 126.978 };
  const destination = { name: "부산", lat: 35.1796, lon: 129.0756 };
  const short = compare.comparePeriod(
    origin,
    periodWeather(10, -1),
    destination,
    periodWeather(12, -1),
    "2026-10-26T18:00",
    12
  );
  assert.equal(short.status, "ready");
  assert.equal(short.complete, false);
  assert.equal(short.origin.summary.availableHours, 4);
  assert.equal(short.origin.summary.temperatureMin, null);
  assert.equal(compare.comparePeriod(
    origin,
    periodWeather(10, -1),
    destination,
    periodWeather(12, -1),
    "2026-10-27T08:00",
    12
  ).reason, "period_not_shared");
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
