/* Shared single-purpose home surface for Stitch dashboard and legacy fallback.
 * It stays in the weather web source; Android WebView shows it automatically.
 */
(function () {
  'use strict';
  var latest = null;
  var card = null;
  var bits = {};
  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function goHourly() {
    var button = document.querySelector('.desktop-nav [data-view="hourly"]') || document.querySelector('.mobile-nav [data-view="hourly"]');
    if (button) button.click();
  }
  function ensureCard() {
    if (card) return card;
    card = node('article','rain-decision-card rain-decision-card--unknown');
    card.setAttribute('aria-label','앞으로 12시간 비·우산 판단');
    var symbol = node('span','rain-decision-icon','☂');
    symbol.setAttribute('aria-hidden','true');
    var copy = node('div','rain-decision-copy');
    var label = node('p','rain-decision-label','비·우산 판단 · 앞으로 12시간');
    bits.title = node('strong','rain-decision-title','강수 모델 예보 연결 중');
    bits.detail = node('p','rain-decision-detail','예보 수치를 확인하고 있습니다.');
    bits.caution = node('small','rain-decision-caution','시간 단위 모델 예보 · 실제 관측 아님');
    copy.append(label,bits.title,bits.detail,bits.caution);
    var link = node('button','rain-decision-link','시간별 확인');
    link.type='button';
    link.setAttribute('aria-label','48시간 강수 예보 상세 확인');
    link.addEventListener('click',goHourly);
    card.append(symbol,copy,link);
    return card;
  }
  function mount() {
    var hero = document.querySelector('#stitch-live-dashboard > div > section:first-of-type') || document.querySelector('#view-today .today-layout > .hero-weather');
    if (!hero || !hero.parentNode) return;
    var element = ensureCard();
    if (hero.nextElementSibling !== element) {
      hero.insertAdjacentElement('afterend',element);
      if (latest) render(latest);
    }
  }
  function render(data) {
    if (!card || !data || !window.WeatherHannunRainDecision) return;
    var answer = window.WeatherHannunRainDecision.summarise(data.weather);
    var age = data.at ? Date.now() - Date.parse(data.at) : NaN;
    var stale = data.status === 'cached-error' || Number.isFinite(age) && age > 180 * 60000;
    card.className = 'rain-decision-card rain-decision-card--' + answer.state;
    bits.title.textContent = answer.title;
    bits.detail.textContent = answer.detail;
    bits.caution.textContent = (stale ? '오래된 저장 예보 · 새로고침 필요. ' : '') + (answer.caution || '시간 단위 모델 예보 · 실제 관측과 다를 수 있습니다.');
  }
  function init() {
    var host = document.getElementById('view-today');
    if (!host) return;
    mount();
    // Stitch replaces legacy homepage asynchronously; re-home the card without duplication.
    new MutationObserver(mount).observe(host,{childList:true,subtree:true});
  }
  window.addEventListener('weatherhannun:data',function (event) { latest = event.detail; mount(); render(latest); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
