-- Dedicated PERSONALIZATION D1 database. Never run against weather-cache DB.
CREATE TABLE IF NOT EXISTS user_preferences (
 user_id TEXT PRIMARY KEY,
 settings_json TEXT NOT NULL DEFAULT '{}',
 activities_json TEXT NOT NULL DEFAULT '[]',
 alerts_json TEXT NOT NULL DEFAULT '[]',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_places (
 user_id TEXT NOT NULL,
 place_id TEXT NOT NULL,
 label TEXT NOT NULL,
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 sort_order INTEGER NOT NULL DEFAULT 0,
 is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,place_id)
);
CREATE INDEX IF NOT EXISTS idx_user_places_order ON user_places(user_id,sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_places_default ON user_places(user_id) WHERE is_default=1;
