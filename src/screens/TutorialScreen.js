// ============================================================
// TUTORIAL SCREEN — One-time contextual walkthrough
//
// Shown once after onboarding completes.
// Adapts content based on user's primary path:
//   - Coach users: how AI workout generation works
//   - Logger users: how manual workout logging works
//
// Stored as hasSeenTutorial in profile so it never repeats.
// ============================================================

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useWorkoutContext } from '../context/WorkoutContext';
import { saveUserProfile } from '../services/userProfile';
import * as haptics from '../services/haptics';

// ---- TUTORIAL CONTENT PER MODE ----

const COACH_TUTORIAL = {
  drill: {
    headline: "Here's how this works, recruit.",
    steps: [
      { icon: '🗣️', title: 'Tell me what you want', desc: 'Say something like "20 min legs, I\'m tired" and I\'ll build the workout. No thinking required.' },
      { icon: '🏋️', title: 'I run the session', desc: 'I\'ll guide you through each exercise. Tell me to go harder, easier, or skip — I adapt.' },
      { icon: '📊', title: 'I track everything', desc: 'PRs, streaks, patterns. I remember what you did and push you past it.' },
    ],
    cta: "Let's get to work.",
  },
  hype: {
    headline: "OMG let me show you how this works! ✨",
    steps: [
      { icon: '💬', title: 'Just tell me how you feel!', desc: '"Quick upper body" or "I\'m stressed, 30 min" — I\'ll create the PERFECT workout for you!' },
      { icon: '⚡', title: 'I coach you through it!', desc: 'I\'ll hype you up, track your reps, and adjust if you need it. We\'re a TEAM!' },
      { icon: '🏆', title: 'Watch yourself level up!', desc: 'Badges, streaks, PRs — every win gets celebrated. You\'re gonna be AMAZED at your progress!' },
    ],
    cta: "Let's GOOO! 🔥",
  },
  zen: {
    headline: "Let me guide you through the practice.",
    steps: [
      { icon: '🌊', title: 'Describe your intention', desc: 'Share how your body feels today. "Gentle stretching" or "Build strength, 25 minutes." I\'ll craft the session.' },
      { icon: '🧘', title: 'Flow through together', desc: 'I\'ll guide each movement with breathing cues and mindful transitions. Adjust pace anytime.' },
      { icon: '🌿', title: 'Observe your journey', desc: 'Your history reveals patterns. Which muscles need attention, how your practice evolves over time.' },
    ],
    cta: "Begin the journey.",
  },
};

const LOGGER_TUTORIAL = {
  drill: {
    headline: "Logging mode. Smart choice.",
    steps: [
      { icon: '📝', title: 'Type your workout', desc: '"Bench 3x8 185, squat 225 5x5" — or use the form. I parse it either way.' },
      { icon: '📈', title: 'I spot the patterns', desc: 'PRs get flagged. Volume gets tracked. I know when you\'re sandbagging.' },
      { icon: '🔔', title: 'I keep you honest', desc: 'Streaks, planned days, neglected muscles — nothing slips past me.' },
    ],
    cta: "Start logging.",
  },
  hype: {
    headline: "You already know what you're doing — I LOVE that! 💪",
    steps: [
      { icon: '✍️', title: 'Log naturally!', desc: 'Type "bench 3x8 185" or use the form — whatever\'s fastest! I\'ll organize everything!' },
      { icon: '🎉', title: 'I celebrate your PRs!', desc: 'New records, milestones, consistency streaks — you\'ll hear about EVERY win!' },
      { icon: '📊', title: 'Smart insights!', desc: 'I track what muscles you\'re hitting, spot patterns, and help you stay balanced!' },
    ],
    cta: "Let's track! ✨",
  },
  zen: {
    headline: "Your practice, your record.",
    steps: [
      { icon: '📖', title: 'Record your movements', desc: 'Describe what you did in natural language, or use the structured form. Both paths lead to clarity.' },
      { icon: '🔍', title: 'Patterns emerge', desc: 'Over time, your log reveals the rhythm of your practice — what serves you, what\'s been neglected.' },
      { icon: '🌱', title: 'Growth, observed', desc: 'Personal records, consistency, balance — watch your practice deepen through gentle awareness.' },
    ],
    cta: "Begin your record.",
  },
};

