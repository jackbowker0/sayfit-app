// ============================================================
// COMPLETE SCREEN — Post-workout celebration ceremony
// Handles BOTH guided workouts and logged workouts
// With: confetti, coach celebrations, staggered reveals,
// count-up stats, per-badge springs, haptics
// Premium dark UI with GlassCard + Lucide icons
// ============================================================

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Dimensions, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Flame, Clock, Sparkles, Share2, Check, ChevronRight } from 'lucide-react-native';
import { COACH_ICONS, getTierIcon } from '../constants/icons';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';
import { FONT, GLOW, TIMING, SPACING, RADIUS, getTextOnColor } from '../constants/theme';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { useTheme } from '../hooks/useTheme';
import { formatTime } from '../utils/helpers';
import { saveWorkout, invalidateMemoryCache, buildMemorySummary } from '../services/storage';
import { getOverloadSuggestion, saveExerciseDurations, getTimeOverloadSuggestion } from '../services/exerciseLog';
import { checkAchievements, TIER_CONFIG } from '../services/achievements';
import { getUserProfile } from '../services/userProfile';
import * as haptics from '../services/haptics';
import ShareCard from '../components/ShareCard';
import { capture } from '../services/posthog';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COUNT = 40;

// ─── CONFETTI PARTICLE (RN Animated) ─────────────────────────────

function ConfettiParticle({ delay, color, startX }) {
  const size = useMemo(() => 6 + Math.random() * 6, []);
  const rotation = useMemo(() => Math.random() * 360, []);
  const drift = useMemo(() => (Math.random() - 0.5) * 120, []);
  const isCircle = useMemo(() => Math.random() > 0.5, []);
  const duration = useMemo(() => 2200 + Math.random() * 1200, []);

  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(duration * 0.5),
          Animated.timing(opacity, {
            toValue: 0,
            duration: duration * 0.5,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, []);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT * 0.85],
  });

  const translateX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, drift * 0.5, drift, drift * 0.5, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: startX,
        top: -10,
        width: size,
        height: isCircle ? size : size * 1.6,
        borderRadius: isCircle ? size / 2 : 2,
        backgroundColor: color,
        opacity,
        transform: [
          { translateY },
          { translateX },
          { rotate: `${rotation}deg` },
        ],
      }}
    />
  );
}

// ─── CONFETTI BURST ─────────────────────────────────────────────

function ConfettiBurst({ coachColor }) {
  const confettiColors = [
    coachColor, '#FF6B35', '#FFD700', '#2ECC40', '#7FDBFF',
    '#FF4136', '#B10DC9', '#01FF70', '#FFDC00',
  ];

  const particles = useMemo(() =>
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      color: confettiColors[i % confettiColors.length],
      startX: Math.random() * SCREEN_WIDTH,
      delay: Math.random() * 600,
    })),
  []);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      {particles.map(p => (
        <ConfettiParticle key={p.id} color={p.color} startX={p.startX} delay={p.delay} />
      ))}
    </View>
  );
}

// ─── COACH CELEBRATION MOMENT ───────────────────────────────────

function CoachCelebration({ coachId, coach, colors, isLoggedWorkout }) {
  const CoachIcon = COACH_ICONS[coach.iconName];

  const celebrations = {
    drill: {
      title: isLoggedWorkout ? 'LOGGED.' : 'DISMISSED.',
      subtitle: isLoggedWorkout
        ? 'Every rep tracked is a rep that counts.'
        : 'You showed up and you delivered.',
    },
    hype: {
      title: isLoggedWorkout ? 'YESSS!!' : 'INCREDIBLE!!',
      subtitle: isLoggedWorkout
        ? 'Look at you being all organized AND strong!'
        : 'I literally cannot contain myself right now!',
    },
    zen: {
      title: isLoggedWorkout ? 'Noted.' : 'Complete.',
      subtitle: isLoggedWorkout
        ? 'Your dedication to tracking shows deep self-awareness.'
        : 'Take three slow breaths. Feel what you accomplished.',
    },
  };

  const cel = celebrations[coachId] || celebrations.hype;

  return (
    <View style={{ alignItems: 'center', marginBottom: 24, paddingHorizontal: 20 }}>
      <FadeInView delay={200} type="zoom"
        style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: coach.color + '18',
          borderWidth: 2, borderColor: coach.color + '60',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
          shadowColor: coach.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: GLOW.lg,
          elevation: 8,
        }}
      >
        {CoachIcon && <CoachIcon size={36} color={coach.color} strokeWidth={2.5} />}
      </FadeInView>

      <FadeInView delay={500} from="up" style={{ alignItems: 'center' }}>
        <Text style={{
          ...FONT.title, color: coach.color,
          letterSpacing: coachId === 'drill' ? 3 : coachId === 'hype' ? -0.5 : 1,
          marginBottom: 6,
        }}>
          {cel.title}
        </Text>
        <Text style={{
          ...FONT.body, color: colors.textSecondary, textAlign: 'center',
          maxWidth: 280,
        }}>
          {cel.subtitle}
        </Text>
      </FadeInView>
    </View>
  );
}

