// ============================================================
// FOOD DATABASE — typed search + barcode lookup
// ------------------------------------------------------------
// Two sources, each used where it's strong:
//   • USDA FoodData Central (api.nal.usda.gov) — the PRIMARY text
//     search. US government, public domain, English-only, and it
//     knows generic whole foods ("Beef, ground, 80% lean, raw",
//     "Chicken, breast, boneless, skinless") plus ~1.5M US branded
//     items. This is what makes typing "beef" return real options
//     instead of French bouillon cubes.
//   • Open Food Facts (world.openfoodfacts.org) — PRIMARY for
//     barcodes (its coverage of scanned packaged goods is huge),
//     with USDA branded as a fallback. It's a poor TEXT search
//     (global, weak relevance), so it's only a fallback there.
//
// USDA needs a free API key. DEMO_KEY works but is throttled to ~30
// requests/hour per IP — get a real key (instant, free) at
// https://fdc.nal.usda.gov/api-key-signup.html and put it in .env as
// EXPO_PUBLIC_USDA_KEY. Without it, search falls back to OFF.
//
// Macros are normalized per-100g plus a portion helper. LICENSING:
// USDA is public domain (no attribution required); OFF is ODbL
// (attribute "Open Food Facts" where OFF results/barcodes show).
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeReadArray, safeWriteArray } from './safeStore';

// ---- SOURCES ----
const OFF_BASE = 'https://world.openfoodfacts.org';
const OFF_UA = 'SayFit/1.0 (fitness app; contact via app store listing)';
const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity,lang,countries_tags';

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const USDA_KEY = process.env.EXPO_PUBLIC_USDA_KEY || 'DEMO_KEY';

const BARCODE_CACHE_KEY = 'sayfit_food_barcode_cache';
const RECENTS_KEY = 'sayfit_food_recents';
const RECENTS_MAX = 40;

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// A US/English-preferring country filter for OFF fallback results.
const EN_COUNTRY = /united-states|united-kingdom|canada|australia|ireland|new-zealand/;

// ---- FETCH ----