export default function TutorialScreen({ navigation, route }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  // Determine mode — default to 'coach' if not specified
  const mode = route?.params?.mode || 'coach';
  const content = mode === 'logger'
    ? LOGGER_TUTORIAL[coachId]
    : COACH_TUTORIAL[coachId];

  const [dismissed, setDismissed] = useState(false);

  // Staggered entrance animations
  const fadeAnims = useRef(
    content.steps.map(() => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    content.steps.map(() => new Animated.Value(20))
  ).current;
  const headlineAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Animate headline first, then steps staggered
    Animated.timing(headlineAnim, {
      toValue: 1, duration: 300, useNativeDriver: true,
    }).start();

    content.steps.forEach((_, i) => {
      Animated.parallel([
        Animated.timing(fadeAnims[i], {
          toValue: 1, duration: 350, delay: 200 + i * 150, useNativeDriver: true,
        }),
        Animated.timing(slideAnims[i], {
          toValue: 0, duration: 350, delay: 200 + i * 150, useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  const handleDismiss = async () => {
    if (dismissed) return;
    setDismissed(true);
    haptics.success();
    await saveUserProfile({ hasSeenTutorial: true });
    navigation.replace('MainTabs');
  };

  const handleSkip = async () => {
    haptics.tap();
    await saveUserProfile({ hasSeenTutorial: true });
    navigation.replace('MainTabs');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Skip button */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm }}>
        <TouchableOpacity
          onPress={handleSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Skip tutorial"
          style={{ paddingVertical: 8, paddingHorizontal: 12 }}
        >
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textMuted }}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg }}>
        {/* Coach emoji + headline */}
        <Animated.View style={{ alignItems: 'center', marginBottom: 36, opacity: headlineAnim }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: coach.color + '15',
            borderWidth: 2, borderColor: coach.color + '30',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 30 }}>{coach.emoji}</Text>
          </View>
          <Text style={{
            fontSize: 22, fontWeight: '800', color: colors.textPrimary,
            textAlign: 'center', letterSpacing: -0.3, lineHeight: 28,
            paddingHorizontal: 10,
          }}>
            {content.headline}
          </Text>
        </Animated.View>

        {/* Steps */}
        {content.steps.map((step, i) => (
          <Animated.View
            key={i}
            style={{
              flexDirection: 'row', alignItems: 'flex-start',
              marginBottom: 20, paddingHorizontal: 4,
              opacity: fadeAnims[i],
              transform: [{ translateY: slideAnims[i] }],
            }}
          >
            {/* Step icon circle */}
            <View style={{
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: isDark ? coach.color + '10' : coach.color + '08',
              borderWidth: 1, borderColor: coach.color + '20',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 14, marginTop: 2,
            }}>
              <Text style={{ fontSize: 20 }}>{step.icon}</Text>
            </View>

            {/* Step text */}
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 15, fontWeight: '700', color: colors.textPrimary,
                marginBottom: 3,
              }}>
                {step.title}
              </Text>
              <Text style={{
                fontSize: 13, lineHeight: 19, color: colors.textSecondary,
              }}>
                {step.desc}
              </Text>
            </View>

            {/* Step number */}
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: colors.bgSubtle,
              alignItems: 'center', justifyContent: 'center',
              marginTop: 2, marginLeft: 8,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>
                {i + 1}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Footer CTA */}
      <View style={{
        paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, paddingTop: SPACING.md,
      }}>
        <TouchableOpacity
          style={{
            width: '100%', paddingVertical: 16, borderRadius: RADIUS.lg,
            backgroundColor: coach.color, alignItems: 'center',
            minHeight: 52,
          }}
          onPress={handleDismiss}
          disabled={dismissed}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={content.cta}
        >
          <Text style={{
            fontSize: 17, fontWeight: '800',
            color: getTextOnColor(coach.color),
          }}>
            {content.cta}
          </Text>
        </TouchableOpacity>

        <Text style={{
          fontSize: 11, color: colors.textDim, textAlign: 'center',
          marginTop: 10,
        }}>
          You can always change your coach in Settings
        </Text>
      </View>
    </SafeAreaView>
  );
}