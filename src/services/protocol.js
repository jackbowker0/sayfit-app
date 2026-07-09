// ============================================================
// PROTOCOL SERVICE — Track medication/peptide/supplement doses
// ------------------------------------------------------------
// Stores user-defined compounds, a dated dose-administration log,
// an AM/PM supplement stack, and a per-day check-off log.
//
// NAMING: "dose" ALWAYS means a user-typed, user-confirmed amount
// actually taken. This service NEVER calculates, derives, or
// defaults a dose value. `defaultDose`/`weeklyTotal` fields are
// inert pre-fill/label text the user edits or clears — they are
// never read to compute anything. (Product/App-Store requirement.)
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeReadArray, safeWriteArray, serialize } from './safeStore';
import { SEED_PERSONAL_PROTOCOL } from '../config/features';

// ---- KEYS ----
const PROTOCOL_COMPOUNDS_KEY = 'sayfit_protocol_compounds';
const PROTOCOL_DOSE_LOG_KEY  = 'sayfit_protocol_dose_log';
const PROTOCOL_STACK_KEY     = 'sayfit_protocol_stack';
const PROTOCOL_STACK_LOG_KEY = 'sayfit_protocol_stack_log';
const PROTOCOL_ACK_KEY       = 'sayfit_protocol_ack';

// ---- OPTION LISTS (drive screen pickers; NO PED-cycle vocab) ----
export const COMPOUND_TYPES = [
  { id: 'injectable', label: 'Injectable' },
  { id: 'peptide',    label: 'Peptide' },
  { id: 'oral',       label: 'Oral' },
  { id: 'topical',    label: 'Topical' },
  { id: 'supplement', label: 'Supplement' },
  { id: 'other',      label: 'Other' },
];

export const DOSE_UNITS = ['mg', 'mcg', 'g', 'IU', 'mL', 'tablet(s)', 'capsule(s)', 'drop(s)'];

export const ROUTE_OPTIONS = [
  { id: 'subq',    label: 'Subcutaneous' },
  { id: 'im',      label: 'Intramuscular' },
  { id: 'oral',    label: 'Oral' },
  { id: 'topical', label: 'Topical' },
  { id: 'other',   label: 'Other' },
];

export const INJECTION_SITES = [
  'Abdomen L', 'Abdomen R', 'Thigh L', 'Thigh R',
  'Glute L', 'Glute R', 'Delt L', 'Delt R',
];

export const STACK_SLOTS = [
  { id: 'am', label: 'Morning' },
  { id: 'pm', label: 'Evening' },
];

// Day-of-week convention MUST match userProfile.js DAY_OPTIONS (0 = Monday).

// ---- HELPERS ----

