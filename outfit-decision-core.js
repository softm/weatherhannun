/* 날씨한눈 WH-H03: rule-based clothing and umbrella guidance.
 * Input values are model forecasts. Missing values stay missing; they are never replaced with zero.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WeatherHannunOutfitDecision = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RULE_VERSION = 'WH-H03-v1';
  var finite = value => typeof value === 'number' && Number.isFinite(value);
  var validTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);

  function displayNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function maximum(values) {
    var measured = values.filter(finite);
    return measured.length ? Math.max.apply(null, measured) : null;
  }

  function forecastRows(weather, hours) {
    var hourly = weather && weather.hourly;
    var currentTime = weather && weather.current && weather.current.time;
    if (!hourly || !Array.isArray(hourly.time) || !validTime(currentTime)) return [];
    var start = hourly.time.findIndex(time => validTime(time) && time.slice(0, 13) >= currentTime.slice(0, 13));
    if (start < 0) return [];
    return hourly.time.slice(start, start + hours).map(function (time, offset) {
      var index = start + offset;
      return {
        time: time,
        probability: hourly.precipitation_probability && hourly.precipitation_probability[index],
        precipitation: hourly.precipitation && hourly.precipitation[index],
        wind: hourly.wind_speed_10m && hourly.wind_speed_10m[index],
        gust: hourly.wind_gusts_10m && hourly.wind_gusts_10m[index]
      };
    }).filter(row => validTime(row.time));
  }

  function timeLabel(time, currentTime, first) {
    if (first) return '현재 시간대';
    var date = time.slice(0, 10);
    var currentDate = currentTime.slice(0, 10);
    var hour = Number(time.slice(11, 13));
    if (date === currentDate) return '오늘 ' + hour + '시경';
    return Number(date.slice(5, 7)) + '월 ' + Number(date.slice(8, 10)) + '일 ' + hour + '시경';
  }

  function clothingFor(feelsLike, strongWind) {
    if (!finite(feelsLike)) {
      return {
        state: 'unknown',
        title: '옷차림 자료 부족',
        detail: '체감온도 값이 없어 옷차림을 임의로 추천하지 않습니다.'
      };
    }

    var state = 'mild';
    var title = '긴팔 옷';
    if (feelsLike <= -10) {
      state = 'extreme-cold';
      title = '두꺼운 외투·보온 소품';
    } else if (feelsLike <= 0) {
      state = 'cold';
      title = '두꺼운 외투';
    } else if (feelsLike <= 8) {
      state = 'cool';
      title = '재킷이나 코트';
    } else if (feelsLike <= 15) {
      state = 'cool';
      title = '가벼운 겉옷';
    } else if (feelsLike <= 21) {
      title = '긴팔 옷';
    } else if (feelsLike <= 27) {
      state = 'warm';
      title = '얇고 가벼운 옷';
    } else if (feelsLike < 33) {
      state = 'hot';
      title = '통풍이 잘되는 가벼운 옷';
    } else {
      state = 'extreme-hot';
      title = '통풍되는 옷·햇빛 가리개';
    }

    if (strongWind) title += ' + 바람막이';
    var detail = '현재 모델 체감 ' + displayNumber(feelsLike) + '°C 기준';
    if (strongWind) detail += ' · 앞으로 6시간 강한 바람 신호 반영';
    if (state === 'extreme-cold' || state === 'extreme-hot') detail += ' · 장시간 야외 활동 전 최신 상태 재확인';
    return {state: state, title: title, detail: detail};
  }

  function umbrellaFor(weather, rows) {
    var measured = rows.some(row => finite(row.probability) || finite(row.precipitation));
    if (!rows.length || !measured) {
      return {
        state: 'unknown',
        title: '우산 판단 자료 부족',
        detail: '향후 12시간 강수 수치가 없어 필요 여부를 단정하지 않습니다.',
        maxProbability: null,
        maxPrecipitation: null
      };
    }

    var wet = row => finite(row.probability) && row.probability >= 50 || finite(row.precipitation) && row.precipitation >= 0.3;
    var first = rows.findIndex(wet);
    var maxProbability = maximum(rows.map(row => row.probability));
    var maxPrecipitation = maximum(rows.map(row => row.precipitation));
    if (first < 0) {
      var complete = rows.length === 12 && rows.every(row => finite(row.probability) && finite(row.precipitation));
      if (!complete) {
        return {
          state: 'unknown',
          title: '우산 판단 자료 부족',
          detail: '향후 12시간 강수확률·강수량 일부가 없어 필요 여부를 단정하지 않습니다.',
          maxProbability: maxProbability,
          maxPrecipitation: maxPrecipitation
        };
      }
      return {
        state: 'optional',
        title: '우산은 선택',
        detail: '앞으로 ' + rows.length + '시간 뚜렷한 강수 신호 낮음' +
          (maxProbability !== null ? ' · 최대 ' + Math.round(maxProbability) + '%' : ''),
        maxProbability: maxProbability,
        maxPrecipitation: maxPrecipitation
      };
    }

    var currentTime = weather.current.time;
    var when = timeLabel(rows[first].time, currentTime, first === 0);
    return {
      state: 'needed',
      title: '우산 챙기기',
      detail: when + ' 강수 신호' +
        (maxProbability !== null ? ' · 최대 ' + Math.round(maxProbability) + '%' : '') +
        (maxPrecipitation !== null ? ' · 시간당 최대 ' + displayNumber(maxPrecipitation) + 'mm' : ''),
      startTime: rows[first].time,
      maxProbability: maxProbability,
      maxPrecipitation: maxPrecipitation
    };
  }

  function evaluate(weather) {
    var current = weather && weather.current || {};
    var windRows = forecastRows(weather, 6);
    var rainRows = forecastRows(weather, 12);
    var maxWind = maximum([current.wind_speed_10m].concat(windRows.map(row => row.wind)));
    var maxGust = maximum(windRows.map(row => row.gust));
    var strongWind = finite(maxGust) && maxGust >= 35 || finite(maxWind) && maxWind >= 25;
    var clothing = clothingFor(current.apparent_temperature, strongWind);
    var umbrella = umbrellaFor(weather || {}, rainRows);

    var state = clothing.state === 'unknown' && umbrella.state === 'unknown' ? 'unknown' :
      clothing.state === 'unknown' || umbrella.state === 'unknown' ? 'partial' :
      strongWind || umbrella.state === 'needed' || clothing.state === 'extreme-cold' || clothing.state === 'extreme-hot' ? 'action' : 'ready';

    var rainParts = [];
    if (umbrella.maxProbability !== null) rainParts.push('최대 ' + Math.round(umbrella.maxProbability) + '%');
    if (umbrella.maxPrecipitation !== null) rainParts.push('시간당 ' + displayNumber(umbrella.maxPrecipitation) + 'mm');
    var rainEvidence = rainParts.length ? rainParts.join(' · ') : '자료 없음';
    var windParts = [];
    if (maxWind !== null) windParts.push('풍속 ' + displayNumber(maxWind) + 'km/h');
    if (maxGust !== null) windParts.push('돌풍 ' + displayNumber(maxGust) + 'km/h');
    var windEvidence = windParts.length ? windParts.join(' · ') : '자료 없음';

    return {
      ruleVersion: RULE_VERSION,
      state: state,
      clothing: clothing,
      umbrella: umbrella,
      strongWind: strongWind,
      evidence: [
        {label: '현재 모델 체감', value: finite(current.apparent_temperature) ? displayNumber(current.apparent_temperature) + '°C' : '자료 없음'},
        {label: '6시간 최대 바람', value: windEvidence},
        {label: '12시간 강수', value: rainEvidence}
      ],
      caution: '모델 예보를 규칙으로 해석한 참고 안내입니다. 개인차가 있으므로 외출 전 최신 예보와 실제 환경을 확인하세요.'
    };
  }

  return {RULE_VERSION: RULE_VERSION, evaluate: evaluate};
});
