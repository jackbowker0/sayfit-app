// ============================================================
// FUEL SCREEN — "Budget" layout (redesign variant A, Jack-approved)
//
// Structure: calories-left hero (big remaining number + progress
// bar + macro bars) → Voice/Search/Scan action row → adaptive
// maintenance chip → meal diary (Breakfast/Lunch/Dinner/Snacks,
// per-item calories, quiet add per section) → manual entry as a
// collapsible fallback.
//
// Logging model: search/scan/voice all REVIEW before logging (the
// portion step / voice review IS the confirmation), so entries land
// editState 'confirmed' and count immediately. 'pending' only exists
// for future un-reviewed auto-estimates.
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
  Apple, Search, ScanBarcode, TrendingUp, Mic, Plus, ChevronDown, ChevronUp,
} from 'lucide-react-native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, FONT, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getMacroTargets, saveMacroTargets, getUserProfile } from '../services/userProfile';
import { estimateTDEE, targetsFromCalories } from '../services/energy';
import { getDailyTotals, logMeal, deleteMeal, MEAL_TYPES } from '../services/nutrition';
import { addRecentFood } from '../services/foodDb';
import * as haptics from '../services/haptics';
import { capture } from '../services/posthog';
import GlassCard from '../components/GlassCard';
import FoodSearchModal from '../components/FoodSearchModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import VoiceFoodModal from '../components/VoiceFoodModal';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

// Sensible default section for quick voice logging, by local hour.
function mealForNow() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

// Thin labeled progress bar (label left, value right). Neutral by default so
// the amber accent stays reserved; state is always label+number, never hue alone.
function MacroBar({ label, consumed, target, accent, colors }) {
  const hasTarget = typeof target === 'number' && target > 0;
  const pct = hasTarget ? Math.min(consumed / target, 1) : 0;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted }}>{label}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>
          {consumed}<Text style={{ color: colors.textMuted, fontWeight: '600' }}>{hasTarget ? `/${target}g` : 'g'}</Text>
        </Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.bgSubtle, overflow: 'hidden' }}>
        {hasTarget && (
          <View style={{ height: 5, width: `${pct * 100}%`, borderRadius: 3, backgroundColor: accent || colors.textMuted }} />
        )}
      </View>
    </View>
  );
}

