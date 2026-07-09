// ============================================================
// AI SERVICE — Generates dynamic coach responses via Supabase proxy
// 
// IMPORTANT: This no longer calls Anthropic directly.
// All AI requests go through your Supabase Edge Function,
// which holds the API key server-side. Your key is SAFE.
//
// Memory + Profile: coaches know your history, name, fitness
// level, goals, and equipment. Full personalization.
//
// Falls back to memory-aware template responses if proxy unavailable.
// ============================================================

import { COACHES, getFallbackResponse } from '../constants/coaches';
import { buildMemorySummary, buildCoachMemoryString } from './storage';
import { getUserProfile, buildProfilePromptString, getMacroTargets } from './userProfile';
import { getNutritionStats } from './nutrition';
import { getWeightStats } from './bodyWeight';
import { getPRs } from './exerciseLog';
import { getProtocolStats, hasAcknowledgedProtocolDisclaimer } from './protocol';
import { estimateTDEE } from './energy';

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// ---- CONFIGURATION ----
// Replace with your actual Supabase project URL
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const COACH_ENDPOINT = `${SUPABASE_URL}/functions/v1/coach`;

// Cache memory + profile so we don't hit AsyncStorage every message
let _memoryCache = null;
let _profileCache = null;
let _memoryCacheTime = 0;
const MEMORY_CACHE_TTL = 30000; // 30 seconds

async function getMemory() {
  const now = Date.now();
  if (_memoryCache && now - _memoryCacheTime < MEMORY_CACHE_TTL) {
    return _memoryCache;
  }
  _memoryCache = await buildMemorySummary();
  _memoryCacheTime = now;
  return _memoryCache;
}

async function getProfile() {
  const now = Date.now();
  if (_profileCache && now - _memoryCacheTime < MEMORY_CACHE_TTL) {
    return _profileCache;
  }
  _profileCache = await getUserProfile();
  return _profileCache;
}

// Track whether the last response used a fallback (offline/unconfigured)
let _lastResponseWasFallback = false;
export function wasLastResponseFallback() { return _lastResponseWasFallback; }

// Call this when a workout completes to bust the cache
export function invalidateMemoryCache() {
  _memoryCache = null;
  _profileCache = null;
  _memoryCacheTime = 0;
}

/**
 * Generate an AI coach response with memory + profile context
 */
export async function getCoachResponse(coachId, command, context = {}) {
  const coach = COACHES[coachId];
  if (!coach) return getFallbackResponse('hype', command);

  // Load memory + profile
  const memory = await getMemory();
  const profile = await getProfile();

  // If no Supabase config, use fallbacks
  if (!SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_PROJECT_REF')) {
    if (__DEV__) console.log('[AI] Supabase not configured — using fallbacks');
    _lastResponseWasFallback = true;
    return getMemoryEnhancedFallback(coachId, command, memory, profile);
  }

  try {
    const prompt = buildPrompt(coach, coachId, command, context, memory, profile);

    const response = await fetch(COACH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.warn('[AI] Proxy error, using fallback:', response.status);
      _lastResponseWasFallback = true;
      return getMemoryEnhancedFallback(coachId, command, memory, profile);
    }

    const data = await response.json();
    const text = data.text?.trim();

    if (!text) {
      _lastResponseWasFallback = true;
      return getMemoryEnhancedFallback(coachId, command, memory, profile);
    }

    _lastResponseWasFallback = false;
    return text;
  } catch (error) {
    console.warn('[AI] Request failed, using fallback:', error.message);
    _lastResponseWasFallback = true;
    return getMemoryEnhancedFallback(coachId, command, memory, profile);
  }
}

/**
 * Build the prompt with memory + profile context
 */
