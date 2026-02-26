// ============================================================
// WORKOUT CONTEXT — Shares workout state across all screens
//
// This lets any component in the app access the workout state
// without passing props through every level.
//
// Usage in any component:
//   const { workout, coach, setCoach, generatedWorkout, setGeneratedWorkout } = useWorkoutContext();
// ============================================================

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useWorkout } from '../hooks/useWorkout';

const WorkoutContext = createContext(null);

export function WorkoutProvider({ children }) {
  const [coachId, setCoachId] = useState('hype');
  const [generatedWorkout, setGeneratedWorkout] = useState(null);
  const workout = useWorkout();

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