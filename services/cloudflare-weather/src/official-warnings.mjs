const CACHE_ID = "official_warnings_v1";
export const MAX_WARNING_AGE_MS = 30 * 60 * 1000;

const configured = value => Boolean(value && value !== "UNCONFIGURED");
const pad = value => String(value).padStart(2, "0");
function compactKst(date) {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}${pad(shifted.getUTCDate())}${pad(shifted.getUTCHours())}${pad(shifted.getUTCMinutes())}`;
}
function isoKst(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T${digits.slice(8, 10)}:${digits.slice(10, 12) || "00"}:00+09:00`;
}

export function parseOfficialWarningText(text) {
  return String(text || "").split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("#")).map(line => {
    const part = line.trim().split(/\s+/);
    if (part.length < 9) return null;
    if (!/^[WRCDONVTSYHF]$/.test(part[6]) || !/^[123]$/.test(part[7]) || !/^[1-7]$/.test(part[8])) return null;
    return {
      upperRegionCode: part[0], upperRegionName: part[1], regionCode: part[2], regionName: part[3],
      announcedAt: isoKst(part[4]), effectiveAt: isoKst(part[5]), warningCode: part[6], level: part[7], command: part[8]
    };
  }).filter(Boolean);
}

export async function collectOfficialWarnings(apiKey, dependencies = {}, at = new Date()) {
  if (!configured(apiKey)) throw new Error("kma_api_hub_key_missing");
  const url = new URL("https://apihub.kma.go.kr/api/typ01/url/wrn_now_data_new.php");
  for (const [key, value] of Object.entries({fe: "f", tm: compactKst(at), disp: "0", help: "0", authKey: apiKey})) {
    url.searchParams.set(key, value);
  }
  const request = dependencies.fetch || fetch;
  const options = {headers: {"user-agent": "weatherhannun-official-warning/1.0"}};
  if (!dependencies.fetch) options.signal = AbortSignal.timeout(7000);
  const response = await request(url, options);
  if (!response.ok) throw new Error(`kma_warning_http_${response.status}`);
  const warnings = parseOfficialWarningText(await response.text());
  return {
    schemaVersion: 1,
    status: "ready",
    generatedAt: at.toISOString(),
    rights: [{provider: "기상청 API허브", sourceUrl: "https://apihub.kma.go.kr/", verified: true}],
    kma: {warnings}
  };
}

export function warningSnapshotFresh(snapshot, now = Date.now()) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.status !== "ready" || !Array.isArray(snapshot.kma?.warnings)) return false;
  const generated = Date.parse(snapshot.generatedAt);
  const age = now - generated;
  return Number.isFinite(generated) && age >= -10 * 60 * 1000 && age <= MAX_WARNING_AGE_MS;
}

async function readSnapshot(env) {
  const row = await env.DB.prepare("SELECT payload,fetched_at_ms FROM weather_cache WHERE id=?").bind(CACHE_ID).first();
  if (!row?.payload) return null;
  try { return JSON.parse(row.payload); } catch { return null; }
}

async function writeSnapshot(env, snapshot) {
  await env.DB.prepare("INSERT INTO weather_cache (id,country,payload,fetched_at_ms) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,fetched_at_ms=excluded.fetched_at_ms,country=excluded.country")
    .bind(CACHE_ID, "KR_OFFICIAL", JSON.stringify(snapshot), Date.now()).run();
}

export async function refreshOfficialWarnings(env, dependencies = {}) {
  const collect = dependencies.collect || collectOfficialWarnings;
  const snapshot = await collect(env.KMA_API_HUB_KEY, dependencies);
  if (!warningSnapshotFresh(snapshot)) throw new Error("invalid_official_warning_snapshot");
  await writeSnapshot(env, snapshot);
  return snapshot;
}

export async function getOfficialWarnings(env, dependencies = {}) {
  const stored = await readSnapshot(env);
  if (warningSnapshotFresh(stored)) return stored;
  return refreshOfficialWarnings(env, dependencies);
}

export function officialWarningsConfigured(env) {
  return configured(env?.KMA_API_HUB_KEY);
}
