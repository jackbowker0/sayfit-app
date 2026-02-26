// ============================================================
// Coach Animations — Per-coach motion personality
//
// Sarge (drill): Sharp, snappy, decisive
// Vibe (hype): Bouncy, energetic, overshoot
// Flow (zen): Slow, fluid, gentle
// ============================================================

import { Easing } from 'react-native';

const COACH_SPRINGS = {
  drill: { damping: 20, stiffness: 300, mass: 0.8 },
  hype: { damping: 10, stiffness: 150, mass: 0.8 },
  zen: { damping: 18, stiffness: 100, mass: 1.2 },
};

const COACH_TIMINGS = {
  drill: { duration: 150, easing: Easing.out(Easing.quad) },
  hype: { duration: 250, easing: Easing.out(Easing.back(1.5)) },
  zen: { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) },
};

const COACH_PRESS_SCALE = {
  drill: 0.95,
  hype: 0.92,
  zen: 0.97,
};

export function getCoachSpring(coachId) {
  return COACH_SPRINGS[coachId] || COACH_SPRINGS.drill;
}

export function getCoachTiming(coachId) {
  return COACH_TIMINGS[coachId] || COACH_TIMINGS.drill;
}

export function getCoachPressScale(coachId) {
  return COACH_PRESS_SCALE[coachId] || 0.95;
}
