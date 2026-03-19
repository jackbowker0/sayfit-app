// ============================================================
// PROGRESSIVE OVERLOAD SERVICE — Automated strength progression
//
// Analyzes exercise history to detect:
//   1. Readiness to increase weight (hit all reps 2-3 sessions)
//   2. Stalls (no progress in 3-4 weeks)
//   3. Deload needs (accumulated fatigue or multiple stalls)
//
// Delivers coach-personality-appropriate suggestions.
//
// Uses data from exerciseLog.js — no new storage keys.
// ============================================================

import { getExerciseHistory, getExerciseSummaries, getPRs } from './exerciseLog';

// ─── THRESHOLDS ───────────────────────────────────────────────

const CONFIG = {
  // How many consecutive sessions at the same weight before suggesting increase
  sessionsBeforeIncrease: 2,
  // How many weeks with no weight increase = stall
  stallWeeks: 3,
  // How many stalled exercises before suggesting deload
  stallsBeforeDeload: 2,
  // Weeks of hard training before suggesting deload
  weeksBeforeDeload: 5,
  // Weight increase amounts (lbs)
  increments: {
    light: 2.5,    // < 50 lbs
    medium: 5,     // 50-135 lbs
    heavy: 5,      // 135-225 lbs
    veryHeavy: 10, // 225+ lbs
  },
};

function getIncrement(weight) {
  if (weight < 50) return CONFIG.increments.light;
  if (weight < 135) return CONFIG.increments.medium;
  if (weight < 225) return CONFIG.increments.heavy;
  return CONFIG.increments.veryHeavy;
}

// ─── ANALYSIS ─────────────────────────────────────────────────

/**
 * Analyze a single exercise for progressive overload signals.
 * Returns: { status, suggestion, data }
 *   status: 'increase' | 'stall' | 'progressing' | 'new' | 'bodyweight'
 */
export async function analyzeExercise(exerciseName) {
  const history = await getExerciseHistory(exerciseName);

  if (history.length === 0) {
    return { status: 'new', suggestion: null, data: null };
  }

  const latest = history[history.length - 1];

  // Skip bodyweight exercises (no weight to progress)
  if (latest.bestWeight <= 0) {
    return { status: 'bodyweight', suggestion: null, data: null };
  }

  const currentWeight = latest.bestWeight;
  const currentReps = latest.totalReps / latest.totalSets;

  // Count consecutive sessions at the same weight
  let consecutiveSame = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].bestWeight === currentWeight) {
      consecutiveSame++;
    } else {
      break;
    }
  }

  // Check if all recent sets hit target reps (clean completion)
  const recentSets = latest.sets || [];
  const avgReps = recentSets.length > 0
    ? recentSets.reduce((s, set) => s + (set.reps || 0), 0) / recentSets.length
    : currentReps;
  const hitAllReps = avgReps >= 5; // At least 5 reps avg = can handle the weight

  // Detect stall: same weight for many sessions over weeks
  const stallThreshold = CONFIG.stallWeeks * 7 * 24 * 60 * 60 * 1000;
  const oldestSameWeight = history.filter(h => h.bestWeight === currentWeight);
  const timeAtWeight = oldestSameWeight.length >= 2
    ? Date.now() - new Date(oldestSameWeight[0].date).getTime()
    : 0;
  const isStalled = consecutiveSame >= 4 && timeAtWeight > stallThreshold;

  // Ready to increase: hit target reps for 2+ sessions at same weight
  const readyToIncrease = consecutiveSame >= CONFIG.sessionsBeforeIncrease && hitAllReps && !isStalled;

  const increment = getIncrement(currentWeight);

  if (isStalled) {
    return {
      status: 'stall',
      suggestion: {
        currentWeight,
        currentReps: Math.round(avgReps),
        sessionsAtWeight: consecutiveSame,
        weeksAtWeight: Math.round(timeAtWeight / (7 * 24 * 60 * 60 * 1000)),
      },
      data: { history: history.slice(-6), latest },
    };
  }

  if (readyToIncrease) {
    return {
      status: 'increase',
      suggestion: {
        currentWeight,
        suggestedWeight: currentWeight + increment,
        increment,
        currentReps: Math.round(avgReps),
        sessionsAtWeight: consecutiveSame,
      },
      data: { history: history.slice(-6), latest },
    };
  }

  return {
    status: 'progressing',
    suggestion: {
      currentWeight,
      currentReps: Math.round(avgReps),
      sessionsAtWeight: consecutiveSame,
      sessionsUntilIncrease: Math.max(0, CONFIG.sessionsBeforeIncrease - consecutiveSame),
    },
    data: { history: history.slice(-6), latest },
  };
}

