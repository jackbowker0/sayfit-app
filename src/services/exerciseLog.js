// ============================================================
// EXERCISE LOG SERVICE — Strength Training Tracker
//
// Stores individual exercise entries (sets, reps, weight)
// Tracks PRs, compares to previous sessions, builds
// progress data for charts and dashboards.
// Now with: Workout Templates, Progressive Overload, Smart Rest
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeReadArray, safeWriteArray } from './safeStore';

const LOG_KEY = 'sayfit_exercise_log';
const PR_KEY = 'sayfit_prs';
const TEMPLATE_KEY = 'sayfit_templates';

// ---- UNITS ----
const LBS_PER_KG = 2.20462;

// Plausibility ceiling for a single logged set, in lbs. Anything above this is
// almost certainly a mis-transcription or fat-finger, not a real lift, and must
// never silently write a permanent PR (the PR store is never lowered). The
// heaviest raw lift ever recorded is ~1100 lb, so 1500 is a safe backstop.
const SANE_WEIGHT_CEILING_LBS = 1500;

function roundWeight(value, unit) {
  // kg users care about half-kg increments; lbs round to the nearest whole plate-ish number.
  if (unit === 'kg') return Math.round(value * 2) / 2;
  return Math.round(value);
}

/** Convert a weight between 'lbs' and 'kg'. No-op when units match or are unknown. */
export function convertWeight(value, fromUnit, toUnit) {
  const v = Number(value) || 0;
  if (!fromUnit || !toUnit || fromUnit === toUnit) return v;
  if (fromUnit === 'kg' && toUnit === 'lbs') return roundWeight(v * LBS_PER_KG, 'lbs');
  if (fromUnit === 'lbs' && toUnit === 'kg') return roundWeight(v / LBS_PER_KG, 'kg');
  return v;
}

function ceilingForUnit(unit) {
  return unit === 'kg' ? SANE_WEIGHT_CEILING_LBS / LBS_PER_KG : SANE_WEIGHT_CEILING_LBS;
}

// ---- COMPOUND EXERCISES (used for smart rest) ----
const COMPOUND_EXERCISES = [
  'squat', 'front squat', 'back squat', 'bulgarian split squat',
  'deadlift', 'romanian deadlift', 'sumo deadlift', 'trap bar deadlift',
  'bench press', 'incline bench press', 'decline bench press',
  'overhead press', 'military press', 'push press',
  'barbell row', 'pendlay row', 't-bar row',
  'hip thrust', 'leg press',
  'pull ups', 'chin ups', 'weighted pull ups',
  'dips', 'weighted dips',
  'clean', 'snatch', 'clean and jerk',
];

// ---- READ / WRITE ----

export async function getExerciseLog() {
  // Quarantines a corrupt blob instead of returning [] into the next write.
  return safeReadArray(LOG_KEY);
}

