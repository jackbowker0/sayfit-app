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
const usdaFetch = async (path) => {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${USDA_BASE}${path}${sep}api_key=${USDA_KEY}`;
  const first = await timedFetch(url);
  if (first) return first;
  // api.data.gov intermittently 400s a URL it accepts moments later — one
  // cheap retry keeps a flake from dumping search to the weak OFF fallback.
  await new Promise((r) => setTimeout(r, 700));
  return timedFetch(url);
};

// encodeURIComponent leaves ( ) alone; the FDC gateway is picky about them.
const encodeParam = (s) => encodeURIComponent(s).replace(/\(/g, '%28').replace(/\)/g, '%29');

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
    // Foundation/SR Legacy = lab-standardized; FNDDS = USDA survey-computed
    // (restaurant/prepared foods). Both show the "Verified" trust check and
    // rank ahead of crowd-sourced branded data (SR/Foundation highest).
    verified: f.dataType === 'Foundation' || f.dataType === 'SR Legacy' || f.dataType === 'Survey (FNDDS)',
    _tier: (f.dataType === 'Foundation' || f.dataType === 'SR Legacy') ? 10
      : f.dataType === 'Survey (FNDDS)' ? 8 : 0,
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

// Punctuation-blind normalization: "McDONALD'S," and "mcdonalds" must match.
const normText = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
// A word matches if the haystack has it or its singular ("eggs" -> "egg").
const wordIn = (hay, w) => hay.includes(w) || (w.endsWith('s') && hay.includes(w.slice(0, -1)));

function scoreMatch(name, brand, query, tier) {
  const q = normText(query);
  const nameN = normText(name);
  const hay = brand ? `${nameN} ${normText(brand)}` : nameN;
  const words = q.split(' ').filter(Boolean);
  // Data-quality tier: Foundation/SR Legacy (10) > FNDDS survey (8) > branded
  // (0, crowd-sourced). Keeps junk branded data out of the default slot.
  let s = tier || 0;
  if (nameN === q || nameN.startsWith(q + ' ')) s += 4;
  else if (words[0] && nameN.startsWith(words[0])) s += 2;
  // Matching ALL the words the user typed is decisive — "mcdonalds fries"
  // must beat every other McDonald's item, and "quest protein bar" (all
  // words, branded) must beat a generic that only matches "protein bar".
  // The bonus outweighs the tier gap on purpose; plural-aware wordIn means
  // a generic that truly matches ("eggs"->"egg") gets it too and its tier
  // still decides against exact-named branded junk.
  const hits = words.filter((w) => wordIn(hay, w)).length;
  s += (words.length && hits === words.length) ? 14 : hits;
  s -= nameN.length / 60;                                   // gentle concise-name tiebreak
  if (VARIANT.test(nameN) && !VARIANT.test(q)) s -= 3;      // don't default to a variant
  if (/\b(whole|raw)\b/.test(nameN)) s += 0.6;             // prefer the plain base form
  return s;
}

async function searchUSDA(query, limit) {
  // TWO queries, generic and branded separately. A single mixed query lets
  // exact-named branded products fill the whole page ("ground beef" returned
  // 25/25 Branded — the accurate generic entries never reached the scorer).
  const url = (types, size) =>
    `/foods/search?query=${encodeURIComponent(query)}&pageSize=${size}&dataType=${encodeParam(types)}`;
  const [gen, brand] = await Promise.all([
    usdaFetch(url('Foundation,SR Legacy,Survey (FNDDS)', Math.max(10, Math.ceil(limit / 2)))),
    usdaFetch(url('Branded', limit)),
  ]);
  if (!gen && !brand) return null; // source unavailable (distinct from "no matches")
  const foods = [...(gen?.foods || []), ...(brand?.foods || [])].map(normalizeUSDA).filter(Boolean);
  // Rank by match score so the accurate, plain, generic food is the default.
  return foods
    .map((f, i) => ({ f, i, score: scoreMatch(f.name, f.brand, query, f._tier) }))
    .sort((a, b) => (b.score - a.score) || (a.i - b.i))
    .slice(0, limit)
    .map(({ f }) => { const { _tier, ...rest } = f; return rest; });
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
  // Standard weight units always available (MFP-style unit switching).
  push('1 oz', 28.35);
  push('100 g', 100);
  return portions.slice(0, 10);
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

/** Wipe the recent-foods list (user-initiated from the search sheet). */
export async function clearRecentFoods() {
  await AsyncStorage.setItem(RECENTS_KEY, '[]');
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
