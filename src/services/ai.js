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
import { getUserProfile, buildProfilePromptString } from './userProfile';

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

/**
 * Check if the AI service is available (proxy configured)
 */
export function isAIAvailable() {
  return !!SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR_PROJECT_REF');
}