export default function NutritionScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId] || COACHES.hype;
  const { colors } = useTheme();

  // ---- Data state ----
  const [dailyData, setDailyData] = useState(null);
  const [targets, setTargets] = useState({ kcal: null, protein: null, carbs: null, fat: null });
  const [energyLabel, setEnergyLabel] = useState('kcal');
  const [tdeeEst, setTdeeEst] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- Modals / flows ----
  const [foodSearchVisible, setFoodSearchVisible] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [initialFood, setInitialFood] = useState(null);   // seeds the portion step (from a scan)
  const [activeMeal, setActiveMeal] = useState('breakfast'); // which diary section is being added to
  const [pickSource, setPickSource] = useState('search');    // 'search' | 'barcode' for the log tag

  // ---- Manual entry (collapsible fallback) ----
  const [manualOpen, setManualOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [kcalInput, setKcalInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [saving, setSaving] = useState(false);

  // ---- Targets form ----
  const [setTargetMode, setSetTargetMode] = useState(false);
  const [tKcal, setTKcal] = useState('');
  const [tProtein, setTProtein] = useState('');
  const [tCarbs, setTCarbs] = useState('');
  const [tFat, setTFat] = useState('');

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    setLoading(true);
    const [daily, tgts, prof, tdee] = await Promise.all([
      getDailyTotals(), getMacroTargets(), getUserProfile(), estimateTDEE().catch(() => null),
    ]);
    setDailyData(daily);
    setTargets(tgts);
    setEnergyLabel(prof.energyLabel || 'kcal');
    setTdeeEst(tdee);
    setLoading(false);
  };

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  // ---- Targets ----
  const applyTdeeTarget = async (kcal) => {
    haptics.success();
    const t = targetsFromCalories(kcal);
    await saveMacroTargets(t);
    setTargets(t);
    await loadData();
  };

  const offerTdeeTarget = () => {
    if (!tdeeEst) return;
    haptics.tap();
    Alert.alert(
      'Update calorie target',
      `Your data says maintenance is ~${tdeeEst.tdee} ${energyLabel}/day (from ${tdeeEst.loggedDays} logged days).`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Maintain (${tdeeEst.tdee})`, onPress: () => applyTdeeTarget(tdeeEst.tdee) },
        { text: `Cut −500 (${Math.max(1000, tdeeEst.tdee - 500)})`, onPress: () => applyTdeeTarget(Math.max(1000, tdeeEst.tdee - 500)) },
      ],
    );
  };

  const openTargetForm = () => {
    haptics.tap();
    setTKcal(targets.kcal?.toString() || '');
    setTProtein(targets.protein?.toString() || '');
    setTCarbs(targets.carbs?.toString() || '');
    setTFat(targets.fat?.toString() || '');
    setSetTargetMode((v) => !v);
  };

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

  // ---- Add flows ----
  const openSearchFor = (meal) => { haptics.tap(); setActiveMeal(meal); setPickSource('search'); setInitialFood(null); setFoodSearchVisible(true); };
  const openScan = () => { haptics.tap(); setActiveMeal(mealForNow()); setScanVisible(true); };
  const openVoice = () => { haptics.tap(); setActiveMeal(mealForNow()); setVoiceVisible(true); };

  // Search/scan pick: the portion step WAS the review — log it directly, confirmed.
  const handleFoodPick = async (food, grams, macros) => {
    setFoodSearchVisible(false);
    setInitialFood(null);
    haptics.success();
    await logMeal({
      source: pickSource,
      mealType: activeMeal,
      items: [{ name: food.brand ? `${food.name} (${food.brand})` : food.name, qty: 1 }],
      macros,
      editState: 'confirmed',
    });
    capture('meal_logged', { source: pickSource, mealType: activeMeal, hasDescription: true });
    addRecentFood(food).catch(() => {});
    await loadData();
  };

  const handleScanFound = (food) => {
    setScanVisible(false);
    setPickSource('barcode');
    setInitialFood(food);
    setFoodSearchVisible(true); // jumps straight to the portion step
  };

  // ---- Manual entry ----
  const handleLog = async () => {
    const kcal = parseInt(kcalInput, 10);
    if (!kcal || kcal <= 0) { Alert.alert('Missing info', `Enter at least ${energyLabel} to log a meal.`); return; }
    haptics.success();
    setSaving(true);
    const items = description.trim() ? [{ name: description.trim(), qty: 1 }] : [];
    await logMeal({
      source: 'manual',
      mealType: activeMeal,
      items,
      macros: { kcal, protein: parseFloat(proteinInput) || 0, carbs: parseFloat(carbsInput) || 0, fat: parseFloat(fatInput) || 0 },
    });
    capture('meal_logged', { source: 'manual', mealType: activeMeal, hasDescription: items.length > 0 });
    setDescription(''); setKcalInput(''); setProteinInput(''); setCarbsInput(''); setFatInput('');
    setManualOpen(false);
    await loadData();
    setSaving(false);
  };

  // ---- Entry actions (tap a diary row) ----
  const onEntryPress = (entry) => {
    haptics.tap();
    const name = entry.items?.map((i) => i.name).join(', ') || cap(entry.mealType);
    Alert.alert(name, `${entry.macros.kcal} ${energyLabel}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { haptics.medium(); await deleteMeal(entry.id); await loadData(); },
      },
    ]);
  };

  // ---- Derived ----
  const totals = dailyData?.totals || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const entries = dailyData?.entries || [];
  const hasKcalTarget = typeof targets?.kcal === 'number' && targets.kcal > 0;
  const remaining = hasKcalTarget ? Math.max(0, targets.kcal - totals.kcal) : null;
  const overBy = hasKcalTarget && totals.kcal > targets.kcal ? totals.kcal - targets.kcal : 0;
  const pct = hasKcalTarget ? Math.min(totals.kcal / targets.kcal, 1) : 0;
  const byMeal = MEAL_TYPES.map((mt) => ({
    meal: mt,
    items: entries.filter((e) => e.mealType === mt),
  }));
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const actionBtn = (onPress, label, Icon, primary = false) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
        paddingVertical: 13, borderRadius: RADIUS.md, borderWidth: 1,
        borderColor: primary ? coach.color : colors.glassBorder,
        backgroundColor: primary ? coach.color : colors.glassBg,
      }}
    >
      <Icon size={15} color={primary ? getTextOnColor(coach.color) : coach.color} strokeWidth={2.4} />
      <Text style={{ ...FONT.caption, fontWeight: '700', color: primary ? getTextOnColor(coach.color) : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );

  // ----- Render -----
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={coach.color} />}
      >
        {/* Header */}
        <FadeInView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <Text style={{ ...FONT.title, color: colors.textPrimary }}>Fuel</Text>
          <Text style={{ ...FONT.caption, color: colors.textMuted }}>{dateStr}</Text>
        </FadeInView>

        {/* Hero — calories left */}
        <GlassCard fadeDelay={60} accentColor={coach.color}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...FONT.label, color: colors.textMuted }}>
              {hasKcalTarget ? (overBy > 0 ? `OVER TARGET (${energyLabel.toUpperCase()})` : `${energyLabel.toUpperCase()} LEFT TODAY`) : `${energyLabel.toUpperCase()} EATEN TODAY`}
            </Text>
            <TouchableOpacity onPress={openTargetForm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Edit targets">
              <Text style={{ fontSize: 11, fontWeight: '600', color: hasKcalTarget ? colors.textMuted : coach.color }}>
                {hasKcalTarget ? 'Edit targets' : 'Set a target'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 42, fontWeight: '800', letterSpacing: -1, color: colors.textPrimary, marginTop: 6, fontVariant: ['tabular-nums'] }}>
            {hasKcalTarget ? (overBy > 0 ? `+${overBy}` : remaining) : totals.kcal}
            {hasKcalTarget && (
              <Text style={{ fontSize: 15, fontWeight: '600', letterSpacing: 0, color: colors.textMuted }}>  / {targets.kcal}</Text>
            )}
          </Text>

          {hasKcalTarget && (
            <>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.bgSubtle, overflow: 'hidden', marginTop: 12 }}>
                <View style={{ height: 8, width: `${pct * 100}%`, borderRadius: 4, backgroundColor: coach.color }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ fontSize: 11.5, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>{totals.kcal} eaten</Text>
                <Text style={{ fontSize: 11.5, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>target {targets.kcal}</Text>
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <MacroBar label="PROTEIN" consumed={totals.protein} target={targets.protein} accent={coach.color} colors={colors} />
            <MacroBar label="CARBS" consumed={totals.carbs} target={targets.carbs} colors={colors} />
            <MacroBar label="FAT" consumed={totals.fat} target={targets.fat} colors={colors} />
          </View>

        </GlassCard>

        {/* Targets form (toggled) */}
        {setTargetMode && (
          <GlassCard fadeDelay={40} accentColor={coach.color}>
            <Text style={{ ...FONT.subhead, color: colors.textPrimary, marginBottom: 12 }}>Daily targets</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>{energyLabel.toUpperCase()}</Text>
                <TextInput style={inputStyle(colors)} value={tKcal} onChangeText={setTKcal} keyboardType="numeric" placeholder="2200" placeholderTextColor={colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>PROTEIN (g)</Text>
                <TextInput style={inputStyle(colors)} value={tProtein} onChangeText={setTProtein} keyboardType="decimal-pad" placeholder="180" placeholderTextColor={colors.textDim} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>CARBS (g)</Text>
                <TextInput style={inputStyle(colors)} value={tCarbs} onChangeText={setTCarbs} keyboardType="decimal-pad" placeholder="255" placeholderTextColor={colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>FAT (g)</Text>
                <TextInput style={inputStyle(colors)} value={tFat} onChangeText={setTFat} keyboardType="decimal-pad" placeholder="63" placeholderTextColor={colors.textDim} onSubmitEditing={handleSaveTargets} returnKeyType="done" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder }}
                onPress={() => { haptics.tap(); setSetTargetMode(false); }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: coach.color }}
                onPress={handleSaveTargets}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: getTextOnColor(coach.color) }}>Save targets</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Action row */}
        <FadeInView delay={90} style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md }}>
          {actionBtn(openVoice, 'Voice', Mic, true)}
          {actionBtn(() => openSearchFor(mealForNow()), 'Search', Search)}
          {actionBtn(openScan, 'Scan', ScanBarcode)}
        </FadeInView>

        {/* Adaptive maintenance chip */}
        {tdeeEst && (
          <FadeInView delay={110}>
            <TouchableOpacity onPress={offerTdeeTarget} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Update calorie target from adaptive maintenance">
              <GlassCard style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                <TrendingUp size={15} color={coach.color} strokeWidth={2.4} />
                <Text style={{ ...FONT.caption, color: colors.textSecondary, flex: 1 }}>
                  Adaptive maintenance <Text style={{ fontWeight: '700', color: colors.textPrimary }}>~{tdeeEst.tdee} {energyLabel}/day</Text>
                  {tdeeEst.confidence === 'low' ? ' · rough' : ''}
                </Text>
                <Text style={{ ...FONT.caption, fontWeight: '700', color: coach.color }}>Update target</Text>
              </GlassCard>
            </TouchableOpacity>
          </FadeInView>
        )}

        {/* Meal diary */}
        {loading ? (
          <ActivityIndicator size="large" color={coach.color} style={{ marginTop: 32 }} />
        ) : (
          byMeal.map(({ meal, items }, idx) => {
            const sectionKcal = items.reduce((s, e) => s + (e.macros?.kcal || 0), 0);
            return (
              <FadeInView key={meal} delay={130 + idx * 30}>
                <GlassCard style={{ paddingVertical: 0, paddingHorizontal: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 }}>
                    <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>{MEAL_LABELS[meal]}</Text>
                    <Text style={{ ...FONT.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>
                      {items.length ? `${sectionKcal} ${energyLabel}` : '—'}
                    </Text>
                  </View>

                  {items.length > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.glassBorder }}>
                      {items.map((entry, i) => {
                        const name = entry.items?.map((it) => it.name).join(', ') || cap(entry.mealType);
                        return (
                          <TouchableOpacity
                            key={entry.id}
                            onPress={() => onEntryPress(entry)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`${name}, ${entry.macros.kcal} ${energyLabel}`}
                            style={{
                              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11,
                              borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.glassBorder,
                            }}
                          >
                            <View style={{ flex: 1, paddingRight: 10 }}>
                              <Text style={{ fontSize: 13.5, color: colors.textPrimary }} numberOfLines={1}>{name}</Text>
                              <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                                {new Date(entry.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {entry.macros.protein > 0 ? ` · P${entry.macros.protein}` : ''}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 13.5, color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>
                              {entry.macros.kcal}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => openSearchFor(meal)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Add to ${MEAL_LABELS[meal]}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.glassBorder }}
                  >
                    <Plus size={14} color={coach.color} strokeWidth={2.6} />
                    <Text style={{ ...FONT.caption, fontWeight: '600', color: coach.color }}>
                      Add to {MEAL_LABELS[meal].toLowerCase()}
                    </Text>
                  </TouchableOpacity>
                </GlassCard>
              </FadeInView>
            );
          })
        )}

        {/* Manual entry — collapsible fallback */}
        <TouchableOpacity
          onPress={() => { haptics.tap(); setManualOpen((v) => !v); }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Enter macros manually"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
        >
          {manualOpen ? <ChevronUp size={14} color={colors.textMuted} strokeWidth={2.2} /> : <ChevronDown size={14} color={colors.textMuted} strokeWidth={2.2} />}
          <Text style={{ ...FONT.caption, color: colors.textMuted }}>Enter macros manually</Text>
        </TouchableOpacity>

        {manualOpen && (
          <GlassCard accentColor={coach.color}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {MEAL_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.round,
                    backgroundColor: activeMeal === mt ? coach.color : colors.glassBg,
                    borderWidth: 1, borderColor: activeMeal === mt ? coach.color : colors.glassBorder,
                  }}
                  onPress={() => { haptics.tick(); setActiveMeal(mt); }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: activeMeal === mt ? getTextOnColor(coach.color) : colors.textSecondary }}>
                    {MEAL_LABELS[mt]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[inputStyle(colors), { marginBottom: 10 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Food description (optional)"
              placeholderTextColor={colors.textDim}
              maxLength={80}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <View style={{ flex: 1.4 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>{energyLabel.toUpperCase()} *</Text>
                <TextInput style={inputStyle(colors)} value={kcalInput} onChangeText={setKcalInput} keyboardType="numeric" placeholder="450" placeholderTextColor={colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>PROTEIN g</Text>
                <TextInput style={inputStyle(colors)} value={proteinInput} onChangeText={setProteinInput} keyboardType="decimal-pad" placeholder="30" placeholderTextColor={colors.textDim} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>CARBS g</Text>
                <TextInput style={inputStyle(colors)} value={carbsInput} onChangeText={setCarbsInput} keyboardType="decimal-pad" placeholder="50" placeholderTextColor={colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>FAT g</Text>
                <TextInput style={inputStyle(colors)} value={fatInput} onChangeText={setFatInput} keyboardType="decimal-pad" placeholder="15" placeholderTextColor={colors.textDim} onSubmitEditing={handleLog} returnKeyType="done" />
              </View>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: kcalInput ? coach.color : colors.bgSubtle, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center' }}
              onPress={handleLog}
              disabled={saving || !kcalInput}
              accessibilityRole="button"
              accessibilityLabel="Log meal"
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: kcalInput ? getTextOnColor(coach.color) : colors.textDim }}>
                {saving ? 'Saving…' : `Log to ${MEAL_LABELS[activeMeal].toLowerCase()}`}
              </Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* Empty-day nudge */}
        {!loading && entries.length === 0 && (
          <FadeInView delay={260} style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Apple size={22} color={colors.textMuted} strokeWidth={1.6} />
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 8 }}>
              Nothing logged yet — speak it, search it, or scan it.
            </Text>
          </FadeInView>
        )}
      </ScrollView>

      <FoodSearchModal
        visible={foodSearchVisible}
        onClose={() => { setFoodSearchVisible(false); setInitialFood(null); }}
        onPick={handleFoodPick}
        coachColor={coach.color}
        colors={colors}
        initialFood={initialFood}
        energyLabel={energyLabel}
      />

      <BarcodeScannerModal
        visible={scanVisible}
        onClose={() => setScanVisible(false)}
        onFound={handleScanFound}
        coachColor={coach.color}
        colors={colors}
      />

      <VoiceFoodModal
        visible={voiceVisible}
        onClose={() => setVoiceVisible(false)}
        onLogged={loadData}
        mealType={activeMeal}
        coachColor={coach.color}
        colors={colors}
        energyLabel={energyLabel}
      />
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
