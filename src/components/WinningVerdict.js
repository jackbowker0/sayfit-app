// ============================================================
// WINNING VERDICT — the "Am I winning?" one-liner (V1)
//
// Plain-English status derived from the user's REAL data:
//   body-weight trend + today's macro adherence, composed into
//   one headline + one supporting subline + a semantic status
//   token (icon + word) + an optional weight sparkline.
//
// HONEST BY DESIGN:
//  - Every printed number comes straight from a stat field; a
//    missing datum is omitted, never fabricated or zeroed.
//  - weekChange is NULL (not 0) when there's no ~7-day-ago entry,
//    so we always branch on `=== null` before signing/printing.
//  - Status color is SEMANTIC ONLY and decoupled from coach.color
//    (hype's #FFDC00 collides with semantic yellow). Every color
//    is paired with an icon AND a word — colorblind-safe.
//  - This is NOT a goal-direction claim (no "on track"/"winning").
//    There's no goal-direction field to verify against, so we state
//    the observed trend as a fact with a soft semantic tint. The
//    full adaptive-TDEE fusion is a later phase.
//
// Data is passed in via `hubStats` (fetched once by the Dashboard
// so the tile grid and verdict share a single load). Renders a
// skeleton while hubStats is null — never an empty flash or NaN.
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import {
  TrendingDown, TrendingUp, Minus, Activity, Sparkles,
} from 'lucide-react-native';

import { SPACING, RADIUS, FONT } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import GlassCard from './GlassCard';

const SPARK_W = 56;
const SPARK_H = 20;

