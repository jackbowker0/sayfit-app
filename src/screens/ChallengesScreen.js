// ============================================================
// CHALLENGES SCREEN — Browse, create, and join challenges
// Premium dark glass-morphism UI with Lucide icons.
// ============================================================

import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, Modal, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FadeInView from '../components/FadeInView';
import {
  ChevronLeft, Plus, Trophy, Dumbbell, Flame, Calendar,
  ChevronRight, Globe, Lock,
} from 'lucide-react-native';

import { AuthContext } from '../context/AuthContext';
import AuthGate from '../components/AuthGate';
import ChallengeCard from '../components/ChallengeCard';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, TIMING } from '../constants/theme';
import { getChallenges, createChallenge } from '../services/challenges';
import * as haptics from '../services/haptics';

const CHALLENGE_TYPES = [
  { id: 'workout_count', label: 'Workouts', Icon: Dumbbell, desc: 'Complete X workouts' },
  { id: 'calorie_burn', label: 'Calories', Icon: Flame, desc: 'Burn X total calories' },
  { id: 'streak', label: 'Streak', Icon: Calendar, desc: 'Maintain a streak of X days' },
];

const TAB_ITEMS = [
  { key: 'active', label: 'Active' },
  { key: 'mine', label: 'Mine' },
  { key: 'public', label: 'Discover' },
];

