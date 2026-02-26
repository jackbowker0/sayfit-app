// ============================================================
// WEIGHT SCREEN — Body weight tracker (themed + achievements)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { getUserProfile } from '../services/userProfile';
import { checkActionAchievement } from '../services/achievements';
import * as haptics from '../services/haptics';

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

  const card = (extra) => ({
    backgroundColor: colors.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: colors.border, padding: SPACING.md,
    marginBottom: SPACING.md,
    ...(isDark ? {} : { shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 }),
    ...extra,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor={coach.color} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}>Weight</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>Track your body weight</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 14, color: coach.color, fontWeight: '600' }}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Log */}
        <View style={card()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
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
              style={{ backgroundColor: coach.color, paddingHorizontal: 20, paddingVertical: 14, borderRadius: RADIUS.md }}
              onPress={handleLog}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: getTextOnColor(coach.color) }}>Log</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={coach.color} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>⚖️</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>No entries yet</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>Log your weight above to start tracking</Text>
          </View>
        ) : (
          <>
            {/* Stats */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: SPACING.md }}>
              <View style={card({ flex: 1, alignItems: 'center' })}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: coach.color }}>{latest?.weight}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>CURRENT ({units})</Text>
              </View>
              {change !== null && (
                <View style={card({ flex: 1, alignItems: 'center' })}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: parseFloat(change) <= 0 ? colors.green : colors.red }}>
                    {parseFloat(change) > 0 ? '+' : ''}{change}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>CHANGE ({units})</Text>
                </View>
              )}
            </View>

            {/* Range Selector */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md }}>
              {['1W', '1M', '3M', '1Y'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.md,
                    backgroundColor: range === r ? coach.color + '20' : colors.bgCard,
                    borderWidth: 1, borderColor: range === r ? coach.color : colors.border,
                  }}
                  onPress={() => setRange(r)}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: range === r ? coach.color : colors.textSecondary }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Chart */}
            {filtered.length > 1 && (
              <View style={card()}>
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
                        }} />
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>Low: {min} {units}</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>High: {max} {units}</Text>
                </View>
              </View>
            )}

            {/* History */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>History</Text>
            {entries.slice(-10).reverse().map((e, i) => (
              <View key={e.id} style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                borderBottomWidth: i < 9 ? 1 : 0, borderBottomColor: colors.border,
              }}>
                <Text style={{ flex: 1, fontSize: 14, color: colors.textSecondary }}>
                  {new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{e.weight} {units}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}