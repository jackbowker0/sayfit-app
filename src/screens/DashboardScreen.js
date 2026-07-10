// ============================================================
// DASHBOARD SCREEN — Premium dark home tab with glass-morphism
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import FadeInView from '../components/FadeInView';
import {
  Settings, ChevronRight, Check, Calendar, Flame, Zap, Moon, Trophy,
  Dumbbell, Camera, Pill, Syringe, Scale, TestTube, Users,
} from 'lucide-react-native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import { SPACING, RADIUS, FONT, GLOW, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { formatTime } from '../utils/helpers';
import { getWorkoutHistory, buildMemorySummary, deleteWorkout } from '../services/storage';
import { getUserProfile, isTodayWorkoutDay, getNextWorkoutDay } from '../services/userProfile';
import { getRecentAchievements, getAchievementStats, TIER_CONFIG } from '../services/achievements';
import { getMuscleIcon, getAchievementIcon, getTierIcon } from '../constants/icons';
import { loadHubStats } from '../hooks/useHubStats';
import * as haptics from '../services/haptics';
import GlassCard from '../components/GlassCard';
import WinningVerdict from '../components/WinningVerdict';
import ActionTile from '../components/ActionTile';
import WeightCard from '../components/WeightCard';
import NutritionCard from '../components/NutritionCard';
import ProtocolCard from '../components/ProtocolCard';
import WorkoutDetailSheet from '../components/WorkoutDetailSheet';
import AchievementDetailSheet from '../components/AchievementDetailSheet';
import AccountabilityWidget from '../components/AccountabilityWidget';
import QuickAddMic from '../components/QuickAddMic';
import { SOCIAL_ENABLED } from '../config/features';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function getDayIndex(date) { const d = new Date(date).getDay(); return d === 0 ? 6 : d - 1; }

function getWeekStart() {
  const now = new Date(); const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now); start.setDate(now.getDate() - diff); start.setHours(0, 0, 0, 0);
  return start;
}

// Map nudge icon strings to Lucide components
const NUDGE_ICONS = {
  '📝': () => require('lucide-react-native').ClipboardList,
  '🚀': () => require('lucide-react-native').Rocket,
  '📅': () => require('lucide-react-native').Calendar,
  '🎯': () => require('lucide-react-native').Target,
  '💪': () => require('lucide-react-native').Dumbbell,
  '🔄': () => require('lucide-react-native').RefreshCw,
  '😴': () => require('lucide-react-native').Moon,
  '🏋️': () => require('lucide-react-native').Dumbbell,
  '🏆': () => require('lucide-react-native').Trophy,
};

function NudgeIcon({ icon, color, size = 22 }) {
  const getter = NUDGE_ICONS[icon];
  if (getter) {
    const Icon = getter();
    return <Icon size={size} color={color} strokeWidth={2} />;
  }
  return <Flame size={size} color={color} strokeWidth={2} />;
}

