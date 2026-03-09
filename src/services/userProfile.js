// ============================================================
// USER PROFILE SERVICE — Stores onboarding & preferences
//
// Saves: name, fitness level, goals, equipment, coach choice,
//        workout days, weekly goal, units, rest duration
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = 'sayfit_user_profile';
const ONBOARDED_KEY = 'sayfit_onboarded';

export async function hasOnboarded() {
  try {
    const val = await AsyncStorage.getItem(ONBOARDED_KEY);
    return val === 'true';
  } catch (e) {
    return false;
  }
}

export async function setOnboarded() {
  await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
}

export async function getUserProfile() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return getDefaultProfile();
    return { ...getDefaultProfile(), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('[Profile] Failed to load:', e);
    return getDefaultProfile();
  }
}

export async function saveUserProfile(updates) {
  try {
    const current = await getUserProfile();
    const merged = { ...current, ...updates };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn('[Profile] Failed to save:', e);
    return null;
  }
}

export async function resetOnboarding() {
  await AsyncStorage.removeItem(ONBOARDED_KEY);
  await AsyncStorage.removeItem(PROFILE_KEY);
}

function getDefaultProfile() {
  return {
    name: '',
    fitnessLevel: 'intermediate',
    goals: [],
    equipment: ['bodyweight'],
    coachId: 'hype',
    weeklyGoal: 4,
    units: 'lbs',
    restDuration: 90,
    workoutDays: [],  // [0,1,2,3,4,5,6] where 0=Mon, 6=Sun
    notificationsEnabled: false,
    reminderHour: 18,
  };
}

// ---- DAY OPTIONS ----
export const DAY_OPTIONS = [
  { id: 0, short: 'M', label: 'Monday' },
  { id: 1, short: 'T', label: 'Tuesday' },
  { id: 2, short: 'W', label: 'Wednesday' },
  { id: 3, short: 'T', label: 'Thursday' },
  { id: 4, short: 'F', label: 'Friday' },
  { id: 5, short: 'S', label: 'Saturday' },
  { id: 6, short: 'S', label: 'Sunday' },
];

// ---- GOAL OPTIONS ----
export const GOAL_OPTIONS = [
  { id: 'muscle', emoji: '💪', iconName: 'muscle', label: 'Build Muscle' },
  { id: 'lose_weight', emoji: '🔥', iconName: 'lose_weight', label: 'Lose Weight' },
  { id: 'toned', emoji: '✨', iconName: 'toned', label: 'Get Toned' },
  { id: 'active', emoji: '🏃', iconName: 'active', label: 'Stay Active' },
  { id: 'flexibility', emoji: '🧘', iconName: 'flexibility', label: 'Flexibility' },
  { id: 'endurance', emoji: '🫀', iconName: 'endurance', label: 'Endurance' },
  { id: 'strength', emoji: '🏋️', iconName: 'strength', label: 'Get Stronger' },
];

// ---- EQUIPMENT OPTIONS ----
export const EQUIPMENT_OPTIONS = [
  { id: 'bodyweight', emoji: '🤸', iconName: 'bodyweight', label: 'Bodyweight Only' },
  { id: 'dumbbells', emoji: '🏋️', iconName: 'dumbbells', label: 'Dumbbells' },
  { id: 'bands', emoji: '🔗', iconName: 'bands', label: 'Resistance Bands' },
  { id: 'full_gym', emoji: '🏢', iconName: 'full_gym', label: 'Full Gym' },
];

// ---- FITNESS LEVELS ----
export const FITNESS_LEVELS = [
  { id: 'beginner', emoji: '🌱', iconName: 'beginner', label: 'Beginner', desc: 'New to working out or getting back into it' },
  { id: 'intermediate', emoji: '🔥', iconName: 'intermediate', label: 'Intermediate', desc: 'Consistent for a few months, know the basics' },
  { id: 'advanced', emoji: '⚡', iconName: 'advanced', label: 'Advanced', desc: 'Years of training, pushing for PRs' },
];

/**
 * Check if today is a planned workout day
 */
export function isTodayWorkoutDay(workoutDays) {
  if (!workoutDays || workoutDays.length === 0) return null; // no plan set
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon...
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon, 6=Sun
  return workoutDays.includes(dayIndex);
}

/**
 * Check if a specific day index (0=Mon) is a planned workout day
 */
export function isDayPlanned(workoutDays, dayIndex) {
  if (!workoutDays || workoutDays.length === 0) return false;
  return workoutDays.includes(dayIndex);
}

/**
 * Get the next planned workout day from today
 * Returns: { dayName, daysUntil } or null
 */
export function getNextWorkoutDay(workoutDays) {
  if (!workoutDays || workoutDays.length === 0) return null;
  const jsDay = new Date().getDay();
  const today = jsDay === 0 ? 6 : jsDay - 1;

  for (let i = 1; i <= 7; i++) {
    const check = (today + i) % 7;
    if (workoutDays.includes(check)) {
      return {
        dayName: DAY_OPTIONS[check].label,
        daysUntil: i,
      };
    }
  }
  return null;
}

/**
 * Build a profile summary string for AI prompts
 */
export function buildProfilePromptString(profile) {
  if (!profile || !profile.name) return '';

  const parts = [];
  parts.push(`Their name is ${profile.name}.`);
  parts.push(`Fitness level: ${profile.fitnessLevel}.`);

  if (profile.goals.length > 0) {
    const goalLabels = profile.goals.map(g =>
      GOAL_OPTIONS.find(o => o.id === g)?.label || g
    );
    parts.push(`Goals: ${goalLabels.join(', ')}.`);
  }

  if (profile.equipment.length > 0) {
    const eqLabels = profile.equipment.map(e =>
      EQUIPMENT_OPTIONS.find(o => o.id === e)?.label || e
    );
    parts.push(`Equipment: ${eqLabels.join(', ')}.`);
  }

  if (profile.workoutDays && profile.workoutDays.length > 0) {
    const dayLabels = profile.workoutDays.map(d => DAY_OPTIONS[d]?.label || '').filter(Boolean);
    parts.push(`Planned workout days: ${dayLabels.join(', ')}.`);
  }

  return parts.join(' ');
}