// YYYY-MM-DD day key in the device's LOCAL timezone (NOT UTC). Using UTC would
// tag an evening dose (e.g. 9pm ET) with tomorrow's date and desync it from the
// LOCAL weekday used for scheduling — breaking "due today" and the daily reset.
// Exported so the screen uses the exact same day boundary.
export function dayKey(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Validate a USER-TYPED dose. Never computes; only cleans typed input.
// Returns a positive finite number, or null if the input isn't one.
// (null is a valid "no dose entered yet" state — e.g. seed Retatrutide.)
function sanitizeDose(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : null;
}

// Dose entries only count toward "done today" once user-confirmed.
const COUNTED_DOSE_STATES = ['confirmed', 'user_edited', 'manual'];
function doseCounts(entry) { return COUNTED_DOSE_STATES.includes(entry.editState); }

// Default seed content (see below). Used only on first read when key is empty.
function getDefaultCompounds() {
  const now = new Date().toISOString();
  return [
    {
      id: 'seed-test-cyp',
      name: 'Testosterone Cypionate',
      type: 'injectable',
      route: 'subq',                 // user-editable; also used IM
      unit: 'mg',
      defaultDose: 66,               // editable PRE-FILL only; never computed
      weeklyTotal: 200,              // inert informational label; never derived
      schedule: {
        frequency: 'weekly_split',
        daysOfWeek: [0, 2, 4],       // Mon/Wed/Fri — 0=Mon per DAY_OPTIONS
        dosesPerWeek: 3,
      },
      notes: 'Rotate injection sites.',
      active: true,
      createdAt: now,
    },
    {
      id: 'seed-retatrutide',
      name: 'Retatrutide',
      type: 'peptide',
      route: 'subq',
      unit: 'mg',
      defaultDose: null,             // "user enters their own dose" — no default
      weeklyTotal: null,
      schedule: { frequency: 'weekly', daysOfWeek: [], dosesPerWeek: 1 },
      notes: 'Optional / considering — dose not yet set.',
      active: false,                 // present but off until user turns it on
      createdAt: now,
    },
  ];
}

function getDefaultStack() {
  const now = new Date().toISOString();
  const mk = (id, name, dose, unit, slot) =>
    ({ id, name, dose, unit, slot, active: true, createdAt: now });
  return [
    mk('seed-creatine',     'Creatine',        '5',    'g',  'am'),
    mk('seed-electrolytes', 'Electrolytes',    '',     '',   'am'),
    mk('seed-fishoil',      'Fish Oil',        '',     '',   'pm'),
    mk('seed-bergamot',     'Citrus Bergamot', '1200', 'mg', 'pm'),
    mk('seed-boron',        'Boron',           '10',   'mg', 'pm'),
    mk('seed-multi',        'Multivitamin',    '',     '',   'pm'),
  ];
}

// ---- COMPOUNDS (READ / WRITE) ----

export async function getCompounds() {
  try {
    const raw = await AsyncStorage.getItem(PROTOCOL_COMPOUNDS_KEY);
    if (raw == null) {
      // Public builds start empty — the user adds their own compounds. Only a
      // personal dogfood build seeds a starter protocol (see config/features).
      if (!SEED_PERSONAL_PROTOCOL) return [];
      const seed = getDefaultCompounds();
      // Persist in its own try so a write failure still returns the seed (never []).
      try { await AsyncStorage.setItem(PROTOCOL_COMPOUNDS_KEY, JSON.stringify(seed)); }
      catch (e) { console.warn('[Protocol] Failed to persist seed compounds:', e); }
      return seed;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[Protocol] Failed to load compounds:', e);
    return [];
  }
}

export async function saveCompound({
  name = '', type = 'other', route = 'other', unit = 'mg',
  defaultDose = null, weeklyTotal = null, schedule = null,
  notes = '', active = true,
} = {}) {
  try {
    const compounds = await getCompounds();
    const compound = {
      id: Date.now().toString(),
      name: String(name).trim(),
      type, route, unit,
      // pre-fill/label ONLY — validated as a typed number if present, never computed
      defaultDose: sanitizeDose(defaultDose),
      weeklyTotal: sanitizeDose(weeklyTotal),
      schedule: schedule || { frequency: 'weekly', daysOfWeek: [], dosesPerWeek: 1 },
      notes: String(notes),
      active: !!active,
      createdAt: new Date().toISOString(),
    };
    compounds.push(compound);
    await AsyncStorage.setItem(PROTOCOL_COMPOUNDS_KEY, JSON.stringify(compounds));
    return compound;
  } catch (e) {
    console.warn('[Protocol] Failed to save compound:', e);
    return null;
  }
}

export async function updateCompound(compoundId, updates = {}) {
  try {
    const compounds = await getCompounds();
    const idx = compounds.findIndex(c => c.id === compoundId);
    if (idx < 0) return null;
    const prev = compounds[idx];
    const next = {
      ...prev, ...updates,
      defaultDose: updates.defaultDose !== undefined ? sanitizeDose(updates.defaultDose) : prev.defaultDose,
      weeklyTotal: updates.weeklyTotal !== undefined ? sanitizeDose(updates.weeklyTotal) : prev.weeklyTotal,
    };
    compounds[idx] = next;
    await AsyncStorage.setItem(PROTOCOL_COMPOUNDS_KEY, JSON.stringify(compounds));
    return next;
  } catch (e) {
    console.warn('[Protocol] Failed to update compound:', e);
    return null;
  }
}

export async function deleteCompound(compoundId) {
  try {
    const compounds = await getCompounds();
    const filtered = compounds.filter(c => c.id !== compoundId);
    await AsyncStorage.setItem(PROTOCOL_COMPOUNDS_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearCompounds() {
  await AsyncStorage.setItem(PROTOCOL_COMPOUNDS_KEY, '[]');
}

// ---- DOSE LOG (READ / WRITE) ----

export async function getDoseEntries() {
  // Medication log — quarantine a corrupt blob, never erase it via the next write.
  return safeReadArray(PROTOCOL_DOSE_LOG_KEY);
}

export async function logDose({
  compoundId = null, name = '', amount = null, unit = 'mg',
  route = 'other', site = null, notes = '',
  date = null, editState = null,
} = {}) {
  try {
    const entries = await getDoseEntries();
    const entry = {
      id: Date.now().toString(),
      date: date || new Date().toISOString(),
      compoundId,
      name: String(name).trim(),
      amount: sanitizeDose(amount),   // user-typed number or null; NEVER computed
      unit, route, site,
      notes: String(notes),
      // logged doses start unconfirmed; confirmDose() promotes them
      editState: editState || 'pending',
    };
    entries.push(entry);
    await safeWriteArray(PROTOCOL_DOSE_LOG_KEY, entries);
    return entry;
  } catch (e) {
    console.warn('[Protocol] Failed to save dose:', e);
    return null;
  }
}

export async function updateDose(entryId, updates = {}) {
  try {
    const entries = await getDoseEntries();
    const idx = entries.findIndex(e => e.id === entryId);
    if (idx < 0) return null;
    const prev = entries[idx];
    const next = {
      ...prev, ...updates,
      amount: updates.amount !== undefined ? sanitizeDose(updates.amount) : prev.amount,
    };
    if (prev.editState === 'pending' && !updates.editState) {
      next.editState = 'user_edited';
    }
    entries[idx] = next;
    await safeWriteArray(PROTOCOL_DOSE_LOG_KEY, entries);
    return next;
  } catch (e) {
    console.warn('[Protocol] Failed to update dose:', e);
    return null;
  }
}

// Semantic shortcut — satisfies "user-confirmed dose" (App Store 1.4.2).
export async function confirmDose(entryId) {
  return updateDose(entryId, { editState: 'confirmed' });
}

export async function deleteDose(entryId) {
  try {
    const entries = await getDoseEntries();
    const filtered = entries.filter(e => e.id !== entryId);
    await safeWriteArray(PROTOCOL_DOSE_LOG_KEY, filtered);
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearDoseLog() {
  await AsyncStorage.setItem(PROTOCOL_DOSE_LOG_KEY, '[]');
}

// ---- SUPPLEMENT STACK (READ / WRITE) ----

export async function getSupplementStack() {
  try {
    const raw = await AsyncStorage.getItem(PROTOCOL_STACK_KEY);
    if (raw == null) {
      // Public builds start empty; only a personal dogfood build seeds a stack.
      if (!SEED_PERSONAL_PROTOCOL) return [];
      const seed = getDefaultStack();
      try { await AsyncStorage.setItem(PROTOCOL_STACK_KEY, JSON.stringify(seed)); }
      catch (e) { console.warn('[Protocol] Failed to persist seed stack:', e); }
      return seed;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[Protocol] Failed to load stack:', e);
    return [];
  }
}

export async function saveSupplementItem({
  name = '', dose = '', unit = '', slot = 'am', active = true,
} = {}) {
  try {
    const stack = await getSupplementStack();
    const item = {
      id: Date.now().toString(),
      name: String(name).trim(),
      dose: String(dose),   // free-text label (e.g. "5"); NOT a computed number
      unit: String(unit),
      slot: STACK_SLOTS.some(s => s.id === slot) ? slot : 'am',
      active: !!active,
      createdAt: new Date().toISOString(),
    };
    stack.push(item);
    await AsyncStorage.setItem(PROTOCOL_STACK_KEY, JSON.stringify(stack));
    return item;
  } catch (e) {
    console.warn('[Protocol] Failed to save stack item:', e);
    return null;
  }
}

export async function updateSupplementItem(itemId, updates = {}) {
  try {
    const stack = await getSupplementStack();
    const idx = stack.findIndex(s => s.id === itemId);
    if (idx < 0) return null;
    stack[idx] = { ...stack[idx], ...updates };
    await AsyncStorage.setItem(PROTOCOL_STACK_KEY, JSON.stringify(stack));
    return stack[idx];
  } catch (e) {
    console.warn('[Protocol] Failed to update stack item:', e);
    return null;
  }
}

export async function deleteSupplementItem(itemId) {
  try {
    const stack = await getSupplementStack();
    const filtered = stack.filter(s => s.id !== itemId);
    await AsyncStorage.setItem(PROTOCOL_STACK_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearSupplementStack() {
  await AsyncStorage.setItem(PROTOCOL_STACK_KEY, '[]');
}

// ---- STACK CHECK-OFF LOG (READ / WRITE) ----

export async function getStackLog() {
  // Quarantines a corrupt blob instead of returning [] into the next write.
  return safeReadArray(PROTOCOL_STACK_LOG_KEY);
}

// Toggle a stack item's taken-state for a given day. Idempotent per (itemId, day):
// a deterministic composite id + filter-ALL-on-uncheck means duplicate entries
// (e.g. from a fast double-tap race) can never leave an item stuck "taken".
export async function toggleStackTaken(itemId, date = null) {
  // Serialize on the log key: rapid check-offs of DIFFERENT items each do a
  // read-modify-write of the whole array, so interleaving would drop one item's
  // change. Running them one at a time (per key) prevents the lost update; the
  // idempotent composite-id design still covers same-item double-taps.
  return serialize(PROTOCOL_STACK_LOG_KEY, async () => {
    try {
      const log = await getStackLog();
      const key = dayKey(date);
      const present = log.some(l => l.itemId === itemId && dayKey(l.date) === key);
      const next = present
        ? log.filter(l => !(l.itemId === itemId && dayKey(l.date) === key)) // un-check: remove all matching
        : [...log, { id: `${itemId}|${key}`, itemId, date: date || new Date().toISOString() }];
      await safeWriteArray(PROTOCOL_STACK_LOG_KEY, next);
      return !present;                 // true = now taken, false = now un-taken
    } catch (e) {
      console.warn('[Protocol] Failed to toggle stack item:', e);
      return null;
    }
  });
}

export async function clearStackLog() {
  await AsyncStorage.setItem(PROTOCOL_STACK_LOG_KEY, '[]');
}

// ---- ACKNOWLEDGMENT GATE ----

export async function hasAcknowledgedProtocolDisclaimer() {
  try {
    return (await AsyncStorage.getItem(PROTOCOL_ACK_KEY)) === 'true';
  } catch (e) {
    return false;
  }
}

export async function acknowledgeProtocolDisclaimer() {
  await AsyncStorage.setItem(PROTOCOL_ACK_KEY, 'true');
}

export async function resetProtocolAcknowledgment() {
  await AsyncStorage.removeItem(PROTOCOL_ACK_KEY);
}

// ---- AGGREGATION ----

// Which active compounds are scheduled for the given day's weekday?
// Pure schedule membership — NO dose math.
function jsDayToConvention(jsDay) {
  // JS getDay(): 0=Sun..6=Sat. Convention (DAY_OPTIONS): 0=Mon..6=Sun.
  return (jsDay + 6) % 7;
}

export async function getDailyProtocolStatus(date = null) {
  const iso = date || new Date().toISOString();
  const key = dayKey(iso);
  const weekday = jsDayToConvention(new Date(iso).getDay());

  const [compounds, doseEntries, stack, stackLog] = await Promise.all([
    getCompounds(), getDoseEntries(), getSupplementStack(), getStackLog(),
  ]);

  // Injections/doses scheduled today
  const activeCompounds = compounds.filter(c => c.active);
  const scheduledToday = activeCompounds.filter(c => {
    const days = c.schedule?.daysOfWeek || [];
    return Array.isArray(days) && days.includes(weekday);
  });

  // Doses actually confirmed today, per compound
  const dosesToday = doseEntries.filter(e => dayKey(e.date) === key && doseCounts(e));
  const takenCompoundIds = new Set(dosesToday.map(e => e.compoundId));
  const injectionDueToday =
    scheduledToday.filter(c => c.type === 'injectable' || c.type === 'peptide')
                  .some(c => !takenCompoundIds.has(c.id));

  // Supplement stack: taken vs total, split by slot
  const takenItemIds = new Set(
    stackLog.filter(l => dayKey(l.date) === key).map(l => l.itemId)
  );
  const activeStack = stack.filter(s => s.active);
  const amItems = activeStack.filter(s => s.slot === 'am');
  const pmItems = activeStack.filter(s => s.slot === 'pm');
  const countTaken = (items) => items.filter(s => takenItemIds.has(s.id)).length;

  const supplementsTotal = activeStack.length;
  const supplementsDone  = countTaken(activeStack);

  // Next scheduled dose label (informational; not a computation of amount)
  const nextDose = scheduledToday.find(c => !takenCompoundIds.has(c.id)) || null;

  return {
    date: key,
    scheduledToday,                    // [compound]
    injectionDueToday,                 // boolean
    dosesToday,                        // [doseEntry] confirmed today
    am: { done: countTaken(amItems), total: amItems.length, items: amItems, takenItemIds },
    pm: { done: countTaken(pmItems), total: pmItems.length, items: pmItems, takenItemIds },
    supplementsDone, supplementsTotal,
    nextDose: nextDose ? { id: nextDose.id, name: nextDose.name } : null,
  };
}

// Dashboard-card feed — thin shape mirroring getNutritionStats.
export async function getProtocolStats(date = null) {
  const s = await getDailyProtocolStatus(date);
  return {
    date: s.date,
    injectionDueToday: s.injectionDueToday,
    supplementsDone: s.supplementsDone,
    supplementsTotal: s.supplementsTotal,
    nextDose: s.nextDose,              // { id, name } | null
    scheduledCount: s.scheduledToday.length,
    dosesLoggedToday: s.dosesToday.length,
  };
}

// Adherence over time (byDay map, nutrition getMacroChartData idiom).
export async function getAdherenceChartData(limit = 30) {
  const entries = await getDoseEntries();
  const byDay = {};
  entries.filter(doseCounts).forEach(e => {
    const k = dayKey(e.date);
    byDay[k] = (byDay[k] || 0) + 1;
  });
  return Object.keys(byDay).sort().slice(-limit).map(key => ({
    date: key,
    label: new Date(key + 'T12:00:00')
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    doses: byDay[key],
  }));
}
