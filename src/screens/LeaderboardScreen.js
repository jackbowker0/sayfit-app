// ============================================================
// LEADERBOARD SCREEN — Weekly / monthly rankings
// Premium dark glass-morphism UI with Lucide icons.
// ============================================================

import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FadeInView from '../components/FadeInView';
import { ChevronLeft, Trophy, Calendar, Clock } from 'lucide-react-native';

import { AuthContext } from '../context/AuthContext';
import LeaderboardRow from '../components/LeaderboardRow';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, TIMING } from '../constants/theme';
import { getLeaderboard } from '../services/challenges';
import { capture } from '../services/posthog';
import * as haptics from '../services/haptics';

const PERIOD_TABS = [
  { key: 'weekly', label: 'This Week', Icon: Clock },
  { key: 'monthly', label: 'This Month', Icon: Calendar },
];

export default function LeaderboardScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { colors, isDark } = useTheme();

  const [period, setPeriod] = useState('weekly');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sliding tab indicator
  const tabIndex = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  useEffect(() => {
    loadLeaderboard();
    capture('leaderboard_viewed', { period });
  }, [period]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard(period);
      setEntries(data);
    } catch (e) {
      console.warn('[Leaderboard] Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Leaderboard</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Glass period toggle */}
      <View style={styles.tabBarOuter}>
        <View
          style={[styles.tabBar, {
            backgroundColor: colors.glassBg,
            borderColor: colors.glassBorder,
          }]}
          onLayout={(e) => setTabWidth(e.nativeEvent.layout.width / PERIOD_TABS.length)}
        >
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                width: tabWidth,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                transform: [{ translateX: tabIndex }],
              },
            ]}
          />
          {PERIOD_TABS.map((p, i) => (
            <TouchableOpacity
              key={p.key}
              style={styles.tab}
              onPress={() => {
                haptics.tick();
                Animated.timing(tabIndex, { toValue: i * tabWidth, duration: TIMING.normal, useNativeDriver: true }).start();
                setPeriod(p.key);
              }}
            >
              <p.Icon
                size={14}
                color={period === p.key ? colors.textPrimary : colors.textMuted}
                strokeWidth={period === p.key ? 2.2 : 1.8}
              />
              <Text style={[styles.tabText, {
                color: period === p.key ? colors.textPrimary : colors.textMuted,
                fontWeight: period === p.key ? '700' : '500',
              }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textMuted} size="large" />
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={({ item, index }) => (
            <FadeInView delay={index * 50}>
              <LeaderboardRow
                entry={item}
                isCurrentUser={item.user_id === user?.id}
                onPress={(userId) => navigation.navigate('UserProfile', { userId })}
              />
            </FadeInView>
          )}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <FadeInView delay={100}>
              <GlassCard style={styles.emptyCard}>
                <Trophy size={48} color={colors.textMuted} strokeWidth={1.2} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No entries yet</Text>
                <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                  Share workouts to the feed to appear on the leaderboard!
                </Text>
              </GlassCard>
            </FadeInView>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  backText: { ...FONT.body, fontWeight: '500' },
  title: { ...FONT.heading, textAlign: 'center' },
  tabBarOuter: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: RADIUS.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabText: { ...FONT.caption },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginTop: 40,
    marginHorizontal: SPACING.md,
  },
  emptyTitle: { ...FONT.heading, marginTop: SPACING.md, marginBottom: SPACING.sm },
  emptyBody: { ...FONT.body, textAlign: 'center' },
});
