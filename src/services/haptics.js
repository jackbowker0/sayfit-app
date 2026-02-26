// ============================================================
// HAPTICS SERVICE — Tactile feedback for key moments
//
// Wraps expo-haptics with semantic methods so screens
// just call haptics.success() instead of thinking about
// which haptic type to use.
//
// Falls back gracefully if haptics aren't available.
// ============================================================

import * as Haptics from 'expo-haptics';

/**
 * Light tap — button presses, toggles, selections
 */
export function tap() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
}

/**
 * Medium impact — completing a set, navigation actions
 */
export function medium() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (e) {}
}

/**
 * Heavy impact — PR hit, big milestone
 */
export function heavy() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (e) {}
}

/**
 * Success — workout complete, achievement unlocked, save confirmed
 */
export function success() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (e) {}
}

/**
 * Warning — approaching limit, rest timer about to end
 */
export function warning() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (e) {}
}

/**
 * Error — invalid input, failed action
 */
export function error() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (e) {}
}

/**
 * Selection tick — scrolling through options, picker changes
 */
export function tick() {
  try {
    Haptics.selectionAsync();
  } catch (e) {}
}

/**
 * Achievement unlocked — double pulse for celebration
 */
export function achievement() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 200);
  } catch (e) {}
}

/**
 * PR celebration — triple pulse
 */
export function pr() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 150);
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 350);
  } catch (e) {}
}