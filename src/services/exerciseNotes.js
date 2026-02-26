// ============================================================
// EXERCISE NOTES SERVICE — Per-exercise persistent settings
//
// Stores user notes per exercise (seat position, angle, weight,
// machine settings, personal tips). Notes persist across workouts
// so the app "remembers" your setup.
//
// Data shape per exercise:
//   { exerciseId, notes, weight, lastUsed, history[] }
//
// Usage:
//   await saveExerciseNote('pec-deck', { notes: 'Seat 3, Handle 2', weight: '140 lbs' });
//   const note = await getExerciseNote('pec-deck');
//   // → { exerciseId: 'pec-deck', notes: 'Seat 3, Handle 2', weight: '140 lbs', lastUsed: '...', history: [...] }
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTES_KEY = 'sayfit_exercise_notes';

// ---- CORE READ/WRITE ----

/**
 * Get all exercise notes as a map: { exerciseId: noteData }
 */
export async function getAllExerciseNotes() {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[ExerciseNotes] Failed to load:', e);
    return {};
  }
}

/**
 * Get note for a specific exercise
 * @returns {object|null} Note data or null if none saved
 */
export async function getExerciseNote(exerciseId) {
  const all = await getAllExerciseNotes();
  return all[exerciseId] || null;
}

/**
 * Save/update note for an exercise
 * @param {string} exerciseId - The exercise ID from exercises.js
 * @param {object} noteData - { notes?: string, weight?: string }
 *   notes  — freeform text (seat #, angle, machine settings, tips)
 *   weight — last weight used (kept separate for quick reference)
 */
export async function saveExerciseNote(exerciseId, noteData) {
  try {
    const all = await getAllExerciseNotes();
    const existing = all[exerciseId] || { exerciseId, notes: '', weight: '', history: [] };

    // If weight changed, push to history
    if (noteData.weight && noteData.weight !== existing.weight && existing.weight) {
      existing.history = [
        { weight: existing.weight, date: existing.lastUsed || new Date().toISOString() },
        ...(existing.history || []),
      ].slice(0, 10); // keep last 10 weight entries
    }

    const updated = {
      ...existing,
      ...noteData,
      lastUsed: new Date().toISOString(),
    };

    all[exerciseId] = updated;
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(all));
    return updated;
  } catch (e) {
    console.warn('[ExerciseNotes] Failed to save:', e);
    return null;
  }
}

/**
 * Delete note for an exercise
 */
export async function deleteExerciseNote(exerciseId) {
  try {
    const all = await getAllExerciseNotes();
    delete all[exerciseId];
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('[ExerciseNotes] Failed to delete:', e);
  }
}

/**
 * Clear all exercise notes
 */
export async function clearAllExerciseNotes() {
  await AsyncStorage.setItem(NOTES_KEY, '{}');
}

/**
 * Get exercises that have notes (for a "My Settings" overview)
 * @returns {Array} Array of note objects sorted by lastUsed
 */
export async function getExercisesWithNotes() {
  const all = await getAllExerciseNotes();
  return Object.values(all)
    .filter(n => n.notes || n.weight)
    .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
}

/**
 * Bulk get notes for a list of exercise IDs (used during workout)
 * @param {string[]} exerciseIds
 * @returns {object} Map of exerciseId → noteData (only for exercises that have notes)
 */
export async function getNotesForWorkout(exerciseIds) {
  const all = await getAllExerciseNotes();
  const result = {};
  exerciseIds.forEach(id => {
    if (all[id] && (all[id].notes || all[id].weight)) {
      result[id] = all[id];
    }
  });
  return result;
}