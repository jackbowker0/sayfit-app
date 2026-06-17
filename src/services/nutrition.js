// ============================================================
// NUTRITION SERVICE — Track meals & macros over time
//
// Local-first (AsyncStorage), mirroring bodyWeight.js. Stores
// per-meal entries with macros + an editState so AI photo
// estimates don't count toward daily totals until the user
// confirms them (UX honesty — see TASKS T9).
//
// NAMING: "kcal" = calories CONSUMED. The rest of the app uses
// "calories" for calories BURNED (workouts, feed posts, the
// calorie_burn challenge). Keep the two strictly distinct.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const NUTRITION_KEY = 'sayfit_nutrition_log';

// Meal types, ordered for display.
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

// editState lifecycle: 'ai_estimated' -> 'user_edited' -> 'confirmed'.
// Only counted states contribute to daily totals; a raw 'ai_estimated'
// photo guess does NOT, so an un-reviewed estimate can't silently skew
// the "am I winning?" numbers.
const COUNTED_STATES = ['confirmed', 'user_edited', 'manual'];

const EMPTY_MACROS = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

function sanitizeMacros(m = {}) {
  // Macros are non-negative; kcal is an integer (calories consumed).
  const n = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };
  return { kcal: Math.round(n(m.kcal)), protein: n(m.protein), carbs: n(m.carbs), fat: n(m.fat) };
}

function dayKey(dateIso) {
  return new Date(dateIso).toISOString().split('T')[0]; // YYYY-MM-DD
}

function counts(entry) {
  return COUNTED_STATES.includes(entry.editState);
}

function sumMacros(entries) {
  return entries.reduce((acc, e) => ({
    kcal: acc.kcal + (e.macros?.kcal || 0),
    protein: acc.protein + (e.macros?.protein || 0),
    carbs: acc.carbs + (e.macros?.carbs || 0),
    fat: acc.fat + (e.macros?.fat || 0),
  }), { ...EMPTY_MACROS });
}

// ---- READ / WRITE ----

export async function getNutritionEntries() {
  try {
    const raw = await AsyncStorage.getItem(NUTRITION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[Nutrition] Failed to load:', e);
    return [];
  }
}

/**
 * Log a meal. Multiple meals per day are allowed (unlike a daily weigh-in).
 * 'manual' source defaults to editState 'confirmed'; 'photo'/'voice' default
 * to 'ai_estimated' (won't count toward totals until reviewed).
 */
export async function logMeal({
  mealType = 'snack', source = 'manual', photoUri = null,
  items = [], macros = {}, confidence = null, editState = null, date = null,
} = {}) {
  try {
    const entries = await getNutritionEntries();
    const entry = {
      id: Date.now().toString(),
      date: date || new Date().toISOString(),
      mealType: MEAL_TYPES.includes(mealType) ? mealType : 'snack',
      source,
      photoUri,
      items: Array.isArray(items) ? items : [],
      macros: sanitizeMacros(macros),
      confidence: typeof confidence === 'number' ? confidence : null,
      editState: editState || (source === 'manual' ? 'confirmed' : 'ai_estimated'),
    };
    entries.push(entry);
    await AsyncStorage.setItem(NUTRITION_KEY, JSON.stringify(entries));
    return entry;
  } catch (e) {
    console.warn('[Nutrition] Failed to save:', e);
    return null;
  }
}

/**
 * Update an entry (e.g. the user corrects AI-estimated macros). Editing a raw
 * AI estimate promotes it to 'user_edited' so it starts counting.
 */
export async function updateMeal(entryId, updates = {}) {
  try {
    const entries = await getNutritionEntries();
    const idx = entries.findIndex(e => e.id === entryId);
    if (idx < 0) return null;
    const prev = entries[idx];
    const next = {
      ...prev,
      ...updates,
      macros: updates.macros ? sanitizeMacros(updates.macros) : prev.macros,
    };
    if (prev.editState === 'ai_estimated' && !updates.editState) {
      next.editState = 'user_edited';
    }
    entries[idx] = next;
    await AsyncStorage.setItem(NUTRITION_KEY, JSON.stringify(entries));
    return next;
  } catch (e) {
    console.warn('[Nutrition] Failed to update:', e);
    return null;
  }
}

/** Mark an entry confirmed so it counts toward daily totals. */
export async function confirmMeal(entryId) {
  return updateMeal(entryId, { editState: 'confirmed' });
}

export async function deleteMeal(entryId) {
  try {
    const entries = await getNutritionEntries();
    const filtered = entries.filter(e => e.id !== entryId);
    await AsyncStorage.setItem(NUTRITION_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearNutritionLog() {
  await AsyncStorage.setItem(NUTRITION_KEY, '[]');
}

// ---- AGGREGATION ----

/**
 * Totals for a single day (defaults to today). Only counted entries
 * (confirmed/user_edited/manual) contribute; un-reviewed 'ai_estimated'
 * guesses are surfaced as `pendingCount` so the UI can prompt to confirm.
 */
export async function getDailyTotals(date = null) {
  const entries = await getNutritionEntries();
  const key = dayKey(date || new Date().toISOString());
  const ofDay = entries.filter(e => dayKey(e.date) === key);
  const counted = ofDay.filter(counts);
  return {
    date: key,
    totals: sumMacros(counted),
    mealCount: counted.length,
    pendingCount: ofDay.length - counted.length,
    entries: ofDay.sort((a, b) => new Date(a.date) - new Date(b.date)),
  };
}

/**
 * Today's macros vs the user's targets — feeds the dashboard "am I winning?"
 * card. Pass targets from the profile (userProfile.getMacroTargets).
 */
export async function getNutritionStats(targets = null) {
  const today = await getDailyTotals();
  const t = targets || {};
  const remaining = (target, consumed) =>
    typeof target === 'number' && target > 0 ? Math.max(0, Math.round(target - consumed)) : null;
  return {
    date: today.date,
    totals: today.totals,
    targets: t,
    remaining: {
      kcal: remaining(t.kcal, today.totals.kcal),
      protein: remaining(t.protein, today.totals.protein),
      carbs: remaining(t.carbs, today.totals.carbs),
      fat: remaining(t.fat, today.totals.fat),
    },
    mealCount: today.mealCount,
    pendingCount: today.pendingCount,
  };
}

/** Daily kcal/protein/carbs/fat chart data over the last N days (counted only). */
export async function getMacroChartData(limit = 30) {
  const entries = await getNutritionEntries();
  const byDay = {};
  for (const e of entries) {
    if (!counts(e)) continue;
    const key = dayKey(e.date);
    if (!byDay[key]) byDay[key] = { ...EMPTY_MACROS };
    byDay[key].kcal += e.macros?.kcal || 0;
    byDay[key].protein += e.macros?.protein || 0;
    byDay[key].carbs += e.macros?.carbs || 0;
    byDay[key].fat += e.macros?.fat || 0;
  }
  return Object.keys(byDay).sort().slice(-limit).map(key => ({
    date: key,
    label: new Date(key + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ...byDay[key],
  }));
}
