// ============================================================
// REPORT SHEET — Modal for reporting content or users
//
// Shows a bottom sheet with report reason options.
// Used in FeedPostCard, PostDetailScreen, and UserProfileScreen.
// Premium dark UI with Lucide icons and glass-morphism.
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import {
  Flag, ShieldAlert, AlertTriangle, X as XIcon, Check, FileText,
} from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import { reportContent } from '../services/moderation';
import * as haptics from '../services/haptics';

const REASONS = [
  { id: 'spam', label: 'Spam', Icon: ShieldAlert },
  { id: 'harassment', label: 'Harassment', Icon: AlertTriangle },
  { id: 'inappropriate', label: 'Inappropriate Content', Icon: Flag },
  { id: 'misinformation', label: 'Misinformation', Icon: XIcon },
  { id: 'other', label: 'Other', Icon: FileText },
];

export default function ReportSheet({ visible, onClose, userId, postId, commentId }) {
  const { colors, isDark } = useTheme();
  const [selectedReason, setSelectedReason] = useState(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await reportContent({
        reason: selectedReason,
        details: details.trim() || undefined,
        userId,
        postId,
        commentId,
      });
      haptics.success();
      Alert.alert('Report Submitted', 'Thank you. We\'ll review this and take action if needed.');
      handleClose();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
        <View style={[styles.content, {
          backgroundColor: isDark ? colors.bgSheet : colors.bgElevated,
          borderColor: colors.glassBorder,
        }]}>
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.bgSheetHandle }]} />

          <View style={styles.titleRow}>
            <Flag size={18} color={colors.red} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Report</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Why are you reporting this?
          </Text>

          {REASONS.map(reason => {
            const ReasonIcon = reason.Icon;
            const isSelected = selectedReason === reason.id;
            return (
              <TouchableOpacity
                key={reason.id}
                style={[styles.reasonRow, {
                  backgroundColor: isSelected
                    ? (isDark ? colors.blue + '15' : colors.blue + '10')
                    : (isDark ? colors.glassBg : 'transparent'),
                  borderColor: isSelected ? colors.blue : colors.glassBorder,
                }]}
                onPress={() => { haptics.tick(); setSelectedReason(reason.id); }}
              >
                <ReasonIcon size={16} color={isSelected ? colors.blue : colors.textMuted} />
                <Text style={[styles.reasonLabel, {
                  color: isSelected ? colors.blue : colors.textPrimary,
                }]}>{reason.label}</Text>
                {isSelected && (
                  <Check size={16} color={colors.blue} />
                )}
              </TouchableOpacity>
            );
          })}

          {selectedReason && (
            <TextInput
              style={[styles.detailsInput, {
                backgroundColor: colors.bgInput,
                color: colors.textPrimary,
                borderColor: colors.glassBorder,
              }]}
              placeholder="Add details (optional)"
              placeholderTextColor={colors.textDim}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={500}
            />
          )}

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, {
                backgroundColor: isDark ? colors.glassBg : colors.bgSubtle,
                borderWidth: 1,
                borderColor: colors.glassBorder,
              }]}
              onPress={handleClose}
            >
              <XIcon size={14} color={colors.textSecondary} />
              <Text style={[{ color: colors.textSecondary, fontWeight: '600' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, {
                backgroundColor: selectedReason ? colors.red : colors.bgSubtle,
                flex: 1,
                ...(selectedReason && isDark ? {
                  shadowColor: colors.red,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.25,
                  shadowRadius: GLOW.sm,
                  elevation: 3,
                } : {}),
              }]}
              onPress={handleSubmit}
              disabled={!selectedReason || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Flag size={14} color={selectedReason ? '#fff' : colors.textMuted} />
                  <Text style={[{
                    color: selectedReason ? '#fff' : colors.textMuted,
                    fontWeight: '700',
                  }]}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    ...FONT.heading,
    textAlign: 'center',
  },
  subtitle: {
    ...FONT.body,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  reasonLabel: {
    flex: 1,
    ...FONT.body,
    fontSize: 15,
    fontWeight: '500',
  },
  detailsInput: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  buttons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
  },
});
