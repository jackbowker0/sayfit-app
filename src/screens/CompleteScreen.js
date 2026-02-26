// ============================================================
// COMPLETE SCREEN — Post-workout celebration ceremony
// Handles BOTH guided workouts and logged workouts
// With: confetti, coach celebrations, staggered reveals,
// count-up stats, per-badge springs, haptics
// ============================================================

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Animated, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { formatTime } from '../utils/helpers';
import { saveWorkout, invalidateMemoryCache, buildMemorySummary } from '../services/storage';
import { checkAchievements, TIER_CONFIG } from '../services/achievements';
import { getUserProfile } from '../services/userProfile';
import * as haptics from '../services/haptics';
import ShareCard from '../components/ShareCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COUNT = 40;

// ─── CONFETTI PARTICLE ──────────────────────────────────────────

function ConfettiParticle({ delay, color, startX }) {
  const fall = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const size = useMemo(() => 6 + Math.random() * 6, []);
  const rotation = useMemo(() => Math.random() * 360, []);
  const drift = useMemo(() => (Math.random() - 0.5) * 120, []);
  const isCircle = useMemo(() => Math.random() > 0.5, []);

  useEffect(() => {
    const duration = 2200 + Math.random() * 1200;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fall, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 1, duration: duration * 0.6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration, delay: duration * 0.5, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

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
          { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, SCREEN_HEIGHT * 0.85] }) },
          { translateX: wobble.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, drift * 0.5, drift, drift * 0.5, 0] }) },
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Emoji pops in first
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(emojiScale, { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
    ]).start();

    // Then text slides up
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const celebrations = {
    drill: {
      emoji: '🫡',
      title: isLoggedWorkout ? 'LOGGED.' : 'DISMISSED.',
      subtitle: isLoggedWorkout
        ? 'Every rep tracked is a rep that counts.'
        : 'You showed up and you delivered.',
    },
    hype: {
      emoji: '🎊🔥🎊',
      title: isLoggedWorkout ? 'YESSS!!' : 'INCREDIBLE!!',
      subtitle: isLoggedWorkout
        ? 'Look at you being all organized AND strong!'
        : 'I literally cannot contain myself right now!',
    },
    zen: {
      emoji: '🙏',
      title: isLoggedWorkout ? 'Noted.' : 'Complete.',
      subtitle: isLoggedWorkout
        ? 'Your dedication to tracking shows deep self-awareness.'
        : 'Take three slow breaths. Feel what you accomplished.',
    },
  };

  const cel = celebrations[coachId] || celebrations.hype;

  return (
    <View style={{ alignItems: 'center', marginBottom: 24, paddingHorizontal: 20 }}>
      <Animated.Text style={{
        fontSize: 52, marginBottom: 10,
        transform: [{ scale: emojiScale }],
      }}>
        {cel.emoji}
      </Animated.Text>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 28, fontWeight: '900', color: coach.color,
          letterSpacing: coachId === 'drill' ? 3 : coachId === 'hype' ? -0.5 : 1,
          marginBottom: 6,
        }}>
          {cel.title}
        </Text>
        <Text style={{
          fontSize: 15, color: colors.textSecondary, textAlign: 'center',
          lineHeight: 22, maxWidth: 280,
        }}>
          {cel.subtitle}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── ANIMATED STAT CARD ─────────────────────────────────────────

