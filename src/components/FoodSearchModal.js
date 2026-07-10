// ============================================================
// FOOD SEARCH MODAL — search, pick a serving, add
// ------------------------------------------------------------
// MFP-clarity rules: result rows show calories for a REAL serving
// ("72 cal · 1 large") with a Verified tag on lab-standardized USDA
// entries; picking a food loads its household measures (1 large,
// 1 cup, …) as serving chips + a quantity stepper — grams are the
// fallback, not the interface. Recents show when the query is empty.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, ChevronLeft, CheckCircle2 } from 'lucide-react-native';

import { FONT, SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { searchFoods, getRecentFoods, macrosForPortion, getFoodPortions } from '../services/foodDb';
import * as haptics from '../services/haptics';

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

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

export default function FoodSearchModal({ visible, onClose, onPick, coachColor, colors, initialFood = null, energyLabel = 'kcal' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recents, setRecents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);       // a food being portioned
  const [portions, setPortions] = useState([]);         // [{label, grams}]
  const [portionsLoading, setPortionsLoading] = useState(false);
  const [portionIdx, setPortionIdx] = useState(0);
  const [qty, setQty] = useState(1);                    // servings count (0.5 steps)
  const [customGrams, setCustomGrams] = useState(null); // string once the user types grams
  const debounceRef = useRef(null);

  // Load recents each time the sheet opens; reset transient state. If opened
  // with an initialFood (e.g. from a barcode scan), jump straight to portioning.
  useEffect(() => {
    if (!visible) return;
    setQuery(''); setResults([]);
    setSelected(null);
    if (initialFood) beginPortioning(initialFood);
    getRecentFoods().then(setRecents).catch(() => setRecents([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Debounced search on query change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchFoods(q, { limit: 25 });
      setResults(r);
      setSearching(false);
    }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  const beginPortioning = useCallback(async (food) => {
    setSelected(food);
    setQty(1);
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
  const grams = customGrams != null ? (parseFloat(customGrams) || 0) : Math.round(portion.grams * qty);

  const confirm = () => {
    if (!selected || !grams || grams <= 0) return;
    haptics.success();
    onPick(selected, grams, macrosForPortion(selected, grams));
  };

  const bumpQty = (delta) => {
    haptics.tick();
    setCustomGrams(null);
    setQty((q) => Math.min(20, Math.max(0.5, round1(q + delta))));
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
          {cal} {energyLabel} · {servingText}{item.brand ? ` · ${item.brand}` : ''} · P{item.per100g.protein}/100g
        </Text>
      </TouchableOpacity>
    );
  };

  // ---- Portion step ----
  if (selected) {
    const m = macrosForPortion(selected, grams);
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <View style={{ flex: 1, padding: SPACING.lg }}>
            <TouchableOpacity
              onPress={() => { haptics.tap(); setSelected(null); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' }}
              accessibilityRole="button" accessibilityLabel="Back to results"
            >
              <ChevronLeft size={20} color={coachColor} strokeWidth={2.5} />
              <Text style={{ ...FONT.caption, color: coachColor, fontWeight: '600' }}>Results</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <Text style={{ ...FONT.subhead, color: colors.textPrimary, flexShrink: 1 }}>{selected.name}</Text>
              {selected.verified && <CheckCircle2 size={14} color={coachColor} strokeWidth={2.4} />}
            </View>
            {selected.brand ? (
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>{selected.brand}</Text>
            ) : null}

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Serving chips */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 8 }}>
                <Text style={{ ...FONT.label, color: colors.textMuted }}>Serving</Text>
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

              {/* Quantity stepper */}
              <Text style={{ ...FONT.label, color: colors.textMuted, marginTop: 22, marginBottom: 8 }}>How many</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <QtyBtn label="−" onPress={() => bumpQty(-0.5)} colors={colors} />
                <Text style={{ ...FONT.stat, fontSize: 24, color: colors.textPrimary, minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                  {customGrams != null ? '—' : qty}
                </Text>
                <QtyBtn label="+" onPress={() => bumpQty(0.5)} colors={colors} />
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

              {/* Live macro preview */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 8 }}>
                {[[energyLabel, m.kcal], ['Protein', m.protein], ['Carbs', m.carbs], ['Fat', m.fat]].map(([label, val]) => (
                  <View key={label} style={{ alignItems: 'center' }}>
                    <Text style={{ ...FONT.stat, fontSize: 22, color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>{val}</Text>
                    <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{label}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={confirm}
              disabled={grams <= 0}
              activeOpacity={0.85}
              style={{ backgroundColor: coachColor, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', opacity: grams <= 0 ? 0.5 : 1 }}
              accessibilityRole="button" accessibilityLabel="Add to log"
            >
              <Text style={{ ...FONT.subhead, color: getTextOnColor(coachColor) }}>
                Add — {m.kcal} {energyLabel}
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
              autoCorrect={false}
              returnKeyType="search"
              style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: colors.textPrimary }}
            />
            {searching ? <ActivityIndicator size="small" color={coachColor} /> : null}
          </View>

          {showingRecents && recents.length > 0 && (
            <Text style={{ ...FONT.label, color: colors.textMuted, marginTop: 16 }}>Recent</Text>
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
