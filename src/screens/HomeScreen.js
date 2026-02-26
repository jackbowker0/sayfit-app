// ============================================================
// HOME SCREEN — Full workout menu (themed)
// Accessible from "More" or direct navigation
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES, getFallbackResponse } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getCoachResponse } from '../services/ai';
import { getDefaultWorkout } from '../constants/exercises';

export default function HomeScreen({ navigation }) {
  const { coachId, setCoachId, workout } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();
  const exercises = getDefaultWorkout();
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    const firstExercise = exercises[0];
    let startMessage;
    try {
      startMessage = await getCoachResponse(coachId, 'start', {
        exerciseName: firstExercise.name,
        exerciseIntensity: firstExercise.intensity,
        exercisesCompleted: 0,
        totalExercises: exercises.length,
      });
    } catch {
      startMessage = getFallbackResponse(coachId, 'start');
    }
    workout.startWorkout(coachId, startMessage);
    navigation.replace('Workout');
  };

  const card = (extra) => ({
    backgroundColor: colors.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : { shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }),
    ...extra,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 28, marginTop: SPACING.md }}>
          <Text style={{ fontSize: 12, letterSpacing: 6, color: colors.textDim, marginBottom: 8 }}>VOICE-FIRST FITNESS</Text>
          <Text style={{ fontSize: 48, fontWeight: '900', color: coach.color, letterSpacing: -2 }}>SayFit</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 10, textAlign: 'center' }}>
            Just say what you need. Your AI coach adapts in real-time.
          </Text>
        </View>

        {/* Just Talk */}
        <TouchableOpacity style={card({ padding: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderColor: coach.color + '25' })} onPress={() => navigation.navigate('JustTalk')} activeOpacity={0.7}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: coach.color + '15', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
            <Text style={{ fontSize: 24 }}>🗣️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Just Talk</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>Describe your workout. I'll build it.</Text>
          </View>
          <Text style={{ color: coach.color, fontSize: 20 }}>→</Text>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28 }}>
          <TouchableOpacity style={card({ flex: 1, padding: 16, alignItems: 'center', borderColor: coach.color + '25' })} onPress={() => navigation.navigate('LogWorkout')} activeOpacity={0.7}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>📝</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>Log Workout</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>Track your lifts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={card({ flex: 1, padding: 16, alignItems: 'center', borderColor: coach.color + '25' })} onPress={() => navigation.navigate('Progress')} activeOpacity={0.7}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>📊</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>Progress</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>See your gains</Text>
          </TouchableOpacity>
        </View>

        {/* Coach Selection */}
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>Choose Your Coach</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28 }}>
          {Object.values(COACHES).map(c => (
            <TouchableOpacity key={c.id} style={card({
              flex: 1, padding: 16, alignItems: 'center',
              borderColor: coachId === c.id ? c.color + '50' : colors.border,
              backgroundColor: coachId === c.id ? c.color + '12' : colors.bgCard,
            })} onPress={() => setCoachId(c.id)} activeOpacity={0.7}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>{c.emoji}</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: coachId === c.id ? c.color : colors.textSecondary }}>{c.name}</Text>
              <Text style={{ fontSize: 10, color: colors.textMuted, textTransform: 'capitalize', marginTop: 4, letterSpacing: 1 }}>{c.style}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Workout Preview */}
        <View style={card({ padding: 20, marginBottom: 28 })}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>Today's Workout</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Full Body Blast</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{exercises.length} exercises · ~5 min</Text>
            </View>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: coach.color + '15' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: coach.color }}>Intermediate</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {exercises.map(ex => (
              <View key={ex.id} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.bgSubtle }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>{ex.icon} {ex.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity style={{ backgroundColor: coach.color, padding: 18, borderRadius: RADIUS.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: starting ? 0.7 : 1 }} onPress={handleStart} activeOpacity={0.8} disabled={starting}>
          {starting && <ActivityIndicator color={getTextOnColor(coach.color)} size="small" />}
          <Text style={{ fontSize: 17, fontWeight: '800', color: getTextOnColor(coach.color), letterSpacing: 0.5 }}>{starting ? 'Loading...' : 'Start Guided Workout →'}</Text>
        </TouchableOpacity>

        {/* Back to Dashboard */}
        <TouchableOpacity style={{ padding: 14, alignItems: 'center', marginTop: 8 }} onPress={() => navigation.navigate('MainTabs')} activeOpacity={0.7}>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>← Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}