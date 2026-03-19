// ============================================================
// RECOVERY SERVICE — Muscle group fatigue & recovery tracking
//
// Tracks per-muscle-group training volume after each workout,
// estimates recovery status based on elapsed time + intensity,
// and provides recommendations for what to train next.
//
// Recovery model (simplified):
//   Light session  (intensity 1-4):  24-36hr recovery
//   Moderate session (intensity 5-7): 48-60hr recovery
//   Heavy session  (intensity 8-10): 72-96hr recovery
//
// Key exports:
//   recordMuscleLoad(muscles, avgIntensity)  — call after workout
//   getRecoveryStatus()                       — per-muscle recovery %
//   getRecoveryRecommendation(coachId)        — coach-flavored advice
//   getReadySummary()                         — quick "what's ready" list
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sayfit_recovery';

// All trackable muscle groups (matches exercises.js)
const ALL_MUSCLES = ['Legs', 'Chest', 'Core', 'Back', 'Shoulders', 'Glutes', 'Arms', 'Cardio'];

// Recovery hours by intensity tier
const RECOVERY_HOURS = {
  light:    { min: 24, max: 36 },   // intensity 1-4
  moderate: { min: 48, max: 60 },   // intensity 5-7
  heavy:    { min: 72, max: 96 },   // intensity 8-10
};

function getIntensityTier(intensity) {
  if (intensity >= 8) return 'heavy';
  if (intensity >= 5) return 'moderate';
  return 'light';
}

function getRecoveryHours(intensity) {
  const tier = getIntensityTier(intensity);
  const { min, max } = RECOVERY_HOURS[tier];
  // Use midpoint as default recovery time
  return (min + max) / 2;
}

// ─── STORAGE ──────────────────────────────────────────────────

async function getRecoveryData() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[Recovery] Failed to load:', e);
    return {};
  }
}

async function saveRecoveryData(data) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Recovery] Failed to save:', e);
  }
}

// ─── RECORD ───────────────────────────────────────────────────

/**
 * Record muscle load after a workout completes.
 * @param {string[]} muscles - Muscle groups trained (e.g. ['Legs', 'Core'])
 * @param {number} avgIntensity - Average workout intensity (1-10)
 * @param {number} [energyLevel] - User's self-reported energy (1-10, optional)
 */
export async function recordMuscleLoad(muscles, avgIntensity, energyLevel = null) {
  if (!muscles || muscles.length === 0) return;

  const data = await getRecoveryData();
  const now = Date.now();

  for (const muscle of muscles) {
    const existing = data[muscle];
    const recoveryHrs = getRecoveryHours(avgIntensity);

    // If user reported low energy, recovery takes longer
    const energyMultiplier = energyLevel && energyLevel <= 3 ? 1.3 : 1;

    data[muscle] = {
      lastTrained: now,
      intensity: avgIntensity,
      recoveryHours: recoveryHrs * energyMultiplier,
      // Stack fatigue if training same muscle before fully recovered
      stacked: existing && getMuscleFatigue(existing, now) > 0.2,
    };
  }

  await saveRecoveryData(data);
}

// ─── CALCULATE ────────────────────────────────────────────────

/**
 * Get fatigue level for a single muscle entry (0 = fresh, 1 = fully fatigued)
 */
function getMuscleFatigue(entry, now) {
  if (!entry || !entry.lastTrained) return 0;

  const hoursSince = (now - entry.lastTrained) / (1000 * 60 * 60);
  const recoveryHrs = entry.recoveryHours || 48;

  // Stacked sessions take 25% longer to recover
  const effectiveRecovery = entry.stacked ? recoveryHrs * 1.25 : recoveryHrs;

  const fatigue = Math.max(0, 1 - (hoursSince / effectiveRecovery));
  return Math.round(fatigue * 100) / 100;
}

/**
 * Get recovery status for all muscle groups.
 * Returns object with per-muscle recovery percentage (0-100%).
 * 100% = fully recovered, 0% = just trained.
 */
