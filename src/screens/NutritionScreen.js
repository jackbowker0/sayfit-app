// ============================================================
// FUEL SCREEN — "Budget" layout, research pass 2
//
// Patterns borrowed deliberately:
//  - Cal AI / Lose It: hero = calories LEFT (big count-up number
//    + one progress ring), week strip day navigation
//  - MFP classic: meal sections with dense rows (name / detail /
//    kcal right), per-section add, section subtotals
//  - Whoop: ≥4:1 hero-to-label type ratio, color rationed to the
//    accent + semantic words (never hue alone)
//  - HIG: native action sheets for entry actions, Alert reserved
//    for blocking errors
//
// Logging model: every flow reviews before it logs (portion step /
// voice review), so entries count immediately — no confirm step.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Platform,
  Alert, ActionSheetIOS, ActivityIndicator, RefreshControl,
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
import useCountUp from '../hooks/useCountUp';
import { getMacroTargets, saveMacroTargets, getUserProfile } from '../services/userProfile';
import { estimateTDEE, targetsFromCalories } from '../services/energy';
import { getDailyTotals, logMeal, deleteMeal, MEAL_TYPES } from '../services/nutrition';
import { addRecentFood } from '../services/foodDb';
import * as haptics from '../services/haptics';
import { capture } from '../services/posthog';
import GlassCard from '../components/GlassCard';
import PressableScale from '../components/PressableScale';
import SwipeToDelete from '../components/SwipeToDelete';
import ProgressRing from '../components/ProgressRing';
import WeekStrip from '../components/WeekStrip';
import FoodSearchModal from '../components/FoodSearchModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import VoiceFoodModal from '../components/VoiceFoodModal';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '0');
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Local-timezone day key — matches nutrition.js so week-strip days line up.
function dayKeyOf(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Noon local Date for a day key — safe against DST edges when stored as ISO.
function noonOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Sensible default section for quick logging, by local hour.
function mealForNow() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

// Thin labeled progress bar (label left, fraction right). Neutral by default
// so the accent stays rationed; state is always label+number, never hue alone.
function MacroBar({ label, consumed, target, accent, colors }) {
  const hasTarget = typeof target === 'number' && target > 0;
  const pct = hasTarget ? Math.min(consumed / target, 1) : 0;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted }}>{label}</Text>
        <Text style={{ fontFamily: 'Hanken-SemiBold', fontSize: 12, color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>
          {Math.round(consumed)}<Text style={{ color: colors.textMuted }}>{hasTarget ? `/${target}g` : 'g'}</Text>
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
  const { colors, isDark } = useTheme();
  const todayKey = dayKeyOf(new Date());

  // ---- Data state ----
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [dailyData, setDailyData] = useState(null);
  const [weekLogged, setWeekLogged] = useState({}); // dayKey -> hasEntries
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

  // Last 7 days, oldest first, ending today.
  const weekKeys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return dayKeyOf(d);
  });

  const loadData = async (dayKey) => {
    setLoading(true);
    const [days, tgts, prof, tdee] = await Promise.all([
      Promise.all(weekKeys.map((k) => getDailyTotals(noonOf(k).toISOString()))),
      getMacroTargets(), getUserProfile(), estimateTDEE().catch(() => null),
    ]);
    const logged = {};
    days.forEach((d, i) => { logged[weekKeys[i]] = d.mealCount > 0; });
    setWeekLogged(logged);
    setDailyData(days[weekKeys.indexOf(dayKey)] || days[6]);
    setTargets(tgts);
    setEnergyLabel(prof.energyLabel || 'kcal');
    setTdeeEst(tdee);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadData(selectedKey); }, [selectedKey]));

  const handleRefresh = async () => { setRefreshing(true); await loadData(selectedKey); setRefreshing(false); };

  const isToday = selectedKey === todayKey;
  // Entries added while viewing a past day are stamped to that day.
  const logDateIso = isToday ? null : noonOf(selectedKey).toISOString();

  // ---- Targets ----
  const applyTdeeTarget = async (kcal) => {
    haptics.success();
    const t = targetsFromCalories(kcal);
    await saveMacroTargets(t);
    setTargets(t);
    await loadData(selectedKey);
  };

  const offerTdeeTarget = () => {
    if (!tdeeEst) return;
    const cutKcal = Math.max(1000, tdeeEst.tdee - 500);
    const message = `Your data says maintenance is ~${fmt(tdeeEst.tdee)} ${energyLabel}/day (from ${tdeeEst.loggedDays} logged days).`;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Update calorie target',
          message,
          options: ['Cancel', `Maintain — ${fmt(tdeeEst.tdee)}`, `Cut −500 — ${fmt(cutKcal)}`],
          cancelButtonIndex: 0,
          userInterfaceStyle: isDark ? 'dark' : 'light',
        },
        (i) => {
          if (i === 1) applyTdeeTarget(tdeeEst.tdee);
          if (i === 2) applyTdeeTarget(cutKcal);
        },
      );
    } else {
      Alert.alert('Update calorie target', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: `Maintain (${tdeeEst.tdee})`, onPress: () => applyTdeeTarget(tdeeEst.tdee) },
        { text: `Cut −500 (${cutKcal})`, onPress: () => applyTdeeTarget(cutKcal) },
      ]);
    }
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

  // ---- Add flows (PressableScale fires the tap haptic) ----
  const openSearchFor = (meal) => { setActiveMeal(meal); setPickSource('search'); setInitialFood(null); setFoodSearchVisible(true); };
  const openScan = () => { setActiveMeal(mealForNow()); setScanVisible(true); };
  const openVoice = () => {
    setActiveMeal(mealForNow());
    setVoiceVisible(true);
  };

  // Search/scan pick: the detail screen WAS the review — log it directly.
  // Its meal selector wins over whichever section the search started from.
  const handleFoodPick = async (food, grams, macros, meal) => {
    setFoodSearchVisible(false);
    setInitialFood(null);
    haptics.success();
    const mealType = meal || activeMeal;
    await logMeal({
      source: pickSource,
      mealType,
      items: [{ name: food.brand ? `${food.name} (${food.brand})` : food.name, qty: 1 }],
      macros,
      date: logDateIso,
    });
    capture('meal_logged', { source: pickSource, mealType, hasDescription: true });
    addRecentFood(food).catch(() => {});
    await loadData(selectedKey);
  };

  const handleScanFound = (food) => {
    setScanVisible(false);
    setPickSource('barcode');
    setInitialFood(food);
    setFoodSearchVisible(true); // jumps straight to the food detail step
  };

  // Missed barcode → fall through to text search (same meal section).
  const handleScanSearchByName = () => {
    setScanVisible(false);
    setPickSource('search');
    setInitialFood(null);
    setFoodSearchVisible(true);
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
      date: logDateIso,
    });
    capture('meal_logged', { source: 'manual', mealType: activeMeal, hasDescription: items.length > 0 });
    setDescription(''); setKcalInput(''); setProteinInput(''); setCarbsInput(''); setFatInput('');
    setManualOpen(false);
    await loadData(selectedKey);
    setSaving(false);
  };

  // ---- Entry actions (tap a diary row → native action sheet) ----
  const onEntryPress = (entry) => {
    const name = entry.items?.map((i) => i.name).join(', ') || cap(entry.mealType);
    const detail = `${fmt(entry.macros.kcal)} ${energyLabel}`
      + (entry.macros.protein > 0 ? ` · ${Math.round(entry.macros.protein)}g protein` : '');
    const doDelete = async () => { haptics.medium(); await deleteMeal(entry.id); await loadData(selectedKey); };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: name, message: detail,
          options: ['Cancel', 'Delete entry'],
          destructiveButtonIndex: 1, cancelButtonIndex: 0,
          userInterfaceStyle: isDark ? 'dark' : 'light',
        },
        (i) => { if (i === 1) doDelete(); },
      );
    } else {
      Alert.alert(name, detail, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ---- Derived ----
  const totals = dailyData?.totals || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const entries = dailyData?.entries || [];
  const hasKcalTarget = typeof targets?.kcal === 'number' && targets.kcal > 0;
  const remaining = hasKcalTarget ? Math.max(0, targets.kcal - totals.kcal) : null;
  const overBy = hasKcalTarget && totals.kcal > targets.kcal ? totals.kcal - targets.kcal : 0;
  const pct = hasKcalTarget ? Math.min(totals.kcal / targets.kcal, 1) : 0;
  const heroValue = hasKcalTarget ? (overBy > 0 ? overBy : remaining) : totals.kcal;
  const heroShown = useCountUp(heroValue);
  const byMeal = MEAL_TYPES.map((mt) => ({
    meal: mt,
    items: entries.filter((e) => e.mealType === mt),
  }));

  const selectedDate = noonOf(selectedKey);
  const dateStr = isToday
    ? 'Today'
    : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const weekDays = weekKeys.map((k) => {
    const d = noonOf(k);
    return {
      key: k,
      label: DAY_LETTERS[d.getDay()],
      num: d.getDate(),
      logged: !!weekLogged[k],
      isToday: k === todayKey,
      a11y: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    };
  });

  const actionBtn = (onPress, label, Icon, primary = false) => (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      containerStyle={{ flex: 1 }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
        paddingVertical: 13, borderRadius: RADIUS.md, borderWidth: 1,
        borderColor: primary ? coach.color : colors.glassBorder,
        backgroundColor: primary ? coach.color : colors.glassBg,
      }}
    >
      <Icon size={15} color={primary ? getTextOnColor(coach.color) : coach.color} strokeWidth={2.4} />
      <Text style={{ ...FONT.caption, fontFamily: 'Hanken-Bold', color: primary ? getTextOnColor(coach.color) : colors.textPrimary }}>{label}</Text>
    </PressableScale>
  );

  const heroLabel = hasKcalTarget
    ? (overBy > 0 ? `${energyLabel.toUpperCase()} OVER TARGET` : `${energyLabel.toUpperCase()} LEFT`)
    : `${energyLabel.toUpperCase()} EATEN`;
  const heroColor = overBy > 0 ? colors.red : colors.textPrimary;

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
        <FadeInView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <Text style={{ ...FONT.title, color: colors.textPrimary }}>Fuel</Text>
          <Text style={{ ...FONT.caption, color: colors.textMuted }}>{dateStr}</Text>
        </FadeInView>

        {/* Week strip — tap a day to view/log it */}
        <FadeInView delay={30} style={{ marginBottom: SPACING.md }}>
          <WeekStrip
            days={weekDays}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            accent={coach.color}
            colors={colors}
          />
        </FadeInView>

        {/* Hero — calories left + ring */}
        <GlassCard fadeDelay={60} accentColor={coach.color} style={{ padding: SPACING.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...FONT.label, color: colors.textMuted }}>{heroLabel}</Text>
            <PressableScale onPress={openTargetForm} haptic={null} scaleTo={0.94} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Edit targets">
              <Text style={{ ...FONT.caption, fontSize: 12, color: hasKcalTarget ? colors.textMuted : coach.color }}>
                {hasKcalTarget ? 'Edit targets' : 'Set a target'}
              </Text>
            </PressableScale>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontFamily: 'Hanken-Bold', fontSize: 58, letterSpacing: -1.6, lineHeight: 62, color: heroColor, fontVariant: ['tabular-nums'] }}>
                {overBy > 0 ? `+${fmt(heroShown)}` : fmt(heroShown)}
              </Text>
              {hasKcalTarget && (
                <Text style={{ ...FONT.caption, fontSize: 12.5, color: colors.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                  {fmt(totals.kcal)} eaten · {fmt(targets.kcal)} target
                </Text>
              )}
            </View>
            {hasKcalTarget && (
              <ProgressRing
                size={88}
                stroke={9}
                progress={overBy > 0 ? 1 : pct}
                color={overBy > 0 ? colors.red : coach.color}
                trackColor={colors.bgSubtle}
              >
                <Text style={{ fontFamily: 'Hanken-Bold', fontSize: 16, color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>
                  {Math.round(pct * 100)}
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>%</Text>
                </Text>
              </ProgressRing>
            )}
          </View>

          <View style={{ height: 1, backgroundColor: colors.glassBorder, marginTop: 16, marginBottom: 14 }} />

          <View style={{ flexDirection: 'row', gap: 12 }}>
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
              <PressableScale
                onPress={() => setSetTargetMode(false)}
                scaleTo={0.96}
                containerStyle={{ flex: 1 }}
                style={{ alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder }}
              >
                <Text style={{ ...FONT.caption, fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
              </PressableScale>
              <PressableScale
                onPress={handleSaveTargets}
                haptic={null}
                scaleTo={0.96}
                containerStyle={{ flex: 2 }}
                style={{ alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: coach.color }}
              >
                <Text style={{ fontFamily: 'Hanken-Bold', fontSize: 14, color: getTextOnColor(coach.color) }}>Save targets</Text>
              </PressableScale>
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
            <PressableScale onPress={offerTdeeTarget} scaleTo={0.98} accessibilityLabel="Update calorie target from adaptive maintenance">
              <GlassCard style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                <TrendingUp size={15} color={coach.color} strokeWidth={2.4} />
                <Text style={{ ...FONT.caption, color: colors.textSecondary, flex: 1 }}>
                  Adaptive maintenance <Text style={{ fontFamily: 'Hanken-Bold', color: colors.textPrimary }}>~{fmt(tdeeEst.tdee)} {energyLabel}/day</Text>
                  {tdeeEst.confidence === 'low' ? ' · rough' : ''}
                </Text>
                <Text style={{ ...FONT.caption, fontFamily: 'Hanken-Bold', color: coach.color }}>Update target</Text>
              </GlassCard>
            </PressableScale>
          </FadeInView>
        )}

        {/* Meal diary */}
        {loading && !dailyData ? (
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
                      {items.length ? `${fmt(sectionKcal)} ${energyLabel}` : '—'}
                    </Text>
                  </View>

                  {items.length > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.glassBorder }}>
                      {items.map((entry, i) => {
                        const name = entry.items?.map((it) => it.name).join(', ') || cap(entry.mealType);
                        return (
                          <View key={entry.id}>
                            <SwipeToDelete
                              colors={colors}
                              onDelete={async () => { await deleteMeal(entry.id); await loadData(selectedKey); }}
                            >
                            <PressableScale
                              onPress={() => onEntryPress(entry)}
                              scaleTo={0.985}
                              accessibilityLabel={`${name}, ${entry.macros.kcal} ${energyLabel}. Swipe left to delete.`}
                              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 56, backgroundColor: colors.glassBg }}
                            >
                              <View style={{ flex: 1, paddingRight: 10, paddingVertical: 9 }}>
                                <Text style={{ ...FONT.body, fontSize: 14, lineHeight: 19, color: colors.textPrimary }} numberOfLines={1}>{name}</Text>
                                <Text style={{ ...FONT.caption, fontSize: 11.5, color: colors.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                                  {new Date(entry.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                  {entry.macros.protein > 0 ? ` · ${Math.round(entry.macros.protein)}g protein` : ''}
                                </Text>
                              </View>
                              <Text style={{ fontFamily: 'Hanken-SemiBold', fontSize: 14, color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>
                                {fmt(entry.macros.kcal)}
                              </Text>
                            </PressableScale>
                            </SwipeToDelete>
                            {i < items.length - 1 && (
                              <View style={{ height: 1, backgroundColor: colors.glassBorder, marginLeft: 16 }} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <PressableScale
                    onPress={() => openSearchFor(meal)}
                    scaleTo={0.98}
                    accessibilityLabel={`Add to ${MEAL_LABELS[meal]}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.glassBorder }}
                  >
                    <Plus size={14} color={coach.color} strokeWidth={2.6} />
                    <Text style={{ ...FONT.caption, fontFamily: 'Hanken-SemiBold', color: coach.color }}>
                      Add to {MEAL_LABELS[meal].toLowerCase()}
                    </Text>
                  </PressableScale>
                </GlassCard>
              </FadeInView>
            );
          })
        )}

        {/* Manual entry — collapsible fallback */}
        <PressableScale
          onPress={() => setManualOpen((v) => !v)}
          scaleTo={0.97}
          accessibilityLabel="Enter macros manually"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
        >
          {manualOpen ? <ChevronUp size={14} color={colors.textMuted} strokeWidth={2.2} /> : <ChevronDown size={14} color={colors.textMuted} strokeWidth={2.2} />}
          <Text style={{ ...FONT.caption, color: colors.textMuted }}>Enter macros manually</Text>
        </PressableScale>

        {manualOpen && (
          <GlassCard accentColor={coach.color}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {MEAL_TYPES.map((mt) => (
                <PressableScale
                  key={mt}
                  haptic="tick"
                  scaleTo={0.95}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.round,
                    backgroundColor: activeMeal === mt ? coach.color : colors.glassBg,
                    borderWidth: 1, borderColor: activeMeal === mt ? coach.color : colors.glassBorder,
                  }}
                  onPress={() => setActiveMeal(mt)}
                >
                  <Text style={{ ...FONT.caption, fontSize: 12, color: activeMeal === mt ? getTextOnColor(coach.color) : colors.textSecondary }}>
                    {MEAL_LABELS[mt]}
                  </Text>
                </PressableScale>
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
            <PressableScale
              haptic={null}
              scaleTo={0.97}
              style={{ backgroundColor: kcalInput ? coach.color : colors.bgSubtle, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center' }}
              onPress={handleLog}
              disabled={saving || !kcalInput}
              accessibilityLabel="Log meal"
            >
              <Text style={{ fontFamily: 'Hanken-Bold', fontSize: 16, color: kcalInput ? getTextOnColor(coach.color) : colors.textDim }}>
                {saving ? 'Saving…' : `Log to ${MEAL_LABELS[activeMeal].toLowerCase()}`}
              </Text>
            </PressableScale>
          </GlassCard>
        )}

        {/* Empty-day nudge */}
        {!loading && entries.length === 0 && (
          <FadeInView delay={260} style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Apple size={22} color={colors.textMuted} strokeWidth={1.6} />
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 8 }}>
              {isToday ? 'Nothing logged yet — speak it, search it, or scan it.' : 'Nothing logged this day — tap + to backfill.'}
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
        targets={targets}
        initialMeal={activeMeal}
      />

      <BarcodeScannerModal
        visible={scanVisible}
        onClose={() => setScanVisible(false)}
        onFound={handleScanFound}
        onSearchByName={handleScanSearchByName}
        coachColor={coach.color}
        colors={colors}
      />

      <VoiceFoodModal
        visible={voiceVisible}
        onClose={() => setVoiceVisible(false)}
        onLogged={() => loadData(selectedKey)}
        mealType={activeMeal}
        date={logDateIso}
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
    fontFamily: 'Hanken-SemiBold',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
}
