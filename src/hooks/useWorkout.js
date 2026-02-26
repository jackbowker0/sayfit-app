// ============================================================
// useWorkout HOOK — The heart of SayFit
//
// This manages ALL workout state: current exercise, timer,
// rest periods, transitions, stats, and command handling.
//
// It's a "state machine" — the workout is always in one of
// these states: IDLE → ACTIVE → REST → TRANSITION → ACTIVE → ... → COMPLETE
// ============================================================

import { useReducer, useCallback } from 'react';
import { getDefaultWorkout, getExerciseById, getRandomSwap } from '../constants/exercises';
import { clamp, calculateCalories, uid } from '../utils/helpers';

// ---- Workout States ----
export const WORKOUT_STATES = {
  IDLE: 'idle',           // Not started yet
  ACTIVE: 'active',       // Doing an exercise
  REST: 'rest',           // Resting between exercises
  TRANSITION: 'transition', // 3-2-1 countdown to next exercise
  PAUSED: 'paused',       // User paused
  COMPLETE: 'complete',   // Workout finished
};

// ---- Initial State ----
const createInitialState = () => ({
  status: WORKOUT_STATES.IDLE,
  statusBeforePause: null,  // Remember state when pausing

  // Exercise tracking
  exercises: getDefaultWorkout(),
  currentIndex: 0,

  // Timers
  timer: 0,
  maxTimer: 0,
  restTimer: 0,
  elapsed: 0,

  // Workout data
  intensity: 7,
  heartRate: 120,

  // Stats
  stats: {
    calories: 0,
    exercisesCompleted: 0,
    adaptations: 0,
  },

  // Chat log
  chatLog: [],

  // Command history (for coach memory)
  commandLog: [],

  // Just Talk metadata (null for structured workouts)
  justTalkMeta: null,
});

// ---- Actions ----
const ACTIONS = {
  START: 'START',
  TICK: 'TICK',
  COMMAND: 'COMMAND',
  ADD_MESSAGE: 'ADD_MESSAGE',
  CLEAR_NOTIFICATION: 'CLEAR_NOTIFICATION',
  RESET: 'RESET',
};

