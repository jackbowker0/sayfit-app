// ============================================================
// REST TIMER — Countdown between sets
// With: haptics, accessibility, themed controls
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import {
  X, Play, Pause, SkipForward, Plus, Check, ArrowRight,
} from 'lucide-react-native';

import { COLORS, RADIUS, FONT, GLOW } from '../constants/theme';
import * as haptics from '../services/haptics';

const DEFAULT_REST = 90;

export default function RestTimer({
  isActive,
  duration = DEFAULT_REST,
  coachColor = '#FF6B35',
  reason = '',
  onComplete,
  onSkip,
  onDismiss,
}) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [totalTime, setTotalTime] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);
  const hasCompleted = useRef(false);

  // Reset when activated
  useEffect(() => {
    if (isActive) {
      setTimeLeft(duration);
      setTotalTime(duration);
      setIsPaused(false);
      hasCompleted.current = false;
    } else {
      clearInterval(intervalRef.current);
    }
  }, [isActive, duration]);

  // Countdown
  useEffect(() => {
    if (!isActive || isPaused) {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        // 10-second warning tick
        if (prev === 11) {
          haptics.tick();
        }

        if (prev <= 1) {
          clearInterval(intervalRef.current);
          if (!hasCompleted.current) {
            hasCompleted.current = true;
            // Warning haptic -- "time to get back to work"
            haptics.warning();
          }
          if (onComplete) onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isActive, isPaused]);

  const handleSkip = () => {
    haptics.tap();
    clearInterval(intervalRef.current);
    if (onSkip) onSkip();
  };

  const handleAdd30 = () => {
    haptics.tap();
    setTimeLeft(prev => prev + 30);
    setTotalTime(prev => prev + 30);
  };

  const handlePause = () => {
    haptics.tap();
    setIsPaused(p => !p);
  };

  if (!isActive) return null;

  const progress = totalTime > 0 ? timeLeft / totalTime : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeString = `${mins}:${secs.toString().padStart(2, '0')}`;
  const isDone = timeLeft <= 0;

  const ringSize = 160;
  const ringStroke = 8;

  return (
    <View style={styles.overlay} accessible accessibilityViewIsModal>
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => { haptics.tap(); (onDismiss || onSkip)(); }}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          accessibilityRole="button"
          accessibilityLabel="Close rest timer"
        >
          <X size={22} color="rgba(255,255,255,0.25)" strokeWidth={1.5} />
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.label}>{isDone ? 'REST COMPLETE' : 'REST'}</Text>

        {/* Smart rest reason */}
        {!isDone && reason ? (
          <Text style={[styles.reasonText, { color: coachColor }]}>{reason}</Text>
        ) : null}

        {/* Timer Ring */}
        <View
          style={[styles.ringOuter, { width: ringSize, height: ringSize }]}
          accessible
          accessibilityRole="timer"
          accessibilityLabel={isDone ? 'Rest complete' : `${timeString} remaining`}
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.ringBg, {
            width: ringSize, height: ringSize, borderRadius: ringSize / 2,
            borderWidth: ringStroke, borderColor: 'rgba(255,255,255,0.03)',
          }]} />
          <View style={[styles.ringProgress, {
            width: ringSize, height: ringSize, borderRadius: ringSize / 2,
            borderWidth: ringStroke,
            borderColor: isDone ? '#2ECC40' : coachColor,
            borderTopColor: progress >= 0.25 ? (isDone ? '#2ECC40' : coachColor) : 'transparent',
            borderRightColor: progress >= 0.5 ? (isDone ? '#2ECC40' : coachColor) : 'transparent',
            borderBottomColor: progress >= 0.75 ? (isDone ? '#2ECC40' : coachColor) : 'transparent',
            borderLeftColor: progress >= 1 ? (isDone ? '#2ECC40' : coachColor) : 'transparent',
          }]} />
          <View style={styles.ringCenter}>
            {isDone ? (
              <Check size={48} color="#2ECC40" strokeWidth={2.5} />
            ) : (
              <>
                <Text style={styles.timeText}>{timeString}</Text>
                <Text style={styles.timeLabel}>remaining</Text>
              </>
            )}
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {!isDone ? (
            <>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip rest timer"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <SkipForward size={14} color={COLORS.textSecondary} strokeWidth={2} />
                  <Text style={styles.controlText}>Skip</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlBtnAccent, {
                  backgroundColor: coachColor + '20', borderColor: coachColor + '40',
                  shadowColor: coachColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.2,
                  shadowRadius: GLOW.sm,
                }]}
                onPress={handlePause}
                accessibilityRole="button"
                accessibilityLabel={isPaused ? 'Resume timer' : 'Pause timer'}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  {isPaused ? (
                    <Play size={14} color={coachColor} strokeWidth={2.5} />
                  ) : (
                    <Pause size={14} color={coachColor} strokeWidth={2.5} />
                  )}
                  <Text style={[styles.controlTextAccent, { color: coachColor }]}>
                    {isPaused ? 'Resume' : 'Pause'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlBtn}
                onPress={handleAdd30}
                accessibilityRole="button"
                accessibilityLabel="Add 30 seconds"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Plus size={13} color={COLORS.textSecondary} strokeWidth={2.5} />
                  <Text style={styles.controlText}>30s</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.doneBtn, {
                backgroundColor: '#2ECC40',
                shadowColor: '#2ECC40',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: GLOW.md,
              }]}
              onPress={handleSkip}
              accessibilityRole="button"
              accessibilityLabel="Continue to next set"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.doneBtnText}>Next Set</Text>
                <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Countdown warning */}
        {!isDone && timeLeft <= 10 && timeLeft > 0 && (
          <Text style={[styles.tip, { color: coachColor }]}>Get ready...</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8, 8, 15, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    alignItems: 'center',
    padding: 40,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...FONT.label,
    fontSize: 14,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 4,
    marginBottom: 8,
  },
  reasonText: {
    ...FONT.caption,
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 22,
    textAlign: 'center',
  },
  ringOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  ringBg: {
    position: 'absolute',
  },
  ringProgress: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  ringCenter: {
    alignItems: 'center',
  },
  timeText: {
    ...FONT.statLg,
    fontSize: 48,
    color: '#fff',
  },
  timeLabel: {
    ...FONT.label,
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  controlBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    minHeight: 48,
    justifyContent: 'center',
  },
  controlText: {
    ...FONT.subhead,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  controlBtnAccent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  controlTextAccent: {
    ...FONT.subhead,
    fontSize: 14,
    fontWeight: '700',
  },
  doneBtn: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    minHeight: 52,
    justifyContent: 'center',
  },
  doneBtnText: {
    ...FONT.subhead,
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  tip: {
    ...FONT.subhead,
    fontSize: 14,
    marginTop: 24,
  },
});
