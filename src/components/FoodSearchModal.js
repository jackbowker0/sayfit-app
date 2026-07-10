// ============================================================
// FOOD SEARCH MODAL — search, food detail, add (the MFP flow)
// ------------------------------------------------------------
// Result rows read "200 cal · 2 cups · Quaker" with a Verified tag
// on lab-standardized USDA entries. Tapping opens a FOOD DETAIL
// screen: name/brand, serving size (real household measures),
// number of servings, which meal it goes to, and every macro shown
// with the % of the daily goal this portion represents. onPick
// returns (food, grams, macros, meal).
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, ChevronLeft, CheckCircle2 } from 'lucide-react-native';

import { FONT, SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { searchFoods, getRecentFoods, clearRecentFoods, macrosForPortion, getFoodPortions } from '../services/foodDb';
import { correctFoodQuery } from '../services/ai';
import { MEAL_TYPES } from '../services/nutrition';
import * as haptics from '../services/haptics';

const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

// Servings = whole number + fraction, the MFP picker model.
const FRACTIONS = [
  { label: '0', value: 0 },
  { label: '⅛', value: 1 / 8 },
  { label: '¼', value: 1 / 4 },
  { label: '⅓', value: 1 / 3 },
  { label: '½', value: 1 / 2 },
  { label: '⅔', value: 2 / 3 },
  { label: '¾', value: 3 / 4 },
];

// The serving a person most likely means — "1 medium", "1 large", a standard
// serving — beats "1 cup (4.86 large eggs)" as the pre-selected default.
function defaultPortionIndex(portions) {
  const pref = [/^1 (standard serving|serving)/i, /^1 medium/i, /^1 large\b/i, /^1 (piece|slice|each|egg|bar|scoop)/i];
  for (const re of pref) {
    const i = portions.findIndex((p) => re.test(p.label));
    if (i >= 0) return i;
  }
  return 0;
}

export default function FoodSearchModal({
  visible, onClose, onPick, coachColor, colors,
  initialFood = null, energyLabel = 'kcal',
  targets = {},            // daily macro targets for the "% of goal" column
  initialMeal = 'snack',   // pre-selected meal section
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recents, setRecents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);       // a food being portioned
  const [portions, setPortions] = useState([]);         // [{label, grams}]
  const [portionsLoading, setPortionsLoading] = useState(false);
  const [portionIdx, setPortionIdx] = useState(0);
  const [qtyWhole, setQtyWhole] = useState(1);          // servings: whole part
  const [qtyFracIdx, setQtyFracIdx] = useState(0);      // servings: fraction part (index into FRACTIONS)
  const [customGrams, setCustomGrams] = useState(null); // string once the user types grams
  const [meal, setMeal] = useState(initialMeal);        // which diary section this lands in
  const [correctedTo, setCorrectedTo] = useState(null); // "did you mean" note after a typo fix
  const debounceRef = useRef(null);
  const correctionCache = useRef(new Map());            // query -> corrected|null, avoids repeat AI calls

  // Load recents each time the sheet opens; reset transient state. If opened
  // with an initialFood (e.g. from a barcode scan), jump straight to portioning.
  useEffect(() => {
    if (!visible) return;
    setQuery(''); setResults([]);
    setSelected(null);
    setMeal(initialMeal);
    if (initialFood) beginPortioning(initialFood);
    getRecentFoods().then(setRecents).catch(() => setRecents([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Debounced search on query change; a zero-result query gets one shot at
  // AI spell-correction ("mcdonslds" -> "mcdonalds") with a did-you-mean note.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    setCorrectedTo(null);
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      let r = await searchFoods(q, { limit: 25 });
      if (r.length === 0 && q.length >= 4) {
        const cache = correctionCache.current;
        const corrected = cache.has(q) ? cache.get(q) : await correctFoodQuery(q).catch(() => null);
        cache.set(q, corrected);
        if (corrected) {
          const rc = await searchFoods(corrected, { limit: 25 });
          if (rc.length > 0) { r = rc; setCorrectedTo(corrected); }
        }
      }
      setResults(r);
      setSearching(false);
    }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  const beginPortioning = useCallback(async (food) => {
    setSelected(food);
    setQtyWhole(1);
    setQtyFracIdx(0);
    setCustomGrams(null);
    setPortionIdx(0);
    setPortions(food.servingGrams ? [{ label: food.servingLabel || '1 serving', grams: food.servingGrams }, { label: '100 g', grams: 100 }] : [{ label: '100 g', grams: 100 }]);
    setPortionsLoading(true);
    const full = await getFoodPortions(food).catch(() => null);
    if (full && full.length) {
      setPortions(full);
      setPortionIdx(defaultPortionIndex(full));
    }
    setPortionsLoading(false);
  }, []);

  const pickFood = useCallback((food) => {
    haptics.tap();
    beginPortioning(food);
  }, [beginPortioning]);

  // Effective grams: custom text wins; otherwise selected serving × quantity.
  const portion = portions[portionIdx] || { label: '100 g', grams: 100 };
  const qty = qtyWhole + FRACTIONS[qtyFracIdx].value;
  const grams = customGrams != null ? (parseFloat(customGrams) || 0) : Math.round(portion.grams * qty);
  const qtyText = `${qtyWhole > 0 || qtyFracIdx === 0 ? qtyWhole : ''}${qtyFracIdx > 0 ? ` ${FRACTIONS[qtyFracIdx].label}` : ''}`.trim();

  const confirm = () => {
    if (!selected || !grams || grams <= 0) return;
    haptics.success();
    onPick(selected, grams, macrosForPortion(selected, grams), meal);
  };

  const bumpQty = (delta) => {
    haptics.tick();
    setCustomGrams(null);
    setQtyWhole((w) => Math.min(50, Math.max(0, w + delta)));
  };

  const listData = query.trim().length < 2 ? recents : results;
  const showingRecents = query.trim().length < 2;

  const renderRow = ({ item }) => {
    // Calories for the serving someone would actually eat, when we know it.
    const hasServing = Number(item.servingGrams) > 0;
    const cal = hasServing ? macrosForPortion(item, item.servingGrams).kcal : item.per100g.kcal;
    const servingText = hasServing ? (item.servingLabel || `${item.servingGrams} g`) : '100 g';
    return (
      <TouchableOpacity
        onPress={() => pickFood(item)}
        activeOpacity={0.7}
        style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder }}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${cal} ${energyLabel} per ${servingText}${item.verified ? ', verified' : ''}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ ...FONT.body, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{item.name}</Text>
          {item.verified && <CheckCircle2 size={13} color={coachColor} strokeWidth={2.4} />}
        </View>
        <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
          {cal} {energyLabel} · {servingText}{item.brand ? ` · ${item.brand}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  // ---- Food detail (MFP-style) ----
  if (selected) {
    const m = macrosForPortion(selected, grams);
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <View style={{ flex: 1, padding: SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={() => { haptics.tap(); setSelected(null); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}
                accessibilityRole="button" accessibilityLabel="Back to results"
              >
                <ChevronLeft size={20} color={coachColor} strokeWidth={2.5} />
                <Text style={{ ...FONT.caption, color: coachColor, fontWeight: '600' }}>Results</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { haptics.tap(); onClose(); }} style={{ minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Close">
                <X size={22} color={colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Name + brand */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Text style={{ ...FONT.heading, color: colors.textPrimary, flexShrink: 1 }}>{selected.name}</Text>
                {selected.verified && <CheckCircle2 size={15} color={coachColor} strokeWidth={2.4} />}
              </View>
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>
                {selected.brand || (selected.verified ? 'USDA verified · generic' : 'Generic')}
              </Text>

              {/* Serving size */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 }}>
                <Text style={{ ...FONT.label, color: colors.textMuted }}>Serving size</Text>
                {portionsLoading && <ActivityIndicator size="small" color={coachColor} />}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {portions.map((p, i) => {
                  const active = customGrams == null && i === portionIdx;
                  return (
                    <TouchableOpacity
                      key={`${p.label}-${p.grams}`}
                      onPress={() => { haptics.tick(); setCustomGrams(null); setPortionIdx(i); }}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.label}, ${p.grams} grams`}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 9, borderRadius: RADIUS.md,
                        backgroundColor: active ? coachColor : colors.glassBg,
                        borderWidth: 1, borderColor: active ? coachColor : colors.glassBorder,
                      }}
                    >
                      <Text style={{ ...FONT.caption, fontSize: 12.5, color: active ? getTextOnColor(coachColor) : colors.textPrimary }}>
                        {p.label} <Text style={{ color: active ? getTextOnColor(coachColor) : colors.textMuted }}>({p.grams}g)</Text>
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Number of servings: whole ± stepper + fraction chips + custom grams */}
              <Text style={{ ...FONT.label, color: colors.textMuted, marginTop: 22, marginBottom: 8 }}>Number of servings</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <QtyBtn label="−" onPress={() => bumpQty(-1)} colors={colors} />
                <Text style={{ ...FONT.stat, fontSize: 24, color: colors.textPrimary, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                  {customGrams != null ? '—' : qtyText}
                </Text>
                <QtyBtn label="+" onPress={() => bumpQty(1)} colors={colors} />
                <View style={{ flex: 1 }} />
                <TextInput
                  value={customGrams != null ? customGrams : String(grams)}
                  onChangeText={(t) => setCustomGrams(t)}
                  onFocus={() => setCustomGrams(String(grams))}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={confirm}
                  accessibilityLabel="Custom grams"
                  style={{
                    width: 88, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.glassBorder,
                    borderRadius: RADIUS.md, paddingVertical: 10, textAlign: 'center', fontSize: 16,
                    color: colors.textPrimary, fontWeight: '700', fontVariant: ['tabular-nums'],
                  }}
                />
                <Text style={{ ...FONT.caption, color: colors.textMuted }}>g</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                {FRACTIONS.map((f, i) => {
                  const active = customGrams == null && i === qtyFracIdx;
                  return (
                    <TouchableOpacity
                      key={f.label}
                      onPress={() => { haptics.tick(); setCustomGrams(null); setQtyFracIdx(i); }}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={f.value === 0 ? 'No fraction' : `plus ${f.label} serving`}
                      style={{
                        flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.sm,
                        backgroundColor: active ? coachColor : colors.glassBg,
                        borderWidth: 1, borderColor: active ? coachColor : colors.glassBorder,
                      }}
                    >
                      <Text style={{ ...FONT.caption, fontSize: 13, color: active ? getTextOnColor(coachColor) : colors.textSecondary }}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Meal */}
              <Text style={{ ...FONT.label, color: colors.textMuted, marginTop: 22, marginBottom: 8 }}>Meal</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {MEAL_TYPES.map((mt) => (
                  <TouchableOpacity
                    key={mt}
                    onPress={() => { haptics.tick(); setMeal(mt); }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Log to ${MEAL_LABELS[mt]}`}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: RADIUS.round,
                      backgroundColor: meal === mt ? coachColor : colors.glassBg,
                      borderWidth: 1, borderColor: meal === mt ? coachColor : colors.glassBorder,
                    }}
                  >
                    <Text style={{ ...FONT.caption, fontSize: 12, color: meal === mt ? getTextOnColor(coachColor) : colors.textSecondary }}>
                      {MEAL_LABELS[mt]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* This portion vs daily goals */}
              <Text style={{ ...FONT.label, color: colors.textMuted, marginTop: 26, marginBottom: 4 }}>This portion · % of daily goal</Text>
              <GoalRow label={energyLabel === 'kcal' ? 'Calories' : 'Calories'} value={m.kcal} unit="" target={targets?.kcal} colors={colors} accent={coachColor} />
              <GoalRow label="Protein" value={m.protein} unit="g" target={targets?.protein} colors={colors} accent={coachColor} />
              <GoalRow label="Carbs" value={m.carbs} unit="g" target={targets?.carbs} colors={colors} accent={coachColor} />
              <GoalRow label="Fat" value={m.fat} unit="g" target={targets?.fat} colors={colors} accent={coachColor} last />
            </ScrollView>

            <TouchableOpacity
              onPress={confirm}
              disabled={grams <= 0}
              activeOpacity={0.85}
              style={{ backgroundColor: coachColor, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', marginTop: 10, opacity: grams <= 0 ? 0.5 : 1 }}
              accessibilityRole="button" accessibilityLabel={`Add to ${MEAL_LABELS[meal]}`}
            >
              <Text style={{ ...FONT.subhead, color: getTextOnColor(coachColor) }}>
                Add to {MEAL_LABELS[meal].toLowerCase()} — {m.kcal} {energyLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ---- Search step ----
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, padding: SPACING.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ ...FONT.title, color: colors.textPrimary }}>Search food</Text>
            <TouchableOpacity onPress={() => { haptics.tap(); onClose(); }} style={{ minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.md, paddingHorizontal: 12 }}>
            <Search size={18} color={colors.textMuted} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="e.g. greek yogurt"
              placeholderTextColor={colors.textDim}
              autoFocus
              autoCorrect
              spellCheck
              autoCapitalize="none"
              returnKeyType="search"
              style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: colors.textPrimary }}
            />
            {searching ? <ActivityIndicator size="small" color={coachColor} /> : null}
          </View>

          {showingRecents && recents.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <Text style={{ ...FONT.label, color: colors.textMuted }}>Recent</Text>
              <TouchableOpacity
                onPress={async () => { haptics.tap(); await clearRecentFoods(); setRecents([]); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button" accessibilityLabel="Clear recent foods"
              >
                <Text style={{ ...FONT.caption, fontSize: 12, color: colors.textMuted }}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {correctedTo && (
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 10 }}>
              Showing results for <Text style={{ color: coachColor, fontWeight: '600' }}>{correctedTo}</Text>
            </Text>
          )}

          <FlatList
            data={listData}
            keyExtractor={(item, i) => item.id || `row-${i}`}
            renderItem={renderRow}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1, marginTop: 8 }}
            contentContainerStyle={{ flexGrow: 1 }}
            ListEmptyComponent={
              <Text style={{ ...FONT.caption, color: colors.textMuted, textAlign: 'center', marginTop: 32 }}>
                {searching ? 'Searching…'
                  : query.trim().length >= 2 ? 'No matches. Try another term, or log macros manually.'
                  : 'Type to search foods, or log macros manually below.'}
              </Text>
            }
          />

          <Text style={{ ...FONT.caption, fontSize: 10, color: colors.textDim, textAlign: 'center', marginTop: 4 }}>
            Food data from USDA FoodData Central &amp; Open Food Facts (ODbL)
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// One nutrient vs its daily target: value left, "N% of goal" + thin bar
// right. Number + word carry the state (never hue alone); shows "no goal
// set" when there's no target instead of a fake percentage.
function GoalRow({ label, value, unit, target, colors, accent, last = false }) {
  const hasTarget = typeof target === 'number' && target > 0;
  const pct = hasTarget ? Math.round((value / target) * 100) : null;
  return (
    <View style={{ paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.glassBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ ...FONT.body, fontSize: 14, color: colors.textPrimary }}>{label}</Text>
        <Text style={{ ...FONT.caption, color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>
          {value}{unit}
          <Text style={{ color: colors.textMuted }}>
            {hasTarget ? `  ·  ${pct}% of ${target}${unit}` : '  ·  no goal set'}
          </Text>
        </Text>
      </View>
      {hasTarget && (
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.bgSubtle, overflow: 'hidden', marginTop: 7 }}>
          <View style={{ height: 4, width: `${Math.min(pct, 100)}%`, borderRadius: 2, backgroundColor: accent }} />
        </View>
      )}
    </View>
  );
}

function QtyBtn({ label, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'More servings' : 'Fewer servings'}
    >
      <Text style={{ fontSize: 20, color: colors.textSecondary, lineHeight: 22 }}>{label}</Text>
    </TouchableOpacity>
  );
}
