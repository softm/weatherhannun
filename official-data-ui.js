"use strict";
(function () {
  var core = window.WeatherHannunOfficialData;
  if (!core) return;
  var feed = null, weather = null, resolved = null;
  function formatTime(value) {
    if (!value) return "시각 없음";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "시각 오류" : date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function grade(pm10, pm25) {
    if (!Number.isFinite(pm10) && !Number.isFinite(pm25)) return "측정값 없음";
    if (pm10 > 150 || pm25 > 75) return "매우 나쁨";
    if (pm10 > 80 || pm25 > 35) return "나쁨";
    if (pm10 > 30 || pm25 > 15) return "보통";
    return "좋음";
  }
  function put(selector, value) { document.querySelectorAll(selector).forEach(function (node) { node.textContent = value; }); }
  function renderHome() {
    if (!resolved) return;
    var current = resolved.current, air = resolved.air;
    if (current) {
      put("[data-official-source]", "기상청 기온 실황 · " + (current.stationName || current.stationId) + " " + current.distanceKm.toFixed(1) + "km · 나머지는 모델 예보");
      put("[data-official-updated]", formatTime(current.observedAt));
      put("[data-official-temp]", Number.isFinite(current.temperature) ? String(current.temperature.toFixed(1)).replace(/\.0$/, "") : "--");
      document.querySelectorAll("[data-official-source]").forEach(function (node) { node.dataset.state = "ready"; });
    } else {
      put("[data-official-source]", "모델 예보 · 공식 실황 미확보");
      document.querySelectorAll("[data-official-source]").forEach(function (node) { node.dataset.state = "unavailable"; });
    }
    if (air) {
      put("[data-official-air-source]", "에어코리아 실측 · " + air.stationName + " · " + formatTime(air.measuredAt));
      put("[data-official-air-grade]", grade(air.pm10, air.pm25));
      put("[data-official-pm10]", "미세 " + (Number.isFinite(air.pm10) ? air.pm10 + "㎍/㎥" : "없음"));
      put("[data-official-pm25]", "초미세 " + (Number.isFinite(air.pm25) ? air.pm25 + "㎍/㎥" : "없음"));
    } else put("[data-official-air-source]", "에어코리아 실측 미확보 · 모델 예측과 구분");
    put("[data-official-warning]", resolved.warnings.length ? ("전국 발효 특보 " + resolved.warnings.length + "건 · 내 지역 적용 여부 원문 확인") : "발효 특보는 기상청 원문에서 확인");
  }
  function renderPanel() {
    var status = document.getElementById("officialMapLayerStatus");
    if (!status) return;
    if (!feed || feed.status !== "ready") {
      status.textContent = "공식 API 키·운영 이용승인 확인 전입니다. 현재는 원문 링크만 제공하며 실측으로 표시하지 않습니다.";
      status.dataset.state = "unavailable";
      return;
    }
    status.textContent = resolved && resolved.current ? "기상청 관측 " + formatTime(resolved.current.observedAt) + " · " + resolved.current.distanceKm.toFixed(1) + "km 관측소" : "가까운 최신 공식 관측을 찾지 못해 모델 예보로 표시합니다.";
    status.dataset.state = resolved && resolved.current ? "ready" : "unavailable";
    var radar = resolved && resolved.radar, image = document.getElementById("officialRadarImage"), meta = document.getElementById("officialRadarMeta");
    if (image && radar) { image.src = radar.imagePath + "?at=" + encodeURIComponent(radar.observedAt); image.hidden = false; }
    if (meta) meta.textContent = radar ? (radar.product + " · 관측 " + formatTime(radar.observedAt) + " · 범례 포함") : "레이더 이용권·관측시각·범례 확인 전에는 내부 영상을 표시하지 않습니다.";
  }
  function resolve() {
    if (!feed || !weather || !weather.loc) return;
    resolved = core.resolve(feed, weather.loc, new Date().toISOString());
    window.dispatchEvent(new CustomEvent("weatherhannun:official-data", { detail: resolved }));
    renderHome(); renderPanel();
  }
  function init() {
    fetch("./data/official/latest.json", { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("official snapshot " + response.status);
      return response.json();
    }).then(function (json) { feed = json; renderPanel(); resolve(); }).catch(function () { feed = { schemaVersion: 1, status: "unavailable" }; renderPanel(); });
  }
  window.addEventListener("weatherhannun:data", function (event) { weather = event.detail; setTimeout(resolve, 0); });
  window.addEventListener("weatherhannun:stitch-ready", function () { renderHome(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
