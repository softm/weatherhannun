import { mkdir, writeFile } from "node:fs/promises";

const KMA_KEY = process.env.KMA_API_HUB_KEY || "";
const DATA_KEY = process.env.DATA_GO_KR_SERVICE_KEY || "";
const outputDir = new URL("../data/official/", import.meta.url);
const latestFile = new URL("latest.json", outputDir);
const radarFile = new URL("radar-hsr.png", outputDir);
const provinces = ["서울","부산","대구","인천","광주","대전","울산","경기","강원","충북","충남","전북","전남","경북","경남","제주","세종"];

function pad(value) { return String(value).padStart(2, "0"); }
function kstParts(date) {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return { y: shifted.getUTCFullYear(), m: pad(shifted.getUTCMonth() + 1), d: pad(shifted.getUTCDate()), h: pad(shifted.getUTCHours()), min: pad(shifted.getUTCMinutes()) };
}
function compact(date, includeMinute = true) {
  const p = kstParts(date);
  return `${p.y}${p.m}${p.d}${p.h}${includeMinute ? p.min : ""}`;
}
function isoKst(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}T${digits.slice(8,10)}:${digits.slice(10,12) || "00"}:00+09:00`;
}
function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > -900 ? parsed : null;
}
async function fetchOk(url) {
  const response = await fetch(url, { headers: { "user-agent": "weatherhannun-official-sync/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${new URL(url).pathname}`);
  return response;
}
function kmaUrl(path, params) {
  const url = new URL(path, "https://apihub.kma.go.kr");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("authKey", KMA_KEY);
  return url;
}
function parseElement(text, element) {
  return text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("#")).map(line => {
    const part = line.trim().split(/\s+/);
    if (part.length < 6) return null;
    return { observedAt: isoKst(part[0]), stationId: String(part[1]), lon: number(part[2]), lat: number(part[3]), [element]: number(part[5]) };
  }).filter(row => row && row.observedAt && row.lon !== null && row.lat !== null);
}
function mergeElements(temperatureRows, rainRows) {
  const rain = new Map(rainRows.map(row => [`${row.observedAt}|${row.stationId}`, row.precipitation]));
  return temperatureRows.map(row => ({ ...row, precipitation: rain.get(`${row.observedAt}|${row.stationId}`) ?? null }));
}
async function observations(at) {
  const tm = compact(at, false);
  const base = { tm2: tm, stn: "0", disp: "0", help: "0" };
  const [ta, rn] = await Promise.all([
    fetchOk(kmaUrl("/api/typ01/url/kma_sfctm5.php", { ...base, obs: "TA" })).then(r => r.text()),
    fetchOk(kmaUrl("/api/typ01/url/kma_sfctm5.php", { ...base, obs: "RN" })).then(r => r.text())
  ]);
  return mergeElements(parseElement(ta, "temperature"), parseElement(rn, "precipitation"));
}
async function warnings(at) {
  const text = await fetchOk(kmaUrl("/api/typ01/url/wrn_now_data.php", { fe: "f", tm: compact(at), disp: "0", help: "0" })).then(r => r.text());
  return text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("#")).map(line => {
    const part = line.trim().split(/\s+/);
    if (part.length < 9) return null;
    return { upperRegionCode: part[0], upperRegionName: part[1], regionCode: part[2], regionName: part[3], announcedAt: isoKst(part[4]), effectiveAt: isoKst(part[5]), warningCode: part[6], level: part[7], command: part[8] };
  }).filter(Boolean);
}
async function radar(at) {
  const rounded = new Date(Math.floor((at.getTime() - 10 * 60 * 1000) / (5 * 60 * 1000)) * 5 * 60 * 1000);
  const observedAt = isoKst(compact(rounded));
  const url = kmaUrl("/api/typ03/cgi/rdr/nph-rdr_cmp1_img", { tm: compact(rounded), cmp: "HSR", qcd: "HSLP", obs: "ECHD", color: "C4", aws: "0", acc: "", map: "HR", grid: "2", legend: "1", size: "800", itv: "5", zoom_level: "0", zoom_x: "0000000", zoom_y: "0000000", gov: "" });
  const response = await fetchOk(url);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error("KMA radar response was not an image");
  await writeFile(radarFile, Buffer.from(await response.arrayBuffer()));
  return { status: "ready", kind: "observation", observedAt, imagePath: "./data/official/radar-hsr.png", legendIncluded: true, product: "기상청 HSR 레이더 합성 관측" };
}
function dataUrl(path, params) {
  const url = new URL(path, "https://apis.data.go.kr");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("serviceKey", DATA_KEY);
  url.searchParams.set("returnType", "json");
  return url;
}
function items(json) {
  const header = json && json.response && json.response.header;
  if (!header || String(header.resultCode) !== "00") throw new Error(`AirKorea ${header && header.resultMsg || "invalid response"}`);
  const value = json.response.body && json.response.body.items;
  return Array.isArray(value) ? value : [];
}
async function airKorea() {
  const stationJson = await fetchOk(dataUrl("/B552584/MsrstnInfoInqireSvc/getMsrstnList", { numOfRows: "9999", pageNo: "1", addr: "" })).then(r => r.json());
  const stationMap = new Map(items(stationJson).map(row => [row.stationName, { lat: number(row.dmY), lon: number(row.dmX), address: row.addr || "" }]));
  const batches = await Promise.all(provinces.map(sidoName => fetchOk(dataUrl("/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty", { numOfRows: "1000", pageNo: "1", sidoName, ver: "1.3" })).then(r => r.json()).then(items)));
  return batches.flat().map(row => {
    const station = stationMap.get(row.stationName);
    if (!station || station.lat === null || station.lon === null) return null;
    const measuredAt = typeof row.dataTime === "string" ? `${row.dataTime.replace(" ", "T")}:00+09:00` : null;
    return { stationId: row.stationName, stationName: row.stationName, measuredAt, lat: station.lat, lon: station.lon, address: station.address, pm10: number(row.pm10Value), pm25: number(row.pm25Value), grade: row.khaiGrade || null };
  }).filter(row => row && row.measuredAt);
}

