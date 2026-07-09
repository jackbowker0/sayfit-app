// ============================================================
// VOICE FOOD MODAL — speak a meal, review, log
// ------------------------------------------------------------
// Speak (or type) a meal -> an LLM parses it into items -> each is
// matched against the food DB (USDA, generic-accurate) and portioned
// -> you REVIEW every item: see its calories, tap to SWAP to a
// different food if the match is off, edit the amount, drop it -> log.
// Every macro comes from the DB, never an LLM guess, and nothing is
// logged until you confirm. Degrades gracefully with no speech module
// (pre-rebuild) or offline AI: type the meal instead.
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mic, X, Trash2, ChevronLeft, Search, RefreshCw } from 'lucide-react-native';

import { FONT, SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { parseFoodText, isAIAvailable } from '../services/ai';
import { resolveFoodItems, searchFoods, macrosForPortion, addRecentFood } from '../services/foodDb';
import { logMeal } from '../services/nutrition';
import * as haptics from '../services/haptics';

let SpeechModule = null;
let useSpeechEvent = () => {};
try {
  const S = require('expo-speech-recognition');
  SpeechModule = S.ExpoSpeechRecognitionModule;
  useSpeechEvent = S.useSpeechRecognitionEvent;
} catch (_) { /* not in this build */ }

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

export default function VoiceFoodModal({ visible, onClose, onLogged, mealType = 'snack', coachColor, colors, energyLabel = 'kcal' }) {
  const [phase, setPhase] = useState('capture'); // capture | analyzing | review | swap
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  // swap phase
  const [swapId, setSwapId] = useState(null);
  const [swapQuery, setSwapQuery] = useState('');
  const [swapResults, setSwapResults] = useState([]);
  const [swapSearching, setSwapSearching] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhase('capture'); setTranscript(''); setItems([]); setError(null); setSwapId(null);
      startListening();
    } else {
      stopListening();
    }
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useSpeechEvent('result', (e) => {
    const t = e?.results?.[0]?.transcript;
    if (typeof t === 'string') setTranscript(t);
  });
  useSpeechEvent('end', () => setListening(false));

  const startListening = async () => {
    if (!SpeechModule) return;
    try {
      const perm = await SpeechModule.requestPermissionsAsync();
      if (!perm.granted) { setListening(false); return; }
      setListening(true);
      SpeechModule.start({ lang: 'en-US', interimResults: true, continuous: false });
    } catch (_) { setListening(false); }
  };
  const stopListening = () => { try { SpeechModule?.stop?.(); } catch (_) {} setListening(false); };

  const analyze = async () => {
    stopListening();
    const text = transcript.trim();
    if (!text) return;
    setError(null);
    setPhase('analyzing');
    const parsed = await parseFoodText(text);
    if (!parsed) { setError(isAIAvailable() ? "Couldn't read that — try again or use Search." : 'Voice needs a connection. Use Search to log this meal.'); setPhase('capture'); return; }
    if (parsed.length === 0) { setError('No foods found — try naming what you ate.'); setPhase('capture'); return; }
    const resolved = await resolveFoodItems(parsed);
    setItems(resolved.map((r, i) => ({ ...r, id: `${i}-${r.query}`, grams: String(r.grams) })));
    setPhase('review');
  };

  const editGrams = (id, g) => setItems((prev) => prev.map((it) => {
    if (it.id !== id) return it;
    const macros = it.food ? macrosForPortion(it.food, parseFloat(g) || 0) : null;
    return { ...it, grams: g, macros };
  }));
  const bumpGrams = (id, delta) => setItems((prev) => prev.map((it) => {
    if (it.id !== id) return it;
    const next = Math.max(1, Math.round((parseFloat(it.grams) || 0) + delta));
    const macros = it.food ? macrosForPortion(it.food, next) : null;
    return { ...it, grams: String(next), macros };
  }));
  const removeItem = (id) => { haptics.tap(); setItems((prev) => prev.filter((it) => it.id !== id)); };

  // ---- swap flow ----
  const openSwap = (it) => {
    haptics.tap();
    setSwapId(it.id);
    setSwapQuery(it.query || it.food?.name || '');
    setSwapResults([]);
    setPhase('swap');
    runSwapSearch(it.query || it.food?.name || '');
  };
  const runSwapSearch = async (q) => {
    if ((q || '').trim().length < 2) { setSwapResults([]); return; }
    setSwapSearching(true);
    const r = await searchFoods(q, { limit: 20 });
    setSwapResults(r);
    setSwapSearching(false);
  };
  const pickSwap = (food) => {
    haptics.selection?.();
    setItems((prev) => prev.map((it) => {
      if (it.id !== swapId) return it;
      const grams = parseFloat(it.grams) || food.servingGrams || 100;
      return { ...it, food, grams: String(Math.round(grams)), macros: macrosForPortion(food, grams) };
    }));
    setSwapId(null);
    setPhase('review');
  };

  const matched = items.filter((it) => it.food && it.macros);
  const total = matched.reduce((a, it) => ({
    kcal: a.kcal + (it.macros.kcal || 0),
    protein: round1(a.protein + (it.macros.protein || 0)),
    carbs: round1(a.carbs + (it.macros.carbs || 0)),
    fat: round1(a.fat + (it.macros.fat || 0)),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const logIt = async () => {
    if (matched.length === 0) return;
    haptics.success();
    await logMeal({ source: 'voice', mealType, items: matched.map((it) => ({ name: it.food.name, qty: 1 })), macros: total });
    matched.forEach((it) => addRecentFood(it.food).catch(() => {}));
    onLogged?.();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, padding: SPACING.lg }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            {phase === 'swap' ? (
              <TouchableOpacity onPress={() => { haptics.tap(); setPhase('review'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }} accessibilityRole="button" accessibilityLabel="Back to review">
                <ChevronLeft size={22} color={coachColor} strokeWidth={2.4} />
                <Text style={{ ...FONT.subhead, color: coachColor }}>Back</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ ...FONT.title, color: colors.textPrimary }}>{phase === 'review' ? 'Review meal' : 'Voice log'}</Text>
            )}
            <TouchableOpacity onPress={() => { haptics.tap(); onClose(); }} style={{ minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* CAPTURE */}
          {phase === 'capture' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: listening ? coachColor : colors.glassBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Mic size={20} color={listening ? getTextOnColor(coachColor) : colors.textMuted} strokeWidth={2.2} />
                </View>
                <Text style={{ ...FONT.body, color: colors.textSecondary, flex: 1 }}>
                  {SpeechModule ? (listening ? 'Listening — say what you ate…' : 'Speak or type your meal') : 'Type your meal below'}
                </Text>
              </View>
              <TextInput
                value={transcript}
                onChangeText={setTranscript}
                placeholder={'e.g. "3 eggs, two slices of toast, and a banana"'}
                placeholderTextColor={colors.textDim}
                multiline
                style={{
                  minHeight: 96, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
                  borderRadius: RADIUS.md, padding: 16, fontSize: 17, lineHeight: 24, color: colors.textPrimary, textAlignVertical: 'top',
                }}
              />
              {error && <Text style={{ ...FONT.caption, color: colors.red, marginTop: 10 }}>{error}</Text>}
              <View style={{ flex: 1 }} />
              <PrimaryButton label="Analyze" onPress={analyze} disabled={!transcript.trim()} coachColor={coachColor} />
            </>
          )}

          {/* ANALYZING */}
          {phase === 'analyzing' && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <ActivityIndicator size="large" color={coachColor} />
              <Text style={{ ...FONT.body, color: colors.textMuted }}>Reading your meal…</Text>
            </View>
          )}

          {/* REVIEW */}
          {phase === 'review' && (
            <>
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginBottom: 12 }}>
                Tap a food to change the match · edit the amount · remove anything off.
              </Text>
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {items.map((it) => (
                  <View key={it.id} style={{ backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.md, padding: 14, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <TouchableOpacity onPress={() => openSwap(it)} activeOpacity={0.7} style={{ flex: 1, paddingRight: 8 }} accessibilityRole="button" accessibilityLabel={`Change ${it.food ? it.food.name : it.query}`}>
                        {it.food ? (
                          <>
                            <Text style={{ ...FONT.subhead, color: colors.textPrimary }} numberOfLines={2}>{it.food.name}</Text>
                            {it.food.brand ? <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>{it.food.brand}</Text> : null}
                          </>
                        ) : (
                          <Text style={{ ...FONT.subhead, color: colors.textMuted }}>No match for "{it.query}" — tap to search</Text>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <RefreshCw size={11} color={coachColor} strokeWidth={2.4} />
                          <Text style={{ ...FONT.caption, color: coachColor }}>change food</Text>
                        </View>
                      </TouchableOpacity>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ ...FONT.stat, fontSize: 20, color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>{it.macros ? it.macros.kcal : '—'}</Text>
                        <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted }}>{energyLabel}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeItem(it.id)} style={{ paddingLeft: 12, paddingTop: 2 }} accessibilityRole="button" accessibilityLabel="Remove">
                        <Trash2 size={16} color={colors.textMuted} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>

                    {it.food && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                        <Text style={{ ...FONT.caption, color: colors.textMuted }}>
                          P{it.macros.protein} · C{it.macros.carbs} · F{it.macros.fat}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Stepper onPress={() => bumpGrams(it.id, -10)} label="−" colors={colors} />
                          <TextInput
                            value={it.grams}
                            onChangeText={(g) => editGrams(it.id, g)}
                            keyboardType="decimal-pad"
                            style={{ width: 52, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.sm, paddingVertical: 7, textAlign: 'center', color: colors.textPrimary, fontVariant: ['tabular-nums'] }}
                          />
                          <Text style={{ ...FONT.caption, color: colors.textMuted }}>g</Text>
                          <Stepper onPress={() => bumpGrams(it.id, 10)} label="+" colors={colors} />
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.glassBorder, marginTop: 4 }}>
                <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>Total</Text>
                <Text style={{ ...FONT.subhead, color: coachColor, fontVariant: ['tabular-nums'] }}>
                  {total.kcal} {energyLabel} · P{total.protein} C{total.carbs} F{total.fat}
                </Text>
              </View>
              <PrimaryButton
                label={`Log ${matched.length} item${matched.length === 1 ? '' : 's'}`}
                onPress={logIt}
                disabled={matched.length === 0}
                coachColor={coachColor}
              />
            </>
          )}

          {/* SWAP — search a replacement for one item */}
          {phase === 'swap' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.md, paddingHorizontal: 12, marginBottom: 8 }}>
                <Search size={18} color={colors.textMuted} strokeWidth={2} />
                <TextInput
                  value={swapQuery}
                  onChangeText={(q) => { setSwapQuery(q); }}
                  onSubmitEditing={() => runSwapSearch(swapQuery)}
                  returnKeyType="search"
                  autoFocus
                  placeholder="Search a food"
                  placeholderTextColor={colors.textDim}
                  style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: colors.textPrimary }}
                />
                {swapSearching ? <ActivityIndicator size="small" color={coachColor} /> : null}
              </View>
              <FlatList
                data={swapResults}
                keyExtractor={(f, i) => f.id || `r-${i}`}
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
                renderItem={({ item: f }) => (
                  <TouchableOpacity onPress={() => pickSwap(f)} activeOpacity={0.7} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder }}>
                    <Text style={{ ...FONT.body, color: colors.textPrimary }} numberOfLines={1}>{f.name}</Text>
                    <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                      {f.brand ? `${f.brand} · ` : ''}{f.per100g.kcal} {energyLabel} · P{f.per100g.protein} C{f.per100g.carbs} F{f.per100g.fat} /100g
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={{ ...FONT.caption, color: colors.textMuted, textAlign: 'center', marginTop: 28 }}>
                    {swapSearching ? 'Searching…' : swapQuery.trim().length >= 2 ? 'No matches.' : 'Type to search a replacement.'}
                  </Text>
                }
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function PrimaryButton({ label, onPress, disabled, coachColor }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{ backgroundColor: coachColor, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', opacity: disabled ? 0.4 : 1 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={{ ...FONT.subhead, color: getTextOnColor(coachColor) }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stepper({ onPress, label, colors }) {
  return (
    <TouchableOpacity
      onPress={() => { haptics.tick?.(); onPress(); }}
      activeOpacity={0.7}
      style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase amount' : 'Decrease amount'}
    >
      <Text style={{ fontSize: 18, color: colors.textSecondary, lineHeight: 20 }}>{label}</Text>
    </TouchableOpacity>
  );
}
