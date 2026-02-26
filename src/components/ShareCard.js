// ============================================================
// SHARE CARD — Post-workout shareable image card
//
// Now supports multiple templates via the ShareCardTemplates
// system. Defaults to "classic" template for backward compat.
// The "Customize" button opens the ShareCustomizerScreen.
// ============================================================

import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Share2, Palette } from 'lucide-react-native';

import { COACHES } from '../constants/coaches';
import { RADIUS, FONT, getTextOnColor, SPACING } from '../constants/theme';
import { DEFAULT_STAT_VISIBILITY } from '../constants/shareTemplates';
import { ClassicTemplate } from './ShareCardTemplates';
import { useTheme } from '../hooks/useTheme';
import { capture } from '../services/posthog';

export default function ShareCard({
  coachId,
  stats,
  elapsed,
  exercises,
  workoutName,
  streak,
  isLoggedWorkout = false,
  totalSets = 0,
  totalVolume = 0,
  units = 'lbs',
  navigation,
}) {
  const cardRef = useRef();
  const [sharing, setSharing] = useState(false);
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const muscles = [...new Set((exercises || []).map(e => e.muscle).filter(Boolean))];
  const visibility = isLoggedWorkout ? DEFAULT_STAT_VISIBILITY.logged : DEFAULT_STAT_VISIBILITY.guided;

  const mergedStats = {
    ...stats,
    totalSets,
    totalVolume,
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(`file://${uri}`, {
        mimeType: 'image/png',
        dialogTitle: 'Share your SayFit workout',
      });
      capture('share_card_created', {
        template: 'classic',
        destination: 'external',
        workout_type: isLoggedWorkout ? 'logged' : 'guided',
      });
    } catch (e) {
      console.warn('[ShareCard] Share failed:', e);
    } finally {
      setSharing(false);
    }
  };

  const handleCustomize = () => {
    if (navigation) {
      navigation.navigate('ShareCustomizer', {
        coachId, stats, elapsed, exercises, workoutName,
        streak, isLoggedWorkout, totalSets, totalVolume, units,
      });
    }
  };

  const btnTextColor = getTextOnColor(coach.color);

  return (
    <View style={styles.wrapper}>
      {/* ---- THE CARD (captured as image) ---- */}
      <View ref={cardRef} collapsable={false}>
        <ClassicTemplate
          coachId={coachId}
          stats={mergedStats}
          elapsed={elapsed}
          muscles={muscles}
          workoutName={workoutName}
          streak={streak}
          visibility={visibility}
          isLoggedWorkout={isLoggedWorkout}
        />
      </View>

      {/* ---- BUTTONS ---- */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.shareBtn, {
            backgroundColor: coach.color,
            flex: navigation ? 1 : undefined,
            ...(!isDark ? {
              shadowColor: coach.color,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            } : {}),
          }]}
          onPress={handleShare}
          activeOpacity={0.8}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator color={btnTextColor} />
          ) : (
            <View style={styles.btnContent}>
              <Share2 size={16} color={btnTextColor} strokeWidth={2.5} />
              <Text style={[styles.shareBtnText, { color: btnTextColor }]}>Share</Text>
            </View>
          )}
        </TouchableOpacity>

        {navigation && (
          <TouchableOpacity
            style={[styles.customizeBtn, {
              borderColor: isDark ? colors.glassBorder : coach.color + '30',
              backgroundColor: isDark ? colors.glassBg : coach.color + '08',
            }]}
            onPress={handleCustomize}
            activeOpacity={0.7}
          >
            <View style={styles.btnContent}>
              <Palette size={16} color={coach.color} strokeWidth={2.5} />
              <Text style={[styles.customizeBtnText, { color: coach.color }]}>Customize</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginBottom: 16 },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  shareBtn: {
    padding: 16,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  shareBtnText: {
    ...FONT.subhead,
    fontWeight: '700',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  customizeBtn: {
    padding: 16,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  customizeBtnText: {
    ...FONT.subhead,
    fontWeight: '700',
  },
});
