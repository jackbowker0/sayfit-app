// ============================================================
// EXERCISE NOTE EDITOR — Per-exercise settings modal
//
// Slide-up modal for saving machine settings, weight, angles,
// seat positions, and personal tips for any exercise.
// Notes persist and show up next time the exercise appears.
//
// Usage:
//   <ExerciseNoteEditor
//     visible={showEditor}
//     exerciseId="pec-deck"
//     exerciseName="Pec Deck"
//     coachColor="#FF6B35"
//     onClose={() => setShowEditor(false)}
//     onSave={(noteData) => handleNoteSaved(noteData)}
//   />
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  Animated, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { X, Trash2, Info, ClipboardList } from 'lucide-react-native';

import { getExerciseNote, saveExerciseNote, deleteExerciseNote } from '../services/exerciseNotes';
import { getMuscleIcon } from '../constants/icons';
import { RADIUS, SPACING, FONT, GLOW } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import * as haptics from '../services/haptics';

export default function ExerciseNoteEditor({
  visible,
  exerciseId,
  exerciseName,
  exerciseIcon,
  coachColor = '#FF6B35',
  onClose,
  onSave,
}) {
  const { colors, isDark } = useTheme();
  const [notes, setNotes] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [existingNote, setExistingNote] = useState(null);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Use ClipboardList as default icon
  const NoteIcon = ClipboardList;

  // ---- LOAD EXISTING NOTE ----

  useEffect(() => {
    if (visible && exerciseId) {
      setLoading(true);
      getExerciseNote(exerciseId).then(note => {
        if (note) {
          setNotes(note.notes || '');
          setWeight(note.weight || '');
          setExistingNote(note);
        } else {
          setNotes('');
          setWeight('');
          setExistingNote(null);
        }
        setLoading(false);
      });
    }
  }, [visible, exerciseId]);

  // ---- ANIMATIONS ----

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // ---- SAVE ----

  const handleSave = useCallback(async () => {
    if (!notes.trim() && !weight.trim()) return;

    haptics.success();
    const saved = await saveExerciseNote(exerciseId, {
      notes: notes.trim(),
      weight: weight.trim(),
    });

    if (onSave) onSave(saved);
    onClose();
  }, [exerciseId, notes, weight, onSave, onClose]);

  // ---- DELETE ----

  const handleDelete = useCallback(async () => {
    haptics.warning();
    await deleteExerciseNote(exerciseId);
    setNotes('');
    setWeight('');
    setExistingNote(null);
    if (onSave) onSave(null);
    onClose();
  }, [exerciseId, onSave, onClose]);

  // ---- QUICK TEMPLATES ----

  const quickTags = [
    'Seat #', 'Handle position', 'Angle:', 'Grip:', 'Form cue:',
    'Use mirror', 'Slow eccentric', 'Pause at bottom',
  ];

  const handleQuickTag = (tag) => {
    haptics.tap();
    const prefix = notes.trim() ? notes.trim() + '\n' : '';
    setNotes(prefix + tag + ' ');
  };

  // ---- RENDER ----

  if (!visible) return null;

  const hasChanges = notes.trim() || weight.trim();
  const hasExisting = existingNote && (existingNote.notes || existingNote.weight);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View
        style={{
          ...absoluteFill,
          backgroundColor: 'rgba(0,0,0,0.6)',
          opacity: backdropAnim,
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={{
          backgroundColor: colors.bgSheet || colors.bgElevated,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
          paddingHorizontal: SPACING.lg,
          transform: [{ translateY: slideAnim }],
          borderTopWidth: 1,
          borderColor: colors.glassBorder,
          shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: -5 },
          elevation: 20,
        }}>
          {/* Handle bar */}
          <View style={{
            width: 36, height: 4, borderRadius: 2,
            backgroundColor: colors.bgSheetHandle || (colors.textDim + '40'),
            alignSelf: 'center', marginBottom: 16,
          }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: coachColor + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12,
              ...(isDark ? {
                shadowColor: coachColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.15,
                shadowRadius: GLOW.sm,
              } : {}),
            }}>
              <NoteIcon size={22} color={coachColor} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...FONT.subhead, fontSize: 18, color: colors.textPrimary }}>{exerciseName}</Text>
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>My Settings</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: colors.glassBg,
                borderWidth: 1, borderColor: colors.glassBorder,
                justifyContent: 'center', alignItems: 'center',
              }}
              accessibilityLabel="Close"
            >
              <X size={16} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Last used info */}
          {existingNote?.lastUsed && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginBottom: 16,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm,
              backgroundColor: coachColor + '08', borderWidth: 1, borderColor: coachColor + '15',
              gap: 6,
            }}>
              <Info size={13} color={coachColor} strokeWidth={2} />
              <Text style={{ ...FONT.caption, color: coachColor }}>
                Last used: {new Date(existingNote.lastUsed).toLocaleDateString()}
                {existingNote.weight ? ` \u00B7 Weight: ${existingNote.weight}` : ''}
              </Text>
            </View>
          )}

          {/* Weight field */}
          <Text style={{ ...FONT.label, fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
            WEIGHT / RESISTANCE
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.glassBg, borderRadius: RADIUS.md,
              borderWidth: 1, borderColor: colors.glassBorder,
              paddingHorizontal: 14, paddingVertical: 12,
              color: colors.textPrimary, fontSize: 16, marginBottom: 16,
              minHeight: 44,
            }}
            placeholder="e.g. 25 lbs, Band: Medium, Bodyweight"
            placeholderTextColor={colors.textDim}
            value={weight}
            onChangeText={setWeight}
            accessibilityLabel="Weight or resistance used"
          />

          {/* Weight history */}
          {existingNote?.history?.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ ...FONT.label, fontSize: 11, color: colors.textDim, marginBottom: 6 }}>WEIGHT HISTORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {existingNote.history.slice(0, 5).map((h, i) => (
                  <View key={i} style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                    backgroundColor: colors.glassBg, marginRight: 6,
                    borderWidth: 1, borderColor: colors.glassBorder,
                  }}>
                    <Text style={{ ...FONT.caption, fontWeight: '600', color: colors.textSecondary }}>{h.weight}</Text>
                    <Text style={{ fontSize: 9, color: colors.textDim, marginTop: 1 }}>
                      {new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Notes field */}
          <Text style={{ ...FONT.label, fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
            MACHINE SETTINGS & NOTES
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.glassBg, borderRadius: RADIUS.md,
              borderWidth: 1, borderColor: colors.glassBorder,
              paddingHorizontal: 14, paddingVertical: 12,
              color: colors.textPrimary, ...FONT.body, fontSize: 15,
              minHeight: 80, textAlignVertical: 'top', marginBottom: 10,
            }}
            placeholder="Seat position, handle height, angle, personal form cues..."
            placeholderTextColor={colors.textDim}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
            accessibilityLabel="Exercise notes and machine settings"
          />

          {/* Quick tags */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {quickTags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: 14, backgroundColor: colors.glassBg,
                  borderWidth: 1, borderColor: colors.glassBorder, marginRight: 6,
                }}
                onPress={() => handleQuickTag(tag)}
              >
                <Text style={{ ...FONT.caption, color: colors.textSecondary }}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {hasExisting && (
              <TouchableOpacity
                style={{
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderRadius: RADIUS.md, backgroundColor: colors.red + '10',
                  borderWidth: 1, borderColor: colors.red + '20', minHeight: 48,
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={handleDelete}
                accessibilityLabel="Delete exercise notes"
              >
                <Trash2 size={16} color={colors.red} strokeWidth={2} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                flex: 1, paddingVertical: 14, borderRadius: RADIUS.md,
                backgroundColor: hasChanges ? coachColor : colors.bgSubtle,
                alignItems: 'center', minHeight: 48, justifyContent: 'center',
                opacity: hasChanges ? 1 : 0.5,
                ...(hasChanges && isDark ? {
                  shadowColor: coachColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: GLOW.md,
                } : {}),
              }}
              onPress={handleSave}
              disabled={!hasChanges}
              accessibilityLabel="Save exercise notes"
            >
              <Text style={{
                ...FONT.subhead, fontSize: 16,
                color: hasChanges ? '#fff' : colors.textDim,
              }}>
                {hasExisting ? 'Update Settings' : 'Save Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const absoluteFill = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
};
