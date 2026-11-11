-- Idempotent initial weather cache schema; migration tracked by Wrangler.
CREATE TABLE IF NOT EXISTS weather_cache (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weather_locations (
  id TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  name TEXT NOT NULL,
  station_name TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL,
  last_active_at_ms INTEGER NOT NULL,
  last_synced_at_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_weather_locations_refresh ON weather_locations(last_synced_at_ms);
