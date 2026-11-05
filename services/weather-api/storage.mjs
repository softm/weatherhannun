import {FieldValue} from "firebase-admin/firestore";
import {dfsGrid, hashPayload, isSouthKorea, roundedLocationKey} from "./core.mjs";

export const locationDocumentId = location => {
  if (location.id) return location.id;
  if (isSouthKorea(location)) {
    const {nx, ny} = dfsGrid(location.lat, location.lon);
    return `kr_${nx}_${ny}`;
  }
  return `global_${roundedLocationKey(location)}`;
};
export async function readFreshOrLastGood(db, location, maxAgeMs) {
  const ref = db.collection("weather_api_cache").doc(locationDocumentId(location)); const snapshot = await ref.get(); const data = snapshot.data();
  if (!data?.payload) return {ref, fresh: null, lastGood: null}; const age = Date.now() - Number(data.cachedAt || 0);
  return {ref, fresh: age >= 0 && age <= maxAgeMs ? data.payload : null, lastGood: data.payload, metadata: data};
}
export async function writeIfChanged(ref, payload, metadata = {}) {
  const hash = hashPayload(payload); const previous = await ref.get();
  if (previous.data()?.hash === hash) { await ref.set({lastCheckedAt: Date.now(), lastCheckedServerAt: FieldValue.serverTimestamp()}, {merge: true}); return {changed: false, hash}; }
  await ref.set({payload, hash, cachedAt: Date.now(), lastCheckedAt: Date.now(), updatedAt: FieldValue.serverTimestamp(), ...metadata}, {merge: true}); return {changed: true, hash};
}
export async function saveForecastHistory(db, location, payload) {
  if (!payload?.source?.issuedAt || !payload.hourly?.length) return; const locationId = locationDocumentId(location);
  const issueId = `${payload.source.provider}_${payload.source.issuedAt}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  await db.collection("weather_forecast_history").doc(`${locationId}_${issueId}`).set({locationId, location, provider: payload.source.provider, issuedAt: payload.source.issuedAt, hourly: payload.hourly.slice(0, 72), createdAt: FieldValue.serverTimestamp()}, {merge: true});
}
