import {apparentTemperature, emptyContract, dfsGrid, kmaBase, kmaConditionCode, numberOrNull, parseKmaPrecipitation} from "./core.mjs";

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
export async function fetchJson(url, {headers = {}, attempts = 3, timeoutMs = 12_000, fetchImpl = fetch} = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {headers, signal: controller.signal});
      if (!response.ok) { const error = new Error(`upstream_${response.status}`); error.retryable = response.status === 429 || response.status >= 500; throw error; }
      return await response.json();
    } catch (error) {
      lastError = error; if (attempt + 1 >= attempts || error.retryable === false) break; await sleep(300 * (2 ** attempt) + Math.floor(Math.random() * 100));
    } finally { clearTimeout(timeout); }
  }
  throw lastError;
}

const MET_SYMBOL_CODES = [[/thunder/, 95], [/heavyrain/, 65], [/rain/, 61], [/heavysnow/, 75], [/snow/, 71], [/sleet/, 68], [/fog/, 45], [/cloudy/, 3], [/partlycloudy/, 2], [/fair/, 1], [/clearsky/, 0]];
const metCode = symbol => MET_SYMBOL_CODES.find(([pattern]) => pattern.test(String(symbol || "")))?.[1] ?? null;
const isDayAt = iso => { const hour = new Date(iso).getUTCHours(); return hour >= 6 && hour < 18 ? 1 : 0; };

function aggregateDaily(hourly) {
  const days = new Map();
  for (const row of hourly) {
    const date = row.time.slice(0, 10), day = days.get(date) || {date, temperatures: [], precipitation: [], probabilities: [], codes: []};
    if (Number.isFinite(row.temperature)) day.temperatures.push(row.temperature); if (Number.isFinite(row.precipitation)) day.precipitation.push(row.precipitation);
    if (Number.isFinite(row.precipitationProbability)) day.probabilities.push(row.precipitationProbability); if (Number.isFinite(row.conditionCode)) day.codes.push(row.conditionCode); days.set(date, day);
  }
  return [...days.values()].slice(0, 10).map(day => ({date: day.date, conditionCode: day.codes.find(code => code >= 50) ?? day.codes[Math.floor(day.codes.length / 2)] ?? null, temperatureMax: day.temperatures.length ? Math.max(...day.temperatures) : null, temperatureMin: day.temperatures.length ? Math.min(...day.temperatures) : null, precipitation: day.precipitation.length ? day.precipitation.reduce((sum, value) => sum + value, 0) : null, precipitationProbability: day.probabilities.length ? Math.max(...day.probabilities) : null, sunrise: null, sunset: null, uvIndexMax: null}));
}

export function normalizeMetNorway(data, location, fetchedAt = new Date().toISOString()) {
  const timeseries = data?.properties?.timeseries; if (!Array.isArray(timeseries) || !timeseries.length) throw new Error("invalid_met_payload");
  const hourly = timeseries.slice(0, 240).map(item => {
    const instant = item.data?.instant?.details || {}, oneHour = item.data?.next_1_hours || {}, symbol = oneHour.summary?.symbol_code || item.data?.next_6_hours?.summary?.symbol_code;
    return {time: item.time, temperature: numberOrNull(instant.air_temperature), apparentTemperature: null, humidity: numberOrNull(instant.relative_humidity), windSpeed: numberOrNull(instant.wind_speed), windDirection: numberOrNull(instant.wind_from_direction), windGust: numberOrNull(instant.wind_speed_of_gust), precipitation: numberOrNull(oneHour.details?.precipitation_amount), precipitationProbability: numberOrNull(oneHour.details?.probability_of_precipitation), conditionCode: metCode(symbol), providerCondition: symbol || null, isDay: isDayAt(item.time), uvIndex: numberOrNull(instant.ultraviolet_index_clear_sky)};
  });
  const current = {...hourly[0]}; current.apparentTemperature = apparentTemperature(current.temperature, current.humidity, current.windSpeed);
  return {...emptyContract({...location, country: location.country || "GLOBAL", timezone: location.timezone || "UTC"}, "met-no"), current, hourly, daily: aggregateDaily(hourly), source: {provider: "met-no", issuedAt: data.properties?.meta?.updated_at || null, fetchedAt, attribution: "Weather forecast from MET Norway", license: "CC BY 4.0"}};
}

export async function collectMetNorway(location, options = {}) {
  const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact"); url.searchParams.set("lat", String(location.lat)); url.searchParams.set("lon", String(location.lon));
  return normalizeMetNorway(await fetchJson(url, {...options, headers: {"User-Agent": "WeatherHannun/1.0 (+https://softm.github.io/weatherhannun/; softmnet@gmail.com)"}}), location);
}

