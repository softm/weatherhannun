"use strict";
/* Shared WMO weather visuals.
 * Every forecast surface uses this module so a code has one Korean label,
 * one day/night treatment and one theme-aware inline SVG illustration.
 */
(function (global) {
  function finiteCode(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }

  function intensity(code, light, moderate, heavy) {
    if (code === light) return "light";
    if (code === heavy) return "heavy";
    return code === moderate ? "moderate" : "moderate";
  }

  function describe(value, isDay) {
    if (!finiteCode(value)) return { code: null, key: "unknown", family: "unknown", intensity: "moderate", isDay: Number(isDay) !== 0, name: "날씨 정보 없음" };
    var code = Number(value), day = Number(isDay) !== 0, suffix = day ? "day" : "night";
    if (code === 0) return { code: code, key: "clear-" + suffix, family: "clear", intensity: "moderate", isDay: day, name: "맑음" };
    if (code === 1) return { code: code, key: "mostly-clear-" + suffix, family: "mostly-clear", intensity: "moderate", isDay: day, name: "대체로 맑음" };
    if (code === 2) return { code: code, key: "partly-cloudy-" + suffix, family: "partly-cloudy", intensity: "moderate", isDay: day, name: "구름 조금" };
    if (code === 3) return { code: code, key: "overcast", family: "overcast", intensity: "moderate", isDay: day, name: "흐림" };
    if (code === 45) return { code: code, key: "fog", family: "fog", intensity: "moderate", isDay: day, name: "안개" };
    if (code === 48) return { code: code, key: "rime-fog", family: "rime-fog", intensity: "moderate", isDay: day, name: "서리 안개" };
    if (code >= 51 && code <= 55) {
      var drizzleLevel = intensity(code, 51, 53, 55);
      return { code: code, key: drizzleLevel + "-drizzle", family: "drizzle", intensity: drizzleLevel, isDay: day, name: drizzleLevel === "light" ? "약한 이슬비" : drizzleLevel === "heavy" ? "강한 이슬비" : "이슬비" };
    }
    if (code === 56 || code === 57) return { code: code, key: code === 57 ? "heavy-freezing-drizzle" : "freezing-drizzle", family: "freezing-drizzle", intensity: code === 57 ? "heavy" : "light", isDay: day, name: code === 57 ? "강한 어는 이슬비" : "약한 어는 이슬비" };
    if (code >= 61 && code <= 65) {
      var rainLevel = intensity(code, 61, 63, 65);
      return { code: code, key: rainLevel + "-rain", family: "rain", intensity: rainLevel, isDay: day, name: rainLevel === "light" ? "약한 비" : rainLevel === "heavy" ? "강한 비" : "비" };
    }
    if (code === 66 || code === 67) return { code: code, key: code === 67 ? "heavy-freezing-rain" : "freezing-rain", family: "freezing-rain", intensity: code === 67 ? "heavy" : "light", isDay: day, name: code === 67 ? "강한 어는 비" : "약한 어는 비" };
    if (code >= 71 && code <= 75) {
      var snowLevel = intensity(code, 71, 73, 75);
      return { code: code, key: snowLevel + "-snow", family: "snow", intensity: snowLevel, isDay: day, name: snowLevel === "light" ? "약한 눈" : snowLevel === "heavy" ? "강한 눈" : "눈" };
    }
    if (code === 77) return { code: code, key: "snow-grains", family: "snow-grains", intensity: "moderate", isDay: day, name: "싸락눈" };
    if (code >= 80 && code <= 82) {
      var showerLevel = intensity(code, 80, 81, 82);
      return { code: code, key: showerLevel + "-showers-" + suffix, family: "showers", intensity: showerLevel, isDay: day, name: showerLevel === "light" ? "약한 소나기" : showerLevel === "heavy" ? "강한 소나기" : "소나기" };
    }
    if (code === 85 || code === 86) return { code: code, key: (code === 86 ? "heavy-" : "") + "snow-showers-" + suffix, family: "snow-showers", intensity: code === 86 ? "heavy" : "light", isDay: day, name: code === 86 ? "강한 눈 소나기" : "약한 눈 소나기" };
    if (code === 95) return { code: code, key: "thunderstorm", family: "thunderstorm", intensity: "moderate", isDay: day, name: "뇌우" };
    if (code === 96 || code === 99) return { code: code, key: code === 99 ? "heavy-thunder-hail" : "thunder-hail", family: "thunder-hail", intensity: code === 99 ? "heavy" : "moderate", isDay: day, name: code === 99 ? "강한 우박 동반 뇌우" : "우박 동반 뇌우" };
    return { code: code, key: "unknown", family: "unknown", intensity: "moderate", isDay: day, name: "날씨 정보 없음" };
  }

  function sun(transform) {
    return '<g class="wi-sun" transform="' + (transform || "") + '"><path class="wi-sun-rays" d="M32 4v7M32 53v7M4 32h7M53 32h7M12.2 12.2l5 5M46.8 46.8l5 5M12.2 51.8l5-5M46.8 17.2l5-5"/><circle class="wi-sun-core" cx="32" cy="32" r="13"/><circle class="wi-sun-highlight" cx="27.5" cy="27" r="4"/></g>';
  }

  function moon(transform) {
    return '<g class="wi-moon" transform="' + (transform || "") + '"><path class="wi-moon-core" d="M42 7.5C28.7 9.2 19 20.4 19 33.8c0 12.2 8.8 22.3 20.5 24.2C34.8 52.5 32 45.2 32 37.2 32 24.8 38.4 13.7 48 7.7c-2-.3-4-.4-6-.2Z"/><path class="wi-moon-highlight" d="M24.8 25.4c2.2-5.1 6.2-9.3 11.2-11.8-2.8 3.9-4.9 8.5-5.8 13.4-1.7-.2-3.6-.8-5.4-1.6Z"/><path class="wi-stars" d="m49 17 1.3 2.7L53 21l-2.7 1.3L49 25l-1.3-2.7L45 21l2.7-1.3L49 17Zm3 16 .9 1.9 1.9.9-1.9.9L52 39l-.9-2.3-1.9-.9 1.9-.9L52 33Z"/></g>';
  }

  function skyDisc(day) {
    return day ? sun("translate(-7 -8) scale(.78)") : moon("translate(-6 -7) scale(.78)");
  }

  function cloud(kind, transform) {
    return '<g class="wi-cloud wi-cloud--' + (kind || "soft") + '" transform="' + (transform || "") + '"><path class="wi-cloud-shadow" d="M15 44h32.5C53.7 44 59 39 59 32.8c0-5.7-4.4-10.4-10-11.1C46.5 15.2 40.2 11 33 11c-8.1 0-14.8 5.6-16.4 13.2C10.5 25 6 29.6 6 35.2 6 40.1 10 44 15 44Z" transform="translate(0 2)"/><path class="wi-cloud-base" d="M15 42h32.5C53.7 42 59 37 59 30.8c0-5.7-4.4-10.4-10-11.1C46.5 13.2 40.2 9 33 9c-8.1 0-14.8 5.6-16.4 13.2C10.5 23 6 27.6 6 33.2 6 38.1 10 42 15 42Z"/><path class="wi-cloud-highlight" d="M18 25.8c2.1-6.8 8-11.5 15.2-11.5 5.4 0 10 2.5 12.7 6.5-5.1-2.2-10.9-2.3-16.1-.4-3.4 1.2-6.1 3.1-8.3 5.7l-3.5-.3Z"/></g>';
  }

  function rain(level, frozen) {
    var paths = level === "light" ? "M23 45l-3 7M39 45l-3 7" : level === "heavy" ? "M16 44l-4 10M27 44l-4 12M39 44l-4 12M50 44l-4 10" : "M20 44l-4 10M33 44l-4 11M46 44l-4 10";
    return '<path class="wi-rain wi-rain--' + level + '" d="' + paths + '"/>' + (frozen ? '<g class="wi-ice" transform="translate(41 47) scale(.5)"><path d="M0-9V9M-8-4.5 8 4.5M-8 4.5 8-4.5"/><circle r="2.5"/></g>' : "");
  }

  function drizzle(level, frozen) {
    var extra = level === "heavy" ? '<circle cx="45" cy="51" r="2.2"/>' : "";
    return '<g class="wi-drizzle"><circle cx="22" cy="49" r="2.2"/><circle cx="34" cy="55" r="2.2"/>' + extra + '</g>' + (frozen ? '<g class="wi-ice" transform="translate(45 51) scale(.45)"><path d="M0-9V9M-8-4.5 8 4.5M-8 4.5 8-4.5"/><circle r="2.5"/></g>' : "");
  }

  function snow(level, grains) {
    if (grains) return '<g class="wi-snow-grains"><circle cx="20" cy="49" r="2.4"/><circle cx="32" cy="55" r="2.4"/><circle cx="44" cy="49" r="2.4"/></g>';
    var marks = level === "light" ? [[23,51],[41,51]] : level === "heavy" ? [[17,49],[29,55],[41,49],[50,57]] : [[20,49],[32,56],[45,49]];
    return marks.map(function (point) {
      return '<g class="wi-snow" transform="translate(' + point[0] + " " + point[1] + ') scale(.42)"><path d="M0-9V9M-8-4.5 8 4.5M-8 4.5 8-4.5"/><circle r="2.4"/></g>';
    }).join("");
  }

  function fog(rime) {
    return '<g class="wi-fog-lines"><path d="M9 43h42M15 50h40M8 57h35"/></g>' + (rime ? '<g class="wi-ice" transform="translate(49 54) scale(.43)"><path d="M0-9V9M-8-4.5 8 4.5M-8 4.5 8-4.5"/><circle r="2.5"/></g>' : "");
  }

  function lightning() {
    return '<path class="wi-lightning" d="m34 37-9 13h7l-4 12 14-17h-7l5-8Z"/>';
  }

  function hail(level) {
    return '<g class="wi-hail"><circle cx="18" cy="52" r="3"/><circle cx="47" cy="52" r="3"/>' + (level === "heavy" ? '<circle cx="54" cy="59" r="2.5"/><circle cx="12" cy="59" r="2.5"/>' : "") + '</g>';
  }

  function art(state) {
    if (state.family === "clear") return state.isDay ? sun() : moon();
    if (state.family === "mostly-clear") return skyDisc(state.isDay) + cloud("soft", "translate(10 17) scale(.72)");
    if (state.family === "partly-cloudy") return skyDisc(state.isDay) + cloud("soft", "translate(2 8) scale(.92)");
    if (state.family === "overcast") return cloud("back", "translate(11 -1) scale(.75)") + cloud("overcast", "translate(-1 9) scale(.96)");
    if (state.family === "fog" || state.family === "rime-fog") return cloud("fog", "translate(3 -7) scale(.88)") + fog(state.family === "rime-fog");
    if (state.family === "drizzle") return cloud("wet", "translate(1 -4) scale(.96)") + drizzle(state.intensity, false);
    if (state.family === "freezing-drizzle") return cloud("cold", "translate(1 -4) scale(.96)") + drizzle(state.intensity, true);
    if (state.family === "rain") return cloud(state.intensity === "heavy" ? "storm" : "wet", "translate(1 -5) scale(.96)") + rain(state.intensity, false);
    if (state.family === "freezing-rain") return cloud("cold", "translate(1 -5) scale(.96)") + rain(state.intensity, true);
    if (state.family === "snow") return cloud(state.intensity === "heavy" ? "cold-heavy" : "cold", "translate(1 -5) scale(.96)") + snow(state.intensity, false);
    if (state.family === "snow-grains") return cloud("cold", "translate(1 -5) scale(.96)") + snow(state.intensity, true);
    if (state.family === "showers") return skyDisc(state.isDay) + cloud(state.intensity === "heavy" ? "storm" : "wet", "translate(2 2) scale(.93)") + rain(state.intensity, false);
    if (state.family === "snow-showers") return skyDisc(state.isDay) + cloud("cold", "translate(2 2) scale(.93)") + snow(state.intensity, false);
    if (state.family === "thunderstorm") return cloud("storm", "translate(1 -4) scale(.97)") + lightning();
    if (state.family === "thunder-hail") return cloud("storm", "translate(1 -4) scale(.97)") + lightning() + hail(state.intensity);
    return cloud("unknown", "translate(2 3) scale(.92)") + '<g class="wi-unknown-mark"><circle cx="46" cy="16" r="9"/><path d="M43 13.3c.8-2.5 5.9-2.1 5.9 1.2 0 2.2-2.9 2.5-2.9 4.5M46 22h.01"/></g>';
  }

  function safeClass(value) {
    return String(value || "").replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  }

  function markup(code, isDay, extraClass) {
    var state = describe(code, isDay);
    var classes = ["weather-glyph", "weather-glyph--" + state.family, "weather-glyph--" + state.intensity, state.isDay ? "weather-glyph--day" : "weather-glyph--night"];
    var extra = safeClass(extraClass); if (extra) classes.push(extra);
    return '<span class="' + classes.join(" ") + '" data-weather-code="' + (state.code === null ? "unknown" : state.code) + '" data-weather-state="' + state.key + '" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" focusable="false">' + art(state) + '</svg></span>';
  }

  function render(node, code, isDay, extraClass) {
    if (!node) return describe(code, isDay);
    var state = describe(code, isDay);
    node.innerHTML = markup(code, isDay, extraClass);
    node.dataset.weatherState = state.key;
    node.dataset.weatherCode = state.code === null ? "unknown" : String(state.code);
    return state;
  }

  global.WeatherIcons = Object.freeze({ describe: describe, markup: markup, render: render });
})(window);