export async function getPRs() {
  try {
    const raw = await AsyncStorage.getItem(PR_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Save a workout session with multiple exercises
 */
export async function saveExerciseSession(session) {
  try {
    const log = await getExerciseLog();
    const entry = {
      id: Date.now().toString(),
      date: session.date || new Date().toISOString(),
      exercises: session.exercises || [],
      notes: session.notes || '',
      source: session.source || 'manual',
      // Stamp the unit the weights were entered in, so PR ceilings + any future
      // conversion know what these numbers mean.
      units: session.units === 'kg' ? 'kg' : 'lbs',
    };
    log.push(entry);
    await safeWriteArray(LOG_KEY, log);

    // Check for new PRs
    const newPRs = await checkAndUpdatePRs(entry);

    return { entry, newPRs };
  } catch (e) {
    console.warn('[ExerciseLog] Failed to save:', e);
    return { entry: null, newPRs: [] };
  }
}

export async function clearExerciseLog() {
  await AsyncStorage.setItem(LOG_KEY, '[]');
  await AsyncStorage.setItem(PR_KEY, '{}');
}

// ---- TEMPLATES ----

export async function getTemplates() {
  try {
    const raw = await AsyncStorage.getItem(TEMPLATE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[Templates] Failed to load:', e);
    return [];
  }
}

export async function saveTemplate(name, exercises) {
  try {
    const templates = await getTemplates();
    const existing = templates.findIndex(t =>
      t.name.toLowerCase() === name.toLowerCase()
    );

    if (existing >= 0) {
      templates[existing] = {
        ...templates[existing],
        exercises,
        updatedAt: new Date().toISOString(),
      };
    } else {
      templates.push({
        id: Date.now().toString(),
        name,
        exercises,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        useCount: 0,
      });
    }

    await AsyncStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
    return true;
  } catch (e) {
    console.warn('[Templates] Failed to save:', e);
    return false;
  }
}

export async function deleteTemplate(templateId) {
  try {
    const templates = await getTemplates();
    const filtered = templates.filter(t => t.id !== templateId);
    await AsyncStorage.setItem(TEMPLATE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.warn('[Templates] Failed to delete:', e);
    return false;
  }
}

export async function markTemplateUsed(templateId) {
  try {
    const templates = await getTemplates();
    const idx = templates.findIndex(t => t.id === templateId);
    if (idx >= 0) {
      templates[idx].lastUsed = new Date().toISOString();
      templates[idx].useCount = (templates[idx].useCount || 0) + 1;
      await AsyncStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
    }
  } catch (e) {
    console.warn('[Templates] Failed to mark used:', e);
  }
}

// ---- PR DETECTION ----

async function checkAndUpdatePRs(session) {
  const prs = await getPRs();
  const newPRs = [];

  for (const exercise of session.exercises) {
    const name = normalizeExerciseName(exercise.name);
    const maxWeight = Math.max(...exercise.sets.map(s => s.weight || 0));
    const maxVolume = Math.max(...exercise.sets.map(s => (s.weight || 0) * (s.reps || 0)));
    const maxReps = Math.max(...exercise.sets.map(s => s.reps || 0));

    // Data-integrity backstop: never let an implausible weight write a permanent
    // PR. The UI outlier gate (checkWeightOutliers) is the primary guard; this
    // catches anything that slips past it. Skips both weight AND volume for this
    // lift. Unit-aware so a kg user's fat-finger isn't measured against a lbs ceiling.
    if (maxWeight > ceilingForUnit(session.units || 'lbs')) continue;

    if (!prs[name]) {
      prs[name] = { maxWeight: 0, maxVolume: 0, maxReps: 0 };
    }

    if (maxWeight > prs[name].maxWeight && maxWeight > 0) {
      newPRs.push({
        exercise: exercise.name,
        type: 'weight',
        old: prs[name].maxWeight,
        new: maxWeight,
      });
      prs[name].maxWeight = maxWeight;
    }

    if (maxVolume > prs[name].maxVolume && maxVolume > 0) {
      newPRs.push({
        exercise: exercise.name,
        type: 'volume',
        old: prs[name].maxVolume,
        new: maxVolume,
      });
      prs[name].maxVolume = maxVolume;
    }
  }

  await AsyncStorage.setItem(PR_KEY, JSON.stringify(prs));
  return newPRs;
}

/**
 * Rebuild the entire PR map from the full exercise log. Self-heal for when a
 * bad/mis-logged entry corrupted a PR — the incremental updater never lowers a
 * PR, so deleting/editing a bad entry and calling this is the only way to undo
 * a corrupted max. Returns the rebuilt PR map.
 */
export async function recomputePRs() {
  const log = await getExerciseLog();
  const prs = {};
  for (const entry of log) {
    for (const exercise of entry.exercises || []) {
      const sets = exercise.sets || [];
      const maxWeight = Math.max(0, ...sets.map(s => s.weight || 0));
      if (maxWeight > ceilingForUnit(entry.units || 'lbs')) continue;
      const name = normalizeExerciseName(exercise.name);
      const maxVolume = Math.max(0, ...sets.map(s => (s.weight || 0) * (s.reps || 0)));
      const maxReps = Math.max(0, ...sets.map(s => s.reps || 0));
      if (!prs[name]) prs[name] = { maxWeight: 0, maxVolume: 0, maxReps: 0 };
      prs[name].maxWeight = Math.max(prs[name].maxWeight, maxWeight);
      prs[name].maxVolume = Math.max(prs[name].maxVolume, maxVolume);
      prs[name].maxReps = Math.max(prs[name].maxReps, maxReps);
    }
  }
  await AsyncStorage.setItem(PR_KEY, JSON.stringify(prs));
  return prs;
}

/**
 * Flag sets whose weight is implausible — above the absolute ceiling, or a huge
 * jump (>2.5x) over the user's existing PR for that lift. Used to confirm before
 * a (possibly mis-heard) voice/typed weight writes a permanent PR.
 * Returns [{ name, weight, reason: 'ceiling'|'jump', priorBest }].
 */
export async function checkWeightOutliers(exercises, unit = 'lbs') {
  const prs = await getPRs();
  const ceiling = ceilingForUnit(unit);
  const outliers = [];
  for (const ex of exercises || []) {
    const maxWeight = Math.max(0, ...(ex.sets || []).map(s => s.weight || 0));
    if (maxWeight <= 0) continue;
    const priorBest = prs[normalizeExerciseName(ex.name)]?.maxWeight || 0;
    if (maxWeight > ceiling) {
      outliers.push({ name: ex.name, weight: maxWeight, reason: 'ceiling', priorBest });
    } else if (priorBest > 0 && maxWeight > priorBest * 2.5) {
      outliers.push({ name: ex.name, weight: maxWeight, reason: 'jump', priorBest });
    }
  }
  return outliers;
}

// ---- PROGRESSIVE OVERLOAD ----

/**
 * Get a progressive overload suggestion for an exercise.
 * Looks at last session and suggests a small weight increase.
 *
 * Returns: { lastWeight, lastSets, lastReps, suggestedWeight, increase, message } or null
 */
export async function getOverloadSuggestion(exerciseName) {
  const history = await getExerciseHistory(exerciseName);
  if (history.length === 0) return null;

  const last = history[history.length - 1];
  const lastWeight = last.bestWeight;

  // Don't suggest overload for bodyweight exercises (weight = 0)
  if (lastWeight <= 0) return null;

  // Calculate suggested increase based on weight range
  let increase;
  if (lastWeight < 50) {
    increase = 2.5; // Light weights: small jumps
  } else if (lastWeight < 135) {
    increase = 5; // Medium weights: standard jump
  } else if (lastWeight < 225) {
    increase = 5; // Heavy weights: standard jump
  } else {
    increase = 10; // Very heavy: bigger jumps
  }

  // If they've done the same weight 3+ times, nudge harder
  const recentSameWeight = history.slice(-3).filter(h => h.bestWeight === lastWeight).length;
  if (recentSameWeight >= 3) {
    increase = Math.max(increase, 5);
  }

  const suggestedWeight = lastWeight + increase;
  const lastSet = last.sets?.[0] || {};

  return {
    lastWeight,
    lastSets: last.totalSets,
    lastReps: lastSet.reps || last.totalReps / last.totalSets,
    suggestedWeight,
    increase,
    sessionCount: history.length,
    lastDate: last.date,
  };
}

// ---- SMART REST DURATION ----

/**
 * Calculate intelligent rest duration based on exercise context.
 *
 * @param {string} exerciseName - Name of the exercise just completed
 * @param {number} weight - Weight used in the set
 * @param {number} reps - Reps performed
 * @param {number} defaultRest - User's default rest from settings
 * @returns {{ duration: number, reason: string }}
 */
export function getSmartRestDuration(exerciseName, weight, reps, defaultRest = 90) {
  const name = normalizeExerciseName(exerciseName);
  const isCompound = COMPOUND_EXERCISES.some(c => name.includes(c));

  // Heavy set detection: low reps OR high weight relative to exercise type
  const isHeavy = reps <= 5 || (isCompound && weight >= 185);
  const isLight = reps >= 15 || weight <= 20 || weight === 0;

  if (isCompound && isHeavy) {
    // Heavy compound: 150-180s
    return {
      duration: Math.max(defaultRest, 150),
      reason: 'Heavy compound — take your time',
    };
  }

  if (isCompound) {
    // Moderate compound: 90-120s
    return {
      duration: Math.max(defaultRest, 90),
      reason: 'Compound lift — solid rest',
    };
  }

  if (isLight) {
    // Light/isolation with high reps: 45-60s
    return {
      duration: Math.min(defaultRest, 60),
      reason: 'Light work — keep the pace',
    };
  }

  // Standard isolation/moderate work
  if (weight > 0 && reps <= 10) {
    return {
      duration: defaultRest,
      reason: '',
    };
  }

  // Default
  return {
    duration: defaultRest,
    reason: '',
  };
}

// ---- PROGRESS & COMPARISON ----

export async function getExerciseHistory(exerciseName) {
  const log = await getExerciseLog();
  const name = normalizeExerciseName(exerciseName);

  const sessions = [];
  for (const entry of log) {
    for (const ex of entry.exercises) {
      if (normalizeExerciseName(ex.name) === name) {
        sessions.push({
          date: entry.date,
          sessionId: entry.id,
          sets: ex.sets,
          bestWeight: Math.max(...ex.sets.map(s => s.weight || 0)),
          bestVolume: Math.max(...ex.sets.map(s => (s.weight || 0) * (s.reps || 0))),
          totalVolume: ex.sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0),
          totalSets: ex.sets.length,
          totalReps: ex.sets.reduce((sum, s) => sum + (s.reps || 0), 0),
        });
      }
    }
  }

  return sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Get the sets array from the most recent session for an exercise.
 * Returns an array of { reps, weight } or null if no history.
 */
export async function getLastSessionSets(exerciseName) {
  const history = await getExerciseHistory(exerciseName);
  if (history.length === 0) return null;
  return history[history.length - 1].sets;
}

export async function compareToLast(exerciseName, currentSets) {
  const history = await getExerciseHistory(exerciseName);
  if (history.length === 0) return null;

  const last = history[history.length - 1];
  const currentBestWeight = Math.max(...currentSets.map(s => s.weight || 0));
  const currentTotalVolume = currentSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
  const currentTotalReps = currentSets.reduce((sum, s) => sum + (s.reps || 0), 0);

  return {
    weightChange: currentBestWeight - last.bestWeight,
    volumeChange: currentTotalVolume - last.totalVolume,
    repChange: currentTotalReps - last.totalReps,
    isImproved: currentBestWeight >= last.bestWeight && currentTotalVolume >= last.totalVolume,
    lastDate: last.date,
    lastBestWeight: last.bestWeight,
    lastTotalVolume: last.totalVolume,
  };
}

export async function getExerciseSummaries() {
  const log = await getExerciseLog();
  const prs = await getPRs();
  const summaries = {};

  for (const entry of log) {
    for (const ex of entry.exercises) {
      const name = normalizeExerciseName(ex.name);
      const displayName = ex.name;
      const bestWeight = Math.max(...ex.sets.map(s => s.weight || 0));
      const totalVolume = ex.sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);

      if (!summaries[name]) {
        summaries[name] = {
          name: displayName,
          normalizedName: name,
          sessions: [],
          latestWeight: 0,
          latestDate: null,
          pr: prs[name] || null,
        };
      }

      summaries[name].sessions.push({
        date: entry.date,
        bestWeight,
        totalVolume,
        sets: ex.sets,
      });
      summaries[name].latestWeight = bestWeight;
      summaries[name].latestDate = entry.date;
    }
  }

  return Object.values(summaries).map(s => {
    const sorted = s.sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
    let trend = 0;
    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2].bestWeight;
      const latest = sorted[sorted.length - 1].bestWeight;
      trend = latest - prev;
    }

    return {
      ...s,
      sessionCount: sorted.length,
      trend,
      lastSession: sorted[sorted.length - 1],
      previousSession: sorted.length >= 2 ? sorted[sorted.length - 2] : null,
    };
  }).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
}

export async function getProgressChartData(exerciseName) {
  const history = await getExerciseHistory(exerciseName);
  return history.map(h => ({
    date: h.date,
    label: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: h.bestWeight,
    volume: h.totalVolume,
    sets: h.totalSets,
    reps: h.totalReps,
  }));
}

// ---- NATURAL LANGUAGE PARSER ----

// Spoken numbers -> digits. On-device STT (the voice path) frequently emits number
// WORDS and gym shorthand ("one eighty five"=185, "two twenty five"=225) that no
// digit regex catches; we normalize to digits BEFORE the structural regexes run.
const NUM_SMALL = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const NUM_TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

// Consume a run of number-words at tokens[i]; returns [value, nextIndex] or null.
// Handles standalone ("eight"=8, "twelve"=12), tens ("forty five"=45), formal
// hundreds ("one hundred eighty five"=185) AND gym-colloquial hundreds where the
// word "hundred" is dropped ("one eighty five"=185, "three fifteen"=315,
// "two oh five"=205).
function consumeNumber(tokens, i) {
  const t = tokens[i];
  if (!(t in NUM_SMALL) && !(t in NUM_TENS)) return null;

  let value = 0;
  let j = i;
  let consumedAny = false;

  // Leading hundreds: a 1-9 word followed by "hundred", or (colloquial) directly
  // by a tens word / teen word / "oh" with no "hundred" spoken.
  if (tokens[j] in NUM_SMALL && NUM_SMALL[tokens[j]] >= 1 && NUM_SMALL[tokens[j]] <= 9) {
    const lead = NUM_SMALL[tokens[j]];
    const next = tokens[j + 1];
    if (next === 'hundred') {
      value += lead * 100; j += 2;
      if (tokens[j] === 'and') j++;
      consumedAny = true;
    } else if (next in NUM_TENS || (next in NUM_SMALL && NUM_SMALL[next] >= 10) || next === 'oh' || next === 'o') {
      // colloquial: "two twenty five"=225, "three fifteen"=315, "two oh five"=205
      value += lead * 100; j += 1; consumedAny = true;
    }
  }

  if (tokens[j] in NUM_TENS) {
    value += NUM_TENS[tokens[j]]; j++; consumedAny = true;
    if (tokens[j] in NUM_SMALL && NUM_SMALL[tokens[j]] <= 9) { value += NUM_SMALL[tokens[j]]; j++; }
  } else if ((tokens[j] === 'oh' || tokens[j] === 'o') && consumedAny) {
    j++;
    if (tokens[j] in NUM_SMALL && NUM_SMALL[tokens[j]] <= 9) { value += NUM_SMALL[tokens[j]]; j++; }
  } else if (tokens[j] in NUM_SMALL) {
    value += NUM_SMALL[tokens[j]]; j++; consumedAny = true;
  }

  if (!consumedAny) return null;
  return [value, j];
}

// Replace spoken number-words with digits before the structural regexes run.
function wordsToDigits(text) {
  const tokens = text.split(/[\s-]+/).filter(Boolean);
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const res = consumeNumber(tokens, i);
    if (res) { out.push(String(res[0])); i = res[1]; }
    else { out.push(tokens[i]); i++; }
  }
  return out.join(' ');
}

export function parseExerciseInput(text, defaultUnit = 'lbs') {
  const input = text.trim().toLowerCase();
  const exercises = [];
  const lines = input.split(/\n|,\s*then\s+|,\s*and\s+then\s+|\.\s+/).filter(Boolean);
  for (const line of lines) {
    const parsed = parseSingleExercise(line.trim(), defaultUnit);
    if (parsed) exercises.push(parsed);
  }
  return exercises;
}

function parseSingleExercise(text, defaultUnit = 'lbs') {
  if (!text || text.length < 3) return null;

  let name = '';
  let sets = 1;
  let reps = 0;
  let weight = 0;
  let rpe = null;

  let clean = text
    .replace(/^(i did|i do|did|do)\s+/i, '')
    .replace(/^(then|and|also)\s+/i, '')
    .trim();

  // Spoken numbers -> digits, then normalize "by"/"times" separators to "x"
  // (STT writes "3 by 8", not "3x8").
  clean = wordsToDigits(clean);
  // iOS STT renders spoken compound-hundred numbers as clock times:
  // "one eighty five" -> "1:85", "two twenty five" -> "2:25". Rejoin the digits
  // so the weight parses as 185/225 instead of grabbing the "1" or "2".
  clean = clean.replace(/(\d{1,2}):(\d{2})\b/g, '$1$2');
  clean = clean.replace(/(\d)\s*(?:x|times|by)\s*(\d)/gi, '$1 x $2');

  // RPE cue, captured before name extraction so it doesn't pollute the name.
  // (Freeform effort commentary like "last set was a grinder" is left for the
  // T2 LLM parse — stripping it offline pollutes the exercise name.)
  const rpeMatch = clean.match(/\b(?:rpe|at rpe)\s*(\d+(?:\.\d+)?)\b/i);
  if (rpeMatch) { rpe = parseFloat(rpeMatch[1]); clean = clean.replace(rpeMatch[0], ' ').trim(); }

  const setsRepsMatch = clean.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (setsRepsMatch) {
    sets = parseInt(setsRepsMatch[1]);
    reps = parseInt(setsRepsMatch[2]);
    clean = clean.replace(setsRepsMatch[0], ' ').trim();
  }

  const setsOfMatch = clean.match(/(\d+)\s*sets?\s*(?:of\s*)?(\d+)\s*(?:reps?)?/i);
  if (setsOfMatch && !setsRepsMatch) {
    sets = parseInt(setsOfMatch[1]);
    reps = parseInt(setsOfMatch[2]);
    clean = clean.replace(setsOfMatch[0], ' ').trim();
  }

  const forNMatch = clean.match(/\bfor\s+(\d+)\s*(?:reps?)?\b/i);
  if (forNMatch && !reps) {
    reps = parseInt(forNMatch[1]);
    clean = clean.replace(forNMatch[0], ' ').trim();
  }

  const repsMatch = clean.match(/(\d+)\s*reps?\b/i);
  if (repsMatch && !reps) {
    reps = parseInt(repsMatch[1]);
    clean = clean.replace(repsMatch[0], ' ').trim();
  }

  const repsWasExplicit = reps > 0;

  // Weight: an explicit cue ("at/@/with") or a unit means weight at ANY magnitude
  // (fixes light-dumbbell loss, e.g. "3x8 at 15"). The cue keywords are anchored
  // with \b so a trailing "at" inside a word like "squat"/"flat"/"lat" can't be
  // mistaken for the weight cue. Otherwise fall back to the big-number heuristic.
  const cuedWeight = clean.match(/(?:\bat|\bwith|@)\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)?\b/i);
  const unitWeight = clean.match(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)\b/i);
  const wm = cuedWeight || unitWeight;
  if (wm) {
    const val = parseFloat(wm[1]);
    const unitToken = (wm[2] || '').toLowerCase();
    const spokenUnit = /kg|kilo/.test(unitToken) ? 'kg' : (/lb|pound/.test(unitToken) ? 'lbs' : null);
    // Store weight in the user's profile unit, converting when a different unit
    // was explicitly stated (e.g. "100 kg" while the profile is in lbs).
    weight = spokenUnit ? convertWeight(val, spokenUnit, defaultUnit) : val;
    clean = clean.replace(wm[0], ' ').trim();
  } else {
    const bare = clean.match(/\b(\d+(?:\.\d+)?)\b/);
    if (bare) {
      const val = parseFloat(bare[1]);
      if (val > 20) {
        weight = val;
        clean = clean.replace(bare[0], ' ').trim();
      } else if (!reps) {
        reps = val;
        clean = clean.replace(bare[0], ' ').trim();
      }
    }
  }

  const justSetsMatch = clean.match(/(\d+)\s*sets?\b/i);
  if (justSetsMatch && sets === 1) {
    sets = parseInt(justSetsMatch[1]);
    clean = clean.replace(justSetsMatch[0], ' ').trim();
  }

  name = clean
    .replace(/\d+/g, ' ')
    .replace(/\b(lbs?|pounds?|kg|kilos?|at|with|of|for|reps?|sets?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  name = name.replace(/\b\w/g, c => c.toUpperCase());

  if (!name) return null;
  if (!reps) reps = 10;

  // Confidence lets the staging UI flag a row for review when reps had to be
  // defaulted (the riskiest guess) rather than parsed from the input.
  const confidence = repsWasExplicit ? 'high' : 'low';

  const setsArray = [];
  for (let i = 0; i < sets; i++) {
    setsArray.push({ reps, weight });
  }

  return { name, sets: setsArray, rpe, confidence };
}

// ---- TIME-BASED EXERCISE TRACKING (bodyweight / guided workouts) ----

const DURATION_LOG_KEY = 'sayfit_duration_log';

export async function saveExerciseDurations(exercises) {
  try {
    const raw = await AsyncStorage.getItem(DURATION_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    const date = new Date().toISOString();
    for (const ex of exercises) {
      if (ex.name && ex.duration > 0) {
        log.push({
          name: normalizeExerciseName(ex.name),
          displayName: ex.name,
          duration: ex.duration,
          date,
        });
      }
    }
    if (log.length > 500) log.splice(0, log.length - 500);
    await AsyncStorage.setItem(DURATION_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.warn('[ExerciseLog] Failed to save durations:', e);
  }
}

export async function getTimeOverloadSuggestion(exerciseName) {
  try {
    const raw = await AsyncStorage.getItem(DURATION_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    const name = normalizeExerciseName(exerciseName);
    const history = log
      .filter(e => e.name === name)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (history.length < 2) return null;
    const lastDuration = history[history.length - 1].duration;
    const recentSame = history.slice(-3).filter(h => h.duration === lastDuration).length;
    const increase = recentSame >= 3 ? 10 : 5;
    return {
      lastDuration,
      suggestedDuration: lastDuration + increase,
      increase,
      sessionCount: history.length,
    };
  } catch {
    return null;
  }
}

// ---- HELPERS ----

function normalizeExerciseName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const COMMON_EXERCISES = [
  'Bench Press', 'Incline Bench Press', 'Decline Bench Press',
  'Incline Dumbbell Press', 'Machine Chest Press',
  'Squat', 'Front Squat', 'Bulgarian Split Squat', 'Split Squat',
  'Hack Squat', 'Pendulum Squat', 'Leg Press', 'Leg Extension',
  'Deadlift', 'Romanian Deadlift', 'Sumo Deadlift', 'Trap Bar Deadlift',
  'Overhead Press', 'Military Press', 'Seated Dumbbell Shoulder Press',
  'Barbell Row', 'Dumbbell Row', 'Pendlay Row',
  'Chest Supported Row', 'T-Bar Row', 'Seated Cable Row', 'Cable Row',
  'Pull Ups', 'Chin Ups', 'Lat Pulldown',
  'Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'Incline Dumbbell Curl',
  'Tricep Extension', 'Skull Crushers', 'Tricep Pushdown',
  'Overhead Tricep Extension',
  'Leg Curl', 'Seated Leg Curl', 'Lying Leg Curl',
  'Calf Raise', 'Standing Calf Raise', 'Seated Calf Raise',
  'Hip Thrust', 'Glute Bridge', 'Back Extension',
  'Lateral Raise', 'Cable Lateral Raise', 'Front Raise', 'Face Pull',
  'Rear Delt Fly', 'Reverse Pec Deck', 'Prone Y Raise', 'External Rotation',
  'Cable Fly', 'Dumbbell Fly',
  'Plank', 'Side Plank', 'Ab Rollout', 'Cable Crunch',
  'Pallof Press', 'Dead Bug', 'Suitcase Carry',
  'Running', 'Cycling', 'Swimming', 'Rowing', 'Stair Climber',
];