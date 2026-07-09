// ============================================================
// NUTRITION SCREEN — Manual meal & macro tracker
//
// Mirrors WeightScreen: stats header, add-meal form, entry list
// with delete. Targets sourced from userProfile.getMacroTargets;
// if unset, a "Set targets" affordance lets the user save them.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import FadeInView from '../components/FadeInView';
import {
  UtensilsCrossed, Flame, Beef, Apple, Trash2,
} from 'lucide-react-native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, FONT, GLOW, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getMacroTargets, saveMacroTargets } from '../services/userProfile';
import { getDailyTotals, logMeal, deleteMeal, MEAL_TYPES } from '../services/nutrition';
import * as haptics from '../services/haptics';
import { capture } from '../services/posthog';
import GlassCard from '../components/GlassCard';

// Capitalise first letter
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- MacroBar: small progress indicator ----
function MacroBar({ label, consumed, target, color, colors }) {
  const hasTarget = typeof target === 'number' && target > 0;
  const pct = hasTarget ? Math.min(consumed / target, 1) : 0;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted }}>{label}</Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color, fontVariant: ['tabular-nums'] }}>
          {consumed}{hasTarget ? `/${target}` : ''}
        </Text>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.glassBorder, overflow: 'hidden' }}>
        {hasTarget && (
          <View style={{ height: 4, width: `${pct * 100}%`, borderRadius: 2, backgroundColor: color }} />
        )}
      </View>
    </View>
  );
}

