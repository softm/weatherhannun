/* Weather Hannun host integration for the shared account web component. */
(function () {
  "use strict";

  var HOST_SELECTOR = 'softm-site-account[data-site="weatherhannun"]';
  var installed = new WeakSet();

  function install(host, account) {
    if (!host || !host.shadowRoot) return;
    var slot = document.getElementById("siteAccountSlot");
    if (slot) {
      // The shared loader needs this hook only while mounting. Its generic
      // full-width action-row style must not remain on the weather header slot.
      slot.classList.remove("topbar-actions");
    }
    host.style.setProperty("position", "relative", "important");
    host.style.setProperty("inset", "auto", "important");
    host.style.setProperty("display", "inline-flex", "important");
    host.style.setProperty("width", "auto", "important");
    host.style.setProperty("height", "auto", "important");
    host.style.setProperty("margin", "0", "important");
    host.style.setProperty("transform", "none", "important");
    host.style.setProperty("flex", "0 0 auto", "important");
    host.style.setProperty("display", "none", "important");
    if (installed.has(host)) return;
    installed.add(host);
    host.classList.add("weather-account-host");

    var root = host.shadowRoot;
    var mainBar = root.querySelector(".bar");
    var status = root.querySelector(".status");
    if (!mainBar || !status) return;

    var headerButton = document.createElement("button");
    headerButton.type = "button";
    headerButton.id = "weatherAccountButton";
    headerButton.className = "icon-button weather-account-button";
    headerButton.setAttribute("aria-label", "계정 메뉴 열기");
    headerButton.setAttribute("aria-expanded", "false");
    headerButton.textContent = "👤";
    var headerMenu = document.createElement("div");
    headerMenu.id = "weatherAccountMenu";
    headerMenu.hidden = true;
    headerMenu.innerHTML = '<button type="button" data-account-action="login">로그인</button><button type="button" data-account-action="signup">회원가입</button><button type="button" data-account-action="vault">내 보관소</button><button type="button" data-account-action="logout" hidden>로그아웃</button>';
    slot.append(headerButton, headerMenu);

    var pageStyle = document.createElement("style");
    pageStyle.textContent = [
      "#siteAccountSlot{position:relative}",
      "#weatherAccountButton{font-size:18px;display:grid;place-items:center;padding:0}",
      "#weatherAccountMenu{position:absolute;z-index:950;right:0;top:49px;min-width:190px;padding:9px;display:grid;gap:5px;background:var(--st-surface,#fff);border:1px solid var(--st-line,#d9e6f2);border-radius:13px;box-shadow:0 14px 38px rgba(16,42,75,.2)}",
      "#weatherAccountMenu[hidden]{display:none}",
      "#weatherAccountMenu button{border:0;background:transparent;color:var(--st-fg,#0f1b2d);border-radius:9px;padding:10px 12px;text-align:left;font-weight:700}",
      "#weatherAccountMenu button:hover{background:var(--st-soft,#edf5fc);color:var(--st-accent,#1765d3)}",
      "#weatherAccountToast{position:fixed;z-index:2800;left:50%;bottom:28px;transform:translateX(-50%);max-width:calc(100vw - 28px);padding:10px 16px;border-radius:999px;background:#102946;color:#fff;font-size:13px;font-weight:700;box-shadow:0 12px 38px rgba(7,25,48,.24)}",
      "@media(max-width:460px){#weatherAccountMenu{position:fixed;top:66px;right:12px;left:12px}}"
    ].join("");
    document.head.append(pageStyle);

    function setHeaderMenu(open) {
      headerMenu.hidden = !open;
      headerButton.setAttribute("aria-expanded", String(open));
    }
    headerButton.addEventListener("click", function () { setHeaderMenu(headerMenu.hidden); });
    headerMenu.addEventListener("click", function (event) {
      var action = event.target && event.target.dataset.accountAction;
      if (!action) return;
      var target = action === "vault" ? root.querySelector("#vault") : root.querySelector("#" + action);
      if (!target && action === "logout") {
        var profile = root.querySelector("#profile");
        if (profile) profile.click();
        target = root.querySelector("#logout");
      }
      if (target) target.click();
      setHeaderMenu(false);
    });
    document.addEventListener("pointerdown", function (event) {
      if (!slot.contains(event.target)) setHeaderMenu(false);
    });

    var style = document.createElement("style");
    style.dataset.weatherAccount = "true";
    style.textContent = [
      ":host{display:none!important}",
      "button,a{font-family:inherit!important;font-weight:700!important;white-space:nowrap}",
      "button{min-height:38px!important;border:1px solid var(--st-line,#d9e6f2)!important;background:var(--st-surface,#fff)!important;color:var(--st-fg,#0f1b2d)!important;border-radius:10px!important;box-shadow:none!important;padding:7px 10px!important}",
      "button:hover,a:hover{border-color:var(--st-accent,#1765d3)!important;color:var(--st-accent,#1765d3)!important}",
      "a{display:inline-flex;align-items:center;min-height:38px;padding:7px 9px;border:1px solid transparent;border-radius:10px;color:var(--st-accent,#1765d3)!important;text-decoration:none!important}",
      ".bar{flex-wrap:nowrap!important;gap:5px!important}",
      "#menu{position:absolute;z-index:900;top:46px;right:0;min-width:210px;padding:10px;display:grid;gap:5px;background:var(--st-surface,#fff);border:1px solid var(--st-line,#d9e6f2);border-radius:12px;box-shadow:0 14px 38px rgba(16,42,75,.18)}",
      "#menu a,#menu button{width:100%;justify-content:flex-start;text-align:left}",
      ".status{position:fixed;z-index:2800;left:50%;bottom:calc(28px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:max-content;max-width:calc(100vw - 28px);margin:0!important;padding:10px 16px;border-radius:999px;background:#102946;color:#fff;font-size:13px!important;font-weight:700;box-shadow:0 12px 38px rgba(7,25,48,.24);text-align:center}",
      ".status:empty{display:none!important}",
      "#weatherAccountToggle{display:grid;width:40px;height:40px;min-height:40px!important;padding:0!important;place-items:center;font-size:0!important}",
      "#weatherAccountToggle::before{content:'👤';font-size:19px;line-height:1}",
      ".bar:first-of-type{display:none;position:absolute;z-index:900;top:47px;right:0;min-width:220px;padding:10px;flex-wrap:wrap!important;background:var(--st-surface,#fff);border:1px solid var(--st-line,#d9e6f2);border-radius:12px;box-shadow:0 14px 38px rgba(16,42,75,.18)}",
      ":host([data-weather-menu-open='true']) .bar:first-of-type{display:flex}",
      ".bar:first-of-type button,.bar:first-of-type a{flex:1 1 auto;justify-content:center}",
      "#menu{top:calc(47px + 58px)}",
      "@media(max-width:460px){.bar:first-of-type{position:fixed;top:66px;right:12px;left:12px;min-width:0}#menu{position:fixed;top:130px;right:12px;left:12px;min-width:0}}",
      "@media(prefers-reduced-motion:reduce){*{transition:none!important}}"
    ].join("");
    root.append(style);

    var toggle = document.createElement("button");
    toggle.id = "weatherAccountToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "계정 메뉴 열기");
    toggle.setAttribute("aria-expanded", "false");
    toggle.title = "계정";
    root.insertBefore(toggle, mainBar);

    function closeMenu() {
      host.dataset.weatherMenuOpen = "false";
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var open = host.dataset.weatherMenuOpen !== "true";
      host.dataset.weatherMenuOpen = String(open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    mainBar.addEventListener("click", function (event) {
      if (event.target && event.target.id !== "profile") closeMenu();
    });
    document.addEventListener("pointerdown", function (event) {
      if (!host.contains(event.target)) closeMenu();
    });

    var statusTimer = 0;
    function normalizeStatus() {
      if (status.textContent.trim() === "로그아웃했습니다.") {
        status.textContent = "로그아웃되었습니다.";
      }
      var message = status.textContent.trim();
      var toast = document.getElementById("weatherAccountToast");
      if (message) {
        if (!toast) {
          toast = document.createElement("div");
          toast.id = "weatherAccountToast";
          toast.setAttribute("role", "status");
          document.body.append(toast);
        }
        toast.textContent = message;
      }
      window.clearTimeout(statusTimer);
      if (message) {
        statusTimer = window.setTimeout(function () {
          status.textContent = "";
          if (toast) toast.remove();
        }, 3500);
      }
    }
    new MutationObserver(normalizeStatus).observe(status, { childList: true, characterData: true, subtree: true });

    if (account && typeof account.subscribe === "function") {
      account.subscribe(function (user) {
        headerButton.setAttribute("aria-label", user ? "내 계정 메뉴 열기" : "로그인 및 회원가입 메뉴 열기");
        headerButton.title = user ? "내 계정" : "로그인";
        headerMenu.querySelector('[data-account-action="login"]').hidden = Boolean(user);
        headerMenu.querySelector('[data-account-action="signup"]').hidden = Boolean(user);
        headerMenu.querySelector('[data-account-action="logout"]').hidden = !user;
        toggle.setAttribute("aria-label", user ? "내 계정 메뉴 열기" : "로그인 및 회원가입 메뉴 열기");
        toggle.title = user ? "내 계정" : "로그인";
        closeMenu();
      });
    }
  }

  function findAndInstall(account) {
    var resolvedAccount = account;
    if (!resolvedAccount && window.SoftmAccounts && typeof window.SoftmAccounts.get === "function") {
      resolvedAccount = window.SoftmAccounts.get("weatherhannun");
    }
    install(document.querySelector(HOST_SELECTOR), resolvedAccount);
  }

  window.addEventListener("softm:account-ready", function (event) {
    if (event.detail && event.detail.siteId === "weatherhannun") findAndInstall(event.detail.account);
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { findAndInstall(); }, { once: true });
  } else {
    findAndInstall();
  }
  new MutationObserver(function () { findAndInstall(); }).observe(document.documentElement, { childList: true, subtree: true });
})();
