import test from "node:test";
import assert from "node:assert/strict";
import {handleRequest, handleScheduled, parseLocation} from "../src/index.mjs";

function fakeDb(record = null) {
  const writes = [];
  return {
    writes,
    DB: {
      prepare(sql) {
        return {bind(...params) {return {
          first: async () => record,
          all: async () => ({results: []}),
          run: async () => {writes.push({sql, params}); return {success: true};}
        };}};
      },
      batch: async commands => {writes.push({batchSize: commands.length}); return [{success: true}];}
    }
  };
}
const payload = {
  contractVersion: "weatherhannun.v2",
  location: {lat: 37.5665, lon: 126.978, name: "서울", timezone: "Asia/Seoul"},
  current: {time: "2026-11-11T12:00:00+09:00", temperature: 13},
  hourly: [{time: "2026-11-11T12:00:00+09:00", temperature: 13}],
  daily: [{date: "2026-11-11", temperatureMax: 16, temperatureMin: 5}],
  airQuality: null, alerts: [], officialForecast: null, comparison: null,
  source: {provider: "kma", fetchedAt: new Date().toISOString()}, stale: false
};
const request = (path, env, ctx = {}, dependencies = {}, {method = "GET", origin = "https://softm.github.io"} = {}) =>
  handleRequest(new Request("https://example.workers.dev" + path, {method, headers: {Origin: origin}}),
    env, ctx, dependencies);

test("KMA grid cache key matches legacy server", () => {
  const entry = parseLocation(new URL("https://example.test/weatherApi?lat=37.5665&lon=126.978"));
  assert.equal(entry.key, "kr_60_127");
  assert.equal(entry.country, "KR");
});
test("health reports configured providers without exposing secrets", async () => {
  const r = await request("/weatherHealth", {DB: fakeDb().DB, KMA_API_KEY: "secret-value"});
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.match(text, /"configured"/);
  assert.doesNotMatch(text, /secret-value/);
});
test("invalid coordinates are rejected", async () => {
  const r = await request("/weatherApi?lat=nope&lon=127", {DB: fakeDb().DB});
  assert.equal(r.status, 400);
});
test("CORS allows GitHub Pages but denies other websites", async () => {
  const good = await request("/weatherHealth", {DB: fakeDb().DB});
  assert.equal(good.headers.get("Access-Control-Allow-Origin"), "https://softm.github.io");
  const bad = await request("/weatherHealth", {DB: fakeDb().DB}, {}, {}, {origin: "https://evil.example"});
  assert.equal(bad.status, 403);
});
test("cache miss fetches provider and writes to D1", async () => {
  const db = fakeDb();
  const r = await request("/weatherApi?lat=37.5665&lon=126.978", {DB: db.DB}, {},
    {collect: async () => payload});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).contractVersion, "weatherhannun.v2");
  assert.equal(db.writes[0].batchSize, 2);
});
test("stale cache still renders last-good weather marked stale", async () => {
  const data = fakeDb({payload: JSON.stringify(payload), fetched_at_ms: Date.now() - 720000,
    last_active_at_ms: Date.now()});
  const r = await request("/weatherApi?lat=37.5665&lon=126.978&name=Gwangmyeong",
    {DB: data.DB}, {waitUntil() {}});
  const json = await r.json();
  assert.equal(json.stale, true);
  assert.equal(json.location.name, "Gwangmyeong");
  assert.equal(json.cache.hit, true);
});
test("missing official API key returns explicit 503 and never fabricates weather", async () => {
  const r = await request("/weatherApi?lat=37.5665&lon=126.978", {DB: fakeDb().DB}, {},
    {collect: async () => {throw new Error("kma_key_missing");}});
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "domestic_provider_not_configured");
});
test("Cron gracefully handles no active locations", async () => {
  await handleScheduled({}, {DB: fakeDb().DB}, {});
});
