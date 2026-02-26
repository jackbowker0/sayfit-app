// ============================================================
// PROFILE BADGES — Achievement badges displayed on user profiles
//
// Shows earned achievement badges as a horizontal strip.
// Tappable badges with tier-colored borders and Lucide icons.
// Premium dark UI with glass-morphism.
// ============================================================

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import { ACHIEVEMENTS, TIER_CONFIG, getEarnedAchievements } from '../services/achievements';
import { getTierIcon, getAchievementIcon } from '../constants/icons';

/**
 * Shows achievement badges for a profile.
 * For own profile: reads from local AsyncStorage.
 * For other users: pass earnedBadgeIds prop (from Supabase profile).
 */
export default function ProfileBadges({ earnedBadgeIds, onBadgePress, maxDisplay = 6 }) {
  const { colors, isDark } = useTheme();
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    loadBadges();
  }, [earnedBadgeIds]);

  const loadBadges = async () => {
    if (earnedBadgeIds) {
      // From Supabase profile (other users)
      const earned = earnedBadgeIds
        .filter(id => ACHIEVEMENTS[id])
        .map(id => ({ ...ACHIEVEMENTS[id], earned: true }));
      setBadges(earned);
    } else {
      // Own profile — read from AsyncStorage
      const earned = await getEarnedAchievements();
      const badgeList = Object.keys(earned)
        .filter(id => ACHIEVEMENTS[id])
        .map(id => ({
          ...ACHIEVEMENTS[id],
          earned: true,
          earnedAt: earned[id].earnedAt || earned[id].firstEarned,
        }))
        .sort((a, b) => {
          const tierOrder = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
          return (tierOrder[a.tier] || 3) - (tierOrder[b.tier] || 3);
        });
      setBadges(badgeList);
    }
  };

  if (badges.length === 0) return null;

  const displayBadges = badges.slice(0, maxDisplay);
  const remaining = badges.length - maxDisplay;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>BADGES</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {displayBadges.map((badge) => {
          const tier = TIER_CONFIG[badge.tier] || TIER_CONFIG.bronze;
          const TierIcon = getTierIcon(badge.tier);
          const BadgeIcon = getAchievementIcon(badge.category);
          return (
            <TouchableOpacity
              key={badge.id}
              style={[styles.badge, {
                backgroundColor: isDark ? tier.glow : tier.glow,
                borderColor: tier.color,
                ...(isDark ? {
                  shadowColor: tier.color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: GLOW.sm,
                  elevation: 3,
                } : {}),
              }]}
              onPress={() => onBadgePress?.(badge)}
              activeOpacity={0.7}
            >
              <BadgeIcon size={18} color={tier.color} />
            </TouchableOpacity>
          );
        })}
        {remaining > 0 && (
          <View style={[styles.moreBadge, {
            backgroundColor: isDark ? colors.glassBg : colors.bgSubtle,
            borderColor: colors.glassBorder,
            borderWidth: 1,
          }]}>
            <Text style={[styles.moreText, { color: colors.textMuted }]}>+{remaining}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
    width: '100%',
  },
  sectionLabel: {
    ...FONT.label,
    fontSize: 10,
    marginBottom: 8,
    marginLeft: 2,
  },
  scroll: {
    gap: 8,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    ...FONT.caption,
    fontSize: 12,
    fontWeight: '700',
  },
});
