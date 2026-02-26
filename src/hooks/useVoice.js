// ============================================================
// useVoice HOOK — React wrapper for the voice service
//
// Makes it easy to use voice recognition in any component.
// Handles setup, cleanup, and provides simple start/stop controls.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { voiceService } from '../services/voice';

/**
 * Hook for voice recognition in workout screens
 * 
 * @param {function} onCommand - Called when a voice command is detected
 *   Receives (commandName, rawTranscript)
 * @param {boolean} enabled - Whether voice should be active
 * @returns {object} { isListening, transcript, startListening, stopListening, speak }
 */
export function useVoice(onCommand, enabled = false) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const onCommandRef = useRef(onCommand);

  // Keep callback ref current without re-triggering effects
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  // Initialize voice service once
  useEffect(() => {
    let mounted = true;

    async function init() {
      const success = await voiceService.init();
      if (mounted) {
        setIsInitialized(success);
        if (!success) {
          console.warn('[useVoice] Voice recognition not available');
        }
      }
    }

    init();

    return () => {
      mounted = false;
      voiceService.destroy();
    };
  }, []);

  // Set up callbacks
  useEffect(() => {
    voiceService.onCommandDetected = (command, rawText) => {
      onCommandRef.current?.(command, rawText);
      setTranscript('');
    };

    voiceService.onPartialResult = (text) => {
      setTranscript(text);
    };

    voiceService.onError = (error) => {
      console.warn('[useVoice] Error:', error);
    };
  }, []);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && isInitialized) {
      voiceService.startListening();
      setIsListening(true);
    } else {
      voiceService.stopListening();
      setIsListening(false);
    }
  }, [enabled, isInitialized]);

  const startListening = useCallback(async () => {
    if (!isInitialized) return;
    await voiceService.startListening();
    setIsListening(true);
  }, [isInitialized]);

  const stopListening = useCallback(async () => {
    await voiceService.stopListening();
    setIsListening(false);
  }, []);

  const speak = useCallback(async (text, coachId) => {
    await voiceService.speak(text, coachId);
  }, []);

  const stopSpeaking = useCallback(async () => {
    await voiceService.stopSpeaking();
  }, []);

  return {
    isListening,
    isInitialized,
    transcript,      // Current partial transcript (live text while user speaks)
    startListening,
    stopListening,
    speak,           // Make the coach talk
    stopSpeaking,
  };
}
