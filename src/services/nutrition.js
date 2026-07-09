// ============================================================
// NUTRITION SERVICE — Track meals & macros over time
//
// Local-first (AsyncStorage), mirroring bodyWeight.js. Stores
// per-meal entries with macros. Every logged entry counts —
// all logging flows (voice review, portion picker, manual form)
// have their own review step, so a separate confirm would be
// double-confirmation. editState survives as provenance metadata.
//
// NAMING: "kcal" = calories CONSUMED. The rest of the app uses
// "calories" for calories BURNED (workouts, feed posts, the
// calorie_burn challenge). Keep the two strictly distinct.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeReadArray, safeWriteArray } from './safeStore';

const NUTRITION_KEY = 'sayfit_nutrition_log';

// Meal types, ordered for display.
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const EMPTY_MACROS = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

function sanitizeMacros(m = {}) {
  // Macros are non-negative; kcal is an integer (calories consumed).
  const n = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };
  return { kcal: Math.round(n(m.kcal)), protein: n(m.protein), carbs: n(m.carbs), fat: n(m.fat) };
}

function dayKey(dateIso) {
  // LOCAL-timezone day key (NOT UTC) — matches protocol.js so an evening meal
  // isn't tagged tomorrow and daily totals reset at LOCAL midnight, not UTC.
  const d = dateIso ? new Date(dateIso) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
  // Quarantines a corrupt blob instead of returning [] into the next write.
  return safeReadArray(NUTRITION_KEY);
}

/**
 * Log a meal. Multiple meals per day are allowed (unlike a daily weigh-in).
 * Logged means counted — no separate confirm step.
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
      editState: editState || 'confirmed',
    };
    entries.push(entry);
    await safeWriteArray(NUTRITION_KEY, entries);
    return entry;
  } catch (e) {
    console.warn('[Nutrition] Failed to save:', e);
    return null;
  }
}

/** Update an entry (e.g. the user corrects AI-estimated macros). */
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
    entries[idx] = next;
    await safeWriteArray(NUTRITION_KEY, entries);
    return next;
  } catch (e) {
    console.warn('[Nutrition] Failed to update:', e);
    return null;
  }
}

export async function deleteMeal(entryId) {
  try {
    const entries = await getNutritionEntries();
    const filtered = entries.filter(e => e.id !== entryId);
    await safeWriteArray(NUTRITION_KEY, filtered);
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearNutritionLog() {
  await AsyncStorage.setItem(NUTRITION_KEY, '[]');
}

// ---- AGGREGATION ----

/** Totals for a single day (defaults to today). Every entry counts. */
export async function getDailyTotals(date = null) {
  const entries = await getNutritionEntries();
  const key = dayKey(date || new Date().toISOString());
  const ofDay = entries.filter(e => dayKey(e.date) === key);
  return {
    date: key,
    totals: sumMacros(ofDay),
    mealCount: ofDay.length,
    pendingCount: 0, // legacy field — the confirm step no longer exists
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

/** Daily kcal/protein/carbs/fat chart data over the last N days. */
export async function getMacroChartData(limit = 30) {
  const entries = await getNutritionEntries();
  const byDay = {};
  for (const e of entries) {
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
