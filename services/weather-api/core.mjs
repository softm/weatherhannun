import {createHash} from "node:crypto";

export const CONTRACT_VERSION = "weatherhannun.v2";
export const REGION = "asia-northeast3";
export const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "suite-v1";
export const KST = "Asia/Seoul";

export const numberOrNull = value => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function coordinates(input = {}) {
  const lat = numberOrNull(input.lat);
  const lon = numberOrNull(input.lon ?? input.lng);
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error("invalid_coordinates");
  return {lat, lon};
}

const KOREA_POLYGONS = [
  [[126.08, 33.08], [126.98, 33.08], [127.15, 33.72], [126.55, 34.05], [125.95, 33.75]],
  [[124.95, 34.05], [126.05, 34.05], [126.55, 34.42], [127.35, 34.45], [128.15, 34.72], [129.55, 35.05], [129.65, 35.75], [129.45, 36.65], [129.10, 37.10], [128.65, 38.62], [127.15, 38.62], [126.20, 38.20], [125.65, 37.65], [125.95, 36.70], [125.55, 35.90]],
];

function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi)) inside = !inside;
  }
  return inside;
}

export const isSouthKorea = ({lat, lon}) => KOREA_POLYGONS.some(polygon => pointInPolygon(lat, lon, polygon));

export function dfsGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136, DEGRAD = Math.PI / 180.0;
  const re = RE / GRID, slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5); sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5); ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5); ra = re * sf / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon; if (theta > Math.PI) theta -= 2.0 * Math.PI; if (theta < -Math.PI) theta += 2.0 * Math.PI; theta *= sn;
  return {nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)};
}

function kstParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone: KST, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(date).reduce((result, part) => ({...result, [part.type]: part.value}), {});
  return {date: `${parts.year}${parts.month}${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute)};
}
const subtractMinutes = (date, minutes) => new Date(date.getTime() - minutes * 60_000);

export function kmaBase(kind, now = new Date()) {
  if (kind === "ultraObservation") { const p = kstParts(subtractMinutes(now, 40)); return {baseDate: p.date, baseTime: `${String(p.hour).padStart(2, "0")}00`}; }
  if (kind === "ultraForecast") { const p = kstParts(subtractMinutes(now, 60)); return {baseDate: p.date, baseTime: `${String(p.hour).padStart(2, "0")}30`}; }
  const available = kstParts(subtractMinutes(now, 20)); const cycles = [2, 5, 8, 11, 14, 17, 20, 23];
  let cycle = cycles.filter(hour => hour <= available.hour).at(-1); let date = available.date;
  if (cycle === undefined) { date = kstParts(subtractMinutes(now, 24 * 60 + 20)).date; cycle = 23; }
  return {baseDate: date, baseTime: `${String(cycle).padStart(2, "0")}00`};
}

export function kmaConditionCode(sky, precipitationType) {
  const pty = Number(precipitationType);
  if (pty === 1 || pty === 5) return 61; if (pty === 2 || pty === 6) return 68; if (pty === 3 || pty === 7) return 71; if (pty === 4) return 80;
  const value = Number(sky); if (value === 1) return 0; if (value === 3) return 2; if (value === 4) return 3; return null;
}

export function parseKmaPrecipitation(value) {
  if (value === undefined || value === null || value === "" || value === "강수없음") return 0;
  const match = String(value).replace(",", ".").match(/[0-9]+(?:\.[0-9]+)?/); return match ? Number(match[0]) : null;
}

export function apparentTemperature(temperature, humidity, windSpeed) {
  if (![temperature, humidity].every(Number.isFinite)) return null; const wind = Number.isFinite(windSpeed) ? windSpeed : 0;
  if (temperature <= 10 && wind >= 1.3) { const kmh = wind * 3.6; return 13.12 + 0.6215 * temperature - 11.37 * Math.pow(kmh, 0.16) + 0.3965 * temperature * Math.pow(kmh, 0.16); }
  if (temperature >= 27) { const e = humidity / 100 * 6.105 * Math.exp(17.27 * temperature / (237.7 + temperature)); return temperature + 0.33 * e - 0.7 * wind - 4; }
  return temperature;
}

export const hashPayload = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const roundedLocationKey = ({lat, lon}) => `${Math.round(lat * 100) / 100}_${Math.round(lon * 100) / 100}`.replaceAll(".", "p").replaceAll("-", "m");

export function emptyContract(location, provider) {
  return {contractVersion: CONTRACT_VERSION, location, current: null, hourly: [], daily: [], airQuality: null, alerts: [], officialForecast: null, comparison: null, source: {provider, issuedAt: null, fetchedAt: new Date().toISOString(), attribution: null, license: null}, stale: false};
}

export function validateContract(payload) {
  const missing = []; if (!payload || typeof payload !== "object") return {valid: false, missing: ["payload"]};
  for (const field of ["location", "current", "hourly", "daily", "airQuality", "alerts", "officialForecast", "comparison", "source", "stale"]) if (!(field in payload)) missing.push(field);
  if (!Array.isArray(payload.hourly)) missing.push("hourly[]"); if (!Array.isArray(payload.daily)) missing.push("daily[]"); if (!Array.isArray(payload.alerts)) missing.push("alerts[]");
  return {valid: missing.length === 0, missing};
}
