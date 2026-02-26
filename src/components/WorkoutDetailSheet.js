// ============================================================
// WORKOUT DETAIL SHEET — Slide-up modal for past workouts
//
// Shows full breakdown: exercises, sets, reps, weight, PRs.
// Triggered by tapping any workout row on Dashboard or Calendar.
// ============================================================

import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  Animated, Dimensions, TouchableWithoutFeedback, Platform, Alert,
} from 'react-native';
import {
  Trophy, RefreshCw, Trash2, X,
} from 'lucide-react-native';

import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import { SPACING, RADIUS, FONT, GLOW, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useWorkoutContext } from '../context/WorkoutContext';
import { formatTime } from '../utils/helpers';
import * as haptics from '../services/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WorkoutDetailSheet({ workout, visible, onClose, onDoAgain, onDelete }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[workout?.coach || coachId] || COACHES[coachId];
  const CoachIcon = COACH_ICONS[workout?.coach || coachId] || COACH_ICONS[coachId];
  const { colors, isDark } = useTheme();

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 25, stiffness: 300 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!workout) return null;

  const workoutDate = new Date(workout.date);
  const dateStr = workoutDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeStr = workoutDate.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });

  const exercises = workout.exercises || [];
  const muscles = workout.muscles || [];
  const hasPR = exercises.some(ex =>
    (ex.sets || []).some(s => s.isPR || s.pr)
  );

  // Calculate total volume (sets x reps x weight)
  const totalVolume = exercises.reduce((total, ex) => {
    return total + (ex.sets || []).reduce((setTotal, s) => {
      const reps = s.reps || 0;
      const weight = s.weight || 0;
      return setTotal + (reps * weight);
    }, 0);
  }, 0);

  const totalSets = exercises.reduce((total, ex) => total + (ex.sets?.length || 0), 0);

  const handleClose = () => {
    haptics.tap();
    onClose();
  };

  const statBox = (value, label, color) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{
        ...FONT.stat, fontSize: 20, color: color || colors.textPrimary,
      }}>
        {value}
      </Text>
      <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );

  const formatWeight = (weight) => {
    if (!weight || weight === 0) return 'BW';
    return `${weight}`;
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={{
          flex: 1, backgroundColor: colors.bgOverlay,
          opacity: backdropAnim,
        }} />
      </TouchableWithoutFeedback>

      <Animated.View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        maxHeight: SCREEN_HEIGHT * 0.85,
        backgroundColor: colors.bgSheet || colors.bgElevated,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingTop: 12,
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
          alignSelf: 'center', marginBottom: 16,
        }} />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: coach.color + '15',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <CoachIcon size={18} color={coach.color} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.heading, color: colors.textPrimary }}>
                  {workout.name || 'Workout'}
                </Text>
                {hasPR && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
                  }}>
                    <Trophy size={12} color={colors.orange || '#FF6B35'} strokeWidth={2.5} />
                    <Text style={{ ...FONT.label, fontSize: 11, color: colors.orange || '#FF6B35' }}>
                      PR SET
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 4 }}>
              {dateStr} \u00B7 {timeStr}
            </Text>
            {muscles.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {muscles.map(m => (
                  <View key={m} style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm,
                    backgroundColor: coach.color + '12', borderWidth: 1, borderColor: coach.color + '25',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: coach.color }}>{m}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Stats row */}
          <View style={{
            flexDirection: 'row', paddingVertical: 16,
            borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.glassBorder,
            marginBottom: 20,
          }}>
            {statBox(formatTime(workout.elapsed || 0), 'DURATION', coach.color)}
            {statBox(workout.calories || 0, 'CALORIES')}
            {statBox(totalSets || workout.exerciseCount || 0, totalSets ? 'SETS' : 'EXERCISES')}
            {totalVolume > 0 && statBox(
              totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume,
              'VOLUME (LBS)'
            )}
          </View>

          {/* Exercise List */}
          {exercises.length > 0 ? (
            <>
              <Text style={{
                ...FONT.label, color: colors.textMuted, marginBottom: 12,
              }}>
                EXERCISES ({exercises.length})
              </Text>

              {exercises.map((ex, i) => {
                const sets = ex.sets || [];
                const hasWeight = sets.some(s => s.weight && s.weight > 0);
                const exercisePR = sets.some(s => s.isPR || s.pr);

                return (
                  <View key={ex.id || i} style={{
                    marginBottom: 16, paddingBottom: 16,
                    borderBottomWidth: i < exercises.length - 1 ? 1 : 0,
                    borderBottomColor: colors.glassBorder,
                  }}>
                    {/* Exercise name */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{
                        width: 24, height: 24, borderRadius: 7,
                        backgroundColor: colors.bgSubtle,
                        alignItems: 'center', justifyContent: 'center', marginRight: 10,
                      }}>
                        <Text style={{ ...FONT.label, fontSize: 11, color: colors.textMuted }}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={{
                        flex: 1, ...FONT.subhead, fontSize: 15, color: colors.textPrimary,
                      }}>
                        {ex.name || ex.exercise || 'Exercise'}
                      </Text>
                      {exercisePR && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Trophy size={12} color={colors.orange || '#FF6B35'} strokeWidth={2.5} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.orange || '#FF6B35' }}>
                            PR
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Sets table */}
                    {sets.length > 0 ? (
                      <View style={{ marginLeft: 34 }}>
                        {/* Table header */}
                        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                          <Text style={{ width: 40, ...FONT.label, fontSize: 10, color: colors.textDim }}>SET</Text>
                          {hasWeight && (
                            <Text style={{ flex: 1, ...FONT.label, fontSize: 10, color: colors.textDim }}>WEIGHT</Text>
                          )}
                          <Text style={{ flex: 1, ...FONT.label, fontSize: 10, color: colors.textDim }}>REPS</Text>
                          {sets.some(s => s.time) && (
                            <Text style={{ flex: 1, ...FONT.label, fontSize: 10, color: colors.textDim }}>TIME</Text>
                          )}
                        </View>
                        {/* Set rows */}
                        {sets.map((s, si) => {
                          const isPR = s.isPR || s.pr;
                          return (
                            <View key={si} style={{
                              flexDirection: 'row', alignItems: 'center',
                              paddingVertical: 4,
                              backgroundColor: isPR ? (colors.orange || '#FF6B35') + '08' : 'transparent',
                              borderRadius: 4, marginHorizontal: -4, paddingHorizontal: 4,
                            }}>
                              <Text style={{
                                width: 40, fontSize: 13, color: colors.textMuted,
                                fontVariant: ['tabular-nums'],
                              }}>
                                {si + 1}
                              </Text>
                              {hasWeight && (
                                <Text style={{
                                  flex: 1, fontSize: 13, fontWeight: '600',
                                  color: isPR ? (colors.orange || '#FF6B35') : colors.textPrimary,
                                  fontVariant: ['tabular-nums'],
                                }}>
                                  {formatWeight(s.weight)} {s.weight > 0 ? 'lbs' : ''}
                                </Text>
                              )}
                              <Text style={{
                                flex: 1, fontSize: 13, fontWeight: '500',
                                color: colors.textSecondary,
                                fontVariant: ['tabular-nums'],
                              }}>
                                {s.reps || '\u2014'}
                              </Text>
                              {sets.some(ss => ss.time) && (
                                <Text style={{
                                  flex: 1, fontSize: 13, color: colors.textSecondary,
                                  fontVariant: ['tabular-nums'],
                                }}>
                                  {s.time ? formatTime(s.time) : '\u2014'}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      // Fallback for exercises without detailed set data
                      <View style={{ marginLeft: 34 }}>
                        {ex.duration && (
                          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                            {formatTime(ex.duration)}
                          </Text>
                        )}
                        {ex.reps && (
                          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                            {ex.sets_count || 1} \u00D7 {ex.reps} reps
                            {ex.weight ? ` @ ${ex.weight} lbs` : ''}
                          </Text>
                        )}
                        {!ex.duration && !ex.reps && (
                          <Text style={{ fontSize: 12, color: colors.textDim, fontStyle: 'italic' }}>
                            Completed
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          ) : (
            // No exercise detail available
            <View style={{
              alignItems: 'center', paddingVertical: 24,
              borderTopWidth: 1, borderTopColor: colors.glassBorder,
            }}>
              <Text style={{ fontSize: 14, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' }}>
                {workout.exerciseCount
                  ? `${workout.exerciseCount} exercises completed`
                  : 'Workout completed'
                }
              </Text>
              <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 4, textAlign: 'center' }}>
                Detailed exercise data not available for this workout
              </Text>
            </View>
          )}

          {/* Footer actions */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            {onDoAgain && exercises.length > 0 && (
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg,
                  backgroundColor: coach.color, alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                  ...(isDark ? {
                    shadowColor: coach.color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.3,
                    shadowRadius: GLOW.md,
                  } : {}),
                }}
                onPress={() => {
                  haptics.medium();
                  onClose();
                  onDoAgain(workout);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Do this workout again"
              >
                <RefreshCw size={15} color={getTextOnColor(coach.color)} strokeWidth={2.5} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: getTextOnColor(coach.color) }}>
                  Do Again
                </Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={{
                  paddingVertical: 14, paddingHorizontal: 16,
                  borderRadius: RADIUS.lg, backgroundColor: colors.red + '10',
                  alignItems: 'center', borderWidth: 1, borderColor: colors.red + '25',
                  flexDirection: 'row', justifyContent: 'center', gap: 5,
                }}
                onPress={() => {
                  Alert.alert('Delete Workout', 'Are you sure you want to delete this workout? This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => { haptics.warning(); onDelete(workout); } },
                  ]);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete this workout"
              >
                <Trash2 size={14} color={colors.red} strokeWidth={2} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.red }}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                flex: onDoAgain && exercises.length > 0 ? 0 : 1,
                paddingVertical: 14, paddingHorizontal: 20,
                borderRadius: RADIUS.lg, backgroundColor: colors.glassBg,
                alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorder,
                flexDirection: 'row', justifyContent: 'center', gap: 5,
              }}
              onPress={handleClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close workout details"
            >
              <X size={15} color={colors.textSecondary} strokeWidth={2} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