function buildPrompt(coach, coachId, command, context, memory, profile) {
  const {
    exerciseName = 'the exercise',
    exerciseIntensity = 7,
    exercisesCompleted = 0,
    totalExercises = 6,
    heartRate = 130,
    adaptations = 0,
  } = context;

  const commandDescriptions = {
    harder: 'The user wants MORE intensity. They want to be pushed harder.',
    easier: 'The user needs it EASIER. The exercise has been modified to be less intense.',
    swap: `The exercise has been swapped to ${exerciseName}. Acknowledge the new exercise.`,
    skip: 'The user skipped the exercise. Moving to the next one.',
    tired: 'The user said they\'re tired. The remaining workout has been reduced in intensity.',
    pause: 'The user paused the workout for a break.',
    resume: 'The user is resuming the workout after a pause.',
    start: `The workout is starting. First exercise: ${exerciseName}.`,
    complete: `${exerciseName} is complete! Great work on this one.`,
  };

  const memoryString = buildCoachMemoryString(coachId, memory);
  const profileString = buildProfilePromptString(profile);

  return `${coach.personality}

${profileString ? `WHO YOU'RE COACHING:\n${profileString}\n` : ''}
${memoryString ? `WHAT YOU REMEMBER ABOUT THEM:\n${memoryString}\n` : ''}
You are coaching someone through a workout. Here's the current situation:
- Current exercise: ${exerciseName} (intensity ${exerciseIntensity}/10)
- Progress: ${exercisesCompleted}/${totalExercises} exercises done
- Heart rate: ${heartRate} BPM
- Times workout has adapted: ${adaptations}
- Their total workouts ever: ${memory.totalWorkouts}
- Their fitness level: ${profile?.fitnessLevel || 'unknown'}

What just happened: ${commandDescriptions[command] || 'The user gave a voice command.'}

Respond in 1-2 SHORT sentences (under 20 words total). Stay completely in character.
${profile?.name ? `Use their name "${profile.name}" occasionally (not every time — maybe 1 in 3 responses).` : ''}
You can occasionally reference what you remember about them (streaks, patterns, past workouts) when it feels natural — don't force it every time.
Tailor intensity and language to their fitness level (${profile?.fitnessLevel || 'intermediate'}).
${profile?.equipment?.length > 0 ? `They have access to: ${profile.equipment.join(', ')}. Only suggest exercises they can do.` : ''}
Do not use quotation marks around your response. Just speak directly.`;
}

/**
 * Memory-enhanced fallback responses (no API needed)
 */
function getMemoryEnhancedFallback(coachId, command, memory, profile) {
  const base = getFallbackResponse(coachId, command);

  // If we have a name, occasionally personalize even fallbacks (30% chance)
  let personalized = base;
  if (profile?.name && Math.random() < 0.3) {
    personalized = personalizeWithName(base, profile.name, coachId);
  }

  // 40% chance to prepend a memory reference (don't overdo it)
  if (!memory || memory.isFirstWorkout || Math.random() > 0.4) {
    return personalized;
  }

  const prefix = getMemoryPrefix(coachId, command, memory);
  if (!prefix) return personalized;

  return `${prefix} ${personalized}`;
}

/**
 * Add the user's name to a fallback response in a coach-appropriate way
 */
function personalizeWithName(response, name, coachId) {
  switch (coachId) {
    case 'drill':
      return `${response.split('.')[0]}, ${name}.${response.includes('.') ? response.slice(response.indexOf('.') + 1) : ''}`;
    case 'hype':
      return `${name}! ${response}`;
    case 'zen':
      return `${name}, ${response.charAt(0).toLowerCase()}${response.slice(1)}`;
    default:
      return response;
  }
}

/**
 * Generate a short memory-based prefix for fallback responses
 */
function getMemoryPrefix(coachId, command, memory) {
  if (command === 'start') {
    if (memory.streak >= 3) {
      return {
        drill: `Day ${memory.streak} of the streak.`,
        hype: `${memory.streak}-day streak! 🔥`,
        zen: `Day ${memory.streak} of your practice.`,
      }[coachId];
    }
    if (memory.daysSinceLast >= 3) {
      return {
        drill: `${memory.daysSinceLast} days since I saw you.`,
        hype: `Welcome back after ${memory.daysSinceLast} days!`,
        zen: `${memory.daysSinceLast} days of rest. Welcome back.`,
      }[coachId];
    }
    if (memory.lastWorkout?.name) {
      return {
        drill: `After that ${memory.lastWorkout.name} session —`,
        hype: `After crushing ${memory.lastWorkout.name} —`,
        zen: `Following your ${memory.lastWorkout.name} session —`,
      }[coachId];
    }
  }

  if (command === 'complete' && memory.totalWorkouts > 0 && memory.totalWorkouts % 5 === 0) {
    return {
      drill: `Workout #${memory.totalWorkouts + 1}.`,
      hype: `Workout #${memory.totalWorkouts + 1}!`,
      zen: `Session ${memory.totalWorkouts + 1}.`,
    }[coachId];
  }

  if (command === 'easier' && memory.commandPatterns?.easier > 3) {
    return { drill: "Again?", hype: "All good!", zen: "Listening to your body." }[coachId];
  }

  if (command === 'harder' && memory.commandPatterns?.harder > 3) {
    return { drill: "Knew you'd say that.", hype: "Classic you!", zen: "As expected." }[coachId];
  }

  return null;
}

