/**
 * SayFit — AI-Powered Workout Generator
 *
 * Sends user request + profile + memory + exercise library to Claude
 * via Supabase Edge Function. Claude picks exercises from the library,
 * client hydrates full exercise data from the EXERCISES constant.
 */

import { EXERCISES } from '../constants/exercises';
import { getUserProfile, buildProfilePromptString } from './userProfile';
import { buildMemorySummary } from './storage';

// ─── SUPABASE CONFIG ─────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const WORKOUT_GEN_ENDPOINT = `${SUPABASE_URL}/functions/v1/workout-gen`;

// ─── EQUIPMENT MAPPING ──────────────────────────────────────────
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

// ─── PARSING ────────────────────────────────────────────────────

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

// ─── AI WORKOUT GENERATION ──────────────────────────────────────

export async function generateSmartWorkout(parsed) {
  const profile = await getUserProfile();
  const memory = await buildMemorySummary();

  const allowedEquipment = getAllowedEquipment(profile?.equipment);

  // Try AI generation if Supabase is configured
  if (SUPABASE_URL && SUPABASE_URL !== 'https://YOUR_PROJECT_REF.supabase.co' && SUPABASE_ANON_KEY) {
    try {
      const condensedExercises = getCondensedExerciseList(allowedEquipment);
      const system = buildWorkoutSystemPrompt();
      const prompt = buildWorkoutUserPrompt(
        parsed.rawInput || '', parsed, profile, memory, condensedExercises
      );

      const response = await fetch(WORKOUT_GEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ system, prompt, max_tokens: 1500 }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Workout generation failed: ${errData.error || response.status}`);
      }

      const data = await response.json();
      const rawText = data.text || '';
      const aiWorkout = parseAIResponse(rawText);
      return hydrateWorkout(aiWorkout, parsed, profile, allowedEquipment);
    } catch (e) {
      console.warn('[WorkoutGen] AI generation failed, falling back to local:', e.message);
    }
  }

  // Local fallback — rule-based generator, works offline
  return generateLocalWorkout(parsed, profile, allowedEquipment);
}

// Async regenerate (used by Shuffle button)
export async function generateWorkout(parsed) {
  return generateSmartWorkout(parsed);
}

// No-op; kept for API compatibility with JustTalkScreen
export async function initGeneratorCache() {}

// ─── CONDENSED EXERCISE LIST ────────────────────────────────────

function getCondensedExerciseList(allowedEquipment) {
  return EXERCISES
    .filter(ex => allowedEquipment.includes(ex.equipment))
    .map(ex => ({
      id: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      equipment: ex.equipment,
      category: ex.category,
      intensity: ex.intensity,
    }));
}

// ─── AI PROMPT BUILDERS ─────────────────────────────────────────

function buildWorkoutSystemPrompt() {
  return `You are a workout generator for a fitness app. You select exercises from a provided library to create structured workouts.

RESPOND WITH ONLY A JSON OBJECT. No markdown, no explanation, no code fences.

The JSON must have this exact shape:
{
  "name": "string - short workout name like 'Easy 20-Min Core'",
  "description": "string - one sentence description",
  "estimatedCalories": number,
  "workDuration": number (seconds per main exercise),
  "restDuration": number (seconds rest between main exercises),
  "exercises": [
    {
      "id": "exercise-id-from-library",
      "phase": "warmup" | "main" | "cooldown",
      "duration": number (seconds),
      "rest": number (seconds, 0 for last exercise in workout)
    }
  ]
}

RULES:
- ONLY use exercise IDs from the provided library. Never invent exercises.
- Include 2-3 warmup exercises (category "warmup", 30s each, 5s rest) if duration >= 10 min.
- Include 2-3 cooldown exercises (category "cooldown", 30s each, 5s rest) if duration >= 12 min.
- Main exercises should be category "strength" or "cardio".
- Match exercise intensity to the user's energy level and fitness level.
- Avoid repeating the same muscle group back-to-back unless specifically requested.
- Deprioritize recently-trained muscles (provided in context).
- Prioritize neglected muscles when the user hasn't specified a focus.
- Beginner: work 25-35s, rest 15-25s. Intermediate: work 35-45s, rest 10-20s. Advanced: work 40-50s, rest 5-15s.
- Last exercise should have rest: 0.
- The workout should fill the requested duration.`;
}

function buildWorkoutUserPrompt(rawInput, parsed, profile, memory, condensedExercises) {
  const profileString = buildProfilePromptString(profile);
  const memoryParts = [];

  if (memory?.recentWorkouts?.length > 0) {
    const recentMuscles = memory.recentWorkouts
      .slice(0, 3)
      .map(w => w.muscles?.join(', ') || 'unknown')
      .join('; ');
    memoryParts.push(`Recent workouts hit: ${recentMuscles}`);
  }
  if (memory?.neglectedMuscles?.length > 0) {
    memoryParts.push(`Neglected muscles (not trained in 14+ days): ${memory.neglectedMuscles.join(', ')}`);
  }
  if (memory?.streak > 0) {
    memoryParts.push(`Current streak: ${memory.streak} days`);
  }

  return `USER REQUEST: "${rawInput}"

PARSED PARAMETERS:
- Duration: ${parsed.duration} minutes
- Energy level: ${parsed.energy}
- Focus areas: ${parsed.focusAreas.join(', ')}

USER PROFILE:
${profileString || 'No profile available.'}
- Fitness level: ${profile?.fitnessLevel || 'intermediate'}
- Equipment: ${profile?.equipment?.join(', ') || 'bodyweight'}

WORKOUT HISTORY:
${memoryParts.length > 0 ? memoryParts.join('\n') : 'No workout history yet.'}
- Total workouts completed: ${memory?.totalWorkouts || 0}

AVAILABLE EXERCISES (use ONLY these IDs):
${JSON.stringify(condensedExercises)}`;
}

// ─── RESPONSE PARSING & HYDRATION ───────────────────────────────

function parseAIResponse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (e) {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        // fall through
      }
    }
    throw new Error('Failed to parse AI workout response as JSON');
  }
}

function hydrateWorkout(aiWorkout, parsed, profile, allowedEquipment) {
  const exerciseMap = new Map(EXERCISES.map(ex => [ex.id, ex]));

  const hydratedExercises = (aiWorkout.exercises || [])
    .map(aiEx => {
      const fullEx = exerciseMap.get(aiEx.id);
      if (!fullEx) {
        console.warn(`[WorkoutGen] Unknown exercise ID: ${aiEx.id}, skipping`);
        return null;
      }
      return {
        ...fullEx,
        duration: aiEx.duration || fullEx.duration,
        rest: aiEx.rest ?? 15,
        phase: aiEx.phase || 'main',
      };
    })
    .filter(Boolean);

  if (hydratedExercises.length === 0) {
    throw new Error('AI returned no valid exercises');
  }

  const level = profile?.fitnessLevel || 'intermediate';
  const warmupCount = hydratedExercises.filter(e => e.phase === 'warmup').length;
  const mainCount = hydratedExercises.filter(e => e.phase === 'main').length;
  const cooldownCount = hydratedExercises.filter(e => e.phase === 'cooldown').length;

  return {
    id: `jt_${Date.now()}`,
    name: aiWorkout.name || buildWorkoutName(parsed, profile),
    type: 'just-talk',
    description: aiWorkout.description || buildWorkoutDescription(parsed, profile),
    duration: parsed.duration,
    estimatedCalories: aiWorkout.estimatedCalories || Math.round(parsed.duration * 6),
    exercises: hydratedExercises,
    workDuration: aiWorkout.workDuration || 40,
    restDuration: aiWorkout.restDuration || 15,
    parsed,
    focus: parsed.focusAreas.join(', '),
    energyLevel: parsed.energy,
    fitnessLevel: level,
    equipmentUsed: allowedEquipment,
    structure: {
      warmup: warmupCount,
      main: mainCount,
      cooldown: cooldownCount,
    },
  };
}

// ─── LOCAL FALLBACK GENERATOR ────────────────────────────────────

const FOCUS_TO_MUSCLE = {
  upper:    ['Arms', 'Chest', 'Shoulders', 'Back'],
  lower:    ['Legs', 'Glutes'],
  core:     ['Core'],
  cardio:   ['Legs', 'Core', 'Full Body'],
  fullBody: ['Legs', 'Core', 'Arms', 'Chest', 'Back', 'Glutes', 'Shoulders'],
  stretch:  ['Full Body', 'Core'],
  back:     ['Back'],
  chest:    ['Chest'],
  shoulders:['Shoulders'],
  glutes:   ['Glutes'],
};

function generateLocalWorkout(parsed, profile, allowedEquipment) {
  const { duration, energy, focusAreas } = parsed;
  const level = profile?.fitnessLevel || 'intermediate';

  // Work/rest timing by level
  const timing = {
    beginner:     { work: 30, rest: 20, warmupRest: 8 },
    intermediate: { work: 40, rest: 15, warmupRest: 5 },
    advanced:     { work: 50, rest: 10, warmupRest: 5 },
  }[level] || { work: 40, rest: 15, warmupRest: 5 };

  // Intensity filter
  const intensityRange = { low: [1, 5], medium: [4, 7], high: [6, 10] }[energy] || [4, 7];

  // Target muscles from focus areas
  const targetMuscles = new Set(
    focusAreas.flatMap(f => FOCUS_TO_MUSCLE[f] || ['Full Body'])
  );

  const pool = EXERCISES.filter(ex =>
    allowedEquipment.includes(ex.equipment) &&
    ex.intensity >= intensityRange[0] &&
    ex.intensity <= intensityRange[1] &&
    (targetMuscles.has(ex.muscle) || targetMuscles.has('Full Body'))
  );

  // Shuffle pool
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Figure out how many exercises fit the duration
  const cycleTime = timing.work + timing.rest;
  const includeWarmup = duration >= 10;
  const includeCooldown = duration >= 12;
  const warmupSlots = includeWarmup ? 2 : 0;
  const cooldownSlots = includeCooldown ? 2 : 0;
  const mainSeconds = duration * 60 - (warmupSlots * (30 + timing.warmupRest)) - (cooldownSlots * (30 + timing.warmupRest));
  const mainCount = Math.max(3, Math.floor(mainSeconds / cycleTime));

  // Pick warmup/cooldown exercises
  const warmupPool = EXERCISES.filter(ex => ex.category === 'warmup' && allowedEquipment.includes(ex.equipment));
  const cooldownPool = EXERCISES.filter(ex => ex.category === 'cooldown' && allowedEquipment.includes(ex.equipment));

  const warmupExercises = warmupPool.sort(() => Math.random() - 0.5).slice(0, warmupSlots).map(ex => ({
    ...ex, duration: 30, rest: timing.warmupRest, phase: 'warmup',
  }));
  const cooldownExercises = cooldownPool.sort(() => Math.random() - 0.5).slice(0, cooldownSlots).map(ex => ({
    ...ex, duration: 30, rest: timing.warmupRest, phase: 'cooldown',
  }));

  // Pick main exercises, avoid back-to-back same muscle
  const mainExercises = [];
  let lastMuscle = '';
  for (const ex of shuffled) {
    if (mainExercises.length >= mainCount) break;
    if (ex.muscle === lastMuscle && mainExercises.length < mainCount - 1) continue;
    mainExercises.push({ ...ex, duration: timing.work, rest: timing.rest, phase: 'main' });
    lastMuscle = ex.muscle;
  }
  // Fill remaining slots if muscle-alternation filtered too many
  if (mainExercises.length < mainCount) {
    for (const ex of shuffled) {
      if (mainExercises.length >= mainCount) break;
      if (mainExercises.find(e => e.id === ex.id)) continue;
      mainExercises.push({ ...ex, duration: timing.work, rest: timing.rest, phase: 'main' });
    }
  }

  const allExercises = [...warmupExercises, ...mainExercises, ...cooldownExercises];
  if (allExercises.length > 0) allExercises[allExercises.length - 1].rest = 0;

  const estCalories = Math.round(duration * (energy === 'high' ? 8 : energy === 'low' ? 4 : 6));

  return {
    id: `local_${Date.now()}`,
    name: buildWorkoutName(parsed, profile),
    type: 'just-talk',
    description: buildWorkoutDescription(parsed, profile),
    duration,
    estimatedCalories: estCalories,
    exercises: allExercises,
    workDuration: timing.work,
    restDuration: timing.rest,
    parsed,
    focus: focusAreas.join(', '),
    energyLevel: energy,
    fitnessLevel: level,
    equipmentUsed: allowedEquipment,
    structure: {
      warmup: warmupExercises.length,
      main: mainExercises.length,
      cooldown: cooldownExercises.length,
    },
  };
}

// ─── NAME & DESCRIPTION (fallback if AI doesn't provide) ────────

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
