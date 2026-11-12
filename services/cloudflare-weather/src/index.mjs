import {coordinates, dfsGrid, isSouthKorea, roundedLocationKey, validateContract} from "../../weather-api/core.mjs";
import {collectKma, collectMetNorway, collectAirKorea} from "../../weather-api/providers.mjs";
import {serveKvWeather} from "./kv-backend.mjs";

const ttlMs = {KR: 600000, GLOBAL: 1800000};
const allowed = (origin, env) => !origin || ["https://softm.github.io", "http://localhost:8080", "http://127.0.0.1:8080", ...String(env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim())].includes(origin);
function reply(value, status, origin, env, cacheControl = "no-store") {
  const headers = {"Content-Type": "application/json; charset=utf-8", "Cache-Control": cacheControl, "Vary": "Origin", "X-Content-Type-Options": "nosniff"};
  if (origin && allowed(origin, env)) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(value), {status, headers});
}
export function parseLocation(url) {
  const location = {...coordinates(Object.fromEntries(url.searchParams)),
    name: String(url.searchParams.get("name") || "선택 지역").slice(0, 80),
    stationName: String(url.searchParams.get("stationName") || "").slice(0, 80)};
  const kr = isSouthKorea(location);
  const grid = kr ? dfsGrid(location.lat, location.lon) : null;
  return {location, country: kr ? "KR" : "GLOBAL",
    key: kr ? "kr_" + grid.nx + "_" + grid.ny : "global_" + roundedLocationKey(location)};
}
async function collect(entry, env) {
  const options = {attempts: 1, timeoutMs: 7000};
  const payload = entry.country === "KR"
    ? await collectKma(entry.location, env.KMA_API_KEY, options)
    : await collectMetNorway(entry.location, options);
  if (entry.country === "KR" && env.AIRKOREA_API_KEY && entry.location.stationName) {
    try {payload.airQuality = await collectAirKorea(entry.location, env.AIRKOREA_API_KEY, options);}
    catch (e) {console.warn("airkorea_unavailable", String(e?.message || e));}
  }
  if (!validateContract(payload).valid) throw new Error("invalid_weather_contract");
  return payload;
}
async function markActive(env, entry, now, lastActive) {
  if (now - Number(lastActive || 0) < 3600000) return;
  await env.DB.prepare("INSERT INTO weather_locations (id,lat,lon,name,station_name,country,last_active_at_ms,last_synced_at_ms) VALUES (?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET last_active_at_ms=excluded.last_active_at_ms, name=excluded.name, station_name=excluded.station_name WHERE weather_locations.last_active_at_ms < ?")
    .bind(entry.key, entry.location.lat, entry.location.lon, entry.location.name, entry.location.stationName,
      entry.country, now, now - 3600000).run();
}
async function save(env, entry, payload, at) {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO weather_cache (id,country,payload,fetched_at_ms) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,fetched_at_ms=excluded.fetched_at_ms,country=excluded.country")
      .bind(entry.key, entry.country, JSON.stringify(payload), at),
    env.DB.prepare("INSERT INTO weather_locations (id,lat,lon,name,station_name,country,last_active_at_ms,last_synced_at_ms) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_synced_at_ms=excluded.last_synced_at_ms")
      .bind(entry.key, entry.location.lat, entry.location.lon, entry.location.name, entry.location.stationName, entry.country, at, at)
  ]);
}
// Refresh stale cache without blocking users. A D1 conditional update provides a
// two-minute per-location lease to avoid a burst of duplicate upstream requests.
async function refreshStale(env, entry, now, dependencies = {}) {
  const lease = await env.DB.prepare(
    "UPDATE weather_locations SET last_synced_at_ms=? WHERE id=? AND last_synced_at_ms < ?"
  ).bind(now, entry.key, now - 120000).run();
  if (Number(lease?.meta?.changes || 0) !== 1) return;
  try {
    const payload = await (dependencies.collect || collect)(entry, env);
    await save(env, entry, payload, Date.now());
  } catch (e) {
    console.warn("weather_stale_refresh_failed", entry.key, String(e?.message || e));
  }
}
export async function handleRequest(request, env, ctx, dependencies = {}) {
  const origin = request.headers.get("Origin") || "";
  const url = new URL(request.url);
  if (!allowed(origin, env)) return reply({error: "origin_not_allowed"}, 403, origin, env);
  if (request.method === "OPTIONS") {
    const headers = {"Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin"};
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    return new Response(null, {status: 204, headers});
  }
  if (request.method !== "GET") return reply({error: "method_not_allowed"}, 405, origin, env);
  if (["/", "/health", "/weatherHealth"].includes(url.pathname)) {
    let dbReady = Boolean(env.DB);
    if (dbReady) {
      try {await env.DB.prepare("SELECT id FROM weather_cache LIMIT 1").first();}
      catch (e) {dbReady = false; console.error("d1_health_check_failed", String(e?.message || e));}
    }
    let kvReady = !dbReady && Boolean(env.CACHE);
    if (kvReady) {
      try {await env.CACHE.get("__weatherhannun_probe");}
      catch (e) {kvReady = false; console.error("kv_health_check_failed", String(e?.message || e));}
    }
    return reply({
    ok: dbReady || kvReady, backend: "cloudflare-workers",
    database: dbReady ? "d1" : kvReady ? "kv" : "unavailable",
    providers: {metNorway: "ready", kma: env.KMA_API_KEY && env.KMA_API_KEY !== "UNCONFIGURED" ? "configured" : "missing_secret",
      airKorea: env.AIRKOREA_API_KEY && env.AIRKOREA_API_KEY !== "UNCONFIGURED" ? "configured" : "missing_secret", wwis: "approval_required"},
    checkedAt: new Date().toISOString()
  }, dbReady || kvReady ? 200 : 503, origin, env);
  }
  if (!["/weatherApi", "/v1/weather"].includes(url.pathname)) return reply({error: "not_found"}, 404, origin, env);
  if (!env.DB && !env.CACHE) return reply({error: "weather_database_not_configured"}, 503, origin, env);
  let entry;
  try {entry = parseLocation(url);} catch {return reply({error: "invalid_coordinates"}, 400, origin, env);}
  // Rate-limit high-volume callers before any paid-provider / D1 operations.
  // Cloudflare sets CF-Connecting-IP; never trust client-supplied query parameters as identity.
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp && env.CLIENT_RATE_LIMITER) {
    try {
      const decision = await env.CLIENT_RATE_LIMITER.limit({key: clientIp});
      if (!decision.success) return reply({error: "rate_limited"}, 429, origin, env);
    } catch (error) {
      console.error("rate_limit_unavailable", String(error?.message || error));
      return reply({error: "rate_limit_unavailable"}, 503, origin, env);
    }
  }
  if (!env.DB) {
    return serveKvWeather({
      entry, env, ctx, origin, reply,
      collect: dependencies.collect || collect,
      freshnessMs: ttlMs[entry.country]
    });
  }
  let record;
  try {
    record = await env.DB.prepare("SELECT c.payload,c.fetched_at_ms,l.last_active_at_ms FROM weather_cache c LEFT JOIN weather_locations l ON c.id=l.id WHERE c.id=?")
      .bind(entry.key).first();
  } catch (e) {
    console.error("d1_read_failed", String(e?.message || e));
    return reply({error: "weather_database_unavailable"}, 503, origin, env);
  }
  const now = Date.now();
  if (record?.payload) {
    try {
      const payload = JSON.parse(record.payload);
      const stale = now - Number(record.fetched_at_ms) > ttlMs[entry.country];
      if (ctx?.waitUntil) ctx.waitUntil(markActive(env, entry, now, record.last_active_at_ms).catch(e =>
        console.warn("d1_location_registration_failed", String(e?.message || e))));
      const refreshQueued = stale && Boolean(ctx?.waitUntil);
      if (refreshQueued) ctx.waitUntil(refreshStale(env, entry, now, dependencies).catch(e =>
        console.warn("weather_stale_refresh_unavailable", entry.key, String(e?.message || e))));
      return reply({...payload, location: {...payload.location, name: entry.location.name, lat: entry.location.lat, lon: entry.location.lon},
        stale, cache: {hit: true, fallback: stale, refreshQueued}}, 200, origin, env,
        "public, max-age=60, s-maxage=60");
    } catch (e) {console.warn("weather_cache_corrupt", String(e?.message || e));}
  }
  try {
    const payload = await (dependencies.collect || collect)(entry, env);
    await save(env, entry, payload, now);
    return reply({...payload, cache: {hit: false, fallback: false}}, 200, origin, env,
      "public, max-age=60, s-maxage=60");
  } catch (e) {
    if (e?.message === "kma_key_missing") return reply({error: "domestic_provider_not_configured"}, 503, origin, env);
    console.error("weather_provider_unavailable", String(e?.message || e));
    return reply({error: "weather_provider_unavailable"}, 502, origin, env);
  }
}
export async function handleScheduled(_controller, env, _ctx, dependencies = {}) {
  if (!env.DB) return;
  const rows = await env.DB.prepare("SELECT id,lat,lon,name,station_name,country FROM weather_locations WHERE last_active_at_ms >= ? AND (country = 'GLOBAL' OR ? = 1) ORDER BY last_synced_at_ms ASC LIMIT 3")
    .bind(Date.now() - 7200000, env.KMA_API_KEY && env.KMA_API_KEY !== "UNCONFIGURED" ? 1 : 0).all();
  for (const row of rows.results || []) {
    const entry = {key: row.id, country: row.country,
      location: {lat: row.lat, lon: row.lon, name: row.name, stationName: row.station_name}};
    try {
      const payload = await (dependencies.collect || collect)(entry, env);
      await save(env, entry, payload, Date.now());
    } catch (e) {console.warn("weather_sync_failed", entry.key, String(e?.message || e));}
  }
}
export default {
  fetch: (request, env, ctx) => handleRequest(request, env, ctx),
  scheduled: (controller, env, ctx) => handleScheduled(controller, env, ctx)
};