// Days between an ISO date and now (floored). Guards a malformed/invalid date
// so a garbage `currentDate` yields null (omit the label) instead of "NaNd ago".
function daysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function timeAgoLabel(iso) {
  const d = daysSince(iso);
  if (d === null) return null;
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

// Build the macro clause appended to the subline (priorities 1-4).
// Returns '' when no target is set (silent degrade — never prints "0").
function macroClause(nutri) {
  if (!nutri || !nutri.remaining) return '';
  const { remaining, mealCount, pendingCount = 0 } = nutri;

  const clauseFor = (rem, label, unit) => {
    if (mealCount === 0) {
      // Be honest about unreviewed AI/voice meals instead of claiming "none".
      return pendingCount > 0
        ? ` · ${pendingCount} meal${pendingCount === 1 ? '' : 's'} pending review.`
        : ' · No meals logged yet today.';
    }
    if (rem <= 0) return ` · ${label} hit.`;
    return ` · ${rem}${unit} ${label.toLowerCase()} to go.`;
  };

  if (remaining.protein !== null) return clauseFor(remaining.protein, 'Protein', 'g');
  if (remaining.kcal !== null) return clauseFor(remaining.kcal, 'Calories', '');
  return '';
}

// The priority ladder (first match wins). Returns a verdict descriptor.
function deriveVerdict(hubStats, colors) {
  const { wStats, nStats, lastWorkoutDate, units } = hubStats;
  const u = units || 'lbs';

  const weightEntries = wStats?.entryCount || 0;
  const mealCount = nStats?.mealCount || 0;
  const hasWorkout = !!lastWorkoutDate;
  const weekChange = wStats?.weekChange ?? null;
  const macro = macroClause(nStats);

  // 0 — Brand-new / no data anywhere (protocol seed ignored).
  if (weightEntries === 0 && mealCount === 0 && !hasWorkout) {
    return {
      Icon: Sparkles,
      color: colors.textMuted,
      word: 'Getting started',
      headline: "Let's get your first data in.",
      subline: 'Log a workout, a meal, or your weight to start tracking.',
      tappable: true,
    };
  }

  // 1 — Stalled (need >= 3 entries and a real, tiny weekChange).
  if (weightEntries >= 3 && weekChange !== null && Math.abs(weekChange) < 0.3) {
    return {
      Icon: Minus,
      color: colors.yellow,
      word: 'Holding steady',
      headline: "Weight's holding steady this week.",
      subline: macro.trim() ? macro.replace(/^ · /, '') : 'A stable week. Keep the inputs consistent.',
    };
  }

  // 2 — Trending down.
  if (weekChange !== null && weekChange <= -0.3) {
    return {
      Icon: TrendingDown,
      color: colors.green,
      word: 'Trending down',
      headline: `Down ${Math.abs(weekChange).toFixed(1)} ${u} this week.`,
      subline: macro.trim() ? macro.replace(/^ · /, '') : 'Your weight is trending down.',
    };
  }

  // 3 — Trending up.
  if (weekChange !== null && weekChange >= 0.3) {
    return {
      Icon: TrendingUp,
      color: colors.orange,
      word: 'Trending up',
      headline: `Up ${weekChange.toFixed(1)} ${u} this week.`,
      subline: macro.trim() ? macro.replace(/^ · /, '') : 'Your weight is trending up.',
    };
  }

  // 4 — Have a weight but no recent trend yet.
  if (wStats?.current != null && weekChange === null) {
    const ago = timeAgoLabel(wStats.currentDate);
    return {
      Icon: Activity,
      color: colors.textMuted,
      word: 'Tracking',
      headline: `${wStats.current} ${u} logged${ago ? `, ${ago}` : ''}.`,
      subline: macro.trim() ? macro.replace(/^ · /, '') : 'Log again in a few days to see your trend.',
    };
  }

  // 5 — No weight yet, but macros and/or workouts exist. Macro-led headline.
  if (mealCount > 0 && nStats?.remaining?.protein !== null) {
    return {
      Icon: Activity,
      color: colors.textMuted,
      word: 'Tracking',
      headline: `${nStats.totals?.protein ?? 0}g protein in today.`,
      subline: 'Log your weight to see the full picture.',
    };
  }
  if (hasWorkout) {
    const ago = timeAgoLabel(lastWorkoutDate);
    return {
      Icon: Activity,
      color: colors.textMuted,
      word: 'Tracking',
      headline: `Last workout ${ago}.`,
      subline: 'Log your weight to see the full picture.',
    };
  }

  // Fallback (e.g. only pending meals / only a target set) — stay honest.
  return {
    Icon: Activity,
    color: colors.textMuted,
    word: 'Tracking',
    headline: "You're getting set up.",
    subline: 'Log your weight to see the full picture.',
  };
}

// Hand-rolled monochrome sparkline over the weight chart (ascending).
// Renders nothing below 2 points (no fake flat line). Normalizes y over
// [min, max] with 2px vertical padding so a flat series still draws centered.
function Sparkline({ chart, color, word }) {
  if (!Array.isArray(chart) || chart.length < 2) return null;

  const weights = chart.map(c => c.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  const pad = 2;
  const usableH = SPARK_H - pad * 2;

  const points = chart.map((c, i) => {
    const x = (i / (chart.length - 1)) * SPARK_W;
    // Higher weight → higher on chart (smaller y).
    const y = pad + (1 - (c.weight - min) / span) * usableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <View
      accessible
      accessibilityLabel={`Weight trend, last ${chart.length} entries, ${word}`}
      style={{ marginLeft: 'auto' }}
    >
      <Svg width={SPARK_W} height={SPARK_H}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export default function WinningVerdict({ navigation, hubStats }) {
  const { colors } = useTheme();

  // Skeleton while the Dashboard's single fetch is in flight.
  if (!hubStats) {
    return (
      <GlassCard fadeDelay={80}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm }}>
          <View style={{ width: 28, height: 28, borderRadius: RADIUS.sm, backgroundColor: colors.bgSubtle }} />
          <View style={{ width: 90, height: 12, borderRadius: 6, backgroundColor: colors.bgSubtle }} />
        </View>
        <View style={{ width: '70%', height: 18, borderRadius: 6, backgroundColor: colors.bgSubtle, marginBottom: 8 }} />
        <View style={{ width: '50%', height: 13, borderRadius: 6, backgroundColor: colors.bgSubtle }} />
      </GlassCard>
    );
  }

  const v = deriveVerdict(hubStats, colors);
  const chart = hubStats.wChart || [];
  const showSpark = !v.tappable && chart.length >= 2;

  const body = (
    <>
      {/* Top row: status token (icon chip + word) + sparkline */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{
          width: 28, height: 28, borderRadius: RADIUS.sm,
          backgroundColor: v.color + '18',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <v.Icon size={18} color={v.color} strokeWidth={2} />
        </View>
        <Text style={{ ...FONT.label, color: v.color }}>{v.word}</Text>
        {showSpark && <Sparkline chart={chart} color={v.color} word={v.word} />}
      </View>

      <Text style={{ ...FONT.heading, color: colors.textPrimary, marginTop: SPACING.sm }}>
        {v.headline}
      </Text>
      <Text
        numberOfLines={2}
        style={{ ...FONT.body, color: colors.textSecondary, marginTop: 2 }}
      >
        {v.subline}
      </Text>
    </>
  );

  return (
    <GlassCard fadeDelay={80}>
      {v.tappable ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('LogWorkout')}
          activeOpacity={0.8}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${v.headline} ${v.subline} Tap to log your first workout.`}
        >
          {body}
        </TouchableOpacity>
      ) : (
        <View accessible accessibilityLabel={`${v.word}. ${v.headline} ${v.subline}`}>
          {body}
        </View>
      )}
    </GlassCard>
  );
}
