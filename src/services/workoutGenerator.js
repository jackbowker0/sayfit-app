/**
 * SayFit — Smart Workout Generator v2
 *
 * Profile-aware: filters by user's equipment, scales to fitness level
 * Memory-aware: avoids recently-hit muscles, prioritizes neglected ones
 * Structured: warmup → main → cooldown when duration allows
 */

import { EXERCISES } from '../constants/exercises';
import { getUserProfile } from './userProfile';
import { buildMemorySummary } from './storage';

// ─── EQUIPMENT MAPPING ────────────────────────────────────────────
// Maps profile equipment IDs to exercise equipment tags
const EQUIPMENT_MAP = {
  bodyweight: ['none', 'wall'],
  dumbbells: ['none', 'wall', 'chair', 'dumbbell'],
  bands: ['none', 'wall', 'band'],
  full_gym: ['none', 'wall', 'chair', 'dumbbell', 'band'],
};

function getAllowedEquipment(profileEquipment) {
  if (!profileEquipment || profileEquipment.length === 0) return ['none', 'wall'];
  const allowed = new Set();
  profileEquipment.forEach(eq => {
    (EQUIPMENT_MAP[eq] || ['none']).forEach(tag => allowed.add(tag));
  });
  return [...allowed];
}

// ─── INTENSITY RANGES BY FITNESS LEVEL ────────────────────────────
const INTENSITY_RANGE = {
  beginner: { min: 1, max: 6, sweet: 4 },
  intermediate: { min: 3, max: 8, sweet: 6 },
  advanced: { min: 5, max: 10, sweet: 8 },
};

// ─── MUSCLE MAPPING ───────────────────────────────────────────────
const FOCUS_TO_MUSCLES = {
  upper: ['Chest', 'Shoulders', 'Arms', 'Back'],
  lower: ['Legs', 'Glutes'],
  core: ['Core'],
  cardio: ['Cardio'],
  fullBody: ['Legs', 'Chest', 'Core', 'Back', 'Shoulders', 'Glutes', 'Arms', 'Cardio', 'Full Body'],
  stretch: ['Legs', 'Back', 'Chest', 'Shoulders', 'Glutes', 'Full Body'],
  back: ['Back'],
  chest: ['Chest'],
  arms: ['Arms'],
  shoulders: ['Shoulders'],
  legs: ['Legs'],
  glutes: ['Glutes'],
};

// ─── PARSING ──────────────────────────────────────────────────────

const TIME_PATTERNS = [
  { regex: /(\d+)\s*min(ute)?s?/i, extract: (m) => parseInt(m[1]) },
  { regex: /(\d+)\s*sec(ond)?s?/i, extract: (m) => Math.ceil(parseInt(m[1]) / 60) },
  { regex: /half\s*(an?\s*)?hour/i, extract: () => 30 },
  { regex: /an?\s*hour/i, extract: () => 60 },
  { regex: /quick|short|fast|brief/i, extract: () => 10 },
  { regex: /long|extended|marathon/i, extract: () => 45 },
];

const ENERGY_KEYWORDS = {
  low: ['tired', 'exhausted', 'low energy', 'sleepy', 'sluggish', 'sore', 'recovery', 'easy', 'gentle', 'chill', 'mellow', 'light', 'relax', 'calm', 'lazy', 'slow'],
  medium: ['okay', 'alright', 'moderate', 'normal', 'decent', 'average', 'regular', 'balanced'],
  high: ['pumped', 'fired up', 'energized', 'hyped', 'beast mode', 'intense', 'hard', 'tough', 'crush', 'destroy', 'kill it', 'go hard', 'max', 'insane', 'brutal', 'savage', 'all out'],
};

