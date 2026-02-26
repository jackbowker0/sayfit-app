// ============================================================
// ONBOARDING SCREEN — First-time user experience (Premium Dark UI)
// 6 steps: Name -> Fitness Level -> Equipment -> Workout Days
//          -> Training Mode -> Coach
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FadeInView from '../components/FadeInView';
import {
  UserCircle, BarChart3, Dumbbell, Calendar, Lightbulb, Mic,
  MessageCircle, ClipboardList, Zap, ChevronLeft, ChevronRight, Check,
} from 'lucide-react-native';
import { COACH_ICONS } from '../constants/icons';
import GlassCard from '../components/GlassCard';
import { FONT, GLOW, SPACING, RADIUS, getTextOnColor } from '../constants/theme';

import { COACHES } from '../constants/coaches';
import { useTheme } from '../hooks/useTheme';
import {
  saveUserProfile, setOnboarded,
  EQUIPMENT_OPTIONS, FITNESS_LEVELS, DAY_OPTIONS,
} from '../services/userProfile';
import { useWorkoutContext } from '../context/WorkoutContext';
import * as haptics from '../services/haptics';
import { capture } from '../services/posthog';

const TOTAL_STEPS = 6;

const STEP_ICONS = [UserCircle, BarChart3, Dumbbell, Calendar, Lightbulb, Mic];

const MODE_ICON_MAP = {
  coach: MessageCircle,
  logger: ClipboardList,
  both: Zap,
};

const MODE_OPTIONS = [
  {
    id: 'coach',
    label: 'Coach builds my workouts',
    desc: 'Tell your coach what you want and they\'ll create a workout for you.',
    coachReaction: {
      drill: "Smart. I'll handle the programming. You just show up and work.",
      hype: "YES! I'm gonna build you the BEST workouts!",
      zen: "I'll craft each session to match your energy and intention.",
    },
  },
  {
    id: 'logger',
    label: 'I\'ll log my own workouts',
    desc: 'You already know what you\'re doing -- just track sets, reps, and weight.',
    coachReaction: {
      drill: "Self-sufficient. Good. I'll track your data and keep you honest.",
      hype: "Love that you know your stuff! I'll celebrate every PR!",
      zen: "Your practice, your record. I'll help you see the patterns.",
    },
  },
  {
    id: 'both',
    label: 'Both -- mix it up',
    desc: 'Some days you want coaching, some days you just want to log.',
    coachReaction: {
      drill: "Flexible approach. I can work with that.",
      hype: "Best of BOTH worlds! I'm here for ALL of it!",
      zen: "Variety brings balance. A wise choice.",
    },
  },
];