async function timedFetch(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[foodDb] fetch failed:', e?.message || e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const offFetch = (url) => timedFetch(url, { headers: { 'User-Agent': OFF_UA } });
const usdaFetch = (path) => {
  const sep = path.includes('?') ? '&' : '?';
  return timedFetch(`${USDA_BASE}${path}${sep}api_key=${USDA_KEY}`);
};

/** True when a USDA key is configured (not the throttled shared demo key). */
export function hasUsdaKey() {
  return !!process.env.EXPO_PUBLIC_USDA_KEY;
}

// ---- NORMALIZE ----

// Uppercase branded names ("BEEF") read as shouting — title-case those; leave
// USDA's nicely-formatted generic descriptions ("Beef, ground, ...") alone.
const deShout = (s) =>
  s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s;

// Open Food Facts product -> our shape. null if it has no usable kcal.
export function normalizeProduct(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  const kcal = Number(n['energy-kcal_100g']);
  if (!Number.isFinite(kcal) || kcal <= 0) return null;
  const servingGrams = Number(p.serving_quantity);
  return {
    id: p.code || null,
    name: (p.product_name || '').trim() || 'Unnamed food',
    brand: (p.brands || '').split(',')[0].trim() || null,
    per100g: {
      kcal: Math.round(kcal),
      protein: round1(n.proteins_100g),
      carbs: round1(n.carbohydrates_100g),
      fat: round1(n.fat_100g),
    },
    servingGrams: Number.isFinite(servingGrams) && servingGrams > 0 ? servingGrams : null,
    servingLabel: (p.serving_size || '').trim() || null,
    source: 'off',
  };
}

function usdaEnergyKcal(nutrients) {
  const kcal = nutrients.find((n) => /^energy/i.test(n.nutrientName || '') && (n.unitName || '').toUpperCase() === 'KCAL');
  if (kcal && Number(kcal.value) > 0) return Math.round(Number(kcal.value));
  const kj = nutrients.find((n) => /^energy/i.test(n.nutrientName || '') && (n.unitName || '').toUpperCase() === 'KJ');
  if (kj && Number(kj.value) > 0) return Math.round(Number(kj.value) / 4.184);
  return null;
}

// USDA FoodData Central food -> our shape (per 100g). null if no usable kcal.
export function normalizeUSDA(f) {
  if (!f) return null;
  const nutrients = f.foodNutrients || [];
  const kcal = usdaEnergyKcal(nutrients);
  if (!kcal) return null;
  const macro = (re) => { const n = nutrients.find((x) => re.test(x.nutrientName || '')); return round1(n?.value); };
  const unit = (f.servingSizeUnit || '').toLowerCase();
  return {
    id: `usda-${f.fdcId}`,
    name: deShout((f.description || '').trim()) || 'Unnamed food',
    brand: (f.brandName || f.brandOwner || '').trim() || null,
    per100g: {
      kcal,
      protein: macro(/^protein/i),
      carbs: macro(/^carbohydrate, by difference/i),
      fat: macro(/^total lipid \(fat\)/i),
    },
    servingGrams: (unit === 'g' || unit === 'ml') && Number(f.servingSize) > 0 ? Number(f.servingSize) : null,
    servingLabel: (f.householdServingFullText || '').trim()
      || (f.servingSize ? `${f.servingSize} ${f.servingSizeUnit || ''}`.trim() : null),
    source: 'usda',
    // Foundation/SR Legacy = lab-standardized data. Shown as "Verified" in the
    // UI (the MFP-checkmark trust signal) and ranked ahead of branded.
    verified: f.dataType === 'Foundation' || f.dataType === 'SR Legacy',
  };
}

/** Macros for a portion in grams. Pure math — grams/100 * per-100g values. */
export function macrosForPortion(food, grams) {
  const f = (Number(grams) || 0) / 100;
  const p = food?.per100g || {};
  return {
    kcal: Math.round((p.kcal || 0) * f),
    protein: round1((p.protein || 0) * f),
    carbs: round1((p.carbs || 0) * f),
    fat: round1((p.fat || 0) * f),
  };
}

// ---- SEARCH ----

// Qualifier words that usually mean "not the plain food I searched for". A
// branded entry literally named "Egg" is often dried/powdered junk data with a
// wildly wrong per-100g value — this + the generic boost keep those out of the
// default slot (they inflate calories 3-4x, the source of bogus totals).
const VARIANT = /(white|substitute|powder|dried|dehydrated|imitation|infant|baby food|concentrate|drink mix|non-?dairy|meatless)/i;

function scoreMatch(nameLower, query, generic) {
  const q = (query || '').toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);
  // Generic (USDA Foundation/SR Legacy) has accurate, standardized per-100g
  // data; branded is crowd-sourced and unreliable for generic terms. So generic
  // dominates whenever it exists (brand-name searches have no generic match, so
  // branded still surfaces there).
  let s = generic ? 10 : 0;
  if (nameLower === q || nameLower.startsWith(q + ',') || nameLower.startsWith(q + ' ')) s += 4;
  else if (words[0] && nameLower.startsWith(words[0])) s += 2;
  if (words.length && words.every((w) => nameLower.includes(w))) s += 1;
  s -= nameLower.length / 40;                                   // concise beats qualifier-laden
  if (VARIANT.test(nameLower) && !VARIANT.test(q)) s -= 3;      // don't default to a variant
  if (/\b(whole|raw)\b/.test(nameLower)) s += 0.6;             // prefer the plain base form
  return s;
}

async function searchUSDA(query, limit) {
  const data = await usdaFetch(
    `/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}`
    + `&dataType=${encodeURIComponent('Foundation,SR Legacy,Branded')}`,
  );
  if (!data) return null; // null = source unavailable (distinct from "no matches")
  const foods = (data.foods || []).map(normalizeUSDA).filter(Boolean);
  // Rank by match score so the accurate, plain, generic food is the default.
  return foods
    .map((f, i) => ({ f, i, score: scoreMatch(f.name.toLowerCase(), query, f.verified) }))
    .sort((a, b) => (b.score - a.score) || (a.i - b.i))
    .map(({ f }) => f);
}

async function searchOFF(query, limit) {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}`
    + `&search_simple=1&action=process&json=1&page_size=${limit}&fields=${OFF_FIELDS}`;
  const data = await offFetch(url);
  const products = data?.products || [];
  // Prefer English / US-market entries so we don't surface non-English results.
  const preferred = products.filter(
    (p) => p.lang === 'en' || (Array.isArray(p.countries_tags) && p.countries_tags.some((c) => EN_COUNTRY.test(c))),
  );
  return (preferred.length ? preferred : products).map(normalizeProduct).filter(Boolean);
}

/**
 * Text search. USDA-first (English, generic-food-aware); falls back to Open
 * Food Facts only if USDA is unavailable (no key / throttled / offline).
 * Returns [] on total failure so the caller can fall back to manual entry.
 */
export async function searchFoods(query, { limit = 25 } = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const usda = await searchUSDA(q, limit);
  if (usda && usda.length > 0) return usda;
  return searchOFF(q, limit);
}

/**
 * Barcode lookup. Cache -> Open Food Facts -> USDA branded fallback.
 * Returns a normalized food or null (unknown / offline).
 */
export async function lookupBarcode(code) {
  const barcode = String(code || '').trim();
  if (!barcode) return null;

  const cached = await getCachedBarcode(barcode);
  if (cached) return cached;

  const data = await offFetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`);
  let food = data && data.status === 1 ? normalizeProduct(data.product) : null;

  if (!food) {
    // USDA branded is keyed by gtinUpc — a plain query match finds it.
    const u = await usdaFetch(`/foods/search?query=${encodeURIComponent(barcode)}&pageSize=1&dataType=Branded`);
    food = (u?.foods || []).map(normalizeUSDA).filter(Boolean)[0] || null;
  }

  if (food) await cacheBarcode(barcode, food);
  return food;
}

