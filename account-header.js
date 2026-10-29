/* Weather uses the same avatar-triggered account menu as the other services.
 * The shared component owns authentication, accessibility and menu positioning.
 * Do not proxy its buttons or hide its shadow host. */
(function () {
  'use strict';
  var selector = 'softm-site-account[data-site="weatherhannun"]';
  function alignAccount() {
    var host = document.querySelector(selector);
    if (!host || host.dataset.accountUi !== 'icon-menu-v2') return;
    var slot = document.getElementById('siteAccountSlot');
    if (slot) slot.classList.remove('topbar-actions');
    host.classList.add('weather-account-host');
    host.style.setProperty('display', 'inline-flex');
    host.style.setProperty('margin', '0');
    host.style.setProperty('flex', '0 0 auto');
    // Placement and all subscriptions are owned by mountSiteAccount. Never
    // append the host from here: competing placement observers cause loops.
  }
  window.addEventListener('softm:account-ready', function (event) {
    if (event.detail && event.detail.siteId === 'weatherhannun') alignAccount();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', alignAccount, {once:true});
  } else alignAccount();
})();