const FOCUS_KEYWORDS = {
  upper: ['arms', 'arm', 'upper', 'upper body'],
  lower: ['legs', 'leg', 'lower', 'lower body', 'thigh', 'hamstring', 'quad'],
  core: ['core', 'abs', 'ab', 'stomach', 'belly', 'plank', 'crunch', 'oblique', 'six pack', 'midsection'],
  cardio: ['cardio', 'run', 'running', 'hiit', 'sweat', 'burn', 'heart rate', 'jumping', 'burpee', 'endurance', 'stamina'],
  fullBody: ['full body', 'full-body', 'everything', 'total body', 'whole body', 'all over', 'mix', 'variety'],
  stretch: ['stretch', 'flexibility', 'yoga', 'cool down', 'warm up', 'mobility', 'loosen'],
  back: ['back', 'lats', 'rear delt', 'posture'],
  chest: ['chest', 'pec', 'push-up', 'pushup', 'bench'],
  shoulders: ['shoulders', 'shoulder', 'delts', 'overhead', 'pike'],
  glutes: ['glute', 'glutes', 'booty', 'butt', 'hip thrust'],
};

export function parseWorkoutRequest(input) {
  const text = input.toLowerCase().trim();

  let duration = null;
  for (const pattern of TIME_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) { duration = pattern.extract(match); break; }
  }
  if (!duration) duration = 15;
  duration = Math.max(5, Math.min(60, duration));

  let energy = 'medium';
  for (const [level, keywords] of Object.entries(ENERGY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) { energy = level; break; }
  }

  const focusAreas = [];
  for (const [area, keywords] of Object.entries(FOCUS_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) focusAreas.push(area);
  }
  if (focusAreas.length === 0) focusAreas.push('fullBody');

  return { duration, energy, focusAreas, rawInput: input };
}

// ─── SMART WORKOUT BUILDER ────────────────────────────────────────

export async function generateSmartWorkout(parsed) {
  const profile = await getUserProfile();
  const memory = await buildMemorySummary();
  return buildWorkout(parsed, profile, memory);
}

// Sync version for regenerate (reuses profile/memory)
let _cachedProfile = null;
let _cachedMemory = null;

export async function initGeneratorCache() {
  _cachedProfile = await getUserProfile();
  _cachedMemory = await buildMemorySummary();
}

export function generateWorkout(parsed) {
  return buildWorkout(parsed, _cachedProfile, _cachedMemory);
}

