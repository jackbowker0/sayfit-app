// ============================================================
// ACHIEVEMENTS SERVICE — Badge & Milestone System
//
// Defines all achievements, checks conditions after workouts,
// and persists earned badges in AsyncStorage.
//
// Achievement categories:
//   🏁 Getting Started — first-time milestones
//   🔥 Consistency — streaks and frequency
//   💪 Strength — PRs and progressive overload
//   📊 Volume — total workouts, calories, exercises
//   🧠 Smart Training — using app intelligence features
//
// Each achievement has coach-specific celebration messages
// so Sarge, Vibe, and Flow each react differently.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACHIEVEMENTS_KEY = 'sayfit_achievements';

// ---- ACHIEVEMENT DEFINITIONS ----

export const ACHIEVEMENTS = {
  // ---- 🏁 GETTING STARTED ----
  first_workout: {
    id: 'first_workout',
    name: 'First Step',
    emoji: '🏁',
    description: 'Complete your first workout',
    category: 'start',
    tier: 'bronze',
    coachMessages: {
      drill: "First workout DOWN. Now do it again tomorrow.",
      hype: "YOUR FIRST WORKOUT!! This is HUGE! 🎉🎉🎉",
      zen: "The journey of a thousand miles begins with a single step. Beautiful.",
    },
  },
  first_pr: {
    id: 'first_pr',
    name: 'Record Breaker',
    emoji: '🏆',
    description: 'Set your first personal record',
    category: 'strength',
    tier: 'bronze',
    coachMessages: {
      drill: "First PR. Remember this feeling. Chase it.",
      hype: "A PERSONAL RECORD!! You're officially a BEAST! 💪🔥",
      zen: "A new personal milestone. Growth made visible.",
    },
  },
  first_template: {
    id: 'first_template',
    name: 'Creature of Habit',
    emoji: '📋',
    description: 'Save your first workout template',
    category: 'smart',
    tier: 'bronze',
    coachMessages: {
      drill: "Smart. A plan is half the battle.",
      hype: "Template saved! Working SMARTER and harder! 🧠✨",
      zen: "A routine takes shape. Structure supports freedom.",
    },
  },
  log_weight: {
    id: 'log_weight',
    name: 'Scale Warrior',
    emoji: '⚖️',
    description: 'Log your body weight for the first time',
    category: 'start',
    tier: 'bronze',
    coachMessages: {
      drill: "Tracking weight. Good. Data drives results.",
      hype: "You're tracking your weight! Knowledge is POWER! 💪",
      zen: "Awareness of the body. A mindful practice.",
    },
  },

  // ---- 🔥 CONSISTENCY ----
  streak_3: {
    id: 'streak_3',
    name: 'Three-Peat',
    emoji: '🔥',
    description: '3-day workout streak',
    category: 'consistency',
    tier: 'bronze',
    coachMessages: {
      drill: "3 days straight. Momentum is building. DON'T STOP.",
      hype: "THREE DAYS IN A ROW! You're on FIRE! 🔥🔥🔥",
      zen: "Three days flowing. A rhythm emerges.",
    },
  },
  streak_7: {
    id: 'streak_7',
    name: 'Week Warrior',
    emoji: '⚡',
    description: '7-day workout streak',
    category: 'consistency',
    tier: 'silver',
    coachMessages: {
      drill: "7 days. SEVEN. That's a soldier right there.",
      hype: "A FULL WEEK STREAK! You're absolutely UNSTOPPABLE! ⚡⚡",
      zen: "Seven days of dedication. Your discipline is a garden in bloom.",
    },
  },
  streak_14: {
    id: 'streak_14',
    name: 'Fortnight Force',
    emoji: '💎',
    description: '14-day workout streak',
    category: 'consistency',
    tier: 'gold',
    coachMessages: {
      drill: "14 days. You're not playing around anymore.",
      hype: "TWO WEEKS STRAIGHT?! You're a LEGEND! 💎✨",
      zen: "Fourteen sunrises, fourteen practices. This is who you are now.",
    },
  },
  streak_30: {
    id: 'streak_30',
    name: 'Iron Will',
    emoji: '🏅',
    description: '30-day workout streak',
    category: 'consistency',
    tier: 'platinum',
    coachMessages: {
      drill: "30 days. Unbreakable. I have nothing but RESPECT.",
      hype: "THIRTY DAYS?! I'm literally crying! You're INCREDIBLE! 🏅😭🎉",
      zen: "Thirty days. The habit has become part of your being.",
    },
  },
  weekly_goal_hit: {
    id: 'weekly_goal_hit',
    name: 'Goal Getter',
    emoji: '🎯',
    description: 'Hit your weekly workout goal',
    category: 'consistency',
    tier: 'bronze',
    repeatable: true,
    coachMessages: {
      drill: "Weekly goal: CRUSHED. Set it higher next time.",
      hype: "YOU HIT YOUR WEEKLY GOAL! Amazing discipline! 🎯🎉",
      zen: "Your intention for the week has been fulfilled.",
    },
  },
  weekly_goal_3x: {
    id: 'weekly_goal_3x',
    name: 'Hat Trick',
    emoji: '🎩',
    description: 'Hit your weekly goal 3 weeks in a row',
    category: 'consistency',
    tier: 'silver',
    coachMessages: {
      drill: "3 weeks hitting target. Consistency is KING.",
      hype: "THREE WEEKS of hitting your goal! You're ELITE! 🎩✨",
      zen: "Three weeks of fulfilled intention. A steady flame.",
    },
  },

  // ---- 💪 STRENGTH ----
  pr_count_5: {
    id: 'pr_count_5',
    name: 'PR Machine',
    emoji: '📈',
    description: 'Set 5 personal records',
    category: 'strength',
    tier: 'silver',
    coachMessages: {
      drill: "5 PRs. You're getting STRONGER. Keep pushing.",
      hype: "FIVE personal records! You can't be stopped! 📈🔥",
      zen: "Five new peaks. Your strength grows like roots deepening.",
    },
  },
  pr_count_15: {
    id: 'pr_count_15',
    name: 'Limit Breaker',
    emoji: '💥',
    description: 'Set 15 personal records',
    category: 'strength',
    tier: 'gold',
    coachMessages: {
      drill: "15 PRs. You're rewriting what's possible.",
      hype: "FIFTEEN PRs?! You're literally REDEFINING yourself! 💥⚡",
      zen: "Fifteen barriers dissolved. The only limit was belief.",
    },
  },
  overload_used: {
    id: 'overload_used',
    name: 'Level Up',
    emoji: '⬆️',
    description: 'Follow a progressive overload suggestion',
    category: 'smart',
    tier: 'bronze',
    coachMessages: {
      drill: "You took the overload suggestion. SMART and STRONG.",
      hype: "You leveled up your weight! Progressive overload FTW! ⬆️🔥",
      zen: "Gradual progression. The wise path to strength.",
    },
  },

  // ---- 📊 VOLUME ----
  workouts_10: {
    id: 'workouts_10',
    name: 'Double Digits',
    emoji: '🔟',
    description: 'Complete 10 workouts',
    category: 'volume',
    tier: 'bronze',
    coachMessages: {
      drill: "10 workouts. You're not a beginner anymore.",
      hype: "DOUBLE DIGITS! 10 workouts in the bag! 🔟🎉",
      zen: "Ten practices complete. A foundation is forming.",
    },
  },
  workouts_25: {
    id: 'workouts_25',
    name: 'Quarter Century',
    emoji: '⭐',
    description: 'Complete 25 workouts',
    category: 'volume',
    tier: 'silver',
    coachMessages: {
      drill: "25. This isn't a phase — it's a lifestyle.",
      hype: "TWENTY-FIVE workouts! You're a STAR! ⭐✨",
      zen: "Twenty-five sessions. Your commitment speaks volumes.",
    },
  },
  workouts_50: {
    id: 'workouts_50',
    name: 'Half Century',
    emoji: '🌟',
    description: 'Complete 50 workouts',
    category: 'volume',
    tier: 'gold',
    coachMessages: {
      drill: "50 workouts. FIFTY. You're the real deal.",
      hype: "FIFTY WORKOUTS!! I can't even! You're a LEGEND! 🌟🔥",
      zen: "Fifty mindful sessions. You've transformed.",
    },
  },
  workouts_100: {
    id: 'workouts_100',
    name: 'Centurion',
    emoji: '💯',
    description: 'Complete 100 workouts',
    category: 'volume',
    tier: 'platinum',
    coachMessages: {
      drill: "100 workouts. CENTURION status. Stand TALL.",
      hype: "ONE HUNDRED WORKOUTS!! 💯💯💯 I'm SO proud of you!!",
      zen: "One hundred practices. A masterpiece of persistence.",
    },
  },
  calories_1000: {
    id: 'calories_1000',
    name: 'Burn Unit',
    emoji: '🔥',
    description: 'Burn 1,000 total calories',
    category: 'volume',
    tier: 'bronze',
    coachMessages: {
      drill: "1,000 calories torched. Keep the fire burning.",
      hype: "ONE THOUSAND calories burned total! INCREDIBLE! 🔥",
      zen: "A thousand calories transformed into energy and growth.",
    },
  },
  calories_10000: {
    id: 'calories_10000',
    name: 'Inferno',
    emoji: '🌋',
    description: 'Burn 10,000 total calories',
    category: 'volume',
    tier: 'gold',
    coachMessages: {
      drill: "10,000 calories. That's a FURNACE.",
      hype: "TEN THOUSAND CALORIES!! You're a walking INFERNO! 🌋⚡",
      zen: "Ten thousand calories released. Profound transformation.",
    },
  },

  // ---- 🧠 SMART TRAINING ----
  adapted_workout: {
    id: 'adapted_workout',
    name: 'Body Listener',
    emoji: '👂',
    description: 'Adapt 3+ exercises in a single workout',
    category: 'smart',
    tier: 'bronze',
    coachMessages: {
      drill: "You adapted. That's not weakness — that's INTELLIGENCE.",
      hype: "You listened to your body! That's the SMARTEST thing! 👂✨",
      zen: "Your body spoke and you listened. True wisdom.",
    },
  },
  diverse_muscles: {
    id: 'diverse_muscles',
    name: 'Well Rounded',
    emoji: '🎯',
    description: 'Train 6+ different muscle groups in a week',
    category: 'smart',
    tier: 'silver',
    coachMessages: {
      drill: "Full coverage. No muscle left behind. SOLID.",
      hype: "You hit EVERYTHING this week! Total balance! 🎯💪",
      zen: "Balance across the body. Harmony in training.",
    },
  },
};

