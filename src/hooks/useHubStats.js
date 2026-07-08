// ============================================================
// useHubStats — single loader for the "am I winning?" hub stats.
//
// Extracted verbatim from DashboardScreen.loadData() so the
// Dashboard, Coach hub, and WinningVerdict all read from ONE
// fetch shape and never drift. Call it inside a useFocusEffect
// (or pull-to-refresh) and feed the result straight to
// <WinningVerdict hubStats={...} />.
//
// HONEST BY DESIGN: every field comes straight from a service.
// A failed load resolves to null (callers skeleton on null),
// never a fabricated zero. exLog is NOT date-sorted, so the
// last-workout date is reduced for the max, not taken by order.
// ============================================================

import { getUserProfile, getMacroTargets } from '../services/userProfile';
import { getWeightStats, getWeightChartData } from '../services/bodyWeight';
import { getNutritionStats } from '../services/nutrition';
import { getProtocolStats, hasAcknowledgedProtocolDisclaimer } from '../services/protocol';
import { getExerciseLog } from '../services/exerciseLog';

/**
 * Load the shared hub-stats bundle. Resolves to the hubStats object
 * on success, or null on failure (callers render a skeleton on null).
 *
 * @param {object} [profile] optional pre-loaded profile to avoid a
 *   duplicate getUserProfile() call. Falls back to fetching it.
 * @returns {Promise<object|null>}
 */
export async function loadHubStats(profile) {
  try {
    const prof = profile || (await getUserProfile());
    const targets = await getMacroTargets();
    const [wStats, wChart, nStats, pStats, pAck, exLog] = await Promise.all([
      getWeightStats(),
      getWeightChartData(14),
      getNutritionStats(targets),
      getProtocolStats(),
      hasAcknowledgedProtocolDisclaimer(),
      getExerciseLog(),
    ]);
    // exLog is NOT date-sorted — reduce for the max date, don't trust order.
    const lastWorkoutDate = exLog.length
      ? exLog.reduce((m, s) => (new Date(s.date) > new Date(m) ? s.date : m), exLog[0].date)
      : null;
    return {
      wStats,
      wChart,
      nStats,
      pStats,
      pAck,
      lastWorkoutDate,
      units: prof.units || 'lbs',
    };
  } catch (e) {
    console.warn('[useHubStats] Failed to load hub stats:', e);
    return null;
  }
}
