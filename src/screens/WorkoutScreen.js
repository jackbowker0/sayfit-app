// ============================================================
// WORKOUT SCREEN — Core workout experience (premium dark UI)
// Added: Exercise notes display, tap to edit notes, note badges
// Redesigned: Lucide icons, GlassCard, design tokens
// ============================================================

import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Flame, Wind, RefreshCw, SkipForward, Moon, Pause, Play, X, Heart, ClipboardList, Pencil, Mic, Zap, Info } from 'lucide-react-native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { useTimer } from '../hooks/useTimer';
import { useVoice } from '../hooks/useVoice';
import { COACHES, getFallbackResponse } from '../constants/coaches';
import { getCoachResponse, wasLastResponseFallback } from '../services/ai';
import { SPACING, RADIUS, FONT, GLOW, TIMING } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { formatTime, clamp } from '../utils/helpers';
import { WORKOUT_STATES } from '../hooks/useWorkout';
import { getNotesForWorkout } from '../services/exerciseNotes';
import ExerciseNoteEditor from '../components/ExerciseNoteEditor';
import ExerciseGuide from '../components/ExerciseGuide';
import { capture } from '../services/posthog';
import { COACH_ICONS, getMuscleIcon } from '../constants/icons';
import GlassCard from '../components/GlassCard';