// ---- Reducer (handles all state changes) ----
function workoutReducer(state, action) {
  switch (action.type) {

    // ============ START WORKOUT ============
    case ACTIONS.START: {
      const { coachId, generatedWorkout } = action.payload;

      // Use generated exercises from Just Talk, or fall back to default
      const exercises = generatedWorkout?.exercises?.length
        ? generatedWorkout.exercises
        : state.exercises;

      const firstExercise = exercises[0];
      return {
        ...state,
        status: WORKOUT_STATES.ACTIVE,
        exercises,
        timer: firstExercise.duration,
        maxTimer: firstExercise.duration,
        intensity: firstExercise.intensity ?? 7,
        currentIndex: 0,
        elapsed: 0,
        heartRate: 115 + Math.floor(Math.random() * 15),
        stats: { calories: 0, exercisesCompleted: 0, adaptations: 0 },
        chatLog: [{
          id: uid(),
          isCoach: true,
          // Message will be set by the component after AI generates it
          msg: action.payload.startMessage || "Let's go!",
        }],
        commandLog: [],
        notification: null,
        justTalkMeta: generatedWorkout ? {
          name: generatedWorkout.name,
          type: generatedWorkout.type,
          parsed: generatedWorkout.parsed,
        } : null,
      };
    }

    // ============ TICK (called every second) ============
    case ACTIONS.TICK: {
      if (state.status === WORKOUT_STATES.PAUSED || state.status === WORKOUT_STATES.IDLE) {
        return state;
      }

      const newElapsed = state.elapsed + 1;

      // ---- TRANSITION (3-2-1 countdown) ----
      if (state.status === WORKOUT_STATES.TRANSITION) {
        if (state.timer <= 1) {
          const exercise = state.exercises[state.currentIndex];
          return {
            ...state,
            status: WORKOUT_STATES.ACTIVE,
            timer: exercise.duration,
            maxTimer: exercise.duration,
            intensity: exercise.intensity ?? 7,
            elapsed: newElapsed,
          };
        }
        return { ...state, timer: state.timer - 1, elapsed: newElapsed };
      }

      // ---- REST ----
      if (state.status === WORKOUT_STATES.REST) {
        if (state.restTimer <= 1) {
          const nextIndex = state.currentIndex + 1;

          // Last exercise done → complete!
          if (nextIndex >= state.exercises.length) {
            return {
              ...state,
              status: WORKOUT_STATES.COMPLETE,
              restTimer: 0,
              elapsed: newElapsed,
            };
          }

          // Start 3-second transition to next exercise
          return {
            ...state,
            status: WORKOUT_STATES.TRANSITION,
            currentIndex: nextIndex,
            restTimer: 0,
            timer: 3,
            elapsed: newElapsed,
            heartRate: clamp(state.heartRate - 6 + Math.floor(Math.random() * 4), 85, 185),
          };
        }

        return {
          ...state,
          restTimer: state.restTimer - 1,
          elapsed: newElapsed,
          heartRate: clamp(state.heartRate - (Math.random() > 0.5 ? 1 : 0), 85, 185),
        };
      }

      // ---- ACTIVE EXERCISE ----
      if (state.status === WORKOUT_STATES.ACTIVE) {
        // Exercise timer done → enter rest
        if (state.timer <= 1) {
          const exercise = state.exercises[state.currentIndex];
          const cals = calculateCalories(exercise.intensity ?? 7, exercise.duration);

          // Use per-exercise rest duration if set (Just Talk workouts), otherwise default 15s
          const restDuration = exercise.rest ?? 15;

          return {
            ...state,
            status: WORKOUT_STATES.REST,
            timer: 0,
            restTimer: restDuration,
            elapsed: newElapsed,
            stats: {
              ...state.stats,
              exercisesCompleted: state.stats.exercisesCompleted + 1,
              calories: state.stats.calories + cals,
            },
          };
        }

        // Normal tick — count down, simulate heart rate, add calories
        const hrDelta = (Math.random() - 0.45) * 3; // Slight upward bias during exercise
        const effectiveIntensity = state.intensity ?? 7;
        const calTick = effectiveIntensity >= 7
          ? (Math.random() > 0.35 ? 1 : 0)
          : (Math.random() > 0.6 ? 1 : 0);

        return {
          ...state,
          timer: state.timer - 1,
          elapsed: newElapsed,
          heartRate: clamp(Math.round(state.heartRate + hrDelta), 85, 185),
          stats: {
            ...state.stats,
            calories: state.stats.calories + calTick,
          },
        };
      }

      return state;
    }

    // ============ VOICE COMMAND ============
    case ACTIONS.COMMAND: {
      const { cmd, message, coachMessage } = action.payload;
      const exercise = state.exercises[state.currentIndex];
      const isActive = state.status === WORKOUT_STATES.ACTIVE;
      let ns = { ...state };
      let adaptText = null;

      // -- PAUSE / RESUME (always works) --
      if (cmd === 'pause') {
        if (state.status === WORKOUT_STATES.PAUSED) {
          // Resume
          ns.status = state.statusBeforePause || WORKOUT_STATES.ACTIVE;
          ns.statusBeforePause = null;
        } else if (state.status !== WORKOUT_STATES.COMPLETE && state.status !== WORKOUT_STATES.IDLE) {
          // Pause
          ns.statusBeforePause = state.status;
          ns.status = WORKOUT_STATES.PAUSED;
        }
        // Pause does NOT count as an adaptation
        ns.commandLog = [...state.commandLog, cmd];
        ns.chatLog = [
          ...state.chatLog,
          { id: uid(), isCoach: false, msg: message || (state.status === WORKOUT_STATES.PAUSED ? '"Resume"' : '"Pause"') },
          { id: uid(), isCoach: true, msg: coachMessage || 'Got it!' },
        ];
        return ns;
      }

      // -- Block commands during rest/transition (except skip) --
      if (!isActive && cmd !== 'skip') return state;

      // -- HARDER --
      if (cmd === 'harder') {
        const harderSwapId = exercise.harderSwap;
        if (harderSwapId && (state.intensity ?? 7) < 9) {
          const harderEx = getExerciseById(harderSwapId);
          if (harderEx) {
            const newExercises = [...state.exercises];
            newExercises[state.currentIndex] = harderEx;
            ns.exercises = newExercises;
            adaptText = `Upgraded: ${harderEx.name}!`;
          }
        }
        if (!adaptText) {
          // No swap available (common for Just Talk exercises) — extend timer
          ns.timer = Math.min(state.timer + 15, 90);
          ns.maxTimer = Math.max(ns.maxTimer, ns.timer);
          adaptText = '+15 sec — Let\'s go!';
        }
        ns.intensity = clamp((state.intensity ?? 7) + 1, 1, 10);
        ns.heartRate = clamp(state.heartRate + 4, 85, 185);
      }

      // -- EASIER --
      else if (cmd === 'easier') {
        const easierSwapId = exercise.easierSwap;
        if (easierSwapId) {
          const easierEx = getExerciseById(easierSwapId);
          if (easierEx) {
            const newExercises = [...state.exercises];
            newExercises[state.currentIndex] = { ...easierEx, duration: exercise.duration };
            ns.exercises = newExercises;
            adaptText = `Modified: ${easierEx.name}`;
          }
        }
        if (!adaptText) {
          // No swap available — reduce timer
          ns.timer = Math.max(state.timer - 10, 10);
          adaptText = '-10 sec — Take it easy';
        }
        ns.intensity = clamp((state.intensity ?? 7) - 1, 1, 10);
      }

      // -- SWAP --
      else if (cmd === 'swap') {
        const currentIds = state.exercises.map(e => e.id);
        const replacement = getRandomSwap(currentIds);
        if (replacement) {
          const newExercises = [...state.exercises];
          newExercises[state.currentIndex] = replacement;
          ns.exercises = newExercises;
          ns.timer = replacement.duration;
          ns.maxTimer = replacement.duration;
          ns.intensity = replacement.intensity ?? 7;
          adaptText = `Swapped: ${replacement.name}`;
        } else {
          adaptText = 'No more exercises to swap!';
        }
      }

      // -- SKIP --
      else if (cmd === 'skip') {
        if (state.status === WORKOUT_STATES.REST || state.status === WORKOUT_STATES.TRANSITION) {
          // Skip rest → go straight to next exercise
          const nextIndex = state.currentIndex + 1;
          if (nextIndex >= state.exercises.length) {
            ns.status = WORKOUT_STATES.COMPLETE;
          } else {
            const nextEx = state.exercises[nextIndex];
            ns.status = WORKOUT_STATES.ACTIVE;
            ns.currentIndex = nextIndex;
            ns.timer = nextEx.duration;
            ns.maxTimer = nextEx.duration;
            ns.intensity = nextEx.intensity ?? 7;
            ns.restTimer = 0;
          }
          adaptText = 'Skipped rest!';
        } else {
          // Skip exercise → go to rest
          ns.status = WORKOUT_STATES.REST;
          ns.restTimer = exercise.rest ?? 12;
          ns.timer = 0;
          ns.stats = { ...state.stats, exercisesCompleted: state.stats.exercisesCompleted + 1 };
          adaptText = 'Skipped → rest';
        }
      }

      // -- TIRED --
      else if (cmd === 'tired') {
        const remaining = state.exercises.slice(state.currentIndex + 1).map(e => ({
          ...e,
          duration: Math.max(Math.floor(e.duration * 0.65), 15),
          intensity: clamp((e.intensity ?? 7) - 2, 1, 10),
        }));
        ns.exercises = [...state.exercises.slice(0, state.currentIndex + 1), ...remaining];
        ns.timer = Math.max(Math.floor(state.timer * 0.65), 8);
        ns.maxTimer = ns.timer;
        ns.intensity = clamp((state.intensity ?? 7) - 2, 1, 10);
        ns.heartRate = clamp(state.heartRate - 6, 85, 185);
        adaptText = 'Remaining workout eased 💪';
      }

      // Update stats + chat + command log
      ns.stats = { ...ns.stats, adaptations: (ns.stats.adaptations ?? state.stats.adaptations) + 1 };
      ns.commandLog = [...state.commandLog, cmd];
      ns.chatLog = [
        ...state.chatLog,
        { id: uid(), isCoach: false, msg: message || `"${cmd}"` },
        { id: uid(), isCoach: true, msg: coachMessage || 'Got it!' },
      ];
      ns.notification = adaptText ? { text: adaptText, id: uid() } : null;

      return ns;
    }

    // ============ ADD MESSAGE (for async AI responses) ============
    case ACTIONS.ADD_MESSAGE: {
      return {
        ...state,
        chatLog: [
          ...state.chatLog,
          { id: uid(), isCoach: action.payload.isCoach, msg: action.payload.msg },
        ],
      };
    }

    // ============ CLEAR NOTIFICATION ============
    case ACTIONS.CLEAR_NOTIFICATION:
      return { ...state, notification: null };

    // ============ RESET ============
    case ACTIONS.RESET:
      return createInitialState();

    default:
      return state;
  }
}

