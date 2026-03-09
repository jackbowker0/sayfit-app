// ============================================================
// JUST TALK SCREEN — Conversational + Manual workout builder
// NEW: Toggle between "Talk" mode (natural language) and
// "Build" mode (manual exercise search/autofill builder)
// Premium dark UI redesign — Lucide icons, GlassCard,
// FadeInView animations, design tokens
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Animated,
} from 'react-native';
// expo-speech-recognition requires a native build — not available in Expo Go
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = () => {}; // no-op in Expo Go
try {
  const SpeechRec = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = SpeechRec.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = SpeechRec.useSpeechRecognitionEvent;
} catch (_) {}
import FadeInView from '../components/FadeInView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import {
  Zap, Flame, Dumbbell, Footprints, Waves, Moon, Sparkles, Target, Mountain,
  MessageCircle, Swords, RefreshCw, Pencil, Clock, Send, ArrowRight, Mic,
  ChevronUp, ChevronDown, X,
} from 'lucide-react-native';
import { COACH_ICONS, getMuscleIcon } from '../constants/icons';

import { useWorkoutContext } from '../context/WorkoutContext';
import {
  parseWorkoutRequest, generateSmartWorkout, generateWorkout, initGeneratorCache,
} from '../services/workoutGenerator';
import { getCoachResponse } from '../services/ai';
import { COACHES, getFallbackResponse } from '../constants/coaches';
import { EXERCISES } from '../constants/exercises';
import { SPACING, RADIUS, FONT, GLOW, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getUserProfile } from '../services/userProfile';
import ExerciseSearch from '../components/ExerciseSearch';
import GlassCard from '../components/GlassCard';
import * as haptics from '../services/haptics';
import { capture } from '../services/posthog';

// ─── PRESETS BY FITNESS LEVEL ─────────────────────────────────────

const ALL_PRESETS = [
  { label: '5 Min Burn', Icon: Zap, value: '5 minutes intense full body quick', levels: ['intermediate', 'advanced'] },
  { label: '10 Min HIIT', Icon: Flame, value: '10 minutes intense cardio hiit', levels: ['intermediate', 'advanced'] },
  { label: 'Quick Arms', Icon: Dumbbell, value: '10 minutes upper body arms', levels: ['all'] },
  { label: 'Leg Day', Icon: Footprints, value: '20 minutes legs lower body', levels: ['all'] },
  { label: 'Easy Core', Icon: Waves, value: '15 minutes easy core abs', levels: ['all'] },
  { label: '20 Min Full', Icon: Dumbbell, value: '20 minutes moderate full body', levels: ['all'] },
  { label: 'Low Energy', Icon: Moon, value: '15 minutes tired easy gentle', levels: ['all'] },
  { label: '30 Min Beast', Icon: Flame, value: '30 minutes intense full body beast mode', levels: ['intermediate', 'advanced'] },
  { label: 'Gentle Start', Icon: Sparkles, value: '10 minutes easy full body beginner', levels: ['beginner'] },
  { label: 'Glute Focus', Icon: Target, value: '15 minutes glutes booty', levels: ['all'] },
  { label: 'Core Burner', Icon: Mountain, value: '10 minutes intense core', levels: ['intermediate', 'advanced'] },
  { label: 'Stretch', Icon: Waves, value: '15 minutes easy stretch flexibility', levels: ['all'] },
];

// ─── MODE TOGGLE LABELS ──────────────────────────────────────────

const MODE_LABELS = {
  talk: { Icon: MessageCircle, label: 'Talk' },
  build: { Icon: Swords, label: 'Build' },
};

// ─── ENERGY ICONS ────────────────────────────────────────────────

const ENERGY_ICONS = { low: Waves, medium: Dumbbell, high: Flame };
const ENERGY_LABELS = { low: 'Easy', medium: 'Moderate', high: 'Intense' };

// ─── FITNESS LEVEL ICONS ─────────────────────────────────────────

