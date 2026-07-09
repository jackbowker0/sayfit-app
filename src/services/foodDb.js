// ============================================================
// FOOD DATABASE — search + barcode lookup (Open Food Facts)
// ------------------------------------------------------------
// The Fuel pillar was manual number entry only. This is the base
// layer that makes it a real food tracker: text search + barcode
// lookup against Open Food Facts (free, open data, no API key),
// normalized to one macro shape, cached, with a recents list for
// fast re-logging.
//
// Macros are always stored/served per-100g plus a portion helper —
// so the same food logs correctly at any amount. macrosForPortion
// is pure unit math (grams -> macros), never a health computation.
//
// LICENSING: Open Food Facts data is ODbL. Attribute it in the UI
// ("Food data from Open Food Facts, ODbL") wherever results show.
// USDA FoodData Central (public domain) is a good future fallback
// but needs a free API key — add behind EXPO_PUBLIC_USDA_KEY later.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeReadArray, safeWriteArray } from './safeStore';

const OFF_BASE = 'https://world.openfoodfacts.org';
// OFF asks apps to identify themselves in the User-Agent.
const UA = 'SayFit/1.0 (fitness app; contact via app store listing)';
const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity';

const BARCODE_CACHE_KEY = 'sayfit_food_barcode_cache'; // { [code]: food }
const RECENTS_KEY = 'sayfit_food_recents';             // [food, ...] most-recent first
const RECENTS_MAX = 40;

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// ---- FETCH ----

async function offFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[foodDb] fetch failed:', e?.message || e);
    return null; // callers fall back to cache / manual entry
  } finally {
    clearTimeout(timer);
  }
}

// ---- NORMALIZE ----

// Map an Open Food Facts product to our shape. Returns null if it has no usable
// calorie value (an entry with no energy is useless for logging).
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

// ---- SEARCH / LOOKUP ----

/**
 * Text search. Returns normalized foods (kcal-bearing only). Network failure
 * yields [] so the caller can fall back to manual entry.
 */
export async function searchFoods(query, { limit = 20 } = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}`
    + `&search_simple=1&action=process&json=1&page_size=${limit}&fields=${FIELDS}`;
  const data = await offFetch(url);
  const products = data?.products || [];
  return products.map(normalizeProduct).filter(Boolean);
}

/**
 * Barcode lookup. Checks the local cache first, then Open Food Facts, and
 * caches a hit. Returns a normalized food or null (unknown / offline).
 */
export async function lookupBarcode(code) {
  const barcode = String(code || '').trim();
  if (!barcode) return null;

  const cached = await getCachedBarcode(barcode);
  if (cached) return cached;

  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const data = await offFetch(url);
  if (!data || data.status !== 1) return null; // status 0 = not found
  const food = normalizeProduct(data.product);
  if (food) await cacheBarcode(barcode, food);
  return food;
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

/** Foods logged recently, most-recent first, de-duped by id. */
export async function getRecentFoods() {
  return safeReadArray(RECENTS_KEY);
}

/** Record a food as recently used so it's one tap to log again. */
export async function addRecentFood(food) {
  if (!food || !food.id) return;
  const recents = await getRecentFoods();
  const deduped = [food, ...recents.filter((f) => f.id !== food.id)].slice(0, RECENTS_MAX);
  await safeWriteArray(RECENTS_KEY, deduped);
}