export default function OnboardingScreen({ navigation }) {
  const { setCoachId } = useWorkoutContext();
  const { colors, isDark } = useTheme();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('intermediate');
  const [equipment, setEquipment] = useState(['bodyweight']);
  const [workoutDays, setWorkoutDays] = useState([]);
  const [preferredMode, setPreferredMode] = useState('coach');
  const [selectedCoach, setSelectedCoach] = useState('hype');
  const [saving, setSaving] = useState(false);
  // Key used to force re-mount of step content for enter/exit animations
  const [stepKey, setStepKey] = useState(0);

  // POSTHOG: onboarding started
  React.useEffect(() => { capture('onboarding_started'); }, []);

  const coach = COACHES[selectedCoach];

  const _STEP_NAMES = ['name', 'fitness_level', 'equipment', 'workout_days', 'training_mode'];

  const animateTransition = useCallback((nextStep) => {
    setStepKey(k => k + 1);
    setStep(nextStep);
  }, []);

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      haptics.tap();
      capture('onboarding_step_completed', { step, step_name: _STEP_NAMES[step] });
      animateTransition(step + 1);
    }
  };
  const handleBack = () => { if (step > 0) { haptics.tap(); animateTransition(step - 1); } };
  const toggleEquipment = (id) => { haptics.tick(); setEquipment(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]); };
  const toggleDay = (id) => {
    haptics.tick();
    setWorkoutDays(prev => {
      const next = prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id].sort((a, b) => a - b);
      return next;
    });
  };

  const handleFinish = async () => {
    haptics.success();
    setSaving(true);
    try {
      await saveUserProfile({
        name: name.trim(), fitnessLevel, goals: [], equipment,
        coachId: selectedCoach, workoutDays, preferredMode,
        weeklyGoal: workoutDays.length > 0 ? workoutDays.length : 4,
        hasSeenTutorial: false,
      });
      await setOnboarded();
      capture('onboarding_completed', { fitness_level: fitnessLevel, equipment, workout_days_count: workoutDays.length, preferred_mode: preferredMode, coach_id: selectedCoach });
      setCoachId(selectedCoach);

      const tutorialMode = preferredMode === 'logger' ? 'logger' : 'coach';
      navigation.replace('Tutorial', { mode: tutorialMode });
    } catch (e) {
      Alert.alert('Setup Error', 'Something went wrong saving your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return name.trim().length >= 1;
    if (step === 1) return true;
    if (step === 2) return equipment.length >= 1;
    if (step === 3) return workoutDays.length >= 1;
    return true;
  };

  const getCoachWelcome = () => {
    const n = name.trim() || 'recruit';
    return {
      drill: `${n}. Good name. Now let's see if you can live up to it. I don't go easy on anyone -- but if you show up, I'll make you better. Deal?`,
      hype: `${n}!! OH MY GOD I'm so excited to work with you! We're going to have SO much fun and you're going to feel AMAZING! Let's gooo!`,
      zen: `Welcome, ${n}. I'm honored to guide your practice. Together we'll find balance between effort and ease. Take a breath -- your journey begins now.`,
    }[selectedCoach];
  };

  const getDaysSummary = () => {
    if (workoutDays.length === 0) return '';
    if (workoutDays.length === 7) return "Every day -- that's intense!";
    if (workoutDays.length >= 5) return `${workoutDays.length} days -- serious commitment.`;
    if (workoutDays.length >= 3) return `${workoutDays.length} days -- solid plan.`;
    return `${workoutDays.length} day${workoutDays.length > 1 ? 's' : ''} -- great start.`;
  };

  const selectedModeOption = MODE_OPTIONS.find(m => m.id === preferredMode);

  // ---- Step icon renderer ----
  const StepIcon = STEP_ICONS[step];

  // ---- Coach icon helper ----
  const renderCoachIcon = (coachObj, size = 32, isSelected = false) => {
    const CoachIcon = COACH_ICONS[coachObj.id];
    if (!CoachIcon) return null;
    return (
      <View style={[
        styles.coachIconCircle,
        {
          width: size + 20, height: size + 20, borderRadius: (size + 20) / 2,
          backgroundColor: isSelected ? coachObj.color + '20' : colors.glassBg,
          borderColor: isSelected ? coachObj.color + '50' : colors.glassBorder,
        },
        isSelected && isDark && {
          shadowColor: coachObj.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: GLOW.md,
          elevation: 4,
        },
      ]}>
        <CoachIcon size={size} color={isSelected ? coachObj.color : colors.textMuted} />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Progress bar with glow */}
        <View style={styles.progressBarTrack(colors)}>
          <View
            style={[
              styles.progressBarFill(coach.color, step),
              isDark && {
                shadowColor: coach.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: GLOW.sm,
                elevation: 3,
              },
            ]}
          />
        </View>

        <FadeInView key={stepKey} from="none" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingTop: 40, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Step 0: Name */}
            {step === 0 && (
              <FadeInView style={{ alignItems: 'center' }}>
                <View style={styles.stepIconWrap(colors)}>
                  <UserCircle size={36} color={coach.color} />
                </View>
                <Text style={[FONT.title, { color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }]}>What should we call you?</Text>
                <Text style={[FONT.body, { color: colors.textMuted, textAlign: 'center', marginBottom: 32 }]}>Your coach will use your name to keep things personal.</Text>
                <TextInput
                  style={[styles.nameInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="Your name" placeholderTextColor={colors.textDim}
                  value={name} onChangeText={setName} autoFocus returnKeyType="next" onSubmitEditing={handleNext} maxLength={20}
                  accessibilityLabel="Enter your name"
                />
              </FadeInView>
            )}

            {/* Step 1: Fitness Level */}
            {step === 1 && (
              <FadeInView style={{ alignItems: 'center' }}>
                <View style={styles.stepIconWrap(colors)}>
                  <BarChart3 size={36} color={coach.color} />
                </View>
                <Text style={[FONT.title, { color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }]}>What's your fitness level?</Text>
                <Text style={[FONT.body, { color: colors.textMuted, textAlign: 'center', marginBottom: 32 }]}>This helps us pick the right starting intensity.</Text>
                {FITNESS_LEVELS.map((level, idx) => {
                  const selected = fitnessLevel === level.id;
                  return (
                    <GlassCard
                      key={level.id}
                      accentColor={selected ? coach.color : undefined}
                      glow={selected}
                      style={styles.optionCardGlass(selected, coach.color, colors)}
                    >
                      <TouchableOpacity
                        style={styles.optionCardInner}
                        onPress={() => { haptics.tick(); setFitnessLevel(level.id); }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={{ fontSize: 24, marginRight: 14 }}>{level.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[FONT.subhead, { color: selected ? coach.color : colors.textPrimary }]}>{level.label}</Text>
                          <Text style={[FONT.caption, { color: colors.textMuted, marginTop: 2 }]}>{level.desc}</Text>
                        </View>
                        {selected && <Check size={18} color={coach.color} />}
                      </TouchableOpacity>
                    </GlassCard>
                  );
                })}
              </FadeInView>
            )}

            {/* Step 2: Equipment */}
            {step === 2 && (
              <FadeInView style={{ alignItems: 'center' }}>
                <View style={styles.stepIconWrap(colors)}>
                  <Dumbbell size={36} color={coach.color} />
                </View>
                <Text style={[FONT.title, { color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }]}>What equipment do you have?</Text>
                <Text style={[FONT.body, { color: colors.textMuted, textAlign: 'center', marginBottom: 32 }]}>We'll only suggest exercises you can actually do.</Text>
                {EQUIPMENT_OPTIONS.map((eq, idx) => {
                  const selected = equipment.includes(eq.id);
                  return (
                    <GlassCard
                      key={eq.id}
                      accentColor={selected ? coach.color : undefined}
                      glow={selected}
                      style={styles.optionCardGlass(selected, coach.color, colors)}
                    >
                      <TouchableOpacity
                        style={styles.optionCardInner}
                        onPress={() => toggleEquipment(eq.id)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={{ fontSize: 24, marginRight: 14 }}>{eq.emoji}</Text>
                        <Text style={[FONT.subhead, { flex: 1, color: selected ? coach.color : colors.textPrimary }]}>{eq.label}</Text>
                        {selected && <Check size={18} color={coach.color} />}
                      </TouchableOpacity>
                    </GlassCard>
                  );
                })}
              </FadeInView>
            )}

            {/* Step 3: Workout Days */}
            {step === 3 && (
              <FadeInView style={{ alignItems: 'center' }}>
                <View style={styles.stepIconWrap(colors)}>
                  <Calendar size={36} color={coach.color} />
                </View>
                <Text style={[FONT.title, { color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }]}>Which days will you train?</Text>
                <Text style={[FONT.body, { color: colors.textMuted, textAlign: 'center', marginBottom: 32 }]}>Tap your workout days. Your coach will hold you to it.</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, width: '100%' }}>
                  {DAY_OPTIONS.map(day => {
                    const selected = workoutDays.includes(day.id);
                    return (
                      <TouchableOpacity
                        key={day.id}
                        style={[
                          styles.dayCircle,
                          {
                            backgroundColor: selected ? coach.color : colors.glassBg,
                            borderColor: selected ? coach.color : colors.glassBorder,
                          },
                          selected && isDark && {
                            shadowColor: coach.color,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.4,
                            shadowRadius: GLOW.sm,
                            elevation: 3,
                          },
                        ]}
                        onPress={() => toggleDay(day.id)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${day.label}${selected ? ', selected' : ''}`}
                        accessibilityState={{ selected }}
                      >
                        <Text style={[FONT.caption, {
                          fontWeight: '700',
                          color: selected ? getTextOnColor(coach.color) : colors.textMuted,
                        }]}>{day.short}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {workoutDays.length > 0 && (
                  <GlassCard
                    accentColor={coach.color}
                    style={{ width: '100%' }}
                  >
                    <Text style={[FONT.subhead, { color: coach.color, textAlign: 'center' }]}>
                      {getDaysSummary()}
                    </Text>
                    <Text style={[FONT.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
                      {workoutDays.map(d => DAY_OPTIONS[d].label).join(', ')}
                    </Text>
                  </GlassCard>
                )}

                {workoutDays.length > 0 && (
                  <GlassCard
                    style={{ width: '100%' }}
                  >
                    <Text style={[FONT.body, { color: isDark ? coach.color : colors.textPrimary, fontStyle: 'italic', textAlign: 'center' }]}>
                      {{
                        drill: workoutDays.length >= 5
                          ? `${workoutDays.length} days. I like your ambition. Don't burn out.`
                          : workoutDays.length >= 3
                            ? `${workoutDays.length} days. Solid. I'll make every one count.`
                            : "We'll make the most of every session.",
                        hype: workoutDays.length >= 5
                          ? `${workoutDays.length} days?! You're going ALL IN! I love it!`
                          : workoutDays.length >= 3
                            ? `${workoutDays.length} days is PERFECT! Consistency is key!`
                            : "Every workout counts! Quality over quantity!",
                        zen: workoutDays.length >= 5
                          ? "An ambitious rhythm. Remember to listen to your body."
                          : workoutDays.length >= 3
                            ? "A balanced cadence. Room for movement and rest."
                            : "Even one mindful session can transform your week.",
                      }[selectedCoach]}
                    </Text>
                  </GlassCard>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 20, width: '100%' }}>
                  {[
                    { label: '3 days', days: [0, 2, 4] },
                    { label: '4 days', days: [0, 1, 3, 4] },
                    { label: '5 days', days: [0, 1, 2, 3, 4] },
                  ].map(preset => (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.presetButton, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                      onPress={() => { haptics.tap(); setWorkoutDays(preset.days); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[FONT.caption, { fontWeight: '600', color: colors.textSecondary }]}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FadeInView>
            )}

            {/* Step 4: Training Mode */}
            {step === 4 && (
              <FadeInView style={{ alignItems: 'center' }}>
                <View style={styles.stepIconWrap(colors)}>
                  <Lightbulb size={36} color={coach.color} />
                </View>
                <Text style={[FONT.title, { color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }]}>How do you want to train?</Text>
                <Text style={[FONT.body, { color: colors.textMuted, textAlign: 'center', marginBottom: 32 }]}>You can always use both -- this just sets your default experience.</Text>

                {MODE_OPTIONS.map((mode, idx) => {
                  const selected = preferredMode === mode.id;
                  const ModeIcon = MODE_ICON_MAP[mode.id];
                  return (
                    <GlassCard
                      key={mode.id}
                      accentColor={selected ? coach.color : undefined}
                      glow={selected}
                      style={styles.optionCardGlass(selected, coach.color, colors)}
                    >
                      <TouchableOpacity
                        style={[styles.optionCardInner, { alignItems: 'flex-start' }]}
                        onPress={() => { haptics.medium(); setPreferredMode(mode.id); }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${mode.label}. ${mode.desc}`}
                      >
                        <View style={{ marginRight: 14, marginTop: 2 }}>
                          <ModeIcon size={28} color={selected ? coach.color : colors.textMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[FONT.subhead, { color: selected ? coach.color : colors.textPrimary }]}>
                            {mode.label}
                          </Text>
                          <Text style={[FONT.caption, { color: colors.textMuted, marginTop: 4, lineHeight: 18 }]}>
                            {mode.desc}
                          </Text>
                        </View>
                        {selected && <Check size={18} color={coach.color} style={{ marginTop: 2 }} />}
                      </TouchableOpacity>
                    </GlassCard>
                  );
                })}

                <GlassCard style={{ width: '100%' }}>
                  <Text style={[FONT.body, { color: isDark ? coach.color : colors.textPrimary, fontStyle: 'italic', textAlign: 'center' }]}>
                    {selectedModeOption.coachReaction[selectedCoach]}
                  </Text>
                </GlassCard>
              </FadeInView>
            )}

            {/* Step 5: Coach */}
            {step === 5 && (
              <FadeInView style={{ alignItems: 'center' }}>
                <View style={styles.stepIconWrap(colors)}>
                  <Mic size={36} color={coach.color} />
                </View>
                <Text style={[FONT.title, { color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }]}>Pick your coach</Text>
                <Text style={[FONT.body, { color: colors.textMuted, textAlign: 'center', marginBottom: 32 }]}>You can always change later.</Text>
                {Object.values(COACHES).map((c, idx) => {
                  const isSelected = selectedCoach === c.id;
                  const CoachIcon = COACH_ICONS[c.id];
                  return (
                    <GlassCard
                      key={c.id}
                      accentColor={isSelected ? c.color : undefined}
                      glow={isSelected}
                      style={styles.optionCardGlass(isSelected, c.color, colors)}
                    >
                      <TouchableOpacity
                        style={[styles.optionCardInner, { alignItems: 'flex-start' }]}
                        onPress={() => { haptics.medium(); setSelectedCoach(c.id); }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        {renderCoachIcon(c, 32, isSelected)}
                        <View style={{ flex: 1, marginLeft: 14 }}>
                          <Text style={[FONT.subhead, { color: isSelected ? c.color : colors.textPrimary }]}>{c.name}</Text>
                          <Text style={[FONT.caption, { color: colors.textMuted, textTransform: 'capitalize', marginTop: 2 }]}>{c.style}</Text>
                          <Text style={[FONT.body, { color: isSelected ? c.color + 'CC' : colors.textDim, fontStyle: 'italic', marginTop: 6 }]}>
                            {c.id === 'drill' && '"No excuses. Show up. Put in the work."'}
                            {c.id === 'hype' && '"You\'re going to CRUSH it! I believe in you!"'}
                            {c.id === 'zen' && '"Find your center. Let movement be meditation."'}
                          </Text>
                        </View>
                        {isSelected && <Check size={18} color={c.color} />}
                      </TouchableOpacity>
                    </GlassCard>
                  );
                })}
                <GlassCard
                  accentColor={coach.color}
                  style={{ width: '100%' }}
                >
                  <Text style={[FONT.caption, { color: colors.textMuted, marginBottom: 8 }]}>{coach.name} says:</Text>
                  <Text style={[FONT.body, { fontWeight: '500', color: isDark ? coach.color : colors.textPrimary }]}>{getCoachWelcome()}</Text>
                </GlassCard>
              </FadeInView>
            )}
          </ScrollView>
        </FadeInView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {step > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack} accessibilityRole="button" accessibilityLabel="Go back">
              <ChevronLeft size={20} color={colors.textSecondary} />
              <Text style={[FONT.body, { color: colors.textSecondary, fontWeight: '500', marginLeft: 4 }]}>Back</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {step < TOTAL_STEPS - 1 ? (
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: canProceed() ? coach.color : colors.bgSubtle }]}
              onPress={handleNext} disabled={!canProceed()} activeOpacity={0.8}
              accessibilityRole="button" accessibilityLabel="Next step"
            >
              <Text style={[FONT.body, { fontWeight: '700', color: canProceed() ? getTextOnColor(coach.color) : colors.textDim, marginRight: 4 }]}>Next</Text>
              <ChevronRight size={18} color={canProceed() ? getTextOnColor(coach.color) : colors.textDim} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: coach.color }]}
              onPress={handleFinish} disabled={saving} activeOpacity={0.8}
              accessibilityRole="button" accessibilityLabel="Finish setup and start"
            >
              {saving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={getTextOnColor(coach.color)} size="small" />
                  <Text style={[FONT.body, { fontWeight: '700', color: getTextOnColor(coach.color) }]}>Setting up...</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[FONT.body, { fontWeight: '700', color: getTextOnColor(coach.color) }]}>Let's Go</Text>
                  <ChevronRight size={18} color={getTextOnColor(coach.color)} />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---- STYLES ----
const styles = StyleSheet.create({
  nameInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  dayCircle: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  presetButton: {
    flex: 1, paddingVertical: 10, borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionCardInner: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
  },
  coachIconCircle: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderTopWidth: 1,
  },
  backButton: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 12, minHeight: 48,
  },
  nextButton: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: RADIUS.lg, minHeight: 48,
  },
});

// Dynamic style helpers (called as functions)
styles.progressBarTrack = (colors) => ({
  height: 3, backgroundColor: colors.border,
  marginHorizontal: SPACING.lg, marginTop: SPACING.sm, borderRadius: 2,
  overflow: 'hidden',
});
styles.progressBarFill = (color, step) => ({
  height: '100%', borderRadius: 2,
  width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
  backgroundColor: color,
});
styles.stepIconWrap = (colors) => ({
  width: 72, height: 72, borderRadius: 36,
  backgroundColor: colors.glassBg,
  borderWidth: 1, borderColor: colors.glassBorder,
  alignItems: 'center', justifyContent: 'center',
  marginBottom: 20,
});
styles.optionCardGlass = (selected, coachColor, colors) => ({
  width: '100%',
  borderColor: selected ? coachColor + '50' : colors.glassBorder,
});
