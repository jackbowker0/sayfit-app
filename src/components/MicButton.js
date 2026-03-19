// ============================================================
// MIC BUTTON — Push-to-talk with auto-stop voice input
//
// Big, coach-colored mic button that pulses while listening.
// Uses expo-speech-recognition with continuous: false for
// automatic silence detection (auto-stop).
//
// Props:
//   onTranscript(text)  — called with final transcript
//   onPartial(text)     — called with interim results (optional)
//   coachColor          — accent color for the button
//   size                — 'large' (default) or 'small'
//   disabled            — disable the button
//   style               — additional container styles
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Animated, Alert, Text } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { FONT, RADIUS } from '../constants/theme';
import * as haptics from '../services/haptics';

// expo-speech-recognition requires a native build — graceful fallback
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = () => {};
try {
  const SpeechRec = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = SpeechRec.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = SpeechRec.useSpeechRecognitionEvent;
} catch (_) {}

const SIZES = {
  large: { button: 80, icon: 32, ring: 96, label: true },
  small: { button: 48, icon: 20, ring: 58, label: false },
};

export default function MicButton({
  onTranscript,
  onPartial,
  coachColor = '#FFDC00',
  size = 'large',
  disabled = false,
  style,
}) {
  const { colors, isDark } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef(null);

  const dims = SIZES[size] || SIZES.large;

  // ─── SPEECH RECOGNITION EVENTS ──────────────────────────────

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    stopAnimations();
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (!transcript) return;

    if (event.isFinal) {
      onTranscript?.(transcript);
      haptics.tap();
    } else {
      onPartial?.(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    stopAnimations();
    // Don't alert on "no-speech" — that's just the user not saying anything
    if (event.error !== 'no-speech') {
      console.warn('[MicButton] Speech error:', event.error);
    }
  });

  // ─── ANIMATIONS ─────────────────────────────────────────────

  const startAnimations = useCallback(() => {
    // Pulse ring
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.current.start();

    // Glow fade in
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [pulseAnim, glowAnim]);

  const stopAnimations = useCallback(() => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);

    Animated.timing(glowAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [pulseAnim, glowAnim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pulseLoop.current?.stop();
      if (isListening && ExpoSpeechRecognitionModule) {
        try { ExpoSpeechRecognitionModule.stop(); } catch (_) {}
      }
    };
  }, []);

  // ─── PRESS HANDLER ──────────────────────────────────────────

  const handlePress = useCallback(async () => {
    if (disabled) return;

    if (!ExpoSpeechRecognitionModule) {
      Alert.alert(
        'Voice Unavailable',
        'Voice input requires a native build. It will work in the TestFlight version.'
      );
      return;
    }

    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      stopAnimations();
      return;
    }

    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Microphone Access',
          'Please allow microphone access in Settings to use voice input.'
        );
        return;
      }

      haptics.medium();
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false, // Auto-stops on silence
      });
      startAnimations();
    } catch (e) {
      console.warn('[MicButton] Failed to start:', e);
      Alert.alert(
        'Voice Unavailable',
        'Voice input requires a native build. It will work in the TestFlight version.'
      );
    }
  }, [disabled, isListening, startAnimations, stopAnimations]);

  // ─── RENDER ─────────────────────────────────────────────────

  const buttonBg = isListening
    ? coachColor
    : isDark ? colors.bgElevated : colors.bgCard;

  const iconColor = isListening
    ? (coachColor === '#FFDC00' || coachColor === '#FFCC00' ? '#000' : '#fff')
    : colors.textSecondary;

  return (
    <View style={[{ alignItems: 'center' }, style]}>
      {/* Outer pulse ring */}
      <View style={{
        width: dims.ring,
        height: dims.ring,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: dims.ring,
            height: dims.ring,
            borderRadius: dims.ring / 2,
            backgroundColor: coachColor + '15',
            borderWidth: 1.5,
            borderColor: coachColor + '30',
            transform: [{ scale: pulseAnim }],
            opacity: glowAnim,
          }}
        />

        {/* Main button */}
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.7}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={isListening ? 'Stop listening' : 'Tap to speak'}
          accessibilityState={{ disabled }}
          style={{
            width: dims.button,
            height: dims.button,
            borderRadius: dims.button / 2,
            backgroundColor: buttonBg,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: isListening ? 0 : 1,
            borderColor: isDark ? colors.glassBorder : colors.border,
            // Shadow
            shadowColor: isListening ? coachColor : '#000',
            shadowOpacity: isListening ? 0.4 : 0.1,
            shadowRadius: isListening ? 16 : 4,
            shadowOffset: { width: 0, height: isListening ? 0 : 2 },
            elevation: isListening ? 8 : 3,
            opacity: disabled ? 0.4 : 1,
          }}
        >
          {isListening
            ? <Mic size={dims.icon} color={iconColor} />
            : <Mic size={dims.icon} color={iconColor} />
          }
        </TouchableOpacity>
      </View>

      {/* Label */}
      {dims.label && (
        <Text style={{
          ...FONT.caption,
          color: isListening ? coachColor : colors.textMuted,
          marginTop: 10,
          fontWeight: isListening ? '600' : '500',
        }}>
          {isListening ? 'Listening...' : 'Tap to speak'}
        </Text>
      )}
    </View>
  );
}
