// ============================================================
// HELPERS — Utility functions used across the app
// ============================================================

/**
 * Format seconds into M:SS display string
 * Example: 125 → "2:05"
 */
export function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Clamp a number between min and max
 * Example: clamp(200, 85, 185) → 185
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate calories burned for an exercise
 * Uses intensity + duration with some randomness for realism
 */
export function calculateCalories(intensity, durationSeconds) {
  const base = intensity * (durationSeconds / 30) * 2.5;
  const variance = (Math.random() - 0.5) * 4;
  return Math.max(1, Math.round(base + variance));
}

/**
 * Simulate realistic heart rate changes
 * Goes up during high-intensity exercise, down during rest
 */
export function simulateHeartRate(currentHR, intensity, isResting) {
  const target = isResting ? 95 : 100 + intensity * 8;
  const drift = (target - currentHR) * 0.08;
  const noise = (Math.random() - 0.5) * 3;
  return clamp(Math.round(currentHR + drift + noise), 85, 185);
}

/**
 * Parse voice input to detect commands
 * Returns the matched command or null
 */
export function parseVoiceCommand(transcript) {
  if (!transcript) return null;
  const text = transcript.toLowerCase().trim();

  // Direct matches
  const commandMap = {
    harder: ['harder', 'more', 'increase', 'turn it up', 'crank it', 'push me', 'let\'s go harder'],
    easier: ['easier', 'less', 'too hard', 'dial it back', 'take it easy', 'slow down'],
    swap: ['swap', 'switch', 'change', 'different', 'something else', 'new exercise'],
    skip: ['skip', 'next', 'move on', 'pass', 'next one'],
    tired: ['tired', 'exhausted', 'dying', 'can\'t', 'i\'m done', 'too much', 'i need a break', 'gassed'],
    pause: ['pause', 'stop', 'wait', 'hold on', 'break', 'resume', 'continue', 'go', 'start'],
  };

  for (const [command, triggers] of Object.entries(commandMap)) {
    for (const trigger of triggers) {
      if (text.includes(trigger)) {
        return command;
      }
    }
  }

  return null;
}

/**
 * Generate a unique ID (simple, no dependencies needed)
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