export default function ChallengesScreen({ navigation }) {
  const { user, isAuthenticated } = useContext(AuthContext);
  const { colors, isDark } = useTheme();

  const [tab, setTab] = useState('active');
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('workout_count');
  const [newTarget, setNewTarget] = useState('');
  const [newDays, setNewDays] = useState('7');
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // Sliding tab indicator
  const tabIndex = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  useEffect(() => {
    if (isAuthenticated) loadChallenges();
  }, [isAuthenticated, tab]);

  const loadChallenges = async () => {
    setLoading(true);
    try {
      const data = await getChallenges(tab);
      setChallenges(data);
    } catch (e) {
      console.warn('[Challenges] Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newTarget) return;
    setCreating(true);
    try {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + parseInt(newDays, 10));

      await createChallenge({
        title: newTitle.trim(),
        challengeType: newType,
        targetValue: parseInt(newTarget, 10),
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        isPublic: newPublic,
      });

      haptics.success();
      setShowCreate(false);
      setNewTitle('');
      setNewTarget('');
      loadChallenges();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not create challenge.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AuthGate navigation={navigation}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Challenges</Text>
          <TouchableOpacity
            onPress={() => { haptics.tap(); setShowCreate(true); }}
            style={[styles.createBtn, {
              backgroundColor: colors.glassBg,
              borderColor: colors.glassBorder,
            }]}
          >
            <Plus size={16} color={colors.textPrimary} strokeWidth={2.5} />
            <Text style={[styles.createBtnText, { color: colors.textPrimary }]}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Glass Tab Bar */}
        <View style={styles.tabBarOuter}>
          <View
            style={[styles.tabBar, {
              backgroundColor: colors.glassBg,
              borderColor: colors.glassBorder,
            }]}
            onLayout={(e) => setTabWidth(e.nativeEvent.layout.width / TAB_ITEMS.length)}
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
            {TAB_ITEMS.map((t, i) => (
              <TouchableOpacity
                key={t.key}
                style={styles.tab}
                onPress={() => {
                  haptics.tick();
                  Animated.timing(tabIndex, { toValue: i * tabWidth, duration: TIMING.normal, useNativeDriver: true }).start();
                  setTab(t.key);
                }}
              >
                <Text style={[styles.tabText, {
                  color: tab === t.key ? colors.textPrimary : colors.textMuted,
                  fontWeight: tab === t.key ? '700' : '500',
                }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.textMuted} size="large" />
          </View>
        ) : (
          <FlatList
            data={challenges}
            renderItem={({ item, index }) => (
              <FadeInView delay={index * 60}>
                <ChallengeCard
                  challenge={item}
                  currentUserId={user?.id}
                  onPress={(c) => navigation.navigate('ChallengeDetail', { challengeId: c.id })}
                />
              </FadeInView>
            )}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <FadeInView delay={100}>
                <GlassCard style={styles.emptyCard}>
                  <Trophy size={48} color={colors.textMuted} strokeWidth={1.2} />
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No challenges yet</Text>
                  <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                    Create one or discover public challenges!
                  </Text>
                </GlassCard>
              </FadeInView>
            }
          />
        )}

        {/* Leaderboard link */}
        <TouchableOpacity
          style={[styles.leaderboardBtn, {
            backgroundColor: colors.glassBg,
            borderColor: colors.glassBorder,
          }]}
          onPress={() => navigation.navigate('Leaderboard')}
          activeOpacity={0.7}
        >
          <Trophy size={20} color={colors.textPrimary} strokeWidth={2} />
          <Text style={[styles.leaderboardText, { color: colors.textPrimary }]}>View Leaderboard</Text>
          <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>

        {/* Create Modal */}
        <Modal visible={showCreate} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: colors.bgOverlay }]}>
            <View style={[styles.modalContent, {
              backgroundColor: isDark ? colors.bgElevated : colors.bgCard,
              borderColor: colors.glassBorder,
            }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New Challenge</Text>

              <TextInput
                style={[styles.input, {
                  backgroundColor: colors.glassBg,
                  color: colors.textPrimary,
                  borderColor: colors.glassBorder,
                }]}
                placeholder="Challenge title"
                placeholderTextColor={colors.textDim}
                value={newTitle}
                onChangeText={setNewTitle}
                maxLength={60}
              />

              {/* Type selector */}
              <View style={styles.typeRow}>
                {CHALLENGE_TYPES.map(t => {
                  const isSelected = newType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeChip, {
                        backgroundColor: isSelected ? colors.blue + '20' : colors.glassBg,
                        borderColor: isSelected ? colors.blue : colors.glassBorder,
                      }]}
                      onPress={() => { haptics.tick(); setNewType(t.id); }}
                    >
                      <t.Icon
                        size={18}
                        color={isSelected ? colors.blue : colors.textSecondary}
                        strokeWidth={2}
                      />
                      <Text style={[styles.typeLabel, {
                        color: isSelected ? colors.blue : colors.textSecondary,
                      }]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>TARGET</Text>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: colors.glassBg,
                      color: colors.textPrimary,
                      borderColor: colors.glassBorder,
                    }]}
                    placeholder="e.g. 10"
                    placeholderTextColor={colors.textDim}
                    value={newTarget}
                    onChangeText={setNewTarget}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>DAYS</Text>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: colors.glassBg,
                      color: colors.textPrimary,
                      borderColor: colors.glassBorder,
                    }]}
                    placeholder="7"
                    placeholderTextColor={colors.textDim}
                    value={newDays}
                    onChangeText={setNewDays}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.publicToggle}
                onPress={() => { haptics.tick(); setNewPublic(!newPublic); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {newPublic ? (
                    <Globe size={16} color={colors.textSecondary} strokeWidth={2} />
                  ) : (
                    <Lock size={16} color={colors.textSecondary} strokeWidth={2} />
                  )}
                  <Text style={[{ color: colors.textSecondary, ...FONT.body }]}>
                    {newPublic ? 'Public' : 'Private'} -- tap to toggle
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, {
                    backgroundColor: colors.glassBg,
                    borderColor: colors.glassBorder,
                    borderWidth: 1,
                  }]}
                  onPress={() => setShowCreate(false)}
                >
                  <Text style={[{ color: colors.textSecondary, fontWeight: '600' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.blue, flex: 1 }]}
                  onPress={handleCreate}
                  disabled={creating || !newTitle.trim() || !newTarget}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </AuthGate>
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
  },
  backText: { ...FONT.body, fontWeight: '500' },
  title: { ...FONT.heading },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    borderWidth: 1,
  },
  createBtnText: { ...FONT.caption, fontWeight: '700' },
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
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: { ...FONT.caption },
  list: { paddingHorizontal: SPACING.md, paddingBottom: 120 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginTop: 40,
  },
  emptyTitle: { ...FONT.heading, marginTop: SPACING.md, marginBottom: SPACING.sm },
  emptyBody: { ...FONT.body, textAlign: 'center' },
  leaderboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 34,
  },
  leaderboardText: { flex: 1, ...FONT.subhead },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  modalTitle: { ...FONT.heading, marginBottom: SPACING.md, textAlign: 'center' },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...FONT.body,
    marginBottom: SPACING.sm,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  typeLabel: { ...FONT.label, fontSize: 10 },
  row: { flexDirection: 'row', gap: SPACING.sm },
  fieldLabel: { ...FONT.label, fontSize: 10, marginBottom: 4, marginLeft: 2 },
  publicToggle: { alignItems: 'center', paddingVertical: SPACING.sm },
  modalButtons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  modalBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: RADIUS.md, alignItems: 'center' },
});
