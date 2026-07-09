// ============================================================
// FOOD SEARCH MODAL — search Open Food Facts, pick a portion
// ------------------------------------------------------------
// Debounced text search over foodDb. Tap a result to set a portion
// (grams) with a live macro preview, then Add — the caller pre-fills
// its log form from the returned macros. Shows recents when the query
// is empty so re-logging a staple is one tap. ODbL-attributed.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, ChevronLeft } from 'lucide-react-native';

import { FONT, SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { searchFoods, getRecentFoods, macrosForPortion } from '../services/foodDb';
import * as haptics from '../services/haptics';

export default function FoodSearchModal({ visible, onClose, onPick, coachColor, colors }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recents, setRecents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // a food being portioned
  const [grams, setGrams] = useState('100');
  const debounceRef = useRef(null);

  // Load recents each time the sheet opens; reset transient state.
  useEffect(() => {
    if (!visible) return;
    setQuery(''); setResults([]); setSelected(null); setGrams('100');
    getRecentFoods().then(setRecents).catch(() => setRecents([]));
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

  const pickFood = useCallback((food) => {
    haptics.tap();
    setSelected(food);
    setGrams(food.servingGrams ? String(food.servingGrams) : '100');
  }, []);

  const confirm = () => {
    const g = parseFloat(grams);
    if (!selected || !g || g <= 0) return;
    haptics.success();
    onPick(selected, g, macrosForPortion(selected, g));
  };

  const listData = query.trim().length < 2 ? recents : results;
  const showingRecents = query.trim().length < 2;

  const renderRow = ({ item }) => {
    const per = item.per100g;
    return (
      <TouchableOpacity
        onPress={() => pickFood(item)}
        activeOpacity={0.7}
        style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder }}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${per.kcal} calories per 100 grams`}
      >
        <Text style={{ ...FONT.body, color: colors.textPrimary }} numberOfLines={1}>{item.name}</Text>
        <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
          {item.brand ? `${item.brand} · ` : ''}{per.kcal} kcal · P{per.protein} C{per.carbs} F{per.fat} /100g
        </Text>
      </TouchableOpacity>
    );
  };

  // ---- Portion step ----
  if (selected) {
    const g = parseFloat(grams) || 0;
    const m = macrosForPortion(selected, g);
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

            <Text style={{ ...FONT.subhead, color: colors.textPrimary, marginTop: 12 }}>{selected.name}</Text>
            {selected.brand ? (
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>{selected.brand}</Text>
            ) : null}

            <Text style={{ ...FONT.label, color: colors.textMuted, marginTop: 24, marginBottom: 8 }}>Portion (grams)</Text>
            <TextInput
              value={grams}
              onChangeText={setGrams}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={confirm}
              style={{
                backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.glassBorder,
                borderRadius: RADIUS.md, padding: 14, fontSize: 18, color: colors.textPrimary,
                textAlign: 'center', fontWeight: '700', fontVariant: ['tabular-nums'],
              }}
            />
            {selected.servingGrams ? (
              <TouchableOpacity onPress={() => setGrams(String(selected.servingGrams))} style={{ marginTop: 8 }}>
                <Text style={{ ...FONT.caption, color: coachColor }}>Use serving: {selected.servingGrams} g</Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, marginBottom: 8 }}>
              {[['kcal', m.kcal], ['Protein', m.protein], ['Carbs', m.carbs], ['Fat', m.fat]].map(([label, val]) => (
                <View key={label} style={{ alignItems: 'center' }}>
                  <Text style={{ ...FONT.stat, fontSize: 22, color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>{val}</Text>
                  <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={confirm}
              disabled={g <= 0}
              activeOpacity={0.85}
              style={{ backgroundColor: coachColor, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', opacity: g <= 0 ? 0.5 : 1 }}
              accessibilityRole="button" accessibilityLabel="Add to log"
            >
              <Text style={{ ...FONT.subhead, color: getTextOnColor(coachColor) }}>Add to log</Text>
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
            Food data from Open Food Facts (ODbL)
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
