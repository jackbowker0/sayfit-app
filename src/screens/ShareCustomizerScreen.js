// ============================================================
// SHARE CUSTOMIZER SCREEN — Premium dark modal for customizing
// and sharing a workout card.
//
// Shows a live preview of the selected template, a template
// carousel, stat toggles, and share buttons.
// ============================================================

import React, { useState, useRef, useContext } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import FadeInView from '../components/FadeInView';
import { Share2, Users, X } from 'lucide-react-native';

import { useTheme } from '../hooks/useTheme';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, FONT, GLOW, getTextOnColor } from '../constants/theme';
import { DEFAULT_STAT_VISIBILITY } from '../constants/shareTemplates';
import { TEMPLATE_COMPONENTS } from '../components/ShareCardTemplates';
import ShareCardCustomizer from '../components/ShareCardCustomizer';
import GlassCard from '../components/GlassCard';
import { AuthContext } from '../context/AuthContext';
import { shareToFeed } from '../services/shareCards';
import * as haptics from '../services/haptics';
import { capture } from '../services/posthog';

export default function ShareCustomizerScreen({ navigation, route }) {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useContext(AuthContext);
  const {
    coachId, stats, elapsed, exercises, workoutName,
    streak, isLoggedWorkout, totalSets, totalVolume, units,
  } = route.params;

  const coach = COACHES[coachId];
  const cardRef = useRef();

  const [selectedTemplate, setSelectedTemplate] = useState('classic');
  const [visibility, setVisibility] = useState(
    isLoggedWorkout ? { ...DEFAULT_STAT_VISIBILITY.logged } : { ...DEFAULT_STAT_VISIBILITY.guided }
  );
  const [sharing, setSharing] = useState(false);
  const [sharingToFeed, setSharingToFeed] = useState(false);

  const muscles = [...new Set((exercises || []).map(e => e.muscle).filter(Boolean))];

  const handleToggleStat = (key) => {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    capture('share_card_customized', { stat_toggled: key });
  };

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    capture('share_card_template_selected', { template_id: templateId });
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      haptics.tap();
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(`file://${uri}`, {
        mimeType: 'image/png',
        dialogTitle: 'Share your SayFit workout',
      });
      capture('share_card_created', {
        template: selectedTemplate,
        destination: 'external',
        workout_type: isLoggedWorkout ? 'logged' : 'guided',
      });
    } catch (e) {
      console.warn('[ShareCustomizer] Share failed:', e);
    } finally {
      setSharing(false);
    }
  };

  const handleShareToFeed = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    try {
      setSharingToFeed(true);
      haptics.tap();
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await shareToFeed({
        imageUri: uri,
        workoutType: isLoggedWorkout ? 'logged' : 'guided',
        workoutName,
        coachId,
        durationSeconds: elapsed,
        calories: stats.calories || 0,
        exercisesCompleted: stats.exercisesCompleted || 0,
        muscles,
        totalSets: totalSets || 0,
        totalVolume: totalVolume || 0,
        shareCardTemplate: selectedTemplate,
        streak: streak || 0,
        visibility: 'public',
      });
      haptics.success();
      Alert.alert('Posted!', 'Your workout has been shared to the community feed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.warn('[ShareCustomizer] Feed share failed:', e);
      Alert.alert('Share failed', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setSharingToFeed(false);
    }
  };

  const TemplateComponent = TEMPLATE_COMPONENTS[selectedTemplate] || TEMPLATE_COMPONENTS.classic;
  const btnTextColor = getTextOnColor(coach.color);

  // Build merged stats object for templates
  const mergedStats = {
    ...stats,
    totalSets: totalSets || 0,
    totalVolume: totalVolume || 0,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <FadeInView style={[styles.header, { borderBottomColor: colors.glassBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <X size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Share2 size={16} color={colors.textPrimary} strokeWidth={2} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Share Card</Text>
        </View>
        <View style={styles.headerBtn} />
      </FadeInView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Live Preview */}
        <FadeInView delay={100} style={styles.previewContainer}>
          <View ref={cardRef} collapsable={false} style={styles.previewCard}>
            <TemplateComponent
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
        </FadeInView>

        {/* Customizer */}
        <FadeInView delay={200} style={styles.customizerSection}>
          <ShareCardCustomizer
            selectedTemplate={selectedTemplate}
            onSelectTemplate={handleSelectTemplate}
            visibility={visibility}
            onToggleStat={handleToggleStat}
            isLoggedWorkout={isLoggedWorkout}
            coachColor={coach.color}
          />
        </FadeInView>
      </ScrollView>

      {/* Share Buttons (fixed at bottom) */}
      <View style={[styles.bottomBar, {
        backgroundColor: isDark ? colors.glassBg : colors.bg,
        borderTopColor: colors.glassBorder,
      }]}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.shareBtn, {
              flex: 1,
              backgroundColor: coach.color,
              ...(isDark ? {
                shadowColor: coach.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: GLOW.lg,
              } : {
                shadowColor: coach.color,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }),
            }]}
            onPress={handleShare}
            disabled={sharing || sharingToFeed}
            activeOpacity={0.8}
          >
            {sharing ? (
              <ActivityIndicator color={btnTextColor} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Share2 size={18} color={btnTextColor} strokeWidth={2.5} />
                <Text style={[styles.shareBtnText, { color: btnTextColor }]}>Share</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.feedBtn, {
              borderColor: coach.color + '50',
              backgroundColor: isDark ? colors.glassBg : coach.color + '08',
            }]}
            onPress={handleShareToFeed}
            disabled={sharing || sharingToFeed}
            activeOpacity={0.7}
          >
            {sharingToFeed ? (
              <ActivityIndicator color={coach.color} size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Users size={18} color={coach.color} strokeWidth={2} />
                <Text style={[styles.feedBtnText, { color: coach.color }]}>Feed</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { minWidth: 60 },
  headerTitle: { ...FONT.heading, textAlign: 'center' },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
  },
  previewCard: {
    width: '100%',
    maxWidth: 340,
  },
  customizerSection: {
    marginBottom: SPACING.xl,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shareBtn: {
    padding: 16,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  shareBtnText: {
    ...FONT.subhead,
    fontSize: 16,
    fontWeight: '700',
  },
  feedBtn: {
    padding: 16,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  feedBtnText: {
    ...FONT.subhead,
    fontSize: 16,
    fontWeight: '700',
  },
});
