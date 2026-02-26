// ============================================================
// CALENDAR SCREEN — Activity heatmap + tappable workout detail
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getWorkoutHistory, deleteWorkout } from '../services/storage';
import { getExerciseLog } from '../services/exerciseLog';
import { formatTime } from '../utils/helpers';
import * as haptics from '../services/haptics';
import WorkoutDetailSheet from '../components/WorkoutDetailSheet';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const [activityMap, setActivityMap] = useState({});
  const [workoutsByDay, setWorkoutsByDay] = useState({});
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const [workoutHistory, exerciseLog] = await Promise.all([getWorkoutHistory(), getExerciseLog()]);
    setAllWorkouts(workoutHistory);

    const map = {};
    const byDay = {};

    workoutHistory.forEach(w => {
      const day = new Date(w.date).toISOString().split('T')[0];
      map[day] = (map[day] || 0) + 1;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(w);
    });
    exerciseLog.forEach(e => {
      const day = new Date(e.date).toISOString().split('T')[0];
      map[day] = (map[day] || 0) + 1;
      // Add exercise log entries as displayable items so calendar doesn't show "no detail"
      if (!byDay[day]) byDay[day] = [];
      const alreadyCovered = byDay[day].some(w => w.source === 'log');
      if (!alreadyCovered) {
        byDay[day].push({
          id: e.id || `log-${day}`,
          date: e.date,
          name: e.exercises?.slice(0, 2).map(ex => ex.name).join(' & ') || 'Logged Exercises',
          exercises: e.exercises || [],
          exerciseCount: e.exercises?.length || 0,
          calories: Math.round((e.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) || 0) * 8),
          elapsed: 0,
          muscles: [...new Set((e.exercises || []).map(ex => ex.name))].slice(0, 6),
          source: 'exerciseLog',
        });
      }
    });

    setActivityMap(map);
    setWorkoutsByDay(byDay);

    const activeDays = Object.keys(map);
    setTotalDays(activeDays.length);
    if (activeDays.length > 0) {
      const sorted = activeDays.sort();
      const { longest, current } = calculateStreaks(sorted);
      setLongestStreak(longest);
      setCurrentStreak(current);
    }
  };

  const calculateStreaks = (sortedDays) => {
    let longest = 1, current = 0, streak = 1;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = new Date(today - 86400000).toISOString().split('T')[0];
    for (let i = 1; i < sortedDays.length; i++) {
      const diff = (new Date(sortedDays[i]) - new Date(sortedDays[i - 1])) / 86400000;
      if (diff === 1) { streak++; longest = Math.max(longest, streak); } else { streak = 1; }
    }
    if (sortedDays.includes(todayStr) || sortedDays.includes(yesterdayStr)) {
      const startDay = sortedDays.includes(todayStr) ? todayStr : yesterdayStr;
      current = 1;
      let checkDate = new Date(startDay);
      for (let i = sortedDays.length - 1; i >= 0; i--) {
        checkDate = new Date(checkDate - 86400000);
        if (sortedDays.includes(checkDate.toISOString().split('T')[0])) current++; else break;
      }
    }
    return { longest, current };
  };

  const displayMonth = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  const buildCalendarGrid = () => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = firstDay.getDay(); startDow = startDow === 0 ? 6 : startDow - 1;
    const grid = [];
    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      grid.push({ day: d, dateStr, count: activityMap[dateStr] || 0, isToday: dateStr === new Date().toISOString().split('T')[0], isFuture: new Date(dateStr) > new Date() });
    }
    return grid;
  };

  const grid = buildCalendarGrid();
  const getCellColor = (count, isFuture, isSelected) => {
    if (isSelected) return coach.color;
    if (isFuture) return colors.bgSubtle;
    if (count === 0) return colors.bgSubtle;
    const alpha = ['30', '50', '80', 'CC'][Math.min(count, 4) - 1];
    return coach.color + alpha;
  };

  const monthWorkouts = Object.entries(activityMap).filter(([date]) => { const d = new Date(date); return d.getMonth() === month && d.getFullYear() === year; }).reduce((sum, [, c]) => sum + c, 0);

  const handleDayTap = (cell) => {
    if (!cell || cell.isFuture || cell.count === 0) return;
    haptics.tap();
    setSelectedDate(cell.dateStr);
  };

  const openWorkoutDetail = (workout) => {
    haptics.tap();
    setSelectedWorkout(workout);
    setDetailVisible(true);
  };

  const closeWorkoutDetail = () => {
    setDetailVisible(false);
    setTimeout(() => setSelectedWorkout(null), 250);
  };

  const selectedDayWorkouts = selectedDate ? (workoutsByDay[selectedDate] || []) : [];

  const card = (extra) => ({
    backgroundColor: colors.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: colors.border, padding: SPACING.md,
    marginBottom: SPACING.md,
    ...(isDark ? {} : { shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }),
    ...extra,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 20 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor={coach.color} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}>Calendar</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 14, color: coach.color, fontWeight: '600' }}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Streak Stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md }}>
          {[
            { val: currentStreak, label: 'CURRENT', color: coach.color },
            { val: longestStreak, label: 'LONGEST', color: colors.yellow || '#FFDC00' },
            { val: totalDays, label: 'ACTIVE DAYS', color: colors.green },
          ].map(s => (
            <View key={s.label} style={card({ flex: 1, alignItems: 'center' })}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: s.color }}>{s.val}</Text>
              <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 4, letterSpacing: 1.5, fontWeight: '600' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Month Nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => { haptics.tap(); setMonthOffset(p => p - 1); setSelectedDate(null); }} style={{ padding: 12 }}>
            <Text style={{ fontSize: 20, color: colors.textSecondary }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>{MONTHS[month]} {year}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{monthWorkouts} workouts</Text>
          </View>
          <TouchableOpacity onPress={() => { haptics.tap(); setMonthOffset(p => Math.min(p + 1, 0)); setSelectedDate(null); }} style={{ padding: 12 }} disabled={monthOffset >= 0}>
            <Text style={{ fontSize: 20, color: monthOffset >= 0 ? colors.textDim : colors.textSecondary }}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={card()}>
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {WEEKDAYS.map(d => <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>{d}</Text>)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {grid.map((cell, i) => {
              if (!cell) return <View key={`e-${i}`} style={{ width: `${100/7}%`, aspectRatio: 1 }} />;
              const isSelected = selectedDate === cell.dateStr;
              const isTappable = !cell.isFuture && cell.count > 0;
              return (
                <TouchableOpacity
                  key={cell.dateStr}
                  style={{
                    width: `${100/7}%`, aspectRatio: 1, borderRadius: 8,
                    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
                    backgroundColor: getCellColor(cell.count, cell.isFuture, isSelected),
                    borderWidth: cell.isToday ? 2 : isSelected ? 2 : 0,
                    borderColor: cell.isToday ? coach.color : isSelected ? '#fff' : 'transparent',
                  }}
                  onPress={() => handleDayTap(cell)}
                  disabled={!isTappable}
                  activeOpacity={isTappable ? 0.7 : 1}
                  accessibilityRole={isTappable ? 'button' : 'text'}
                  accessibilityLabel={`${cell.day} ${MONTHS[month]}: ${cell.count > 0 ? `${cell.count} workout${cell.count > 1 ? 's' : ''}` : 'no workouts'}`}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: cell.count > 0 ? '700' : '500',
                    color: isSelected ? getTextOnColor(coach.color) : cell.count > 0 ? '#fff' : cell.isToday ? coach.color : cell.isFuture ? colors.textDim : colors.textMuted,
                  }}>{cell.day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 }}>
            <Text style={{ fontSize: 10, color: colors.textMuted, marginRight: 4 }}>Less</Text>
            {[0, 1, 2, 3, 4].map(level => (
              <View key={level} style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: level === 0 ? colors.bgSubtle : coach.color + ['30', '50', '80', 'CC'][level - 1] }} />
            ))}
            <Text style={{ fontSize: 10, color: colors.textMuted, marginLeft: 4 }}>More</Text>
          </View>
        </View>

        {/* Selected Day Workouts */}
        {selectedDate && (
          <View style={{ marginBottom: SPACING.md }}>
            <Text style={{
              fontSize: 12, fontWeight: '600', color: colors.textMuted,
              letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
            }}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>

            {selectedDayWorkouts.length > 0 ? (
              selectedDayWorkouts.map((w, i) => (
                <TouchableOpacity
                  key={w.id || i}
                  style={card({ flexDirection: 'row', alignItems: 'center' })}
                  onPress={() => openWorkoutDetail(w)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.name || 'Workout'}. Tap for details.`}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: (COACHES[w.coach]?.color || coach.color) + '12', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ fontSize: 14 }}>{COACHES[w.coach]?.emoji || '💪'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{w.name || 'Workout'}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {w.exerciseCount ? `${w.exerciseCount} exercises · ` : ''}{w.calories || 0} cal
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{formatTime(w.elapsed || 0)}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.textDim, marginLeft: 8 }}>›</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={card({ alignItems: 'center', paddingVertical: 20 })}>
                <Text style={{ fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }}>
                  Activity logged but no workout detail available
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tap hint when no day selected */}
        {!selectedDate && allWorkouts.length > 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ fontSize: 12, color: colors.textDim }}>
              Tap a highlighted day to see workout details
            </Text>
          </View>
        )}

        {monthOffset !== 0 && (
          <TouchableOpacity style={{ padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: coach.color + '40', alignItems: 'center', marginBottom: 16 }} onPress={() => { setMonthOffset(0); setSelectedDate(null); }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: coach.color }}>Jump to Today</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Workout Detail Sheet */}
      <WorkoutDetailSheet
        workout={selectedWorkout}
        visible={detailVisible}
        onClose={closeWorkoutDetail}
        onDoAgain={(w) => {
          navigation.navigate('WorkoutTab', { repeatWorkout: w });
        }}
        onDelete={async (w) => {
          await deleteWorkout(w.id);
          closeWorkoutDetail();
          loadData();
        }}
      />
    </SafeAreaView>
  );
}