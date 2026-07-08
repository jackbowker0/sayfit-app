// ============================================================
// QuickAddMic — universal quick-add voice control (Phase-2 IA)
//
// A floating amber mic FAB rendered on the Home + Train hubs. One
// tap jumps straight into voice logging (LogWorkout with a
// startVoice param the log screen auto-consumes). Absolute-
// positioned so it floats over the ScrollView but inside the
// screen's SafeAreaView — kept at screen level (not the tab
// navigator) so it only appears where it's mounted and the
// navigate() target rides the local navigation prop.
//
// The bottom offset clears the 85pt tab bar via useSafeAreaInsets;
// both host hubs use ScrollView paddingBottom:100 so the FAB never
// covers the last tile. Amber circle = coach.color; icon color from
// getTextOnColor(). No glow (dark mode uses solid surfaces).
// ============================================================

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic } from 'lucide-react-native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import * as haptics from '../services/haptics';

export default function QuickAddMic({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      onPress={() => {
        haptics.medium();
        navigation.navigate('LogWorkout', { startVoice: true });
      }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Quick voice log"
      style={{
        position: 'absolute',
        right: SPACING.lg,
        // Clear the 85pt tab bar (iOS bakes safe-area into that height,
        // Android needs a little extra lift).
        bottom: 85 + 16 + (insets.bottom > 0 ? 0 : 8),
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: coach.color,
        alignItems: 'center',
        justifyContent: 'center',
        // Light-mode soft shadow to match the card convention; no glow in dark.
        ...(!isDark ? {
          shadowColor: 'rgba(0,0,0,0.18)',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 4,
        } : { elevation: 4 }),
      }}
    >
      <Mic size={26} color={getTextOnColor(coach.color)} strokeWidth={2} />
    </TouchableOpacity>
  );
}