/**
 * Get a memory-aware greeting for the home screen or just talk
 */
export async function getCoachGreeting(coachId) {
  // Normalize once: an unknown/stale coachId would make every dictionary
  // lookup below return undefined and render "undefined" in the UI.
  if (!COACHES[coachId]) coachId = 'hype';
  const memory = await getMemory();
  const profile = await getProfile();
  const name = profile?.name || '';

  if (memory.isFirstWorkout) {
    return {
      drill: name ? `${name}. First time? Good. Let's see what you've got.` : "First time? Good. Let's see what you've got.",
      hype: name ? `Welcome to SayFit, ${name}! You're going to LOVE this! ✨` : "Welcome to SayFit! You're going to LOVE this! ✨",
      zen: name ? `Welcome, ${name}. Let's begin your journey together.` : "Welcome. Let's begin your journey together.",
    }[coachId] || "Welcome to SayFit!";
  }

  if (memory.streak >= 7) {
    return {
      drill: `${memory.streak}-day streak${name ? `, ${name}` : ''}. Don't you DARE break it today.`,
      hype: `${memory.streak} DAYS IN A ROW${name ? `, ${name}` : ''}! You're actually insane! 🔥🔥`,
      zen: `${memory.streak} days of unbroken practice${name ? `, ${name}` : ''}. Your dedication is beautiful.`,
    }[coachId];
  }

  if (memory.daysSinceLast >= 7) {
    return {
      drill: `${memory.daysSinceLast} days${name ? `, ${name}` : ''}. You think I forgot? Get in here.`,
      hype: `OMG ${name ? name + ' is' : "you're"} back!! I missed you! Let's make today amazing! 💪`,
      zen: `${memory.daysSinceLast} days of rest${name ? `, ${name}` : ''}. Your mat is ready when you are.`,
    }[coachId];
  }

  if (memory.daysSinceLast >= 3) {
    return {
      drill: `${memory.daysSinceLast} days off${name ? `, ${name}` : ''}. Time to pay up, soldier.`,
      hype: `${memory.daysSinceLast} days away — but ${name ? name + "'s" : "you're"} HERE now! Let's go! ⚡`,
      zen: `Welcome back after ${memory.daysSinceLast} days${name ? `, ${name}` : ''}. Shall we flow?`,
    }[coachId];
  }

  if (memory.lastWorkout?.name) {
    return {
      drill: `Back after "${memory.lastWorkout.name}"${name ? `, ${name}` : ''}. Ready for round two?`,
      hype: `${name ? name + ', you' : 'You'} crushed "${memory.lastWorkout.name}" last time! What's today? 🎯`,
      zen: `After your "${memory.lastWorkout.name}" session${name ? `, ${name}` : ''}... what calls to you today?`,
    }[coachId];
  }

  if (memory.neglectedMuscles.length > 0) {
    const neglected = memory.neglectedMuscles[0];
    return {
      drill: `${name ? name + ', you' : "You"}'ve been dodging ${neglected}. Not today.`,
      hype: `How about some ${neglected} love today${name ? `, ${name}` : ''}? Mix it up! ✨`,
      zen: `Your ${neglected.toLowerCase()} area may welcome some attention today${name ? `, ${name}` : ''}.`,
    }[coachId];
  }

  return {
    drill: `${name ? name + '. ' : ''}You know the drill. Let's work.`,
    hype: `${name ? name + '! ' : ''}Ready for something awesome? Let's GO! 🔥`,
    zen: `${name ? 'Welcome, ' + name + '. ' : 'Welcome. '}Let's find your flow today.`,
  }[coachId];
}