export default function NutritionScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  // ---- Data state ----
  const [dailyData, setDailyData] = useState(null);
  const [targets, setTargets] = useState({ kcal: null, protein: null, carbs: null, fat: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- Add-meal form state ----
  const [mealType, setMealType] = useState('breakfast');
  const [description, setDescription] = useState('');
  const [kcalInput, setKcalInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [saving, setSaving] = useState(false);

  // ---- Set-targets form (only visible when targets unset) ----
  const [setTargetMode, setSetTargetMode] = useState(false);
  const [tKcal, setTKcal] = useState('');
  const [tProtein, setTProtein] = useState('');
  const [tCarbs, setTCarbs] = useState('');
  const [tFat, setTFat] = useState('');

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    setLoading(true);
    const [daily, tgts] = await Promise.all([getDailyTotals(), getMacroTargets()]);
    setDailyData(daily);
    setTargets(tgts);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ---- Save macro targets ----
  const handleSaveTargets = async () => {
    const t = {
      kcal: parseInt(tKcal, 10) || null,
      protein: parseFloat(tProtein) || null,
      carbs: parseFloat(tCarbs) || null,
      fat: parseFloat(tFat) || null,
    };
    haptics.success();
    await saveMacroTargets(t);
    setTargets(t);
    setSetTargetMode(false);
  };

  // ---- Log a meal ----
  const handleLog = async () => {
    const kcal = parseInt(kcalInput, 10);
    const protein = parseFloat(proteinInput) || 0;
    const carbs = parseFloat(carbsInput) || 0;
    const fat = parseFloat(fatInput) || 0;

    if (!kcal || kcal <= 0) {
      Alert.alert('Missing info', 'Enter at least kcal to log a meal.');
      return;
    }
    haptics.success();
    setSaving(true);
    const items = description.trim() ? [{ name: description.trim(), qty: 1 }] : [];
    await logMeal({
      source: 'manual',
      mealType,
      items,
      macros: { kcal, protein, carbs, fat },
    });
    // Analytics must NOT carry the actual macro values (dietary health data).
    // Keep only the meal type + whether a description was added.
    capture('meal_logged', {
      source: 'manual',
      mealType,
      hasDescription: items.length > 0,
    });
    // Reset form
    setDescription('');
    setKcalInput('');
    setProteinInput('');
    setCarbsInput('');
    setFatInput('');
    await loadData();
    setSaving(false);
  };

  // ---- Delete a meal ----
  const handleDelete = (entry) => {
    haptics.tap();
    Alert.alert(
      'Delete meal',
      `Remove ${cap(entry.mealType)} from today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            haptics.medium();
            await deleteMeal(entry.id);
            await loadData();
          },
        },
      ]
    );
  };

  const totals = dailyData?.totals || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const entries = dailyData?.entries || [];
  const hasTargets = targets && (targets.kcal || targets.protein);

  // ----- Render -----
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={coach.color} />
        }
      >

        {/* ---- Header ---- */}
        <FadeInView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <UtensilsCrossed size={24} color={coach.color} strokeWidth={2} />
              <Text style={{ ...FONT.title, color: colors.textPrimary }}>Nutrition</Text>
            </View>
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 4, marginLeft: 34 }}>
              Track your meals and macros
            </Text>
          </View>
        </FadeInView>

        {/* ---- Today's totals header card ---- */}
        <GlassCard fadeDelay={80} accentColor={coach.color} glow>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ ...FONT.label, color: colors.textMuted }}>Today</Text>
            {!hasTargets && (
              <TouchableOpacity
                onPress={() => { haptics.tap(); setSetTargetMode(v => !v); }}
                style={{
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: RADIUS.sm, backgroundColor: coach.color + '18',
                  borderWidth: 1, borderColor: coach.color + '35',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: coach.color }}>Set targets</Text>
              </TouchableOpacity>
            )}
            {hasTargets && (
              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  setTKcal(targets.kcal?.toString() || '');
                  setTProtein(targets.protein?.toString() || '');
                  setTCarbs(targets.carbs?.toString() || '');
                  setTFat(targets.fat?.toString() || '');
                  setSetTargetMode(v => !v);
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>Edit targets</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Primary: kcal + protein */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
            <GlassCard style={{ flex: 1, alignItems: 'center', marginBottom: 0 }} accentColor={coach.color} glow>
              <Flame size={14} color={coach.color} strokeWidth={2.5} style={{ marginBottom: 4 }} />
              <Text style={{ ...FONT.stat, color: coach.color }}>{totals.kcal}</Text>
              {targets.kcal ? (
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                  / {targets.kcal} KCAL
                </Text>
              ) : (
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>KCAL</Text>
              )}
            </GlassCard>
            <GlassCard style={{ flex: 1, alignItems: 'center', marginBottom: 0 }} accentColor={colors.blue}>
              <Beef size={14} color={colors.blue} strokeWidth={2.5} style={{ marginBottom: 4 }} />
              <Text style={{ ...FONT.stat, color: colors.blue }}>{totals.protein}g</Text>
              {targets.protein ? (
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                  / {targets.protein}g PROTEIN
                </Text>
              ) : (
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>PROTEIN</Text>
              )}
            </GlassCard>
          </View>

          {/* Secondary: carbs + fat macro bars */}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <MacroBar
              label="CARBS"
              consumed={totals.carbs}
              target={targets.carbs}
              color={colors.orange}
              colors={colors}
            />
            <MacroBar
              label="FAT"
              consumed={totals.fat}
              target={targets.fat}
              color={colors.yellow}
              colors={colors}
            />
          </View>

          {/* Pending note */}
          {dailyData?.pendingCount > 0 && (
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 8 }}>
              {dailyData.pendingCount} pending meal{dailyData.pendingCount > 1 ? 's' : ''} (not yet confirmed)
            </Text>
          )}
        </GlassCard>

        {/* ---- Set targets inline form ---- */}
        {setTargetMode && (
          <GlassCard fadeDelay={50} accentColor={coach.color}>
            <Text style={{ ...FONT.subhead, color: colors.textPrimary, marginBottom: 12 }}>
              Daily targets
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>KCAL</Text>
                <TextInput
                  style={inputStyle(colors)}
                  value={tKcal}
                  onChangeText={setTKcal}
                  keyboardType="numeric"
                  placeholder="2000"
                  placeholderTextColor={colors.textDim}
                  returnKeyType="next"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>PROTEIN (g)</Text>
                <TextInput
                  style={inputStyle(colors)}
                  value={tProtein}
                  onChangeText={setTProtein}
                  keyboardType="decimal-pad"
                  placeholder="150"
                  placeholderTextColor={colors.textDim}
                  returnKeyType="next"
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>CARBS (g)</Text>
                <TextInput
                  style={inputStyle(colors)}
                  value={tCarbs}
                  onChangeText={setTCarbs}
                  keyboardType="decimal-pad"
                  placeholder="200"
                  placeholderTextColor={colors.textDim}
                  returnKeyType="next"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>FAT (g)</Text>
                <TextInput
                  style={inputStyle(colors)}
                  value={tFat}
                  onChangeText={setTFat}
                  keyboardType="decimal-pad"
                  placeholder="60"
                  placeholderTextColor={colors.textDim}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveTargets}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 12,
                  borderRadius: RADIUS.md, backgroundColor: colors.glassBg,
                  borderWidth: 1, borderColor: colors.glassBorder,
                }}
                onPress={() => { haptics.tap(); setSetTargetMode(false); }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 2, alignItems: 'center', paddingVertical: 12,
                  borderRadius: RADIUS.md, backgroundColor: coach.color,
                  ...(isDark ? { shadowColor: coach.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: GLOW.md } : {}),
                }}
                onPress={handleSaveTargets}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: getTextOnColor(coach.color) }}>Save targets</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* ---- Add meal form ---- */}
        <GlassCard fadeDelay={120} accentColor={coach.color}>
          <Text style={{ ...FONT.subhead, color: colors.textPrimary, marginBottom: 12 }}>Log a meal</Text>

          {/* Meal type picker */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {MEAL_TYPES.map((mt) => (
              <TouchableOpacity
                key={mt}
                style={{
                  paddingHorizontal: 12, paddingVertical: 7,
                  borderRadius: RADIUS.round,
                  backgroundColor: mealType === mt ? coach.color : colors.glassBg,
                  borderWidth: 1,
                  borderColor: mealType === mt ? coach.color : colors.glassBorder,
                }}
                onPress={() => { haptics.tick(); setMealType(mt); }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '600',
                  color: mealType === mt ? getTextOnColor(coach.color) : colors.textSecondary,
                }}>
                  {cap(mt)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description (optional) */}
          <TextInput
            style={[inputStyle(colors), { marginBottom: 10 }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Food description (optional)"
            placeholderTextColor={colors.textDim}
            maxLength={80}
            returnKeyType="next"
          />

          {/* Macro inputs */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <View style={{ flex: 1.4 }}>
              <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>KCAL *</Text>
              <TextInput
                style={inputStyle(colors)}
                value={kcalInput}
                onChangeText={setKcalInput}
                keyboardType="numeric"
                placeholder="450"
                placeholderTextColor={colors.textDim}
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>PROTEIN g</Text>
              <TextInput
                style={inputStyle(colors)}
                value={proteinInput}
                onChangeText={setProteinInput}
                keyboardType="decimal-pad"
                placeholder="30"
                placeholderTextColor={colors.textDim}
                returnKeyType="next"
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>CARBS g</Text>
              <TextInput
                style={inputStyle(colors)}
                value={carbsInput}
                onChangeText={setCarbsInput}
                keyboardType="decimal-pad"
                placeholder="50"
                placeholderTextColor={colors.textDim}
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>FAT g</Text>
              <TextInput
                style={inputStyle(colors)}
                value={fatInput}
                onChangeText={setFatInput}
                keyboardType="decimal-pad"
                placeholder="15"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
                onSubmitEditing={handleLog}
              />
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: kcalInput ? coach.color : colors.bgSubtle,
              paddingVertical: 14, borderRadius: RADIUS.md,
              alignItems: 'center',
              ...(kcalInput && isDark ? {
                shadowColor: coach.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: GLOW.md,
              } : {}),
            }}
            onPress={handleLog}
            disabled={saving || !kcalInput}
          >
            <Text style={{
              fontSize: 16, fontWeight: '700',
              color: kcalInput ? getTextOnColor(coach.color) : colors.textDim,
            }}>
              {saving ? 'Saving...' : 'Log meal'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {/* ---- Entry list or empty state ---- */}
        {loading ? (
          <ActivityIndicator size="large" color={coach.color} style={{ marginTop: 32 }} />
        ) : entries.length === 0 ? (
          <FadeInView delay={200} style={{ alignItems: 'center', paddingVertical: 40 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: colors.glassBg,
              borderWidth: 1, borderColor: colors.glassBorder,
              alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}>
              <Apple size={28} color={colors.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>No meals logged today</Text>
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 4 }}>
              Use the form above to add your first meal
            </Text>
          </FadeInView>
        ) : (
          <FadeInView delay={200}>
            <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: 12 }}>
              Today's meals
            </Text>
            <GlassCard>
              {entries.map((entry, i) => (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 13,
                    borderBottomWidth: i < entries.length - 1 ? 1 : 0,
                    borderBottomColor: colors.glassBorder,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                      {cap(entry.mealType)}
                      {entry.items?.length > 0 ? ` — ${entry.items[0].name}` : ''}
                    </Text>
                    <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>
                      {new Date(entry.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' · '}{entry.macros.kcal} kcal
                      {entry.macros.protein > 0 ? ` · ${entry.macros.protein}g P` : ''}
                      {entry.macros.carbs > 0 ? ` · ${entry.macros.carbs}g C` : ''}
                      {entry.macros.fat > 0 ? ` · ${entry.macros.fat}g F` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(entry)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ paddingLeft: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${entry.mealType} entry`}
                  >
                    <Trash2 size={16} color={colors.textMuted} strokeWidth={1.8} />
                  </TouchableOpacity>
                </View>
              ))}
            </GlassCard>
          </FadeInView>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Shared input style ----
function inputStyle(colors) {
  return {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
}