// ---- The Hook ----
export function useWorkout() {
  const [state, dispatch] = useReducer(workoutReducer, null, createInitialState);

  const startWorkout = useCallback((coachId, startMessage, generatedWorkout) => {
    dispatch({ type: ACTIONS.START, payload: { coachId, startMessage, generatedWorkout } });
  }, []);

  const tick = useCallback(() => {
    dispatch({ type: ACTIONS.TICK });
  }, []);

  const sendCommand = useCallback((cmd, message, coachMessage) => {
    dispatch({ type: ACTIONS.COMMAND, payload: { cmd, message, coachMessage } });
  }, []);

  const addMessage = useCallback((msg, isCoach = true) => {
    dispatch({ type: ACTIONS.ADD_MESSAGE, payload: { msg, isCoach } });
  }, []);

  const clearNotification = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_NOTIFICATION });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: ACTIONS.RESET });
  }, []);

  return {
    state,
    startWorkout,
    tick,
    sendCommand,
    addMessage,
    clearNotification,
    reset,
    // Computed values
    currentExercise: state.exercises[state.currentIndex],
    progress: state.maxTimer > 0 ? ((state.maxTimer - state.timer) / state.maxTimer) * 100 : 0,
    overallProgress: (
      (state.currentIndex + (state.status === WORKOUT_STATES.REST || state.status === WORKOUT_STATES.TRANSITION ? 1 : (state.maxTimer > 0 ? (state.maxTimer - state.timer) / state.maxTimer : 0)))
      / state.exercises.length
    ) * 100,
    isActive: state.status === WORKOUT_STATES.ACTIVE,
    isResting: state.status === WORKOUT_STATES.REST,
    isPaused: state.status === WORKOUT_STATES.PAUSED,
    isComplete: state.status === WORKOUT_STATES.COMPLETE,
    isTransitioning: state.status === WORKOUT_STATES.TRANSITION,
  };
}