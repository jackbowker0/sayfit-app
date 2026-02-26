// ============================================================
// CHALLENGE DETAIL SCREEN — Single challenge view
//
// Shows challenge info, participant list with progress bars,
// and join/leave actions.
// Premium dark glass-morphism UI with Lucide icons.
// ============================================================

import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FadeInView from '../components/FadeInView';
import {
  ChevronLeft, Dumbbell, Flame, Calendar, Target,
  Crown, Medal, Award, Check, Users,
} from 'lucide-react-native';

import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import GlassCard from '../components/GlassCard';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import { getChallengeDetail, joinChallenge, leaveChallenge } from '../services/challenges';
import * as haptics from '../services/haptics';

const TYPE_CONFIG = {
  workout_count: { Icon: Dumbbell, unit: 'workouts' },
  calorie_burn: { Icon: Flame, unit: 'calories' },
  streak: { Icon: Calendar, unit: 'days' },
  specific_workout: { Icon: Target, unit: 'times' },
};

const RANK_ICONS = [Crown, Medal, Award];
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function daysLeft(endDate) {
  const diff = Math.ceil((new Date(endDate) - Date.now()) / 86400000);
  if (diff <= 0) return 'Challenge ended';
  if (diff === 1) return '1 day remaining';
  return `${diff} days remaining`;
}

