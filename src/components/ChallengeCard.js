// ============================================================
// CHALLENGE CARD — Preview card for challenges list
// Premium dark UI with Lucide icons and glass-morphism.
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Dumbbell, Flame, Target, ChevronRight, Users, Clock } from 'lucide-react-native';
import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import GlassCard from '../components/GlassCard';

const TYPE_CONFIG = {
  workout_count: { Icon: Dumbbell, label: 'Workouts', unit: 'workouts' },
  calorie_burn: { Icon: Flame, label: 'Calories', unit: 'cals' },
  streak: { Icon: Flame, label: 'Streak', unit: 'days' },
  specific_workout: { Icon: Target, label: 'Specific', unit: 'times' },
};

function daysLeft(endDate) {
  const diff = Math.ceil((new Date(endDate) - Date.now()) / 86400000);
  if (diff <= 0) return 'Ended';
  if (diff === 1) return '1 day left';
  return `${diff} days left`;
}

export default function ChallengeCard({ challenge, onPress, currentUserId }) {
  const { colors, isDark } = useTheme();
  const creator = challenge.profiles;
  const coach = COACHES[creator?.coach_id] || COACHES.hype;
  const typeConfig = TYPE_CONFIG[challenge.challenge_type] || TYPE_CONFIG.workout_count;
  const TypeIcon = typeConfig.Icon;

  const participants = challenge.challenge_participants || [];
  const myParticipation = participants.find(p => p.user_id === currentUserId);
  const progress = myParticipation?.progress || 0;
  const progressPct = Math.min(progress / challenge.target_value, 1);
  const isJoined = !!myParticipation;

  return (
    <TouchableOpacity
      onPress={() => onPress?.(challenge)}
      activeOpacity={0.7}
    >
      <GlassCard
        accentColor={coach.color}
        glow={isJoined}
        style={styles.card}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.typeIconWrap, { backgroundColor: coach.color + '15' }]}>
            <TypeIcon size={22} color={coach.color} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {challenge.title}
            </Text>
            <View style={styles.metaRow}>
              <Users size={11} color={colors.textMuted} />
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {creator?.display_name || creator?.username || 'Unknown'} · {participants.length} joined
              </Text>
            </View>
          </View>
          <View style={styles.daysLeftWrap}>
            <Clock size={11} color={coach.color} />
            <Text style={[styles.daysLeft, { color: coach.color }]}>{daysLeft(challenge.end_date)}</Text>
          </View>
        </View>

        {/* Target */}
        <View style={styles.targetRow}>
          <Text style={[styles.targetLabel, { color: colors.textSecondary }]}>
            Goal: {challenge.target_value} {typeConfig.unit}
          </Text>
          {isJoined && (
            <Text style={[styles.progressText, { color: coach.color }]}>
              {progress}/{challenge.target_value}
            </Text>
          )}
        </View>

        {/* Progress bar (only if joined) */}
        {isJoined && (
          <View style={[styles.progressBar, { backgroundColor: colors.bgSubtle }]}>
            <View style={[styles.progressFill, {
              backgroundColor: coach.color,
              width: `${progressPct * 100}%`,
              ...(isDark ? {
                shadowColor: coach.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: GLOW.sm,
              } : {}),
            }]} />
          </View>
        )}

        {/* Join indicator */}
        {!isJoined && (
          <View style={[styles.joinBadge, { backgroundColor: coach.color + '15' }]}>
            <Text style={[styles.joinText, { color: coach.color }]}>Tap to view</Text>
            <ChevronRight size={12} color={coach.color} />
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: {
    ...FONT.subhead,
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    ...FONT.caption,
  },
  daysLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  daysLeft: {
    ...FONT.caption,
    fontWeight: '600',
  },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  targetLabel: {
    ...FONT.caption,
    fontSize: 13,
  },
  progressText: {
    ...FONT.stat,
    fontSize: 14,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  joinBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  joinText: {
    ...FONT.caption,
    fontWeight: '600',
  },
});
