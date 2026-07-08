// ============================================================
// COACH SCREEN — the AI home (Phase-2 IA)
//
// Reuses the existing AI plumbing (services/ai.js) — does NOT
// rebuild it. Two blocks:
//   A. Coach greeting + quick-command pills (getCoachGreeting /
//      getCoachResponse) + a "Build me a workout" CTA.
//   B. "Am I winning?" depth — the shared WinningVerdict driven by
//      the same useHubStats loader the Dashboard uses (no drift).
//
// HONEST BY DESIGN: every AI call is wrapped in try/catch and
// falls back to the memory-aware template string; isAIAvailable()
// === false surfaces an "Offline mode" label so fallbacks are
// labelled, not passed off as live. WinningVerdict skeletons while
// hubStats is null — never a NaN flash. Shell mirrors the Dashboard
// hub exactly (SafeAreaView edges=top, FadeInView stagger,
// useFocusEffect + hasLoaded ref, RefreshControl tint=coach.color).
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Sparkles } from 'lucide-react-native';

import FadeInView from '../components/FadeInView';
import GlassCard from '../components/GlassCard';
import WinningVerdict from '../components/WinningVerdict';
import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import { SPACING, RADIUS, FONT, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { loadHubStats } from '../hooks/useHubStats';
import { getCoachGreeting, getCoachResponse, isAIAvailable } from '../services/ai';
import { getFallbackResponse } from '../constants/coaches';
import * as haptics from '../services/haptics';

// Structured commands getCoachResponse already understands.
const QUICK_COMMANDS = [
  { key: 'tired', label: "I'm tired" },
  { key: 'harder', label: 'Make it harder' },
  { key: 'swap', label: 'Swap it up' },
  { key: 'start', label: 'Motivate me' },
];

export default function CoachScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  // Guard: a stale/corrupt coachId must never crash the Coach tab —
  // fall back to the default coach rather than undefined access.
  const coach = COACHES[coachId] || COACHES.hype;
  const CoachIcon = COACH_ICONS[coach.iconName] || COACH_ICONS.hype;
  const { colors } = useTheme();

  const [greeting, setGreeting] = useState('');
  const [messages, setMessages] = useState([]); // { id, command, text }
  const [sending, setSending] = useState(false);
  const [hubStats, setHubStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  const aiOffline = !isAIAvailable();

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    if (!hasLoaded.current) setLoading(true);
    // Greeting (memory-aware, async). Falls back to a static line on throw.
    try {
      const g = await getCoachGreeting(coachId);
      setGreeting(g || '');
    } catch (e) {
      console.warn('[Coach] greeting failed:', e);
      setGreeting('');
    }
    // Shared hub stats for the "am I winning?" block.
    const stats = await loadHubStats();
    setHubStats(stats);
    setLoading(false);
    hasLoaded.current = true;
  };

  const runCommand = async (cmd) => {
    if (sending) return;
    haptics.tap();
    setSending(true);
    let reply;
    try {
      reply = await getCoachResponse(coachId, cmd.key, {});
    } catch (e) {
      // getCoachResponse already falls back internally, but guard a throw too.
      reply = getFallbackResponse(coachId, cmd.key);
    }
    setMessages((prev) => [
      ...prev,
      { id: `${cmd.key}-${Date.now()}`, command: cmd.label, text: reply },
    ]);
    setSending(false);
  };

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={coach.color} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.screenPadding, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
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
              Offline mode · using saved responses
            </Text>
          )}
        </FadeInView>

        {/* Block A — coach greeting */}
        <GlassCard fadeDelay={120} accentColor={coach.color}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm }}>
            <View style={{ width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: coach.color + '18', alignItems: 'center', justifyContent: 'center' }}>
              <CoachIcon size={18} color={coach.color} strokeWidth={2.2} />
            </View>
            <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>{coach.name}</Text>
          </View>
          {greeting ? (
            <Text style={{ ...FONT.body, color: colors.textSecondary }}>{greeting}</Text>
          ) : (
            <Text style={{ ...FONT.body, color: colors.textMuted }}>Ready when you are.</Text>
          )}
        </GlassCard>

        {/* Quick-command pills */}
        <FadeInView delay={160} style={{ marginBottom: SPACING.md }}>
          <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: SPACING.sm }}>Ask your coach</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
            {QUICK_COMMANDS.map((cmd) => (
              <TouchableOpacity
                key={cmd.key}
                onPress={() => runCommand(cmd)}
                disabled={sending}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={cmd.label}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  minHeight: 44,
                  justifyContent: 'center',
                  borderRadius: RADIUS.round,
                  backgroundColor: colors.glassBg,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  opacity: sending ? 0.5 : 1,
                }}
              >
                <Text style={{ ...FONT.caption, color: colors.textSecondary }}>{cmd.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeInView>

        {/* Coach replies (local, appended) */}
        {messages.length > 0 && (
          <View style={{ marginBottom: SPACING.md, gap: SPACING.sm }}>
            {messages.map((m) => (
              <GlassCard key={m.id} style={{ marginBottom: 0 }}>
                <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: 4 }}>{m.command}</Text>
                <Text style={{ ...FONT.body, color: colors.textPrimary }}>{m.text}</Text>
              </GlassCard>
            ))}
          </View>
        )}
        {sending && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md }}>
            <ActivityIndicator size="small" color={coach.color} />
            <Text style={{ ...FONT.caption, color: colors.textMuted }}>Coach is thinking…</Text>
          </View>
        )}

        {/* Build-me-a-workout CTA — ties Coach into the generator path */}
        <FadeInView delay={200} style={{ marginBottom: SPACING.lg }}>
          <TouchableOpacity
            onPress={() => { haptics.medium(); navigation.navigate('BuildWorkout'); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Build me a workout"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: coach.color,
              paddingVertical: 14,
              borderRadius: RADIUS.md,
            }}
          >
            <Sparkles size={18} color={getTextOnColor(coach.color)} strokeWidth={2.2} />
            <Text style={{ ...FONT.subhead, color: getTextOnColor(coach.color) }}>Build me a workout</Text>
          </TouchableOpacity>
        </FadeInView>

        {/* Block B — "Am I winning?" depth (shared WinningVerdict data) */}
        <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: SPACING.sm }}>Am I winning?</Text>
        <WinningVerdict navigation={navigation} hubStats={hubStats} />
      </ScrollView>
    </SafeAreaView>
  );
}
