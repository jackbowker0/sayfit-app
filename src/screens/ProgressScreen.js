// ============================================================
// PROGRESS SCREEN — Exercise history & charts (themed)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getExerciseSummaries, getProgressChartData } from '../services/exerciseLog';
import { getUserProfile } from '../services/userProfile';
import * as haptics from '../services/haptics';

export default function ProgressScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const [summaries, setSummaries] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState('lbs');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    setLoading(true);
    const data = await getExerciseSummaries();
    setSummaries(data);
    const profile = await getUserProfile();
    if (profile.units) setUnits(profile.units);
    if (data.length > 0) {
      setSelectedExercise(data[0]);
      const chart = await getProgressChartData(data[0].name);
      setChartData(chart);
    }
    setLoading(false);
  };

  const handleSelectExercise = async (summary) => {
    haptics.tap();
    setSelectedExercise(summary);
    const chart = await getProgressChartData(summary.name);
    setChartData(chart);
  };

  const card = (extra) => ({
    backgroundColor: colors.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: colors.border, padding: SPACING.md,
    marginBottom: SPACING.md,
    ...(isDark ? {} : { shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }),
    ...extra,
  });

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={coach.color} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 20 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor={coach.color} />}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 }}>Progress</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20 }}>
          {summaries.length > 0 ? `${summaries.length} exercises tracked` : 'Log workouts to see progress'}
        </Text>

        {summaries.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>No exercises logged yet</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>Log a workout to start tracking</Text>
            <TouchableOpacity
              style={{ backgroundColor: coach.color, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.md }}
              onPress={() => { haptics.tap(); navigation.navigate('LogTab'); }}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: getTextOnColor(coach.color) }}>Log Your First Workout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Chart for selected exercise */}
            {selectedExercise && chartData.length > 1 && (
              <View style={card()}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>{selectedExercise.name}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 16 }}>{chartData.length} sessions</Text>

                {/* Simple bar chart */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4 }}>
                  {chartData.slice(-10).map((point, i) => {
                    const max = Math.max(...chartData.slice(-10).map(p => p.weight), 1);
                    const pct = (point.weight / max) * 100;
                    return (
                      <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 9, color: colors.textMuted, marginBottom: 4 }}>{point.weight}</Text>
                        <View style={{
                          width: '100%', borderRadius: 4, minHeight: 4,
                          height: `${pct}%`,
                          backgroundColor: i === chartData.slice(-10).length - 1 ? coach.color : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                        }} />
                        <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 4 }}>{point.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Exercise list */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>All Exercises</Text>
            {summaries.map((s, i) => {
              const isSelected = selectedExercise?.normalizedName === s.normalizedName;
              return (
                <TouchableOpacity
                  key={s.normalizedName}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 14, paddingHorizontal: 12,
                    borderRadius: RADIUS.md, marginBottom: 4,
                    backgroundColor: isSelected ? coach.color + '10' : 'transparent',
                  }}
                  onPress={() => handleSelectExercise(s)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: isSelected ? coach.color : colors.textPrimary }}>{s.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {s.sessionCount} session{s.sessionCount > 1 ? 's' : ''} · Best: {s.pr?.maxWeight || 0} {units}
                    </Text>
                  </View>
                  {s.trend !== 0 && (
                    <Text style={{ fontSize: 12, fontWeight: '600', color: s.trend > 0 ? colors.green : colors.red }}>
                      {s.trend > 0 ? '↑' : '↓'} {Math.abs(s.trend)} {units}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Weight tracking shortcut */}
            <TouchableOpacity
              style={{ marginTop: 16, padding: 14, borderRadius: RADIUS.lg, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              onPress={() => navigation.navigate('Weight')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: coach.color }}>⚖️ Track Body Weight</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}