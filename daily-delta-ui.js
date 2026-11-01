"use strict";
(function () {
  var core = window.WeatherHannunDailyDelta;
  if (!core) return;
  var latest = null;

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function signed(value, suffix) {
    if (!finite(value)) return "수치 없음";
    if (Math.abs(value) < 0.05) return "차이 없음";
    return (value > 0 ? "+" : "") + value.toFixed(1) + suffix;
  }
  function render() {
    var nodes = document.querySelectorAll("[data-daily-delta]");
    if (!nodes.length) return;
    var result = core.compare(latest && latest.observations);
    nodes.forEach(function (node) {
      var value = node.querySelector("[data-daily-delta-value]");
      var reason = node.querySelector("[data-daily-delta-reason]");
      var meta = node.querySelector("[data-daily-delta-meta]");
      node.dataset.state = result.status;
      if (result.status === "ready") {
        node.dataset.detail = "ready";
        value.textContent = "기온 " + signed(result.temperatureDelta, "°C");
        reason.textContent = finite(result.precipitationDelta)
          ? "강수량 " + signed(result.precipitationDelta, " mm")
          : "강수 비교 자료 없음";
        meta.textContent = result.providerName + " · " + result.stationName;
      } else {
        var stale = latest && latest.reason === "official_observation_stale";
        node.dataset.detail = stale ? "waiting" : "missing";
        value.textContent = stale ? "관측 자료 대기" : "비교 자료 없음";
        reason.textContent = stale
          ? "마지막 관측 "+(latest.latestAvailable?.observedAt||"시각 확인 필요")+""
          : "오늘·어제 관측 자료 필요";
        meta.textContent = "공식 관측 기준";
      }
    });
  }
  window.addEventListener("weatherhannun:data", function (event) { latest = event.detail; render(); });
  window.addEventListener("weatherhannun:official-data", function (event) { latest = event.detail; render(); });
  window.addEventListener("weatherhannun:stitch-ready", render);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
})();