// ---- PORTIONS (household measures for the portion picker) ----

/**
 * Household serving options for a food — "1 large (50g)", "1 cup, chopped
 * (135g)" — the thing that makes MFP's search feel certain. USDA generic
 * foods carry real lab-weighed measures on the detail endpoint (1 extra
 * call, made only when a food is picked). Always ends with "100 g".
 * Returns [{ label, grams }].
 */
export async function getFoodPortions(food) {
  const portions = [];
  const seen = new Set();
  const push = (label, grams) => {
    const g = Math.round(Number(grams));
    const l = (label || '').trim();
    if (!l || !Number.isFinite(g) || g <= 0 || g > 5000) return;
    const key = l.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    portions.push({ label: l, grams: g });
  };

  if (food?.source === 'usda' && /^usda-\d+$/.test(food.id || '')) {
    // Full detail only — the trimmed variants of this endpoint drop portions.
    const data = await usdaFetch(`/food/${food.id.slice(5)}`);
    for (const p of data?.foodPortions || []) {
      const unit = p.measureUnit?.name && p.measureUnit.name !== 'undetermined' ? p.measureUnit.name : '';
      let label = (p.portionDescription && !/quantity not specified/i.test(p.portionDescription))
        ? p.portionDescription
        : [p.amount, unit, p.modifier].filter(Boolean).join(' ');
      label = label.replace(/NLEA serving/i, 'standard serving');
      push(label, p.gramWeight);
    }
    if (data?.householdServingFullText) {
      const unit = (data.servingSizeUnit || '').toLowerCase();
      if ((unit === 'g' || unit === 'ml') && Number(data.servingSize) > 0) {
        push(data.householdServingFullText, data.servingSize);
      }
    }
  }
  if (food?.servingGrams) push(food.servingLabel || '1 serving', food.servingGrams);
  push('100 g', 100);
  return portions.slice(0, 8);
}

// ---- CACHE (barcode -> food) ----

async function getCachedBarcode(barcode) {
  try {
    const raw = await AsyncStorage.getItem(BARCODE_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map && typeof map === 'object' ? map[barcode] || null : null;
  } catch (_) {
    return null; // a corrupt cache is harmless — just re-fetch
  }
}

async function cacheBarcode(barcode, food) {
  try {
    const raw = await AsyncStorage.getItem(BARCODE_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const safe = map && typeof map === 'object' ? map : {};
    safe[barcode] = food;
    await AsyncStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify(safe));
  } catch (e) {
    console.warn('[foodDb] barcode cache write failed:', e);
  }
}

// ---- RECENTS (fast re-logging) ----

export async function getRecentFoods() {
  return safeReadArray(RECENTS_KEY);
}

export async function addRecentFood(food) {
  if (!food || !food.id) return;
  const recents = await getRecentFoods();
  const deduped = [food, ...recents.filter((f) => f.id !== food.id)].slice(0, RECENTS_MAX);
  await safeWriteArray(RECENTS_KEY, deduped);
}

// ---- VOICE / PARSED-ITEM RESOLUTION ----

/**
 * Resolve parsed items ([{ query, grams }]) to real foods + macros.
 * Each -> { query, grams, food|null, macros|null }. Runs the lookups
 * concurrently. An item with no DB match keeps food: null so the UI can
 * show it as unmatched (drop it or log it manually).
 */
export async function resolveFoodItems(items) {
  const list = Array.isArray(items) ? items : [];
  return Promise.all(list.map(async (it) => {
    // Fetch a REAL candidate pool — with limit 1 the API returns only its own
    // top hit (often a junk branded entry) and scoreMatch has nothing to
    // re-rank, which is how "3 eggs" once matched a 513 kcal/100g "Egg".
    const results = await searchFoods(it.query, { limit: 20 });
    const food = results[0] || null;
    return {
      query: it.query,
      grams: it.grams,
      food,
      macros: food ? macrosForPortion(food, it.grams) : null,
    };
  }));
}
