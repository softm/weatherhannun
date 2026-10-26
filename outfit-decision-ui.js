/* Home card for WH-H03. The Android WebView receives the same UI from GitHub Pages. */
(function () {
  'use strict';
  var latest = null;
  var card = null;
  var bits = {};

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function goHourly() {
    var button = document.querySelector('.desktop-nav [data-view="hourly"]') || document.querySelector('.mobile-nav [data-view="hourly"]');
    if (button) button.click();
  }

  function decisionBlock(kind, label) {
    var block = node('section', 'outfit-decision-item outfit-decision-item--' + kind);
    var icon = node('span', 'outfit-decision-icon', kind === 'clothing' ? '🧥' : '☂');
    icon.setAttribute('aria-hidden', 'true');
    var heading = node('span', 'outfit-decision-kind', label);
    bits[kind + 'Title'] = node('strong', 'outfit-decision-title', '자료 확인 중');
    bits[kind + 'Detail'] = node('p', 'outfit-decision-detail', '모델 예보를 확인하고 있습니다.');
    block.append(icon, heading, bits[kind + 'Title'], bits[kind + 'Detail']);
    return block;
  }

  function ensureCard() {
    if (card) return card;
    card = node('article', 'outfit-decision-card outfit-decision-card--unknown');
    card.setAttribute('aria-label', '오늘 옷차림과 우산 가이드');
    var head = node('div', 'outfit-decision-head');
    var headCopy = node('div', 'outfit-decision-head-copy');
    var overline = node('span', 'outfit-decision-overline', 'TODAY PREP · RULE BASED');
    var title = node('h2', 'outfit-decision-heading', '오늘 이렇게 준비하세요');
    headCopy.append(overline, title);
    var link = node('button', 'outfit-decision-link', '시간별 근거');
    link.type = 'button';
    link.addEventListener('click', goHourly);
    head.append(headCopy, link);

    var grid = node('div', 'outfit-decision-grid');
    grid.append(decisionBlock('clothing', '옷차림'), decisionBlock('umbrella', '우산'));
    bits.evidence = node('dl', 'outfit-decision-evidence');
    bits.caution = node('p', 'outfit-decision-caution', '모델 예보 기반 규칙 · 개인차 있음');
    card.append(head, grid, bits.evidence, bits.caution);
    return card;
  }

  function mount() {
    var anchor = document.querySelector('.rain-decision-card');
    if (!anchor || !anchor.parentNode) return;
    var element = ensureCard();
    if (anchor.nextElementSibling !== element) {
      anchor.insertAdjacentElement('afterend', element);
      if (latest) render(latest);
    }
  }

  function render(data) {
    if (!card || !data || !window.WeatherHannunOutfitDecision) return;
    var answer = window.WeatherHannunOutfitDecision.evaluate(data.weather);
    var age = data.at ? Date.now() - Date.parse(data.at) : NaN;
    var stale = data.status === 'cached-error' || Number.isFinite(age) && age > 180 * 60000;
    card.className = 'outfit-decision-card outfit-decision-card--' + answer.state;
    bits.clothingTitle.textContent = answer.clothing.title;
    bits.clothingDetail.textContent = answer.clothing.detail;
    bits.umbrellaTitle.textContent = answer.umbrella.title;
    bits.umbrellaDetail.textContent = answer.umbrella.detail;
    bits.evidence.replaceChildren();
    answer.evidence.forEach(function (item) {
      var group = node('div', 'outfit-evidence-item');
      group.append(node('dt', '', item.label), node('dd', '', item.value));
      bits.evidence.appendChild(group);
    });
    bits.caution.textContent = (stale ? '오래된 저장 예보 · 새로고침 필요. ' : '') + answer.caution + ' · 규칙 ' + answer.ruleVersion;
  }

  function init() {
    var host = document.getElementById('view-today');
    if (!host) return;
    mount();
    new MutationObserver(mount).observe(host, {childList: true, subtree: true});
  }

  window.addEventListener('weatherhannun:data', function (event) {
    latest = event.detail;
    mount();
    render(latest);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
