// ============================================================
// PR WALL SCREEN — All-time personal records trophy case
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Trophy, ChevronLeft, Dumbbell } from 'lucide-react-native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { useTheme } from '../hooks/useTheme';
import { getMuscleIcon } from '../constants/icons';
import { FONT, SPACING, RADIUS, GLOW } from '../constants/theme';
import { getExerciseSummaries } from '../services/exerciseLog';
import { getUserProfile } from '../services/userProfile';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';
import * as haptics from '../services/haptics';

// Group summaries by muscle group
function groupByMuscle(summaries) {
  const groups = {};
  for (const s of summaries) {
    const g = s.muscleGroup || 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  }
  // Sort each group by maxWeight desc
  for (const g of Object.keys(groups)) {
    groups[g].sort((a, b) => (b.pr?.maxWeight || 0) - (a.pr?.maxWeight || 0));
  }
  // Sort group keys: muscle groups with heaviest lifts first
  return Object.entries(groups).sort(([, a], [, b]) => {
    const aMax = Math.max(...a.map(s => s.pr?.maxWeight || 0));
    const bMax = Math.max(...b.map(s => s.pr?.maxWeight || 0));
    return bMax - aMax;
  });
}

// Find the single best lift (highest maxWeight across all exercises)
function findTopPR(summaries) {
  if (!summaries.length) return null;
  return summaries.reduce((best, s) =>
    (s.pr?.maxWeight || 0) > (best.pr?.maxWeight || 0) ? s : best
  );
}

export default function PRWallScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const [summaries, setSummaries] = useState([]);
  const [units, setUnits] = useState('lbs');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    setLoading(true);
    const [data, profile] = await Promise.all([getExerciseSummaries(), getUserProfile()]);
    setSummaries(data);
    if (profile.units) setUnits(profile.units);
    setLoading(false);
  };

  const grouped = groupByMuscle(summaries);
  const topPR = findTopPR(summaries);
  const totalExercises = summaries.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
      }}>
        <TouchableOpacity
          onPress={() => { haptics.tap(); navigation.goBack(); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={16} color={coach.color} strokeWidth={2.5} />
          <Text style={[FONT.caption, { color: coach.color, fontWeight: '600' }]}>Back</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Trophy size={20} color={coach.color} strokeWidth={2} />
          <Text style={[FONT.heading, { color: colors.textPrimary }]}>Personal Records</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={coach.color} />
        </View>
      ) : summaries.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.lg }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Trophy size={32} color={colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={[FONT.subhead, { color: colors.textPrimary, marginBottom: 6 }]}>No PRs yet</Text>
          <Text style={[FONT.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            Log workouts to start setting personal records
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 20, backgroundColor: coach.color,
              paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.md,
            }}
            onPress={() => { haptics.tap(); navigation.navigate('LogTab'); }}
            activeOpacity={0.8}
          >
            <Text style={[FONT.caption, { fontWeight: '700', color: '#fff' }]}>Log a Workout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
              tintColor={coach.color}
            />
          }
        >
          {/* Summary strip */}
          <FadeInView delay={50}>
            <Text style={[FONT.caption, { color: colors.textMuted, marginBottom: 16 }]}>
              {totalExercises} exercise{totalExercises !== 1 ? 's' : ''} tracked
            </Text>
          </FadeInView>

          {/* Top PR hero card */}
          {topPR && (
            <FadeInView delay={100}>
              <GlassCard accentColor={coach.color} glow style={{ marginBottom: SPACING.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: coach.color + '20', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Trophy size={16} color={coach.color} strokeWidth={2} />
                  </View>
                  <View>
                    <Text style={[FONT.label, { color: coach.color }]}>ALL-TIME BEST LIFT</Text>
                  </View>
                </View>
                <Text style={[FONT.title, { color: colors.textPrimary, marginBottom: 2 }]}>
                  {topPR.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ fontSize: 40, fontWeight: '800', color: coach.color, fontVariant: ['tabular-nums'] }}>
                    {topPR.pr?.maxWeight || 0}
                  </Text>
                  <Text style={[FONT.subhead, { color: coach.color + '80' }]}>{units}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                  <Text style={[FONT.caption, { color: colors.textMuted }]}>
                    Vol: {topPR.pr?.maxVolume || 0} {units}
                  </Text>
                  <Text style={[FONT.caption, { color: colors.textMuted }]}>
                    Reps: {topPR.pr?.maxReps || 0}
                  </Text>
                  <Text style={[FONT.caption, { color: colors.textMuted }]}>
                    {topPR.sessionCount} session{topPR.sessionCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              </GlassCard>
            </FadeInView>
          )}

          {/* Grouped exercise list */}
          {grouped.map(([group, exercises], groupIdx) => {
            const MuscleIcon = getMuscleIcon(group);
            return (
              <FadeInView key={group} delay={200 + groupIdx * 60}>
                {/* Group header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: groupIdx > 0 ? SPACING.md : 0 }}>
                  <MuscleIcon size={14} color={colors.textMuted} />
                  <Text style={[FONT.label, { color: colors.textMuted }]}>
                    {group.toUpperCase()}
                  </Text>
                </View>

                {/* Exercise rows */}
                <GlassCard noPadding>
                  {exercises.map((s, i) => {
                    const isTopInGroup = i === 0;
                    const isOverallTop = s.normalizedName === topPR?.normalizedName;
                    const ExIcon = getMuscleIcon(s.muscleGroup);
                    return (
                      <View
                        key={s.normalizedName}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 13,
                          paddingHorizontal: 14,
                          borderBottomWidth: i < exercises.length - 1 ? 1 : 0,
                          borderBottomColor: colors.glassBorder,
                        }}
                      >
                        {/* Icon */}
                        <View style={{
                          width: 34, height: 34, borderRadius: RADIUS.sm,
                          backgroundColor: isOverallTop
                            ? coach.color + '18'
                            : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          alignItems: 'center', justifyContent: 'center', marginRight: 12,
                        }}>
                          {isOverallTop
                            ? <Trophy size={16} color={coach.color} strokeWidth={2} />
                            : <ExIcon size={16} color={colors.textMuted} />
                          }
                        </View>

                        {/* Name + session count */}
                        <View style={{ flex: 1 }}>
                          <Text style={[FONT.body, {
                            fontWeight: '600',
                            color: isOverallTop ? coach.color : colors.textPrimary,
                          }]}>
                            {s.name}
                          </Text>
                          <Text style={[FONT.caption, { color: colors.textMuted, marginTop: 1 }]}>
                            {s.sessionCount} session{s.sessionCount !== 1 ? 's' : ''}
                          </Text>
                        </View>

                        {/* PR stats */}
                        <View style={{ alignItems: 'flex-end', gap: 3 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                            <Text style={{
                              fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'],
                              color: isOverallTop ? coach.color : colors.textPrimary,
                            }}>
                              {s.pr?.maxWeight || 0}
                            </Text>
                            <Text style={[FONT.caption, { color: colors.textMuted }]}>{units}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Text style={[FONT.caption, { color: colors.textMuted, fontSize: 10 }]}>
                              {s.pr?.maxReps || 0} reps
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </GlassCard>
              </FadeInView>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
