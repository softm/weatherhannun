import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {defineSecret, defineString} from "firebase-functions/params";
import {logger} from "firebase-functions";
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {DATABASE_ID, REGION, coordinates, isSouthKorea, validateContract} from "./core.mjs";
import {collectAirKorea, collectKma, collectMetNorway, collectWwis} from "./providers.mjs";
import {locationDocumentId, readFreshOrLastGood, saveForecastHistory, writeIfChanged} from "./storage.mjs";

if (!getApps().length) initializeApp();
const db = getFirestore(DATABASE_ID);
const kmaApiKey = defineSecret("KMA_API_KEY");
const airKoreaApiKey = defineSecret("AIRKOREA_API_KEY");
const wwisApproved = defineString("WWIS_COMMERCIAL_APPROVED", {default: "false"});

const json = (response, status, body, cacheControl = "no-store") => response.status(status).set("Cache-Control", cacheControl).json(body);
const locationFromQuery = query => ({...coordinates(query), name: String(query.name || "선택 지역").slice(0, 80), stationName: String(query.stationName || "").slice(0, 80)});
const configured = value => Boolean(value && value !== "UNCONFIGURED");

async function collect(location, {kmaKey = "", airKey = "", requestMode = false} = {}) {
  const korean = isSouthKorea(location);
  const requestOptions = requestMode ? {attempts: 1, timeoutMs: 7_000} : {};
  const payload = korean ? await collectKma(location, kmaKey, requestOptions) : await collectMetNorway(location, requestOptions);
  if (korean && configured(airKey)) {
    try { payload.airQuality = await collectAirKorea(location, airKey, requestOptions); }
    catch (error) { logger.warn("AirKorea partial failure", {code: error.message, location: locationDocumentId(location)}); }
  }
  const result = validateContract(payload); if (!result.valid) throw new Error(`invalid_contract:${result.missing.join(",")}`); return payload;
}

async function registerLocation(location, cacheMetadata = {}) {
  const now = Date.now();
  if (now - Number(cacheMetadata.lastRegisteredAt || 0) < 30 * 60_000) return;
  const id = locationDocumentId(location), country = isSouthKorea(location) ? "KR" : "GLOBAL";
  await Promise.all([
    db.collection("weather_locations").doc(id).set({...location, id, country, lastActiveAt: now, updatedAt: FieldValue.serverTimestamp()}, {merge: true}),
    db.collection("weather_api_cache").doc(id).set({lastRegisteredAt: now}, {merge: true}),
  ]);
}

async function serveWeather(request, response) {
  if (request.method !== "GET") return json(response, 405, {error: "method_not_allowed"});
  let location; try { location = locationFromQuery(request.query); } catch { return json(response, 400, {error: "invalid_coordinates"}); }
  const korean = isSouthKorea(location); const cache = await readFreshOrLastGood(db, location, korean ? 10 * 60_000 : 30 * 60_000);
  await registerLocation(location, cache.metadata).catch(error => logger.warn("Location registration failed", {code: error.message}));
  const needsAirQualityRefresh = korean && configured(airKoreaApiKey.value()) && !cache.fresh?.airQuality;
  const publicCache = "public, max-age=300, s-maxage=600, stale-while-revalidate=1800";
  if (cache.fresh && !needsAirQualityRefresh) return json(response, 200, {...cache.fresh, cache: {hit: true, fallback: false}}, publicCache);
  // Never hold an app launch or notification job while an upstream provider is slow.
  // The active-grid scheduler refreshes this entry; clients retain their local last-good value.
  if (cache.lastGood) return json(response, 200, {...cache.lastGood, stale: true, cache: {hit: true, fallback: true, refreshQueued: true}}, publicCache);
  try {
    const payload = await collect(location, {kmaKey: kmaApiKey.value(), airKey: airKoreaApiKey.value(), requestMode: true}); const write = await writeIfChanged(cache.ref, payload, {country: korean ? "KR" : "GLOBAL"});
    if (write.changed) await saveForecastHistory(db, location, payload); return json(response, 200, {...payload, cache: {hit: false, changed: write.changed}}, publicCache);
  } catch (error) {
    logger.error("Weather collection failed", {code: error.message, location: locationDocumentId(location), korean});
    if (cache.lastGood) return json(response, 200, {...cache.lastGood, stale: true, cache: {hit: true, fallback: true}, error: {code: "provider_unavailable"}});
    return json(response, error.message === "kma_key_missing" ? 503 : 502, {error: error.message === "kma_key_missing" ? "domestic_provider_not_configured" : "weather_provider_unavailable"});
  }
}

