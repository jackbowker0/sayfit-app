// ============================================================
// EXERCISE LOG SERVICE — Strength Training Tracker
//
// Stores individual exercise entries (sets, reps, weight)
// Tracks PRs, compares to previous sessions, builds
// progress data for charts and dashboards.
// Now with: Workout Templates, Progressive Overload, Smart Rest
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_KEY = 'sayfit_exercise_log';
const PR_KEY = 'sayfit_prs';
const TEMPLATE_KEY = 'sayfit_templates';

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
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[ExerciseLog] Failed to load:', e);
    return [];
  }
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
    };
    log.push(entry);
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log));

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

export function parseExerciseInput(text) {
  const input = text.trim().toLowerCase();
  const exercises = [];
  const lines = input.split(/\n|,\s*then\s+|,\s*and\s+then\s+|\.\s+/).filter(Boolean);
  for (const line of lines) {
    const parsed = parseSingleExercise(line.trim());
    if (parsed) exercises.push(parsed);
  }
  return exercises;
}

function parseSingleExercise(text) {
  if (!text || text.length < 3) return null;

  let name = '';
  let sets = 1;
  let reps = 0;
  let weight = 0;

  let clean = text
    .replace(/^(i did|i do|did|do)\s+/i, '')
    .replace(/^(then|and|also)\s+/i, '')
    .trim();

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

  const weightMatch = clean.match(/(?:at|@|with)?\s*(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilos?)?\b/i);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    if (val > 20 || clean.match(/lbs?|pounds?|kg|kilos?/i)) {
      weight = val;
      clean = clean.replace(weightMatch[0], ' ').trim();
    } else if (!reps && val <= 20) {
      reps = val;
      clean = clean.replace(weightMatch[0], ' ').trim();
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

  const setsArray = [];
  for (let i = 0; i < sets; i++) {
    setsArray.push({ reps, weight });
  }

  return { name, sets: setsArray };
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
  'Squat', 'Front Squat', 'Bulgarian Split Squat',
  'Deadlift', 'Romanian Deadlift', 'Sumo Deadlift',
  'Overhead Press', 'Military Press',
  'Barbell Row', 'Dumbbell Row', 'Pendlay Row',
  'Pull Ups', 'Chin Ups', 'Lat Pulldown',
  'Bicep Curl', 'Hammer Curl', 'Preacher Curl',
  'Tricep Extension', 'Skull Crushers', 'Tricep Pushdown',
  'Leg Press', 'Leg Extension', 'Leg Curl', 'Calf Raise',
  'Hip Thrust', 'Glute Bridge',
  'Lateral Raise', 'Front Raise', 'Face Pull',
  'Cable Fly', 'Dumbbell Fly',
  'Plank', 'Ab Rollout', 'Cable Crunch',
  'Running', 'Cycling', 'Swimming', 'Rowing',
];