// ============================================================
// STORAGE SERVICE — Coach Memory & Workout History Intelligence
//
// Reads workout history from AsyncStorage and builds structured
// memory summaries that coaches can reference. This is what makes
// coaches feel "alive" — they remember your patterns, celebrate
// your streaks, and call out what you've been avoiding.
//
// Coach-specific memory:
//   Sarge — tracks debts, skipped muscles, unfinished business
//   Vibe  — celebrates streaks, PRs, milestones
//   Flow  — notices patterns, balance, mindful observations
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateChallengeProgress } from './challenges';

const STORAGE_KEY = 'sayfit_history';

// ---- READ / WRITE ----

export async function getWorkoutHistory() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[Storage] Failed to load history:', e);
    return [];
  }
}

export async function saveWorkout(workoutData) {
  try {
    const history = await getWorkoutHistory();
    const entry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      ...workoutData,
    };
    history.push(entry);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    // Update any active challenge progress in the background
    updateChallengeProgress(entry).catch(e =>
      console.warn('[Storage] Challenge progress update failed:', e)
    );

    return entry;
  } catch (e) {
    console.warn('[Storage] Failed to save workout:', e);
    return null;
  }
}

export async function deleteWorkout(workoutId) {
  try {
    const history = await getWorkoutHistory();
    const filtered = history.filter(w => w.id !== workoutId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.warn('[Storage] Failed to delete workout:', e);
    return false;
  }
}

export async function clearWorkoutHistory() {
  await AsyncStorage.setItem(STORAGE_KEY, '[]');
}

// ---- ANALYSIS HELPERS ----

function getRecentWorkouts(history, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return history.filter(w => new Date(w.date) >= cutoff);
}

function getMuscleBreakdown(workouts) {
  const counts = {};
  workouts.forEach(w => {
    if (w.muscles && Array.isArray(w.muscles)) {
      w.muscles.forEach(m => {
        counts[m] = (counts[m] || 0) + 1;
      });
    }
  });
  return counts;
}

function getStreak(history) {
  if (history.length === 0) return 0;

  const uniqueDays = [...new Set(
    history.map(w => {
      const d = new Date(w.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  )].sort((a, b) => b - a);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  const yesterdayTime = todayTime - 86400000;

  if (uniqueDays[0] !== todayTime && uniqueDays[0] !== yesterdayTime) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    if (uniqueDays[i] === uniqueDays[i - 1] - 86400000) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getCommandPatterns(workouts) {
  const commands = {};
  workouts.forEach(w => {
    if (w.commands && Array.isArray(w.commands)) {
      w.commands.forEach(cmd => {
        commands[cmd] = (commands[cmd] || 0) + 1;
      });
    }
  });
  return commands;
}

function getTopMuscles(muscleCounts, n = 3) {
  return Object.entries(muscleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([muscle]) => muscle);
}

function getNeglectedMuscles(muscleCounts) {
  const allMuscles = ['Legs', 'Chest', 'Core', 'Back', 'Shoulders', 'Glutes', 'Arms', 'Cardio'];
  const trained = Object.keys(muscleCounts);
  return allMuscles.filter(m => !trained.includes(m));
}

function getAverageIntensity(workouts) {
  const withEnergy = workouts.filter(w => w.energyLevel);
  if (withEnergy.length === 0) return null;
  return Math.round(
    withEnergy.reduce((sum, w) => sum + w.energyLevel, 0) / withEnergy.length
  );
}

function getLastWorkout(history) {
  if (history.length === 0) return null;
  return history[history.length - 1];
}

function daysSinceLastWorkout(history) {
  const last = getLastWorkout(history);
  if (!last) return null;
  const diff = Date.now() - new Date(last.date).getTime();
  return Math.floor(diff / 86400000);
}

// ---- BUILD MEMORY SUMMARY ----

/**
 * Build a structured memory object from workout history.
 * Used by the AI prompt builder and Dashboard.
 */
export async function buildMemorySummary() {
  const history = await getWorkoutHistory();

  if (history.length === 0) {
    return {
      totalWorkouts: 0,
      isFirstWorkout: true,
      streak: 0,
      recentWorkouts: [],
      muscleBreakdown: {},
      topMuscles: [],
      neglectedMuscles: [],
      commandPatterns: {},
      averageIntensity: null,
      lastWorkout: null,
      daysSinceLast: null,
      thisWeekCount: 0,
      totalCalories: 0,
      totalAdaptations: 0,
    };
  }

  const recentWeek = getRecentWorkouts(history, 7);
  const recentTwoWeeks = getRecentWorkouts(history, 14);
  const muscleCounts = getMuscleBreakdown(recentTwoWeeks);

  return {
    totalWorkouts: history.length,
    isFirstWorkout: false,
    streak: getStreak(history),
    recentWorkouts: history.slice(-5).reverse(),
    muscleBreakdown: muscleCounts,
    topMuscles: getTopMuscles(muscleCounts),
    neglectedMuscles: getNeglectedMuscles(muscleCounts),
    commandPatterns: getCommandPatterns(recentWeek),
    averageIntensity: getAverageIntensity(recentWeek),
    lastWorkout: getLastWorkout(history),
    daysSinceLast: daysSinceLastWorkout(history),
    thisWeekCount: recentWeek.length,
    totalCalories: history.reduce((sum, w) => sum + (w.calories || 0), 0),
    totalAdaptations: history.reduce((sum, w) => sum + (w.adaptations || 0), 0),
  };
}

// ---- COACH-SPECIFIC MEMORY STRINGS ----

/**
 * Generate a memory string tailored to a specific coach's personality.
 * Used in AI prompts to give the coach "memory."
 */
export function buildCoachMemoryString(coachId, memory) {
  if (memory.isFirstWorkout) {
    return {
      drill: "This is their FIRST workout ever. Make it count. Set the tone — tough but fair.",
      hype: "OMG this is their very FIRST workout! Make them feel amazing for showing up!",
      zen: "This is their first session. Welcome them gently. Every journey begins with one step.",
    }[coachId] || '';
  }

  const parts = [];

  // Streak
  if (memory.streak >= 7) {
    parts.push({
      drill: `They have a ${memory.streak}-day streak. RESPECT. That's real discipline.`,
      hype: `${memory.streak}-DAY STREAK! They're absolutely on FIRE right now!`,
      zen: `${memory.streak} consecutive days of practice. A beautiful rhythm has formed.`,
    }[coachId]);
  } else if (memory.streak >= 3) {
    parts.push({
      drill: `${memory.streak}-day streak going. Don't let them break it.`,
      hype: `${memory.streak} days in a row! The momentum is REAL!`,
      zen: `${memory.streak} days of consistent practice. The habit is taking root.`,
    }[coachId]);
  }

  // Days since last workout
  if (memory.daysSinceLast >= 3 && memory.daysSinceLast < 7) {
    parts.push({
      drill: `It's been ${memory.daysSinceLast} days since their last workout. Time to get back at it.`,
      hype: `They've been away ${memory.daysSinceLast} days — welcome them back with ENERGY!`,
      zen: `${memory.daysSinceLast} days of rest. Their body may be ready for movement again.`,
    }[coachId]);
  } else if (memory.daysSinceLast >= 7) {
    parts.push({
      drill: `${memory.daysSinceLast} days MIA. They owe you. Time to collect.`,
      hype: `It's been ${memory.daysSinceLast} days! SO glad they're back! No judgment, just vibes!`,
      zen: `${memory.daysSinceLast} days since their last session. Welcome them back without pressure.`,
    }[coachId]);
  }

  // Last workout reference
  if (memory.lastWorkout) {
    const last = memory.lastWorkout;
    if (last.name) {
      parts.push({
        drill: `Last workout was "${last.name}" — ${last.exerciseCount || '?'} exercises, ${last.calories || 0} cals.`,
        hype: `Last time they did "${last.name}" and burned ${last.calories || 0} calories!`,
        zen: `Their previous session was "${last.name}" — ${last.exerciseCount || 'several'} movements.`,
      }[coachId]);
    }
  }

  // Muscle patterns
  if (memory.topMuscles.length > 0) {
    parts.push({
      drill: `They've been hitting ${memory.topMuscles.join(', ')} most. ${memory.neglectedMuscles.length > 0 ? `Neglecting: ${memory.neglectedMuscles.join(', ')}. Call it out.` : 'Solid coverage.'}`,
      hype: `They love ${memory.topMuscles.join(' and ')} workouts! ${memory.neglectedMuscles.length > 0 ? `Maybe suggest some ${memory.neglectedMuscles[0]} love?` : 'Great variety!'}`,
      zen: `They've gravitated toward ${memory.topMuscles.join(', ')}. ${memory.neglectedMuscles.length > 0 ? `${memory.neglectedMuscles.join(', ')} could use attention for balance.` : 'A balanced practice.'}`,
    }[coachId]);
  }

  // Command patterns (what they tend to do during workouts)
  const cmds = memory.commandPatterns;
  if (cmds.easier > (cmds.harder || 0) + 2) {
    parts.push({
      drill: "They've been going easier a lot lately. Time to push them.",
      hype: "They've been taking it easy — that's okay! Maybe gently encourage pushing a bit more.",
      zen: "They've been choosing gentler modifications. Honor this while encouraging growth.",
    }[coachId]);
  } else if ((cmds.harder || 0) > (cmds.easier || 0) + 2) {
    parts.push({
      drill: "They keep asking for harder. A real fighter. Give them what they want.",
      hype: "They keep wanting MORE! This person is an absolute BEAST!",
      zen: "They consistently seek greater challenge. Channel this energy wisely.",
    }[coachId]);
  }

  // Milestones
  if (memory.totalWorkouts === 10 || memory.totalWorkouts === 25 || memory.totalWorkouts === 50 || memory.totalWorkouts === 100) {
    parts.push({
      drill: `MILESTONE: Workout #${memory.totalWorkouts}. Acknowledge it. Then get to work.`,
      hype: `THIS IS WORKOUT #${memory.totalWorkouts}!! Make it a HUGE celebration! 🎉`,
      zen: `This is session number ${memory.totalWorkouts}. A meaningful milestone on their journey.`,
    }[coachId]);
  }

  // Weekly progress
  if (memory.thisWeekCount > 0) {
    parts.push({
      drill: `${memory.thisWeekCount} workouts this week so far. ${memory.thisWeekCount >= 4 ? 'Strong week.' : 'Room for more.'}`,
      hype: `${memory.thisWeekCount} workouts already this week! ${memory.thisWeekCount >= 4 ? 'INCREDIBLE week!' : 'Keep the momentum going!'}`,
      zen: `${memory.thisWeekCount} sessions this week. ${memory.thisWeekCount >= 4 ? 'A dedicated week.' : 'Each session matters.'}`,
    }[coachId]);
  }

  return parts.join('\n');
}

// ---- CACHE INVALIDATION ----
export function invalidateMemoryCache() {
  // no-op — placeholder for future caching
}