export const weatherApi = onRequest({region: REGION, cors: ["https://softm.github.io", /^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/], secrets: [kmaApiKey, airKoreaApiKey], maxInstances: 20, concurrency: 40, timeoutSeconds: 45}, serveWeather);

async function selectedLocations({country, activeWithinMs, savedOnly = false, limit = 100} = {}) {
  let query = db.collection("weather_locations").limit(limit); if (country) query = query.where("country", "==", country); if (savedOnly) query = query.where("saved", "==", true);
  const snapshot = await query.get(), threshold = Date.now() - (activeWithinMs || Number.MAX_SAFE_INTEGER);
  return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).filter(location => !activeWithinMs || Number(location.lastActiveAt || 0) >= threshold);
}

async function syncLocations(locations, keys = {}) {
  const outcomes = [];
  for (const location of locations) {
    try {
      const cache = await readFreshOrLastGood(db, location, 0), payload = await collect(location, keys), write = await writeIfChanged(cache.ref, payload, {country: isSouthKorea(location) ? "KR" : "GLOBAL"});
      if (write.changed) await saveForecastHistory(db, location, payload); outcomes.push({id: location.id, ok: true, changed: write.changed});
    } catch (error) { outcomes.push({id: location.id, ok: false, error: error.message}); }
  }
  logger.info("Location sync completed", {count: outcomes.length, failures: outcomes.filter(item => !item.ok).length}); return outcomes;
}

const scheduled = (schedule, extra = {}) => ({region: REGION, schedule, timeZone: "Asia/Seoul", timeoutSeconds: 300, retryCount: 2, ...extra});

export const kmaNowcastSync = onSchedule({...scheduled("every 10 minutes"), secrets: [kmaApiKey, airKoreaApiKey]}, async () => syncLocations(await selectedLocations({country: "KR", activeWithinMs: 2 * 60 * 60_000, limit: 100}), {kmaKey: kmaApiKey.value(), airKey: airKoreaApiKey.value()}));
export const kmaVillageSync = onSchedule({...scheduled("7,17,27,37,47,57 * * * *"), secrets: [kmaApiKey, airKoreaApiKey]}, async () => syncLocations(await selectedLocations({country: "KR", savedOnly: true, limit: 200}), {kmaKey: kmaApiKey.value(), airKey: airKoreaApiKey.value()}));

export const kmaMidtermSync = onSchedule({...scheduled("20 6,18 * * *"), secrets: [kmaApiKey]}, async () => db.collection("weather_workflow_status").doc("kma-midterm-sync").set({lastRunAt: FieldValue.serverTimestamp(), state: configured(kmaApiKey.value()) ? "awaiting_location_region_mapping" : "blocked_missing_secret"}, {merge: true}));
export const kmaWarningSync = onSchedule({...scheduled("every 5 minutes"), secrets: [kmaApiKey]}, async () => db.collection("weather_workflow_status").doc("kma-warning-sync").set({lastRunAt: FieldValue.serverTimestamp(), state: configured(kmaApiKey.value()) ? "collector_pending_official_endpoint_validation" : "blocked_missing_secret"}, {merge: true}));

export const airKoreaSync = onSchedule({...scheduled("every 30 minutes"), secrets: [airKoreaApiKey]}, async () => {
  const locations = await selectedLocations({country: "KR", savedOnly: true, limit: 200});
  for (const location of locations) {
    try { const value = await collectAirKorea(location, airKoreaApiKey.value()); await db.collection("air_quality_cache").doc(location.id).set({value, stationName: value.stationName, updatedAt: FieldValue.serverTimestamp()}, {merge: true}); }
    catch (error) { logger.warn("AirKorea sync failed", {id: location.id, code: error.message}); }
  }
});

export const metnoActiveSync = onSchedule(scheduled("every 30 minutes"), async () => syncLocations(await selectedLocations({country: "GLOBAL", activeWithinMs: 2 * 60 * 60_000, limit: 100})));
export const metnoSavedSync = onSchedule(scheduled("every 60 minutes"), async () => syncLocations(await selectedLocations({country: "GLOBAL", savedOnly: true, limit: 200})));