// Tier colors and labels
export const TIER_CONFIG = {
  bronze: { color: '#CD7F32', label: 'Bronze', glow: '#CD7F3240' },
  silver: { color: '#C0C0C0', label: 'Silver', glow: '#C0C0C040' },
  gold: { color: '#FFD700', label: 'Gold', glow: '#FFD70040' },
  platinum: { color: '#E5E4E2', label: 'Platinum', glow: '#E5E4E240' },
};

// ---- PERSISTENCE ----

export async function getEarnedAchievements() {
  try {
    const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[Achievements] Failed to load:', e);
    return {};
  }
}

async function saveEarnedAchievements(earned) {
  try {
    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(earned));
  } catch (e) {
    console.warn('[Achievements] Failed to save:', e);
  }
}

/**
 * Award an achievement if not already earned.
 * Returns the achievement object if newly earned, null if already had it.
 */
async function award(achievementId) {
  const earned = await getEarnedAchievements();

  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return null;

  // Repeatable achievements track count
  if (achievement.repeatable) {
    const existing = earned[achievementId];
    earned[achievementId] = {
      id: achievementId,
      firstEarned: existing?.firstEarned || new Date().toISOString(),
      lastEarned: new Date().toISOString(),
      count: (existing?.count || 0) + 1,
    };
    await saveEarnedAchievements(earned);
    return { ...achievement, count: earned[achievementId].count };
  }

  // Non-repeatable: skip if already earned
  if (earned[achievementId]) return null;

  earned[achievementId] = {
    id: achievementId,
    earnedAt: new Date().toISOString(),
  };
  await saveEarnedAchievements(earned);
  return achievement;
}

