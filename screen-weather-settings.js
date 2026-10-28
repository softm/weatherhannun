/* WH-O01 web settings surface. Native Android owns permission, broadcasts and overlay display. */
(function () {
  'use strict';
  var STORAGE_KEY = 'weatherhannun:screen-weather:v1';
  var defaults = {enabled: true, displaySeconds: 5, cooldownMinutes: 30};
  var nativeState = null;
  var nativeWidgetState = null;
  var latestWeather = null;

  function element(id) { return document.getElementById(id); }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function bridge() {
    var candidate = window.WeatherHannunAndroid;
    return candidate && typeof candidate.saveScreenWeatherConfiguration === 'function' &&
      typeof candidate.screenWeatherState === 'function' ? candidate : null;
  }
  function widgetBridge() {
    var candidate = window.WeatherHannunAndroid;
    return candidate && typeof candidate.updateWidgetSnapshot === 'function' ? candidate : null;
  }
  function allowed(value, choices, fallback) {
    var number = Number(value);
    return choices.includes(number) ? number : fallback;
  }
  function normalize(value) {
    value = value && typeof value === 'object' ? value : {};
    return {
      enabled: value.enabled !== false,
      displaySeconds: allowed(value.displaySeconds, [0, 3, 5, 10], 5),
      cooldownMinutes: allowed(value.cooldownMinutes, [0, 15, 30, 60], 30)
    };
  }
  function readLocal() {
    try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
    catch (_) { return Object.assign({}, defaults); }
  }
  function writeLocal(config) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(config))); } catch (_) {}
  }
  function controlsConfig() {
    return normalize({
      enabled: element('screenWeatherEnabled')?.checked,
      displaySeconds: element('screenWeatherDuration')?.value,
      cooldownMinutes: element('screenWeatherCooldown')?.value
    });
  }
  function applyConfig(config) {
    config = normalize(config);
    if (element('screenWeatherEnabled')) element('screenWeatherEnabled').checked = config.enabled;
    if (element('screenWeatherDuration')) element('screenWeatherDuration').value = String(config.displaySeconds);
    if (element('screenWeatherCooldown')) element('screenWeatherCooldown').value = String(config.cooldownMinutes);
    writeLocal(config);
  }
  function parseNativeState(raw) {
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (_) { return null; }
  }
  function renderState() {
    var available = !!bridge();
    var controls = [element('screenWeatherEnabled'), element('screenWeatherDuration'), element('screenWeatherCooldown'), element('screenWeatherPermission'), element('screenWeatherPreview')].filter(Boolean);
    controls.forEach(function (control) { control.disabled = !available; });
    var badge = element('screenWeatherStatusBadge');
    var note = element('screenWeatherSupportNote');
    if (!available) {
      if (badge) badge.textContent = 'Android 전용';
      if (note) note.textContent = '웹 브라우저에서는 동작하지 않습니다. Android 앱에서 설정하세요.';
      return;
    }
    if (!nativeState) {
      if (badge) badge.textContent = '상태 확인 중';
      if (note) note.textContent = 'Android 지원 상태를 다시 확인하고 있습니다.';
      return;
    }
    var listPermissionScreen = nativeState.permissionScreenMode === 'app_list';
    if (!nativeState.enabled) {
      if (badge) badge.textContent = '꺼짐';
      if (note) note.textContent = listPermissionScreen
        ? '사용자가 끈 상태입니다. 다시 켜면 시스템 목록이 열리며, Android 11 이상에서는 목록에서 날씨한눈을 선택해야 합니다.'
        : '사용자가 끈 상태입니다. 다시 켜면 날씨한눈의 다른 앱 위에 표시 권한 화면이 열립니다.';
    } else if (!nativeState.permissionGranted) {
      if (badge) badge.textContent = '권한 필요';
      if (note) note.textContent = listPermissionScreen
        ? '‘다른 앱 위에 표시’ 목록에서 날씨한눈을 선택한 뒤 허용하세요. 허용 전에도 위젯과 알림은 사용할 수 있습니다.'
        : '날씨한눈의 다른 앱 위에 표시 권한을 허용하세요. 허용 전에도 위젯과 알림은 사용할 수 있습니다.';
    } else if (!nativeState.snapshotAvailable) {
      if (badge) badge.textContent = '예보 대기';
      if (note) note.textContent = '권한은 준비됐습니다. 앱에서 최신 예보를 한 번 불러오면 미리보기를 사용할 수 있습니다.';
    } else {
      if (badge) badge.textContent = nativeState.receiverActive ? '사용 중' : '대기 중';
      if (note) note.textContent = '잠금 해제 뒤 표시합니다. 앱 프로세스가 종료되거나 기기 정책이 제한하면 동작하지 않을 수 있어 위젯·알림을 함께 권장합니다.';
    }
  }
  function renderWidgetState() {
    var android = widgetBridge();
    var add = element('homeWidgetAdd');
    var sync = element('homeWidgetSync');
    var badge = element('homeWidgetStatusBadge');
    var note = element('homeWidgetSupportNote');
    var theme = element('homeWidgetTheme');
    if (add) add.disabled = !android || !nativeWidgetState?.pinSupported;
    if (sync) sync.disabled = !android || !latestWeather;
    if (theme) {
      var premiumAllowed = nativeWidgetState?.premiumThemesAllowed === true;
      var requested = premiumAllowed ? nativeWidgetState?.selectedTheme : nativeWidgetState?.theme;
      var selected = ['default', 'contrast', 'field'].includes(requested) ? requested : 'default';
      theme.value = selected;
      theme.disabled = !android;
      Array.from(theme.options).forEach(function (option) {
        option.disabled = !premiumAllowed && option.value !== 'default';
      });
    }
    if (!android) {
      if (badge) badge.textContent = 'Android 전용';
      if (note) note.textContent = '웹 브라우저에서는 위젯을 추가할 수 없습니다. Android 앱에서 설정하세요.';
      return;
    }
    if (!nativeWidgetState) {
      if (badge) badge.textContent = '상태 확인 중';
      if (note) note.textContent = 'Android 위젯 지원 상태를 다시 확인하고 있습니다.';
      return;
    }
    var count = Number(nativeWidgetState.activeWidgetCount) || 0;
    if (badge) badge.textContent = count ? count + '개 사용 중' : '추가 가능';
    if (note) {
      if (!nativeWidgetState.pinSupported) note.textContent = '이 런처는 앱 안에서 바로 추가를 지원하지 않습니다. 홈 화면의 위젯 선택기에서 날씨한눈을 추가하세요.';
      else if (!nativeWidgetState.locationAvailable) note.textContent = '지역을 먼저 선택하면 위젯에 최신 모델 예보를 전달합니다.';
      else if (!nativeWidgetState.weatherAvailable) note.textContent = '지역은 준비됐습니다. 최신 예보를 불러오면 위젯을 갱신합니다.';
      else {
        var themeLabel = nativeWidgetState.theme === 'contrast' ? '고대비' : nativeWidgetState.theme === 'field' ? '들녘' : '기본 하늘';
        note.textContent = count ? '현재 선택 지역과 모델 예보를 사용 중입니다. '+themeLabel+' 테마이며 크기에 따라 2×1·4×2·4×3 화면이 자동 전환됩니다.' : '현재 예보가 준비됐습니다. 추가 버튼을 누른 뒤 Android 런처에서 확인하세요.';
      }
    }
  }
  function readNativeState() {
    var android = bridge();
    if (!android) { nativeState = null; renderState(); return null; }
    try {
      nativeState = parseNativeState(android.screenWeatherState());
      if (nativeState) applyConfig(nativeState);
    } catch (_) { nativeState = null; }
    renderState();
    return nativeState;
  }
  function readWidgetState() {
    var android = widgetBridge();
    if (!android || typeof android.widgetState !== 'function') {
      nativeWidgetState = null;
      renderWidgetState();
      return null;
    }
    try { nativeWidgetState = parseNativeState(android.widgetState()); }
    catch (_) { nativeWidgetState = null; }
    renderWidgetState();
    return nativeWidgetState;
  }
  function saveConfig(requestPermission) {
    var config = controlsConfig();
    writeLocal(config);
    var android = bridge();
    if (!android) { renderState(); return; }
    try {
      android.saveScreenWeatherConfiguration(JSON.stringify(config));
      nativeState = Object.assign({}, nativeState || {}, config);
      if (requestPermission && config.enabled && nativeState.permissionGranted !== true) android.requestScreenWeatherPermission();
    } catch (_) {}
    renderState();
  }
  function updateSnapshot(detail, previewRequested) {
    latestWeather = detail || latestWeather;
    var android = bridge();
    var widgetAndroid = widgetBridge();
    var current = latestWeather && latestWeather.weather && latestWeather.weather.current;
    var daily = latestWeather && latestWeather.weather && latestWeather.weather.daily;
    var location = latestWeather && latestWeather.loc;
    if ((!android && !widgetAndroid) || !current || !location || !finite(current.temperature_2m) || !latestWeather.at) return false;
    var rain = window.WeatherHannunRainDecision && window.WeatherHannunRainDecision.summarise(latestWeather.weather);
    var payload = {
      locationName: String(location.name || '선택 지역').slice(0, 75),
      latitude: finite(Number(location.lat)) ? Number(location.lat) : null,
      longitude: finite(Number(location.lon)) ? Number(location.lon) : null,
      temperature: current.temperature_2m,
      feelsLike: finite(current.apparent_temperature) ? current.apparent_temperature : null,
      condition: String(element('weatherSummary')?.textContent || '').trim().slice(0, 60),
      weatherCode: finite(current.weather_code) ? current.weather_code : null,
      isDay: finite(current.is_day) ? current.is_day : null,
      high: finite(daily?.temperature_2m_max?.[0]) ? daily.temperature_2m_max[0] : null,
      low: finite(daily?.temperature_2m_min?.[0]) ? daily.temperature_2m_min[0] : null,
      rainGuidance: String(rain && rain.title || '').trim().slice(0, 120),
      updatedAt: latestWeather.at,
      sourceLabel: 'Open-Meteo 모델 예보'
    };
    var saved = false;
    if (widgetAndroid) {
      try {
        widgetAndroid.updateWidgetSnapshot(JSON.stringify(payload));
        saved = true;
        if (typeof widgetAndroid.widgetState === 'function') nativeWidgetState = parseNativeState(widgetAndroid.widgetState());
      } catch (_) {}
    }
    if (android && (nativeState?.enabled === true || previewRequested === true)) {
      try { android.updateScreenWeatherSnapshot(JSON.stringify(payload)); saved = true; } catch (_) {}
    }
    renderWidgetState();
    return saved;
  }
  function bind() {
    if (!element('screenWeatherSettings')) return;
    applyConfig(readLocal());
    element('screenWeatherEnabled')?.addEventListener('change', function () { saveConfig(this.checked); });
    element('screenWeatherDuration')?.addEventListener('change', function () { saveConfig(false); });
    element('screenWeatherCooldown')?.addEventListener('change', function () { saveConfig(false); });
    element('screenWeatherPermission')?.addEventListener('click', function () {
      try { bridge()?.requestScreenWeatherPermission(); } catch (_) {}
    });
    element('screenWeatherPreview')?.addEventListener('click', function () {
      updateSnapshot(latestWeather, true);
      try { bridge()?.previewScreenWeather(); } catch (_) {}
    });
    element('homeWidgetAdd')?.addEventListener('click', function () {
      updateSnapshot(latestWeather);
      try { widgetBridge()?.requestPinWeatherWidget?.(); } catch (_) {}
      if (element('homeWidgetSupportNote')) element('homeWidgetSupportNote').textContent = 'Android 런처의 추가 확인 화면에서 위치와 크기를 확인하세요.';
    });
    element('homeWidgetSync')?.addEventListener('click', function () {
      var updated = updateSnapshot(latestWeather);
      if (element('homeWidgetSupportNote')) element('homeWidgetSupportNote').textContent = updated ? '현재 선택 지역의 모델 예보를 위젯에 전달했습니다.' : '최신 예보를 먼저 불러와 주세요.';
    });
    element('homeWidgetTheme')?.addEventListener('change', function () {
      var android = widgetBridge();
      if (!android || typeof android.saveWidgetTheme !== 'function') return;
      try {
        android.saveWidgetTheme(this.value);
        if (typeof android.widgetState === 'function') nativeWidgetState = parseNativeState(android.widgetState());
      } catch (_) {}
      renderWidgetState();
    });
    readNativeState();
    readWidgetState();
  }
  window.addEventListener('weatherhannun:data', function (event) { updateSnapshot(event.detail); });
  window.WeatherHannunScreenWeather = {
    syncWithAndroid: function () { readNativeState(); updateSnapshot(latestWeather); },
    onAndroidState: function (state) {
      nativeState = parseNativeState(state);
      if (nativeState) applyConfig(nativeState);
      renderState();
    }
  };
  window.WeatherHannunWidgets = {
    syncWithAndroid: function () { readWidgetState(); return updateSnapshot(latestWeather); },
    onAndroidState: function (state) {
      nativeWidgetState = parseNativeState(state);
      renderWidgetState();
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once: true});
  else bind();
})();
