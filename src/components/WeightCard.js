// ============================================================
// WEIGHT CARD — Dashboard weight logging card + bottom sheet
//
// Shows latest weight, trend arrow, days since last log.
// Tap to open inline bottom sheet for quick entry.
// Links to full WeightScreen for history/charts.
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,
  Animated, Dimensions, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import {
  Scale, TrendingUp, TrendingDown, ArrowRight,
  Check, BarChart3,
} from 'lucide-react-native';

import { SPACING, RADIUS, FONT, GLOW, getTextOnColor } from '../constants/theme';
import { COACH_ICONS } from '../constants/icons';
import { useTheme } from '../hooks/useTheme';
import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { getWeightStats, saveWeight } from '../services/bodyWeight';
import { getUserProfile } from '../services/userProfile';
import * as haptics from '../services/haptics';
import GlassCard from './GlassCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WeightCard({ onWeightLogged, navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();
  const CoachIcon = COACH_ICONS[coachId] || COACH_ICONS.hype;

  const [stats, setStats] = useState(null);
  const [units, setUnits] = useState('lbs');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [noteValue, setNoteValue] = useState('');
  const [saving, setSaving] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const s = await getWeightStats();
    const profile = await getUserProfile();
    setStats(s);
    setUnits(profile.units || 'lbs');
  };

  const openSheet = () => {
    haptics.tap();
    // Pre-fill with last weight for easy adjustment
    if (stats?.current) {
      setInputValue(stats.current.toString());
    } else {
      setInputValue('');
    }
    setNoteValue('');
    setSheetOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 25, stiffness: 300 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeSheet = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setSheetOpen(false);
      setInputValue('');
      setNoteValue('');
    });
  };

  const handleSave = async () => {
    const weight = parseFloat(inputValue);
    if (isNaN(weight) || weight <= 0 || weight > 999) return;

    haptics.success();
    setSaving(true);
    await saveWeight(weight);
    await loadStats();
    setSaving(false);
    closeSheet();
    if (onWeightLogged) onWeightLogged();
  };

  // ---- Render helpers ----

  const getTrendArrow = () => {
    if (!stats || stats.weekChange === null) return null;
    if (Math.abs(stats.weekChange) < 0.1) return { Icon: ArrowRight, color: colors.textMuted, label: 'stable' };
    if (stats.weekChange > 0) return { Icon: TrendingUp, color: colors.orange, label: `+${stats.weekChange.toFixed(1)}` };
    return { Icon: TrendingDown, color: colors.green, label: `${stats.weekChange.toFixed(1)}` };
  };

  const getTimeSinceLog = () => {
    if (!stats?.currentDate) return null;
    const diff = Math.floor((Date.now() - new Date(stats.currentDate).getTime()) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'yesterday';
    return `${diff}d ago`;
  };

  const getCoachNudge = () => {
    if (!stats?.currentDate) {
      return {
        drill: "Log your weight. Data drives results.",
        hype: "Let's track your weight! Tap here!",
        zen: "Begin tracking your body's journey.",
      }[coachId];
    }
    const daysSince = Math.floor((Date.now() - new Date(stats.currentDate).getTime()) / 86400000);
    if (daysSince >= 7) {
      return {
        drill: "Weight log is stale. Update it.",
        hype: "Time for a weigh-in!",
        zen: "A new measurement awaits.",
      }[coachId];
    }
    return null;
  };

  const trend = getTrendArrow();
  const timeAgo = getTimeSinceLog();
  const nudge = getCoachNudge();
  const hasData = stats && stats.current !== null;

  return (
    <>
      {/* ---- DASHBOARD CARD ---- */}
      <GlassCard
        accentColor={nudge && !hasData ? coach.color : undefined}
        glow={!!(nudge && !hasData)}
      >
        <TouchableOpacity
          onPress={openSheet}
          activeOpacity={0.7}
          accessible
          accessibilityRole="button"
          accessibilityLabel={
            hasData
              ? `Body weight: ${stats.current} ${units}, logged ${timeAgo}. Tap to update.`
              : 'Log your body weight. Tap to add entry.'
          }
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Scale icon */}
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: coach.color + '12',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 12,
            }}>
              <Scale size={18} color={coach.color} strokeWidth={2.5} />
            </View>

            {/* Weight display */}
            <View style={{ flex: 1 }}>
              {hasData ? (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{
                    ...FONT.stat, color: colors.textPrimary,
                  }}>
                    {stats.current}
                  </Text>
                  <Text style={{
                    ...FONT.caption, fontWeight: '600', color: colors.textMuted,
                  }}>
                    {units}
                  </Text>
                  {trend && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4, gap: 3 }}>
                      <trend.Icon size={13} color={trend.color} strokeWidth={2.5} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: trend.color }}>
                        {trend.label}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={{ ...FONT.subhead, color: colors.textSecondary }}>
                  Log your weight
                </Text>
              )}
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>
                {hasData ? `logged ${timeAgo}` : nudge || 'tap to start tracking'}
              </Text>
            </View>

            {/* Tap indicator */}
            <View style={{
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm,
              backgroundColor: colors.bgSubtle,
            }}>
              <Text style={{ ...FONT.label, fontSize: 11, color: colors.textMuted }}>
                {hasData ? 'update' : '+ add'}
              </Text>
            </View>
          </View>

          {/* Nudge bar -- only shows when weight log is stale or empty */}
          {nudge && hasData && (
            <View style={{
              marginTop: 10, paddingTop: 10,
              borderTopWidth: 1, borderTopColor: colors.border,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}>
              <CoachIcon size={14} color={coach.color} strokeWidth={2} />
              <Text style={{ fontSize: 12, color: coach.color, fontStyle: 'italic' }}>
                {nudge}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </GlassCard>

      {/* ---- BOTTOM SHEET MODAL ---- */}
      <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={closeSheet}>
        <TouchableWithoutFeedback onPress={closeSheet}>
          <Animated.View style={{
            flex: 1, backgroundColor: colors.bgOverlay,
            opacity: backdropAnim,
          }} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        >
          <Animated.View style={{
            backgroundColor: colors.bgSheet || colors.bgElevated,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
            paddingHorizontal: SPACING.lg,
            transform: [{ translateY: slideAnim }],
            borderTopWidth: 1,
            borderColor: colors.glassBorder,
            shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.25, shadowRadius: 20, elevation: 20,
          }}>
            {/* Handle */}
            <View style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: colors.bgSheetHandle || colors.textDim,
              alignSelf: 'center', marginBottom: 20,
            }} />

            {/* Title */}
            <Text style={{
              ...FONT.heading, color: colors.textPrimary,
              marginBottom: 4,
            }}>
              Log Weight
            </Text>
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginBottom: 20 }}>
              {hasData
                ? `Last: ${stats.current} ${units} \u00B7 ${timeAgo}`
                : 'Your first weigh-in \u2014 let\'s go!'
              }
            </Text>

            {/* Weight input */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.glassBg,
              borderWidth: 1.5, borderColor: colors.glassBorder,
              borderRadius: RADIUS.lg, paddingHorizontal: 16, marginBottom: 12,
            }}>
              <TextInput
                style={{
                  flex: 1, fontSize: 28, fontWeight: '700',
                  color: colors.textPrimary, paddingVertical: 16,
                  fontVariant: ['tabular-nums'],
                }}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="0.0"
                placeholderTextColor={colors.textDim}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                maxLength={6}
                accessibilityLabel={`Weight in ${units}`}
              />
              <Text style={{
                fontSize: 16, fontWeight: '600', color: colors.textMuted,
                marginLeft: 8,
              }}>
                {units}
              </Text>
            </View>

            {/* Optional note */}
            <TextInput
              style={{
                backgroundColor: colors.glassBg,
                borderWidth: 1, borderColor: colors.glassBorder,
                borderRadius: RADIUS.md, padding: 14,
                fontSize: 14, color: colors.textPrimary,
                marginBottom: 20,
              }}
              value={noteValue}
              onChangeText={setNoteValue}
              placeholder="Note (optional) \u2014 morning, post-run..."
              placeholderTextColor={colors.textDim}
              maxLength={50}
              accessibilityLabel="Optional note for this weigh-in"
            />

            {/* Quick adjust buttons */}
            {hasData && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
                {[-1, -0.5, +0.5, +1].map(delta => (
                  <TouchableOpacity
                    key={delta}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8,
                      borderRadius: RADIUS.md, backgroundColor: colors.glassBg,
                      borderWidth: 1, borderColor: colors.glassBorder,
                    }}
                    onPress={() => {
                      haptics.tick();
                      const current = parseFloat(inputValue) || stats.current;
                      setInputValue((current + delta).toFixed(1));
                    }}
                    activeOpacity={0.7}
                    accessibilityLabel={`${delta > 0 ? '+' : ''}${delta} ${units}`}
                  >
                    <Text style={{
                      fontSize: 13, fontWeight: '600',
                      color: delta > 0 ? colors.orange : colors.green,
                    }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* History link */}
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg,
                  backgroundColor: colors.glassBg, alignItems: 'center',
                  borderWidth: 1, borderColor: colors.glassBorder,
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
                onPress={() => {
                  haptics.tap();
                  closeSheet();
                  if (navigation) navigation.navigate('Weight');
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="View weight history"
              >
                <BarChart3 size={15} color={colors.textSecondary} strokeWidth={2} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
                  History
                </Text>
              </TouchableOpacity>

              {/* Save button */}
              <TouchableOpacity
                style={{
                  flex: 2, paddingVertical: 14, borderRadius: RADIUS.lg,
                  backgroundColor: parseFloat(inputValue) > 0 ? coach.color : colors.bgSubtle,
                  alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                  ...(parseFloat(inputValue) > 0 && isDark ? {
                    shadowColor: coach.color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.3,
                    shadowRadius: GLOW.md,
                  } : {}),
                }}
                onPress={handleSave}
                disabled={saving || !(parseFloat(inputValue) > 0)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Save weight entry"
              >
                <Check size={15} color={parseFloat(inputValue) > 0 ? getTextOnColor(coach.color) : colors.textDim} strokeWidth={2.5} />
                <Text style={{
                  fontSize: 15, fontWeight: '700',
                  color: parseFloat(inputValue) > 0 ? getTextOnColor(coach.color) : colors.textDim,
                }}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
