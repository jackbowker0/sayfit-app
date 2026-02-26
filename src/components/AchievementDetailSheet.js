// ============================================================
// ACHIEVEMENT DETAIL SHEET — Bottom sheet for badge details
//
// Shows: emoji, name, tier, when earned, coach reaction,
// progress toward next tier (if applicable).
// Follows the spring-animated Modal pattern used elsewhere.
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Animated,
  Dimensions, StyleSheet, Platform,
} from 'react-native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { TIER_CONFIG } from '../services/achievements';
import * as haptics from '../services/haptics';

const { height: SCREEN_H } = Dimensions.get('window');

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

export default function AchievementDetailSheet({ badge, visible, onClose }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      haptics.tap();
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 28,
          stiffness: 300,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: SCREEN_H,
          damping: 28,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!badge) return null;

  const tier = TIER_CONFIG[badge.tier] || TIER_CONFIG.bronze;
  const isEarned = !!badge.earned;
  const earnedDate = badge.earnedAt
    ? new Date(badge.earnedAt).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  // Coach reaction
  const coachMessage = badge.coachMessages?.[coachId] || '';

  // Next tier info
  const currentTierIndex = TIER_ORDER.indexOf(badge.tier);
  const nextTier = currentTierIndex < TIER_ORDER.length - 1
    ? TIER_ORDER[currentTierIndex + 1]
    : null;
  const nextTierConfig = nextTier ? TIER_CONFIG[nextTier] : null;

  // Progress info (if badge has progress data from getAllAchievementsWithStatus)
  const progress = badge.progress || null;
  const threshold = badge.threshold || null;
  const progressPct = progress != null && threshold
    ? Math.min(progress / threshold, 1)
    : null;

  const handleClose = () => {
    haptics.tick();
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      {/* Overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: overlayAnim }]}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.bgElevated || colors.bgCard,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: Platform.OS === 'ios' ? 40 : 24,
          transform: [{ translateY: slideAnim }],
          ...(!isDark ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 10,
          } : {}),
        }}
      >
        {/* Drag indicator */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 8 }}>
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: colors.textMuted + '40',
          }} />
        </View>

        <View style={{ paddingHorizontal: SPACING.lg, paddingTop: 8 }}>
          {/* Badge icon */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: isEarned ? tier.glow : colors.bgSubtle,
              borderWidth: 2.5,
              borderColor: isEarned ? tier.color : colors.border,
              alignItems: 'center', justifyContent: 'center',
              ...(isEarned ? {
                shadowColor: tier.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
              } : {}),
            }}>
              <Text style={{
                fontSize: 36,
                opacity: isEarned ? 1 : 0.3,
              }}>{badge.emoji}</Text>
            </View>

            {/* Name */}
            <Text style={{
              fontSize: 22, fontWeight: '800',
              color: isEarned ? colors.textPrimary : colors.textMuted,
              marginTop: 14, textAlign: 'center',
            }}>
              {badge.name}
            </Text>

            {/* Tier pill */}
            <View style={{
              backgroundColor: isEarned ? tier.color + '20' : colors.bgSubtle,
              paddingHorizontal: 12, paddingVertical: 4,
              borderRadius: 12, marginTop: 6,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: isEarned ? tier.color : colors.textMuted,
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                {tier.label}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={{
            fontSize: 15, color: colors.textSecondary,
            textAlign: 'center', lineHeight: 22, marginBottom: 20,
          }}>
            {badge.description}
          </Text>

          {/* Earned date */}
          {isEarned && earnedDate && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, gap: 6,
            }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>Earned</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                {earnedDate}
              </Text>
              {badge.count > 1 && (
                <Text style={{ fontSize: 12, color: coach.color, fontWeight: '600' }}>
                  × {badge.count}
                </Text>
              )}
            </View>
          )}

          {/* Progress bar (for locked badges with progress data) */}
          {!isEarned && progressPct != null && (
            <View style={{ marginBottom: 20 }}>
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Progress</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                  {progress}/{threshold}
                </Text>
              </View>
              <View style={{
                height: 8, borderRadius: 4,
                backgroundColor: colors.bgSubtle,
                overflow: 'hidden',
              }}>
                <View style={{
                  height: '100%', borderRadius: 4,
                  backgroundColor: tier.color,
                  width: `${Math.round(progressPct * 100)}%`,
                }} />
              </View>
            </View>
          )}

          {/* Coach reaction */}
          {isEarned && coachMessage ? (
            <View style={{
              backgroundColor: isDark ? coach.color + '10' : coach.color + '06',
              borderRadius: RADIUS.lg,
              borderWidth: 1,
              borderColor: coach.color + '25',
              padding: SPACING.md,
              marginBottom: 8,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Text style={{ fontSize: 20 }}>{coach.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 11, fontWeight: '600', color: coach.color,
                    letterSpacing: 0.5, marginBottom: 4,
                  }}>
                    {coach.name.toUpperCase()} SAYS
                  </Text>
                  <Text style={{
                    fontSize: 14, color: colors.textSecondary,
                    lineHeight: 20, fontStyle: 'italic',
                  }}>
                    "{coachMessage}"
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Locked state message */}
          {!isEarned && (
            <View style={{
              backgroundColor: colors.bgSubtle,
              borderRadius: RADIUS.lg,
              padding: SPACING.md,
              marginBottom: 8,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
                🔒 Keep going — this badge is waiting for you!
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}