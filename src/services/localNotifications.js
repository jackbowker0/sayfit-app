// ============================================================
// LOCAL NOTIFICATIONS — Workout reminders & inactivity nudges
//
// Schedules three types of local (on-device) notifications:
//   1. Workout day reminders — weekly repeating on scheduled days
//   2. Inactivity nudge — fires 3 days after last workout
//   3. Streak at risk — fires at 8 PM if streak ≥ 2 and no workout today
// ============================================================

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWorkoutHistory, buildMemorySummary } from './storage';
import { getUserProfile } from './userProfile';

const IDS_KEY = 'sayfit_local_notif_ids';

// Map from app workoutDay (0=Mon…6=Sun) to expo-notifications weekday (1=Sun…7=Sat)
const toExpoWeekday = (day) => (day === 6 ? 1 : day + 2);

const COACH_MESSAGES = {
  workout_reminder: {
    drill: 'No excuses. Time to train.',
    hype:  "Let's get it! Your best workout is waiting!",
    zen:   'Your body is ready. Time to move.',
  },
  inactivity_nudge: {
    drill: "3 days. Don't let the work disappear.",
    hype:  "You've been away 3 days — come back stronger!",
    zen:   'Rest is good. Coming back is better.',
  },
  streak_at_risk: {
    drill: "Your streak ends tonight. Don't let it.",
    hype:  'Keep the streak alive! One workout left today.',
    zen:   'Your streak is worth protecting. Just move.',
  },
};

/**
 * Cancel all previously scheduled local notifications.
 */
export async function cancelAllWorkoutReminders() {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    if (!raw) return;
    const ids = JSON.parse(raw);
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
    await AsyncStorage.removeItem(IDS_KEY);
  } catch (e) {
    // silent — nothing to cancel
  }
}

/**
 * Schedule (or reschedule) all workout reminders based on current profile + history.
 * Safe to call repeatedly — always cancels old notifications before scheduling new ones.
 */
export async function scheduleWorkoutReminders() {
  try {
    const profile = await getUserProfile();

    if (!profile.notificationsEnabled) {
      await cancelAllWorkoutReminders();
      return;
    }

    // Check / request permission
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        await cancelAllWorkoutReminders();
        return;
      }
    }

    // Cancel previously scheduled local notifications
    await cancelAllWorkoutReminders();

    const coachId = profile.coachId || 'hype';
    const reminderHour = profile.reminderHour ?? 18;
    const workoutDays = profile.workoutDays || [];
    const scheduledIds = [];

    // ── 1. Workout day reminders (weekly repeating) ──────────────
    for (const day of workoutDays) {
      const body = COACH_MESSAGES.workout_reminder[coachId] || COACH_MESSAGES.workout_reminder.hype;
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'SayFit',
          body,
          data: { type: 'workout_reminder' },
        },
        trigger: {
          weekday: toExpoWeekday(day),
          hour: reminderHour,
          minute: 0,
          repeats: true,
        },
      });
      scheduledIds.push(id);
    }

    // ── 2. Inactivity nudge (3 days from last workout) ───────────
    const history = await getWorkoutHistory();
    const last = history.length > 0 ? history[history.length - 1] : null;
    if (last) {
      const fireAt = new Date(last.date).getTime() + 3 * 86400000;
      if (fireAt > Date.now()) {
        const body = COACH_MESSAGES.inactivity_nudge[coachId] || COACH_MESSAGES.inactivity_nudge.hype;
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'SayFit',
            body,
            data: { type: 'inactivity_nudge' },
          },
          trigger: { date: new Date(fireAt) },
        });
        scheduledIds.push(id);
      }
    }

    // ── 3. Streak at risk (today at 8 PM) ───────────────────────
    const memory = await buildMemorySummary();
    const todayStr = new Date().toDateString();
    const workedOutToday = history.some(w => new Date(w.date).toDateString() === todayStr);
    if ((memory.streak || 0) >= 2 && !workedOutToday) {
      const eightPM = new Date();
      eightPM.setHours(20, 0, 0, 0);
      if (eightPM > new Date()) {
        const body = COACH_MESSAGES.streak_at_risk[coachId] || COACH_MESSAGES.streak_at_risk.hype;
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'SayFit',
            body,
            data: { type: 'streak_at_risk' },
          },
          trigger: { date: eightPM },
        });
        scheduledIds.push(id);
      }
    }

    // Save IDs for future cancellation
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(scheduledIds));
  } catch (e) {
    if (__DEV__) console.warn('[LocalNotifications] Error scheduling:', e);
  }
}
