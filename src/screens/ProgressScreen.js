// ============================================================
// PROGRESS SCREEN — Exercise history & charts (premium dark UI)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { TrendingUp, TrendingDown, BarChart3, Scale } from 'lucide-react-native';
import FadeInView from '../components/FadeInView';
import { getMuscleIcon } from '../constants/icons';
import GlassCard from '../components/GlassCard';
import { FONT, GLOW, SPACING, RADIUS, getTextOnColor } from '../constants/theme';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
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
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            tintColor={coach.color}
          />
        }
      >
        <FadeInView>
          <Text style={[FONT.title, { color: colors.textPrimary, marginBottom: 4 }]}>Progress</Text>
          <Text style={[FONT.caption, { color: colors.textMuted, marginBottom: 20 }]}>
            {summaries.length > 0 ? `${summaries.length} exercises tracked` : 'Log workouts to see progress'}
          </Text>
        </FadeInView>

        {summaries.length === 0 ? (
          <FadeInView delay={200} style={{ alignItems: 'center', paddingVertical: 60 }}>
            <BarChart3 size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={[FONT.subhead, { color: colors.textPrimary, marginBottom: 4 }]}>No exercises logged yet</Text>
            <Text style={[FONT.caption, { color: colors.textMuted, marginBottom: 20 }]}>Log a workout to start tracking</Text>
            <TouchableOpacity
              style={{ backgroundColor: coach.color, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.md }}
              onPress={() => { haptics.tap(); navigation.navigate('LogTab'); }}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={[FONT.caption, { fontWeight: '700', color: getTextOnColor(coach.color) }]}>Log Your First Workout</Text>
            </TouchableOpacity>
          </FadeInView>
        ) : (
          <>
            {/* Chart for selected exercise */}
            {selectedExercise && chartData.length > 1 && (
              <GlassCard
                fadeDelay={100}
                accentColor={coach.color}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <BarChart3 size={16} color={coach.color} style={{ marginRight: 6 }} />
                  <Text style={[FONT.subhead, { color: colors.textPrimary }]}>{selectedExercise.name}</Text>
                </View>
                <Text style={[FONT.caption, { color: colors.textMuted, marginBottom: 16 }]}>{chartData.length} sessions</Text>

                {/* Simple bar chart */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4 }}>
                  {chartData.slice(-10).map((point, i) => {
                    const sliced = chartData.slice(-10);
                    const max = Math.max(...sliced.map(p => p.weight), 1);
                    const pct = (point.weight / max) * 100;
                    const isMaxBar = point.weight === max;
                    const isLast = i === sliced.length - 1;
                    return (
                      <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 9, color: colors.textMuted, marginBottom: 4 }}>{point.weight}</Text>
                        <View style={[
                          {
                            width: '100%',
                            borderRadius: 4,
                            minHeight: 4,
                            height: `${pct}%`,
                            backgroundColor: isLast ? coach.color : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                          },
                          // Subtle glow on the max bar
                          isMaxBar && isDark && {
                            shadowColor: coach.color,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.35,
                            shadowRadius: GLOW.sm,
                            elevation: 3,
                          },
                        ]} />
                        <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 4 }}>{point.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </GlassCard>
            )}

            {/* Exercise list */}
            <FadeInView delay={200}>
              <Text style={[FONT.label, { color: colors.textMuted, marginBottom: 12 }]}>All Exercises</Text>
            </FadeInView>

            {summaries.map((s, i) => {
              const isSelected = selectedExercise?.normalizedName === s.normalizedName;
              const MuscleIcon = getMuscleIcon(s.muscleGroup);
              return (
                <GlassCard
                  key={s.normalizedName}
                  fadeDelay={250 + i * 60}
                  accentColor={isSelected ? coach.color : undefined}
                  glow={isSelected}
                  noPadding
                >
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                    }}
                    onPress={() => handleSelectExercise(s)}
                    activeOpacity={0.7}
                  >
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: RADIUS.sm,
                      backgroundColor: isSelected ? `${coach.color}18` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}>
                      <MuscleIcon size={16} color={isSelected ? coach.color : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[FONT.body, { fontWeight: '600', color: isSelected ? coach.color : colors.textPrimary }]}>{s.name}</Text>
                      <Text style={[FONT.caption, { color: colors.textMuted, marginTop: 2 }]}>
                        {s.sessionCount} session{s.sessionCount > 1 ? 's' : ''} · Best: {s.pr?.maxWeight || 0} {units}
                      </Text>
                    </View>
                    {s.trend !== 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {s.trend > 0 ? (
                          <TrendingUp size={14} color={colors.green} style={{ marginRight: 3 }} />
                        ) : (
                          <TrendingDown size={14} color={colors.red} style={{ marginRight: 3 }} />
                        )}
                        <Text style={[FONT.caption, { fontWeight: '600', color: s.trend > 0 ? colors.green : colors.red }]}>
                          {Math.abs(s.trend)} {units}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </GlassCard>
              );
            })}

            {/* Weight tracking shortcut */}
            <GlassCard
              fadeDelay={250 + summaries.length * 60 + 60}
              style={{ marginTop: SPACING.md }}
            >
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => navigation.navigate('Weight')}
                activeOpacity={0.7}
              >
                <Scale size={16} color={coach.color} style={{ marginRight: 8 }} />
                <Text style={[FONT.subhead, { color: coach.color }]}>Track Body Weight</Text>
              </TouchableOpacity>
            </GlassCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
