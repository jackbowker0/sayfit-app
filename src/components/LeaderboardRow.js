// ============================================================
// LEADERBOARD ROW — Single entry in leaderboard
// Premium dark UI with Lucide icons and glass-morphism.
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Crown, Medal, Award } from 'lucide-react-native';
import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import { useTheme } from '../hooks/useTheme';
import { SPACING, FONT, GLOW } from '../constants/theme';

const RANK_COLORS = {
  1: '#FFD700',  // gold
  2: '#C0C0C0',  // silver
  3: '#CD7F32',  // bronze
};

function RankBadge({ rank, coachColor, textMuted }) {
  if (rank === 1) return <Crown size={20} color={RANK_COLORS[1]} fill={RANK_COLORS[1]} />;
  if (rank === 2) return <Medal size={20} color={RANK_COLORS[2]} />;
  if (rank === 3) return <Award size={20} color={RANK_COLORS[3]} />;
  return (
    <Text style={[styles.rankNumber, { color: textMuted }]}>{rank}</Text>
  );
}

export default function LeaderboardRow({ entry, onPress, isCurrentUser }) {
  const { colors, isDark } = useTheme();
  const profile = entry.profiles;
  const coach = COACHES[profile?.coach_id] || COACHES.hype;
  const CoachIcon = COACH_ICONS[coach.iconName] || COACH_ICONS.hype;

  return (
    <TouchableOpacity
      style={[styles.row, {
        backgroundColor: isCurrentUser
          ? (isDark ? coach.color + '10' : coach.color + '08')
          : 'transparent',
        borderBottomColor: colors.glassBorder,
        ...(isCurrentUser && isDark ? {
          borderLeftWidth: 2,
          borderLeftColor: coach.color,
        } : {}),
      }]}
      onPress={() => onPress?.(profile?.id)}
      activeOpacity={0.7}
    >
      <View style={styles.rankWrap}>
        <RankBadge rank={entry.rank} coachColor={coach.color} textMuted={colors.textMuted} />
      </View>

      <View style={[styles.avatar, {
        backgroundColor: coach.color + '20',
        borderColor: entry.rank <= 3 ? (RANK_COLORS[entry.rank] + '40') : colors.glassBorder,
        borderWidth: entry.rank <= 3 ? 1.5 : 1,
      }]}>
        <CoachIcon size={14} color={coach.color} />
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {profile?.display_name || profile?.username || 'User'}
          {isCurrentUser && ' (You)'}
        </Text>
        <Text style={[styles.stats, { color: colors.textMuted }]}>
          {entry.total_calories > 0 ? `${entry.total_calories} cal · ` : ''}{entry.workout_count} workouts
        </Text>
      </View>

      <View style={styles.countBox}>
        <Text style={[styles.countValue, {
          color: coach.color,
          ...(isDark && entry.rank <= 3 ? {
            textShadowColor: coach.color + '40',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: GLOW.sm,
          } : {}),
        }]}>{entry.workout_count}</Text>
        <Text style={[styles.countLabel, { color: colors.textMuted }]}>WO</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
  },
  rankWrap: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    ...FONT.subhead,
    fontSize: 16,
    fontWeight: '800',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: {
    ...FONT.subhead,
    fontSize: 15,
    fontWeight: '600',
  },
  stats: {
    ...FONT.caption,
    marginTop: 1,
  },
  countBox: { alignItems: 'center' },
  countValue: {
    ...FONT.stat,
    fontSize: 20,
    fontWeight: '900',
  },
  countLabel: {
    ...FONT.label,
    fontSize: 8,
  },
});
