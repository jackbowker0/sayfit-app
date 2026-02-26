// ============================================================
// JUST TALK SCREEN — Conversational + Manual workout builder
// NEW: Toggle between "Talk" mode (natural language) and
// "Build" mode (manual exercise search/autofill builder)
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Animated, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { useWorkoutContext } from '../context/WorkoutContext';
import {
  parseWorkoutRequest, generateSmartWorkout, generateWorkout, initGeneratorCache,
} from '../services/workoutGenerator';
import { getCoachResponse } from '../services/ai';
import { COACHES, getFallbackResponse } from '../constants/coaches';
import { EXERCISES } from '../constants/exercises';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getUserProfile } from '../services/userProfile';
import ExerciseSearch from '../components/ExerciseSearch';
import * as haptics from '../services/haptics';

// ─── PRESETS BY FITNESS LEVEL ─────────────────────────────────────

const ALL_PRESETS = [
  { label: '⚡ 5 Min Burn', value: '5 minutes intense full body quick', levels: ['intermediate', 'advanced'] },
  { label: '🔥 10 Min HIIT', value: '10 minutes intense cardio hiit', levels: ['intermediate', 'advanced'] },
  { label: '💪 Quick Arms', value: '10 minutes upper body arms', levels: ['all'] },
  { label: '🦵 Leg Day', value: '20 minutes legs lower body', levels: ['all'] },
  { label: '🧘 Easy Core', value: '15 minutes easy core abs', levels: ['all'] },
  { label: '🏋️ 20 Min Full', value: '20 minutes moderate full body', levels: ['all'] },
  { label: '😴 Low Energy', value: '15 minutes tired easy gentle', levels: ['all'] },
  { label: '🔥 30 Min Beast', value: '30 minutes intense full body beast mode', levels: ['intermediate', 'advanced'] },
  { label: '🌱 Gentle Start', value: '10 minutes easy full body beginner', levels: ['beginner'] },
  { label: '🍑 Glute Focus', value: '15 minutes glutes booty', levels: ['all'] },
  { label: '🏔️ Core Burner', value: '10 minutes intense core', levels: ['intermediate', 'advanced'] },
  { label: '🧘 Stretch', value: '15 minutes easy stretch flexibility', levels: ['all'] },
];

// ─── MODE TOGGLE LABELS ──────────────────────────────────────────

const MODE_LABELS = {
  talk: { icon: '💬', label: 'Talk' },
  build: { icon: '🔧', label: 'Build' },
};

