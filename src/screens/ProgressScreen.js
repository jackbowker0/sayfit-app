// ============================================================
// PROGRESS SCREEN — Exercise history & charts (premium dark UI)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import Svg, { Polyline, Circle, Path, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { TrendingUp, TrendingDown, BarChart3, Scale, Trophy } from 'lucide-react-native';
import FadeInView from '../components/FadeInView';
import { getMuscleIcon } from '../constants/icons';
import GlassCard from '../components/GlassCard';
import { FONT, GLOW, SPACING, RADIUS, getTextOnColor } from '../constants/theme';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { useTheme } from '../hooks/useTheme';
import { getExerciseSummaries, getProgressChartData } from '../services/exerciseLog';
import { getUserProfile } from '../services/userProfile';
import * as haptics from '../services/haptics';

export default function ProgressScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const [summaries, setSummaries] = useState([]);
  const [metric, setMetric] = useState('weight');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState('lbs');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    setLoading(true);
    const data = await getExerciseSummaries();
    setSummaries(data);
    const profile = await getUserProfile();
    if (profile.units) setUnits(profile.units);
    if (data.length > 0) {
      setSelectedExercise(data[0]);
      const chart = await getProgressChartData(data[0].name);
      setChartData(chart);
    }
    setLoading(false);
  };

  const handleSelectExercise = async (summary) => {
    haptics.tap();
    setSelectedExercise(summary);
    const chart = await getProgressChartData(summary.name);
    setChartData(chart);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={coach.color} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            tintColor={coach.color}
          />
        }
      >
        <FadeInView>
          <Text style={[FONT.title, { color: colors.textPrimary, marginBottom: 4 }]}>Progress</Text>
          <Text style={[FONT.caption, { color: colors.textMuted, marginBottom: 20 }]}>
            {summaries.length > 0 ? `${summaries.length} exercises tracked` : 'Log workouts to see progress'}
          </Text>
        </FadeInView>

        {summaries.length === 0 ? (
          <FadeInView delay={200} style={{ alignItems: 'center', paddingVertical: 60 }}>
            <BarChart3 size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={[FONT.subhead, { color: colors.textPrimary, marginBottom: 4 }]}>No exercises logged yet</Text>
            <Text style={[FONT.caption, { color: colors.textMuted, marginBottom: 20 }]}>Log a workout to start tracking</Text>
            <TouchableOpacity
              style={{ backgroundColor: coach.color, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.md }}
              onPress={() => { haptics.tap(); navigation.navigate('LogTab'); }}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={[FONT.caption, { fontWeight: '700', color: getTextOnColor(coach.color) }]}>Log Your First Workout</Text>
            </TouchableOpacity>
          </FadeInView>
        ) : (
          <>
            {/* Chart for selected exercise */}
            {selectedExercise && chartData.length > 1 && (
              <GlassCard fadeDelay={100} accentColor={coach.color}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <BarChart3 size={16} color={coach.color} style={{ marginRight: 6 }} />
                  <Text style={[FONT.subhead, { color: colors.textPrimary }]}>{selectedExercise.name}</Text>
                </View>
                <Text style={[FONT.caption, { color: colors.textMuted, marginBottom: 12 }]}>
                  {chartData.length} sessions · {metric === 'weight' ? 'Best weight' : metric === 'volume' ? 'Total volume' : 'Total reps'}
                </Text>

                {/* Metric toggle */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                  {[
                    { key: 'weight', label: 'Weight' },
                    { key: 'volume', label: 'Volume' },
                    { key: 'reps', label: 'Reps' },
                  ].map(m => (
                    <TouchableOpacity
                      key={m.key}
                      onPress={() => setMetric(m.key)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
                        backgroundColor: metric === m.key ? coach.color + '25' : 'transparent',
                        borderWidth: 1, borderColor: metric === m.key ? coach.color : colors.glassBorder,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[FONT.caption, { fontWeight: '600', color: metric === m.key ? coach.color : colors.textMuted }]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* SVG line chart */}
                {(() => {
                  const pts = chartData.slice(-20).filter(p => (p[metric] || 0) > 0);
                  if (pts.length < 2) return (
                    <Text style={[FONT.caption, { color: colors.textMuted, textAlign: 'center', paddingVertical: 20 }]}>Not enough data for this metric</Text>
                  );
                  const vals = pts.map(p => p[metric] || 0);
                  const minV = Math.min(...vals);
                  const maxV = Math.max(...vals);
                  const svgW = windowWidth - 72;
                  const svgH = 140;
                  const padT = 20, padB = 26, padL = 42, padR = 12;
                  const drawW = svgW - padL - padR;
                  const drawH = svgH - padT - padB;
                  const span = maxV - minV || 1;
                  const toX = i => padL + (i / Math.max(pts.length - 1, 1)) * drawW;
                  const toY = v => padT + (1 - (v - minV) / span) * drawH;
                  const linePoints = pts.map((p, i) => `${toX(i).toFixed(1)},${toY(p[metric]).toFixed(1)}`).join(' ');
                  const bottomY = svgH - padB;
                  const areaPath = [
                    `M ${toX(0).toFixed(1)},${toY(pts[0][metric]).toFixed(1)}`,
                    ...pts.map((p, i) => `L ${toX(i).toFixed(1)},${toY(p[metric]).toFixed(1)}`),
                    `L ${toX(pts.length - 1).toFixed(1)},${bottomY} L ${toX(0).toFixed(1)},${bottomY} Z`,
                  ].join(' ');
                  const prIdx = vals.indexOf(maxV);
                  const showDots = pts.length <= 20;
                  return (
                    <Svg width={svgW} height={svgH}>
                      <Defs>
                        <LinearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor={coach.color} stopOpacity="0.18" />
                          <Stop offset="1" stopColor={coach.color} stopOpacity="0" />
                        </LinearGradient>
                      </Defs>
                      <Line x1={padL} y1={padT} x2={padL} y2={svgH - padB}
                        stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} strokeWidth="1" />
                      <Line x1={padL} y1={padT + drawH / 2} x2={svgW - padR} y2={padT + drawH / 2}
                        stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} strokeWidth="1" strokeDasharray="4,3" />
                      <Path d={areaPath} fill="url(#pgrad)" />
                      <Polyline points={linePoints} stroke={coach.color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                      {showDots && pts.map((p, i) => {
                        const isPR = i === prIdx;
                        const isLast = i === pts.length - 1;
                        return (
                          <React.Fragment key={i}>
                            <Circle cx={toX(i)} cy={toY(p[metric])}
                              r={isPR ? 6 : isLast ? 5 : 3}
                              fill={isPR || isLast ? coach.color : colors.glassBg}
                              stroke={coach.color} strokeWidth={isPR || isLast ? 0 : 1.5} />
                            {isPR && (
                              <SvgText x={toX(i)} y={toY(p[metric]) - 10} fill={coach.color} fontSize="9" fontWeight="700" textAnchor="middle">PR</SvgText>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <SvgText x={padL - 4} y={toY(maxV) + 4} fill={colors.textMuted} fontSize="10" textAnchor="end">{maxV}</SvgText>
                      <SvgText x={padL - 4} y={toY(minV) + 4} fill={colors.textMuted} fontSize="10" textAnchor="end">{minV}</SvgText>
                      <SvgText x={padL} y={svgH - 6} fill={colors.textMuted} fontSize="9" textAnchor="start">{pts[0].label}</SvgText>
                      <SvgText x={svgW - padR} y={svgH - 6} fill={colors.textMuted} fontSize="9" textAnchor="end">{pts[pts.length - 1].label}</SvgText>
                    </Svg>
                  );
                })()}
              </GlassCard>
            )}

            {/* Exercise list */}
            <FadeInView delay={200}>
              <Text style={[FONT.label, { color: colors.textMuted, marginBottom: 12 }]}>All Exercises</Text>
            </FadeInView>

            {summaries.map((s, i) => {
              const isSelected = selectedExercise?.normalizedName === s.normalizedName;
              const MuscleIcon = getMuscleIcon(s.muscleGroup);
              return (
                <GlassCard
                  key={s.normalizedName}
                  fadeDelay={250 + i * 60}
                  accentColor={isSelected ? coach.color : undefined}
                  glow={isSelected}
                  noPadding
                >
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                    }}
                    onPress={() => handleSelectExercise(s)}
                    activeOpacity={0.7}
                  >
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: RADIUS.sm,
                      backgroundColor: isSelected ? `${coach.color}18` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}>
                      <MuscleIcon size={16} color={isSelected ? coach.color : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[FONT.body, { fontWeight: '600', color: isSelected ? coach.color : colors.textPrimary }]}>{s.name}</Text>
                      <Text style={[FONT.caption, { color: colors.textMuted, marginTop: 2 }]}>
                        {s.sessionCount} session{s.sessionCount > 1 ? 's' : ''} · Best: {s.pr?.maxWeight || 0} {units}
                      </Text>
                    </View>
                    {s.trend !== 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {s.trend > 0 ? (
                          <TrendingUp size={14} color={colors.green} style={{ marginRight: 3 }} />
                        ) : (
                          <TrendingDown size={14} color={colors.red} style={{ marginRight: 3 }} />
                        )}
                        <Text style={[FONT.caption, { fontWeight: '600', color: s.trend > 0 ? colors.green : colors.red }]}>
                          {Math.abs(s.trend)} {units}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </GlassCard>
              );
            })}

            {/* Shortcut row */}
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
              <GlassCard
                fadeDelay={250 + summaries.length * 60 + 60}
                style={{ flex: 1 }}
              >
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => { haptics.tap(); navigation.navigate('PRWall'); }}
                  activeOpacity={0.7}
                >
                  <Trophy size={16} color={coach.color} style={{ marginRight: 8 }} />
                  <Text style={[FONT.subhead, { color: coach.color }]}>PR Wall</Text>
                </TouchableOpacity>
              </GlassCard>
              <GlassCard
                fadeDelay={250 + summaries.length * 60 + 80}
                style={{ flex: 1 }}
              >
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => { haptics.tap(); navigation.navigate('Weight'); }}
                  activeOpacity={0.7}
                >
                  <Scale size={16} color={coach.color} style={{ marginRight: 8 }} />
                  <Text style={[FONT.subhead, { color: coach.color }]}>Body Weight</Text>
                </TouchableOpacity>
              </GlassCard>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
