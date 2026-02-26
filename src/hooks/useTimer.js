// ============================================================
// useTimer HOOK — Simple interval timer
//
// Calls a callback every second when active.
// Used by the workout screen to drive the TICK action.
// ============================================================

import { useEffect, useRef } from 'react';

/**
 * @param {function} callback - Called every second
 * @param {boolean} isRunning - Whether the timer should be ticking
 */
export function useTimer(callback, isRunning) {
  const callbackRef = useRef(callback);

  // Keep callback ref current
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Run interval
  useEffect(() => {
    if (!isRunning) return;

    const id = setInterval(() => {
      callbackRef.current();
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning]);
}
