"use strict";
(function () {
  var core = window.WeatherHannunLocationCompare;
  if (!core) return;

  var PRESETS = [
    { name: "서울", lat: 37.5665, lon: 126.978, regionCenter: true },
    { name: "부산", lat: 35.1796, lon: 129.0756, regionCenter: true },
    { name: "대전", lat: 36.3504, lon: 127.3845, regionCenter: true },
    { name: "광주", lat: 35.1595, lon: 126.8526, regionCenter: true },
    { name: "제주", lat: 33.4996, lon: 126.5312, regionCenter: true }
  ];
  var latest = null;
  var pool = new Map();
  var destinationWeather = null;
  var destinationPlace = null;
  var cache = new Map();
  var requestTicket = 0;
  var controller = null;
  var initialized = false;

  function $(id) { return document.getElementById(id); }
  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
  function number(value, decimals) { return finite(value) ? value.toFixed(decimals || 0) : "--"; }
  function signed(value, suffix) {
    if (!finite(value)) return "차이 계산 불가";
    if (Math.abs(value) < 0.05) return "차이 없음";
    return (value > 0 ? "+" : "") + number(value, 1) + suffix;
  }
  function timeLabel(value) {
    if (typeof value !== "string" || value.length < 13) return "시각 정보 없음";
    var parsed = new Date(value.length === 16 ? value + ":00+09:00" : value + "+09:00");
    if (!Number.isFinite(parsed.getTime())) return value.replace("T", " ");
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit"
    }).format(parsed);
  }
  function weatherDescription(row) {
    if (window.WeatherIcons) return window.WeatherIcons.describe(row.weatherCode, row.isDay);
    return { name: "날씨 정보 없음", key: "unknown" };
  }
  function weatherMarkup(row) {
    return window.WeatherIcons
      ? window.WeatherIcons.markup(row.weatherCode, row.isDay, "weather-glyph--tile")
      : '<span class="weather-glyph-fallback" aria-hidden="true">?</span>';
  }
  function storageGet() { try { return localStorage.getItem("weatherhannun_compare_destination_v1") || ""; } catch (_) { return ""; } }
  function storageSet(value) { try { localStorage.setItem("weatherhannun_compare_destination_v1", value); } catch (_) {} }

  function setStatus(message, state) {
    var node = $("compareStatus");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = state || "idle";
  }

  function destinations() {
    var saved = window.WeatherLocationManager && window.WeatherLocationManager.getSavedPlaces
      ? window.WeatherLocationManager.getSavedPlaces() : [];
    var values = saved.concat(PRESETS).map(core.normalizePlace).filter(Boolean);
    var seen = new Set();
    return values.filter(function (place) {
      var key = core.placeKey(place);
      if (!key || seen.has(key) || core.samePlace(place, latest && latest.loc)) return false;
      seen.add(key);
      return true;
    });
  }

  function populateDestinations() {
    var select = $("compareDestination");
    if (!select) return;
    var previous = select.value || storageGet();
    pool = new Map();
    select.replaceChildren();
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "목적지를 선택하세요";
    select.appendChild(placeholder);
    destinations().forEach(function (place) {
      var key = core.placeKey(place);
      pool.set(key, place);
      var option = document.createElement("option");
      option.value = key;
      option.textContent = place.name + (place.regionCenter ? " · 지역 대표 위치" : "");
      select.appendChild(option);
    });
    if (pool.has(previous)) select.value = previous;
    else if (pool.size) select.value = pool.keys().next().value;
    destinationPlace = pool.get(select.value) || null;
    if (destinationPlace) storageSet(select.value);
  }

  function populateTimes() {
    var select = $("compareTime");
    if (!select) return "";
    var previous = select.value;
    var times = latest && destinationWeather ? core.commonTimes(latest.weather, destinationWeather) : [];
    select.replaceChildren();
    times.slice(0, 168).forEach(function (time) {
      var option = document.createElement("option");
      option.value = time;
      option.textContent = timeLabel(time);
      select.appendChild(option);
    });
    if (times.includes(previous)) select.value = previous;
    select.disabled = !times.length;
    return select.value || times[0] || "";
  }

  function placeQualifier(place) {
    if (place.regionCenter) return "행정구역 대표 위치 기준";
    if (place.approximate) return "GPS 주변 위치 기준";
    return "선택 좌표 기준";
  }

  function sideMarkup(side, role) {
    var row = side.row;
    var condition = weatherDescription(row);
    var rainText = side.rain.known
      ? number(side.rain.probability) + "% · " + number(side.rain.precipitation, 1) + " mm/h"
      : "강수 수치 제공 안 됨";
    return '<article class="compare-place-card '+role+'">' +
      '<div class="compare-place-head"><span class="compare-role">'+(role === "origin" ? "현재 지역" : "목적지")+'</span><h3>'+escapeHtml(side.place.name)+'</h3><small>'+escapeHtml(placeQualifier(side.place))+'</small></div>'+
      '<div class="compare-weather-main"><span class="compare-weather-icon" aria-hidden="true">'+weatherMarkup(row)+'</span><strong>'+number(row.temp, 1)+'°</strong><span>'+escapeHtml(condition.name)+'</span></div>'+
      '<dl class="compare-metrics"><div><dt>비</dt><dd class="'+(side.rain.triggered?"signal":"")+'">'+escapeHtml(rainText)+'</dd></div>'+
      '<div><dt>바람</dt><dd>'+number(row.wind, 1)+' km/h</dd></div>'+
      '<div><dt>돌풍</dt><dd>'+number(row.gust, 1)+' km/h</dd></div>'+
      '<div><dt>공식 특보</dt><dd>앱 내 자료 미연동</dd></div></dl></article>';
  }

  function render() {
    var resultNode = $("compareResults");
    if (!resultNode) return;
    if (!latest || !latest.weather) {
      resultNode.innerHTML = '<div class="empty-state">현재 지역 예보를 먼저 불러오고 있습니다.</div>';
      return;
    }
    if (!destinationPlace || !destinationWeather) {
      resultNode.innerHTML = '<div class="empty-state">비교할 목적지를 선택하면 동일 시각 예보를 나란히 보여드립니다.</div>';
      return;
    }
    var time = populateTimes();
    var comparison = core.compare(latest.loc, latest.weather, destinationPlace, destinationWeather, time);
    if (comparison.status !== "ready") {
      resultNode.innerHTML = '<div class="empty-state">두 지역에서 함께 제공되는 동일 시각 예보가 없습니다.</div>';
      setStatus("비교할 수 있는 공통 예보 시각이 없습니다.", "error");
      return;
    }
    var temperatureSummary = signed(comparison.delta.temperature, "°C");
    var windSummary = signed(comparison.delta.wind, " km/h");
    var rainSummary = comparison.destination.rain.triggered && !comparison.origin.rain.triggered
      ? "목적지에만 비 신호가 있습니다."
      : !comparison.destination.rain.triggered && comparison.origin.rain.triggered
        ? "현재 지역에만 비 신호가 있습니다."
        : comparison.destination.rain.triggered && comparison.origin.rain.triggered
          ? "두 지역 모두 비 신호가 있습니다."
          : comparison.destination.rain.known && comparison.origin.rain.known
            ? "두 지역 모두 뚜렷한 비 신호가 낮습니다."
            : "강수 수치가 부족해 비 신호를 단정하지 않습니다.";
    resultNode.innerHTML = '<div class="compare-summary" aria-live="polite"><span class="material-symbols-outlined" aria-hidden="true">compare_arrows</span><div><b>'+escapeHtml(timeLabel(comparison.time))+' 동일 유효시각</b><p>목적지는 현재 지역보다 기온 '+escapeHtml(temperatureSummary)+', 바람 '+escapeHtml(windSummary)+'입니다. '+escapeHtml(rainSummary)+'</p></div></div>'+
      '<div class="compare-place-grid">'+sideMarkup(comparison.origin,"origin")+sideMarkup(comparison.destination,"destination")+'</div>';
    $("compareSource").textContent = comparison.sourceLabel + " · 예보끼리 비교 · 실측 관측 아님";
    $("compareAlertStatus").textContent = comparison.officialAlerts.reason;
    setStatus("동일 시각 기준으로 비교했습니다.", "ready");
  }

  async function loadDestination(force) {
    var select = $("compareDestination");
    destinationPlace = pool.get(select && select.value) || null;
    destinationWeather = null;
    if (!destinationPlace) { render(); return; }
    storageSet(select.value);
    var key = core.placeKey(destinationPlace);
    var saved = cache.get(key);
    if (!force && saved && Date.now() - saved.fetchedAt < 10 * 60 * 1000) {
      destinationWeather = saved.weather;
      render();
      return;
    }
    if (controller) controller.abort();
    controller = new AbortController();
    var ticket = ++requestTicket;
    setStatus(destinationPlace.name + " 예보를 불러오는 중…", "loading");
    $("compareRefresh").disabled = true;
    try {
      var response = await fetch(core.buildForecastUrl(destinationPlace), { signal: controller.signal });
      if (!response.ok) throw new Error("목적지 예보 응답 " + response.status);
      var weather = await response.json();
      if (!weather || weather.error || !weather.hourly || !Array.isArray(weather.hourly.time)) throw new Error("목적지 예보 형식 오류");
      if (ticket !== requestTicket) return;
      destinationWeather = weather;
      cache.set(key, { weather: weather, fetchedAt: Date.now() });
      render();
    } catch (error) {
      if (error && error.name === "AbortError") return;
      if (ticket !== requestTicket) return;
      setStatus("목적지 예보를 불러오지 못했습니다. 다시 시도해 주세요.", "error");
      $("compareResults").innerHTML = '<div class="empty-state">'+escapeHtml(error && error.message || "목적지 예보 연결 실패")+'</div>';
    } finally {
      if (ticket === requestTicket) $("compareRefresh").disabled = false;
    }
  }

  function init() {
    if (initialized || !$("view-compare")) return;
    initialized = true;
    $("compareDestination").addEventListener("change", function () { loadDestination(false); });
    $("compareTime").addEventListener("change", render);
    $("compareRefresh").addEventListener("click", function () { loadDestination(true); });
    populateDestinations();
    render();
  }

  window.addEventListener("weatherhannun:data", function (event) {
    latest = event.detail;
    if (!initialized) init();
    var previous = destinationPlace && core.placeKey(destinationPlace);
    populateDestinations();
    if (previous && pool.has(previous)) {
      $("compareDestination").value = previous;
      destinationPlace = pool.get(previous);
    }
    if (document.getElementById("view-compare") && document.getElementById("view-compare").classList.contains("active")) loadDestination(false);
  });
  window.addEventListener("weatherhannun:places-changed", function () { if (initialized) populateDestinations(); });
  window.addEventListener("weatherhannun:view", function (event) {
    if (event.detail && event.detail.view === "compare") {
      if (event.detail.data) latest = event.detail.data;
      populateDestinations();
      loadDestination(false);
    }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