const LEVEL_ICONS = { beginner: Sparkles, intermediate: Flame, advanced: Zap };

// ─── PHASE LABELS ────────────────────────────────────────────────

const PHASE_CONFIG = {
  warmup: { Icon: RefreshCw, label: 'WARM-UP' },
  main: { Icon: Dumbbell, label: 'MAIN' },
  cooldown: { Icon: Waves, label: 'COOL-DOWN' },
};

export default function JustTalkScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const contextValue = useWorkoutContext();
  const { coachId } = contextValue;
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();
  const CoachIcon = COACH_ICONS[coachId] || COACH_ICONS.drill;

  // ─── SHARED STATE ─────────────────────────────────────────────
  const [mode, setMode] = useState('talk'); // 'talk' | 'build'
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState('input');
  const [parsed, setParsed] = useState(null);
  const [workout, setWorkout] = useState(null);
  const [profile, setProfile] = useState(null);

  // ─── VOICE INPUT STATE ────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    stopPulse();
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (transcript) setInput(transcript);
  });
  useSpeechRecognitionEvent('error', () => {
    setIsListening(false);
    stopPulse();
  });

  const startPulse = useCallback(() => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const handleMicPress = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert('Voice unavailable', 'Voice input requires a full app build. It will work in the TestFlight version.');
      return;
    }
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      stopPulse();
      return;
    }
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow microphone access in Settings to use voice input.');
        return;
      }
      setInput('');
      haptics.tap();
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
      startPulse();
    } catch {
      Alert.alert('Voice unavailable', 'Voice input requires a full app build. It will work in the TestFlight version.');
    }
  }, [isListening, startPulse, stopPulse]);

  // ─── BUILD MODE STATE ─────────────────────────────────────────
  const [manualExercises, setManualExercises] = useState([]);
  const [workoutName, setWorkoutName] = useState('');

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
    } catch (e) {
      console.warn('[JustTalk] Generation failed:', e);
      setPhase('input');
      Alert.alert(
        'Generation Failed',
        'Could not create your workout. Check your connection and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleGenerate(requestText) },
        ]
      );
    } finally {
      setGenerating(false);
    }
  }, [input, generating]);

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

  const handleRegenerate = useCallback(async () => {
    if (!parsed || generating) return;
    haptics.tap();
    setGenerating(true);
    setPhase('loading');
    try {
      const newWorkout = await generateWorkout(parsed);
      setWorkout(newWorkout);
      setPhase('preview');
    } catch (e) {
      console.warn('[JustTalk] Shuffle failed:', e);
      setPhase('preview');
      Alert.alert('Shuffle Failed', 'Could not generate a new workout. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [parsed, generating]);

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

  const getLevelIcon = () => {
    return LEVEL_ICONS[profile?.fitnessLevel] || LEVEL_ICONS.intermediate;
  };

  const getEstimatedTime = () => {
    const totalDuration = manualExercises.reduce((sum, ex) => sum + (ex.duration || 45), 0);
    const restTime = Math.max(0, manualExercises.length - 1) * 15;
    return Math.ceil((totalDuration + restTime) / 60);
  };

  // ─── RENDER: MODE TOGGLE ─────────────────────────────────────

  const renderModeToggle = () => (
    <FadeInView
      from="none"
      style={{
        flexDirection: 'row', marginBottom: 20, marginHorizontal: SPACING.lg,
        backgroundColor: isDark ? colors.glassBg : colors.bgSubtle,
        borderRadius: RADIUS.md, padding: 3,
        borderWidth: 1, borderColor: isDark ? colors.glassBorder : colors.border,
      }}
    >
      {['talk', 'build'].map(m => {
        const isActive = mode === m;
        const ModeIcon = MODE_LABELS[m].Icon;
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
            <ModeIcon size={14} color={isActive ? colors.textPrimary : colors.textMuted} />
            <Text style={{ ...FONT.caption, fontWeight: isActive ? '700' : '500', color: isActive ? colors.textPrimary : colors.textMuted }}>
              {MODE_LABELS[m].label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </FadeInView>
  );

  // ─── RENDER: BUILD MODE INPUT ─────────────────────────────────

  const renderBuildMode = () => (
    <FadeInView from="none" style={{ flex: 1, paddingHorizontal: SPACING.lg }}>
      {/* Header */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ ...FONT.title, color: colors.textPrimary, marginBottom: 4 }}>
          Build Workout
        </Text>
        <Text style={{ ...FONT.body, color: colors.textSecondary }}>
          Search and pick your exercises. I'll handle the rest.
        </Text>
      </View>

      {/* Workout name (optional) */}
      <TextInput
        style={{
          backgroundColor: isDark ? colors.glassBg : colors.bgCard,
          borderRadius: RADIUS.md,
          borderWidth: 1, borderColor: isDark ? colors.glassBorder : colors.border,
          paddingHorizontal: 14, paddingVertical: 10,
          color: colors.textPrimary, ...FONT.body, marginBottom: 12,
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
            <Text style={{ ...FONT.label, color: colors.textDim }}>
              YOUR WORKOUT · {manualExercises.length} exercise{manualExercises.length !== 1 ? 's' : ''}
            </Text>
            <Text style={{ ...FONT.caption, color: colors.textMuted }}>
              ~{getEstimatedTime()} min
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {manualExercises.map((ex, index) => {
              const MuscleIcon = getMuscleIcon(ex.muscle);
              return (
                <FadeInView
                  key={ex.id}
                  delay={index * 50}
                >
                  <GlassCard
                    accentColor={coach.color}
                    style={{ padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center' }}
                  >
                    {/* Order number */}
                    <View style={{
                      width: 24, height: 24, borderRadius: 12,
                      backgroundColor: coach.color + '15', justifyContent: 'center', alignItems: 'center', marginRight: 10,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: coach.color }}>{index + 1}</Text>
                    </View>

                    {/* Exercise info */}
                    <View style={{
                      width: 32, height: 32, borderRadius: 8,
                      backgroundColor: coach.color + '12', justifyContent: 'center', alignItems: 'center', marginRight: 10,
                    }}>
                      <MuscleIcon size={16} color={coach.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...FONT.caption, fontWeight: '600', fontSize: 14, color: colors.textPrimary }}>{ex.name}</Text>
                      <Text style={{ ...FONT.label, color: colors.textMuted, textTransform: 'none', letterSpacing: 0 }}>{ex.muscle} · {ex.duration}s</Text>
                    </View>

                    {/* Reorder buttons */}
                    <View style={{ flexDirection: 'row', gap: 2, marginRight: 6 }}>
                      <TouchableOpacity
                        style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center', opacity: index === 0 ? 0.2 : 0.6 }}
                        onPress={() => handleReorderExercise(index, 'up')}
                        disabled={index === 0}
                        accessibilityLabel={`Move ${ex.name} up`}
                      >
                        <ChevronUp size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center', opacity: index === manualExercises.length - 1 ? 0.2 : 0.6 }}
                        onPress={() => handleReorderExercise(index, 'down')}
                        disabled={index === manualExercises.length - 1}
                        accessibilityLabel={`Move ${ex.name} down`}
                      >
                        <ChevronDown size={16} color={colors.textMuted} />
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
                      <X size={14} color={colors.red} />
                    </TouchableOpacity>
                  </GlassCard>
                </FadeInView>
              );
            })}
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
              flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
            onPress={handleBuildStart}
            accessibilityRole="button"
            accessibilityLabel={`Start custom workout with ${manualExercises.length} exercises`}
          >
            <Text style={{ ...FONT.subhead, fontWeight: '700', color: getTextOnColor(coach.color) }}>
              Start {manualExercises.length} Exercise{manualExercises.length !== 1 ? 's' : ''}
            </Text>
            <ArrowRight size={18} color={getTextOnColor(coach.color)} />
          </TouchableOpacity>
        </View>
      )}
    </FadeInView>
  );

  // ─── RENDER: TALK MODE INPUT ──────────────────────────────────

  const renderTalkInput = () => {
    const LevelIcon = getLevelIcon();
    return (
      <FadeInView from="none" style={{ flex: 1, paddingHorizontal: SPACING.lg }}>
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Text style={{ ...FONT.title, color: colors.textPrimary }}>
              Just Talk
            </Text>
            <CoachIcon size={22} color={coach.color} />
          </View>
          <Text style={{ ...FONT.body, color: colors.textSecondary }}>
            Tell me what you've got — time, energy, focus — and I'll build your workout.
          </Text>
          {/* Profile context badge */}
          {profile && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: coach.color + '10', borderWidth: 1, borderColor: coach.color + '20' }}>
                <LevelIcon size={12} color={coach.color} />
                <Text style={{ ...FONT.label, color: coach.color, textTransform: 'capitalize', letterSpacing: 0 }}>{profile.fitnessLevel}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: isDark ? colors.glassBg : colors.bgSubtle, borderWidth: 1, borderColor: isDark ? colors.glassBorder : colors.border }}>
                <Dumbbell size={12} color={colors.textMuted} />
                <Text style={{ ...FONT.label, color: colors.textMuted, textTransform: 'none', letterSpacing: 0 }}>{getEquipmentLabel()}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Input */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end',
          backgroundColor: isDark ? colors.glassBg : colors.bgCard,
          borderRadius: RADIUS.lg,
          borderWidth: 1, borderColor: isListening ? coach.color + '60' : (isDark ? colors.glassBorder : colors.border),
          paddingLeft: 6, paddingRight: 6, paddingVertical: 6, marginBottom: 20,
        }}>
          {/* Mic button */}
          <TouchableOpacity
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            onPress={handleMicPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Stop listening' : 'Start voice input'}
          >
            <Animated.View style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: isListening ? coach.color + '20' : 'transparent',
              justifyContent: 'center', alignItems: 'center',
              transform: [{ scale: pulseAnim }],
            }}>
              <Mic size={20} color={isListening ? coach.color : colors.textMuted} />
            </Animated.View>
          </TouchableOpacity>

          <TextInput
            style={{ flex: 1, color: colors.textPrimary, fontSize: 16, minHeight: 44, maxHeight: 100, paddingVertical: 10, paddingHorizontal: 4 }}
            placeholder={isListening ? 'Listening...' : `"20 min core, I'm feeling tired" or "quick intense leg day"`}
            placeholderTextColor={isListening ? coach.color : colors.textDim}
            value={input} onChangeText={setInput} multiline maxLength={200}
            returnKeyType="send" onSubmitEditing={() => handleGenerate()} blurOnSubmit
            accessibilityLabel="Describe your ideal workout"
          />

          {/* Send button */}
          <TouchableOpacity
            style={{
              width: 44, height: 44, borderRadius: RADIUS.md,
              backgroundColor: input.trim() && !generating ? coach.color : (isDark ? colors.glassBg : colors.bgSubtle),
              justifyContent: 'center', alignItems: 'center',
              opacity: generating ? 0.5 : 1,
            }}
            onPress={() => handleGenerate()} disabled={!input.trim() || generating}
            accessibilityRole="button" accessibilityLabel="Generate workout"
          >
            <Send size={18} color={input.trim() && !generating ? getTextOnColor(coach.color) : colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.textDim, ...FONT.caption, marginHorizontal: 12 }}>or pick a quick start</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Presets */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {presets.map((preset, idx) => {
            const PresetIcon = preset.Icon;
            return (
              <FadeInView key={preset.label} delay={idx * 40}>
                <TouchableOpacity
                  style={{
                    backgroundColor: isDark ? colors.glassBg : colors.bgCard,
                    borderRadius: 20,
                    paddingHorizontal: 14, paddingVertical: 10,
                    borderWidth: 1, borderColor: isDark ? colors.glassBorder : colors.border,
                    opacity: generating ? 0.5 : 1,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  }}
                  onPress={() => { setInput(preset.value); handleGenerate(preset.value); }}
                  activeOpacity={0.7} disabled={generating}
                  accessibilityRole="button" accessibilityLabel={preset.label}
                >
                  <PresetIcon size={14} color={coach.color} />
                  <Text style={{ color: colors.textPrimary, ...FONT.caption, fontWeight: '500', fontSize: 14 }}>{preset.label}</Text>
                </TouchableOpacity>
              </FadeInView>
            );
          })}
        </View>
      </FadeInView>
    );
  };

  // ─── RENDER: LOADING ──────────────────────────────────────────

  const renderLoadingPhase = () => (
    <FadeInView
      from="none"
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}
    >
      <ActivityIndicator size="large" color={coach.color} />
      <Text style={{ color: colors.textPrimary, ...FONT.heading, marginTop: 20 }}>Building your workout...</Text>
      <Text style={{ color: colors.textSecondary, ...FONT.body, marginTop: 6, textAlign: 'center', paddingHorizontal: SPACING.lg }}>
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
        <Text style={{ ...FONT.caption, fontWeight: '600', color: colors.textMuted }}>Cancel</Text>
      </TouchableOpacity>
    </FadeInView>
  );

  // ─── RENDER: PREVIEW ─────────────────────────────────────────

  const renderPreviewPhase = () => {
    if (!workout || !parsed) return null;

    const EnergyIcon = ENERGY_ICONS[parsed.energy] || ENERGY_ICONS.medium;

    return (
      <FadeInView
        from="up" distance={50}
        style={{ flex: 1, paddingHorizontal: SPACING.lg }}
      >
        {/* Summary Card */}
        <GlassCard accentColor={coach.color} glow style={{ padding: 20, marginBottom: 20 }}>
          <Text style={{ color: colors.textMuted, ...FONT.label, marginBottom: 6 }}>Here's what I built:</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 14 }}>{workout.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {/* Duration tag */}
            <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: coach.color + '15', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color={coach.color} />
              <Text style={{ ...FONT.caption, fontWeight: '600', color: coach.color }}>{parsed.duration} min</Text>
            </View>
            {/* Energy tag */}
            <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: coach.color + '15', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <EnergyIcon size={12} color={coach.color} />
              <Text style={{ ...FONT.caption, fontWeight: '600', color: coach.color }}>{ENERGY_LABELS[parsed.energy]}</Text>
            </View>
            {/* Exercises count tag */}
            <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: coach.color + '15' }}>
              <Text style={{ ...FONT.caption, fontWeight: '600', color: coach.color }}>{workout.exercises?.length || 0} exercises</Text>
            </View>
            {/* Calories tag */}
            <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: coach.color + '15' }}>
              <Text style={{ ...FONT.caption, fontWeight: '600', color: coach.color }}>~{workout.estimatedCalories} cal</Text>
            </View>
          </View>
          {workout.structure && (
            <Text style={{ ...FONT.label, color: colors.textMuted, marginTop: 10, textTransform: 'none', letterSpacing: 0 }}>
              {workout.structure.warmup > 0 ? `${workout.structure.warmup} warmup \u2192 ` : ''}
              {workout.structure.main} main
              {workout.structure.cooldown > 0 ? ` \u2192 ${workout.structure.cooldown} cooldown` : ''}
              {' · '}Scaled for {workout.fitnessLevel}
            </Text>
          )}
        </GlassCard>

        {/* Exercise List */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {(() => {
            let currentPhase = '';
            return workout.exercises?.map((ex, index) => {
              const showPhaseHeader = ex.phase && ex.phase !== currentPhase;
              if (showPhaseHeader) currentPhase = ex.phase;
              const phaseConfig = PHASE_CONFIG[ex.phase];
              const PhaseIcon = phaseConfig?.Icon;
              const MuscleIcon = getMuscleIcon(ex.muscle);

              return (
                <FadeInView
                  key={ex.id || index}
                  delay={index * 60}
                >
                  {showPhaseHeader && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: index > 0 ? 16 : 0 }}>
                      {PhaseIcon && <PhaseIcon size={11} color={colors.textDim} />}
                      <Text style={{
                        color: colors.textDim, ...FONT.label,
                      }}>{phaseConfig?.label || ex.phase?.toUpperCase()}</Text>
                    </View>
                  )}
                  <GlassCard
                    accentColor={ex.phase === 'main' ? coach.color : undefined}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      padding: 14, marginBottom: 8,
                      opacity: ex.phase === 'warmup' || ex.phase === 'cooldown' ? 0.8 : 1,
                    }}
                    noPadding={false}
                  >
                    <View
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        backgroundColor: ex.phase === 'main' ? coach.color + '18' : (isDark ? colors.glassBg : colors.bgSubtle),
                        justifyContent: 'center', alignItems: 'center', marginRight: 14,
                      }}
                      accessible
                      accessibilityLabel={`${ex.name}, ${ex.muscle}, ${ex.duration} seconds work${ex.rest > 0 ? `, ${ex.rest} seconds rest` : ''}`}
                    >
                      <MuscleIcon size={16} color={ex.phase === 'main' ? coach.color : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, ...FONT.body, fontWeight: '600' }}>{ex.name}</Text>
                      <Text style={{ color: colors.textMuted, ...FONT.caption, marginTop: 2 }}>
                        {ex.muscle}{ex.equipment && ex.equipment !== 'none' ? ` · ${ex.equipment}` : ''}{' · '}
                        {ex.duration}s{ex.rest > 0 ? ` · ${ex.rest}s rest` : ''}
                      </Text>
                    </View>
                    {ex.phase === 'main' && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: isDark ? colors.glassBg : colors.bgSubtle }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textMuted }}>{ex.intensity}/10</Text>
                      </View>
                    )}
                  </GlassCard>
                </FadeInView>
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
            style={{
              backgroundColor: isDark ? colors.glassBg : colors.bgCard,
              borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 14,
              borderWidth: 1, borderColor: isDark ? colors.glassBorder : colors.border,
              minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
            onPress={handleRegenerate} accessibilityRole="button" accessibilityLabel="Shuffle exercises"
          >
            <RefreshCw size={14} color={colors.textPrimary} />
            <Text style={{ color: colors.textPrimary, ...FONT.caption, fontWeight: '600', fontSize: 14 }}>Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: isDark ? colors.glassBg : colors.bgCard,
              borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 14,
              borderWidth: 1, borderColor: isDark ? colors.glassBorder : colors.border,
              minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
            onPress={handleBack} accessibilityRole="button" accessibilityLabel="Edit request"
          >
            <Pencil size={14} color={colors.textPrimary} />
            <Text style={{ color: colors.textPrimary, ...FONT.caption, fontWeight: '600', fontSize: 14 }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1, backgroundColor: coach.color, borderRadius: RADIUS.md,
              paddingVertical: 14, alignItems: 'center', minHeight: 48,
              flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
            onPress={handleStart} accessibilityRole="button" accessibilityLabel="Start workout"
          >
            <Text style={{ ...FONT.subhead, fontWeight: '700', color: getTextOnColor(coach.color) }}>Start Workout</Text>
            <ArrowRight size={18} color={getTextOnColor(coach.color)} />
          </TouchableOpacity>
        </View>
      </FadeInView>
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
            {phase === 'preview' ? '\u2190 New Request' : '\u2190 Back'}
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
