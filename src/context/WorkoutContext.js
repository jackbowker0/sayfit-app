// ============================================================
// WORKOUT CONTEXT — Shares workout state across all screens
//
// This lets any component in the app access the workout state
// without passing props through every level.
//
// Usage in any component:
//   const { workout, coach, setCoach, generatedWorkout, setGeneratedWorkout } = useWorkoutContext();
// ============================================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWorkout } from '../hooks/useWorkout';
import { getUserProfile } from '../services/userProfile';

const WorkoutContext = createContext(null);

export function WorkoutProvider({ children }) {
  const [coachId, setCoachId] = useState('hype');
  const [generatedWorkout, setGeneratedWorkout] = useState(null);
  const workout = useWorkout();

  // Rehydrate the chosen coach from the saved profile on launch. Without this,
  // coachId silently resets to the default every cold start — and then a
  // Settings "Save" would persist that default back over the user's real pick.
  useEffect(() => {
    getUserProfile()
      .then((p) => { if (p && p.coachId) setCoachId(p.coachId); })
      .catch(() => {});
  }, []);

  const value = {
    // Coach selection
    coachId,
    setCoachId,

    // Just Talk — generated workout
    generatedWorkout,
    setGeneratedWorkout,

    // All workout state and actions
    workout,
  };

  return (
    <WorkoutContext.Provider value={value}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkoutContext() {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkoutContext must be used within a WorkoutProvider');
  }
  return context;
}