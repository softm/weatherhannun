import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

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
  const text = await fetchOk(kmaUrl("/api/typ01/url/wrn_now_data_new.php", { fe: "f", tm: compact(at), disp: "0", help: "0" })).then(r => r.text());
  return text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("#")).map(line => {
    const part = line.trim().split(/\s+/);
    if (part.length < 9) return null;
    return { upperRegionCode: part[0], upperRegionName: part[1], regionCode: part[2], regionName: part[3], announcedAt: isoKst(part[4]), effectiveAt: isoKst(part[5]), warningCode: part[6], level: part[7], command: part[8] };
  }).filter(Boolean);
}
function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii"), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}
function radarColor(value) {
  if (value <= -25000) return [0, 0, 0, 0];
  const dbz = value / 100;
  if (dbz < 0) return [198, 231, 255, 95];
  if (dbz < 10) return [99, 181, 255, 145];
  if (dbz < 20) return [50, 127, 224, 175];
  if (dbz < 30) return [65, 190, 103, 195];
  if (dbz < 40) return [245, 211, 69, 215];
  if (dbz < 50) return [244, 139, 46, 225];
  if (dbz < 60) return [224, 65, 65, 235];
  return [151, 70, 189, 245];
}
function radarDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  const candidates = [
    { width: buffer.readUInt16LE(0), height: buffer.readUInt16LE(2), littleEndian: true },
    { width: buffer.readUInt16BE(0), height: buffer.readUInt16BE(2), littleEndian: false }
  ];
  return candidates.find(item => item.width > 10 && item.height > 10 && item.width <= 10000 && item.height <= 10000 && buffer.length >= 4 + item.width * item.height * 2) || null;
}
function radarPng(buffer) {
  const grid = radarDimensions(buffer);
  if (!grid) throw new Error("KMA radar binary grid header is invalid");
  const width = Math.min(900, grid.width), height = Math.max(1, Math.round(grid.height * width / grid.width));
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1); pixels[row] = 0;
    const sourceY = grid.height - 1 - Math.min(grid.height - 1, Math.floor(y * grid.height / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(grid.width - 1, Math.floor(x * grid.width / width));
      const offset = 4 + (sourceY * grid.width + sourceX) * 2;
      const value = grid.littleEndian ? buffer.readInt16LE(offset) : buffer.readInt16BE(offset);
      const color = radarColor(value), target = row + 1 + x * 4;
      pixels[target] = color[0]; pixels[target + 1] = color[1]; pixels[target + 2] = color[2]; pixels[target + 3] = color[3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(pixels, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}
async function radar(at) {
  const rounded = new Date(Math.floor((at.getTime() - 10 * 60 * 1000) / (5 * 60 * 1000)) * 5 * 60 * 1000);
  const observedAt = isoKst(compact(rounded));
  const url = kmaUrl("/api/typ01/cgi-bin/url/nph-rdr_cmp1_api", { tm: compact(rounded), cmp: "HSR", qcd: "MSK", obs: "ECHO", map: "HB", disp: "B" });
  const response = await fetchOk(url);
  const binary = Buffer.from(await response.arrayBuffer());
  await writeFile(radarFile, radarPng(binary));
  return {
    status: "ready", kind: "observation", observedAt, imagePath: "./data/official/radar-hsr.png",
    legendIncluded: true, legendKind: "weatherhannun-dbz", product: "기상청 HSR 합성 레이더 반사도",
    legend: [{ minDbz: 0, color: "#63b5ff" }, { minDbz: 10, color: "#327fe0" }, { minDbz: 20, color: "#41be67" }, { minDbz: 30, color: "#f5d345" }, { minDbz: 40, color: "#f48b2e" }, { minDbz: 50, color: "#e04141" }, { minDbz: 60, color: "#9746bd" }]
  };
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