export default function ChallengeDetailScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const { colors, isDark } = useTheme();
  const { challengeId } = route.params;

  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadChallenge();
  }, []);

  const loadChallenge = async () => {
    try {
      const data = await getChallengeDetail(challengeId);
      setChallenge(data);
    } catch (e) {
      console.warn('[ChallengeDetail] Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !challenge) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.textMuted} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const creator = challenge.profiles;
  const coach = COACHES[creator?.coach_id] || COACHES.hype;
  const typeConfig = TYPE_CONFIG[challenge.challenge_type] || TYPE_CONFIG.workout_count;
  const TypeIcon = typeConfig.Icon;
  const participants = (challenge.challenge_participants || [])
    .sort((a, b) => b.progress - a.progress);
  const isJoined = participants.some(p => p.user_id === user?.id);
  const isCreator = challenge.creator_id === user?.id;

  const handleJoin = async () => {
    setActionLoading(true);
    try {
      await joinChallenge(challengeId);
      haptics.success();
      loadChallenge();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not join challenge.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    Alert.alert('Leave Challenge', 'Are you sure you want to leave this challenge?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          setActionLoading(true);
          try {
            await leaveChallenge(challengeId);
            haptics.tap();
            loadChallenge();
          } catch (e) {
            Alert.alert('Failed', e?.message || 'Could not leave challenge.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const renderParticipant = ({ item, index }) => {
    const p = item;
    const pProfile = p.profiles;
    const pCoach = COACHES[pProfile?.coach_id] || COACHES.hype;
    const PCoachIcon = COACH_ICONS[pCoach.iconName] || COACH_ICONS.hype;
    const progressPct = Math.min(p.progress / challenge.target_value, 1);
    const isCompleted = p.status === 'completed';

    // Rank display
    const RankIcon = index < 3 ? RANK_ICONS[index] : null;
    const rankColor = index < 3 ? RANK_COLORS[index] : colors.textMuted;

    return (
      <FadeInView delay={200 + index * 50}>
        <View style={[styles.participantRow, {
          backgroundColor: colors.glassBg,
          borderColor: colors.glassBorder,
        }]}>
          {/* Rank */}
          <View style={styles.rankContainer}>
            {RankIcon ? (
              <RankIcon size={18} color={rankColor} strokeWidth={2} />
            ) : (
              <Text style={[styles.rank, { color: colors.textMuted }]}>{index + 1}</Text>
            )}
          </View>

          {/* Avatar */}
          <View style={[styles.pAvatar, { backgroundColor: pCoach.color + '20' }]}>
            <PCoachIcon size={14} color={pCoach.color} strokeWidth={2} />
          </View>

          {/* Info */}
          <View style={styles.pInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.pName, { color: colors.textPrimary }]} numberOfLines={1}>
                {pProfile?.display_name || pProfile?.username || 'User'}
              </Text>
              {isCompleted && (
                <Check size={14} color={colors.green} strokeWidth={2.5} />
              )}
            </View>
            <View style={[styles.pProgressBar, { backgroundColor: colors.bgSubtle }]}>
              <View style={[styles.pProgressFill, {
                backgroundColor: isCompleted ? colors.green : pCoach.color,
                width: `${progressPct * 100}%`,
              }]} />
            </View>
          </View>

          {/* Progress count */}
          <Text style={[styles.pProgress, { color: isCompleted ? colors.green : colors.textSecondary }]}>
            {p.progress}/{challenge.target_value}
          </Text>
        </View>
      </FadeInView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={participants}
        renderItem={renderParticipant}
        keyExtractor={item => item.user_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
            </TouchableOpacity>

            {/* Challenge info */}
            <FadeInView delay={50} style={styles.challengeInfo}>
              <View style={[styles.iconCircle, { backgroundColor: coach.color + '15' }]}>
                <TypeIcon size={36} color={coach.color} strokeWidth={1.8} />
              </View>
              <Text style={[styles.challengeTitle, { color: colors.textPrimary }]}>{challenge.title}</Text>
              {challenge.description && (
                <Text style={[styles.challengeDesc, { color: colors.textSecondary }]}>{challenge.description}</Text>
              )}
              <Text style={[styles.daysLeft, { color: coach.color }]}>{daysLeft(challenge.end_date)}</Text>
            </FadeInView>

            {/* Target card - glass */}
            <FadeInView delay={100}>
              <GlassCard style={styles.targetCard} accentColor={coach.color}>
                <View style={styles.targetItem}>
                  <Text style={[styles.targetValue, { color: coach.color }]}>{challenge.target_value}</Text>
                  <Text style={[styles.targetLabel, { color: colors.textMuted }]}>{typeConfig.unit.toUpperCase()}</Text>
                </View>
                <View style={[styles.targetDivider, { backgroundColor: colors.glassBorder }]} />
                <View style={styles.targetItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Users size={14} color={coach.color} strokeWidth={2} />
                    <Text style={[styles.targetValue, { color: coach.color }]}>{participants.length}</Text>
                  </View>
                  <Text style={[styles.targetLabel, { color: colors.textMuted }]}>JOINED</Text>
                </View>
                <View style={[styles.targetDivider, { backgroundColor: colors.glassBorder }]} />
                <View style={styles.targetItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Check size={14} color={coach.color} strokeWidth={2.5} />
                    <Text style={[styles.targetValue, { color: coach.color }]}>
                      {participants.filter(p => p.status === 'completed').length}
                    </Text>
                  </View>
                  <Text style={[styles.targetLabel, { color: colors.textMuted }]}>DONE</Text>
                </View>
              </GlassCard>
            </FadeInView>

            {/* Participants header */}
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PARTICIPANTS</Text>
          </View>
        }
      />

      {/* Action button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.glassBorder }]}>
        {isJoined ? (
          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: colors.glassBg,
              borderColor: colors.glassBorder,
              borderWidth: 1,
            }]}
            onPress={handleLeave}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : (
              <Text style={[{ color: colors.red, fontWeight: '700', fontSize: 16 }]}>Leave Challenge</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: coach.color }]}
            onPress={handleJoin}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[{ color: '#fff', fontWeight: '700', fontSize: 16 }]}>Join Challenge</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSection: { paddingHorizontal: SPACING.lg },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
  },
  backText: { ...FONT.body, fontWeight: '500' },
  challengeInfo: { alignItems: 'center', paddingVertical: SPACING.lg },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeTitle: { ...FONT.title, textAlign: 'center', marginTop: SPACING.sm },
  challengeDesc: { ...FONT.body, textAlign: 'center', marginTop: SPACING.xs, maxWidth: 280 },
  daysLeft: { ...FONT.caption, fontWeight: '600', marginTop: SPACING.sm },
  targetCard: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  targetItem: { flex: 1, alignItems: 'center' },
  targetValue: { ...FONT.stat, fontSize: 22 },
  targetLabel: { ...FONT.label, fontSize: 9, marginTop: 4 },
  targetDivider: { width: 1, height: 30, alignSelf: 'center' },
  sectionTitle: { ...FONT.label, marginBottom: SPACING.sm },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  rankContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank: { ...FONT.subhead, fontWeight: '800', textAlign: 'center' },
  pAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pInfo: { flex: 1, gap: 4 },
  pName: { ...FONT.caption, fontWeight: '600', fontSize: 14 },
  pProgressBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  pProgressFill: { height: '100%', borderRadius: 2 },
  pProgress: { ...FONT.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.md, paddingBottom: 34, borderTopWidth: 1,
  },
  actionBtn: { padding: 16, borderRadius: RADIUS.lg, alignItems: 'center' },
});
