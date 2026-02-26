// ============================================================
// WORKOUT SCREEN — Core workout experience (themed + notes)
// Added: Exercise notes display, tap to edit notes, note badges
// ============================================================

import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { useWorkoutContext } from '../context/WorkoutContext';
import { useTimer } from '../hooks/useTimer';
import { useVoice } from '../hooks/useVoice';
import { COACHES, getFallbackResponse } from '../constants/coaches';
import { getCoachResponse, wasLastResponseFallback } from '../services/ai';
import { SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { formatTime, clamp } from '../utils/helpers';
import { WORKOUT_STATES } from '../hooks/useWorkout';
import { getNotesForWorkout } from '../services/exerciseNotes';
import ExerciseNoteEditor from '../components/ExerciseNoteEditor';
import ExerciseGuide from '../components/ExerciseGuide';

const VOICE_COMMANDS = [
  { cmd: 'harder', label: 'Harder', icon: '🔥' },
  { cmd: 'easier', label: 'Easier', icon: '💨' },
  { cmd: 'swap', label: 'Swap', icon: '🔄' },
  { cmd: 'skip', label: 'Skip', icon: '⏭️' },
  { cmd: 'tired', label: "I'm tired", icon: '😮‍💨' },
  { cmd: 'pause', label: 'Pause', icon: '⏸️' },
];

export default function WorkoutScreen({ navigation }) {
  const { coachId, workout } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();
  const {
    state, tick, sendCommand, clearNotification,
    currentExercise, progress, overallProgress,
    isActive, isResting, isPaused, isComplete, isTransitioning,
  } = workout;

  // ─── EXERCISE NOTES STATE ────────────────────────────────────
  const [exerciseNotes, setExerciseNotes] = useState({});
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState(false);
  const offlineShown = useRef(false);

  // Load notes for all exercises in this workout
  useEffect(() => {
    if (state.exercises?.length > 0) {
      const ids = state.exercises.map(e => e.id).filter(Boolean);
      getNotesForWorkout(ids).then(setExerciseNotes);
    }
  }, [state.exercises]);

  // Get note for current exercise
  const currentNote = currentExercise?.id ? exerciseNotes[currentExercise.id] : null;

  // Open note editor for current exercise
  const handleOpenNotes = useCallback(() => {
    if (!currentExercise) return;
    setEditingExercise(currentExercise);
    setShowNoteEditor(true);
  }, [currentExercise]);

  // Handle note saved — update local cache
  const handleNoteSaved = useCallback((noteData) => {
    if (!editingExercise?.id) return;
    setExerciseNotes(prev => {
      const updated = { ...prev };
      if (noteData) {
        updated[editingExercise.id] = noteData;
      } else {
        delete updated[editingExercise.id];
      }
      return updated;
    });
  }, [editingExercise]);

  useEffect(() => { activateKeepAwakeAsync(); return () => deactivateKeepAwake(); }, []);
  useEffect(() => { if (isComplete) navigation.replace('Complete'); }, [isComplete]);

  // Prevent accidental back navigation (Android back button, swipe)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isComplete) return; // allow navigation when workout is done
      e.preventDefault();
      Alert.alert('End Workout?', 'You have a workout in progress. Are you sure you want to leave?', [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'End Workout', style: 'destructive', onPress: () => { workout.reset(); navigation.dispatch(e.data.action); } },
      ]);
    });
    return unsubscribe;
  }, [navigation, isComplete, workout]);

  const shouldTick = state.status !== WORKOUT_STATES.IDLE && state.status !== WORKOUT_STATES.COMPLETE && state.status !== WORKOUT_STATES.PAUSED;
  useTimer(tick, shouldTick);

  useEffect(() => {
    if (state.notification) { const t = setTimeout(clearNotification, 2500); return () => clearTimeout(t); }
  }, [state.notification]);

  const handleCommand = useCallback(async (cmd) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const label = VOICE_COMMANDS.find(v => v.cmd === cmd)?.label || cmd;
    let coachMessage;
    try {
      coachMessage = await getCoachResponse(coachId, cmd, {
        exerciseName: currentExercise?.name, exerciseIntensity: state.intensity,
        exercisesCompleted: state.stats.exercisesCompleted, totalExercises: state.exercises.length,
        heartRate: state.heartRate, adaptations: state.stats.adaptations,
      });
    } catch { coachMessage = getFallbackResponse(coachId, cmd); }
    sendCommand(cmd, `"${label}"`, coachMessage);
    // Show a one-time notice if we're using offline/fallback responses
    if (!offlineShown.current && wasLastResponseFallback()) {
      offlineShown.current = true;
      setOfflineNotice(true);
      setTimeout(() => setOfflineNotice(false), 4000);
    }
  }, [coachId, currentExercise, state, sendCommand]);

  const voiceEnabled = isActive && !isPaused;
  const { isListening, transcript } = useVoice(handleCommand, voiceEnabled);
  const cmdEnabled = (cmd) => { if (cmd === 'pause') return true; if (isPaused) return false; if (cmd === 'skip') return true; return isActive; };

  const handleEnd = () => {
    Alert.alert('End Workout?', 'Are you sure you want to stop?', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: () => { workout.reset(); navigation.replace('MainTabs'); } },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: SPACING.md }}>
      {/* Offline Notice */}
      {offlineNotice && (
        <View style={{ position: 'absolute', top: 40, alignSelf: 'center', zIndex: 60, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Offline mode — using preset coach responses</Text>
        </View>
      )}

      {/* Notification Toast */}
      {state.notification && (
        <View style={{ position: 'absolute', top: 70, alignSelf: 'center', zIndex: 50, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: coach.color + '20', borderColor: coach.color + '40' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: coach.color }}>⚡ {state.notification.text}</Text>
        </View>
      )}

      {/* Top Bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
        <TouchableOpacity style={{ backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }} onPress={handleEnd}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>✕ End</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 12, color: coach.color }}>{coach.emoji} {coach.name}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>{formatTime(state.elapsed)}</Text>
        </View>
        <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.red + '15', borderWidth: 1, borderColor: colors.red + '30' }}>
          <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>♥ {Math.round(state.heartRate)}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={{ marginBottom: SPACING.md }}>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
          <View style={{ height: '100%', borderRadius: 2, width: `${clamp(overallProgress, 0, 100)}%`, backgroundColor: coach.color }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: 10, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>Exercise {Math.min(state.currentIndex + 1, state.exercises.length)}/{state.exercises.length}</Text>
          <Text style={{ fontSize: 10, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>{Math.round(clamp(overallProgress, 0, 100))}%</Text>
        </View>
      </View>

      {/* Exercise Card */}
      <View style={{
        backgroundColor: isDark ? '#0d1117' : colors.bgCard, borderWidth: 1,
        borderColor: isResting ? colors.border : coach.color + '20',
        borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md,
        minHeight: 240, justifyContent: 'center', overflow: 'hidden',
      }}>
        {isPaused && (
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: isDark ? '#000000aa' : 'rgba(0,0,0,0.5)', borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', zIndex: 5, gap: 8 }}>
            <Text style={{ fontSize: 28 }}>⏸️</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>PAUSED</Text>
            <Text style={{ fontSize: 12, color: '#ffffff50' }}>Tap "Pause" to resume</Text>
          </View>
        )}

        {isTransitioning ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8, fontWeight: '500' }}>Get Ready!</Text>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>{currentExercise?.icon}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>{currentExercise?.name}</Text>
              <TouchableOpacity
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: coach.color + '15', borderWidth: 1, borderColor: coach.color + '25',
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={() => setShowGuide(true)}
                accessibilityLabel={`How to do ${currentExercise?.name}`}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: coach.color }}>?</Text>
              </TouchableOpacity>
            </View>

            {/* ── NOTE REMINDER DURING TRANSITION ── */}
            {currentNote && (
              <View style={{
                marginTop: 8, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: RADIUS.sm, backgroundColor: coachColor15(coach.color),
                borderWidth: 1, borderColor: coachColor20(coach.color),
                maxWidth: '90%',
              }}>
                <Text style={{ fontSize: 12, color: coach.color, fontWeight: '600' }}>
                  📋 {currentNote.weight ? `${currentNote.weight}` : ''}
                  {currentNote.weight && currentNote.notes ? ' · ' : ''}
                  {currentNote.notes ? currentNote.notes.split('\n')[0] : ''}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 64, fontWeight: '900', color: coach.color, fontVariant: ['tabular-nums'] }}>{state.timer}</Text>
          </View>
        ) : isResting ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8, fontWeight: '500' }}>Rest Period</Text>
            <Text style={{ fontSize: 56, fontWeight: '900', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{state.restTimer}s</Text>

            {/* ── NOTE EDIT BUTTON DURING REST ── */}
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                marginTop: 12, paddingHorizontal: 12, paddingVertical: 8,
                borderRadius: RADIUS.sm, backgroundColor: colors.bgSubtle,
                borderWidth: 1, borderColor: colors.border,
              }}
              onPress={handleOpenNotes}
              accessibilityLabel={`${currentNote ? 'Edit' : 'Add'} notes for ${currentExercise?.name}`}
            >
              <Text style={{ fontSize: 14 }}>{currentNote ? '📋' : '📝'}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '500' }}>
                {currentNote ? 'Edit My Settings' : 'Add Settings (seat, weight...)'}
              </Text>
            </TouchableOpacity>

            {state.exercises[state.currentIndex + 1] ? (
              <View style={{ alignItems: 'center', marginTop: 12, gap: 4 }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 2 }}>COMING UP</Text>
                <Text style={{ fontSize: 24 }}>{state.exercises[state.currentIndex + 1].icon}</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary }}>{state.exercises[state.currentIndex + 1].name}</Text>

                {/* Show note preview for next exercise too */}
                {exerciseNotes[state.exercises[state.currentIndex + 1]?.id] && (
                  <Text style={{ fontSize: 11, color: coach.color, marginTop: 2 }}>
                    📋 {exerciseNotes[state.exercises[state.currentIndex + 1].id].weight || exerciseNotes[state.exercises[state.currentIndex + 1].id].notes?.split('\n')[0] || ''}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 12 }}>Last exercise done! 🎉</Text>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>{currentExercise?.icon}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>{currentExercise?.name}</Text>
              <TouchableOpacity
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: coach.color + '15', borderWidth: 1, borderColor: coach.color + '25',
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={() => setShowGuide(true)}
                accessibilityLabel={`How to do ${currentExercise?.name}`}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: coach.color }}>?</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{currentExercise?.muscle}</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>•</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Intensity {state.intensity}/10</Text>
            </View>

            {/* ── ACTIVE EXERCISE NOTE DISPLAY ── */}
            {currentNote && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: RADIUS.sm, backgroundColor: coachColor10(coach.color),
                  borderWidth: 1, borderColor: coachColor20(coach.color),
                  marginBottom: 8, maxWidth: '90%',
                }}
                onPress={handleOpenNotes}
                accessibilityLabel={`Your settings: ${currentNote.weight || ''} ${currentNote.notes || ''}. Tap to edit.`}
              >
                <Text style={{ fontSize: 12 }}>📋</Text>
                <Text style={{ fontSize: 12, color: coach.color, fontWeight: '500' }} numberOfLines={1}>
                  {currentNote.weight ? `${currentNote.weight}` : ''}
                  {currentNote.weight && currentNote.notes ? ' · ' : ''}
                  {currentNote.notes ? currentNote.notes.split('\n')[0] : ''}
                </Text>
              </TouchableOpacity>
            )}

            {/* No note — subtle add button */}
            {!currentNote && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: RADIUS.sm, marginBottom: 8, opacity: 0.5,
                }}
                onPress={handleOpenNotes}
                accessibilityLabel={`Add settings for ${currentExercise?.name}`}
              >
                <Text style={{ fontSize: 11, color: colors.textDim }}>📝 Add settings</Text>
              </TouchableOpacity>
            )}

            <Text style={{ fontSize: 56, fontWeight: '900', color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>{Math.max(state.timer, 0)}</Text>
            <Text style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 2 }}>SECONDS</Text>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: SPACING.md }}>
        {[
          { val: state.stats.calories, label: 'CALORIES', color: colors.orange },
          { val: state.stats.exercisesCompleted, label: 'DONE', color: colors.green },
          { val: state.stats.adaptations, label: 'ADAPTED', color: coach.color },
        ].map(s => (
          <View key={s.label} style={{ flex: 1, padding: 10, borderRadius: RADIUS.md, backgroundColor: s.color + '10', borderWidth: 1, borderColor: s.color + '20', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: s.color, fontVariant: ['tabular-nums'] }}>{s.val}</Text>
            <Text style={{ fontSize: 9, color: colors.textMuted, letterSpacing: 1.5, marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Chat */}
      <View style={{ height: 100, marginBottom: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8 }} showsVerticalScrollIndicator={false} ref={ref => ref?.scrollToEnd?.({ animated: true })}>
          {state.chatLog.slice(-8).map(entry => (
            <View key={entry.id} style={{ flexDirection: 'row', marginBottom: 6, justifyContent: entry.isCoach ? 'flex-start' : 'flex-end' }}>
              <View style={{
                maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1,
                ...(entry.isCoach
                  ? { backgroundColor: coach.color + '18', borderColor: coach.color + '30', borderTopLeftRadius: 4 }
                  : { backgroundColor: colors.bgSubtle, borderColor: colors.border, borderTopRightRadius: 4 }),
              }}>
                <Text style={{ fontSize: 13, lineHeight: 18, color: entry.isCoach ? coach.color : colors.textSecondary }}>{entry.msg}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        {transcript ? (
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgSubtle, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>🎙️ {transcript}</Text>
          </View>
        ) : null}
      </View>

      {/* Commands */}
      <View style={{ marginTop: 'auto' }}>
        <Text style={{ fontSize: 10, letterSpacing: 2, color: colors.textDim, textTransform: 'uppercase', textAlign: 'center', marginBottom: 10 }}>
          {isListening ? '🎙️ Listening...' : isResting ? 'Rest — tap Skip to move on' : isTransitioning ? 'Get ready...' : 'Tap a command below'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
          {VOICE_COMMANDS.map(vc => {
            const enabled = cmdEnabled(vc.cmd);
            const isPauseActive = vc.cmd === 'pause' && isPaused;
            return (
              <TouchableOpacity key={vc.cmd} style={{
                width: '31%', paddingVertical: 14, borderRadius: 14, borderWidth: 1,
                borderColor: isPauseActive ? colors.green + '30' : colors.border,
                backgroundColor: isPauseActive ? colors.green + '10' : colors.bgCard,
                alignItems: 'center', gap: 4, opacity: enabled ? 1 : 0.3,
              }} onPress={() => enabled && handleCommand(vc.cmd)} activeOpacity={enabled ? 0.6 : 1} disabled={!enabled}>
                <Text style={{ fontSize: 18 }}>{isPauseActive ? '▶️' : vc.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isPauseActive ? colors.green : enabled ? colors.textSecondary : colors.textDim }}>
                  {isPauseActive ? 'Resume' : vc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── EXERCISE NOTE EDITOR MODAL ── */}
      <ExerciseNoteEditor
        visible={showNoteEditor}
        exerciseId={editingExercise?.id}
        exerciseName={editingExercise?.name || ''}
        exerciseIcon={editingExercise?.icon || '💪'}
        coachColor={coach.color}
        onClose={() => setShowNoteEditor(false)}
        onSave={handleNoteSaved}
      />

      {/* ── EXERCISE GUIDE MODAL ── */}
      <ExerciseGuide
        visible={showGuide}
        exercise={currentExercise}
        coachColor={coach.color}
        onClose={() => setShowGuide(false)}
      />
    </SafeAreaView>
  );
}

// ─── HELPER: Color opacity strings ──────────────────────────────
function coachColor10(c) { return c + '18'; }
function coachColor15(c) { return c + '25'; }
function coachColor20(c) { return c + '33'; }