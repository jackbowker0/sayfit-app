// ============================================================
// ADAPTIVE TDEE — estimate real maintenance from your own data
// ------------------------------------------------------------
// The MacroFactor trick, cheap version: don't guess maintenance from
// a height/weight formula — back-calculate it from what you ACTUALLY
// ate vs how your weight ACTUALLY moved.
//
//   TDEE = avg daily intake  -  (weight change x kcal/unit / days)
//
// e.g. averaging 2000 kcal/day and down 1 lb over 14 days -> a ~250
// kcal/day deficit -> TDEE ~= 2250. Needs enough real data (>= ~8
// logged intake days + weigh-ins spanning >= 7 days) or it returns
// null and the UI stays quiet. All local, no network.
// ============================================================

import { getMacroChartData } from './nutrition';
import { getWeightEntries } from './bodyWeight';
import { getUserProfile } from './userProfile';

const KCAL_PER_LB = 3500;
const KCAL_PER_KG = 7700;

const dayTime = (dayKeyOrIso) => new Date(String(dayKeyOrIso).length <= 10 ? `${dayKeyOrIso}T12:00:00` : dayKeyOrIso).getTime();

/**
 * Estimate maintenance calories (TDEE) from logged intake + weight trend.
 * Returns { tdee, avgIntake, weightChange, windowDays, loggedDays, units,
 * confidence } or null when there isn't enough data yet.
 */
export async function estimateTDEE() {
  const [intakeDays, weights, profile] = await Promise.all([
    getMacroChartData(45),   // last ~45 days of counted intake, per day
    getWeightEntries(),
    getUserProfile(),
  ]);

  const units = profile?.units || 'lbs';
  const perUnit = units === 'kg' ? KCAL_PER_KG : KCAL_PER_LB;

  const logged = (intakeDays || []).filter((d) => d.kcal > 0);
  const w = [...(weights || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (logged.length < 8 || w.length < 2) return null;

  const firstW = w[0];
  const lastW = w[w.length - 1];
  const windowDays = Math.round((new Date(lastW.date) - new Date(firstW.date)) / 86400000);
  if (windowDays < 7) return null;

  // Prefer intake days inside the weigh-in window; fall back to all logged days
  // if the window is sparse (better a rougher estimate than none).
  const lo = dayTime(firstW.date), hi = dayTime(lastW.date);
  const inWindow = logged.filter((d) => { const t = dayTime(d.date); return t >= lo && t <= hi; });
  const useDays = inWindow.length >= 6 ? inWindow : logged;

  const avgIntake = Math.round(useDays.reduce((s, d) => s + d.kcal, 0) / useDays.length);
  const weightChange = lastW.weight - firstW.weight;
  const dailyBalance = (weightChange * perUnit) / windowDays; // + = surplus, - = deficit
  const tdee = Math.round(avgIntake - dailyBalance);

  // Guard nonsense (sparse/erratic logging) — surface it as low confidence.
  const sane = tdee >= 1000 && tdee <= 5500;
  const confidence = sane && useDays.length >= 14 && windowDays >= 14 ? 'good' : 'low';

  return {
    tdee,
    avgIntake,
    weightChange: Math.round(weightChange * 10) / 10,
    windowDays,
    loggedDays: useDays.length,
    units,
    confidence,
  };
}

/**
 * A full macro target from a calorie number. Protein anchored to body weight
 * (~0.9 g/lb) when known, else 30% of calories; fat 25% of calories; carbs
 * fill the rest. Pure math — the user reviews before saving.
 */
export function targetsFromCalories(kcal, bodyWeightLbs = null) {
  const cals = Math.max(0, Math.round(Number(kcal) || 0));
  const protein = bodyWeightLbs > 0 ? Math.round(bodyWeightLbs * 0.9) : Math.round((cals * 0.3) / 4);
  const fat = Math.round((cals * 0.25) / 9);
  const carbs = Math.max(0, Math.round((cals - protein * 4 - fat * 9) / 4));
  return { kcal: cals, protein, carbs, fat };
}
