# Mobile regression input

`mobile-weather.json` is an actual Open-Meteo response retrieved on 2026-11-02 for Seoul (37.5665, 126.978), using the existing legacy forecast URL. It is used only by tests, never by the production app. This fixed response allows reproducible before/after comparison while the domestic unified API returns 503. Tests separately exercise missing values; no generated values are presented as live weather.
