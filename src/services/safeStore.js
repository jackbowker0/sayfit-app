// ============================================================
// SAFE STORE — corruption-resistant array persistence
// ------------------------------------------------------------
// Every local store used to do `JSON.parse(raw)` and return [] on
// failure — and the next append would then write that empty array
// back, turning one corrupt blob into PERMANENT erasure of the log.
//
// safeReadArray QUARANTINES a corrupt/non-array blob (copies it to
// `<key>__corrupt__<ts>`, which still starts with `sayfit_` so it
// rides along in the data export) instead of throwing it away, then
// returns []. If it can't even preserve the blob, it marks the key
// "poisoned" and safeWriteArray REFUSES to overwrite it — so nothing
// unrecoverable is ever silently destroyed.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys whose last read failed AND could not be preserved. Writes to these are
// refused until a clean read succeeds, so we never clobber unrecoverable data.
const poisoned = new Set();

async function quarantine(key, raw) {
  try {
    await AsyncStorage.setItem(`${key}__corrupt__${Date.now()}`, raw);
    poisoned.delete(key); // preserved elsewhere — safe to let writes replace it
    console.warn(`[safeStore] ${key} was corrupt; quarantined a copy before it could be overwritten.`);
  } catch (e) {
    poisoned.add(key); // couldn't preserve it — guard the key against overwrite
    console.warn(`[safeStore] ${key} corrupt AND un-preservable; write-guarding it.`, e);
  }
}

/**
 * Read an array-valued key. Returns [] for a missing key. On a corrupt or
 * non-array value, preserves the raw blob and returns [] (never throws).
 */
export async function safeReadArray(key) {
  let raw;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (e) {
    poisoned.add(key); // read itself failed — don't let a blind write follow
    console.warn(`[safeStore] read failed for ${key}:`, e);
    return [];
  }
  if (raw == null) { poisoned.delete(key); return []; }

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { await quarantine(key, raw); return []; }

  if (!Array.isArray(parsed)) { await quarantine(key, raw); return []; }

  poisoned.delete(key);
  return parsed;
}

/**
 * Write an array-valued key. Refuses (returns false) if the key is poisoned —
 * i.e. its last read failed and its data could not be preserved — so a corrupt
 * store is never overwritten with fresh data before it's been salvaged.
 */
export async function safeWriteArray(key, arr) {
  if (poisoned.has(key)) {
    console.warn(`[safeStore] refusing to overwrite ${key} — last read failed and data is unpreserved.`);
    return false;
  }
  try {
    await AsyncStorage.setItem(key, JSON.stringify(arr));
    return true;
  } catch (e) {
    console.warn(`[safeStore] write failed for ${key}:`, e);
    return false;
  }
}
