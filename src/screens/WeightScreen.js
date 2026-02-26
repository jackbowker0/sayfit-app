// ============================================================
// WEIGHT SCREEN — Premium dark body weight tracker
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FadeInView from '../components/FadeInView';
import {
  Scale, ChevronLeft, TrendingUp, TrendingDown, ArrowDown, ArrowUp,
} from 'lucide-react-native';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, FONT, GLOW, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getUserProfile } from '../services/userProfile';
import { checkActionAchievement } from '../services/achievements';
import * as haptics from '../services/haptics';
import GlassCard from '../components/GlassCard';

const WEIGHT_KEY = 'sayfit_weight_log';

export default function WeightScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const [entries, setEntries] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState('lbs');
  const [range, setRange] = useState('1M');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(WEIGHT_KEY);
      const data = raw ? JSON.parse(raw) : [];
      setEntries(data.sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (e) { setEntries([]); }
    const profile = await getUserProfile();
    if (profile.units) setUnits(profile.units);
    setLoading(false);
  };

  const handleLog = async () => {
    const val = parseFloat(input);
    if (!val || val < 50 || val > 500) {
      Alert.alert('Invalid', `Enter a weight between 50-500 ${units}`);
      return;
    }
    haptics.success();
    const entry = { weight: val, date: new Date().toISOString(), id: Date.now().toString() };
    const updated = [...entries, entry];
    await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(updated));
    setEntries(updated);
    setInput('');
    // Achievement: logged body weight
    checkActionAchievement('weight_logged');
  };

  const getFilteredEntries = () => {
    const now = new Date();
    const days = range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : 365;
    const cutoff = new Date(now - days * 86400000);
    return entries.filter(e => new Date(e.date) >= cutoff);
  };

  const filtered = getFilteredEntries();
  const latest = entries.length > 0 ? entries[entries.length - 1] : null;
  const previous = entries.length > 1 ? entries[entries.length - 2] : null;
  const change = latest && previous ? (latest.weight - previous.weight).toFixed(1) : null;
  const min = filtered.length > 0 ? Math.min(...filtered.map(e => e.weight)) : 0;
  const max = filtered.length > 0 ? Math.max(...filtered.map(e => e.weight)) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor={coach.color} />}>

        {/* Header */}
        <FadeInView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Scale size={24} color={coach.color} strokeWidth={2} />
              <Text style={{ ...FONT.title, color: colors.textPrimary }}>Weight</Text>
            </View>
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 4, marginLeft: 34 }}>Track your body weight</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={16} color={coach.color} strokeWidth={2.5} />
            <Text style={{ ...FONT.caption, color: coach.color, fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
        </FadeInView>

        {/* Quick Log */}
        <GlassCard fadeDelay={100} accentColor={coach.color}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.glassBorder,
                borderRadius: RADIUS.md, padding: 14, fontSize: 18, color: colors.textPrimary,
                textAlign: 'center', fontWeight: '700', fontVariant: ['tabular-nums'],
              }}
              placeholder={`Weight (${units})`}
              placeholderTextColor={colors.textDim}
              value={input}
              onChangeText={setInput}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={handleLog}
            />
            <TouchableOpacity
              style={{
                backgroundColor: coach.color, paddingHorizontal: 20, paddingVertical: 14,
                borderRadius: RADIUS.md,
                ...(isDark ? {
                  shadowColor: coach.color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: GLOW.md,
                } : {}),
              }}
              onPress={handleLog}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: getTextOnColor(coach.color) }}>Log</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {loading ? (
          <ActivityIndicator size="large" color={coach.color} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <FadeInView delay={200} style={{ alignItems: 'center', paddingVertical: 40 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
              alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}>
              <Scale size={28} color={colors.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={{ ...FONT.subhead, color: colors.textPrimary }}>No entries yet</Text>
            <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 4 }}>Log your weight above to start tracking</Text>
          </FadeInView>
        ) : (
          <>
            {/* Stats */}
            <FadeInView delay={200} style={{ flexDirection: 'row', gap: 10, marginBottom: SPACING.md }}>
              <GlassCard style={{ flex: 1, alignItems: 'center' }} accentColor={coach.color} glow>
                <Scale size={14} color={coach.color} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                <Text style={{ ...FONT.stat, color: coach.color }}>{latest?.weight}</Text>
                <Text style={{ ...FONT.label, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>CURRENT ({units})</Text>
              </GlassCard>
              {change !== null && (
                <GlassCard style={{ flex: 1, alignItems: 'center' }} accentColor={parseFloat(change) <= 0 ? colors.green : colors.red}>
                  {parseFloat(change) <= 0
                    ? <TrendingDown size={14} color={colors.green} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                    : <TrendingUp size={14} color={colors.red} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                  }
                  <Text style={{ ...FONT.stat, color: parseFloat(change) <= 0 ? colors.green : colors.red }}>
                    {parseFloat(change) > 0 ? '+' : ''}{change}
                  </Text>
                  <Text style={{ ...FONT.label, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>CHANGE ({units})</Text>
                </GlassCard>
              )}
            </FadeInView>

            {/* Range Selector */}
            <FadeInView delay={300} style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md }}>
              {['1W', '1M', '3M', '1Y'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.md,
                    backgroundColor: range === r ? coach.color + '20' : colors.glassBg,
                    borderWidth: 1, borderColor: range === r ? coach.color : colors.glassBorder,
                  }}
                  onPress={() => setRange(r)}
                >
                  <Text style={{ ...FONT.caption, fontWeight: '600', color: range === r ? coach.color : colors.textSecondary }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </FadeInView>

            {/* Chart */}
            {filtered.length > 1 && (
              <GlassCard fadeDelay={350} accentColor={coach.color}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 2 }}>
                  {filtered.slice(-20).map((entry, i) => {
                    const chartMin = min - 2;
                    const chartMax = max + 2;
                    const pct = ((entry.weight - chartMin) / (chartMax - chartMin)) * 100;
                    const isLast = i === filtered.slice(-20).length - 1;
                    return (
                      <View key={entry.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <View style={{
                          width: '80%', borderRadius: 3, minHeight: 4,
                          height: `${Math.max(pct, 5)}%`,
                          backgroundColor: isLast ? coach.color : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                          ...(isLast && isDark ? {
                            shadowColor: coach.color,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.4,
                            shadowRadius: GLOW.sm,
                          } : {}),
                        }} />
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ArrowDown size={10} color={colors.textMuted} strokeWidth={2} />
                    <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted }}>Low: {min} {units}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ArrowUp size={10} color={colors.textMuted} strokeWidth={2} />
                    <Text style={{ ...FONT.label, fontSize: 10, color: colors.textMuted }}>High: {max} {units}</Text>
                  </View>
                </View>
              </GlassCard>
            )}

            {/* History */}
            <FadeInView delay={400}>
              <Text style={{ ...FONT.label, color: colors.textMuted, marginBottom: 12 }}>History</Text>
              <GlassCard>
                {entries.slice(-10).reverse().map((e, i) => (
                  <View key={e.id} style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                    borderBottomWidth: i < 9 ? 1 : 0, borderBottomColor: colors.glassBorder,
                  }}>
                    <Text style={{ flex: 1, ...FONT.body, fontSize: 14, color: colors.textSecondary }}>
                      {new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>{e.weight} {units}</Text>
                  </View>
                ))}
              </GlassCard>
            </FadeInView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
