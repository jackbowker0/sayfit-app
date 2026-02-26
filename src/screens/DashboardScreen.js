// ============================================================
// DASHBOARD SCREEN — Active coaching home tab
// ALL FEATURES: weight card, tappable workout detail,
// preferredMode-aware CTAs, calendar link, haptics, a11y,
// TAPPABLE ACHIEVEMENT BADGES + ACHIEVEMENTS SCREEN NAV
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { formatTime } from '../utils/helpers';
import { getWorkoutHistory, buildMemorySummary, deleteWorkout } from '../services/storage';
import { getUserProfile, isTodayWorkoutDay, getNextWorkoutDay } from '../services/userProfile';
import { getRecentAchievements, getAchievementStats, TIER_CONFIG } from '../services/achievements';
import * as haptics from '../services/haptics';
import WeightCard from '../components/WeightCard';
import WorkoutDetailSheet from '../components/WorkoutDetailSheet';
import AchievementDetailSheet from '../components/AchievementDetailSheet';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function getDayIndex(date) { const d = new Date(date).getDay(); return d === 0 ? 6 : d - 1; }

function getWeekStart() {
  const now = new Date(); const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now); start.setDate(now.getDate() - diff); start.setHours(0, 0, 0, 0);
  return start;
}

export default function DashboardScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const [history, setHistory] = useState([]);
  const [memory, setMemory] = useState(null);
  const [weekData, setWeekData] = useState([0,0,0,0,0,0,0]);
  const [userName, setUserName] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState(4);
  const [workoutDays, setWorkoutDays] = useState([]);
  const [preferredMode, setPreferredMode] = useState('coach');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const [recentBadges, setRecentBadges] = useState([]);
  const [achievementStats, setAchievementStats] = useState(null);
  const [weightKey, setWeightKey] = useState(0);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Achievement detail sheet state
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [badgeDetailVisible, setBadgeDetailVisible] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    if (!hasLoaded.current) setLoading(true);
    const data = await getWorkoutHistory(); setHistory(data);
    const weekStart = getWeekStart();
    const bars = [0,0,0,0,0,0,0];
    data.filter(w => new Date(w.date) >= weekStart).forEach(w => { bars[getDayIndex(w.date)]++; });
    setWeekData(bars);
    const mem = await buildMemorySummary(); setMemory(mem);
    const profile = await getUserProfile();
    if (profile.name) setUserName(profile.name);
    if (profile.weeklyGoal) setWeeklyGoal(profile.weeklyGoal);
    if (profile.workoutDays) setWorkoutDays(profile.workoutDays);
    if (profile.preferredMode) setPreferredMode(profile.preferredMode);
    const badges = await getRecentAchievements(7); setRecentBadges(badges);
    const aStats = await getAchievementStats(); setAchievementStats(aStats);
    setLoading(false);
    hasLoaded.current = true;
  };

  const openWorkoutDetail = (w) => { haptics.tap(); setSelectedWorkout(w); setDetailVisible(true); };
  const closeWorkoutDetail = () => { setDetailVisible(false); setTimeout(() => setSelectedWorkout(null), 250); };

  // Badge detail handlers
  const openBadgeDetail = (badge) => {
    haptics.tap();
    setSelectedBadge(badge);
    setBadgeDetailVisible(true);
  };
  const closeBadgeDetail = () => {
    setBadgeDetailVisible(false);
    setTimeout(() => setSelectedBadge(null), 250);
  };

  // Navigate to full Achievements screen
  const goToAchievements = () => {
    haptics.tap();
    navigation.navigate('Achievements');
  };

  const todayIndex = getDayIndex(new Date());
  const streak = memory?.streak || 0;
  const thisWeekCount = memory?.thisWeekCount || 0;
  const weekProgress = Math.min(thisWeekCount / weeklyGoal, 1);
  const todayIsPlanned = isTodayWorkoutDay(workoutDays);
  const todayDone = weekData[todayIndex] > 0;
  const hasSchedule = workoutDays.length > 0;

  const isLogger = preferredMode === 'logger';
  const isBoth = preferredMode === 'both';
  const goPrimary = () => { haptics.medium(); navigation.navigate(isLogger ? 'LogTab' : 'WorkoutTab'); };
  const goLog = () => { haptics.tap(); navigation.navigate('LogTab'); };
  const goWorkout = () => { haptics.medium(); navigation.navigate('WorkoutTab'); };

  const getGreeting = () => { const h = new Date().getHours(); if (h < 12) return 'Good morning'; if (h < 17) return 'Good afternoon'; return 'Good evening'; };

  const getCoachOneLiner = () => {
    if (!memory) return '';
    if (memory.isFirstWorkout) {
      if (isLogger) return { drill: "Log your first session.", hype: "Time to log your first workout! ✨", zen: "Record your first practice." }[coachId];
      return { drill: "Time to start.", hype: "Let's get moving! ✨", zen: "Shall we begin?" }[coachId];
    }
    if (hasSchedule && todayIsPlanned && !todayDone) {
      if (isLogger) return { drill: "Training day. Log it.", hype: "Workout day! Log those lifts! 🔥", zen: "Today is your practice day. Record it." }[coachId];
      return { drill: "It's a training day.", hype: "Workout day! Let's go! 🔥", zen: "Today is your practice day." }[coachId];
    }
    if (hasSchedule && todayIsPlanned && todayDone) return { drill: "Today's done. Good.", hype: "Workout day: CRUSHED! ✅", zen: "Today's practice is complete." }[coachId];
    if (hasSchedule && !todayIsPlanned && !todayDone) {
      const next = getNextWorkoutDay(workoutDays);
      if (next && next.daysUntil === 1) return { drill: "Rest day. Tomorrow we work.", hype: "Rest up — tomorrow's gonna be fire! 🔥", zen: "A day of rest. Tomorrow, we flow." }[coachId];
      return { drill: "Rest day.", hype: "Rest day — you earned it! ✨", zen: "A day for rest and recovery." }[coachId];
    }
    if (hasSchedule && !todayIsPlanned && todayDone) return { drill: "Extra credit. Respect.", hype: "Bonus workout! You're a MACHINE! 💪", zen: "An unexpected practice. The body called." }[coachId];
    if (thisWeekCount >= weeklyGoal) return { drill: "Goal crushed.", hype: "Weekly goal hit! 🎉", zen: "Intention fulfilled." }[coachId];
    const rem = weeklyGoal - thisWeekCount;
    if (rem === 1) return { drill: "One more.", hype: "Almost there! 🔥", zen: "One session remains." }[coachId];
    if (streak >= 3) return { drill: `${streak}-day streak.`, hype: `${streak} days strong! 🔥`, zen: `${streak} days flowing.` }[coachId];
    if (memory.daysSinceLast >= 3) return { drill: "You've been away.", hype: "Welcome back! 💪", zen: "Welcome back." }[coachId];
    return { drill: "Let's work.", hype: "Ready to go! ⚡", zen: "Ready when you are." }[coachId];
  };

  const getNudge = () => {
    if (!memory) return null;
    if (memory.isFirstWorkout) {
      if (isLogger) return { text: { drill: "First session. Get in there and log it.", hype: "Your first workout! Log it and let's start tracking! ✨", zen: "Record your first practice. The journey begins." }[coachId], cta: "Log First Workout", action: goLog, icon: '📝' };
      return { text: { drill: "Your first workout is waiting. No more excuses.", hype: "Your fitness journey starts NOW! Let's make it amazing! ✨", zen: "The first step awaits. Begin whenever you feel ready." }[coachId], cta: "Start First Workout", action: goWorkout, icon: '🚀' };
    }
    if (hasSchedule && todayIsPlanned && !todayDone) {
      if (isLogger) return { text: { drill: "Scheduled training day. Hit the gym. Log it.", hype: "It's a workout day! Go crush it and log those lifts! 🔥", zen: "You chose today for practice. Record your movements." }[coachId], cta: "Log Today's Workout", action: goLog, icon: '📅' };
      if (isBoth) return { text: { drill: "Training day. Coach or log — your call. Just move.", hype: "Workout day! Want me to build one or are you logging? 🔥", zen: "Today is practice day. Choose your path." }[coachId], cta: "Start Workout", action: goWorkout, icon: '📅', secondaryCta: "Just Log", secondaryAction: goLog };
      return { text: { drill: "It's a scheduled training day. No excuses. GET MOVING.", hype: "Today's a workout day on YOUR plan! Let's make it happen! 🔥", zen: "You chose today for practice. Honor that commitment." }[coachId], cta: "Start Today's Workout", action: goWorkout, icon: '📅' };
    }
    const remaining = weeklyGoal - thisWeekCount;
    if (remaining === 1) return { text: { drill: "ONE workout from your weekly goal. Finish the job.", hype: "Just ONE more and you hit your goal! 🔥", zen: "One session stands between you and your weekly intention." }[coachId], cta: isLogger ? "Log It" : "Finish the Week", action: isLogger ? goLog : goWorkout, icon: '🎯' };
    if (hasSchedule && !todayIsPlanned && !todayDone) { const next = getNextWorkoutDay(workoutDays); if (next) return { text: { drill: `Rest day. ${next.dayName} is your next session. Be ready.`, hype: `It's a rest day! Next workout: ${next.dayName}. Recharge! 🔋`, zen: `Today is for recovery. ${next.dayName} brings your next practice.` }[coachId], cta: isLogger ? "Log Anyway" : "Log Workout Anyway", action: goLog, icon: '😴' }; }
    if (memory.daysSinceLast >= 3 && memory.daysSinceLast < 7) return { text: { drill: `${memory.daysSinceLast} days off. Enough rest. Time to move.`, hype: `It's been ${memory.daysSinceLast} days — let's gooo! 💪`, zen: `${memory.daysSinceLast} days of rest. Your body may be ready.` }[coachId], cta: isLogger ? "Log a Workout" : "Get Back In", action: goPrimary, icon: '💪' };
    if (memory.daysSinceLast >= 7) return { text: { drill: `${memory.daysSinceLast} days MIA. Build a new streak.`, hype: `${memory.daysSinceLast} days away but you're HERE! 🙌`, zen: `${memory.daysSinceLast} days. Welcome back, without judgment.` }[coachId], cta: isLogger ? "Log a Workout" : "Start Fresh", action: goPrimary, icon: '🔄' };
    if (memory.neglectedMuscles && memory.neglectedMuscles.length >= 3) { const n = memory.neglectedMuscles.slice(0,2).join(' & '); return { text: { drill: `Skipping ${n}. Fix that.`, hype: `Your ${n} need love! ✨`, zen: `${n} could use attention.` }[coachId], cta: isLogger ? `Log ${memory.neglectedMuscles[0]}` : `Hit ${memory.neglectedMuscles[0]}`, action: goPrimary, icon: '🎯' }; }
    if (todayDone || thisWeekCount >= weeklyGoal) return { text: { drill: "Done for today. Log your lifts or rest.", hype: "You already crushed it! Log some lifts or enjoy the win! 🏆", zen: "Your practice is complete. Reflect or log." }[coachId], cta: "Log Workout", action: goLog, icon: '📝' };
    return { text: { drill: `${remaining} workouts left this week.`, hype: `${remaining} more to hit your goal! 🔥`, zen: `${remaining} sessions remain.` }[coachId], cta: isLogger ? "Log Workout" : "Start Workout", action: goPrimary, icon: isLogger ? '📝' : '🏋️', ...(isBoth ? { secondaryCta: isLogger ? "Coach Me" : "Just Log", secondaryAction: isLogger ? goWorkout : goLog } : {}) };
  };

  const card = (extra) => ({ backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: SPACING.md, marginBottom: SPACING.md, ...(isDark ? {} : { shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }), ...extra });

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={coach.color} />
      </View>
    </SafeAreaView>
  );

  const nudge = getNudge();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 20 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor={coach.color} />}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }} accessible accessibilityRole="header">
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}>
              {getGreeting()}{userName ? `, ${userName}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
              <Text style={{ fontSize: 16 }} accessibilityLabel={`Coach ${coach.name}`}>{coach.emoji}</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>{getCoachOneLiner()}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => { haptics.tap(); navigation.navigate('Settings'); }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={{ paddingTop: 4 }}
          >
            <Text style={{ fontSize: 22, opacity: 0.6 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Weight Card */}
        <WeightCard key={weightKey} navigation={navigation} onWeightLogged={() => setWeightKey(k => k + 1)} />

        {/* Coach Nudge */}
        {nudge && (
          <TouchableOpacity style={card({ borderColor: coach.color + '30', backgroundColor: isDark ? coach.color + '08' : coach.color + '04' })} onPress={nudge.action} activeOpacity={0.8} accessible accessibilityRole="button" accessibilityLabel={`${nudge.cta}. ${nudge.text}`}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text style={{ fontSize: 24 }}>{nudge.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginBottom: 10 }}>{nudge.text}</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <TouchableOpacity style={{ alignSelf: 'flex-start', backgroundColor: coach.color, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md }} onPress={nudge.action} activeOpacity={0.8}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: getTextOnColor(coach.color) }}>{nudge.cta} →</Text>
                  </TouchableOpacity>
                  {nudge.secondaryCta && (
                    <TouchableOpacity style={{ alignSelf: 'flex-start', backgroundColor: colors.bgSubtle, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border }} onPress={nudge.secondaryAction} activeOpacity={0.7}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{nudge.secondaryCta}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Weekly Progress Card */}
        <View style={card()}>
          {/* Card header with Calendar link */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' }}>This Week</Text>
            <TouchableOpacity onPress={() => { haptics.tap(); navigation.navigate('Calendar'); }} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="View calendar">
              <Text style={{ fontSize: 12, fontWeight: '600', color: coach.color }}>Calendar →</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }} accessible accessibilityLabel={`Weekly progress: ${thisWeekCount} of ${weeklyGoal} workouts. ${streak > 0 ? `${streak} day streak.` : ''}`}>
            <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 5, borderColor: colors.border, position: 'absolute' }} />
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 5, borderColor: coach.color, borderTopColor: weekProgress >= 0.25 ? coach.color : 'transparent', borderRightColor: weekProgress >= 0.5 ? coach.color : 'transparent', borderBottomColor: weekProgress >= 0.75 ? coach.color : 'transparent', borderLeftColor: weekProgress >= 1 ? coach.color : 'transparent', position: 'absolute', transform: [{ rotate: '-90deg' }] }} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: coach.color }}>{thisWeekCount}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{thisWeekCount}/{weeklyGoal} this week</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                {streak > 0 ? `${streak}-day streak` : 'Start your streak today'}
                {history.length > 0 ? `  ·  ${history.length} total` : ''}
              </Text>
            </View>
          </View>

          {/* Week dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
            {DAYS.map((day, i) => {
              const active = weekData[i] > 0; const isToday = i === todayIndex;
              const isPlanned = hasSchedule && workoutDays.includes(i);
              let bgColor = 'transparent', borderW = 0, borderC = 'transparent', showCheck = false, dotColor = colors.textMuted;
              if (active) { bgColor = coach.color; showCheck = true; }
              else if (isPlanned && isToday) { borderW = 2; borderC = coach.color; }
              else if (isPlanned) { bgColor = coach.color + '20'; borderW = 1; borderC = coach.color + '40'; }
              else if (isToday) { borderW = 1.5; borderC = colors.textMuted; }
              if (isToday) dotColor = coach.color;
              return (
                <View key={i} style={{ alignItems: 'center', flex: 1 }} accessible accessibilityLabel={`${DAY_NAMES[i]}: ${active ? 'workout completed' : isPlanned ? 'planned workout day' : isToday ? 'today' : 'rest day'}`}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: bgColor, borderWidth: borderW, borderColor: borderC, alignItems: 'center', justifyContent: 'center' }}>
                    {showCheck && <Text style={{ fontSize: 12, fontWeight: '700', color: getTextOnColor(coach.color) }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 11, marginTop: 4, color: dotColor, fontWeight: isToday ? '700' : '400' }}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ===== RECENT ACHIEVEMENTS — NOW TAPPABLE ===== */}
        {recentBadges.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' }}>Recent Badges</Text>
              {achievementStats && (
                <TouchableOpacity
                  onPress={goToAchievements}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${achievementStats.unlocked} of ${achievementStats.total} achievements unlocked. Tap to see all.`}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: coach.color }}>
                    {achievementStats.unlocked}/{achievementStats.total} →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }} contentContainerStyle={{ gap: 10 }}>
              {recentBadges.slice(0, 5).map((badge, i) => {
                const tier = TIER_CONFIG[badge.tier] || TIER_CONFIG.bronze;
                return (
                  <TouchableOpacity
                    key={badge.id || i}
                    onPress={() => openBadgeDetail({ ...badge, earned: true })}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: colors.bgCard,
                      borderRadius: RADIUS.lg,
                      borderWidth: 1,
                      borderColor: tier.color + '30',
                      padding: 14,
                      width: 120,
                      alignItems: 'center',
                      ...(isDark ? {} : {
                        shadowColor: 'rgba(0,0,0,0.06)',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 1,
                        shadowRadius: 8,
                        elevation: 2,
                      }),
                    }}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`${badge.name} badge, ${tier.label} tier. Tap for details.`}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: tier.glow,
                      borderWidth: 1.5, borderColor: tier.color,
                      alignItems: 'center', justifyContent: 'center',
                      marginBottom: 8,
                    }}>
                      <Text style={{ fontSize: 18 }}>{badge.emoji}</Text>
                    </View>
                    <Text
                      style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 2 }}
                      numberOfLines={1}
                    >
                      {badge.name}
                    </Text>
                    <Text style={{ fontSize: 9, color: tier.color, fontWeight: '600', letterSpacing: 0.5 }}>
                      {tier.label.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Recent Workouts — TAPPABLE */}
        {history.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' }}>Recent</Text>
              <TouchableOpacity onPress={() => { haptics.tap(); navigation.navigate('Calendar'); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="See all workouts" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: coach.color }}>See all</Text>
              </TouchableOpacity>
            </View>
            {history.slice(-4).reverse().map((w, i) => (
              <TouchableOpacity key={w.id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: i < Math.min(history.length, 4) - 1 ? 1 : 0, borderBottomColor: colors.border }} onPress={() => openWorkoutDetail(w)} activeOpacity={0.7} accessible accessibilityRole="button" accessibilityLabel={`${w.name || 'Workout'}, ${new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}. Tap for details.`}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: (COACHES[w.coach]?.color || coach.color) + '12', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 14 }}>{COACHES[w.coach]?.emoji || '💪'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{w.name || 'Workout'}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {w.exerciseCount ? ` · ${w.exerciseCount} exercises` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{formatTime(w.elapsed || 0)}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{w.calories || 0} cal</Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.textDim, marginLeft: 8 }}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Empty State */}
        {history.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>{coach.emoji}</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>
              {isLogger
                ? { drill: "Nothing logged. Fix that.", hype: "Your log is empty — let's change that! ✨", zen: "Your record awaits its first entry." }[coachId]
                : { drill: "No excuses. Let's go.", hype: "Your journey starts NOW! ✨", zen: "Every journey begins with one step." }[coachId]
              }
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 }}>
              {isLogger
                ? { drill: "Get to the Gym Log tab. Record your work.", hype: "Head to the Gym Log tab and log your first workout! It's gonna feel GREAT!", zen: "The Gym Log tab awaits your first entry. Begin when ready." }[coachId]
                : { drill: "Get to the Train tab. I'm waiting.", hype: "Head to the Train tab — your first workout is gonna be AMAZING!", zen: "The Train tab will guide you through your first mindful session." }[coachId]
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Workout Detail Sheet */}
      <WorkoutDetailSheet workout={selectedWorkout} visible={detailVisible} onClose={closeWorkoutDetail} onDoAgain={(w) => { navigation.navigate('WorkoutTab', { repeatWorkout: w }); }} onDelete={async (w) => { await deleteWorkout(w.id); closeWorkoutDetail(); loadData(); }} />

      {/* Achievement Detail Sheet */}
      <AchievementDetailSheet badge={selectedBadge} visible={badgeDetailVisible} onClose={closeBadgeDetail} />
    </SafeAreaView>
  );
}

export async function saveWorkoutToHistory(workoutData) {
  const { saveWorkout: save } = require('../services/storage');
  return save(workoutData);
}