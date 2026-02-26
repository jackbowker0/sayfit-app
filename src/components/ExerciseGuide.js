// ============================================================
// EXERCISE GUIDE — Form guide slide-up modal
//
// Shows step-by-step instructions, tips, breathing cues,
// and modification options for any exercise. Designed for
// beginners who need to know HOW to do exercises safely.
//
// Usage:
//   <ExerciseGuide
//     visible={showGuide}
//     exercise={currentExercise}  // full exercise object from exercises.js
//     coachColor="#FF6B35"
//     onClose={() => setShowGuide(false)}
//   />
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  Animated, Platform,
} from 'react-native';

import { getExerciseById } from '../constants/exercises';
import { RADIUS, SPACING } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

export default function ExerciseGuide({
  visible,
  exercise,
  coachColor = '#FF6B35',
  onClose,
}) {
  const { colors, isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, damping: 22, stiffness: 180, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !exercise) return null;

  const steps = exercise.steps || [];
  const tips = exercise.tips || [];
  const breathe = exercise.breathe || null;
  const hasGuideData = steps.length > 0;

  // Get easier/harder swap info
  const easierEx = exercise.easierSwap ? getExerciseById(exercise.easierSwap) : null;
  const harderEx = exercise.harderSwap ? getExerciseById(exercise.harderSwap) : null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', opacity: backdropAnim,
      }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        maxHeight: '85%',
        backgroundColor: isDark ? '#0d1117' : colors.bgCard,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        transform: [{ translateY: slideAnim }],
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20,
        shadowOffset: { width: 0, height: -5 }, elevation: 20,
      }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.textDim + '40', alignSelf: 'center', marginBottom: 16 }} />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{
              width: 52, height: 52, borderRadius: 16,
              backgroundColor: coachColor + '15', justifyContent: 'center', alignItems: 'center', marginRight: 14,
            }}>
              <Text style={{ fontSize: 28 }}>{exercise.icon || '💪'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>{exercise.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>{exercise.muscle}</Text>
                {exercise.equipment !== 'none' && (
                  <>
                    <Text style={{ fontSize: 12, color: colors.textDim }}>·</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{exercise.equipment}</Text>
                  </>
                )}
                <Text style={{ fontSize: 12, color: colors.textDim }}>·</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Intensity {exercise.intensity}/10</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgSubtle, justifyContent: 'center', alignItems: 'center' }}
              accessibilityLabel="Close exercise guide"
            >
              <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 20 }}>
            {exercise.description}
          </Text>

          {/* Steps */}
          {hasGuideData ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textDim, letterSpacing: 1.5, marginBottom: 12 }}>
                HOW TO DO IT
              </Text>
              {steps.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 12 }}>
                  <View style={{
                    width: 26, height: 26, borderRadius: 13,
                    backgroundColor: coachColor + '15', justifyContent: 'center', alignItems: 'center',
                    marginRight: 12, marginTop: 1,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: coachColor }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, color: colors.textPrimary, lineHeight: 22 }}>{step}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={{
              padding: 16, borderRadius: RADIUS.md,
              backgroundColor: colors.bgSubtle, borderWidth: 1, borderColor: colors.border,
              marginBottom: 20, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
                Detailed form guide coming soon!{'\n'}For now, use the description above.
              </Text>
            </View>
          )}

          {/* Breathing */}
          {breathe && (
            <View style={{
              padding: 14, borderRadius: RADIUS.md,
              backgroundColor: '#7FDBFF' + '10', borderWidth: 1, borderColor: '#7FDBFF' + '20',
              marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10,
            }}>
              <Text style={{ fontSize: 20 }}>🌬️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#7FDBFF', letterSpacing: 1, marginBottom: 2 }}>BREATHING</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{breathe}</Text>
              </View>
            </View>
          )}

          {/* Tips */}
          {tips.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textDim, letterSpacing: 1.5, marginBottom: 10 }}>
                💡 TIPS
              </Text>
              {tips.map((tip, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'flex-start',
                  marginBottom: 8, paddingLeft: 4,
                }}>
                  <Text style={{ fontSize: 14, color: coachColor, marginRight: 8, marginTop: 1 }}>•</Text>
                  <Text style={{ flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Modifications */}
          {(easierEx || harderEx) && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textDim, letterSpacing: 1.5, marginBottom: 10 }}>
                MODIFICATIONS
              </Text>
              {easierEx && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 12, borderRadius: RADIUS.md,
                  backgroundColor: colors.green + '08', borderWidth: 1, borderColor: colors.green + '15',
                  marginBottom: 8,
                }}>
                  <Text style={{ fontSize: 16 }}>💨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green, marginBottom: 1 }}>EASIER</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{easierEx.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>{easierEx.description}</Text>
                  </View>
                </View>
              )}
              {harderEx && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 12, borderRadius: RADIUS.md,
                  backgroundColor: colors.red + '08', borderWidth: 1, borderColor: colors.red + '15',
                }}>
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.red, marginBottom: 1 }}>HARDER</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{harderEx.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>{harderEx.description}</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}