function kmaItems(data, label) {
  const header = data?.response?.header; if (header?.resultCode && header.resultCode !== "00") throw new Error(`${label}_${header.resultCode}`);
  const items = data?.response?.body?.items?.item; if (!Array.isArray(items) || !items.length) throw new Error(`${label}_empty`); return items;
}
async function kmaRequest(serviceKey, operation, parameters, options) {
  const url = new URL(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${operation}`); url.searchParams.set("serviceKey", serviceKey); url.searchParams.set("pageNo", "1"); url.searchParams.set("numOfRows", "1000"); url.searchParams.set("dataType", "JSON");
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value)); return fetchJson(url, options);
}
const issueIso = base => `${base.baseDate.slice(0, 4)}-${base.baseDate.slice(4, 6)}-${base.baseDate.slice(6, 8)}T${base.baseTime.slice(0, 2)}:${base.baseTime.slice(2)}:00+09:00`;
function normalizeKmaHourly(items) {
  const byTime = new Map();
  for (const item of items) { const time = `${item.fcstDate.slice(0, 4)}-${item.fcstDate.slice(4, 6)}-${item.fcstDate.slice(6, 8)}T${item.fcstTime.slice(0, 2)}:${item.fcstTime.slice(2)}:00+09:00`; const row = byTime.get(time) || {time}; row[item.category] = item.fcstValue; byTime.set(time, row); }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time)).map(row => ({time: row.time, temperature: numberOrNull(row.TMP ?? row.T1H), apparentTemperature: null, humidity: numberOrNull(row.REH), windSpeed: numberOrNull(row.WSD), windDirection: numberOrNull(row.VEC), windGust: null, precipitation: parseKmaPrecipitation(row.PCP ?? row.RN1), precipitationProbability: numberOrNull(row.POP), conditionCode: kmaConditionCode(row.SKY, row.PTY), providerCondition: {sky: row.SKY ?? null, precipitationType: row.PTY ?? null}, isDay: Number(row.time.slice(11, 13)) >= 6 && Number(row.time.slice(11, 13)) < 18 ? 1 : 0, uvIndex: null}));
}

export async function collectKma(location, serviceKey, {now = new Date(), ...options} = {}) {
  if (!serviceKey || serviceKey === "UNCONFIGURED") throw new Error("kma_key_missing");
  const {nx, ny} = dfsGrid(location.lat, location.lon), observationBase = kmaBase("ultraObservation", now), ultraBase = kmaBase("ultraForecast", now), villageBase = kmaBase("village", now), common = {nx, ny};
  const [observationResult, ultraResult, villageResult] = await Promise.allSettled([
    kmaRequest(serviceKey, "getUltraSrtNcst", {...common, base_date: observationBase.baseDate, base_time: observationBase.baseTime}, options),
    kmaRequest(serviceKey, "getUltraSrtFcst", {...common, base_date: ultraBase.baseDate, base_time: ultraBase.baseTime}, options),
    kmaRequest(serviceKey, "getVilageFcst", {...common, base_date: villageBase.baseDate, base_time: villageBase.baseTime}, options),
  ]);
  if (villageResult.status !== "fulfilled") throw villageResult.reason;
  const villageItems = kmaItems(villageResult.value, "kma_village"), ultraItems = ultraResult.status === "fulfilled" ? kmaItems(ultraResult.value, "kma_ultra") : [];
  const hourly = [...new Map(normalizeKmaHourly([...ultraItems, ...villageItems]).map(row => [row.time, row])).values()].sort((a, b) => a.time.localeCompare(b.time)); let current = null;
  if (observationResult.status === "fulfilled") {
    const values = Object.fromEntries(kmaItems(observationResult.value, "kma_observation").map(item => [item.category, item.obsrValue])), time = issueIso(observationBase);
    current = {time, temperature: numberOrNull(values.T1H), apparentTemperature: null, humidity: numberOrNull(values.REH), windSpeed: numberOrNull(values.WSD), windDirection: numberOrNull(values.VEC), windGust: null, precipitation: parseKmaPrecipitation(values.RN1), precipitationProbability: null, conditionCode: hourly[0]?.conditionCode ?? null, providerCondition: null, isDay: Number(time.slice(11, 13)) >= 6 && Number(time.slice(11, 13)) < 18 ? 1 : 0, uvIndex: null};
    current.apparentTemperature = apparentTemperature(current.temperature, current.humidity, current.windSpeed);
  } else if (hourly.length) { current = {...hourly[0]}; current.apparentTemperature = apparentTemperature(current.temperature, current.humidity, current.windSpeed); }
  return {...emptyContract({...location, country: "KR", timezone: "Asia/Seoul", grid: {nx, ny}}, "kma"), current, hourly, daily: aggregateDaily(hourly), source: {provider: "kma", issuedAt: issueIso(villageBase), observedAt: current?.time || null, fetchedAt: new Date().toISOString(), attribution: "기상청 초단기실황·초단기예보·단기예보", license: "공공누리 제1유형 표시", partial: observationResult.status !== "fulfilled" || ultraResult.status !== "fulfilled"}};
}

export async function collectAirKorea(stationName, serviceKey, options = {}) {
  if (!stationName) return null; if (!serviceKey || serviceKey === "UNCONFIGURED") throw new Error("airkorea_key_missing");
  const url = new URL("https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty");
  Object.entries({serviceKey, returnType: "json", numOfRows: "1", pageNo: "1", stationName, dataTerm: "DAILY", ver: "1.3"}).forEach(([key, value]) => url.searchParams.set(key, value));
  const data = await fetchJson(url, options), item = data?.response?.body?.items?.[0]; if (!item) throw new Error("airkorea_empty");
  return {stationName, measuredAt: item.dataTime || null, pm10: numberOrNull(item.pm10Value), pm25: numberOrNull(item.pm25Value), khai: numberOrNull(item.khaiValue), pm10Grade: numberOrNull(item.pm10Grade1h ?? item.pm10Grade), pm25Grade: numberOrNull(item.pm25Grade1h ?? item.pm25Grade), source: {provider: "airkorea", attribution: "한국환경공단 에어코리아", fetchedAt: new Date().toISOString()}};
}

export async function collectWwis(cityId, language = "en", options = {}) {
  if (!/^\d+$/.test(String(cityId))) throw new Error("invalid_wwis_city"); const lang = /^[a-z]{2}$/.test(language) ? language : "en";
  const data = await fetchJson(`https://worldweather.wmo.int/${lang}/json/${cityId}_${lang}.json`, options); if (!data?.city) throw new Error("wwis_empty"); return data;
}
