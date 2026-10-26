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
        value.textContent = "기온 " + signed(result.temperatureDelta, "°C");
        reason.textContent = finite(result.precipitationDelta)
          ? "강수량 " + signed(result.precipitationDelta, " mm")
          : "강수 관측값은 비교할 수 없습니다.";
        meta.textContent = result.providerName + " · " + result.stationName + " · 동일 관측소/시각";
      } else {
        value.textContent = "비교 불가";
        reason.textContent = "현재 연결된 값은 모델 예보입니다. 동일 관측소의 어제 관측자료가 확보된 경우에만 증감을 표시합니다.";
        meta.textContent = "예보를 관측으로 가장하거나 누락 수치로 차이를 만들지 않습니다.";
      }
    });
  }
  window.addEventListener("weatherhannun:data", function (event) { latest = event.detail; render(); });
  window.addEventListener("weatherhannun:stitch-ready", render);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
})();
