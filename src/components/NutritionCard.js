// ============================================================
// NUTRITION CARD — Dashboard macro summary card
//
// Shows today's kcal and protein vs target (or "Log a meal"
// empty state). Taps to navigate to the Nutrition screen.
// Mirrors WeightCard structure: GlassCard, theme tokens,
// useWorkoutContext + COACHES for color, lucide icons, haptics.
// ============================================================

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  UtensilsCrossed, Flame, Beef, ArrowRight,
} from 'lucide-react-native';

import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { getNutritionStats } from '../services/nutrition';
import { getMacroTargets } from '../services/userProfile';
import * as haptics from '../services/haptics';
import GlassCard from './GlassCard';

export default function NutritionCard({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const [stats, setStats] = useState(null);

  // Reload whenever the dashboard regains focus (e.g. after logging a meal),
  // so the card never shows stale macros — improves on WeightCard's mount-only load.
  useFocusEffect(useCallback(() => { loadStats(); }, []));

  const loadStats = async () => {
    const targets = await getMacroTargets();
    const s = await getNutritionStats(targets);
    setStats(s);
  };

  const handlePress = () => {
    haptics.tap();
    if (navigation) navigation.navigate('Nutrition');
  };

  const hasData = stats && stats.mealCount > 0;
  const targets = stats?.targets || {};
  const totals = stats?.totals || { kcal: 0, protein: 0 };
  const hasKcalTarget = typeof targets.kcal === 'number' && targets.kcal > 0;
  const hasProteinTarget = typeof targets.protein === 'number' && targets.protein > 0;

  const kcalPct = hasKcalTarget ? Math.min(totals.kcal / targets.kcal, 1) : null;

  return (
    <GlassCard
      accentColor={!hasData ? coach.color : undefined}
      glow={!hasData}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          hasData
            ? `Nutrition: ${totals.kcal}${hasKcalTarget ? ` of ${targets.kcal}` : ''} kcal, ${totals.protein}g${hasProteinTarget ? ` of ${targets.protein}g` : ''} protein. Tap to view.`
            : 'No meals logged today. Tap to log a meal.'
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Icon */}
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: coach.color + '12',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}>
            <UtensilsCrossed size={18} color={coach.color} strokeWidth={2.5} />
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            {hasData ? (
              <>
                {/* kcal row */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 3 }}>
                  <Flame size={11} color={coach.color} strokeWidth={2.5} />
                  <Text style={{ ...FONT.stat, fontSize: 18, color: colors.textPrimary }}>
                    {totals.kcal}
                  </Text>
                  {hasKcalTarget && (
                    <Text style={{ ...FONT.caption, color: colors.textMuted }}>
                      /{targets.kcal} kcal
                    </Text>
                  )}
                  {!hasKcalTarget && (
                    <Text style={{ ...FONT.caption, fontWeight: '600', color: colors.textMuted }}>kcal</Text>
                  )}
                </View>

                {/* protein row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Beef size={10} color={colors.blue} strokeWidth={2.5} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue }}>
                    {totals.protein}g
                    {hasProteinTarget ? ` / ${targets.protein}g` : ''} protein
                  </Text>
                </View>

                {/* kcal progress bar (only when target set) */}
                {kcalPct !== null && (
                  <View style={{
                    height: 3, borderRadius: 2,
                    backgroundColor: colors.glassBorder,
                    marginTop: 7, overflow: 'hidden',
                  }}>
                    <View style={{
                      height: 3, width: `${kcalPct * 100}%`,
                      borderRadius: 2, backgroundColor: coach.color,
                    }} />
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={{ ...FONT.subhead, color: colors.textSecondary }}>
                  Log a meal
                </Text>
                <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>
                  tap to start tracking macros
                </Text>
              </>
            )}
          </View>

          {/* Right tap indicator */}
          <View style={{
            paddingHorizontal: 10, paddingVertical: 6,
            borderRadius: RADIUS.sm,
            backgroundColor: colors.bgSubtle,
            marginLeft: 8,
          }}>
            {hasData ? (
              <ArrowRight size={14} color={colors.textMuted} strokeWidth={2} />
            ) : (
              <Text style={{ ...FONT.label, fontSize: 11, color: colors.textMuted }}>+ add</Text>
            )}
          </View>
        </View>

        {/* Meal count badge */}
        {hasData && (
          <View style={{
            marginTop: 10, paddingTop: 10,
            borderTopWidth: 1, borderTopColor: colors.glassBorder,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {stats.mealCount} meal{stats.mealCount !== 1 ? 's' : ''} logged today
            </Text>
            {stats.pendingCount > 0 && (
              <View style={{
                paddingHorizontal: 6, paddingVertical: 2,
                borderRadius: RADIUS.round,
                backgroundColor: colors.orange + '20',
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.orange }}>
                  {stats.pendingCount} pending
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </GlassCard>
  );
}