const VOICE_COMMANDS = [
  { cmd: 'harder', label: 'Harder', Icon: Flame },
  { cmd: 'easier', label: 'Easier', Icon: Wind },
  { cmd: 'swap', label: 'Swap', Icon: RefreshCw },
  { cmd: 'skip', label: 'Skip', Icon: SkipForward },
  { cmd: 'tired', label: "I'm tired", Icon: Moon },
  { cmd: 'pause', label: 'Pause', Icon: Pause },
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

  const CoachIcon = COACH_ICONS[coach.iconName];
  const ExIcon = getMuscleIcon(currentExercise?.muscle);

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

  // Helper to get the next exercise icon
  const getNextExIcon = (exercise) => {
    const NextIcon = getMuscleIcon(exercise?.muscle);
    return NextIcon;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: SPACING.md }}>
      {/* Offline Notice */}
      {offlineNotice && (
        <View style={{ position: 'absolute', top: 40, alignSelf: 'center', zIndex: 60, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder }}>
          <Text style={{ ...FONT.caption, color: colors.textMuted }}>Offline mode — using preset coach responses</Text>
        </View>
      )}

      {/* Notification Toast */}
      {state.notification && (
        <View style={{ position: 'absolute', top: 70, alignSelf: 'center', zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: coach.color + '20', borderColor: coach.color + '40' }}>
          <Zap size={14} color={coach.color} />
          <Text style={{ ...FONT.caption, fontWeight: '600', color: coach.color }}>{state.notification.text}</Text>
        </View>
      )}

      {/* Top Bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }} onPress={handleEnd}>
          <X size={14} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, ...FONT.caption }}>End</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
          {CoachIcon && <CoachIcon size={16} color={coach.color} />}
          <Text style={{ ...FONT.caption, color: coach.color }}>{coach.name}</Text>
          <Text style={{ ...FONT.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>{formatTime(state.elapsed)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.red + '15', borderWidth: 1, borderColor: colors.red + '30' }}>
          <Heart size={14} color={colors.red} fill={colors.red} />
          <Text style={{ color: colors.red, ...FONT.caption, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{Math.round(state.heartRate)}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={{ marginBottom: SPACING.md }}>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
          <View style={{ height: '100%', borderRadius: 2, width: `${clamp(overallProgress, 0, 100)}%`, backgroundColor: coach.color }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>Exercise {Math.min(state.currentIndex + 1, state.exercises.length)}/{state.exercises.length}</Text>
          <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>{Math.round(clamp(overallProgress, 0, 100))}%</Text>
        </View>
      </View>

      {/* Exercise Card */}
      <GlassCard
        accentColor={isResting ? undefined : coach.color}
        glow={isActive && !isPaused && !isResting}
        style={{
          minHeight: 240, justifyContent: 'center', overflow: 'hidden',
          marginBottom: SPACING.md,
        }}
      >
        {isPaused && (
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: isDark ? '#000000aa' : 'rgba(0,0,0,0.5)', borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', zIndex: 5, gap: 8 }}>
            <Pause size={32} color="#fff" />
            <Text style={{ ...FONT.heading, color: '#fff' }}>PAUSED</Text>
            <Text style={{ ...FONT.caption, color: '#ffffff50' }}>Tap "Pause" to resume</Text>
          </View>
        )}

        {isTransitioning ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginBottom: 8, fontWeight: '500' }}>Get Ready</Text>
            {ExIcon && <ExIcon size={36} color={coach.color} style={{ marginBottom: 8 }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ ...FONT.title, fontSize: 24, color: colors.textPrimary }}>{currentExercise?.name}</Text>
              <TouchableOpacity
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: coach.color + '15', borderWidth: 1, borderColor: coach.color + '25',
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={() => setShowGuide(true)}
                accessibilityLabel={`How to do ${currentExercise?.name}`}
              >
                <Info size={16} color={coach.color} />
              </TouchableOpacity>
            </View>

            {/* ── NOTE REMINDER DURING TRANSITION ── */}
            {currentNote && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                marginTop: 8, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: RADIUS.sm, backgroundColor: coachColor15(coach.color),
                borderWidth: 1, borderColor: coachColor20(coach.color),
                maxWidth: '90%',
              }}>
                <ClipboardList size={13} color={coach.color} />
                <Text style={{ ...FONT.caption, color: coach.color, fontWeight: '600' }}>
                  {currentNote.weight ? `${currentNote.weight}` : ''}
                  {currentNote.weight && currentNote.notes ? ' · ' : ''}
                  {currentNote.notes ? currentNote.notes.split('\n')[0] : ''}
                </Text>
              </View>
            )}

            <Text style={{ ...FONT.statLg, fontSize: 64, fontWeight: '900', color: coach.color }}>{state.timer}</Text>
          </View>
        ) : isResting ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginBottom: 8, fontWeight: '500' }}>Rest Period</Text>
            <Text style={{ ...FONT.statLg, fontSize: 56, fontWeight: '900', color: colors.textSecondary }}>{state.restTimer}s</Text>

            {/* ── NOTE EDIT BUTTON DURING REST ── */}
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                marginTop: 12, paddingHorizontal: 12, paddingVertical: 8,
                borderRadius: RADIUS.sm, backgroundColor: colors.glassBg,
                borderWidth: 1, borderColor: colors.glassBorder,
              }}
              onPress={handleOpenNotes}
              accessibilityLabel={`${currentNote ? 'Edit' : 'Add'} notes for ${currentExercise?.name}`}
            >
              {currentNote
                ? <ClipboardList size={14} color={colors.textSecondary} />
                : <Pencil size={14} color={colors.textSecondary} />
              }
              <Text style={{ ...FONT.caption, color: colors.textSecondary, fontWeight: '500' }}>
                {currentNote ? 'Edit My Settings' : 'Add Settings (seat, weight...)'}
              </Text>
            </TouchableOpacity>

            {state.exercises[state.currentIndex + 1] ? (
              <View style={{ alignItems: 'center', marginTop: 12, gap: 4 }}>
                <Text style={{ ...FONT.label, fontSize: 11, color: colors.textMuted }}>COMING UP</Text>
                {(() => { const NextIcon = getNextExIcon(state.exercises[state.currentIndex + 1]); return NextIcon ? <NextIcon size={28} color={colors.textSecondary} /> : null; })()}
                <Text style={{ ...FONT.subhead, fontSize: 16, color: colors.textSecondary }}>{state.exercises[state.currentIndex + 1].name}</Text>

                {/* Show note preview for next exercise too */}
                {exerciseNotes[state.exercises[state.currentIndex + 1]?.id] && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <ClipboardList size={11} color={coach.color} />
                    <Text style={{ ...FONT.label, fontSize: 11, color: coach.color, textTransform: 'none', letterSpacing: 0 }}>
                      {exerciseNotes[state.exercises[state.currentIndex + 1].id].weight || exerciseNotes[state.exercises[state.currentIndex + 1].id].notes?.split('\n')[0] || ''}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={{ ...FONT.subhead, fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>Last exercise done!</Text>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            {ExIcon && <ExIcon size={44} color={coach.color} style={{ marginBottom: 8 }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ ...FONT.title, fontSize: 24, color: colors.textPrimary }}>{currentExercise?.name}</Text>
              <TouchableOpacity
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: coach.color + '15', borderWidth: 1, borderColor: coach.color + '25',
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={() => setShowGuide(true)}
                accessibilityLabel={`How to do ${currentExercise?.name}`}
              >
                <Info size={16} color={coach.color} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
              <Text style={{ ...FONT.caption, color: colors.textMuted }}>{currentExercise?.muscle}</Text>
              <Text style={{ ...FONT.caption, color: colors.textMuted }}>•</Text>
              <Text style={{ ...FONT.caption, color: colors.textMuted }}>Intensity {state.intensity}/10</Text>
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
                <ClipboardList size={13} color={coach.color} />
                <Text style={{ ...FONT.caption, color: coach.color, fontWeight: '500' }} numberOfLines={1}>
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
                <Pencil size={11} color={colors.textDim} />
                <Text style={{ fontSize: 11, color: colors.textDim }}>Add settings</Text>
              </TouchableOpacity>
            )}

            <Text style={{ ...FONT.statLg, fontSize: 56, fontWeight: '900', color: colors.textPrimary }}>{Math.max(state.timer, 0)}</Text>
            <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted }}>SECONDS</Text>
          </View>
        )}
      </GlassCard>

      {/* Stats Row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: SPACING.md }}>
        {[
          { val: state.stats.calories, label: 'CALORIES', color: colors.orange },
          { val: state.stats.exercisesCompleted, label: 'DONE', color: colors.green },
          { val: state.stats.adaptations, label: 'ADAPTED', color: coach.color },
        ].map(s => (
          <View key={s.label} style={{ flex: 1, padding: 10, borderRadius: RADIUS.md, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center' }}>
            <Text style={{ ...FONT.stat, fontSize: 20, color: s.color }}>{s.val}</Text>
            <Text style={{ ...FONT.label, fontSize: 9, color: colors.textMuted, marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Chat */}
      <View style={{ height: 100, marginBottom: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, overflow: 'hidden' }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8 }} showsVerticalScrollIndicator={false} ref={ref => ref?.scrollToEnd?.({ animated: true })}>
          {state.chatLog.slice(-8).map(entry => (
            <View key={entry.id} style={{ flexDirection: 'row', marginBottom: 6, justifyContent: entry.isCoach ? 'flex-start' : 'flex-end' }}>
              <View style={{
                maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1,
                ...(entry.isCoach
                  ? { backgroundColor: coach.color + '18', borderColor: coach.color + '30', borderTopLeftRadius: 4 }
                  : { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, borderTopRightRadius: 4 }),
              }}>
                <Text style={{ ...FONT.body, fontSize: 13, lineHeight: 18, color: entry.isCoach ? coach.color : colors.textSecondary }}>{entry.msg}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        {transcript ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.glassBg, borderTopWidth: 1, borderColor: colors.glassBorder }}>
            <Mic size={12} color={colors.textMuted} />
            <Text style={{ ...FONT.caption, color: colors.textMuted }}>{transcript}</Text>
          </View>
        ) : null}
      </View>

      {/* Commands */}
      <View style={{ marginTop: 'auto' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
          {isListening && <Mic size={12} color={coach.color} />}
          <Text style={{ ...FONT.label, fontSize: 10, color: colors.textDim, textAlign: 'center' }}>
            {isListening ? 'Listening...' : isResting ? 'Rest — tap Skip to move on' : isTransitioning ? 'Get ready...' : 'Tap a command below'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
          {VOICE_COMMANDS.map(vc => {
            const enabled = cmdEnabled(vc.cmd);
            const isPauseActive = vc.cmd === 'pause' && isPaused;
            const iconColor = isPauseActive ? colors.green : enabled ? coach.color : colors.textDim;
            return (
              <TouchableOpacity key={vc.cmd} style={{
                width: '31%', paddingVertical: 14, borderRadius: 14, borderWidth: 1,
                borderColor: isPauseActive ? colors.green + '30' : colors.glassBorder,
                backgroundColor: isPauseActive ? colors.green + '10' : colors.glassBg,
                alignItems: 'center', gap: 4, opacity: enabled ? 1 : 0.3,
              }} onPress={() => enabled && handleCommand(vc.cmd)} activeOpacity={enabled ? 0.6 : 1} disabled={!enabled}>
                {isPauseActive
                  ? <Play size={20} color={colors.green} />
                  : <vc.Icon size={20} color={iconColor} />
                }
                <Text style={{ ...FONT.caption, color: isPauseActive ? colors.green : enabled ? colors.textSecondary : colors.textDim }}>
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
        exerciseIcon={editingExercise?.icon || ''}
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
