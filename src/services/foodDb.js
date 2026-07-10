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

// Prepared/derivative FORMS — a different food than the plain base someone
// searched. Penalized hard when in the entry name but not the query, so
// "Flour, rice" loses to rice, "Salmon salad"/"Fish oil" lose to salmon,
// "Egg, dried, powder" (junk per-100g data) loses to the whole egg.
const DERIVATIVE = /\b(flour|salad|soup|sauce|gravy|juice|oil|dip|spread|snacks?|dessert|pudding|smoothie|shake|crackers?|chips?|cakes?|pie|rolls?|sandwich|wrap|casserole|patties|patty|nuggets?|sticks?|bites?|loaf|jerky|dressing|seasoning|marinade|breaded|creamed|babyfood|baby|infant|lemonade|punch|powder|powdered|dried|dehydrated|substitute|imitation|concentrate|meatless|non-?dairy)\b/i;
// Words that DON'T change food identity — "free", don't count as an extra
// variant. (Identity words like whole/white/lean are deliberately excluded.)
const DESCRIPTOR = new Set(('raw cooked fresh frozen fluid plain regular ns nfs nsa unspecified '
  + 'added vitamin a d with without includes boneless skinless lowfat low nonfat non reduced fat '
  + 'free content grade large medium small and or the all style type prepared drained solids each '
  + 'unenriched enriched of as to no in from').split(' '));
// USDA taxonomic category prefixes — the leading token is a shelf category,
// not an extra ingredient, so "Fish, salmon" still matches "salmon" cleanly.
const CATEGORY = new Set(('fish beef pork veal lamb poultry chicken turkey cheese cereals '
  + 'beverages nuts seeds crustaceans mollusks fruit vegetables').split(' '));

// Punctuation-blind normalization: "McDONALD'S," and "mcdonalds" must match.
const normText = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
// A word matches if the haystack has it or its singular ("eggs" -> "egg").
const wordIn = (hay, w) => hay.includes(w) || (w.endsWith('s') && hay.includes(w.slice(0, -1)));

// Rank a candidate against the query. Tuned offline against real USDA results
// for ~24 common foods (rice, milk, eggs, beef, salmon, brand names, ...);
// see scratchpad/test-scorer.js. Higher = better.
function scoreMatch(name, brand, query, tier) {
  const q = normText(query);
  const nameN = normText(name);
  const brandN = normText(brand);
  const words = q.split(' ').filter(Boolean);
  const qSet = new Set(words.flatMap((w) => (w.endsWith('s') ? [w, w.slice(0, -1)] : [w])));
  // Data-quality tier: Foundation/SR Legacy (10) > FNDDS survey (8) > branded
  // (0, crowd-sourced). Keeps junk branded data out of the default slot.
  let s = tier || 0;

  if (nameN === q || nameN.startsWith(q + ' ')) s += 4;
  else if (words[0] && nameN.startsWith(words[0])) s += 2;

  // Match strength: all words in the NAME (strong) beats all words only via
  // the BRAND (weaker) beats partial. "coca cola" -> the Coke product (name)
  // over Minute Maid Lemonade [The Coca-Cola company] (brand-only match).
  const nameHits = words.filter((w) => wordIn(nameN, w)).length;
  const fullHits = words.filter((w) => wordIn(`${nameN} ${brandN}`, w)).length;
  if (words.length && nameHits === words.length) s += 14;
  else if (words.length && fullHits === words.length) s += 7;
  else s += fullHits;

  // Head-noun: USDA files the base food first ("Milk, whole"; "Rice, white").
  const headNoun = words[words.length - 1];
  const firstTok = nameN.split(' ')[0];
  if (headNoun && firstTok && wordIn(firstTok, headNoun)) s += 3;

  // Coverage: reward entries that are ONLY about what was searched. A name word
  // that isn't in the query, isn't a plain descriptor, and isn't the leading
  // USDA category is an "extra" — a variant the user didn't ask for. This is
  // what makes "Milk, whole" beat "Milk, buttermilk" and "Beans and brown rice".
  const toks = nameN.split(' ');
  const extras = toks.filter(
    (w, i) => w.length > 1 && !qSet.has(w) && !DESCRIPTOR.has(w) && !/^\d/.test(w)
      && !(i === 0 && CATEGORY.has(w)),
  ).length;
  s -= extras * 1.5;
  if (extras === 0 && words.length && nameHits === words.length) s += 4; // clean match
  if (/\b(whole|raw)\b/.test(nameN)) s += 0.8;                           // plain base form

  s -= nameN.length / 120;
  if (DERIVATIVE.test(nameN) && !DERIVATIVE.test(q)) s -= 8;
  return s;
}

async function searchUSDA(query, limit) {
  // TWO queries, generic and branded separately. A single mixed query lets
  // exact-named branded products fill the whole page ("ground beef" returned
  // 25/25 Branded — the accurate generic entries never reached the scorer).
  const url = (types, size) =>
    `/foods/search?query=${encodeURIComponent(query)}&pageSize=${size}&dataType=${encodeParam(types)}`;
  const [gen, brand] = await Promise.all([
    // Full page of generic candidates — the accurate plain foods ("Rice,
    // brown, cooked") are sometimes ranked below flour/snack forms by USDA's
    // own relevance, so a small page can miss them entirely.
    usdaFetch(url('Foundation,SR Legacy,Survey (FNDDS)', limit)),
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

// Compare two barcodes ignoring leading zeros (UPC-A 12-digit vs EAN-13
// 13-digit are the same product with a leading 0).
const upcEq = (a, b) => String(a).replace(/^0+/, '') === String(b).replace(/^0+/, '');

async function lookupOFF(barcode) {
  const data = await offFetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`);
  return data && data.status === 1 ? normalizeProduct(data.product) : null;
}

async function lookupUSDAByUPC(barcode) {
  // USDA branded items carry a gtinUpc. A plain query surfaces candidates but
  // returns noise too — we must CONFIRM the code matches, else we'd log a
  // random product for an unknown barcode.
  const data = await usdaFetch(`/foods/search?query=${encodeURIComponent(barcode)}&pageSize=10&dataType=Branded`);
  const hit = (data?.foods || []).find((f) => f.gtinUpc && upcEq(f.gtinUpc, barcode));
  return hit ? normalizeUSDA(hit) : null;
}

/**
 * Barcode lookup. Cache first, then Open Food Facts (purpose-built for
 * barcodes, usually carries a serving size) and USDA branded (matched on
 * gtinUpc) in PARALLEL — prefer OFF when it has usable data, fall to USDA for
 * items OFF is missing. Returns a normalized food or null (unknown / offline).
 */
export async function lookupBarcode(code) {
  const barcode = String(code || '').replace(/\D/g, ''); // scanners can include control chars
  if (!barcode) return null;

  const cached = await getCachedBarcode(barcode);
  if (cached) return cached;

  const [off, usda] = await Promise.all([
    lookupOFF(barcode).catch(() => null),
    lookupUSDAByUPC(barcode).catch(() => null),
  ]);
  const food = off || usda;
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
