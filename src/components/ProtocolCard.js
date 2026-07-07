// ============================================================
// PROTOCOL CARD — Dashboard summary tile for the Protocol module
// ------------------------------------------------------------
// Shows today's dose-due state + supplement check-off progress.
// Reloads on focus; taps through to the Protocol screen.
// ============================================================

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Syringe, ArrowRight } from 'lucide-react-native';

import GlassCard from './GlassCard';
import { RADIUS, FONT } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { getProtocolStats, hasAcknowledgedProtocolDisclaimer } from '../services/protocol';
import * as haptics from '../services/haptics';

export default function ProtocolCard({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors } = useTheme();

  const [stats, setStats] = useState(null);
  const [ack, setAck] = useState(null);   // null = not yet known; gate protocol details until confirmed

  useFocusEffect(useCallback(() => { loadStats(); }, []));

  const loadStats = async () => {
    const [a, s] = await Promise.all([
      hasAcknowledgedProtocolDisclaimer(),
      getProtocolStats(),
    ]);
    setAck(a);
    setStats(s);
  };

  const handlePress = () => {
    haptics.tap();
    if (navigation) navigation.navigate('Protocol');
  };

  // Only surface protocol specifics (summary + due-glow) once the user has
  // acknowledged the disclaimer gate; until then the card is a neutral CTA.
  const acknowledged = ack === true;
  const dueText = stats?.injectionDueToday
    ? 'Dose due today'
    : (stats?.scheduledCount ? 'Doses done for today' : 'No dose scheduled');
  const suppText = stats && stats.supplementsTotal > 0
    ? `Supplements ${stats.supplementsDone}/${stats.supplementsTotal}`
    : null;
  const showAlert = acknowledged && !!stats?.injectionDueToday;

  return (
    <GlassCard accentColor={coach.color} glow={showAlert}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open protocol tracker"
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{
          width: 40, height: 40, borderRadius: 12, marginRight: 12,
          backgroundColor: coach.color + '12',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Syringe size={18} color={coach.color} strokeWidth={2.5} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>Protocol</Text>
          <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>
            {acknowledged
              ? [dueText, suppText].filter(Boolean).join('  ·  ')
              : 'Tap to set up your tracker'}
          </Text>
        </View>

        <View style={{
          backgroundColor: colors.bgSubtle, borderRadius: RADIUS.sm,
          paddingHorizontal: 8, paddingVertical: 6,
        }}>
          <ArrowRight size={16} color={colors.textMuted} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>
    </GlassCard>
  );
}
