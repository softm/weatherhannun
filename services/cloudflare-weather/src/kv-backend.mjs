// Workers KV fallback for read-heavy, free-tier weather caching.
// D1 remains the preferred backend when an explicit D1 binding exists.
const keyFor = entry => "weatherhannun:v2:" + entry.key;
const retentionSeconds = 2 * 24 * 60 * 60;

function display(payload, entry, stale, cache) {
  return {
    ...payload,
    location: {...payload.location, name: entry.location.name, lat: entry.location.lat, lon: entry.location.lon},
    stale,
    cache,
  };
}

async function store(env, entry, payload, timestamp) {
  // Keep the last good forecast for 48 hours; an error never overwrites it.
  await env.CACHE.put(keyFor(entry), JSON.stringify({payload, fetchedAtMs: timestamp}), {
    expirationTtl: retentionSeconds,
  });
}

async function fetchAndStore(entry, env, collector) {
  const payload = await collector(entry, env);
  await store(env, entry, payload, Date.now());
  return payload;
}

export async function serveKvWeather({entry, env, ctx, origin, reply, collect, freshnessMs}) {
  let cached;
  try {
    const raw = await env.CACHE.get(keyFor(entry));
    cached = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("weather_kv_read_failed", String(e?.message || e));
    return reply({error: "weather_database_unavailable"}, 503, origin, env);
  }
  const now = Date.now();
  const validCached = cached?.payload && typeof cached.fetchedAtMs === "number";
  if (validCached) {
    const stale = now - cached.fetchedAtMs > freshnessMs;
    if (stale && ctx?.waitUntil) {
      // On stale data, refresh asynchronously without delaying the UI.
      ctx.waitUntil(fetchAndStore(entry, env, collect).catch(e =>
        console.warn("weather_kv_refresh_failed", entry.key, String(e?.message || e))));
    }
    return reply(display(cached.payload, entry, stale, {
      hit: true, fallback: stale, refreshQueued: stale && Boolean(ctx?.waitUntil)
    }), 200, origin, env, "public, max-age=60, s-maxage=60");
  }
  try {
    const payload = await collect(entry, env);
    try {await store(env, entry, payload, now);}
    catch (e) {console.warn("weather_kv_write_failed", String(e?.message || e));}
    return reply(display(payload, entry, false, {hit: false, fallback: false}), 200,
      origin, env, "public, max-age=60, s-maxage=60");
  } catch (e) {
    if (e?.message === "kma_key_missing") {
      return reply({error: "domestic_provider_not_configured"}, 503, origin, env);
    }
    console.error("weather_kv_provider_failed", String(e?.message || e));
    return reply({error: "weather_provider_unavailable"}, 502, origin, env);
  }
}
