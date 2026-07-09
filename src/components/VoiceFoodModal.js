// ============================================================
// VOICE FOOD MODAL — "I ate 3 eggs and toast" -> logged macros
// ------------------------------------------------------------
// Speak (or type) a meal → an LLM parses it into food items →
// each is matched against the food DB (USDA) and portioned →
// you REVIEW (edit grams, drop items) → log. Nothing is logged
// without confirmation, and every macro comes from the DB, not an
// LLM guess. Degrades gracefully: no speech module (pre-rebuild
// binary) or offline AI → type the meal / use Search instead.
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mic, X, Trash2 } from 'lucide-react-native';

import { FONT, SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { parseFoodText, isAIAvailable } from '../services/ai';
import { resolveFoodItems, macrosForPortion, addRecentFood } from '../services/foodDb';
import { logMeal } from '../services/nutrition';
import * as haptics from '../services/haptics';

// Speech recognition is a native module — absent on a pre-rebuild binary.
let SpeechModule = null;
let useSpeechEvent = () => {};
try {
  const S = require('expo-speech-recognition');
  SpeechModule = S.ExpoSpeechRecognitionModule;
  useSpeechEvent = S.useSpeechRecognitionEvent;
} catch (_) { /* not in this build */ }

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

export default function VoiceFoodModal({ visible, onClose, onLogged, mealType = 'snack', coachColor, colors, energyLabel = 'kcal' }) {
  const [phase, setPhase] = useState('capture'); // capture | analyzing | review
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setPhase('capture'); setTranscript(''); setItems([]); setError(null);
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
    if (!SpeechModule) return; // no native module — user types instead
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
    setItems(resolved.map((r, i) => ({ ...r, id: `${i}`, grams: String(r.grams) })));
    setPhase('review');
  };

  const editGrams = (id, g) => setItems((prev) => prev.map((it) => {
    if (it.id !== id) return it;
    const macros = it.food ? macrosForPortion(it.food, parseFloat(g) || 0) : null;
    return { ...it, grams: g, macros };
  }));
  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ ...FONT.title, color: colors.textPrimary }}>Voice log</Text>
            <TouchableOpacity onPress={() => { haptics.tap(); onClose(); }} style={{ minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* CAPTURE */}
          {phase === 'capture' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: listening ? coachColor : colors.glassBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Mic size={18} color={listening ? getTextOnColor(coachColor) : colors.textMuted} strokeWidth={2.2} />
                </View>
                <Text style={{ ...FONT.caption, color: colors.textMuted }}>
                  {SpeechModule ? (listening ? 'Listening — say what you ate…' : 'Tap the field to type, or reopen to speak') : 'Type your meal below'}
                </Text>
              </View>
              <TextInput
                value={transcript}
                onChangeText={setTranscript}
                placeholder='e.g. "3 eggs, two slices of toast, and a banana"'
                placeholderTextColor={colors.textDim}
                multiline
                style={{
                  minHeight: 90, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
                  borderRadius: RADIUS.md, padding: 14, fontSize: 16, color: colors.textPrimary, textAlignVertical: 'top',
                }}
              />
              {error && <Text style={{ ...FONT.caption, color: colors.red, marginTop: 8 }}>{error}</Text>}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={analyze}
                disabled={!transcript.trim()}
                activeOpacity={0.85}
                style={{ backgroundColor: coachColor, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', opacity: transcript.trim() ? 1 : 0.4 }}
                accessibilityRole="button" accessibilityLabel="Analyze meal"
              >
                <Text style={{ ...FONT.subhead, color: getTextOnColor(coachColor) }}>Analyze</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ANALYZING */}
          {phase === 'analyzing' && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={coachColor} />
              <Text style={{ ...FONT.caption, color: colors.textMuted }}>Reading your meal…</Text>
            </View>
          )}

          {/* REVIEW */}
          {phase === 'review' && (
            <>
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {items.map((it) => (
                  <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.glassBorder }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...FONT.body, color: it.food ? colors.textPrimary : colors.textMuted }} numberOfLines={1}>
                        {it.food ? it.food.name : `No match for "${it.query}"`}
                      </Text>
                      {it.macros && (
                        <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 2 }}>
                          {it.macros.kcal} {energyLabel} · P{it.macros.protein} C{it.macros.carbs} F{it.macros.fat}
                        </Text>
                      )}
                    </View>
                    {it.food && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TextInput
                          value={it.grams}
                          onChangeText={(g) => editGrams(it.id, g)}
                          keyboardType="decimal-pad"
                          style={{ width: 56, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.sm, paddingVertical: 8, textAlign: 'center', color: colors.textPrimary, fontVariant: ['tabular-nums'] }}
                        />
                        <Text style={{ ...FONT.caption, color: colors.textMuted }}>g</Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => removeItem(it.id)} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel={`Remove ${it.query}`}>
                      <Trash2 size={16} color={colors.textMuted} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
                <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>Total</Text>
                <Text style={{ ...FONT.subhead, color: coachColor }}>
                  {total.kcal} {energyLabel} · P{total.protein} C{total.carbs} F{total.fat}
                </Text>
              </View>
              <TouchableOpacity
                onPress={logIt}
                disabled={matched.length === 0}
                activeOpacity={0.85}
                style={{ backgroundColor: coachColor, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', opacity: matched.length ? 1 : 0.4 }}
                accessibilityRole="button" accessibilityLabel="Log this meal"
              >
                <Text style={{ ...FONT.subhead, color: getTextOnColor(coachColor) }}>
                  Log {matched.length} item{matched.length === 1 ? '' : 's'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
