// ============================================================
// ACHIEVEMENTS SCREEN — Full badge grid with categories
//
// Shows all 22 achievements: unlocked with glow, locked greyed
// out with progress bars, organized by category.
// Coach reacts to your collection at the top.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  getAllAchievementsWithStatus,
  getAchievementStats,
  TIER_CONFIG,
} from '../services/achievements';
import * as haptics from '../services/haptics';
import AchievementDetailSheet from '../components/AchievementDetailSheet';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = SPACING.lg;
const CARD_W = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

const CATEGORY_META = {
  start: { label: 'Getting Started', emoji: '🏁', order: 0 },
  consistency: { label: 'Consistency', emoji: '🔥', order: 1 },
  strength: { label: 'Strength', emoji: '💪', order: 2 },
  volume: { label: 'Volume', emoji: '📊', order: 3 },
  smart: { label: 'Smart Training', emoji: '🧠', order: 4 },
};

export default function AchievementsScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    loadAchievements();
  }, []));

  const loadAchievements = async () => {
    setLoading(true);
    const all = await getAllAchievementsWithStatus();
    const s = await getAchievementStats();
    setAchievements(all);
    setStats(s);
    setLoading(false);
  };

  const openDetail = (badge) => {
    haptics.tap();
    setSelectedBadge(badge);
    setDetailVisible(true);
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setTimeout(() => setSelectedBadge(null), 250);
  };

  // Group by category
  const grouped = {};
  achievements.forEach(a => {
    const cat = a.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });

  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (CATEGORY_META[a]?.order ?? 99) - (CATEGORY_META[b]?.order ?? 99)
  );

  // Coach collection commentary
  const getCollectionComment = () => {
    if (!stats) return '';
    const pct = stats.percentage;
    if (pct === 0) return {
      drill: "Zero badges. That's about to change.",
      hype: "Your badge wall is EMPTY! Let's fill it up! ✨",
      zen: "An empty canvas. Every badge awaits your journey.",
    }[coachId];
    if (pct < 25) return {
      drill: "Just getting started. Push harder.",
      hype: "Great start! So many badges to unlock! 🔥",
      zen: "The first seeds are planted. Growth will follow.",
    }[coachId];
    if (pct < 50) return {
      drill: "Solid progress. Don't get comfortable.",
      hype: "Look at that collection GROWING! Keep it up! 💪",
      zen: "A garden taking shape. Patience and persistence.",
    }[coachId];
    if (pct < 75) return {
      drill: "Impressive. Now finish the job.",
      hype: "OVER HALF! You're a badge MACHINE! 🏆",
      zen: "More than half revealed. A dedicated spirit.",
    }[coachId];
    if (pct < 100) return {
      drill: "Almost complete. No stopping now.",
      hype: "SO CLOSE to getting them ALL! 🤩",
      zen: "Nearly complete. The final badges beckon.",
    }[coachId];
    return {
      drill: "Every. Single. Badge. RESPECT.",
      hype: "YOU GOT THEM ALL!! LEGENDARY!! 🏆🎉💎",
      zen: "Complete mastery. A beautiful collection.",
    }[coachId];
  };

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={coach.color} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: SPACING.lg, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity
          onPress={() => { haptics.tick(); navigation.goBack(); }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={{ fontSize: 16, color: coach.color, fontWeight: '600' }}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>
            Achievements
          </Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: GRID_PADDING, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadAchievements(); setRefreshing(false); }} tintColor={coach.color} />}
      >
        {/* Coach header card */}
        <View style={{
          backgroundColor: isDark ? coach.color + '10' : coach.color + '06',
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: coach.color + '25',
          padding: SPACING.md,
          marginBottom: 24,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 28 }}>{coach.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 14, color: colors.textSecondary, lineHeight: 20,
              }}>
                {getCollectionComment()}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                <View style={{
                  flex: 1, height: 6, borderRadius: 3,
                  backgroundColor: colors.bgSubtle, overflow: 'hidden',
                }}>
                  <View style={{
                    height: '100%', borderRadius: 3,
                    backgroundColor: coach.color,
                    width: `${stats?.percentage || 0}%`,
                  }} />
                </View>
                <Text style={{
                  fontSize: 13, fontWeight: '700', color: coach.color,
                  minWidth: 50, textAlign: 'right',
                }}>
                  {stats?.unlocked || 0}/{stats?.total || 0}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Category sections */}
        {sortedCategories.map(catKey => {
          const meta = CATEGORY_META[catKey] || { label: catKey, emoji: '🏅' };
          const badges = grouped[catKey];

          return (
            <View key={catKey} style={{ marginBottom: 28 }}>
              {/* Category header */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                marginBottom: 14,
              }}>
                <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
                <Text style={{
                  fontSize: 12, fontWeight: '700', color: colors.textMuted,
                  letterSpacing: 1.2, textTransform: 'uppercase',
                }}>
                  {meta.label}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textDim, marginLeft: 4 }}>
                  {badges.filter(b => b.earned).length}/{badges.length}
                </Text>
              </View>

              {/* Badge grid */}
              <View style={{
                flexDirection: 'row', flexWrap: 'wrap',
                gap: GRID_GAP,
              }}>
                {badges.map(badge => {
                  const tier = TIER_CONFIG[badge.tier] || TIER_CONFIG.bronze;
                  const isEarned = badge.earned;

                  return (
                    <TouchableOpacity
                      key={badge.id}
                      style={{
                        width: CARD_W,
                        backgroundColor: colors.bgCard,
                        borderRadius: RADIUS.lg,
                        borderWidth: 1,
                        borderColor: isEarned ? tier.color + '40' : colors.border,
                        padding: 12,
                        alignItems: 'center',
                        ...(isEarned && !isDark ? {
                          shadowColor: tier.color,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.2,
                          shadowRadius: 8,
                          elevation: 3,
                        } : {}),
                        ...(isEarned && isDark ? {
                          shadowColor: tier.color,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.3,
                          shadowRadius: 10,
                        } : {}),
                      }}
                      onPress={() => openDetail(badge)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`${badge.name}, ${tier.label} tier, ${isEarned ? 'earned' : 'locked'}`}
                    >
                      {/* Emoji circle */}
                      <View style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: isEarned ? tier.glow : colors.bgSubtle,
                        borderWidth: 1.5,
                        borderColor: isEarned ? tier.color : colors.border,
                        alignItems: 'center', justifyContent: 'center',
                        marginBottom: 8,
                      }}>
                        <Text style={{
                          fontSize: 20,
                          opacity: isEarned ? 1 : 0.25,
                        }}>
                          {badge.emoji}
                        </Text>
                      </View>

                      {/* Name */}
                      <Text
                        style={{
                          fontSize: 11, fontWeight: '700',
                          color: isEarned ? colors.textPrimary : colors.textMuted,
                          textAlign: 'center', marginBottom: 3,
                        }}
                        numberOfLines={1}
                      >
                        {badge.name}
                      </Text>

                      {/* Tier label */}
                      <Text style={{
                        fontSize: 8, fontWeight: '700',
                        color: isEarned ? tier.color : colors.textDim,
                        letterSpacing: 0.8, textTransform: 'uppercase',
                      }}>
                        {tier.label}
                      </Text>

                      {/* Locked indicator */}
                      {!isEarned && (
                        <Text style={{
                          fontSize: 8, color: colors.textDim, marginTop: 4,
                        }}>
                          🔒
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Detail sheet */}
      <AchievementDetailSheet
        badge={selectedBadge}
        visible={detailVisible}
        onClose={closeDetail}
      />
    </SafeAreaView>
  );
}