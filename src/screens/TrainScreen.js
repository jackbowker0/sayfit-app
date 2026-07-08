// ============================================================
// TRAIN SCREEN — the Train hub (Phase-2 IA)
//
// Mirrors the Dashboard hub shell exactly: SafeAreaView edges=top,
// ScrollView + RefreshControl(tintColor=coach.color), FadeInView
// stagger, useFocusEffect + hasLoaded ref, ActionTile grid, a
// floating QuickAddMic. Quick actions: Log Workout, Build Workout,
// Progress, PRs, Calendar.
//
// HONEST BY DESIGN: tile status strings come straight from
// getExerciseLog() (last-workout date + tracked-exercise count).
// A missing datum falls back to a static string, never a fake
// number. paddingBottom:100 clears the 85pt tab bar + the FAB.
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ClipboardList, Sparkles, TrendingUp, Trophy, CalendarDays,
} from 'lucide-react-native';

import FadeInView from '../components/FadeInView';
import ActionTile from '../components/ActionTile';
import QuickAddMic from '../components/QuickAddMic';
import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, FONT } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getExerciseLog, getExerciseSummaries } from '../services/exerciseLog';
import * as haptics from '../services/haptics';

// Days between an ISO date and now (floored). Guards NaN so a garbage
// date yields null (omit the label) instead of "NaNd ago".
function daysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export default function TrainScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors } = useTheme();

  const [lastWorkoutDate, setLastWorkoutDate] = useState(null);
  const [exerciseCount, setExerciseCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const [exLog, summaries] = await Promise.all([
        getExerciseLog(),
        getExerciseSummaries(),
      ]);
      // exLog is NOT date-sorted — reduce for the max date, don't trust order.
      const last = exLog.length
        ? exLog.reduce((m, s) => (new Date(s.date) > new Date(m) ? s.date : m), exLog[0].date)
        : null;
      setLastWorkoutDate(last);
      // "exercises tracked" = distinct exercises with history — the exact
      // count ProgressScreen shows (getExerciseSummaries), so the two agree.
      setExerciseCount(Array.isArray(summaries) ? summaries.length : 0);
    } catch (e) {
      console.warn('[Train] Failed to load hub data:', e);
    }
    setLoading(false);
    hasLoaded.current = true;
  };

  // ---- Tile status (honest-by-omission) ----
  const days = daysSince(lastWorkoutDate);
  let logStatus;
  if (days === null) logStatus = 'Not logged';
  else if (days === 0) logStatus = 'Logged today';
  else if (days === 1) logStatus = 'Last: 1d ago';
  else logStatus = `Last: ${days}d ago`;
  const logAttention = days !== null && days > 2 ? 'due' : 'none';

  const progressStatus = exerciseCount > 0
    ? `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} tracked`
    : 'Track your lifts';

  const tiles = [
    {
      key: 'log',
      Icon: ClipboardList,
      label: 'Log Workout',
      status: logStatus,
      attention: logAttention,
      onPress: () => { haptics.medium(); navigation.navigate('LogWorkout'); },
    },
    {
      key: 'build',
      Icon: Sparkles,
      label: 'Build Workout',
      status: 'AI or manual',
      attention: 'none',
      onPress: () => { haptics.medium(); navigation.navigate('BuildWorkout'); },
    },
    {
      key: 'progress',
      Icon: TrendingUp,
      label: 'Progress',
      status: progressStatus,
      attention: 'none',
      onPress: () => { haptics.tap(); navigation.navigate('Progress'); },
    },
    {
      key: 'prs',
      Icon: Trophy,
      label: 'PRs',
      status: 'All-time bests',
      attention: 'none',
      onPress: () => { haptics.tap(); navigation.navigate('PRWall'); },
    },
    {
      key: 'calendar',
      Icon: CalendarDays,
      label: 'Calendar',
      status: 'History & streak',
      attention: 'none',
      onPress: () => { haptics.tap(); navigation.navigate('Calendar'); },
    },
  ];

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={coach.color} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.screenPadding, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            tintColor={coach.color}
          />
        }
      >
        {/* Header */}
        <FadeInView style={{ marginBottom: 20 }} accessible accessibilityRole="header">
          <Text style={{ ...FONT.title, color: colors.textPrimary }}>Train</Text>
        </FadeInView>

        {/* Quick actions */}
        <FadeInView delay={120}>
          <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: SPACING.sm }}>Quick actions</Text>
          <View style={{ gap: SPACING.md }}>
            {[[0, 1], [2, 3], [4]].map((pair, row) => (
              <View key={row} style={{ flexDirection: 'row', gap: SPACING.md }}>
                {pair.map((idx) => {
                  const t = tiles[idx];
                  return (
                    <ActionTile
                      key={t.key}
                      Icon={t.Icon}
                      label={t.label}
                      status={t.status}
                      attention={t.attention}
                      onPress={t.onPress}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </FadeInView>
      </ScrollView>

      {/* Universal quick-add mic — floats over the tab bar */}
      <QuickAddMic navigation={navigation} />
    </SafeAreaView>
  );
}