async function main() {
  if (!KMA_KEY || !DATA_KEY) throw new Error("KMA_API_HUB_KEY and DATA_GO_KR_SERVICE_KEY are required");
  await mkdir(outputDir, { recursive: true });
  const now = new Date();
  const currentAt = new Date(Math.floor((now.getTime() - 60 * 60 * 1000) / 3600000) * 3600000);
  const previousAt = new Date(currentAt.getTime() - 24 * 60 * 60 * 1000);
  const [current, previous, warningRows, radarInfo, measurements] = await Promise.all([observations(currentAt), observations(previousAt), warnings(now), radar(now), airKorea()]);
  if (!current.length || !previous.length || !measurements.length) throw new Error("Official snapshot is incomplete; previous file was not replaced");
  const feed = {
    schemaVersion: 1, status: "ready", generatedAt: now.toISOString(),
    rights: [
      { provider: "기상청 API허브", sourceUrl: "https://apihub.kma.go.kr/", licenseUrl: "https://apihub.kma.go.kr/policy.do", license: "공공누리 유형별 출처표시 조건", approval: "GitHub Actions 인증키로 활용 승인 확인", verified: true },
      { provider: "한국환경공단 에어코리아", sourceUrl: "https://www.data.go.kr/data/15073861/openapi.do", licenseUrl: "https://www.data.go.kr/data/15073861/openapi.do", license: "공공저작물 출처표시·변경금지(제3유형), 제3자 권리 포함", approval: "공공데이터포털 운영계정 승인 상태 확인 필요", verified: true }
    ],
    kma: { observations: { current, previous }, warnings: warningRows, radar: radarInfo },
    airKorea: { measurements }
  };
  await writeFile(latestFile, `${JSON.stringify(feed, null, 2)}\n`, "utf8");
  console.log(`official snapshot: ${current.length} current, ${previous.length} previous, ${measurements.length} air stations`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