// ─── ANIMATED STAT CARD ─────────────────────────────────────────

function StatCard({ label, value, icon: IconComp, iconColor, color, delay, colors }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof value === 'number' && value > 0) {
      const startTime = Date.now();
      const delayMs = delay + 200;
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed < delayMs) return;
        const progress = Math.min((elapsed - delayMs) / 1000, 1);
        setDisplayValue(Math.round(value * progress));
        if (progress >= 1) clearInterval(interval);
      }, 16);
      return () => clearInterval(interval);
    } else {
      setDisplayValue(value);
    }
  }, []);

  return (
    <GlassCard
      fadeDelay={delay}
      style={{ flex: 1, alignItems: 'center', padding: SPACING.md }}
    >
      {IconComp && (
        <IconComp size={16} color={iconColor || color} style={{ marginBottom: 6, opacity: 0.6 }} />
      )}
      <Text style={{ ...FONT.statLg, color, fontSize: 26 }}>
        {typeof value === 'number' ? displayValue.toLocaleString() : value}
      </Text>
      <Text style={{ ...FONT.label, color: color + '80', marginTop: 4, textAlign: 'center', fontSize: 8 }}>
        {label}
      </Text>
    </GlassCard>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────

export default function CompleteScreen({ navigation, route }) {
  const { coachId, workout, generatedWorkout } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();
  const CoachIcon = COACH_ICONS[coach.iconName];

  const logData = route?.params?.logData || null;
  const isLoggedWorkout = !!logData;

  const guidedState = workout?.state || {};
  const guidedStats = guidedState.stats || {};
  const guidedExercises = guidedState.exercises || [];
  const guidedElapsed = guidedState.elapsed || 0;
  const guidedCommandLog = guidedState.commandLog || [];
  const guidedReset = workout?.reset;

  const stats = isLoggedWorkout ? {
    calories: logData.calories || 0,
    exercisesCompleted: logData.exerciseCount || 0,
    adaptations: 0,
  } : {
    calories: guidedStats.calories || 0,
    exercisesCompleted: guidedStats.exercisesCompleted || 0,
    adaptations: guidedStats.adaptations || 0,
  };

  const elapsed = isLoggedWorkout ? (logData.elapsed || 0) : guidedElapsed;
  const exercises = isLoggedWorkout ? (logData.exercises || []) : guidedExercises;
  const muscles = isLoggedWorkout
    ? (logData.muscles || [])
    : [...new Set(guidedExercises.map(e => e.muscle).filter(Boolean))];

  const workoutName = isLoggedWorkout
    ? (logData.name || 'Logged Workout')
    : (generatedWorkout?.name || (muscles.length > 0 ? `${muscles.slice(0, 2).join(' & ')} Workout` : 'Full Body Blast'));

  const totalSets = isLoggedWorkout ? (logData.totalSets || 0) : 0;
  const totalVolume = isLoggedWorkout ? (logData.totalVolume || 0) : 0;
  const newPRs = isLoggedWorkout ? (logData.newPRs || []) : [];
  const units = isLoggedWorkout ? (logData.units || 'lbs') : 'lbs';

  const hasSaved = useRef(false);
  const [streak, setStreak] = useState(0);
  const [newAchievements, setNewAchievements] = useState([]);
  const [showConfetti, setShowConfetti] = useState(true);
  const [overloadSuggestions, setOverloadSuggestions] = useState([]);
  const [timeOverloadSuggestions, setTimeOverloadSuggestions] = useState([]);

  useEffect(() => {
    haptics.heavy();
    setTimeout(() => haptics.success(), 350);
    setTimeout(() => setShowConfetti(false), 4000);
  }, []);

  useEffect(() => {
    if (!hasSaved.current) {
      hasSaved.current = true;

      const saveAndCheck = async () => {
        try {
          if (!isLoggedWorkout) {
            const exerciseNames = guidedExercises.map(e => e.name).filter(Boolean);
            await saveWorkout({
              name: workoutName, coach: coachId, calories: stats.calories,
              exerciseCount: stats.exercisesCompleted, adaptations: stats.adaptations,
              elapsed: guidedElapsed, muscles, exerciseNames, commands: guidedCommandLog,
              energyLevel: generatedWorkout?.energyLevel || null,
              source: generatedWorkout ? 'justTalk' : 'coach',
              workoutType: generatedWorkout?.focus || 'general',
            });

            // Save per-exercise durations for progressive overload tracking
            const mainExercises = guidedExercises.filter(e => e.phase === 'main');
            if (mainExercises.length > 0) {
              await saveExerciseDurations(mainExercises);
              const timeSugs = [];
              for (const ex of mainExercises.slice(0, 5)) {
                const s = await getTimeOverloadSuggestion(ex.name);
                if (s) timeSugs.push({ name: ex.name, ...s });
              }
              if (timeSugs.length > 0) setTimeOverloadSuggestions(timeSugs.slice(0, 3));
            }
          }

          invalidateMemoryCache();
          const mem = await buildMemorySummary();
          setStreak(mem.streak || 0);

          if (!isLoggedWorkout) {
            capture('workout_completed', {
              workout_name: workoutName,
              calories: stats.calories,
              exercises_completed: stats.exercisesCompleted,
              adaptations: stats.adaptations,
              duration_seconds: elapsed,
              coach_id: coachId,
              streak: mem.streak || 0,
            });
          }

          const profile = await getUserProfile();
          const earned = await checkAchievements({
            stats,
            memory: mem,
            newPRs: isLoggedWorkout ? newPRs : [],
            weeklyGoal: profile.weeklyGoal || 4,
          });

          if (earned.length > 0) {
            setNewAchievements(earned);
            haptics.achievement();
            earned.forEach(a => capture('achievement_unlocked', { achievement_id: a.id, achievement_name: a.name, tier: a.tier }));
            earned.forEach((_, i) => {
              setTimeout(() => haptics.tap(), 1400 + i * 250);
            });
          }

          // Load progressive overload suggestions for logged workouts
          if (isLoggedWorkout && logData.exercises?.length > 0) {
            const suggestions = [];
            for (const ex of logData.exercises) {
              const s = await getOverloadSuggestion(ex.name);
              if (s) suggestions.push({ name: ex.name, ...s });
            }
            if (suggestions.length > 0) setOverloadSuggestions(suggestions);
          }
        } catch (e) {
          console.warn('[Complete] Failed to save workout:', e);
          Alert.alert('Save Error', 'Your workout stats may not have been saved. Please check your history.');
        }
      };

      saveAndCheck();
    }
  }, []);

  const handleDashboard = () => {
    haptics.tap();
    if (!isLoggedWorkout && guidedReset) guidedReset();
    navigation.replace('MainTabs');
  };

  const handleNewWorkout = () => {
    haptics.tap();
    if (!isLoggedWorkout && guidedReset) guidedReset();
    navigation.replace('MainTabs', { screen: isLoggedWorkout ? 'LogTab' : 'WorkoutTab' });
  };

  const coachSummary = isLoggedWorkout
    ? {
      drill: `${stats.exercisesCompleted} exercises, ${totalSets} sets logged. ${newPRs.length > 0 ? 'New PRs. That\'s growth.' : 'Consistent work builds strength.'}`,
      hype: `${totalSets} sets in the books! ${newPRs.length > 0 ? `And ${newPRs.length} NEW PR${newPRs.length > 1 ? 's' : ''}!!` : 'Every rep counts!'}`,
      zen: `${stats.exercisesCompleted} exercises logged with intention. ${newPRs.length > 0 ? 'New personal records — growth made visible.' : 'Progress is in the practice.'}`,
    }
    : {
      drill: `${stats.exercisesCompleted} exercises crushed. ${stats.adaptations > 0 ? "You adapted and overcame." : 'Straight through. Impressive.'}`,
      hype: `You just burned ${stats.calories} calories! ${stats.adaptations > 0 ? 'Love that you listened to your body!' : 'Amazing work!'}`,
      zen: `${stats.exercisesCompleted} movements completed with intention. ${stats.adaptations > 0 ? 'Your body guided you wisely.' : 'A steady, centered practice.'}`,
    };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 200,
        backgroundColor: coach.color + '08',
        borderBottomLeftRadius: 100, borderBottomRightRadius: 100,
      }} />

      {showConfetti && <ConfettiBurst coachColor={coach.color} />}

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingTop: 50, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <CoachCelebration
          coachId={coachId}
          coach={coach}
          colors={colors}
          isLoggedWorkout={isLoggedWorkout}
        />

        <FadeInView delay={600} from="up" style={{ marginBottom: 20, alignItems: 'center' }}>
          {elapsed > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Clock size={13} color={colors.textMuted} />
              <Text style={{ ...FONT.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>
                Total time: {formatTime(elapsed)}
              </Text>
            </View>
          )}
          {streak > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Flame size={14} color={coach.color} />
              <Text style={{ ...FONT.caption, color: coach.color, fontWeight: '600' }}>
                {streak} day streak
              </Text>
            </View>
          )}
        </FadeInView>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: SPACING.md, width: '100%' }}>
          {isLoggedWorkout ? (
            <>
              <StatCard label="EXERCISES" value={stats.exercisesCompleted} icon={Check} iconColor={colors.green} color={colors.green} delay={700} colors={colors} />
              <StatCard label="SETS" value={totalSets} icon={Sparkles} iconColor={coach.color} color={coach.color} delay={900} colors={colors} />
              <StatCard label={`VOL (${units.toUpperCase()})`} value={totalVolume} icon={Trophy} iconColor={colors.orange} color={colors.orange} delay={1100} colors={colors} />
            </>
          ) : (
            <>
              <StatCard label="CALORIES" value={stats.calories} icon={Flame} iconColor={colors.orange} color={colors.orange} delay={700} colors={colors} />
              <StatCard label="EXERCISES" value={stats.exercisesCompleted} icon={Check} iconColor={colors.green} color={colors.green} delay={900} colors={colors} />
              <StatCard label="ADAPTED" value={stats.adaptations} icon={Sparkles} iconColor={coach.color} color={coach.color} delay={1100} colors={colors} />
            </>
          )}
        </View>

        {!isLoggedWorkout && timeOverloadSuggestions.length > 0 && (
          <GlassCard accentColor={coach.color} fadeDelay={1200} style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {CoachIcon && <CoachIcon size={15} color={coach.color} />}
              <Text style={{ ...FONT.label, color: coach.color }}>
                {{ drill: 'NEXT SESSION', hype: 'LEVEL UP PLAN', zen: 'Next Practice' }[coachId] || 'NEXT SESSION'}
              </Text>
            </View>
            {timeOverloadSuggestions.map((s, i) => (
              <View key={s.name} style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 10,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...FONT.body, fontWeight: '600', color: colors.textPrimary }}>{s.name}</Text>
                  <Text style={{ ...FONT.caption, color: colors.textMuted }}>Last: {s.lastDuration}s</Text>
                </View>
                <View style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: coach.color + '15', borderWidth: 1, borderColor: coach.color + '30',
                }}>
                  <Text style={{ ...FONT.caption, fontWeight: '700', color: coach.color }}>
                    Try {s.suggestedDuration}s (+{s.increase}s)
                  </Text>
                </View>
              </View>
            ))}
          </GlassCard>
        )}

        {newPRs.length > 0 && (
          <GlassCard accentColor={colors.orange} glow fadeDelay={1200} style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Trophy size={16} color={colors.orange} />
              <Text style={{ ...FONT.label, color: colors.orange }}>NEW PERSONAL RECORDS</Text>
            </View>
            {newPRs.filter(p => p.type === 'weight').map((pr, i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border,
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: colors.orange + '15', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trophy size={18} color={colors.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...FONT.body, fontWeight: '700', color: colors.textPrimary }}>{pr.exercise}</Text>
                  <Text style={{ ...FONT.caption, color: colors.orange }}>
                    {pr.old > 0 ? `${pr.old} → ` : ''}{pr.new} {units}
                  </Text>
                </View>
              </View>
            ))}
          </GlassCard>
        )}

        {overloadSuggestions.length > 0 && (
          <GlassCard accentColor={coach.color} fadeDelay={1300} style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {CoachIcon && <CoachIcon size={15} color={coach.color} />}
              <Text style={{ ...FONT.label, color: coach.color }}>
                {{ drill: 'NEXT SESSION', hype: 'LEVEL UP PLAN', zen: 'Next Practice' }[coachId] || 'NEXT SESSION'}
              </Text>
            </View>
            {overloadSuggestions.map((s, i) => (
              <View key={s.name} style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 10,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...FONT.body, fontWeight: '600', color: colors.textPrimary }}>{s.name}</Text>
                  <Text style={{ ...FONT.caption, color: colors.textMuted }}>Last: {s.lastWeight} {units}</Text>
                </View>
                <View style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: coach.color + '15', borderWidth: 1, borderColor: coach.color + '30',
                }}>
                  <Text style={{ ...FONT.caption, fontWeight: '700', color: coach.color }}>
                    Try {s.suggestedWeight} {units} (+{s.increase})
                  </Text>
                </View>
              </View>
            ))}
          </GlassCard>
        )}

        {newAchievements.length > 0 && (
          <GlassCard accentColor={coach.color} glow fadeDelay={1400} style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={16} color={coach.color} />
              <Text style={{ ...FONT.label, color: coach.color }}>
                {newAchievements.length === 1 ? 'Achievement Unlocked!' : `${newAchievements.length} Achievements Unlocked!`}
              </Text>
            </View>
            {newAchievements.map((achievement, i) => {
              const tier = TIER_CONFIG[achievement.tier] || TIER_CONFIG.bronze;
              const TierIcon = getTierIcon(achievement.tier);
              return (
                <FadeInView
                  key={achievement.id || i}
                  delay={1600 + i * 250}
                  type="zoom"
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
                    borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border,
                  }}
                  accessible
                  accessibilityLabel={`${achievement.name}, ${tier.label} tier. ${achievement.description}`}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 22, backgroundColor: tier.glow,
                    borderWidth: 2, borderColor: tier.color, alignItems: 'center', justifyContent: 'center',
                    shadowColor: tier.color, shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.3, shadowRadius: GLOW.sm, elevation: 4,
                  }}>
                    {TierIcon && <TierIcon size={20} color={tier.color} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ ...FONT.body, fontWeight: '700', color: colors.textPrimary }}>{achievement.name}</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: tier.color + '20' }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: tier.color, letterSpacing: 0.5 }}>{tier.label.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>{achievement.description}</Text>
                    {achievement.coachMessages && CoachIcon && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <CoachIcon size={12} color={coach.color} />
                        <Text style={{ ...FONT.caption, color: coach.color, fontStyle: 'italic' }}>
                          {achievement.coachMessages[coachId]}
                        </Text>
                      </View>
                    )}
                  </View>
                </FadeInView>
              );
            })}
          </GlassCard>
        )}

        {muscles.length > 0 && (
          <GlassCard fadeDelay={1600} style={{ width: '100%' }}
            accessible accessibilityLabel={`Muscles worked: ${muscles.join(', ')}`}
          >
            <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: 10 }}>Muscles Worked</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {muscles.map(m => (
                <View key={m} style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                  borderWidth: 1, borderColor: coach.color + '40', backgroundColor: coach.color + '08',
                }}>
                  <Text style={{ ...FONT.caption, fontWeight: '600', color: coach.color }}>{m}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        )}

        <GlassCard accentColor={coach.color} fadeDelay={1800}
          style={{ width: '100%', flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: coach.color + '15', alignItems: 'center', justifyContent: 'center',
          }}>
            {CoachIcon && <CoachIcon size={20} color={coach.color} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...FONT.caption, fontWeight: '600', color: colors.textMuted, marginBottom: 4 }}>{coach.name} says:</Text>
            <Text style={{ ...FONT.body, color: isDark ? coach.color : colors.textPrimary }}>
              {coachSummary[coachId]}
            </Text>
          </View>
        </GlassCard>

        <FadeInView delay={2000} from="up" style={{ width: '100%' }}>
          <ShareCard
            coachId={coachId} stats={stats} elapsed={elapsed} exercises={exercises}
            workoutName={workoutName} streak={streak} isLoggedWorkout={isLoggedWorkout}
            totalSets={totalSets} totalVolume={totalVolume} units={units} navigation={navigation}
          />
        </FadeInView>

        <FadeInView delay={2200} from="up" style={{ width: '100%' }}>
          <TouchableOpacity
            style={{
              backgroundColor: coach.color, padding: 18, borderRadius: RADIUS.lg,
              width: '100%', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12, minHeight: 56, flexDirection: 'row', gap: 8,
              shadowColor: coach.color, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: GLOW.md, elevation: 6,
            }}
            onPress={handleDashboard} activeOpacity={0.8}
            accessibilityRole="button" accessibilityLabel="View Dashboard"
          >
            <Text style={{ ...FONT.subhead, fontWeight: '800', color: getTextOnColor(coach.color) }}>View Dashboard</Text>
            <ChevronRight size={18} color={getTextOnColor(coach.color)} />
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              padding: 16, borderRadius: RADIUS.lg, width: '100%',
              alignItems: 'center', minHeight: 52, marginBottom: 40,
              backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
            }}
            onPress={handleNewWorkout} activeOpacity={0.7}
            accessibilityRole="button" accessibilityLabel={isLoggedWorkout ? 'Log another workout' : 'Start a new workout'}
          >
            <Text style={{ ...FONT.body, fontWeight: '600', color: colors.textSecondary }}>
              {isLoggedWorkout ? 'Log Another Workout' : 'New Workout'}
            </Text>
          </TouchableOpacity>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}