// ---- CHECK FUNCTIONS ----

/**
 * Check all achievements after a workout completes.
 * Called from CompleteScreen with the current workout data + memory.
 *
 * @param {object} params
 * @param {object} params.stats - { calories, exercisesCompleted, adaptations }
 * @param {object} params.memory - from buildMemorySummary()
 * @param {string[]} params.newPRs - array of new PRs from this session
 * @param {number} params.weeklyGoal - user's weekly goal
 * @returns {object[]} Array of newly earned achievements
 */
export async function checkAchievements({ stats, memory, newPRs = [], weeklyGoal = 4 }) {
  const newlyEarned = [];

  // Helper to try awarding and collect results
  const tryAward = async (id) => {
    const result = await award(id);
    if (result) newlyEarned.push(result);
  };

  // 🏁 First workout
  if (memory.totalWorkouts === 1) {
    await tryAward('first_workout');
  }

  // 🏆 First PR
  if (newPRs.length > 0) {
    const earned = await getEarnedAchievements();
    if (!earned.first_pr) {
      await tryAward('first_pr');
    }
  }

  // 🔥 Streaks
  if (memory.streak >= 3) await tryAward('streak_3');
  if (memory.streak >= 7) await tryAward('streak_7');
  if (memory.streak >= 14) await tryAward('streak_14');
  if (memory.streak >= 30) await tryAward('streak_30');

  // 🎯 Weekly goal
  if (memory.thisWeekCount >= weeklyGoal) {
    await tryAward('weekly_goal_hit');
  }

  // 📊 Workout count milestones
  if (memory.totalWorkouts >= 10) await tryAward('workouts_10');
  if (memory.totalWorkouts >= 25) await tryAward('workouts_25');
  if (memory.totalWorkouts >= 50) await tryAward('workouts_50');
  if (memory.totalWorkouts >= 100) await tryAward('workouts_100');

  // 🔥 Calorie milestones
  if (memory.totalCalories >= 1000) await tryAward('calories_1000');
  if (memory.totalCalories >= 10000) await tryAward('calories_10000');

  // 💪 PR count milestones
  const prs = await getPRCount();
  if (prs >= 5) await tryAward('pr_count_5');
  if (prs >= 15) await tryAward('pr_count_15');

  // 👂 Adapted workout (3+ adaptations in one session)
  if (stats.adaptations >= 3) {
    await tryAward('adapted_workout');
  }

  // 🎯 Diverse muscles (6+ groups in a week)
  const muscleCount = Object.keys(memory.muscleBreakdown || {}).length;
  if (muscleCount >= 6) {
    await tryAward('diverse_muscles');
  }

  return newlyEarned;
}

