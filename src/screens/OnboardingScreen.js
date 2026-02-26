// ============================================================
// ONBOARDING SCREEN — First-time user experience
// 6 steps: Name → Fitness Level → Equipment → Workout Days
//          → Training Mode → Coach
// ============================================================

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Animated, Dimensions, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  saveUserProfile, setOnboarded,
  EQUIPMENT_OPTIONS, FITNESS_LEVELS, DAY_OPTIONS,
} from '../services/userProfile';
import { useWorkoutContext } from '../context/WorkoutContext';
import * as haptics from '../services/haptics';

const TOTAL_STEPS = 6;

const MODE_OPTIONS = [
  {
    id: 'coach',
    emoji: '🗣️',
    label: 'Coach builds my workouts',
    desc: 'Tell your coach what you want and they\'ll create a workout for you.',
    coachReaction: {
      drill: "Smart. I'll handle the programming. You just show up and work.",
      hype: "YES! I'm gonna build you the BEST workouts! 🔥",
      zen: "I'll craft each session to match your energy and intention.",
    },
  },
  {
    id: 'logger',
    emoji: '📝',
    label: 'I\'ll log my own workouts',
    desc: 'You already know what you\'re doing — just track sets, reps, and weight.',
    coachReaction: {
      drill: "Self-sufficient. Good. I'll track your data and keep you honest.",
      hype: "Love that you know your stuff! I'll celebrate every PR! 🏆",
      zen: "Your practice, your record. I'll help you see the patterns.",
    },
  },
  {
    id: 'both',
    emoji: '⚡',
    label: 'Both — mix it up',
    desc: 'Some days you want coaching, some days you just want to log.',
    coachReaction: {
      drill: "Flexible approach. I can work with that.",
      hype: "Best of BOTH worlds! I'm here for ALL of it! ✨",
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

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const coach = COACHES[selectedCoach];

  const animateTransition = (nextStep) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleNext = () => { if (step < TOTAL_STEPS - 1) { haptics.tap(); animateTransition(step + 1); } };
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
      drill: `${n}. Good name. Now let's see if you can live up to it. I don't go easy on anyone — but if you show up, I'll make you better. Deal?`,
      hype: `${n}!! OH MY GOD I'm so excited to work with you! We're going to have SO much fun and you're going to feel AMAZING! Let's gooo! 🔥`,
      zen: `Welcome, ${n}. I'm honored to guide your practice. Together we'll find balance between effort and ease. Take a breath — your journey begins now.`,
    }[selectedCoach];
  };

  const getDaysSummary = () => {
    if (workoutDays.length === 0) return '';
    if (workoutDays.length === 7) return "Every day — that's intense!";
    if (workoutDays.length >= 5) return `${workoutDays.length} days — serious commitment.`;
    if (workoutDays.length >= 3) return `${workoutDays.length} days — solid plan.`;
    return `${workoutDays.length} day${workoutDays.length > 1 ? 's' : ''} — great start.`;
  };

  const optionCard = (selected) => ({
    width: '100%', flexDirection: 'row', alignItems: 'center',
    padding: 18, borderRadius: RADIUS.lg, marginBottom: 10,
    backgroundColor: selected ? coach.color + '12' : colors.bgCard,
    borderWidth: 1.5, borderColor: selected ? coach.color + '50' : colors.border,
  });

  const selectedModeOption = MODE_OPTIONS.find(m => m.id === preferredMode);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Progress bar */}
        <View style={{ height: 3, backgroundColor: colors.border, marginHorizontal: SPACING.lg, marginTop: SPACING.sm, borderRadius: 2 }}>
          <View style={{ height: '100%', borderRadius: 2, width: `${((step + 1) / TOTAL_STEPS) * 100}%`, backgroundColor: coach.color }} />
        </View>

        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingTop: 40, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Step 0: Name */}
            {step === 0 && (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: 20 }}>👋</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>What should we call you?</Text>
                <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>Your coach will use your name to keep things personal.</Text>
                <TextInput
                  style={{ width: '100%', backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 18, fontSize: 20, color: colors.textPrimary, textAlign: 'center', fontWeight: '600' }}
                  placeholder="Your name" placeholderTextColor={colors.textDim}
                  value={name} onChangeText={setName} autoFocus returnKeyType="next" onSubmitEditing={handleNext} maxLength={20}
                  accessibilityLabel="Enter your name"
                />
              </View>
            )}

            {/* Step 1: Fitness Level */}
            {step === 1 && (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: 20 }}>📊</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>What's your fitness level?</Text>
                <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>This helps us pick the right starting intensity.</Text>
                {FITNESS_LEVELS.map(level => (
                  <TouchableOpacity key={level.id} style={optionCard(fitnessLevel === level.id)} onPress={() => { haptics.tick(); setFitnessLevel(level.id); }} activeOpacity={0.7}
                    accessibilityRole="button" accessibilityState={{ selected: fitnessLevel === level.id }}
                  >
                    <Text style={{ fontSize: 24, marginRight: 14 }}>{level.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: fitnessLevel === level.id ? coach.color : colors.textPrimary }}>{level.label}</Text>
                      <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{level.desc}</Text>
                    </View>
                    {fitnessLevel === level.id && <Text style={{ color: coach.color, fontSize: 18 }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Step 2: Equipment */}
            {step === 2 && (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: 20 }}>🏋️</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>What equipment do you have?</Text>
                <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>We'll only suggest exercises you can actually do.</Text>
                {EQUIPMENT_OPTIONS.map(eq => {
                  const selected = equipment.includes(eq.id);
                  return (
                    <TouchableOpacity key={eq.id} style={optionCard(selected)} onPress={() => toggleEquipment(eq.id)} activeOpacity={0.7}
                      accessibilityRole="button" accessibilityState={{ selected }}
                    >
                      <Text style={{ fontSize: 24, marginRight: 14 }}>{eq.emoji}</Text>
                      <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: selected ? coach.color : colors.textPrimary }}>{eq.label}</Text>
                      {selected && <Text style={{ color: coach.color, fontSize: 18 }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Step 3: Workout Days */}
            {step === 3 && (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: 20 }}>📅</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>Which days will you train?</Text>
                <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>Tap your workout days. Your coach will hold you to it.</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, width: '100%' }}>
                  {DAY_OPTIONS.map(day => {
                    const selected = workoutDays.includes(day.id);
                    return (
                      <TouchableOpacity
                        key={day.id}
                        style={{
                          width: 44, height: 44, borderRadius: 22,
                          backgroundColor: selected ? coach.color : colors.bgCard,
                          borderWidth: 1.5,
                          borderColor: selected ? coach.color : colors.border,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                        onPress={() => toggleDay(day.id)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${day.label}${selected ? ', selected' : ''}`}
                        accessibilityState={{ selected }}
                      >
                        <Text style={{
                          fontSize: 15, fontWeight: '700',
                          color: selected ? getTextOnColor(coach.color) : colors.textMuted,
                        }}>{day.short}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {workoutDays.length > 0 && (
                  <View style={{
                    width: '100%', padding: 16, borderRadius: RADIUS.lg,
                    backgroundColor: coach.color + '10', borderWidth: 1, borderColor: coach.color + '25',
                  }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: coach.color, textAlign: 'center' }}>
                      {getDaysSummary()}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
                      {workoutDays.map(d => DAY_OPTIONS[d].label).join(', ')}
                    </Text>
                  </View>
                )}

                {workoutDays.length > 0 && (
                  <View style={{ width: '100%', marginTop: 16, padding: 14, borderRadius: RADIUS.lg, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 13, color: isDark ? coach.color : colors.textPrimary, fontStyle: 'italic', textAlign: 'center' }}>
                      {coach.emoji}{' '}
                      {{
                        drill: workoutDays.length >= 5
                          ? `${workoutDays.length} days. I like your ambition. Don't burn out.`
                          : workoutDays.length >= 3
                            ? `${workoutDays.length} days. Solid. I'll make every one count.`
                            : "We'll make the most of every session.",
                        hype: workoutDays.length >= 5
                          ? `${workoutDays.length} days?! You're going ALL IN! I love it! 🔥`
                          : workoutDays.length >= 3
                            ? `${workoutDays.length} days is PERFECT! Consistency is key! ✨`
                            : "Every workout counts! Quality over quantity! 💪",
                        zen: workoutDays.length >= 5
                          ? "An ambitious rhythm. Remember to listen to your body."
                          : workoutDays.length >= 3
                            ? "A balanced cadence. Room for movement and rest."
                            : "Even one mindful session can transform your week.",
                      }[selectedCoach]}
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 20, width: '100%' }}>
                  {[
                    { label: '3 days', days: [0, 2, 4] },
                    { label: '4 days', days: [0, 1, 3, 4] },
                    { label: '5 days', days: [0, 1, 2, 3, 4] },
                  ].map(preset => (
                    <TouchableOpacity
                      key={preset.label}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: RADIUS.md,
                        backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
                        alignItems: 'center',
                      }}
                      onPress={() => { haptics.tap(); setWorkoutDays(preset.days); }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 4: Training Mode */}
            {step === 4 && (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: 20 }}>💡</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>How do you want to train?</Text>
                <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>You can always use both — this just sets your default experience.</Text>

                {MODE_OPTIONS.map(mode => {
                  const selected = preferredMode === mode.id;
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      style={{
                        width: '100%', flexDirection: 'row', alignItems: 'flex-start',
                        padding: 18, borderRadius: RADIUS.lg, marginBottom: 10,
                        backgroundColor: selected ? coach.color + '12' : colors.bgCard,
                        borderWidth: 1.5, borderColor: selected ? coach.color + '50' : colors.border,
                      }}
                      onPress={() => { haptics.medium(); setPreferredMode(mode.id); }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${mode.label}. ${mode.desc}`}
                    >
                      <Text style={{ fontSize: 28, marginRight: 14, marginTop: 2 }}>{mode.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 16, fontWeight: '700',
                          color: selected ? coach.color : colors.textPrimary,
                        }}>
                          {mode.label}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>
                          {mode.desc}
                        </Text>
                      </View>
                      {selected && <Text style={{ color: coach.color, fontSize: 18, marginTop: 2 }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}

                <View style={{
                  width: '100%', marginTop: 16, padding: 14, borderRadius: RADIUS.lg,
                  backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
                }}>
                  <Text style={{ fontSize: 13, color: isDark ? coach.color : colors.textPrimary, fontStyle: 'italic', textAlign: 'center' }}>
                    {coach.emoji}{' '}{selectedModeOption.coachReaction[selectedCoach]}
                  </Text>
                </View>
              </View>
            )}

            {/* Step 5: Coach */}
            {step === 5 && (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: 20 }}>🎙️</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>Pick your coach</Text>
                <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>You can always change later.</Text>
                {Object.values(COACHES).map(c => (
                  <TouchableOpacity key={c.id} style={{
                    width: '100%', flexDirection: 'row', alignItems: 'flex-start',
                    padding: 18, borderRadius: RADIUS.lg, marginBottom: 10,
                    backgroundColor: selectedCoach === c.id ? c.color + '12' : colors.bgCard,
                    borderWidth: 1.5, borderColor: selectedCoach === c.id ? c.color + '50' : colors.border,
                  }} onPress={() => { haptics.medium(); setSelectedCoach(c.id); }} activeOpacity={0.7}
                    accessibilityRole="button" accessibilityState={{ selected: selectedCoach === c.id }}
                  >
                    <Text style={{ fontSize: 28, marginRight: 14, marginTop: 2 }}>{c.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: selectedCoach === c.id ? c.color : colors.textPrimary }}>{c.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, textTransform: 'capitalize', marginTop: 2 }}>{c.style}</Text>
                      <Text style={{ fontSize: 13, color: selectedCoach === c.id ? c.color + 'CC' : colors.textDim, fontStyle: 'italic', marginTop: 6, lineHeight: 18 }}>
                        {c.id === 'drill' && '"No excuses. Show up. Put in the work."'}
                        {c.id === 'hype' && '"You\'re going to CRUSH it! I believe in you!"'}
                        {c.id === 'zen' && '"Find your center. Let movement be meditation."'}
                      </Text>
                    </View>
                    {selectedCoach === c.id && <Text style={{ color: c.color, fontSize: 18 }}>✓</Text>}
                  </TouchableOpacity>
                ))}
                <View style={{ width: '100%', marginTop: 16, padding: 18, borderRadius: RADIUS.lg, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: coach.color + '30' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{coach.emoji} {coach.name} says:</Text>
                  <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '500', color: isDark ? coach.color : colors.textPrimary }}>{getCoachWelcome()}</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>

        {/* Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          {step > 0 && (
            <TouchableOpacity style={{ paddingVertical: 14, paddingHorizontal: 20, minHeight: 48 }} onPress={handleBack} accessibilityRole="button" accessibilityLabel="Go back">
              <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '500' }}>← Back</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {step < TOTAL_STEPS - 1 ? (
            <TouchableOpacity
              style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: RADIUS.lg, backgroundColor: canProceed() ? coach.color : colors.bgSubtle, minHeight: 48 }}
              onPress={handleNext} disabled={!canProceed()} activeOpacity={0.8}
              accessibilityRole="button" accessibilityLabel="Next step"
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: canProceed() ? getTextOnColor(coach.color) : colors.textDim }}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: RADIUS.lg, backgroundColor: coach.color, minHeight: 48 }}
              onPress={handleFinish} disabled={saving} activeOpacity={0.8}
              accessibilityRole="button" accessibilityLabel="Finish setup and start"
            >
              {saving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={getTextOnColor(coach.color)} size="small" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: getTextOnColor(coach.color) }}>Setting up...</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: getTextOnColor(coach.color) }}>Let's Go! 🚀</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}