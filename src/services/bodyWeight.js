// ============================================================
// BODY WEIGHT SERVICE — Track weight over time
//
// Stores daily weigh-ins, calculates trends, provides
// chart data and stats for the weight tracker screen.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const WEIGHT_KEY = 'sayfit_body_weight';

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
    const dayKey = new Date(entryDate).toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if entry exists for this day
    const existingIdx = entries.findIndex(e =>
      new Date(e.date).toISOString().split('T')[0] === dayKey
    );

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