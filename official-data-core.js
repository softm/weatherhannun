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
  var WARNING_MAX_AGE_MS = 30 * 60 * 1000;
  var WARNING_TYPES = Object.freeze({
    W: ["강풍", "간판·화분 등 날릴 물건을 고정하고 해안·교량·산지 이동을 줄이세요."],
    R: ["호우", "하천·지하차도·저지대 접근을 피하고 배수로와 차량 이동 경로를 확인하세요."],
    C: ["한파", "보온을 강화하고 수도관·농작물·가축의 동해를 대비하세요."],
    D: ["건조", "산불·화재 위험이 큽니다. 야외 소각과 불씨 사용을 피하세요."],
    O: ["폭풍해일", "해안 저지대와 방파제 접근을 피하고 침수 가능 구역에서 이동하세요."],
    N: ["지진해일", "해안에서 즉시 벗어나 높은 곳 또는 지정 대피장소로 이동하세요."],
    V: ["풍랑", "해상 운항·조업을 재검토하고 방파제와 해안가 접근을 피하세요."],
    T: ["태풍", "외출을 줄이고 창문·간판·시설물을 점검하며 공식 대피 안내를 따르세요."],
    S: ["대설", "미끄럼·적설에 대비해 차량 운행을 줄이고 시설물 적설을 점검하세요."],
    Y: ["황사", "외출을 줄이고 보건용 마스크를 준비하며 창문을 닫으세요."],
    H: ["폭염", "낮 시간 야외활동을 줄이고 수분을 자주 섭취하며 취약자를 확인하세요."],
    F: ["안개", "운전 속도를 낮추고 앞차와 거리를 충분히 확보하세요."]
  });
  var WARNING_LEVELS = Object.freeze({ "1": "예비특보", "2": "주의보", "3": "경보" });
  var CANCEL_COMMANDS = new Set(["3", "4", "7"]);

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
  function compactRegion(value) {
    return typeof value === "string" ? value.replace(/\s+/g, "").replace(/특별자치도|특별자치시|특별시|광역시/g, "").trim() : "";
  }
  function regionTokens(value) {
    var whole = compactRegion(value);
    var parts = String(value || "").split(/[(),/·.]/).map(compactRegion).filter(function (token) {
      return token.length >= 2 && !/^(육상|해상|앞바다|먼바다|산지|전국)$/.test(token);
    });
    return Array.from(new Set([whole].concat(parts).filter(function (token) { return token.length >= 2; })));
  }
  function activeWarning(row) {
    return !!row && !CANCEL_COMMANDS.has(String(row.command || ""));
  }
  function warningApplies(row, location) {
    if (!activeWarning(row) || !location) return false;
    var region = compactRegion(row.regionName), upper = compactRegion(row.upperRegionName);
    if (region.includes("전국") || upper.includes("전국")) return true;
    var locationText = compactRegion([location.name, location.address].filter(Boolean).join(" "));
    if (!locationText) return false;
    var shortUpper = upper.replace(/(?:도|시)$/g, "");
    var specific = regionTokens(row.regionName).filter(function (token) {
      return region === upper || token !== upper && token !== shortUpper;
    });
    if (specific.some(function (token) {
      var shortToken = token.replace(/(?:도|시|군|구|읍|면|동)$/g, "");
      return locationText.includes(token) || shortToken.length >= 2 && locationText.includes(shortToken);
    })) return true;
    // A broad upper region must not make a sub-region warning apply everywhere.
    // Use it only when the feed did not supply a more specific region.
    if (!region || region === upper) {
      return upper.length >= 2 && (locationText.includes(upper) || shortUpper.length >= 2 && locationText.includes(shortUpper));
    }
    return false;
  }
  function warningKey(row) {
    return [row && row.regionCode, row && row.warningCode, row && row.level, row && row.effectiveAt, row && row.announcedAt].map(function (value) { return String(value || "-"); }).join("|");
  }
  function warningInsight(row) {
    if (!row) return null;
    var info = WARNING_TYPES[String(row.warningCode || "").toUpperCase()] || ["기상", "위험 지역 접근을 줄이고 기상청의 최신 안전 안내를 확인하세요."];
    var level = WARNING_LEVELS[String(row.level || "")] || "특보";
    return {
      key: warningKey(row),
      phenomenon: info[0],
      level: level,
      title: info[0] + level,
      area: [row.upperRegionName, row.regionName].filter(Boolean).filter(function (value, index, all) { return all.indexOf(value) === index; }).join(" · ") || "적용 지역 확인",
      announcedAt: row.announcedAt || null,
      effectiveAt: row.effectiveAt || null,
      action: info[1]
    };
  }
  function warningStatus(warning, now) {
    var level = String(warning && warning.level || "");
    if (level === "1" || level === "예비특보") return "발표";
    var effective = timeMs(warning && warning.effectiveAt), reference = timeMs(now) || Date.now();
    return effective !== null && effective > reference ? "발효 예정" : "발효 중";
  }
  function resolve(feed, location, now) {
    var unavailable = { status: "unavailable", reason: "official_snapshot_unavailable", observations: null, current: null, air: null, warnings: [], localWarnings: [], warningFeedReady: false, radar: null, rights: [] };
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
    var warnings = Array.isArray(feed.kma && feed.kma.warnings) ? feed.kma.warnings.filter(activeWarning) : [];
    var warningFeedReady = fresh(feed.warningGeneratedAt || feed.generatedAt, now, WARNING_MAX_AGE_MS);
    return {
      status: current ? "ready" : "partial",
      reason: current ? null : picked ? "official_observation_stale" : "nearby_fresh_observation_unavailable",
      current: current ? Object.assign({}, current, { distanceKm: picked.distanceKm }) : null,
      latestAvailable: !current && picked ? { observedAt: picked.row.observedAt, stationName: picked.row.stationName || picked.row.stationId, distanceKm: picked.distanceKm } : null,
      observations: current && previous ? { current: observation(current, lat, lon), previous: observation(previous, lat, lon) } : null,
      air: air,
      warnings: warnings,
      localWarnings: warningFeedReady ? warnings.filter(function (row) { return warningApplies(row, location); }) : [],
      warningFeedReady: warningFeedReady,
      radar: feed.kma && feed.kma.radar && feed.kma.radar.status === "ready" ? feed.kma.radar : null,
      rights: Array.isArray(feed.rights) ? feed.rights : [],
      generatedAt: feed.generatedAt || null
    };
  }
  return { resolve: resolve, distanceKm: distanceKm, nearest: nearest, warningApplies: warningApplies, activeWarning: activeWarning, warningKey: warningKey, warningInsight: warningInsight, warningStatus: warningStatus, constants: { KMA_MAX_KM: KMA_MAX_KM, AIR_MAX_KM: AIR_MAX_KM, WARNING_MAX_AGE_MS: WARNING_MAX_AGE_MS } };
});
