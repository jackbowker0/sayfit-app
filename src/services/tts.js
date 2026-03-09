// ============================================================
// TTS SERVICE — Text-to-speech for coach voices
//
// Each coach has a distinct voice profile (rate, pitch).
// Strips emojis before speaking so Vibe doesn't sound robotic.
// Can be toggled on/off — persists in AsyncStorage.
// ============================================================

import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TTS_KEY = 'sayfit_tts_enabled';

// Coach voice profiles
// iOS rate: 0.0 (slowest) → 1.0 (fastest), default ~0.5
const COACH_VOICES = {
  drill: { rate: 0.52, pitch: 0.85 }, // Punchy, authoritative
  hype:  { rate: 0.62, pitch: 1.12 }, // Fast, enthusiastic
  zen:   { rate: 0.36, pitch: 1.0  }, // Calm, deliberate
};

// Strip emoji unicode ranges so Speech doesn't read out gibberish
function stripEmojis(text) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function isEnabled() {
  try {
    const val = await AsyncStorage.getItem(TTS_KEY);
    return val === null ? false : val === 'true';
  } catch {
    return true;
  }
}

export async function setEnabled(enabled) {
  try {
    await AsyncStorage.setItem(TTS_KEY, enabled ? 'true' : 'false');
    if (!enabled) Speech.stop();
  } catch {}
}

export async function speak(text, coachId = 'drill') {
  try {
    const enabled = await isEnabled();
    if (!enabled || !text) return;

    const clean = stripEmojis(text);
    if (!clean) return;

    // Stop anything currently playing before speaking
    Speech.stop();

    const voice = COACH_VOICES[coachId] || COACH_VOICES.drill;
    Speech.speak(clean, {
      language: 'en-US',
      rate: voice.rate,
      pitch: voice.pitch,
    });
  } catch {}
}

export function stop() {
  try {
    Speech.stop();
  } catch {}
}
