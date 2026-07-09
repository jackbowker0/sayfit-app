// ============================================================
// BODY WEIGHT SERVICE — Track weight over time
//
// Stores daily weigh-ins, calculates trends, provides
// chart data and stats for the weight tracker screen.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const WEIGHT_KEY = 'sayfit_body_weight';
// Old WeightScreen wrote to this separate key, creating a split-brain where
// weigh-ins landed in one of two disjoint histories. Drained once on load.
const LEGACY_WEIGHT_KEY = 'sayfit_weight_log';

// LOCAL-timezone day key (NOT UTC) — matches protocol.js / nutrition.js so a
// morning weigh-in can't overwrite last night's under a shifted UTC date.
function localDayKey(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- READ / WRITE ----

export async function getWeightEntries() {
  try {
    const raw = await AsyncStorage.getItem(WEIGHT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[BodyWeight] Failed to load:', e);
    return [];
  }
}

/**
 * Save a weight entry
 * Only one entry per day — overwrites if same day exists
 */
export async function saveWeight(weight, date = null) {
  try {
    const entries = await getWeightEntries();
    const entryDate = date || new Date().toISOString();
    const key = localDayKey(entryDate);

    // Check if an entry exists for this LOCAL day (one weigh-in per day).
    const existingIdx = entries.findIndex(e => localDayKey(e.date) === key);

    const entry = {
      id: Date.now().toString(),
      date: entryDate,
      weight: parseFloat(weight),
    };

    if (existingIdx >= 0) {
      entries[existingIdx] = entry;
    } else {
      entries.push(entry);
    }

    // Sort by date
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(entries));
    return entry;
  } catch (e) {
    console.warn('[BodyWeight] Failed to save:', e);
    return null;
  }
}

export async function deleteWeightEntry(entryId) {
  try {
    const entries = await getWeightEntries();
    const filtered = entries.filter(e => e.id !== entryId);
    await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearWeightHistory() {
  await AsyncStorage.setItem(WEIGHT_KEY, '[]');
}

/**
 * One-time merge of the legacy 'sayfit_weight_log' store (written by an older
 * WeightScreen under a different key) into this canonical store. Fixes the
 * split-brain where weigh-ins landed in one of two disjoint histories. Safe to
 * call repeatedly — it removes the legacy key once drained, so it no-ops after.
 * Never deletes canonical data: a legacy entry is skipped if that local day
 * already has a canonical entry.
 */
export async function migrateLegacyWeightLog() {
  try {
    const rawLegacy = await AsyncStorage.getItem(LEGACY_WEIGHT_KEY);
    if (!rawLegacy) return false;

    let legacy = null;
    try { legacy = JSON.parse(rawLegacy); } catch (_) { legacy = null; }
    if (!Array.isArray(legacy) || legacy.length === 0) {
      await AsyncStorage.removeItem(LEGACY_WEIGHT_KEY);
      return false;
    }

    const entries = await getWeightEntries();
    const seenDays = new Set(entries.map(e => localDayKey(e.date)));
    let added = 0;
    for (const e of legacy) {
      if (!e || e.weight == null || !e.date) continue;
      const k = localDayKey(e.date);
      if (seenDays.has(k)) continue; // keep the canonical entry for that day
      entries.push({ id: e.id ? String(e.id) : `legacy-${k}`, date: e.date, weight: parseFloat(e.weight) });
      seenDays.add(k);
      added++;
    }

    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(entries));
    await AsyncStorage.removeItem(LEGACY_WEIGHT_KEY); // drained — won't merge twice
    return added > 0;
  } catch (e) {
    console.warn('[BodyWeight] Legacy migration failed:', e);
    return false;
  }
}

// ---- STATS ----

/**
 * Get weight stats summary
 */
export async function getWeightStats() {
  const entries = await getWeightEntries();

  if (entries.length === 0) {
    return {
      current: null,
      starting: null,
      lowest: null,
      highest: null,
      totalChange: null,
      weekChange: null,
      monthChange: null,
      entries: [],
      entryCount: 0,
    };
  }

  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const current = sorted[sorted.length - 1];
  const starting = sorted[0];

  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);
  const monthAgo = new Date(now - 30 * 86400000);

  // Find closest entry to 7 days ago
  const weekEntry = findClosestEntry(sorted, weekAgo);
  const monthEntry = findClosestEntry(sorted, monthAgo);

  const weights = sorted.map(e => e.weight);

  return {
    current: current.weight,
    currentDate: current.date,
    starting: starting.weight,
    startingDate: starting.date,
    lowest: Math.min(...weights),
    highest: Math.max(...weights),
    totalChange: current.weight - starting.weight,
    weekChange: weekEntry ? current.weight - weekEntry.weight : null,
    monthChange: monthEntry ? current.weight - monthEntry.weight : null,
    entries: sorted,
    entryCount: sorted.length,
  };
}

/**
 * Get chart data — last N entries or last N days
 */
export async function getWeightChartData(limit = 30) {
  const entries = await getWeightEntries();
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

  return sorted.slice(-limit).map(e => ({
    date: e.date,
    label: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: e.weight,
  }));
}

// ---- HELPERS ----

function findClosestEntry(sorted, targetDate) {
  if (sorted.length === 0) return null;

  let closest = null;
  let minDiff = Infinity;

  for (const entry of sorted) {
    const diff = Math.abs(new Date(entry.date) - targetDate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = entry;
    }
  }

  // Only return if within 3 days of target
  if (minDiff > 3 * 86400000) return null;
  return closest;
}