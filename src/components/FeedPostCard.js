// ============================================================
// FEED POST CARD — Single post in the social feed
//
// Shows user avatar/name, share card image, like/comment
// counts, and action buttons.
// Premium dark UI with Lucide icons and glass-morphism.
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
} from 'react-native';
import { Heart, MessageCircle, Flame } from 'lucide-react-native';
import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import { formatTime } from '../utils/helpers';
import GlassCard from '../components/GlassCard';
import * as haptics from '../services/haptics';

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

export default function FeedPostCard({
  post,
  isLiked,
  onLike,
  onUnlike,
  onComment,
  onUserPress,
  onPostPress,
}) {
  const { colors, isDark } = useTheme();
  const [liked, setLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);

  const profile = post.profiles;
  const coach = COACHES[post.coach_id] || COACHES.hype;
  const CoachIcon = COACH_ICONS[coach.iconName] || COACH_ICONS.hype;

  const handleLikeToggle = async () => {
    haptics.tap();
    if (liked) {
      setLiked(false);
      setLikeCount(c => c - 1);
      try { await onUnlike(post.id); } catch { setLiked(true); setLikeCount(c => c + 1); }
    } else {
      setLiked(true);
      setLikeCount(c => c + 1);
      try { await onLike(post.id); } catch { setLiked(false); setLikeCount(c => c - 1); }
    }
  };

  return (
    <GlassCard
      accentColor={coach.color}
      noPadding
      style={styles.card}
    >
      {/* Header: user info */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => onUserPress?.(profile?.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: coach.color + '20', borderColor: coach.color + '40' }]}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <CoachIcon size={18} color={coach.color} />
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.displayName, { color: colors.textPrimary }]}>
            {profile?.display_name || profile?.username || 'SayFit User'}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            @{profile?.username || 'user'} · {timeAgo(post.created_at)}
          </Text>
        </View>
        <View style={[styles.coachBadge, { backgroundColor: coach.color + '15' }]}>
          <CoachIcon size={14} color={coach.color} />
        </View>
      </TouchableOpacity>

      {/* Workout info */}
      <TouchableOpacity onPress={() => onPostPress?.(post)} activeOpacity={0.8}>
        {/* Share card image (if available) */}
        {post.share_card_image_url ? (
          <Image
            source={{ uri: post.share_card_image_url }}
            style={styles.shareImage}
            resizeMode="cover"
          />
        ) : (
          /* Fallback: text-based stats */
          <View style={[styles.statsCard, {
            backgroundColor: isDark ? colors.glassBg : colors.bgSubtle,
            borderColor: colors.glassBorder,
          }]}>
            <Text style={[styles.workoutName, { color: colors.textPrimary }]}>
              {post.workout_name || 'Workout'}
            </Text>
            <View style={styles.statsRow}>
              {post.duration_seconds > 0 && (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: coach.color }]}>
                    {formatTime(post.duration_seconds)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Time</Text>
                </View>
              )}
              {post.calories > 0 && (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: coach.color }]}>{post.calories}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Cals</Text>
                </View>
              )}
              {post.exercises_completed > 0 && (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: coach.color }]}>{post.exercises_completed}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Exercises</Text>
                </View>
              )}
              {post.total_sets > 0 && (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: coach.color }]}>{post.total_sets}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Sets</Text>
                </View>
              )}
            </View>
            {post.muscles?.length > 0 && (
              <Text style={[styles.musclesText, { color: colors.textMuted }]}>
                {post.muscles.join(' · ')}
              </Text>
            )}
          </View>
        )}

        {/* Caption */}
        {post.caption && (
          <Text style={[styles.caption, { color: colors.textPrimary }]}>
            {post.caption}
          </Text>
        )}
      </TouchableOpacity>

      {/* Action bar */}
      <View style={[styles.actionBar, { borderTopColor: colors.glassBorder }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLikeToggle}>
          <Heart
            size={18}
            color={liked ? '#FF4136' : colors.textMuted}
            fill={liked ? '#FF4136' : 'none'}
          />
          <Text style={[styles.actionCount, { color: liked ? '#FF4136' : colors.textMuted }]}>
            {likeCount > 0 ? likeCount : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment?.(post)}>
          <MessageCircle size={18} color={colors.textMuted} />
          <Text style={[styles.actionCount, { color: colors.textMuted }]}>
            {post.comment_count > 0 ? post.comment_count : ''}
          </Text>
        </TouchableOpacity>

        {post.streak >= 2 && (
          <View style={styles.actionBtn}>
            <Flame size={18} color={colors.orange} />
            <Text style={[styles.actionCount, { color: colors.orange }]}>{post.streak}</Text>
          </View>
        )}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerText: {
    flex: 1,
  },
  displayName: {
    ...FONT.subhead,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    ...FONT.caption,
    marginTop: 1,
  },
  coachBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareImage: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  statsCard: {
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  workoutName: {
    ...FONT.subhead,
    fontSize: 17,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...FONT.stat,
    fontSize: 20,
  },
  statLabel: {
    ...FONT.caption,
    fontSize: 10,
    marginTop: 2,
  },
  musclesText: {
    ...FONT.caption,
  },
  caption: {
    ...FONT.body,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  actionBar: {
    flexDirection: 'row',
    padding: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionCount: {
    ...FONT.caption,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
