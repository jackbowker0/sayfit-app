// ============================================================
// FOLLOW BUTTON — Follow/unfollow toggle
// Premium dark UI with Lucide icons and glass-morphism.
// ============================================================

import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Check, CircleUser } from 'lucide-react-native';
import { RADIUS, FONT, GLOW } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { followUser, unfollowUser } from '../services/profiles';
import { capture } from '../services/posthog';
import * as haptics from '../services/haptics';

export default function FollowButton({ userId, initialFollowing = false, coachColor = '#7FDBFF' }) {
  const { colors, isDark } = useTheme();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (loading) return;
    haptics.tap();
    setLoading(true);
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
        capture('user_unfollowed');
      } else {
        await followUser(userId);
        setFollowing(true);
        capture('user_followed');
      }
    } catch (e) {
      console.warn('[FollowButton] Toggle failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        following
          ? {
              backgroundColor: isDark ? colors.glassBg : 'transparent',
              borderWidth: 1.5,
              borderColor: isDark ? colors.glassBorder : colors.border,
            }
          : {
              backgroundColor: coachColor,
              ...(isDark ? {
                shadowColor: coachColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.25,
                shadowRadius: GLOW.sm,
                elevation: 3,
              } : {}),
            },
      ]}
      onPress={handleToggle}
      disabled={loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={following ? colors.textMuted : '#fff'} size="small" />
      ) : (
        <View style={styles.inner}>
          {following ? (
            <Check size={14} color={colors.textSecondary} />
          ) : (
            <CircleUser size={14} color="#fff" />
          )}
          <Text style={[styles.text, {
            color: following ? colors.textSecondary : '#fff',
          }]}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  text: {
    ...FONT.caption,
    fontSize: 14,
    fontWeight: '700',
  },
});