function buildWorkout(parsed, profile, memory) {
  const { duration, energy, focusAreas } = parsed;

  // Get allowed equipment from profile
  const allowedEquipment = getAllowedEquipment(profile?.equipment);

  // Get intensity range from fitness level
  const level = profile?.fitnessLevel || 'intermediate';
  const intensityRange = INTENSITY_RANGE[level] || INTENSITY_RANGE.intermediate;

  // Adjust intensity range based on energy
  let intensityMin = intensityRange.min;
  let intensityMax = intensityRange.max;
  let intensitySweet = intensityRange.sweet;
  if (energy === 'low') {
    intensityMax = Math.min(intensityMax, intensityRange.sweet);
    intensitySweet = intensityRange.min + 1;
  } else if (energy === 'high') {
    intensityMin = Math.max(intensityMin, intensityRange.sweet - 1);
    intensitySweet = intensityRange.max - 1;
  }

  // Get target muscles from focus areas
  const targetMuscles = new Set();
  focusAreas.forEach(area => {
    (FOCUS_TO_MUSCLES[area] || []).forEach(m => targetMuscles.add(m));
  });

  // Get recently hit muscles (last 2 days) for deprioritization
  const recentMuscles = new Set();
  if (memory && memory.recentWorkouts) {
    const twoDaysAgo = Date.now() - 2 * 86400000;
    memory.recentWorkouts
      .filter(w => new Date(w.date).getTime() > twoDaysAgo)
      .forEach(w => {
        (w.muscles || []).forEach(m => recentMuscles.add(m));
      });
  }

  // Get neglected muscles for bonus scoring
  const neglectedMuscles = new Set(memory?.neglectedMuscles || []);

  // ---- FILTER EXERCISES ----
  const allExercises = EXERCISES.filter(ex => {
    // Must match allowed equipment
    if (!allowedEquipment.includes(ex.equipment)) return false;
    // Only strength and cardio for main workout
    if (ex.category !== 'strength' && ex.category !== 'cardio') return false;
    // Intensity must be in range
    if (ex.intensity < intensityMin - 1 || ex.intensity > intensityMax + 1) return false;
    return true;
  });

  // ---- SCORE EXERCISES ----
  const scored = allExercises.map(ex => {
    let score = 0;

    // Target muscle match (highest weight)
    if (targetMuscles.has(ex.muscle)) score += 20;
    // Full body exercises get a bonus in full body mode
    if (ex.muscle === 'Full Body' && focusAreas.includes('fullBody')) score += 15;

    // Intensity alignment — closer to sweet spot = higher score
    const intensityDist = Math.abs(ex.intensity - intensitySweet);
    score += Math.max(0, 10 - intensityDist * 2);

    // In-range intensity bonus
    if (ex.intensity >= intensityMin && ex.intensity <= intensityMax) score += 5;

    // Neglected muscle bonus
    if (neglectedMuscles.has(ex.muscle)) score += 8;

    // Recently-hit muscle penalty (mild — don't fully exclude)
    if (recentMuscles.has(ex.muscle) && !focusAreas.some(a => FOCUS_TO_MUSCLES[a]?.includes(ex.muscle))) {
      score -= 5;
    }

    // Cardio focus boosts cardio exercises
    if (focusAreas.includes('cardio') && ex.category === 'cardio') score += 10;

    // Random jitter for variety
    score += Math.random() * 6;

    return { exercise: ex, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // ---- CALCULATE STRUCTURE ----
  const totalSeconds = duration * 60;
  const includeWarmup = duration >= 10;
  const includeCooldown = duration >= 12;

  const warmupTime = includeWarmup ? Math.min(90, totalSeconds * 0.12) : 0;
  const cooldownTime = includeCooldown ? Math.min(120, totalSeconds * 0.12) : 0;
  const mainTime = totalSeconds - warmupTime - cooldownTime;

  // Work/rest timings by energy + level
  const timings = getTimings(energy, level);
  const exercisesNeeded = Math.max(3, Math.min(12, Math.round(mainTime / (timings.work + timings.rest))));

  // ---- SELECT MAIN EXERCISES ----
  const selected = [];
  const usedMuscles = [];
  const usedNames = new Set();

  for (const item of scored) {
    if (selected.length >= exercisesNeeded) break;
    const ex = item.exercise;
    if (usedNames.has(ex.name)) continue;

    // Variety: don't stack same muscle back-to-back unless specifically requested
    if (selected.length > 0 && !focusAreas.some(a => ['core', 'cardio'].includes(a))) {
      const lastMuscle = selected[selected.length - 1].muscle;
      if (lastMuscle === ex.muscle && scored.length > exercisesNeeded * 2) continue;
    }

    usedNames.add(ex.name);
    usedMuscles.push(ex.muscle);
    selected.push(ex);
  }

  // Fill if needed
  for (const item of scored) {
    if (selected.length >= exercisesNeeded) break;
    if (!usedNames.has(item.exercise.name)) {
      usedNames.add(item.exercise.name);
      selected.push(item.exercise);
    }
  }

  // ---- WARMUP EXERCISES ----
  const warmupExercises = [];
  if (includeWarmup) {
    const warmups = EXERCISES.filter(ex =>
      ex.category === 'warmup' && allowedEquipment.includes(ex.equipment)
    );
    // Pick 2-3 warmup exercises relevant to target muscles
    const warmupScored = warmups.map(ex => {
      let s = Math.random() * 3;
      if (targetMuscles.has(ex.muscle)) s += 5;
      return { exercise: ex, score: s };
    }).sort((a, b) => b.score - a.score);
    const warmupCount = duration >= 20 ? 3 : 2;
    warmupScored.slice(0, warmupCount).forEach(w => warmupExercises.push(w.exercise));
  }

  // ---- COOLDOWN EXERCISES ----
  const cooldownExercises = [];
  if (includeCooldown) {
    const cooldowns = EXERCISES.filter(ex =>
      ex.category === 'cooldown' && allowedEquipment.includes(ex.equipment)
    );
    // Pick 2-3 cooldown exercises relevant to muscles worked
    const workedMuscles = new Set(selected.map(e => e.muscle));
    const cooldownScored = cooldowns.map(ex => {
      let s = Math.random() * 3;
      if (workedMuscles.has(ex.muscle)) s += 5;
      return { exercise: ex, score: s };
    }).sort((a, b) => b.score - a.score);
    const cooldownCount = duration >= 20 ? 3 : 2;
    cooldownScored.slice(0, cooldownCount).forEach(c => cooldownExercises.push(c.exercise));
  }

  // ---- BUILD WORKOUT OBJECT ----
  const allWorkoutExercises = [
    ...warmupExercises.map((ex, i) => ({
      ...ex,
      id: ex.id || `warmup_${i}`,
      duration: 30,
      rest: 5,
      phase: 'warmup',
    })),
    ...selected.map((ex, i) => ({
      ...ex,
      id: ex.id || `main_${i}`,
      duration: timings.work,
      rest: i < selected.length - 1 ? timings.rest : (includeCooldown ? 10 : 0),
      phase: 'main',
    })),
    ...cooldownExercises.map((ex, i) => ({
      ...ex,
      id: ex.id || `cooldown_${i}`,
      duration: 30,
      rest: i < cooldownExercises.length - 1 ? 5 : 0,
      phase: 'cooldown',
    })),
  ];

  const calPerMin = energy === 'high' ? 9 : energy === 'low' ? 4 : 6;
  const levelMultiplier = level === 'advanced' ? 1.15 : level === 'beginner' ? 0.85 : 1;

  return {
    id: `jt_${Date.now()}`,
    name: buildWorkoutName(parsed, profile),
    type: 'just-talk',
    description: buildWorkoutDescription(parsed, profile),
    duration,
    estimatedCalories: Math.round(duration * calPerMin * levelMultiplier),
    exercises: allWorkoutExercises,
    workDuration: timings.work,
    restDuration: timings.rest,
    parsed,
    focus: focusAreas.join(', '),
    energyLevel: energy,
    fitnessLevel: level,
    equipmentUsed: allowedEquipment,
    structure: {
      warmup: warmupExercises.length,
      main: selected.length,
      cooldown: cooldownExercises.length,
    },
  };
}

// ─── TIMINGS ──────────────────────────────────────────────────────

function getTimings(energy, level) {
  const base = {
    low: { work: 30, rest: 20 },
    medium: { work: 40, rest: 15 },
    high: { work: 45, rest: 10 },
  }[energy] || { work: 40, rest: 15 };

  // Beginners get more rest, advanced get less
  if (level === 'beginner') {
    base.work = Math.max(25, base.work - 5);
    base.rest = base.rest + 5;
  } else if (level === 'advanced') {
    base.work = base.work + 5;
    base.rest = Math.max(5, base.rest - 5);
  }

  return base;
}

// ─── NAME & DESCRIPTION ──────────────────────────────────────────

function buildWorkoutName(parsed, profile) {
  const { duration, energy, focusAreas } = parsed;
  const focusLabels = {
    upper: 'Upper Body', lower: 'Lower Body', core: 'Core', cardio: 'Cardio',
    fullBody: 'Full Body', stretch: 'Stretch & Flow', back: 'Back',
    chest: 'Chest', arms: 'Arms', shoulders: 'Shoulders', legs: 'Legs', glutes: 'Glutes',
  };
  const energyLabels = { low: 'Easy', medium: '', high: 'Intense' };
  const focusName = focusAreas.map(a => focusLabels[a] || a).slice(0, 2).join(' & ');
  const prefix = energyLabels[energy];
  return `${prefix ? prefix + ' ' : ''}${duration}-Min ${focusName}`.trim();
}

function buildWorkoutDescription(parsed, profile) {
  const { duration, energy, focusAreas } = parsed;
  const energyDesc = {
    low: 'A gentle session to keep you moving',
    medium: 'A balanced workout to challenge you',
    high: 'An intense session to push your limits',
  };
  const levelNote = profile?.fitnessLevel === 'beginner'
    ? ' Scaled for your level.'
    : profile?.fitnessLevel === 'advanced'
      ? ' Tuned for advanced training.'
      : '';
  return `${energyDesc[energy]}. ${duration} minutes of ${focusAreas.join(' & ')}.${levelNote}`;
}