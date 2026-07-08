// ============================================================
// ACTION TILE — Hub grid cell that is BOTH shortcut and status.
//
// One tap navigates to an existing screen; the tile also shows
// what's pending. Borders-first, coach-accent icon chip, and a
// colorblind-safe attention token (icon + word, never color alone).
//
// Purely presentational: the parent computes status + attention
// from already-fetched hub stats and passes them down. No fetching
// here, so the whole grid renders from a single Dashboard load.
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';

import { SPACING, RADIUS, FONT } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import * as haptics from '../services/haptics';

export default function ActionTile({
  Icon,
  label,
  status,
  attention = 'none',   // 'none' | 'due' | 'done'
  onPress,
  disabled = false,
}) {
  const { colors, isDark } = useTheme();
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];

  // Coach accent lives on the icon chip only (branding / interactive).
  // Semantic status colors never touch the chip.
  const chipBg = disabled ? colors.textMuted + '12' : coach.color + '12';
  const chipIconColor = disabled ? colors.textMuted : coach.color;

  // Attention token — always icon + word so it reads without color.
  const showDue = attention === 'due' && !disabled;
  const showDone = attention === 'done' && !disabled;

  const handlePress = () => {
    if (disabled || !onPress) return;
    haptics.tap();
    onPress();
  };

  const a11yAttention = showDue ? 'Needs attention.' : showDone ? 'Done.' : '';

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={`${label}. ${status}. ${a11yAttention}`}
      style={{
        flex: 1,
        minHeight: 96,
        backgroundColor: isDark ? colors.glassBg : colors.bgCard,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderTopColor: colors.glassHighlight,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        justifyContent: 'space-between',
        opacity: disabled ? 0.55 : 1,
        ...(!isDark && !disabled ? {
          shadowColor: 'rgba(0,0,0,0.06)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 2,
        } : {}),
      }}
    >
      {/* Top row: icon chip + attention corner token */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{
          width: 40, height: 40, borderRadius: RADIUS.md,
          backgroundColor: chipBg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {Icon ? <Icon size={20} color={chipIconColor} strokeWidth={2.5} /> : null}
        </View>

        {showDue && <AlertCircle size={14} color={colors.orange} strokeWidth={2.5} />}
        {showDone && <CheckCircle2 size={14} color={colors.green} strokeWidth={2.5} />}
      </View>

      {/* Label + status */}
      <View style={{ marginTop: SPACING.sm }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}
        >
          {status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