// ============================================================
// DATA-GROUNDED COACH — the "narrator" rebuild
// ------------------------------------------------------------
// askCoach answers a free-text question by first assembling the
// user's REAL numbers (training, PRs, nutrition, body weight,
// protocol adherence) into a snapshot, then prompting the model to
// cite those numbers, stay specific, take corrections, and route
// anything medical to their provider. This is the opposite of the
// old canned "Motivate me" command — it does something the user
// can't do themselves (read across all their data) and outputs
// something specific and checkable.
// ============================================================

// Compact, factual snapshot of everything the coach can see. Honest by design:
// missing data is stated as missing, never fabricated.
async function buildCoachDataSnapshot(memory, profile) {
  const units = profile?.units || 'lbs';
  const targets = await getMacroTargets().catch(() => ({}));
  const [nStats, wStats, prs, pStats, pAck, tdee] = await Promise.all([
    getNutritionStats(targets).catch(() => null),
    getWeightStats().catch(() => null),
    getPRs().catch(() => ({})),
    getProtocolStats().catch(() => null),
    hasAcknowledgedProtocolDisclaimer().catch(() => false),
    estimateTDEE().catch(() => null),
  ]);

  const lines = [];

  // Training
  if (memory && !memory.isFirstWorkout) {
    const t = [`${memory.totalWorkouts} workouts total`, `${memory.thisWeekCount} this week`];
    if (memory.streak > 0) t.push(`${memory.streak}-day streak`);
    let s = 'Training: ' + t.join(', ') + '.';
    if (memory.lastWorkout?.name) s += ` Last: "${memory.lastWorkout.name}"${memory.daysSinceLast != null ? ` ${memory.daysSinceLast}d ago` : ''}.`;
    if (memory.neglectedMuscles?.length) s += ` Under-trained: ${memory.neglectedMuscles.slice(0, 3).join(', ')}.`;
    lines.push(s);
  } else {
    lines.push('Training: no workouts logged yet.');
  }

  // Top PRs by weight
  const prList = Object.entries(prs || {})
    .filter(([, v]) => v?.maxWeight > 0)
    .sort((a, b) => b[1].maxWeight - a[1].maxWeight)
    .slice(0, 5)
    .map(([name, v]) => `${name} ${v.maxWeight}${units}`);
  if (prList.length) lines.push('PRs: ' + prList.join(', ') + '.');

  // Nutrition today
  if (nStats && (nStats.mealCount > 0 || (nStats.totals && nStats.totals.kcal > 0))) {
    const tt = nStats.totals || {};
    const tg = nStats.targets || {};
    let s = `Nutrition today: ${tt.kcal || 0}${tg.kcal ? '/' + tg.kcal : ''} kcal, ${tt.protein || 0}${tg.protein ? '/' + tg.protein : ''}g protein.`;
    if (nStats.pendingCount > 0) s += ` ${nStats.pendingCount} meal(s) pending review.`;
    lines.push(s);
  } else {
    lines.push('Nutrition: nothing logged today.');
  }

  // Body weight + trend
  if (wStats && wStats.current != null) {
    let s = `Body weight: ${wStats.current}${units}`;
    if (wStats.weekChange != null) s += `, ${wStats.weekChange >= 0 ? '+' : ''}${round1(wStats.weekChange)} this week`;
    if (wStats.monthChange != null) s += `, ${wStats.monthChange >= 0 ? '+' : ''}${round1(wStats.monthChange)} this month`;
    lines.push(s + '.');
  }

  // Adaptive maintenance estimate (back-calculated from their own data).
  if (tdee) lines.push(`Estimated maintenance: ~${tdee.tdee} kcal/day (from ${tdee.loggedDays} logged days${tdee.confidence === 'low' ? ', rough' : ''}).`);

  // Protocol adherence — FACTS ONLY, and only once the disclaimer is acknowledged.
  if (pAck && pStats) {
    const parts = [];
    if (pStats.injectionDueToday) parts.push('a dose is due today');
    else if (pStats.scheduledCount) parts.push('doses done for today');
    if (pStats.supplementsTotal > 0) parts.push(`supplements ${pStats.supplementsDone}/${pStats.supplementsTotal}`);
    if (parts.length) lines.push('Protocol: ' + parts.join(', ') + '. (State these facts only — never give medical or dosing advice.)');
  }

  return lines.join('\n');
}