export default function JustTalkScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const contextValue = useWorkoutContext();
  const { coachId } = contextValue;
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  // ─── SHARED STATE ─────────────────────────────────────────────
  const [mode, setMode] = useState('talk'); // 'talk' | 'build'
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState('input');
  const [parsed, setParsed] = useState(null);
  const [workout, setWorkout] = useState(null);
  const [profile, setProfile] = useState(null);

  // ─── BUILD MODE STATE ─────────────────────────────────────────
  const [manualExercises, setManualExercises] = useState([]);
  const [workoutName, setWorkoutName] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const modeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getUserProfile().then(p => setProfile(p));
  }, []);

  // Handle "Do Again" from Dashboard/Calendar
  useEffect(() => {
    const repeatWorkout = route.params?.repeatWorkout;
    if (!repeatWorkout) return;
    setMode('talk');
    setPhase('input');
    setInput(repeatWorkout.name || '');
    // Clear the param so it doesn't re-trigger
    navigation.setParams({ repeatWorkout: undefined });
  }, [route.params?.repeatWorkout]);

  // Animate mode switch
  useEffect(() => {
    Animated.timing(modeAnim, {
      toValue: mode === 'build' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [mode]);

  // Filter presets by fitness level
  const presets = ALL_PRESETS.filter(p =>
    p.levels.includes('all') || p.levels.includes(profile?.fitnessLevel || 'intermediate')
  ).slice(0, 8);

  // ─── MODE SWITCH ──────────────────────────────────────────────

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    haptics.tap();
    setMode(newMode);
  };

  // ─── TALK MODE: GENERATE ──────────────────────────────────────

  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async (text) => {
    const requestText = text || input;
    if (!requestText.trim() || generating) return;

    haptics.tap();
    setGenerating(true);
    setPhase('loading');

    try {
      const parsedRequest = parseWorkoutRequest(requestText);
      const generatedWorkout = await generateSmartWorkout(parsedRequest);
      await initGeneratorCache();

      if (!generatedWorkout?.exercises || generatedWorkout.exercises.length === 0) {
        Alert.alert('No Exercises Found', "Couldn't build a workout from that. Try something like \"20 min full body\" or pick a quick start below.");
        setPhase('input');
        return;
      }

      setParsed(parsedRequest);
      setWorkout(generatedWorkout);
      setPhase('preview');
      haptics.success();

      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    } catch (e) {
      console.warn('[JustTalk] Generation failed:', e);
      setPhase('input');
    } finally {
      setGenerating(false);
    }
  }, [input, generating, fadeAnim, slideAnim]);

  // ─── BUILD MODE: ADD/REMOVE EXERCISES ─────────────────────────

  const handleAddExercise = useCallback((exercise) => {
    setManualExercises(prev => {
      if (prev.find(e => e.id === exercise.id)) return prev;
      return [...prev, { ...exercise, phase: 'main' }];
    });
  }, []);

  const handleRemoveExercise = useCallback((exerciseId) => {
    haptics.tap();
    setManualExercises(prev => prev.filter(e => e.id !== exerciseId));
  }, []);

  const handleReorderExercise = useCallback((fromIndex, direction) => {
    haptics.tick();
    setManualExercises(prev => {
      const next = [...prev];
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= next.length) return prev;
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  }, []);

  // ─── BUILD MODE: START WORKOUT ────────────────────────────────

  const handleBuildStart = useCallback(async () => {
    if (manualExercises.length === 0) return;
    haptics.medium();

    // Build workout object from manual selections
    const builtWorkout = {
      name: workoutName.trim() || `Custom ${manualExercises.length}-Exercise Workout`,
      exercises: manualExercises.map((ex, i) => ({
        ...ex,
        rest: i < manualExercises.length - 1 ? 15 : 0,
        phase: 'main',
      })),
      estimatedCalories: Math.round(manualExercises.reduce((sum, ex) => sum + (ex.duration * 0.15 * (ex.intensity / 5)), 0)),
      fitnessLevel: profile?.fitnessLevel || 'intermediate',
      structure: { warmup: 0, main: manualExercises.length, cooldown: 0 },
    };

    const firstExercise = builtWorkout.exercises[0];
    let startMessage;
    try {
      startMessage = await getCoachResponse(coachId, 'start', {
        exerciseName: firstExercise?.name || 'first exercise',
        exerciseIntensity: firstExercise?.intensity ?? 7,
        exercisesCompleted: 0,
        totalExercises: builtWorkout.exercises.length,
      });
    } catch { startMessage = getFallbackResponse(coachId, 'start'); }

    contextValue.workout.startWorkout(coachId, startMessage, builtWorkout);
    navigation.replace('Workout');
  }, [manualExercises, workoutName, navigation, contextValue, coachId, profile]);

  // ─── TALK MODE: START WORKOUT ─────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!workout) return;
    haptics.medium();

    const firstExercise = workout.exercises.find(e => e.phase === 'main') || workout.exercises[0];
    let startMessage;
    try {
      startMessage = await getCoachResponse(coachId, 'start', {
        exerciseName: firstExercise?.name || 'first exercise',
        exerciseIntensity: firstExercise?.intensity ?? 7,
        exercisesCompleted: 0,
        totalExercises: workout.exercises.length,
      });
    } catch { startMessage = getFallbackResponse(coachId, 'start'); }

    contextValue.workout.startWorkout(coachId, startMessage, workout);
    navigation.replace('Workout');
  }, [workout, navigation, contextValue, coachId]);

  // ─── REGENERATE / RESET ───────────────────────────────────────

  const handleRegenerate = useCallback(() => {
    if (!parsed) return;
    haptics.tap();
    const newWorkout = generateWorkout(parsed);
    setWorkout(newWorkout);
    fadeAnim.setValue(0.3);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [parsed, fadeAnim]);

  const handleBack = useCallback(() => {
    haptics.tap();
    setPhase('input');
    setInput('');
    setParsed(null);
    setWorkout(null);
  }, []);

  // ─── HELPERS ──────────────────────────────────────────────────

  const getEquipmentLabel = () => {
    if (!profile?.equipment || profile.equipment.length === 0) return 'Bodyweight';
    const labels = { bodyweight: 'Bodyweight', dumbbells: 'Dumbbells', bands: 'Bands', full_gym: 'Full Gym' };
    return profile.equipment.map(e => labels[e] || e).join(', ');
  };

  const getLevelEmoji = () => {
    return { beginner: '🌱', intermediate: '🔥', advanced: '⚡' }[profile?.fitnessLevel] || '🔥';
  };

  const getEstimatedTime = () => {
    const totalDuration = manualExercises.reduce((sum, ex) => sum + (ex.duration || 45), 0);
    const restTime = Math.max(0, manualExercises.length - 1) * 15;
    return Math.ceil((totalDuration + restTime) / 60);
  };

  // ─── RENDER: MODE TOGGLE ─────────────────────────────────────

  const renderModeToggle = () => (
    <View style={{
      flexDirection: 'row', marginBottom: 20, marginHorizontal: SPACING.lg,
      backgroundColor: colors.bgSubtle, borderRadius: RADIUS.md, padding: 3,
      borderWidth: 1, borderColor: colors.border,
    }}>
      {['talk', 'build'].map(m => {
        const isActive = mode === m;
        return (
          <TouchableOpacity
            key={m}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm,
              backgroundColor: isActive ? (isDark ? colors.bgCard : '#fff') : 'transparent',
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
              ...(isActive ? { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : {}),
            }}
            onPress={() => handleModeSwitch(m)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${MODE_LABELS[m].label} mode`}
          >
            <Text style={{ fontSize: 14 }}>{MODE_LABELS[m].icon}</Text>
            <Text style={{ fontSize: 14, fontWeight: isActive ? '700' : '500', color: isActive ? colors.textPrimary : colors.textMuted }}>
              {MODE_LABELS[m].label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── RENDER: BUILD MODE INPUT ─────────────────────────────────

  const renderBuildMode = () => (
    <View style={{ flex: 1, paddingHorizontal: SPACING.lg }}>
      {/* Header */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 }}>
          Build Workout
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
          Search and pick your exercises. I'll handle the rest.
        </Text>
      </View>

      {/* Workout name (optional) */}
      <TextInput
        style={{
          backgroundColor: colors.bgCard, borderRadius: RADIUS.md,
          borderWidth: 1, borderColor: colors.border,
          paddingHorizontal: 14, paddingVertical: 10,
          color: colors.textPrimary, fontSize: 15, marginBottom: 12,
          minHeight: 44,
        }}
        placeholder="Workout name (optional)"
        placeholderTextColor={colors.textDim}
        value={workoutName}
        onChangeText={setWorkoutName}
        maxLength={50}
        accessibilityLabel="Workout name"
      />

      {/* Exercise Search */}
      <ExerciseSearch
        onSelect={handleAddExercise}
        selectedIds={manualExercises.map(e => e.id)}
        equipment={profile?.equipment || []}
        coachColor={coach.color}
        maxHeight={manualExercises.length > 0 ? 200 : 320}
      />

      {/* Selected Exercises List */}
      {manualExercises.length > 0 && (
        <View style={{ marginTop: 16, flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textDim, letterSpacing: 1 }}>
              YOUR WORKOUT · {manualExercises.length} exercise{manualExercises.length !== 1 ? 's' : ''}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              ~{getEstimatedTime()} min
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {manualExercises.map((ex, index) => (
              <View key={ex.id} style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.bgCard, borderRadius: RADIUS.md,
                padding: 12, marginBottom: 6,
                borderWidth: 1, borderColor: colors.border,
              }}>
                {/* Order number */}
                <View style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: coach.color + '15', justifyContent: 'center', alignItems: 'center', marginRight: 10,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: coach.color }}>{index + 1}</Text>
                </View>

                {/* Exercise info */}
                <Text style={{ fontSize: 16, marginRight: 8 }}>{ex.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{ex.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>{ex.muscle} · {ex.duration}s</Text>
                </View>

                {/* Reorder buttons */}
                <View style={{ flexDirection: 'row', gap: 2, marginRight: 6 }}>
                  <TouchableOpacity
                    style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center', opacity: index === 0 ? 0.2 : 0.6 }}
                    onPress={() => handleReorderExercise(index, 'up')}
                    disabled={index === 0}
                    accessibilityLabel={`Move ${ex.name} up`}
                  >
                    <Text style={{ fontSize: 14, color: colors.textMuted }}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center', opacity: index === manualExercises.length - 1 ? 0.2 : 0.6 }}
                    onPress={() => handleReorderExercise(index, 'down')}
                    disabled={index === manualExercises.length - 1}
                    accessibilityLabel={`Move ${ex.name} down`}
                  >
                    <Text style={{ fontSize: 14, color: colors.textMuted }}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Remove */}
                <TouchableOpacity
                  style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: colors.red + '10', justifyContent: 'center', alignItems: 'center',
                  }}
                  onPress={() => handleRemoveExercise(ex.id)}
                  accessibilityLabel={`Remove ${ex.name}`}
                >
                  <Text style={{ fontSize: 14, color: colors.red }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={{ height: 120 }} />
          </ScrollView>
        </View>
      )}

      {/* Start Button (Build Mode) */}
      {manualExercises.length > 0 && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: SPACING.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 20,
          backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
        }}>
          <TouchableOpacity
            style={{
              backgroundColor: coach.color, borderRadius: RADIUS.md,
              paddingVertical: 16, alignItems: 'center', minHeight: 52,
            }}
            onPress={handleBuildStart}
            accessibilityRole="button"
            accessibilityLabel={`Start custom workout with ${manualExercises.length} exercises`}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: getTextOnColor(coach.color) }}>
              Start {manualExercises.length} Exercise{manualExercises.length !== 1 ? 's' : ''} →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ─── RENDER: TALK MODE INPUT ──────────────────────────────────

  const renderTalkInput = () => (
    <View style={{ flex: 1, paddingHorizontal: SPACING.lg }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8 }}>
          Just Talk
        </Text>
        <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>
          Tell me what you've got — time, energy, focus — and I'll build your workout.
        </Text>
        {/* Profile context badge */}
        {profile && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: coach.color + '10', borderWidth: 1, borderColor: coach.color + '20' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: coach.color }}>{getLevelEmoji()} {profile.fitnessLevel}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.bgSubtle, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>🏋️ {getEquipmentLabel()}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Input */}
      <View style={{
        flexDirection: 'row', alignItems: 'flex-end',
        backgroundColor: colors.bgCard, borderRadius: RADIUS.lg,
        borderWidth: 1, borderColor: colors.border,
        paddingLeft: 16, paddingRight: 6, paddingVertical: 6, marginBottom: 20,
      }}>
        <TextInput
          style={{ flex: 1, color: colors.textPrimary, fontSize: 16, minHeight: 44, maxHeight: 100, paddingVertical: 10 }}
          placeholder={`"20 min core, I'm feeling tired" or "quick intense leg day"`}
          placeholderTextColor={colors.textDim}
          value={input} onChangeText={setInput} multiline maxLength={200}
          returnKeyType="send" onSubmitEditing={() => handleGenerate()} blurOnSubmit
          accessibilityLabel="Describe your ideal workout"
        />
        <TouchableOpacity
          style={{
            width: 44, height: 44, borderRadius: RADIUS.md,
            backgroundColor: input.trim() && !generating ? coach.color : colors.bgSubtle,
            justifyContent: 'center', alignItems: 'center',
            opacity: generating ? 0.5 : 1,
          }}
          onPress={() => handleGenerate()} disabled={!input.trim() || generating}
          accessibilityRole="button" accessibilityLabel="Generate workout"
        >
          <Text style={{ fontSize: 20, fontWeight: '700', color: input.trim() && !generating ? getTextOnColor(coach.color) : colors.textDim }}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.textDim, fontSize: 13, marginHorizontal: 12 }}>or pick a quick start</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      {/* Presets */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {presets.map(preset => (
          <TouchableOpacity
            key={preset.label}
            style={{
              backgroundColor: colors.bgCard, borderRadius: 20,
              paddingHorizontal: 16, paddingVertical: 10,
              borderWidth: 1, borderColor: colors.border,
              opacity: generating ? 0.5 : 1,
            }}
            onPress={() => { setInput(preset.value); handleGenerate(preset.value); }}
            activeOpacity={0.7} disabled={generating}
            accessibilityRole="button" accessibilityLabel={preset.label}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─── RENDER: LOADING ──────────────────────────────────────────

  const renderLoadingPhase = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}>
      <ActivityIndicator size="large" color={coach.color} />
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 20 }}>Building your workout...</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 6 }}>
        {{
          drill: "Picking exercises that'll make you earn it.",
          hype: "Making something AMAZING for you!",
          zen: "Crafting your practice with intention.",
        }[coachId]}
      </Text>
      <TouchableOpacity
        onPress={() => { setGenerating(false); setPhase('input'); }}
        style={{ marginTop: 24, paddingHorizontal: 20, paddingVertical: 10 }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── RENDER: PREVIEW ─────────────────────────────────────────

  const renderPreviewPhase = () => {
    if (!workout || !parsed) return null;

    const energyEmoji = { low: '🧘', medium: '💪', high: '🔥' };
    const energyLabel = { low: 'Easy', medium: 'Moderate', high: 'Intense' };
    const phaseLabels = { warmup: '🔄 WARM-UP', main: '🏋️ MAIN', cooldown: '🧘 COOL-DOWN' };

    return (
      <Animated.View style={{ flex: 1, paddingHorizontal: SPACING.lg, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* Summary Card */}
        <View style={{
          backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: 20,
          marginBottom: 20, borderWidth: 1, borderColor: coach.color + '20',
        }}>
          <Text style={{ color: colors.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Here's what I built:</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 14 }}>{workout.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              `⏱ ${parsed.duration} min`,
              `${energyEmoji[parsed.energy]} ${energyLabel[parsed.energy]}`,
              `${workout.exercises?.length || 0} exercises`,
              `~${workout.estimatedCalories} cal`,
            ].map(tag => (
              <View key={tag} style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: coach.color + '15' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: coach.color }}>{tag}</Text>
              </View>
            ))}
          </View>
          {workout.structure && (
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 10 }}>
              {workout.structure.warmup > 0 ? `${workout.structure.warmup} warmup → ` : ''}
              {workout.structure.main} main
              {workout.structure.cooldown > 0 ? ` → ${workout.structure.cooldown} cooldown` : ''}
              {' · '}Scaled for {workout.fitnessLevel}
            </Text>
          )}
        </View>

        {/* Exercise List */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {(() => {
            let currentPhase = '';
            return workout.exercises?.map((ex, index) => {
              const showPhaseHeader = ex.phase && ex.phase !== currentPhase;
              if (showPhaseHeader) currentPhase = ex.phase;

              return (
                <View key={ex.id || index}>
                  {showPhaseHeader && (
                    <Text style={{
                      color: colors.textDim, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, marginTop: index > 0 ? 16 : 0,
                    }}>{phaseLabels[ex.phase] || ex.phase?.toUpperCase()}</Text>
                  )}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: colors.bgCard, borderRadius: RADIUS.md,
                    padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: colors.border,
                    opacity: ex.phase === 'warmup' || ex.phase === 'cooldown' ? 0.8 : 1,
                  }}
                    accessible accessibilityLabel={`${ex.name}, ${ex.muscle}, ${ex.duration} seconds work${ex.rest > 0 ? `, ${ex.rest} seconds rest` : ''}`}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: ex.phase === 'main' ? coach.color + '18' : colors.bgSubtle,
                      justifyContent: 'center', alignItems: 'center', marginRight: 14,
                    }}>
                      <Text style={{ fontSize: 16 }}>{ex.icon || '💪'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>{ex.name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        {ex.muscle}{ex.equipment && ex.equipment !== 'none' ? ` · ${ex.equipment}` : ''}{' · '}
                        {ex.duration}s{ex.rest > 0 ? ` · ${ex.rest}s rest` : ''}
                      </Text>
                    </View>
                    {ex.phase === 'main' && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.bgSubtle }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textMuted }}>{ex.intensity}/10</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            });
          })()}
          <View style={{ height: 160 }} />
        </ScrollView>

        {/* Action Bar */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          flexDirection: 'row', padding: SPACING.lg,
          paddingBottom: Platform.OS === 'ios' ? 40 : 20,
          backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border, gap: 10,
        }}>
          <TouchableOpacity
            style={{ backgroundColor: colors.bgCard, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: colors.border, minHeight: 48 }}
            onPress={handleRegenerate} accessibilityRole="button" accessibilityLabel="Shuffle exercises"
          >
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>🔄 Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: colors.bgCard, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: colors.border, minHeight: 48 }}
            onPress={handleBack} accessibilityRole="button" accessibilityLabel="Edit request"
          >
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>✏️ Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: coach.color, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', minHeight: 48 }}
            onPress={handleStart} accessibilityRole="button" accessibilityLabel="Start workout"
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: getTextOnColor(coach.color) }}>Start Workout →</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  // ─── MAIN RENDER ──────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Top bar */}
        <TouchableOpacity
          style={{ paddingHorizontal: SPACING.lg, paddingVertical: 10, minHeight: 44 }}
          onPress={() => (phase === 'preview' ? handleBack() : navigation.goBack())}
          accessibilityRole="button" accessibilityLabel={phase === 'preview' ? 'New request' : 'Go back'}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
            {phase === 'preview' ? '← New Request' : '← Back'}
          </Text>
        </TouchableOpacity>

        {/* Mode Toggle (only in input phase) */}
        {phase === 'input' && renderModeToggle()}

        {/* Content */}
        {phase === 'input' && mode === 'talk' && renderTalkInput()}
        {phase === 'input' && mode === 'build' && renderBuildMode()}
        {phase === 'loading' && renderLoadingPhase()}
        {phase === 'preview' && renderPreviewPhase()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}