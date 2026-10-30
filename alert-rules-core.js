"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WeatherAlertRules = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const DEFAULTS = Object.freeze({
    version: 2,
    configured: false,
    rain: true,
    rainThreshold: 65,
    dry: true,
    dryThreshold: 80,
    clear: true,
    clearHours: 3,
    frost: true,
    wind: true,
    morning: true,
    morningTime: "07:00",
    evening: true,
    eveningTime: "19:00",
    quiet: true,
    quietStart: "22:00",
    quietEnd: "06:00"
  });
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const boolean = (value, fallback) => typeof value === "boolean" ? value : fallback;
  const number = (value, fallback, low, high) => finite(Number(value)) ? clamp(Math.round(Number(value)), low, high) : fallback;
  const time = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback;

  function defaults() { return { ...DEFAULTS }; }
  function normalizePreferences(saved) {
    const out = defaults();
    if (!saved || typeof saved !== "object") return out;
    const legacy = !Object.prototype.hasOwnProperty.call(saved, "version");
    out.configured = boolean(saved.configured, true);
    out.rain = boolean(saved.rain, out.rain);
    out.rainThreshold = number(saved.rainThreshold, 65, 20, 100);
    out.dry = boolean(saved.dry, out.dry);
    out.dryThreshold = number(saved.dryThreshold, 80, 50, 100);
    out.clear = boolean(saved.clear, out.clear);
    out.clearHours = number(saved.clearHours, 3, 2, 8);
    out.frost = boolean(saved.frost, out.frost);
    out.wind = boolean(saved.wind, out.wind);
    // Legacy users opted into event rules only; do not silently add daily alerts.
    out.morning = legacy ? false : boolean(saved.morning, true);
    out.morningTime = time(saved.morningTime, "07:00");
    out.evening = legacy ? false : boolean(saved.evening, true);
    out.eveningTime = time(saved.eveningTime, "19:00");
    out.quiet = boolean(saved.quiet, true);
    out.quietStart = time(saved.quietStart, "22:00");
    out.quietEnd = time(saved.quietEnd, "06:00");
    return out;
  }
  function isWet(row, threshold = 50) {
    return (finite(row?.rain) && row.rain >= threshold) || (finite(row?.mm) && row.mm >= 0.3);
  }
  function isClear(row) {
    return row?.isDay === 1 && finite(row.code) && row.code >= 0 && row.code <= 2 && finite(row.rain) && row.rain <= 20 && finite(row.mm) && row.mm < 0.1;
  }
  function firstClearRun(rows, hours) {
    let count = 0;
    for (let i = 0; i < rows.length; i += 1) {
      count = isClear(rows[i]) ? count + 1 : 0;
      if (count >= hours) return rows[i - hours + 1];
    }
    return null;
  }
  function pick(rows, rawPreferences) {
    const prefs = normalizePreferences(rawPreferences);
    const alerts = [];
    const rain = rows.slice(0, 12).find(row => (finite(row.rain) && row.rain >= prefs.rainThreshold) || (finite(row.mm) && row.mm >= 1));
    const dryRows = rows.slice(0, 6);
    const dry = dryRows.length >= 3 && dryRows.every(row => finite(row.rain) && row.rain <= 100 - prefs.dryThreshold && finite(row.mm) && row.mm < 0.3);
    const clear = firstClearRun(rows.slice(0, 24), prefs.clearHours);
    const frost = rows.slice(0, 48).find(row => finite(row.temp) && row.temp <= 2);
    const wind = rows.slice(0, 24).find(row => finite(row.gust) && row.gust >= 35);
    if (prefs.rain && rain) alerts.push({ id: "rain", time: rain.time, row: rain });
    if (prefs.dry && dry) alerts.push({ id: "dry", time: dryRows[0].time, row: dryRows[0], maxRain: Math.max(...dryRows.map(row => row.rain)), confidence: prefs.dryThreshold });
    if (prefs.clear && clear) alerts.push({ id: "clear", time: clear.time, row: clear, hours: prefs.clearHours });
    if (prefs.frost && frost) alerts.push({ id: "frost", time: frost.time, row: frost });
    if (prefs.wind && wind) alerts.push({ id: "wind", time: wind.time, row: wind });
    return alerts;
  }
  return { DEFAULTS, defaults, normalizePreferences, isWet, isClear, firstClearRun, pick };
});
