import {test, expect} from "@playwright/test";
import fs from "node:fs";

const legacyForecast = JSON.parse(fs.readFileSync(new URL("../fixtures/mobile-weather.json", import.meta.url)));
const rows = (block, fields) => block.time.map((time, index) => Object.fromEntries([
  ["time", time],
  ...fields.map(([target, source]) => [target, block[source]?.[index] ?? null])
]));
const domesticResponse = {
  contractVersion: "weatherhannun.v2",
  location: {name: "서울", lat: 37.5665, lon: 126.978, timezone: "Asia/Seoul"},
  current: {time: legacyForecast.current.time, temperature: legacyForecast.current.temperature_2m, humidity: legacyForecast.current.relative_humidity_2m, apparentTemperature: legacyForecast.current.apparent_temperature, isDay: legacyForecast.current.is_day, precipitation: legacyForecast.current.precipitation, conditionCode: legacyForecast.current.weather_code, windSpeed: legacyForecast.current.wind_speed_10m, windDirection: legacyForecast.current.wind_direction_10m},
  hourly: rows(legacyForecast.hourly, [["temperature", "temperature_2m"], ["precipitationProbability", "precipitation_probability"], ["precipitation", "precipitation"], ["conditionCode", "weather_code"], ["windSpeed", "wind_speed_10m"], ["windGust", "wind_gusts_10m"], ["humidity", "relative_humidity_2m"], ["uvIndex", "uv_index"], ["isDay", "is_day"]]),
  daily: rows(legacyForecast.daily, [["conditionCode", "weather_code"], ["temperatureMax", "temperature_2m_max"], ["temperatureMin", "temperature_2m_min"], ["precipitation", "precipitation_sum"], ["precipitationProbability", "precipitation_probability_max"], ["sunrise", "sunrise"], ["sunset", "sunset"], ["uvIndexMax", "uv_index_max"]]).map(row => ({...row, date: row.time.slice(0, 10)})),
  airQuality: {measuredAt: legacyForecast.current.time, pm10: 28, pm25: 16, khai: 54},
  source: {provider: "kma", attribution: "기상청", fetchedAt: new Date().toISOString()}
};

test("해외 지역은 공통 API의 MET Norway 예보로 주요 화면을 표시한다", async ({page}) => {
  const errors = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/weatherApi?**", route => route.fulfill({json: {
    ...domesticResponse,
    location: {...domesticResponse.location, name: "London", lat: 51.5074, lon: -0.1278, timezone: "Europe/London"},
    airQuality: null,
    source: {provider: "met-no", attribution: "MET Norway", fetchedAt: new Date().toISOString()}
  }}));
  await page.goto("/?lat=51.5074&lon=-0.1278&name=London");
  await expect(page.locator("#currentTemp")).not.toHaveText("--", {timeout: 25_000});
  await expect(page.locator("#dataFooterStatus")).toContainText("MET Norway");
  const briefing = page.locator("#startupWeatherBriefing");
  if (await briefing.isVisible()) await page.locator("#startupBriefingClose").click();
  await page.locator('button[data-view="hourly"]:visible').click();
  await expect(page.locator("#view-hourly")).toHaveClass(/active/);
  await page.locator('button[data-view="weekly"]:visible').click();
  await expect(page.locator("#view-weekly")).toHaveClass(/active/);
  expect(errors.filter(message => !message.includes("favicon"))).toEqual([]);
});

test("국내 지역은 기상청 중심 공통 API만 사용하고 직접 모델 fallback을 호출하지 않는다", async ({page}) => {
  const directModelRequests = [];
  page.on("request", request => {
    if (/api\.open-meteo\.com|air-quality-api\.open-meteo\.com/i.test(request.url())) directModelRequests.push(request.url());
  });
  await page.route("**/weatherApi?**", route => route.fulfill({json: domesticResponse}));
  await page.goto("/?lat=37.5665&lon=126.978&name=서울");
  await expect(page.locator("#currentTemp")).not.toHaveText("--", {timeout: 25_000});
  await expect(page.locator("#updatedBadge")).toContainText("공식 예보 조회");
  await expect(page.locator("#dataFooterStatus")).toContainText("기상청");
  expect(directModelRequests).toEqual([]);
});
