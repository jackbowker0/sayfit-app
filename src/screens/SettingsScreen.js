// ============================================================
// SETTINGS SCREEN — Premium dark UI redesign with glass-morphism
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sun, Moon, Smartphone, ChevronLeft, User, Dumbbell, Calendar, Timer, Scale } from 'lucide-react-native';
import FadeInView from '../components/FadeInView';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { FONT, GLOW } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getUserProfile, saveUserProfile, resetOnboarding, GOAL_OPTIONS, EQUIPMENT_OPTIONS, FITNESS_LEVELS, DAY_OPTIONS } from '../services/userProfile';
import { clearWorkoutHistory } from '../services/storage';
import { clearAchievements, getAchievementStats } from '../services/achievements';
import * as haptics from '../services/haptics';
import { COACH_ICONS } from '../constants/icons';
import GlassCard from '../components/GlassCard';

const REST_OPTIONS = [60, 90, 120, 180];

const THEME_ICON_MAP = {
  light: Sun,
  dark: Moon,
  system: Smartphone,
};

const THEME_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export default function SettingsScreen({ navigation }) {
  const { coachId, setCoachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark, themeMode, setThemeMode } = useTheme();

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('intermediate');
  const [goals, setGoals] = useState([]);
  const [equipment, setEquipment] = useState(['bodyweight']);
  const [weeklyGoal, setWeeklyGoal] = useState(4);
  const [units, setUnits] = useState('lbs');
  const [restDuration, setRestDuration] = useState(90);
  const [workoutDays, setWorkoutDays] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [achieveStats, setAchieveStats] = useState(null);

  useEffect(() => { loadProfile(); loadAchievementStats(); }, []);

  // Warn when leaving with unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges) return;
      e.preventDefault();
      Alert.alert('Unsaved Changes', 'You have unsaved changes. Discard them?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, hasChanges]);

  const loadProfile = async () => {
    const p = await getUserProfile();
    setProfile(p);
    setName(p.name || '');
    setFitnessLevel(p.fitnessLevel || 'intermediate');
    setGoals(p.goals || []);
    setEquipment(p.equipment || ['bodyweight']);
    setWeeklyGoal(p.weeklyGoal || 4);
    setUnits(p.units || 'lbs');
    setRestDuration(p.restDuration || 90);
    setWorkoutDays(p.workoutDays || []);
  };

  const loadAchievementStats = async () => {
    const stats = await getAchievementStats();
    setAchieveStats(stats);
  };

  const markChanged = () => setHasChanges(true);

  const toggleDay = (id) => {
    haptics.tick();
    setWorkoutDays(prev => {
      const next = prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id].sort((a, b) => a - b);
      return next;
    });
    markChanged();
  };

  const handleSave = async () => {
    haptics.success();
    await saveUserProfile({
      name: name.trim(), fitnessLevel, goals, equipment,
      weeklyGoal: workoutDays.length > 0 ? workoutDays.length : weeklyGoal,
      units, restDuration, coachId, workoutDays,
    });
    setHasChanges(false);
    // Sync weeklyGoal with days if days are set
    if (workoutDays.length > 0) setWeeklyGoal(workoutDays.length);
    Alert.alert('Saved', 'Your settings have been updated.');
  };

  const handleCoachSelect = (id) => { haptics.medium(); setCoachId(id); markChanged(); };
  const toggleGoal = (id) => { haptics.tick(); setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]); markChanged(); };
  const toggleEquipment = (id) => { haptics.tick(); setEquipment(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]); markChanged(); };

  const handleClearHistory = () => {
    Alert.alert('Clear Workout History', 'This will delete ALL your workout history, streaks, and stats. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: async () => { haptics.warning(); await clearWorkoutHistory(); Alert.alert('Done', 'Workout history cleared.'); }},
    ]);
  };

  const handleClearAchievements = () => {
    Alert.alert('Clear Achievements', 'This will reset ALL your badges. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Badges', style: 'destructive', onPress: async () => { haptics.warning(); await clearAchievements(); setAchieveStats({ total: achieveStats?.total || 0, unlocked: 0, percentage: 0 }); Alert.alert('Done', 'Achievements cleared.'); }},
    ]);
  };

  const handleResetOnboarding = () => {
    Alert.alert('Reset Onboarding', 'This will clear your profile and show the onboarding flow on next launch.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { haptics.warning(); await resetOnboarding(); Alert.alert('Done', 'Restart the app to see onboarding again.'); }},
    ]);
  };

  if (!profile) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.textMuted} size="large" />
    </SafeAreaView>
  );
  const ds = dynamicStyles(colors, isDark, coach);

  return (
    <SafeAreaView style={ds.container}>
      <View style={ds.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Go back"
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <ChevronLeft size={20} color={coach.color} />
          <Text style={[ds.backBtn, { color: coach.color }]}>Home</Text>
        </TouchableOpacity>
        <Text style={[ds.headerTitle, FONT.heading]} accessibilityRole="header">Settings</Text>
        <TouchableOpacity onPress={handleSave} activeOpacity={0.7}
          style={[ds.saveBtn, { backgroundColor: hasChanges ? coach.color : colors.bgSubtle }]}
          accessibilityRole="button" accessibilityLabel={hasChanges ? "Save changes" : "No changes"}
        >
          <Text style={[ds.saveBtnText, { color: hasChanges ? getTextOnColor(coach.color) : colors.textMuted }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={ds.scroll} showsVerticalScrollIndicator={false}>

        {/* APPEARANCE */}
        <FadeInView delay={50}>
          <Text style={[ds.sectionTitle, FONT.label]}>Appearance</Text>
          <GlassCard>
            <Text style={[ds.fieldLabel, FONT.caption, { color: colors.textSecondary }]}>Theme</Text>
            <View style={ds.toggleRow}>
              {THEME_OPTIONS.map(opt => {
                const ThemeIcon = THEME_ICON_MAP[opt.id];
                const isSelected = themeMode === opt.id;
                return (
                  <TouchableOpacity key={opt.id} style={[ds.toggleBtn, isSelected && { backgroundColor: coach.color + '20', borderColor: coach.color }]}
                    onPress={() => { haptics.tick(); setThemeMode(opt.id); }} activeOpacity={0.7}
                    accessibilityRole="button" accessibilityState={{ selected: isSelected }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ThemeIcon size={16} color={isSelected ? coach.color : colors.textSecondary} />
                      <Text style={[ds.toggleText, isSelected && { color: coach.color }]}>{opt.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>
        </FadeInView>

        {/* COACH */}
        <FadeInView delay={100}>
          <Text style={[ds.sectionTitle, FONT.label]}>Your Coach</Text>
          <View style={ds.coachRow}>
            {Object.entries(COACHES).map(([id, c]) => {
              const CoachIcon = COACH_ICONS[c.iconName];
              const isSelected = coachId === id;
              return (
                <TouchableOpacity key={id}
                  style={[
                    ds.coachOption,
                    {
                      borderColor: isSelected ? c.color : colors.glassBorder,
                      backgroundColor: isSelected ? c.color + '15' : colors.glassBg,
                    },
                    isSelected && {
                      shadowColor: c.color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.15,
                      shadowRadius: GLOW.md,
                      elevation: 4,
                    },
                  ]}
                  onPress={() => handleCoachSelect(id)} activeOpacity={0.7}
                  accessibilityRole="button" accessibilityLabel={`Coach ${c.name}: ${c.description}`} accessibilityState={{ selected: isSelected }}
                >
                  <CoachIcon size={28} color={c.color} />
                  <Text style={[ds.coachName, isSelected && { color: c.color }]}>{c.name}</Text>
                  <Text style={ds.coachVibe}>{id === 'drill' ? 'Tough love' : id === 'hype' ? 'Hype energy' : 'Calm flow'}</Text>
                  {isSelected && <View style={[ds.activeDot, { backgroundColor: c.color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </FadeInView>

        {/* PROFILE */}
        <FadeInView delay={150}>
          <Text style={[ds.sectionTitle, FONT.label]}>Profile</Text>
          <GlassCard>
            <Text style={[ds.fieldLabel, FONT.caption, { color: colors.textSecondary }]}>Name</Text>
            <TextInput style={[ds.textInput, { borderColor: coach.color + '30' }]} value={name}
              onChangeText={(t) => { setName(t); markChanged(); }} placeholder="Your name"
              placeholderTextColor={colors.textDim} selectionColor={coach.color} accessibilityLabel="Your name"
              returnKeyType="done"
            />
            <Text style={[ds.fieldLabel, FONT.caption, { color: colors.textSecondary, marginTop: SPACING.lg }]}>Fitness Level</Text>
            <View style={ds.chipRow}>
              {FITNESS_LEVELS.map(level => (
                <TouchableOpacity key={level.id} style={[ds.chip, fitnessLevel === level.id && { backgroundColor: coach.color + '20', borderColor: coach.color }]}
                  onPress={() => { haptics.tick(); setFitnessLevel(level.id); markChanged(); }} activeOpacity={0.7}
                  accessibilityRole="button" accessibilityState={{ selected: fitnessLevel === level.id }}
                >
                  <Text style={ds.chipEmoji}>{level.emoji}</Text>
                  <Text style={[ds.chipText, fitnessLevel === level.id && { color: coach.color }]}>{level.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>
        </FadeInView>

        {/* GOALS */}
        <FadeInView delay={200}>
          <Text style={[ds.sectionTitle, FONT.label]}>Goals</Text>
          <GlassCard>
            <View style={ds.chipWrap}>
              {GOAL_OPTIONS.map(goal => (
                <TouchableOpacity key={goal.id} style={[ds.chipWrapItem, goals.includes(goal.id) && { backgroundColor: coach.color + '20', borderColor: coach.color }]}
                  onPress={() => toggleGoal(goal.id)} activeOpacity={0.7}
                  accessibilityRole="button" accessibilityState={{ selected: goals.includes(goal.id) }}
                >
                  <Text style={ds.chipEmoji}>{goal.emoji}</Text>
                  <Text style={[ds.chipText, goals.includes(goal.id) && { color: coach.color }]}>{goal.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>
        </FadeInView>

        {/* EQUIPMENT */}
        <FadeInView delay={250}>
          <Text style={[ds.sectionTitle, FONT.label]}>Equipment</Text>
          <GlassCard>
            <View style={ds.chipWrap}>
              {EQUIPMENT_OPTIONS.map(eq => (
                <TouchableOpacity key={eq.id} style={[ds.chipWrapItem, equipment.includes(eq.id) && { backgroundColor: coach.color + '20', borderColor: coach.color }]}
                  onPress={() => toggleEquipment(eq.id)} activeOpacity={0.7}
                  accessibilityRole="button" accessibilityState={{ selected: equipment.includes(eq.id) }}
                >
                  <Text style={ds.chipEmoji}>{eq.emoji}</Text>
                  <Text style={[ds.chipText, equipment.includes(eq.id) && { color: coach.color }]}>{eq.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>
        </FadeInView>

        {/* WORKOUT SCHEDULE */}
        <FadeInView delay={300}>
          <Text style={[ds.sectionTitle, FONT.label]}>Workout Schedule</Text>
          <GlassCard>
            <Text style={[ds.fieldLabel, FONT.caption, { color: colors.textSecondary }]}>Training Days</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              {DAY_OPTIONS.map(day => {
                const selected = workoutDays.includes(day.id);
                return (
                  <TouchableOpacity key={day.id} style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: selected ? coach.color : colors.glassBg,
                    borderWidth: 1.5, borderColor: selected ? coach.color : colors.glassBorder,
                    alignItems: 'center', justifyContent: 'center',
                  }} onPress={() => toggleDay(day.id)} activeOpacity={0.7}
                    accessibilityRole="button" accessibilityLabel={`${day.label}${selected ? ', selected' : ''}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? getTextOnColor(coach.color) : colors.textMuted }}>{day.short}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={ds.fieldHint}>
              {workoutDays.length === 0 ? 'No schedule set \u2014 weekly goal used instead' : `${workoutDays.length} days/week \u00b7 ${workoutDays.map(d => DAY_OPTIONS[d].label).join(', ')}`}
            </Text>
          </GlassCard>
        </FadeInView>

        {/* WORKOUT SETTINGS */}
        <FadeInView delay={350}>
          <Text style={[ds.sectionTitle, FONT.label]}>Workout Settings</Text>
          <GlassCard>
            {workoutDays.length === 0 && (
              <>
                <Text style={[ds.fieldLabel, FONT.caption, { color: colors.textSecondary }]}>Weekly Goal</Text>
                <View style={ds.sliderRow}>
                  {[2, 3, 4, 5, 6, 7].map(n => (
                    <TouchableOpacity key={n} style={[ds.sliderBtn, weeklyGoal === n && { backgroundColor: coach.color, borderColor: coach.color }]}
                      onPress={() => { haptics.tick(); setWeeklyGoal(n); markChanged(); }} activeOpacity={0.7}
                      accessibilityRole="button" accessibilityLabel={`${n} workouts per week`} accessibilityState={{ selected: weeklyGoal === n }}
                    >
                      <Text style={[ds.sliderBtnText, weeklyGoal === n && { color: getTextOnColor(coach.color), fontWeight: '800' }]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={ds.fieldHint}>{weeklyGoal} workouts per week</Text>
              </>
            )}

            {workoutDays.length > 0 && (
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: SPACING.md }}>
                Weekly goal auto-set to {workoutDays.length} from your schedule
              </Text>
            )}

            <Text style={[ds.fieldLabel, FONT.caption, { color: colors.textSecondary }, workoutDays.length === 0 && { marginTop: SPACING.lg }]}>Units</Text>
            <View style={ds.toggleRow}>
              {['lbs', 'kg'].map(u => (
                <TouchableOpacity key={u} style={[ds.toggleBtn, units === u && { backgroundColor: coach.color + '20', borderColor: coach.color }]}
                  onPress={() => { haptics.tick(); setUnits(u); markChanged(); }} activeOpacity={0.7}
                  accessibilityRole="button" accessibilityState={{ selected: units === u }}
                >
                  <Text style={[ds.toggleText, units === u && { color: coach.color }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[ds.fieldLabel, FONT.caption, { color: colors.textSecondary, marginTop: SPACING.lg }]}>Default Rest Timer</Text>
            <View style={ds.sliderRow}>
              {REST_OPTIONS.map(sec => (
                <TouchableOpacity key={sec} style={[ds.sliderBtn, restDuration === sec && { backgroundColor: coach.color, borderColor: coach.color }]}
                  onPress={() => { haptics.tick(); setRestDuration(sec); markChanged(); }} activeOpacity={0.7}
                  accessibilityRole="button" accessibilityState={{ selected: restDuration === sec }}
                >
                  <Text style={[ds.sliderBtnText, restDuration === sec && { color: getTextOnColor(coach.color), fontWeight: '800' }]}>{sec}s</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>
        </FadeInView>

        {/* DANGER ZONE */}
        <FadeInView delay={400}>
          <Text style={[ds.sectionTitle, FONT.label, { color: colors.red }]}>Danger Zone</Text>
          <GlassCard accentColor={colors.red}>
            <TouchableOpacity style={{ paddingVertical: SPACING.sm, minHeight: 48, justifyContent: 'center' }} onPress={handleClearHistory} activeOpacity={0.7} accessibilityRole="button">
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.red }}>Clear Workout History</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Deletes all workouts, streaks, and stats</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.glassBorder, marginVertical: SPACING.md }} />
            <TouchableOpacity style={{ paddingVertical: SPACING.sm, minHeight: 48, justifyContent: 'center' }} onPress={handleClearAchievements} activeOpacity={0.7} accessibilityRole="button">
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.red }}>Clear Achievements</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Resets all {achieveStats?.unlocked || 0} earned badges</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.glassBorder, marginVertical: SPACING.md }} />
            <TouchableOpacity style={{ paddingVertical: SPACING.sm, minHeight: 48, justifyContent: 'center' }} onPress={handleResetOnboarding} activeOpacity={0.7} accessibilityRole="button">
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.red }}>Reset Onboarding</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Clears profile and restarts setup flow</Text>
            </TouchableOpacity>
          </GlassCard>
        </FadeInView>

        <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: SPACING.xl }}>SayFit v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function dynamicStyles(colors, isDark, coach) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.lg, paddingBottom: 80 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    backBtn: { fontSize: 16, fontWeight: '600', marginLeft: 4 },
    headerTitle: { color: colors.textPrimary },
    saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.sm },
    saveBtnText: { fontSize: 14, fontWeight: '700' },
    sectionTitle: { color: colors.textMuted, marginBottom: SPACING.md, marginTop: SPACING.lg },
    coachRow: { flexDirection: 'row', gap: 10 },
    coachOption: { flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1.5 },
    coachName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 8 },
    coachVibe: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    activeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
    fieldLabel: { marginBottom: 8 },
    fieldHint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
    textInput: { backgroundColor: colors.glassBg, borderWidth: 1, borderRadius: RADIUS.md, padding: 14, fontSize: 16, color: colors.textPrimary },
    chipRow: { flexDirection: 'row', gap: 8 },
    chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg },
    chipEmoji: { fontSize: 14, marginRight: 4 },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chipWrapItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg },
    sliderRow: { flexDirection: 'row', gap: 8 },
    sliderBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg },
    sliderBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    toggleRow: { flexDirection: 'row', gap: 8 },
    toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg },
    toggleText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  });
}