export async function getRecoveryStatus() {
  const data = await getRecoveryData();
  const now = Date.now();
  const status = {};

  for (const muscle of ALL_MUSCLES) {
    const entry = data[muscle];
    if (!entry) {
      status[muscle] = { recovery: 100, label: 'fresh', lastTrained: null };
    } else {
      const fatigue = getMuscleFatigue(entry, now);
      const recovery = Math.round((1 - fatigue) * 100);

      let label;
      if (recovery >= 90) label = 'fresh';
      else if (recovery >= 70) label = 'ready';
      else if (recovery >= 40) label = 'recovering';
      else label = 'fatigued';

      status[muscle] = {
        recovery,
        label,
        lastTrained: entry.lastTrained,
        intensity: entry.intensity,
        hoursSince: Math.round((now - entry.lastTrained) / (1000 * 60 * 60)),
      };
    }
  }

  return status;
}

/**
 * Get muscles sorted by readiness (most recovered first).
 */
export async function getReadySummary() {
  const status = await getRecoveryStatus();

  const sorted = Object.entries(status)
    .sort((a, b) => b[1].recovery - a[1].recovery)
    .map(([muscle, info]) => ({ muscle, ...info }));

  return {
    fresh: sorted.filter(m => m.label === 'fresh'),
    ready: sorted.filter(m => m.label === 'ready'),
    recovering: sorted.filter(m => m.label === 'recovering'),
    fatigued: sorted.filter(m => m.label === 'fatigued'),
    all: sorted,
  };
}

// ─── COACH RECOMMENDATIONS ────────────────────────────────────

/**
 * Get a coach-flavored recovery recommendation string.
 * Used in AI prompt context and JustTalk suggestions.
 */
export async function getRecoveryRecommendation(coachId) {
  const summary = await getReadySummary();

  const freshNames = summary.fresh.map(m => m.muscle);
  const readyNames = summary.ready.map(m => m.muscle);
  const fatiguedNames = summary.fatigued.map(m => m.muscle);
  const recoveringNames = summary.recovering.map(m => m.muscle);

  // Nothing tracked yet
  if (summary.fresh.length === ALL_MUSCLES.length) {
    return null;
  }

  const suggest = [...freshNames, ...readyNames].slice(0, 3);
  const avoid = [...fatiguedNames].slice(0, 2);

  const lines = [];

  if (suggest.length > 0) {
    lines.push({
      drill: `Ready to train: ${suggest.join(', ')}. No excuses.`,
      hype: `${suggest.join(', ')} are fresh and READY to go! 💪`,
      zen: `${suggest.join(', ')} have recovered well and welcome attention.`,
    }[coachId] || `Ready: ${suggest.join(', ')}`);
  }

  if (avoid.length > 0) {
    lines.push({
      drill: `${avoid.join(', ')} — still recovering. Don't be stupid about it.`,
      hype: `${avoid.join(', ')} might need a little more rest — trust the process!`,
      zen: `${avoid.join(', ')} are still restoring. Patience serves you here.`,
    }[coachId] || `Recovering: ${avoid.join(', ')}`);
  }

  if (recoveringNames.length > 0 && recoveringNames.length <= 3) {
    lines.push({
      drill: `${recoveringNames.join(', ')} — getting there. Light work only if you must.`,
      hype: `${recoveringNames.join(', ')} are almost back! Maybe light stuff if you're feeling it!`,
      zen: `${recoveringNames.join(', ')} are in the process of renewal.`,
    }[coachId] || `Recovering: ${recoveringNames.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Build a recovery context string for AI prompts.
 * Concise format that fits into the coach prompt.
 */
export async function buildRecoveryPromptString() {
  const status = await getRecoveryStatus();
  const parts = [];

  for (const muscle of ALL_MUSCLES) {
    const info = status[muscle];
    if (info.lastTrained) {
      parts.push(`${muscle}: ${info.recovery}% recovered (${info.label}, ${info.hoursSince}h ago)`);
    }
  }

  if (parts.length === 0) return '';

  return `MUSCLE RECOVERY STATUS:\n${parts.join('\n')}`;
}

/**
 * Store the user's self-reported energy/readiness level.
 * Used to adjust recovery estimates and inform the coach.
 */
export async function saveReadinessCheckIn(energyLevel) {
  try {
    await AsyncStorage.setItem('sayfit_readiness', JSON.stringify({
      energy: energyLevel,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('[Recovery] Failed to save readiness:', e);
  }
}

/**
 * Get the most recent readiness check-in (if within last 12 hours).
 */
export async function getRecentReadiness() {
  try {
    const raw = await AsyncStorage.getItem('sayfit_readiness');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const hoursSince = (Date.now() - data.timestamp) / (1000 * 60 * 60);
    if (hoursSince > 12) return null;
    return data;
  } catch (e) {
    return null;
  }
}
