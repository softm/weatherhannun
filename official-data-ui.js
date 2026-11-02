"use strict";
(function () {
  var core = window.WeatherHannunOfficialData;
  if (!core) return;
  var STORAGE_KEY = "weatherhannun_official_snapshot_v1";
  var feed = null, weather = null, resolved = null, lastLoadedAt = 0;
  function storedFeed() {
    try {
      var value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return value && value.schemaVersion === 1 && value.status === "ready" ? value : null;
    } catch (_) { return null; }
  }
  function rememberFeed(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) { }
  }
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
  function warningSummary() {
    var place = weather && weather.loc && weather.loc.name || "현재 지역";
    var local = resolved && Array.isArray(resolved.localWarnings) ? resolved.localWarnings : [];
    var all = resolved && Array.isArray(resolved.warnings) ? resolved.warnings : [];
    if (!resolved || !resolved.warningFeedReady) return { state: "unavailable", text: "공식 특보 연동 확인 중 · 기상청 원문 확인" };
    if (local.length) return { state: "local", text: place + " 적용 특보 " + local.length + "건 · 원문 확인" };
    if (all.length) return { state: "elsewhere", text: place + " 적용 특보 없음 · 전국 다른 지역 " + all.length + "건" };
    return { state: "clear", text: "현재 스냅샷 기준 " + place + " 적용 특보 없음" };
  }
  function renderHome() {
    if (!resolved) return;
    var current = resolved.current, air = resolved.air;
    if (current) {
      put("[data-official-source]", "기상청 기온 실황 · " + (current.stationName || current.stationId) + " " + current.distanceKm.toFixed(1) + "km · 나머지는 모델 예보");
      put("[data-official-updated]", formatTime(current.observedAt));
      put("[data-official-temp]", Number.isFinite(current.temperature) ? String(current.temperature.toFixed(1)).replace(/\.0$/, "") : "--");
      document.querySelectorAll("[data-official-source]").forEach(function (node) { node.dataset.state = "ready"; });
    } else {
      put("[data-official-source]", resolved.latestAvailable ? "모델 예보 · 공식 관측 갱신 대기 (마지막 "+formatTime(resolved.latestAvailable.observedAt)+")" : "모델 예보 · 공식 실황 미확보");
      document.querySelectorAll("[data-official-source]").forEach(function (node) { node.dataset.state = "unavailable"; });
    }
    if (air) {
      put("[data-official-air-source]", "에어코리아 실측 · " + air.stationName + " · " + formatTime(air.measuredAt));
      var airGrade = grade(air.pm10, air.pm25);
      put("[data-official-air-grade]", airGrade);
      put("[data-official-pm10]", "미세 " + (Number.isFinite(air.pm10) ? air.pm10 + "㎍/㎥" : "없음"));
      put("[data-official-pm25]", "초미세 " + (Number.isFinite(air.pm25) ? air.pm25 + "㎍/㎥" : "없음"));
      put("#airSummarySource", "에어코리아 실측 · " + air.stationName + " · " + formatTime(air.measuredAt));
      put("#airSummaryGrade", "공기 " + airGrade);
      put("#airPm10", Number.isFinite(air.pm10) ? air.pm10 : "--");
      put("#airPm25", Number.isFinite(air.pm25) ? air.pm25 : "--");
      put("#airSummaryAdvice", airGrade === "좋음" ? "환기와 야외활동에 좋아요." : airGrade === "보통" ? "일상 활동은 무난하고 민감군은 상태를 살펴보세요." : airGrade === "나쁨" ? "외출 전 마스크를 준비하고 환기는 짧게 하세요." : "야외활동을 줄이고 보건용 마스크를 착용하세요.");
      put("[data-official-air-advice]", airGrade === "좋음" ? "환기와 야외활동에 좋아요." : airGrade === "보통" ? "일상 활동은 무난하고 민감군은 상태를 살펴보세요." : airGrade === "나쁨" ? "외출 전 마스크를 준비하고 환기는 짧게 하세요." : "야외활동을 줄이고 보건용 마스크를 착용하세요.");
      var summaryGrade = document.getElementById("airSummaryGrade");
      if (summaryGrade) summaryGrade.className = "air-summary-grade " + (airGrade === "좋음" ? "good" : airGrade === "보통" ? "normal" : airGrade === "나쁨" ? "bad" : "very-bad");
    } else put("[data-official-air-source]", "에어코리아 실측 미확보 · 모델 예측과 구분");
    var warning = warningSummary();
    put("[data-official-warning]", warning.text);
    document.querySelectorAll(".official-glance-line").forEach(function (node) { node.dataset.warningState = warning.state;
      var hero=node.closest('.stitch-dashboard-hero'),context=hero&&hero.querySelector('.stitch-current-context'),combined=hero&&hero.querySelector('.stitch-current-briefing');
      if(hero&&context&&combined){if(warning.state==='local')hero.insertBefore(node,combined);else context.append(node);} });
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
  function loadFeed() {
    return fetch("./data/official/latest.json?refresh="+Date.now(), { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("official snapshot " + response.status);
      return response.json();
    }).then(function (json) { feed = json; rememberFeed(json); lastLoadedAt=Date.now(); renderPanel(); resolve(); }).catch(function () { if(!feed)feed = { schemaVersion: 1, status: "unavailable" }; renderPanel(); resolve(); });
  }
  function init() {
    feed = storedFeed();
    if (feed) { renderPanel(); resolve(); }
    loadFeed();
    setInterval(loadFeed,15*60*1000);
    document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"&&Date.now()-lastLoadedAt>10*60*1000)loadFeed();});
  }
  window.addEventListener("weatherhannun:data", function (event) { weather = event.detail; setTimeout(resolve, 0); });
  window.addEventListener("weatherhannun:stitch-ready", function () { renderHome(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
