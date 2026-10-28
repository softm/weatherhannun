"use strict";
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WeatherHannunOfficialData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var KMA_MAX_KM = 80;
  var AIR_MAX_KM = 50;
  var KMA_MAX_AGE_MS = 2 * 60 * 60 * 1000;
  var AIR_MAX_AGE_MS = 4 * 60 * 60 * 1000;

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function radians(value) { return value * Math.PI / 180; }
  function distanceKm(aLat, aLon, bLat, bLon) {
    if (![aLat, aLon, bLat, bLon].every(finite)) return Infinity;
    var dLat = radians(bLat - aLat), dLon = radians(bLon - aLon);
    var a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function timeMs(value) {
    var parsed = typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }
  function fresh(value, now, maxAge) {
    var observed = timeMs(value), reference = timeMs(now) || Date.now();
    return observed !== null && observed <= reference + 10 * 60 * 1000 && reference - observed <= maxAge;
  }
  function nearest(rows, lat, lon, maxKm) {
    var selected = null;
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      var km = distanceKm(lat, lon, row && row.lat, row && row.lon);
      if (km <= maxKm && (!selected || km < selected.distanceKm)) selected = { row: row, distanceKm: km };
    });
    return selected;
  }
  function locationKey(lat, lon) { return lat.toFixed(3) + "," + lon.toFixed(3); }
  function observation(row, lat, lon) {
    if (!row || typeof row.stationId !== "string" || timeMs(row.observedAt) === null) return null;
    return {
      sourceKind: "observation",
      providerId: "kma-api-hub-asos",
      providerName: "기상청 지상관측",
      stationId: row.stationId,
      stationName: row.stationName || ("관측소 " + row.stationId),
      locationKey: locationKey(lat, lon),
      observedAt: row.observedAt,
      temperature: finite(row.temperature) ? row.temperature : null,
      precipitation: finite(row.precipitation) ? row.precipitation : null
    };
  }
  function resolve(feed, location, now) {
    var unavailable = { status: "unavailable", reason: "official_snapshot_unavailable", observations: null, current: null, air: null, warnings: [], radar: null, rights: [] };
    if (!feed || feed.schemaVersion !== 1 || feed.status !== "ready") return unavailable;
    var lat = location && Number(location.lat), lon = location && Number(location.lon);
    if (!finite(lat) || !finite(lon)) return Object.assign(unavailable, { reason: "location_unavailable", rights: feed.rights || [] });
    var currentRows = feed.kma && feed.kma.observations && feed.kma.observations.current;
    var picked = nearest(currentRows, lat, lon, KMA_MAX_KM);
    var currentFresh = picked && fresh(picked.row.observedAt, now, KMA_MAX_AGE_MS);
    var current = currentFresh ? picked.row : null;
    var previousRows = feed.kma && feed.kma.observations && feed.kma.observations.previous;
    var previous = current && (Array.isArray(previousRows) ? previousRows : []).find(function (row) { return row && row.stationId === current.stationId; });
    var airPicked = nearest(feed.airKorea && feed.airKorea.measurements, lat, lon, AIR_MAX_KM);
    var air = airPicked && fresh(airPicked.row.measuredAt, now, AIR_MAX_AGE_MS)
      ? Object.assign({}, airPicked.row, { distanceKm: airPicked.distanceKm }) : null;
    return {
      status: current ? "ready" : "partial",
      reason: current ? null : picked ? "official_observation_stale" : "nearby_fresh_observation_unavailable",
      current: current ? Object.assign({}, current, { distanceKm: picked.distanceKm }) : null,
      latestAvailable: !current && picked ? { observedAt: picked.row.observedAt, stationName: picked.row.stationName || picked.row.stationId, distanceKm: picked.distanceKm } : null,
      observations: current && previous ? { current: observation(current, lat, lon), previous: observation(previous, lat, lon) } : null,
      air: air,
      warnings: Array.isArray(feed.kma && feed.kma.warnings) ? feed.kma.warnings : [],
      radar: feed.kma && feed.kma.radar && feed.kma.radar.status === "ready" ? feed.kma.radar : null,
      rights: Array.isArray(feed.rights) ? feed.rights : [],
      generatedAt: feed.generatedAt || null
    };
  }
  return { resolve: resolve, distanceKm: distanceKm, nearest: nearest, constants: { KMA_MAX_KM: KMA_MAX_KM, AIR_MAX_KM: AIR_MAX_KM } };
});