/**
 * Analyze all tracked exercises and return overload recommendations.
 * Returns: { increases: [], stalls: [], needsDeload: bool, deloadReason: string }
 */
export async function analyzeAllExercises() {
  const summaries = await getExerciseSummaries();
  const increases = [];
  const stalls = [];
  const progressing = [];

  for (const summary of summaries) {
    // Only analyze exercises with enough history (3+ sessions)
    if (summary.sessionCount < 3) continue;

    const analysis = await analyzeExercise(summary.name);

    if (analysis.status === 'increase') {
      increases.push({
        name: summary.name,
        ...analysis.suggestion,
      });
    } else if (analysis.status === 'stall') {
      stalls.push({
        name: summary.name,
        ...analysis.suggestion,
      });
    } else if (analysis.status === 'progressing') {
      progressing.push({
        name: summary.name,
        ...analysis.suggestion,
      });
    }
  }

  // Deload detection
  const needsDeload = stalls.length >= CONFIG.stallsBeforeDeload;
  let deloadReason = '';
  if (needsDeload) {
    deloadReason = `${stalls.length} exercises have stalled — time for a recovery week`;
  }

  return {
    increases,
    stalls,
    progressing,
    needsDeload,
    deloadReason,
    totalTracked: summaries.filter(s => s.sessionCount >= 3).length,
  };
}

// ─── COACH-FLAVORED MESSAGES ──────────────────────────────────

/**
 * Get coach-personality increase message for a specific exercise.
 */
export function getIncreaseMessage(coachId, exerciseName, currentWeight, suggestedWeight) {
  return {
    drill: `You've owned ${currentWeight} on ${exerciseName}. ${suggestedWeight} today. No discussion.`,
    hype: `YOOO you've been CRUSHING ${currentWeight} on ${exerciseName}!! Time to level up — ${suggestedWeight} is calling!! 🚀`,
    zen: `You've found steady ground at ${currentWeight} on ${exerciseName}. Your body is ready for ${suggestedWeight}. Trust the process.`,
  }[coachId] || `Ready to move up to ${suggestedWeight} on ${exerciseName}.`;
}

/**
 * Get coach-personality stall message for a specific exercise.
 */
export function getStallMessage(coachId, exerciseName, weeksAtWeight) {
  return {
    drill: `${exerciseName} has been stuck for ${weeksAtWeight} weeks. We're changing the approach. Drop the weight, add reps, then build back.`,
    hype: `Hey so ${exerciseName} has been plateaued ${weeksAtWeight} weeks — that's OKAY! Let's try a different rep range or variation to break through! 💪`,
    zen: `${exerciseName} has remained unchanged for ${weeksAtWeight} weeks. Sometimes progress requires stepping back — try a lighter weight with more control.`,
  }[coachId] || `${exerciseName} has stalled for ${weeksAtWeight} weeks. Consider a variation or rep scheme change.`;
}

/**
 * Get coach-personality deload message.
 */
export function getDeloadMessage(coachId) {
  return {
    drill: `Stand down, soldier. Deload week. 70% across the board. I don't want to see you grinding. That's an order.`,
    hype: `Recovery week!! Think of it as charging up your batteries for your BIGGEST lifts yet!! Trust me on this one! 🔋`,
    zen: `The body grows in rest, not in strain. This week we pull back to 70% and let adaptation happen. Patience is strength.`,
  }[coachId] || 'Time for a deload week. Drop to 70% and focus on form.';
}

/**
 * Build a progressive overload context string for AI prompts.
 */
export async function buildOverloadPromptString() {
  try {
    const analysis = await analyzeAllExercises();
    const parts = [];

    if (analysis.increases.length > 0) {
      const names = analysis.increases.slice(0, 3).map(e =>
        `${e.name}: ${e.currentWeight} → ${e.suggestedWeight}lbs`
      );
      parts.push(`READY TO INCREASE WEIGHT:\n${names.join('\n')}`);
    }

    if (analysis.stalls.length > 0) {
      const names = analysis.stalls.slice(0, 3).map(e =>
        `${e.name}: stuck at ${e.currentWeight}lbs for ${e.weeksAtWeight}+ weeks`
      );
      parts.push(`STALLED EXERCISES:\n${names.join('\n')}`);
    }

    if (analysis.needsDeload) {
      parts.push(`DELOAD RECOMMENDED: ${analysis.deloadReason}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : '';
  } catch (e) {
    console.warn('[ProgressiveOverload] Failed to build prompt:', e);
    return '';
  }
}
