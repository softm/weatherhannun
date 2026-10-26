"use strict";
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WeatherHannunDailyDelta = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function finite(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function unavailable(reason) {
    return { status: "unavailable", reason: reason };
  }

  function dateParts(value) {
    if (typeof value !== "string") return null;
    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;
    return {
      date: match[1] + "-" + match[2] + "-" + match[3],
      clock: match[4] + ":" + match[5],
      dayNumber: Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000
    };
  }

  function validateObservation(value) {
    if (!value || value.sourceKind !== "observation") return null;
    var time = dateParts(value.observedAt);
    if (!time || typeof value.stationId !== "string" || !value.stationId) return null;
    if (typeof value.locationKey !== "string" || !value.locationKey) return null;
    return {
      sourceKind: "observation",
      providerId: typeof value.providerId === "string" ? value.providerId : "",
      providerName: typeof value.providerName === "string" ? value.providerName : "관측자료",
      stationId: value.stationId,
      stationName: typeof value.stationName === "string" ? value.stationName : value.stationId,
      locationKey: value.locationKey,
      observedAt: value.observedAt,
      time: time,
      temperature: finite(value.temperature) ? value.temperature : null,
      precipitation: finite(value.precipitation) ? value.precipitation : null
    };
  }

  function compare(input) {
    var current = validateObservation(input && input.current);
    var previous = validateObservation(input && input.previous);
    if (!current || !previous) return unavailable("missing_equivalent_observations");
    if (current.locationKey !== previous.locationKey) return unavailable("location_mismatch");
    if (current.stationId !== previous.stationId) return unavailable("station_mismatch");
    if (current.providerId !== previous.providerId) return unavailable("provider_mismatch");
    if (current.time.clock !== previous.time.clock || current.time.dayNumber - previous.time.dayNumber !== 1) {
      return unavailable("time_mismatch");
    }
    if (current.temperature === null && current.precipitation === null) return unavailable("missing_metrics");
    if (previous.temperature === null && previous.precipitation === null) return unavailable("missing_metrics");
    return {
      status: "ready",
      observedAt: current.observedAt,
      previousObservedAt: previous.observedAt,
      providerName: current.providerName,
      stationId: current.stationId,
      stationName: current.stationName,
      temperatureDelta: current.temperature !== null && previous.temperature !== null
        ? current.temperature - previous.temperature : null,
      precipitationDelta: current.precipitation !== null && previous.precipitation !== null
        ? current.precipitation - previous.precipitation : null,
      current: current,
      previous: previous
    };
  }

  return { compare: compare, validateObservation: validateObservation };
});
