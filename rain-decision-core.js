/* 날씨한눈: 12-hour rain decision, based on hourly MODEL forecasts (not radar/observation).
 * Pure and deterministic. Never invent minute-level rain timing or official warnings.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WeatherHannunRainDecision = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var finite = value => typeof value === 'number' && Number.isFinite(value);
  var validTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
  function timeLabel(time, currentDate) {
    var date = time.slice(0, 10);
    var hour = Number(time.slice(11, 13));
    var day = date === currentDate ? '오늘' : Number(date.slice(5, 7)) + '월 ' + Number(date.slice(8, 10)) + '일';
    return day + ' ' + hour + '시경';
  }
  function summarise(weather, maxHours) {
    var h = weather && weather.hourly;
    var current = weather && weather.current && weather.current.time;
    if (!h || !Array.isArray(h.time) || !validTime(current)) return {state:'unknown',title:'강수 예보를 확인할 수 없습니다',detail:'시간별 예보 연결 상태를 확인해 주세요.',hours:0};
    var start = h.time.findIndex(t => validTime(t) && t.slice(0, 13) >= current.slice(0, 13));
    if (start < 0) return {state:'unknown',title:'가까운 시간의 강수 예보가 없습니다',detail:'시간별 예보를 새로고침해 주세요.',hours:0};
    var horizon = Number.isInteger(maxHours) && maxHours > 0 ? Math.min(24, maxHours) : 12;
    var rows = h.time.slice(start, start + horizon).map((time, i) => {
      var k = start + i;
      return {time:time,prob:h.precipitation_probability && h.precipitation_probability[k],mm:h.precipitation && h.precipitation[k]};
    }).filter(row => validTime(row.time));
    if (!rows.length || !rows.some(row => finite(row.prob) || finite(row.mm))) return {state:'unknown',title:'강수 수치가 제공되지 않습니다',detail:'예보값이 없어 비가 없다고 판단할 수 없습니다.',hours:rows.length};
    var wet = row => finite(row.prob) && row.prob >= 50 || finite(row.mm) && row.mm >= 0.3;
    var first = rows.findIndex(wet);
    var measuredProb = rows.filter(r => finite(r.prob)).map(r => r.prob);
    var maxProb = measuredProb.length ? Math.max(...measuredProb) : null;
    if (first < 0) {
      var complete = rows.length === horizon && rows.every(row => finite(row.prob) && finite(row.mm));
      if (!complete) return {
        state:'unknown',title:'강수 자료가 일부 부족합니다',
        detail:'향후 ' + horizon + '시간 강수확률·강수량이 완전하지 않아 비가 없다고 판단하지 않습니다.',
        caution:'시간별 예보를 새로고침해 주세요.',hours:rows.length,maxProbability:maxProb
      };
      return {
        state:'low',title:'가까운 시간 뚜렷한 강수 신호 낮음',
        detail:'향후 ' + rows.length + '시간 모델 예보 · 최대 강수확률 ' + Math.round(maxProb) + '%',
        caution:'국지성·돌발 강수 가능성은 배제할 수 없습니다.',hours:rows.length,maxProbability:maxProb
      };
    }
    var last = first;
    while (last + 1 < rows.length && wet(rows[last + 1])) last++;
    var run = rows.slice(first, last + 1);
    var runProbs = run.filter(r => finite(r.prob)).map(r => r.prob);
    var runMax = runProbs.length ? Math.max(...runProbs) : null;
    var completeMm = run.every(r => finite(r.mm));
    var runMm = completeMm ? run.reduce((sum, r) => sum + r.mm, 0) : null;
    var now = first === 0;
    return {
      state:now ? 'now' : 'later',
      title:now ? '현재 시간대 비 가능성 높음' : timeLabel(rows[first].time, current.slice(0, 10)) + '부터 비 가능성',
      detail:(now ? '현재 시간대부터' : timeLabel(rows[first].time, current.slice(0, 10)) + '부터') + ' · ' + run.length + '시간 연속 예보' +
        (runMax !== null ? ' · 최대 ' + Math.round(runMax) + '%' : '') + (completeMm ? ' · 해당 구간 예상 ' + runMm.toFixed(1) + 'mm' : ''),
      caution:'시간 단위 모델 예보이며 실제 비 시작·종료 시각이나 관측 사실이 아닙니다.',
      hours:rows.length, startTime:rows[first].time, consecutiveHours:run.length,maxProbability:runMax
    };
  }
  return {summarise};
});