export const wwisCitySync = onSchedule(scheduled("15 * * * *"), async () => {
  if (wwisApproved.value() !== "true") { await db.collection("weather_workflow_status").doc("wwis-city-sync").set({lastRunAt: FieldValue.serverTimestamp(), state: "blocked_pending_commercial_approval"}, {merge: true}); return; }
  const snapshot = await db.collection("wwis_cities").where("enabled", "==", true).limit(100).get();
  for (const doc of snapshot.docs) { const city = doc.data(), payload = await collectWwis(doc.id, city.language || "en"); await writeIfChanged(db.collection("wwis_cache").doc(doc.id), payload, {issueDate: payload.city?.forecast?.issueDate || null}); }
});
export const wwisIndexSync = onSchedule(scheduled("35 3 * * *"), async () => db.collection("weather_workflow_status").doc("wwis-index-sync").set({lastRunAt: FieldValue.serverTimestamp(), state: wwisApproved.value() === "true" ? "ready_for_curated_index" : "blocked_pending_commercial_approval"}, {merge: true}));

export const forecastVerify = onSchedule(scheduled("10 4 * * *", {timeoutSeconds: 540}), async () => {
  const now = Date.now(), histories = await db.collection("weather_forecast_history").limit(200).get(); let evaluated = 0;
  for (const history of histories.docs) {
    const data = history.data(), observations = await db.collection("weather_observations").doc(data.locationId).collection("hours").limit(168).get(); if (observations.empty) continue;
    const observed = new Map(observations.docs.map(doc => [doc.id, doc.data()])), matches = (data.hourly || []).filter(row => Date.parse(row.time) < now && observed.has(row.time)); if (!matches.length) continue;
    const errors = matches.map(row => { const actual = observed.get(row.time)?.temperature; return Number.isFinite(actual) && Number.isFinite(row.temperature) ? Math.abs(actual - row.temperature) : null; }).filter(Number.isFinite);
    await db.collection("weather_verification").doc(history.id).set({provider: data.provider, locationId: data.locationId, sampleCount: matches.length, temperatureSampleCount: errors.length, temperatureMae: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null, temperatureMaxError: errors.length ? Math.max(...errors) : null, state: "partial_observation_backed", evaluatedAt: FieldValue.serverTimestamp()}, {merge: true}); evaluated += 1;
  }
  logger.info("Forecast verification finished", {evaluated, note: "No actual observations means no completed metric"});
});

export const notificationEvaluate = onSchedule(scheduled("every 10 minutes"), async () => {
  const candidates = await db.collection("weather_notification_candidates").where("state", "==", "pending").limit(100).get();
  for (const doc of candidates.docs) {
    const data = doc.data(); if (!data.dedupeKey) continue; const sent = db.collection("weather_notification_dedupe").doc(data.dedupeKey);
    if ((await sent.get()).exists) { await doc.ref.set({state: "duplicate", evaluatedAt: FieldValue.serverTimestamp()}, {merge: true}); continue; }
    await db.runTransaction(async transaction => { transaction.create(sent, {createdAt: FieldValue.serverTimestamp()}); transaction.set(db.collection("weather_notification_outbox").doc(doc.id), {...data, state: "ready", createdAt: FieldValue.serverTimestamp()}); transaction.set(doc.ref, {state: "queued", evaluatedAt: FieldValue.serverTimestamp()}, {merge: true}); });
  }
});

export const staleDataAudit = onSchedule(scheduled("every 30 minutes"), async () => {
  const snapshot = await db.collection("weather_api_cache").limit(500).get(), now = Date.now(), stale = snapshot.docs.filter(doc => now - Number(doc.data().cachedAt || 0) > 3 * 60 * 60_000).map(doc => doc.id);
  await db.collection("weather_workflow_status").doc("stale-data-audit").set({lastRunAt: FieldValue.serverTimestamp(), scanned: snapshot.size, staleCount: stale.length, stale: stale.slice(0, 100)}, {merge: true});
});

export const weatherHealth = onRequest({region: REGION, cors: true, secrets: [kmaApiKey, airKoreaApiKey]}, async (_request, response) => json(response, 200, {ok: true, database: DATABASE_ID, providers: {metNorway: "ready", kma: configured(kmaApiKey.value()) ? "configured" : "missing_secret", airKorea: configured(airKoreaApiKey.value()) ? "configured" : "missing_secret", wwis: wwisApproved.value() === "true" ? "approved" : "approval_required", kimEcmwf: "verification_pipeline_only", weatheri: "commercial_evaluation_only"}, checkedAt: new Date().toISOString()}));