// Offline/errored fallback — still grounded in a real fact, never generic hype.
function coachDataFallback(memory) {
  const bits = [];
  if (memory && !memory.isFirstWorkout) {
    if (memory.streak > 0) bits.push(`${memory.streak}-day streak`);
    bits.push(`${memory.thisWeekCount} workout${memory.thisWeekCount === 1 ? '' : 's'} this week`);
    if (memory.neglectedMuscles?.length) bits.push(`${memory.neglectedMuscles[0]} could use work`);
  }
  const fact = bits.length ? bits.join(', ') + '.' : 'Log a workout or a meal and I can read your numbers.';
  return `${fact} (Offline — reconnect for a full read.)`;
}

/**
 * Answer a free-text question grounded in the user's real data.
 * @param {string} coachId
 * @param {string} userMessage
 * @param {{history?: Array<{q:string,a:string}>}} opts recent Q/A turns for context
 */
export async function askCoach(coachId, userMessage, { history = [] } = {}) {
  if (!COACHES[coachId]) coachId = 'hype';
  const coach = COACHES[coachId];
  const memory = await getMemory();
  const profile = await getProfile();

  if (!isAIAvailable()) {
    _lastResponseWasFallback = true;
    return coachDataFallback(memory);
  }

  try {
    const snapshot = await buildCoachDataSnapshot(memory, profile);
    const profileString = buildProfilePromptString(profile);
    const historyBlock = (history || [])
      .slice(-4)
      .map((m) => `User: ${m.q}\n${coach.name}: ${m.a}`)
      .join('\n');

    const prompt = `${coach.personality}

You are ${coach.name}, this person's coach inside the SayFit app. You can see their REAL data below.
${profileString ? '\nWHO: ' + profileString + '\n' : ''}
DATA SNAPSHOT (real numbers — cite these; never invent others):
${snapshot}

RULES:
- Ground every claim in the numbers above and cite specific figures. If the data doesn't answer their question, say what's missing — never make up numbers.
- Be specific and useful. No empty hype or generic motivation.
- If they correct you, accept it and adjust.
- MEDICAL SAFETY: never recommend, calculate, or change any medication/peptide/hormone dose, and never give medical advice. You may state the tracking facts shown above. For anything about doses, symptoms, or bloodwork, tell them to check with their healthcare provider.
- 2-4 sentences, in ${coach.name}'s voice. No quotation marks.
${historyBlock ? '\nRecent conversation:\n' + historyBlock + '\n' : ''}
User: ${userMessage}
${coach.name}:`;

    const response = await fetch(COACH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ prompt, max_tokens: 300 }),
    });
    if (!response.ok) { _lastResponseWasFallback = true; return coachDataFallback(memory); }
    const data = await response.json();
    const text = data.text?.trim();
    if (!text) { _lastResponseWasFallback = true; return coachDataFallback(memory); }
    _lastResponseWasFallback = false;
    return text;
  } catch (error) {
    console.warn('[AI] askCoach failed:', error.message);
    _lastResponseWasFallback = true;
    return coachDataFallback(memory);
  }
}

/**
 * Check if the AI service is available (proxy configured)
 */
export function isAIAvailable() {
  return !!SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR_PROJECT_REF');
}