function StatCard({ label, value, color, delay, cardStyle }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Card pops in
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();

    // Count up the number
    Animated.sequence([
      Animated.delay(delay + 200),
      Animated.timing(countAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
    ]).start();

    const listener = countAnim.addListener(({ value: v }) => {
      setDisplayValue(Math.round(value * v));
    });
    return () => countAnim.removeListener(listener);
  }, []);

  return (
    <Animated.View style={[cardStyle, {
      flex: 1, alignItems: 'center',
      opacity: opacityAnim,
      transform: [{ scale: scaleAnim }],
    }]}>
      <Text style={{ fontSize: 26, fontWeight: '900', color, fontVariant: ['tabular-nums'] }}>
        {typeof value === 'number' ? displayValue.toLocaleString() : value}
      </Text>
      <Text style={{ fontSize: 8, color: color + '80', marginTop: 4, letterSpacing: 1.5, textAlign: 'center', fontWeight: '600' }}>
        {label}
      </Text>
    </Animated.View>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────

export default function CompleteScreen({ navigation, route }) {
  const { coachId, workout, generatedWorkout } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  // ─── DETERMINE SOURCE ─────────────────────────────────────────
  const logData = route?.params?.logData || null;
  const isLoggedWorkout = !!logData;

  const guidedState = workout?.state || {};
  const guidedStats = guidedState.stats || {};
  const guidedExercises = guidedState.exercises || [];
  const guidedElapsed = guidedState.elapsed || 0;
  const guidedCommandLog = guidedState.commandLog || [];
  const guidedReset = workout?.reset;

  // ─── UNIFIED STATS ────────────────────────────────────────────
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

  // ─── STATE ────────────────────────────────────────────────────
  const hasSaved = useRef(false);
  const [streak, setStreak] = useState(0);
  const [newAchievements, setNewAchievements] = useState([]);
  const [showConfetti, setShowConfetti] = useState(true);

  // Section stagger animations
  const metaAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const buttonsAnim = useRef(new Animated.Value(0)).current;

  // Per-badge animations (populated dynamically)
  const badgeAnims = useRef([]).current;

  useEffect(() => {
    // Haptic cascade: heavy thud → success buzz
    haptics.heavy();
    setTimeout(() => haptics.success(), 350);

    // Staggered section entrances (after coach celebration)
    Animated.stagger(350, [
      Animated.spring(metaAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.spring(contentAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.spring(buttonsAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();

    // Confetti fades after burst
    setTimeout(() => setShowConfetti(false), 4000);
  }, []);

  // ─── SAVE & ACHIEVEMENTS ──────────────────────────────────────

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
          }

          invalidateMemoryCache();
          const mem = await buildMemorySummary();
          setStreak(mem.streak || 0);

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

            // Create per-badge spring animations
            earned.forEach((_, i) => {
              if (!badgeAnims[i]) badgeAnims[i] = new Animated.Value(0);
            });

            // Stagger each badge popping in
            Animated.stagger(250,
              earned.map((_, i) =>
                Animated.spring(badgeAnims[i], {
                  toValue: 1, tension: 60, friction: 8, useNativeDriver: true,
                })
              )
            ).start();

            // Tiny haptic per badge
            earned.forEach((_, i) => {
              setTimeout(() => haptics.tap(), 1400 + i * 250);
            });
          }
        } catch (e) {
          console.warn('[Complete] Failed to save workout:', e);
          Alert.alert('Save Error', 'Your workout stats may not have been saved. Please check your history.');
        }
      };

      saveAndCheck();
    }
  }, []);

  // ─── HANDLERS ─────────────────────────────────────────────────

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

  // ─── COACH SUMMARIES ──────────────────────────────────────────

  const coachSummary = isLoggedWorkout
    ? {
      drill: `${stats.exercisesCompleted} exercises, ${totalSets} sets logged. ${newPRs.length > 0 ? 'New PRs. That\'s growth.' : 'Consistent work builds strength.'}`,
      hype: `${totalSets} sets in the books! ${newPRs.length > 0 ? `And ${newPRs.length} NEW PR${newPRs.length > 1 ? 's' : ''}!! 🏆` : 'Every rep counts! 💪'}`,
      zen: `${stats.exercisesCompleted} exercises logged with intention. ${newPRs.length > 0 ? 'New personal records — growth made visible.' : 'Progress is in the practice.'}`,
    }
    : {
      drill: `${stats.exercisesCompleted} exercises crushed. ${stats.adaptations > 0 ? "You adapted and overcame." : 'Straight through. Impressive.'}`,
      hype: `You just burned ${stats.calories} calories! ${stats.adaptations > 0 ? 'Love that you listened to your body! 🙌' : 'Amazing work!'}`,
      zen: `${stats.exercisesCompleted} movements completed with intention. ${stats.adaptations > 0 ? 'Your body guided you wisely.' : 'A steady, centered practice.'}`,
    };

  const card = (extra) => ({
    backgroundColor: colors.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: colors.border, padding: SPACING.md,
    marginBottom: SPACING.md, width: '100%',
    ...(isDark ? {} : { shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }),
    ...extra,
  });

  // ─── RENDER ───────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Confetti overlay */}
      {showConfetti && <ConfettiBurst coachColor={coach.color} />}

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingTop: 50, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── COACH CELEBRATION ─── */}
        <CoachCelebration
          coachId={coachId}
          coach={coach}
          colors={colors}
          isLoggedWorkout={isLoggedWorkout}
        />

        {/* ─── TIME & STREAK ─── */}
        <Animated.View style={{
          opacity: metaAnim,
          transform: [{ translateY: metaAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
          marginBottom: 20, alignItems: 'center',
        }}>
          {elapsed > 0 && (
            <Text style={{ fontSize: 13, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>
              Total time: {formatTime(elapsed)}
            </Text>
          )}
          {streak > 0 && (
            <Text style={{ fontSize: 13, color: coach.color, fontWeight: '600', marginTop: 4 }}>
              🔥 {streak} day streak
            </Text>
          )}
        </Animated.View>

        {/* ─── STAT CARDS (staggered pop-in + count-up) ─── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: SPACING.md, width: '100%' }}>
          {isLoggedWorkout ? (
            <>
              <StatCard label="EXERCISES" value={stats.exercisesCompleted} color={colors.green} delay={700} cardStyle={card()} />
              <StatCard label="SETS" value={totalSets} color={coach.color} delay={900} cardStyle={card()} />
              <StatCard label={`VOL (${units.toUpperCase()})`} value={totalVolume} color={colors.orange} delay={1100} cardStyle={card()} />
            </>
          ) : (
            <>
              <StatCard label="CALORIES" value={stats.calories} color={colors.orange} delay={700} cardStyle={card()} />
              <StatCard label="EXERCISES" value={stats.exercisesCompleted} color={colors.green} delay={900} cardStyle={card()} />
              <StatCard label="ADAPTED" value={stats.adaptations} color={coach.color} delay={1100} cardStyle={card()} />
            </>
          )}
        </View>

        {/* ─── CONTENT (staggered reveal) ─── */}
        <Animated.View style={{
          width: '100%',
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
        }}>

          {/* PRs */}
          {newPRs.length > 0 && (
            <View style={card({ borderColor: colors.orange + '40', backgroundColor: colors.orange + '06' })}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.orange, letterSpacing: 1, marginBottom: 10 }}>
                🏆 NEW PERSONAL RECORDS
              </Text>
              {newPRs.filter(p => p.type === 'weight').map((pr, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 8,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border,
                }}>
                  <Text style={{ fontSize: 20 }}>🏆</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{pr.exercise}</Text>
                    <Text style={{ fontSize: 13, color: colors.orange }}>
                      {pr.old > 0 ? `${pr.old} → ` : ''}{pr.new} {units}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Achievements — per-badge staggered spring */}
          {newAchievements.length > 0 && (
            <View style={[card(), {
              borderColor: coach.color + '40',
              backgroundColor: isDark ? coach.color + '08' : coach.color + '06',
            }]}>
              <Text style={{
                fontSize: 12, fontWeight: '600', color: coach.color,
                letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
              }}>
                🏆 {newAchievements.length === 1 ? 'Achievement Unlocked!' : `${newAchievements.length} Achievements Unlocked!`}
              </Text>

              {newAchievements.map((achievement, i) => {
                const tier = TIER_CONFIG[achievement.tier] || TIER_CONFIG.bronze;
                const anim = badgeAnims[i] || new Animated.Value(1);
                return (
                  <Animated.View key={achievement.id || i} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingVertical: 10,
                    borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border,
                    opacity: anim,
                    transform: [{
                      scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1.15, 1] }),
                    }],
                  }}
                    accessible
                    accessibilityLabel={`${achievement.name}, ${tier.label} tier. ${achievement.description}`}
                  >
                    <View style={{
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: tier.glow,
                      borderWidth: 2, borderColor: tier.color,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 20 }}>{achievement.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{achievement.name}</Text>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: tier.color + '20' }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: tier.color, letterSpacing: 0.5 }}>{tier.label.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{achievement.description}</Text>
                      {achievement.coachMessages && (
                        <Text style={{ fontSize: 12, color: coach.color, marginTop: 4, fontStyle: 'italic' }}>
                          {coach.emoji} {achievement.coachMessages[coachId]}
                        </Text>
                      )}
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Muscles */}
          {muscles.length > 0 && (
            <View style={card()} accessible accessibilityLabel={`Muscles worked: ${muscles.join(', ')}`}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Muscles Worked</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {muscles.map(m => (
                  <View key={m} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: coach.color + '40', backgroundColor: coach.color + '08' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: coach.color }}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Coach Summary */}
          <View style={card({ flexDirection: 'row', gap: 14, alignItems: 'flex-start' })}>
            <Text style={{ fontSize: 24 }}>{coach.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 4 }}>{coach.name} says:</Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: isDark ? coach.color : colors.textPrimary }}>
                {coachSummary[coachId]}
              </Text>
            </View>
          </View>

          {/* Share card — guided workouts */}
          {!isLoggedWorkout && (
            <ShareCard coachId={coachId} stats={stats} elapsed={elapsed} exercises={exercises} workoutName={workoutName} streak={streak} />
          )}
        </Animated.View>

        {/* ─── BUTTONS (staggered entrance) ─── */}
        <Animated.View style={{
          width: '100%',
          opacity: buttonsAnim,
          transform: [{ translateY: buttonsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}>
          <TouchableOpacity
            style={{ backgroundColor: coach.color, padding: 18, borderRadius: RADIUS.lg, width: '100%', alignItems: 'center', marginBottom: 12, minHeight: 56 }}
            onPress={handleDashboard} activeOpacity={0.8}
            accessibilityRole="button" accessibilityLabel="View Dashboard"
          >
            <Text style={{ fontSize: 17, fontWeight: '800', color: getTextOnColor(coach.color) }}>View Dashboard →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ padding: 16, borderRadius: RADIUS.lg, width: '100%', alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, minHeight: 52, marginBottom: 40 }}
            onPress={handleNewWorkout} activeOpacity={0.7}
            accessibilityRole="button" accessibilityLabel={isLoggedWorkout ? 'Log another workout' : 'Start a new workout'}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
              {isLoggedWorkout ? 'Log Another Workout' : 'New Workout'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}