// ============================================================
// SHARE CARD — Post-workout shareable image card (THEMED)
//
// A beautifully styled card that captures workout stats,
// coach quote, and muscle groups into a shareable image.
// Now supports light/dark mode while keeping the captured
// image always dark-themed (looks better when shared).
// Every share = free marketing for SayFit.
// ============================================================

import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { COACHES } from '../constants/coaches';
import { RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { formatTime } from '../utils/helpers';

// Muscle group emoji map
const MUSCLE_EMOJI = {
  Legs: '🦵',
  Chest: '💪',
  Core: '🔥',
  Back: '🦸',
  Shoulders: '🔺',
  Glutes: '🍑',
  Arms: '💪',
  Cardio: '🏃',
  'Full Body': '🫀',
};

// ---- Share card always uses dark theme for the captured image ----
// This looks better when shared on social media regardless of user's theme
const CARD_COLORS = {
  bg: '#0A0A0F',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
  textDim: 'rgba(255,255,255,0.25)',
  textBody: 'rgba(255,255,255,0.8)',
  border: 'rgba(255,255,255,0.07)',
  cardBg: 'rgba(255,255,255,0.024)',
};

/**
 * Get a coach-specific share quote based on workout stats
 */
function getShareQuote(coachId, stats, elapsed) {
  const mins = Math.floor(elapsed / 60);

  if (coachId === 'drill') {
    if (stats.adaptations >= 3) return "Adapted and overcame. That's a warrior.";
    if (stats.calories >= 100) return `${stats.calories} calories destroyed. No mercy.`;
    if (mins >= 20) return `${mins} minutes. No shortcuts. EARNED.`;
    return "Another one in the books. Respect.";
  }

  if (coachId === 'hype') {
    if (stats.adaptations >= 3) return `${stats.adaptations} adaptations?! You listened to your body AND crushed it! 🔥`;
    if (stats.calories >= 100) return `${stats.calories} calories gone! You're literally on FIRE! ⚡`;
    if (mins >= 20) return `${mins} minutes of pure MAGIC! You're unstoppable! ✨`;
    return "Another workout CRUSHED! You're amazing! 🎉";
  }

  // zen
  if (stats.adaptations >= 3) return "Your body guided you wisely. Beautiful practice.";
  if (mins >= 20) return `${mins} minutes of mindful movement. Your dedication inspires.`;
  return "Movement completed with intention. Namaste.";
}

export default function ShareCard({
  coachId,
  stats,
  elapsed,
  exercises,
  workoutName,
  streak,
}) {
  const cardRef = useRef();
  const [sharing, setSharing] = useState(false);
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const muscles = [...new Set((exercises || []).map(e => e.muscle).filter(Boolean))];
  const quote = getShareQuote(coachId, stats, elapsed);

  const handleShare = async () => {
    try {
      setSharing(true);
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
      });
      await Sharing.shareAsync(`file://${uri}`, {
        mimeType: 'image/png',
        dialogTitle: 'Share your SayFit workout',
      });
    } catch (e) {
      console.warn('[ShareCard] Share failed:', e);
    } finally {
      setSharing(false);
    }
  };

  // The share button uses theme colors so it fits the current UI
  const btnTextColor = getTextOnColor(coach.color);

  return (
    <View style={styles.wrapper}>
      {/* ---- THE CARD (always dark — gets captured as image) ---- */}
      <View ref={cardRef} style={styles.card} collapsable={false}>
        {/* Top accent bar */}
        <View style={[styles.topBar, { backgroundColor: coach.color }]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>SAYFIT</Text>
            <Text style={styles.brandDot}>•</Text>
            <Text style={styles.coachLabel}>{coach.emoji} {coach.name}</Text>
          </View>
          <Text style={styles.workoutName}>{workoutName || 'Workout Complete'}</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: coach.color }]}>{formatTime(elapsed)}</Text>
            <Text style={styles.statLabel}>TIME</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: coach.color + '30' }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: coach.color }]}>{stats.calories}</Text>
            <Text style={styles.statLabel}>CALS</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: coach.color + '30' }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: coach.color }]}>{stats.exercisesCompleted}</Text>
            <Text style={styles.statLabel}>EXERCISES</Text>
          </View>
          {stats.adaptations > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: coach.color + '30' }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: coach.color }]}>{stats.adaptations}</Text>
                <Text style={styles.statLabel}>ADAPTED</Text>
              </View>
            </>
          )}
        </View>

        {/* Muscle Chips */}
        {muscles.length > 0 && (
          <View style={styles.muscleRow}>
            {muscles.map(m => (
              <View key={m} style={[styles.muscleChip, { borderColor: coach.color + '50' }]}>
                <Text style={styles.muscleChipText}>
                  {MUSCLE_EMOJI[m] || '💪'} {m}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Coach Quote */}
        <View style={[styles.quoteBox, { borderLeftColor: coach.color }]}>
          <Text style={styles.quoteText}>"{quote}"</Text>
          <Text style={[styles.quoteSig, { color: coach.color }]}>— {coach.name}</Text>
        </View>

        {/* Streak badge */}
        {streak >= 2 && (
          <View style={[styles.streakBadge, { backgroundColor: coach.color + '15', borderColor: coach.color + '30' }]}>
            <Text style={styles.streakText}>🔥 {streak}-day streak</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Built with SayFit — AI fitness coaching that adapts to you</Text>
        </View>
      </View>

      {/* ---- SHARE BUTTON (themed to match current UI) ---- */}
      <TouchableOpacity
        style={[styles.shareBtn, {
          backgroundColor: coach.color,
          // In light mode, add subtle shadow
          ...(!isDark ? {
            shadowColor: coach.color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          } : {}),
        }]}
        onPress={handleShare}
        activeOpacity={0.8}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator color={btnTextColor} />
        ) : (
          <Text style={[styles.shareBtnText, { color: btnTextColor }]}>📤 Share Workout</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginBottom: 16 },

  // ---- THE CARD (always dark for sharing) ----
  card: {
    backgroundColor: CARD_COLORS.bg,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CARD_COLORS.border,
  },
  topBar: {
    height: 4,
    width: '100%',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '900',
    color: CARD_COLORS.textSecondary,
    letterSpacing: 3,
  },
  brandDot: {
    fontSize: 13,
    color: CARD_COLORS.textDim,
    marginHorizontal: 8,
  },
  coachLabel: {
    fontSize: 13,
    color: CARD_COLORS.textSecondary,
    fontWeight: '600',
  },
  workoutName: {
    fontSize: 22,
    fontWeight: '800',
    color: CARD_COLORS.textPrimary,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: CARD_COLORS.textMuted,
  },

  // ---- STATS ----
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    backgroundColor: CARD_COLORS.cardBg,
    borderRadius: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 9,
    color: CARD_COLORS.textMuted,
    letterSpacing: 1.5,
    marginTop: 3,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 30,
  },

  // ---- MUSCLES ----
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: CARD_COLORS.cardBg,
  },
  muscleChipText: {
    fontSize: 11,
    color: CARD_COLORS.textBody,
    fontWeight: '500',
  },

  // ---- COACH QUOTE ----
  quoteBox: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingLeft: 14,
    borderLeftWidth: 3,
  },
  quoteText: {
    fontSize: 14,
    color: CARD_COLORS.textBody,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  quoteSig: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },

  // ---- STREAK ----
  streakBadge: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  streakText: {
    fontSize: 12,
    color: CARD_COLORS.textBody,
    fontWeight: '600',
  },

  // ---- FOOTER ----
  footer: {
    padding: 16,
    paddingTop: 18,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: CARD_COLORS.textDim,
    letterSpacing: 0.5,
  },

  // ---- SHARE BUTTON ----
  shareBtn: {
    marginTop: 12,
    padding: 16,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});