// ============================================================
// COACH SCREEN — the AI home, rebuilt as a data narrator
//
// The old version fired canned commands ("Motivate me") — the exact
// generic-hype pattern users mock in other apps. This asks the coach
// real questions and it answers from your ACTUAL numbers (training,
// PRs, nutrition, body weight, protocol adherence) via services/ai.js
// askCoach, which builds a data snapshot and prompts the model to cite
// figures, take corrections, and route anything medical to a provider.
//
// HONEST BY DESIGN: askCoach falls back to a data-aware local line
// (never fabricated numbers) when offline; isAIAvailable() === false
// surfaces an "Offline mode" label. WinningVerdict skeletons while
// hubStats is null.
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Sparkles, Send } from 'lucide-react-native';

import FadeInView from '../components/FadeInView';
import GlassCard from '../components/GlassCard';
import WinningVerdict from '../components/WinningVerdict';
import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import { SPACING, RADIUS, FONT, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { loadHubStats } from '../hooks/useHubStats';
import { getCoachGreeting, askCoach, isAIAvailable } from '../services/ai';
import * as haptics from '../services/haptics';

// Data-grounded prompts — each makes the coach read the user's real numbers,
// the opposite of the old canned motivation commands.
const QUICK_ASKS = [
  'Am I winning?',
  'What should I train today?',
  "How's my nutrition today?",
  'What have I been neglecting?',
];

export default function CoachScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  // Guard a stale/corrupt coachId so the tab never crashes on undefined access.
  const coach = COACHES[coachId] || COACHES.hype;
  const CoachIcon = COACH_ICONS[coach.iconName] || COACH_ICONS.hype;
  const { colors } = useTheme();

  const [greeting, setGreeting] = useState('');
  const [messages, setMessages] = useState([]); // { id, q, a }
  const [pendingQ, setPendingQ] = useState(null);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [hubStats, setHubStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const scrollRef = useRef(null);

  const aiOffline = !isAIAvailable();

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const g = await getCoachGreeting(coachId);
      setGreeting(g || '');
    } catch (e) {
      console.warn('[Coach] greeting failed:', e);
      setGreeting('');
    }
    const stats = await loadHubStats();
    setHubStats(stats);
    setLoading(false);
    hasLoaded.current = true;
  };

  const ask = async (text) => {
    const q = (text || '').trim();
    if (!q || sending) return;
    haptics.tap();
    setInput('');
    setPendingQ(q);
    setSending(true);
    const history = messages.map((m) => ({ q: m.q, a: m.a }));
    let reply;
    try {
      reply = await askCoach(coachId, q, { history });
    } catch (e) {
      reply = "Couldn't reach the coach just now — try again in a moment.";
    }
    setMessages((prev) => [...prev, { id: `${Date.now()}`, q, a: reply }]);
    setPendingQ(null);
    setSending(false);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd?.({ animated: true }));
  };

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={coach.color} />
      </View>
    </SafeAreaView>
  );

  const QChip = ({ label }) => (
    <TouchableOpacity
      onPress={() => ask(label)}
      disabled={sending}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: 'center',
        borderRadius: RADIUS.round, backgroundColor: colors.glassBg,
        borderWidth: 1, borderColor: colors.glassBorder, opacity: sending ? 0.5 : 1,
      }}
    >
      <Text style={{ ...FONT.caption, color: colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: SPACING.screenPadding, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
              tintColor={coach.color}
            />
          }
        >
          {/* Header */}
          <FadeInView style={{ marginBottom: 20 }} accessible accessibilityRole="header">
            <Text style={{ ...FONT.title, color: colors.textPrimary }}>Coach</Text>
            {aiOffline && (
              <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 4 }}>
                Offline mode · answers use your saved data
              </Text>
            )}
          </FadeInView>

          {/* Greeting */}
          <GlassCard fadeDelay={120} accentColor={coach.color}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: coach.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                <CoachIcon size={18} color={coach.color} strokeWidth={2.2} />
              </View>
              <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>{coach.name}</Text>
            </View>
            <Text style={{ ...FONT.body, color: greeting ? colors.textSecondary : colors.textMuted }}>
              {greeting || 'Ask me anything about your training, food, or progress — I read your real numbers.'}
            </Text>
          </GlassCard>

          {/* Quick data-grounded asks */}
          <FadeInView delay={160} style={{ marginBottom: SPACING.md }}>
            <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: SPACING.sm }}>Ask about your data</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
              {QUICK_ASKS.map((q) => <QChip key={q} label={q} />)}
            </View>
          </FadeInView>

          {/* Conversation */}
          {messages.map((m) => (
            <View key={m.id} style={{ marginBottom: SPACING.md, gap: SPACING.sm }}>
              <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: coach.color, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md }}>
                <Text style={{ ...FONT.body, color: getTextOnColor(coach.color) }}>{m.q}</Text>
              </View>
              <GlassCard style={{ marginBottom: 0 }}>
                <Text style={{ ...FONT.body, color: colors.textPrimary }}>{m.a}</Text>
              </GlassCard>
            </View>
          ))}

          {/* Pending turn */}
          {pendingQ && (
            <View style={{ marginBottom: SPACING.md, gap: SPACING.sm }}>
              <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: coach.color, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md }}>
                <Text style={{ ...FONT.body, color: getTextOnColor(coach.color) }}>{pendingQ}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={coach.color} />
                <Text style={{ ...FONT.caption, color: colors.textMuted }}>{coach.name} is reading your numbers…</Text>
              </View>
            </View>
          )}

          {/* Build-me-a-workout CTA */}
          <FadeInView delay={200} style={{ marginTop: SPACING.sm, marginBottom: SPACING.lg }}>
            <TouchableOpacity
              onPress={() => { haptics.medium(); navigation.navigate('BuildWorkout'); }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Build me a workout"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: coach.color, paddingVertical: 14, borderRadius: RADIUS.md }}
            >
              <Sparkles size={18} color={getTextOnColor(coach.color)} strokeWidth={2.2} />
              <Text style={{ ...FONT.subhead, color: getTextOnColor(coach.color) }}>Build me a workout</Text>
            </TouchableOpacity>
          </FadeInView>

          {/* "Am I winning?" depth */}
          <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: SPACING.sm }}>Am I winning?</Text>
          <WinningVerdict navigation={navigation} hubStats={hubStats} />
        </ScrollView>

        {/* Input bar — always reachable (thumb zone) */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: 8,
          paddingHorizontal: SPACING.screenPadding, paddingTop: 8, paddingBottom: 8,
          borderTopWidth: 1, borderTopColor: colors.glassBorder, backgroundColor: colors.bg,
        }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Ask ${coach.name}…`}
            placeholderTextColor={colors.textDim}
            multiline
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => ask(input)}
            style={{
              flex: 1, maxHeight: 100, minHeight: 44, backgroundColor: colors.glassBg,
              borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.md,
              paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: colors.textPrimary,
            }}
          />
          <TouchableOpacity
            onPress={() => ask(input)}
            disabled={sending || !input.trim()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={{
              width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
              backgroundColor: coach.color, opacity: sending || !input.trim() ? 0.4 : 1,
            }}
          >
            <Send size={18} color={getTextOnColor(coach.color)} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
