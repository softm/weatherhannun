"use strict";
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WeatherHannunLocationCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

  function finite(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function normalizePlace(place) {
    if (!place || typeof place.name !== "string") return null;
    var latitude = Number(place.lat);
    var longitude = Number(place.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return {
      id: typeof place.id === "string" ? place.id.slice(0, 96) : "",
      name: place.name.trim().slice(0, 75) || "선택 지역",
      lat: latitude,
      lon: longitude,
      regionCenter: place.regionCenter === true,
      approximate: place.approximate === true
    };
  }

  function placeKey(place) {
    var normalized = normalizePlace(place);
    return normalized ? normalized.lat.toFixed(4) + "," + normalized.lon.toFixed(4) : "";
  }

  function samePlace(left, right) {
    var a = normalizePlace(left);
    var b = normalizePlace(right);
    return !!a && !!b && Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lon - b.lon) < 0.0001;
  }

  function buildForecastUrl(place) {
    var normalized = normalizePlace(place);
    if (!normalized) return "";
    var url = new URL(FORECAST_ENDPOINT);
    url.searchParams.set("latitude", String(normalized.lat));
    url.searchParams.set("longitude", String(normalized.lon));
    url.searchParams.set("timezone", "Asia/Seoul");
    url.searchParams.set("hourly", "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day");
    url.searchParams.set("forecast_days", "7");
    return url.href;
  }

  function hourlyRows(weather) {
    var hourly = weather && weather.hourly;
    if (!hourly || !Array.isArray(hourly.time)) return [];
    return hourly.time.map(function (time, index) {
      return {
        time: typeof time === "string" ? time : "",
        temp: hourly.temperature_2m && hourly.temperature_2m[index],
        rainProbability: hourly.precipitation_probability && hourly.precipitation_probability[index],
        precipitation: hourly.precipitation && hourly.precipitation[index],
        weatherCode: hourly.weather_code && hourly.weather_code[index],
        wind: hourly.wind_speed_10m && hourly.wind_speed_10m[index],
        gust: hourly.wind_gusts_10m && hourly.wind_gusts_10m[index],
        isDay: hourly.is_day && hourly.is_day[index]
      };
    }).filter(function (row) { return row.time; });
  }

  function rowAt(weather, time) {
    return hourlyRows(weather).find(function (row) { return row.time === time; }) || null;
  }

  function commonTimes(originWeather, destinationWeather) {
    var destinationTimes = new Set(hourlyRows(destinationWeather).map(function (row) { return row.time; }));
    var currentHour = originWeather && originWeather.current && originWeather.current.time
      ? originWeather.current.time.slice(0, 13)
      : "";
    return hourlyRows(originWeather).map(function (row) { return row.time; }).filter(function (time) {
      return destinationTimes.has(time) && (!currentHour || time.slice(0, 13) >= currentHour);
    });
  }

  function rainSignal(row) {
    if (!row) return { known: false, triggered: false, probability: null, precipitation: null };
    var probability = finite(row.rainProbability) ? row.rainProbability : null;
    var precipitation = finite(row.precipitation) ? row.precipitation : null;
    return {
      known: probability !== null || precipitation !== null,
      triggered: (probability !== null && probability >= 50) || (precipitation !== null && precipitation >= 0.3),
      probability: probability,
      precipitation: precipitation
    };
  }

  function difference(destination, origin) {
    return finite(destination) && finite(origin) ? destination - origin : null;
  }

  function compare(originPlace, originWeather, destinationPlace, destinationWeather, time) {
    var origin = normalizePlace(originPlace);
    var destination = normalizePlace(destinationPlace);
    if (!origin || !destination) return { status: "unavailable", reason: "invalid_location" };
    if (samePlace(origin, destination)) return { status: "unavailable", reason: "same_location" };
    if (typeof time !== "string" || !time) return { status: "unavailable", reason: "missing_time" };
    var originRow = rowAt(originWeather, time);
    var destinationRow = rowAt(destinationWeather, time);
    if (!originRow || !destinationRow) return { status: "unavailable", reason: "time_not_shared" };
    return {
      status: "ready",
      time: time,
      sourceKind: "forecast",
      sourceLabel: "Open-Meteo 모델 예보",
      origin: { place: origin, row: originRow, rain: rainSignal(originRow) },
      destination: { place: destination, row: destinationRow, rain: rainSignal(destinationRow) },
      delta: {
        temperature: difference(destinationRow.temp, originRow.temp),
        rainProbability: difference(destinationRow.rainProbability, originRow.rainProbability),
        precipitation: difference(destinationRow.precipitation, originRow.precipitation),
        wind: difference(destinationRow.wind, originRow.wind),
        gust: difference(destinationRow.gust, originRow.gust)
      },
      officialAlerts: {
        status: "unavailable",
        reason: "공식 특보 API 이용권·서비스 키가 연결되지 않아 지역별 특보를 임의로 비교하지 않습니다."
      }
    };
  }

  return {
    FORECAST_ENDPOINT: FORECAST_ENDPOINT,
    normalizePlace: normalizePlace,
    placeKey: placeKey,
    samePlace: samePlace,
    buildForecastUrl: buildForecastUrl,
    hourlyRows: hourlyRows,
    rowAt: rowAt,
    commonTimes: commonTimes,
    rainSignal: rainSignal,
    compare: compare
  };
});