export default function DashboardScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const CoachIcon = COACH_ICONS[coach.iconName];
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
  const [hubStats, setHubStats] = useState(null);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
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

    // ---- Hub stats: one fetch shared by the verdict + the action tiles ----
    // Reloaded in lockstep with everything else (useFocusEffect + pull-to-refresh).
    // Extracted to loadHubStats() so the Dashboard, Coach hub, and
    // WinningVerdict all read the SAME shape and never drift.
    const stats = await loadHubStats(profile);
    if (stats) setHubStats(stats);

    setLoading(false);
    hasLoaded.current = true;
  };

  const openWorkoutDetail = (w) => { haptics.tap(); setSelectedWorkout(w); setDetailVisible(true); };
  const closeWorkoutDetail = () => { setDetailVisible(false); setTimeout(() => setSelectedWorkout(null), 250); };
  const openBadgeDetail = (badge) => { haptics.tap(); setSelectedBadge(badge); setBadgeDetailVisible(true); };
  const closeBadgeDetail = () => { setBadgeDetailVisible(false); setTimeout(() => setSelectedBadge(null), 250); };
  const goToAchievements = () => { haptics.tap(); navigation.navigate('Achievements'); };

  const todayIndex = getDayIndex(new Date());
  const streak = memory?.streak || 0;
  const thisWeekCount = memory?.thisWeekCount || 0;
  const weekProgress = Math.min(thisWeekCount / weeklyGoal, 1);
  const todayIsPlanned = isTodayWorkoutDay(workoutDays);
  const todayDone = weekData[todayIndex] > 0;
  const hasSchedule = workoutDays.length > 0;

  const isLogger = preferredMode === 'logger';
  const isBoth = preferredMode === 'both';
  const goPrimary = () => { haptics.medium(); navigation.navigate(isLogger ? 'LogWorkout' : 'BuildWorkout'); };
  const goLog = () => { haptics.tap(); navigation.navigate('LogWorkout'); };
  const goWorkout = () => { haptics.medium(); navigation.navigate('BuildWorkout'); };

  const getGreeting = () => { const h = new Date().getHours(); if (h < 12) return 'Good morning'; if (h < 17) return 'Good afternoon'; return 'Good evening'; };

  const getTodayStatus = () => {
    if (!hasSchedule) return null;
    if (todayIsPlanned && todayDone)  return { label: 'Done today', color: '#2ECC40', Icon: Check };
    if (todayIsPlanned && !todayDone) return { label: 'Workout day', color: coach.color, Icon: Zap };
    if (!todayIsPlanned && todayDone) return { label: 'Bonus workout', color: coach.color, Icon: Trophy };
    return { label: 'Rest day', color: colors.textMuted, Icon: Moon };
  };

  const getCoachOneLiner = () => {
    if (!memory) return '';
    if (memory.isFirstWorkout) {
      if (isLogger) return { drill: "Log your first session.", hype: "Time to log your first workout!", zen: "Record your first practice." }[coachId];
      return { drill: "Time to start.", hype: "Let's get moving!", zen: "Shall we begin?" }[coachId];
    }
    if (hasSchedule && todayIsPlanned && !todayDone) {
      if (isLogger) return { drill: "Training day. Log it.", hype: "Workout day! Log those lifts!", zen: "Today is your practice day. Record it." }[coachId];
      return { drill: "It's a training day.", hype: "Workout day! Let's go!", zen: "Today is your practice day." }[coachId];
    }
    if (hasSchedule && todayIsPlanned && todayDone) return { drill: "Today's done. Good.", hype: "Workout day: CRUSHED!", zen: "Today's practice is complete." }[coachId];
    if (hasSchedule && !todayIsPlanned && !todayDone) {
      const next = getNextWorkoutDay(workoutDays);
      if (next && next.daysUntil === 1) return { drill: "Rest day. Tomorrow we work.", hype: "Rest up — tomorrow's gonna be fire!", zen: "A day of rest. Tomorrow, we flow." }[coachId];
      return { drill: "Rest day.", hype: "Rest day — you earned it!", zen: "A day for rest and recovery." }[coachId];
    }
    if (hasSchedule && !todayIsPlanned && todayDone) return { drill: "Extra credit. Respect.", hype: "Bonus workout! You're a MACHINE!", zen: "An unexpected practice. The body called." }[coachId];
    if (thisWeekCount >= weeklyGoal) return { drill: "Goal crushed.", hype: "Weekly goal hit!", zen: "Intention fulfilled." }[coachId];
    const rem = weeklyGoal - thisWeekCount;
    if (rem === 1) return { drill: "One more.", hype: "Almost there!", zen: "One session remains." }[coachId];
    if (streak >= 3) return { drill: `${streak}-day streak.`, hype: `${streak} days strong!`, zen: `${streak} days flowing.` }[coachId];
    if (memory.daysSinceLast >= 3) return { drill: "You've been away.", hype: "Welcome back!", zen: "Welcome back." }[coachId];
    return { drill: "Let's work.", hype: "Ready to go!", zen: "Ready when you are." }[coachId];
  };

  const getNudge = () => {
    if (!memory) return null;
    if (memory.isFirstWorkout) {
      if (isLogger) return { text: { drill: "First session. Get in there and log it.", hype: "Your first workout! Log it and let's start tracking!", zen: "Record your first practice. The journey begins." }[coachId], cta: "Log First Workout", action: goLog, icon: '📝' };
      return { text: { drill: "Your first workout is waiting. No more excuses.", hype: "Your fitness journey starts NOW! Let's make it amazing!", zen: "The first step awaits. Begin whenever you feel ready." }[coachId], cta: "Start First Workout", action: goWorkout, icon: '🚀' };
    }
    if (hasSchedule && todayIsPlanned && !todayDone) {
      if (isLogger) return { text: { drill: "Scheduled training day. Hit the gym. Log it.", hype: "It's a workout day! Go crush it and log those lifts!", zen: "You chose today for practice. Record your movements." }[coachId], cta: "Log Today's Workout", action: goLog, icon: '📅' };
      if (isBoth) return { text: { drill: "Training day. Coach or log — your call. Just move.", hype: "Workout day! Want me to build one or are you logging?", zen: "Today is practice day. Choose your path." }[coachId], cta: "Start Workout", action: goWorkout, icon: '📅', secondaryCta: "Just Log", secondaryAction: goLog };
      return { text: { drill: "It's a scheduled training day. No excuses. GET MOVING.", hype: "Today's a workout day on YOUR plan! Let's make it happen!", zen: "You chose today for practice. Honor that commitment." }[coachId], cta: "Start Today's Workout", action: goWorkout, icon: '📅' };
    }
    const remaining = weeklyGoal - thisWeekCount;
    if (remaining === 1) return { text: { drill: "ONE workout from your weekly goal. Finish the job.", hype: "Just ONE more and you hit your goal!", zen: "One session stands between you and your weekly intention." }[coachId], cta: isLogger ? "Log It" : "Finish the Week", action: isLogger ? goLog : goWorkout, icon: '🎯' };
    if (hasSchedule && !todayIsPlanned && !todayDone) { const next = getNextWorkoutDay(workoutDays); if (next) return { text: { drill: `Rest day. ${next.dayName} is your next session. Be ready.`, hype: `It's a rest day! Next workout: ${next.dayName}. Recharge!`, zen: `Today is for recovery. ${next.dayName} brings your next practice.` }[coachId], cta: isLogger ? "Log Anyway" : "Log Workout Anyway", action: goLog, icon: '😴' }; }
    if (memory.daysSinceLast >= 3 && memory.daysSinceLast < 7) return { text: { drill: `${memory.daysSinceLast} days off. Enough rest. Time to move.`, hype: `It's been ${memory.daysSinceLast} days — let's gooo!`, zen: `${memory.daysSinceLast} days of rest. Your body may be ready.` }[coachId], cta: isLogger ? "Log a Workout" : "Get Back In", action: goPrimary, icon: '💪' };
    if (memory.daysSinceLast >= 7) return { text: { drill: `${memory.daysSinceLast} days MIA. Build a new streak.`, hype: `${memory.daysSinceLast} days away but you're HERE!`, zen: `${memory.daysSinceLast} days. Welcome back, without judgment.` }[coachId], cta: isLogger ? "Log a Workout" : "Start Fresh", action: goPrimary, icon: '🔄' };
    if (memory.neglectedMuscles && memory.neglectedMuscles.length >= 3) { const n = memory.neglectedMuscles.slice(0,2).join(' & '); return { text: { drill: `Skipping ${n}. Fix that.`, hype: `Your ${n} need love!`, zen: `${n} could use attention.` }[coachId], cta: isLogger ? `Log ${memory.neglectedMuscles[0]}` : `Hit ${memory.neglectedMuscles[0]}`, action: goPrimary, icon: '🎯' }; }
    if (todayDone || thisWeekCount >= weeklyGoal) return { text: { drill: "Done for today. Log your lifts or rest.", hype: "You already crushed it! Log some lifts or enjoy the win!", zen: "Your practice is complete. Reflect or log." }[coachId], cta: "Log Workout", action: goLog, icon: '📝' };
    return { text: { drill: `${remaining} workouts left this week.`, hype: `${remaining} more to hit your goal!`, zen: `${remaining} sessions remain.` }[coachId], cta: isLogger ? "Log Workout" : "Start Workout", action: goPrimary, icon: isLogger ? '📝' : '🏋️', ...(isBoth ? { secondaryCta: isLogger ? "Coach Me" : "Just Log", secondaryAction: isLogger ? goWorkout : goLog } : {}) };
  };

  // ---- Action tiles: shortcut + status, driven by the shared hub fetch ----
  // Every tile navigates to a route that exists (App.js), except Bloodwork
  // which has no store/route yet and renders as an honest disabled "Soon" tile.
  // Protocol tiles gate on the disclaimer ack — pre-ack they show "Tap to set up",
  // never the seeded default numbers as if the user configured them.
  const buildTiles = () => {
    const h = hubStats || {};
    const w = h.wStats || {};
    const n = h.nStats || {};
    const p = h.pStats || {};
    const ack = h.pAck === true;
    const units = h.units || 'lbs';
    const lastWorkoutDate = h.lastWorkoutDate || null;

    // Log Workout
    const daysSinceWorkout = lastWorkoutDate
      ? Math.floor((Date.now() - new Date(lastWorkoutDate).getTime()) / 86400000)
      : null;
    let workoutStatus;
    if (daysSinceWorkout === null) workoutStatus = 'Not logged';
    else if (daysSinceWorkout === 0) workoutStatus = 'Logged today';
    else if (daysSinceWorkout === 1) workoutStatus = '1d ago';
    else workoutStatus = `${daysSinceWorkout}d ago`;
    const workoutTile = {
      key: 'workout',
      Icon: Dumbbell,
      label: 'Log Workout',
      status: workoutStatus,
      attention: (todayIsPlanned && !todayDone) ? 'due' : 'none',
      onPress: goLog,
    };

    // Snap Meal
    const meals = n.mealCount || 0;
    const mealStatus = meals > 0 ? `${meals} logged today` : 'No meals today';
    const mealTile = {
      key: 'meal',
      Icon: Camera,
      label: 'Snap Meal',
      status: mealStatus,
      attention: 'none',
      onPress: () => navigation.navigate('FuelTab'),
    };

    // Supplements (gated on ack)
    const suppTotal = p.supplementsTotal || 0;
    const suppDone = p.supplementsDone || 0;
    let suppStatus, suppAttention;
    if (!ack) { suppStatus = 'Tap to set up'; suppAttention = 'none'; }
    else if (suppTotal > 0 && suppDone >= suppTotal) { suppStatus = `${suppDone}/${suppTotal} done`; suppAttention = 'done'; }
    else if (suppTotal > 0) { suppStatus = `${suppDone}/${suppTotal} done`; suppAttention = 'due'; }
    else { suppStatus = 'None set'; suppAttention = 'none'; }
    const suppTile = {
      key: 'supplements',
      Icon: Pill,
      label: 'Supplements',
      status: suppStatus,
      attention: suppAttention,
      onPress: () => navigation.navigate('ProtocolTab'),
    };

    // Injection (gated on ack)
    let injStatus, injAttention;
    if (!ack) { injStatus = 'Tap to set up'; injAttention = 'none'; }
    else if (p.injectionDueToday) { injStatus = `Due: ${p.nextDose?.name || 'today'}`; injAttention = 'due'; }
    else { injStatus = 'None due today'; injAttention = 'none'; }
    const injTile = {
      key: 'injection',
      Icon: Syringe,
      label: 'Injection',
      status: injStatus,
      attention: injAttention,
      onPress: () => navigation.navigate('ProtocolTab'),
    };

    // Log Weight
    const daysSinceWeight = w.currentDate
      ? Math.floor((Date.now() - new Date(w.currentDate).getTime()) / 86400000)
      : null;
    let weightTimeAgo = '';
    if (daysSinceWeight === 0) weightTimeAgo = 'today';
    else if (daysSinceWeight === 1) weightTimeAgo = 'yesterday';
    else if (daysSinceWeight !== null) weightTimeAgo = `${daysSinceWeight}d ago`;
    const weightTile = {
      key: 'weight',
      Icon: Scale,
      label: 'Log Weight',
      status: w.current != null ? `${w.current} ${units} · ${weightTimeAgo}` : 'Not logged',
      attention: (w.current != null && daysSinceWeight !== null && daysSinceWeight >= 7) ? 'due' : 'none',
      onPress: () => navigation.navigate('Weight'),
    };

    // Bloodwork — no store/route yet: honest disabled "Soon" tile.
    const bloodTile = {
      key: 'bloodwork',
      Icon: TestTube,
      label: 'Bloodwork',
      status: 'Soon',
      attention: 'none',
      disabled: true,
    };

    return [workoutTile, mealTile, suppTile, injTile, weightTile, bloodTile];
  };

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={coach.color} />
      </View>
    </SafeAreaView>
  );

  const nudge = getNudge();
  const tiles = buildTiles();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACING.screenPadding, paddingBottom: 100 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor={coach.color} />}>

        {/* Header */}
        <FadeInView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }} accessible accessibilityRole="header">
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ ...FONT.title, color: colors.textPrimary }}>
              {getGreeting()}{userName ? `, ${userName}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              {/* Today status pill */}
              {(() => { const s = getTodayStatus(); if (!s) return null; const PillIcon = s.Icon; return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: s.color + '18', borderWidth: 1, borderColor: s.color + '35' }}>
                  <PillIcon size={11} color={s.color} strokeWidth={2.5} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: s.color, letterSpacing: 0.2 }}>{s.label}</Text>
                </View>
              ); })()}
              {/* Coach one-liner — hidden for logger-only users */}
              {!isLogger && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: coach.color + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CoachIcon size={12} color={coach.color} strokeWidth={2.5} />
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }} numberOfLines={1}>{getCoachOneLiner()}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            {SOCIAL_ENABLED && (
              <TouchableOpacity
                onPress={() => { haptics.tap(); navigation.navigate('SocialFeed'); }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Social feed"
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' }}
              >
                <Users size={18} color={colors.textMuted} strokeWidth={1.8} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => { haptics.tap(); navigation.navigate('Settings'); }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' }}
            >
              <Settings size={18} color={colors.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        {/* "Am I winning?" verdict — the top status readout */}
        <WinningVerdict navigation={navigation} hubStats={hubStats} />

        {/* TODAY — action tiles: shortcut + status, 2 x 3 grid */}
        <FadeInView delay={120} style={{ marginBottom: SPACING.md }}>
          <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: SPACING.sm }}>Today</Text>
          <View style={{ gap: SPACING.md }}>
            {[[0, 1], [2, 3], [4, 5]].map((pair, row) => (
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
                      disabled={t.disabled}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </FadeInView>

        {/* Coach Nudge — "what should I do next?" (verdict answers "how am I doing?") */}
        {nudge && (
          <GlassCard
            fadeDelay={160}
            accentColor={coach.color}
          >
            <TouchableOpacity onPress={nudge.action} activeOpacity={0.8} accessible accessibilityRole="button" accessibilityLabel={`${nudge.cta}. ${nudge.text}`}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: coach.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <NudgeIcon icon={nudge.icon} color={coach.color} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...FONT.body, color: colors.textSecondary, marginBottom: 12 }}>{nudge.text}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity style={{ alignSelf: 'flex-start', backgroundColor: coach.color, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md }} onPress={nudge.action} activeOpacity={0.8}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: getTextOnColor(coach.color) }}>{nudge.cta}</Text>
                    </TouchableOpacity>
                    {nudge.secondaryCta && (
                      <TouchableOpacity style={{ alignSelf: 'flex-start', backgroundColor: colors.glassBg, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.glassBorder }} onPress={nudge.secondaryAction} activeOpacity={0.7}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{nudge.secondaryCta}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* Weekly Progress Card */}
        <GlassCard fadeDelay={200}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ ...FONT.label, color: colors.textMuted }}>This Week</Text>
            <TouchableOpacity onPress={() => { haptics.tap(); navigation.navigate('Calendar'); }} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="View calendar" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} color={coach.color} strokeWidth={2} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: coach.color }}>Calendar</Text>
              <ChevronRight size={12} color={coach.color} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }} accessible accessibilityLabel={`Weekly progress: ${thisWeekCount} of ${weeklyGoal} workouts. ${streak > 0 ? `${streak} day streak.` : ''}`}>
            {/* Progress circle */}
            <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: colors.glassBorder, position: 'absolute' }} />
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: coach.color, borderTopColor: weekProgress >= 0.25 ? coach.color : 'transparent', borderRightColor: weekProgress >= 0.5 ? coach.color : 'transparent', borderBottomColor: weekProgress >= 0.75 ? coach.color : 'transparent', borderLeftColor: weekProgress >= 1 ? coach.color : 'transparent', position: 'absolute', transform: [{ rotate: '-90deg' }] }} />
              <Text style={{ ...FONT.stat, fontSize: 18, color: coach.color }}>{thisWeekCount}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>{thisWeekCount}/{weeklyGoal} this week</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                {streak > 0 && <Flame size={12} color={coach.color} strokeWidth={2.5} />}
                <Text style={{ ...FONT.caption, color: colors.textMuted }}>
                  {streak > 0 ? `${streak}-day streak` : 'Start your streak today'}
                  {history.length > 0 ? `  ·  ${history.length} total` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Week dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.glassBorder }}>
            {DAYS.map((day, i) => {
              const active = weekData[i] > 0; const isToday = i === todayIndex;
              const isPlanned = hasSchedule && workoutDays.includes(i);
              let bgColor = 'transparent', borderW = 0, borderC = 'transparent', dotColor = colors.textMuted;
              if (active) { bgColor = coach.color; }
              else if (isPlanned && isToday) { borderW = 2.5; borderC = coach.color; }
              else if (isPlanned) { bgColor = coach.color + '15'; borderW = 1.5; borderC = coach.color + '40'; }
              else if (isToday) { borderW = 1.5; borderC = colors.textMuted; }
              if (isToday) dotColor = coach.color;
              return (
                <View key={i} style={{ alignItems: 'center', flex: 1 }} accessible accessibilityLabel={`${DAY_NAMES[i]}: ${active ? 'workout completed' : isPlanned ? 'planned workout day' : isToday ? 'today' : 'rest day'}`}>
                  <View style={{
                    width: 42, height: 42, borderRadius: 21,
                    backgroundColor: bgColor, borderWidth: borderW, borderColor: borderC,
                    alignItems: 'center', justifyContent: 'center',
                    ...(active && isDark ? { shadowColor: coach.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: GLOW.sm, elevation: 3 } : {}),
                  }}>
                    {active && <Check size={16} color={getTextOnColor(coach.color)} strokeWidth={3} />}
                  </View>
                  <Text style={{ fontSize: 12, marginTop: 5, color: dotColor, fontWeight: isToday ? '700' : '500' }}>{day}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Weight + Nutrition + Accountability — below the key action cards */}
        <WeightCard key={weightKey} navigation={navigation} onWeightLogged={() => setWeightKey(k => k + 1)} />
        <NutritionCard navigation={navigation} />
        <ProtocolCard navigation={navigation} />
        {SOCIAL_ENABLED && <AccountabilityWidget navigation={navigation} />}

        {/* Recent Achievements */}
        {recentBadges.length > 0 && (
          <FadeInView delay={200}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
              <Text style={{ ...FONT.label, color: colors.textMuted }}>Recent Badges</Text>
              {achievementStats && (
                <TouchableOpacity onPress={goToAchievements} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={`${achievementStats.unlocked} of ${achievementStats.total} achievements unlocked. Tap to see all.`}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: coach.color }}>
                    {achievementStats.unlocked}/{achievementStats.total}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }} contentContainerStyle={{ gap: 10 }}>
              {recentBadges.slice(0, 5).map((badge, i) => {
                const tier = TIER_CONFIG[badge.tier] || TIER_CONFIG.bronze;
                const TierIcon = getTierIcon(badge.tier);
                return (
                  <FadeInView key={badge.id || i} delay={i * 80} from="right">
                    <TouchableOpacity
                      onPress={() => openBadgeDetail({ ...badge, earned: true })}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: isDark ? colors.glassBg : colors.bgCard,
                        borderRadius: RADIUS.lg,
                        borderWidth: 1,
                        borderColor: tier.color + '25',
                        padding: 14,
                        width: 120,
                        alignItems: 'center',
                        ...(isDark ? { shadowColor: tier.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: GLOW.sm, elevation: 2 } : { shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }),
                      }}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`${badge.name} badge, ${tier.label} tier. Tap for details.`}
                    >
                      <View style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: tier.color + '15',
                        borderWidth: 1.5, borderColor: tier.color + '40',
                        alignItems: 'center', justifyContent: 'center',
                        marginBottom: 8,
                      }}>
                        <TierIcon size={18} color={tier.color} strokeWidth={2} />
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 2 }} numberOfLines={1}>
                        {badge.name}
                      </Text>
                      <Text style={{ fontSize: 9, color: tier.color, fontWeight: '600', letterSpacing: 0.5 }}>
                        {tier.label.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  </FadeInView>
                );
              })}
            </ScrollView>
          </FadeInView>
        )}

        {/* Recent Workouts */}
        {history.length > 0 && (
          <FadeInView delay={250}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
              <Text style={{ ...FONT.label, color: colors.textMuted }}>Recent</Text>
              <TouchableOpacity onPress={() => { haptics.tap(); navigation.navigate('Calendar'); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="See all workouts" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: coach.color }}>See all</Text>
              </TouchableOpacity>
            </View>
            <GlassCard noPadding style={{ overflow: 'hidden' }}>
              {history.slice(-4).reverse().map((w, i) => {
                const workoutCoach = COACHES[w.coach] || coach;
                const WorkoutCoachIcon = COACH_ICONS[workoutCoach.iconName] || CoachIcon;
                return (
                  <TouchableOpacity key={w.id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: SPACING.md, borderBottomWidth: i < Math.min(history.length, 4) - 1 ? 1 : 0, borderBottomColor: colors.glassBorder }} onPress={() => openWorkoutDetail(w)} activeOpacity={0.7} accessible accessibilityRole="button" accessibilityLabel={`${w.name || 'Workout'}, ${new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}. Tap for details.`}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: workoutCoach.color + '12', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <WorkoutCoachIcon size={16} color={workoutCoach.color} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{w.name || 'Workout'}</Text>
                      <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>
                        {new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {w.exerciseCount ? ` · ${w.exerciseCount} exercises` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{formatTime(w.elapsed || 0)}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{w.calories || 0} cal</Text>
                    </View>
                    <ChevronRight size={14} color={colors.textDim} strokeWidth={1.5} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              })}
            </GlassCard>
          </FadeInView>
        )}

        {/* Empty State */}
        {history.length === 0 && (
          <FadeInView delay={200} style={{ alignItems: 'center', paddingVertical: 40 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: coach.color + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...(isDark ? { shadowColor: coach.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: GLOW.md } : {}) }}>
              <CoachIcon size={32} color={coach.color} strokeWidth={2} />
            </View>
            <Text style={{ ...FONT.heading, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>
              {isLogger
                ? { drill: "Nothing logged. Fix that.", hype: "Your log is empty — let's change that!", zen: "Your record awaits its first entry." }[coachId]
                : { drill: "No excuses. Let's go.", hype: "Your journey starts NOW!", zen: "Every journey begins with one step." }[coachId]
              }
            </Text>
            <Text style={{ ...FONT.body, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20 }}>
              {isLogger
                ? { drill: "Get to the Gym Log tab. Record your work.", hype: "Head to the Gym Log tab and log your first workout! It's gonna feel GREAT!", zen: "The Gym Log tab awaits your first entry. Begin when ready." }[coachId]
                : { drill: "Get to the Train tab. I'm waiting.", hype: "Head to the Train tab — your first workout is gonna be AMAZING!", zen: "The Train tab will guide you through your first mindful session." }[coachId]
              }
            </Text>
          </FadeInView>
        )}
      </ScrollView>

      {/* Universal quick-add mic — floats over the tab bar */}
      <QuickAddMic navigation={navigation} />

      <WorkoutDetailSheet workout={selectedWorkout} visible={detailVisible} onClose={closeWorkoutDetail} onDoAgain={(w) => { navigation.navigate('BuildWorkout', { repeatWorkout: w }); }} onDelete={async (w) => { await deleteWorkout(w.id); closeWorkoutDetail(); loadData(); }} />
      <AchievementDetailSheet badge={selectedBadge} visible={badgeDetailVisible} onClose={closeBadgeDetail} />
    </SafeAreaView>
  );
}

export async function saveWorkoutToHistory(workoutData) {
  const { saveWorkout: save } = require('../services/storage');
  return save(workoutData);
}