/**
 * Check non-workout achievements (template saved, weight logged, etc.)
 * Call this from specific actions.
 */
export async function checkActionAchievement(action) {
  switch (action) {
    case 'template_saved': return await award('first_template');
    case 'weight_logged': return await award('log_weight');
    case 'overload_used': return await award('overload_used');
    default: return null;
  }
}

// ---- HELPERS ----

async function getPRCount() {
  try {
    const raw = await AsyncStorage.getItem('sayfit_prs');
    const prs = raw ? JSON.parse(raw) : {};
    return Object.keys(prs).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Get all achievements with earned status for display.
 */
export async function getAllAchievementsWithStatus() {
  const earned = await getEarnedAchievements();

  return Object.values(ACHIEVEMENTS).map(a => ({
    ...a,
    earned: !!earned[a.id],
    earnedAt: earned[a.id]?.earnedAt || earned[a.id]?.firstEarned || null,
    count: earned[a.id]?.count || 0,
  }));
}

/**
 * Get recently earned achievements (last 7 days) for dashboard display.
 */
export async function getRecentAchievements(days = 7) {
  const earned = await getEarnedAchievements();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return Object.entries(earned)
    .filter(([_, data]) => {
      const date = new Date(data.earnedAt || data.lastEarned);
      return date >= cutoff;
    })
    .map(([id, data]) => ({
      ...ACHIEVEMENTS[id],
      ...data,
    }))
    .filter(a => a.name) // filter out any orphaned entries
    .sort((a, b) => new Date(b.earnedAt || b.lastEarned) - new Date(a.earnedAt || a.lastEarned));
}

/**
 * Get achievement stats for profile/settings display.
 */
export async function getAchievementStats() {
  const earned = await getEarnedAchievements();
  const total = Object.keys(ACHIEVEMENTS).filter(k => !ACHIEVEMENTS[k].repeatable).length;
  const unlocked = Object.keys(earned).filter(k => ACHIEVEMENTS[k] && !ACHIEVEMENTS[k].repeatable).length;

  return {
    total,
    unlocked,
    percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0,
    earned,
  };
}

/**
 * Clear all achievements (for settings danger zone).
 */
export async function clearAchievements() {
  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, '{}');
}