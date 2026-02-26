// ============================================================
// SHARE CARD TEMPLATES — Renderers for each share card style
//
// Each template is a React Native component that renders
// inside a view-shot capture area. All templates receive
// the same props and render differently.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COACHES } from '../constants/coaches';
import { formatTime } from '../utils/helpers';

const MUSCLE_EMOJI = {
  Legs: '🦵', Chest: '💪', Core: '🔥', Back: '🦸',
  Shoulders: '🔺', Glutes: '🍑', Arms: '💪', Cardio: '🏃',
  'Full Body': '🫀',
};

function getShareQuote(coachId, stats, elapsed) {
  const mins = Math.floor(elapsed / 60);
  if (coachId === 'drill') {
    if (stats.adaptations >= 3) return "Adapted and overcame. That's a warrior.";
    if (stats.calories >= 100) return `${stats.calories} calories destroyed. No mercy.`;
    if (mins >= 20) return `${mins} minutes. No shortcuts. EARNED.`;
    return "Another one in the books. Respect.";
  }
  if (coachId === 'hype') {
    if (stats.adaptations >= 3) return `${stats.adaptations} adaptations?! You listened to your body AND crushed it! 🔥`;
    if (stats.calories >= 100) return `${stats.calories} calories gone! You're literally on FIRE! ⚡`;
    if (mins >= 20) return `${mins} minutes of pure MAGIC! You're unstoppable! ✨`;
    return "Another workout CRUSHED! You're amazing! 🎉";
  }
  if (stats.adaptations >= 3) return "Your body guided you wisely. Beautiful practice.";
  if (mins >= 20) return `${mins} minutes of mindful movement. Your dedication inspires.`;
  return "Movement completed with intention. Namaste.";
}

function getLoggedQuote(coachId, stats) {
  if (coachId === 'drill') {
    if (stats.totalSets >= 15) return `${stats.totalSets} sets. That's volume. That's WORK.`;
    return "Logged and accounted for. Every rep matters.";
  }
  if (coachId === 'hype') {
    if (stats.totalSets >= 15) return `${stats.totalSets} sets?! You went OFF today! 🔥`;
    return "Every set logged is a win tracked! 💪";
  }
  if (stats.totalSets >= 15) return `${stats.totalSets} sets of mindful practice. Impressive dedication.`;
  return "Your practice, recorded with intention.";
}

const dateString = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

// ─── CLASSIC (original dark card) ───────────────────────────

export function ClassicTemplate({ coachId, stats, elapsed, muscles, workoutName, streak, visibility, isLoggedWorkout }) {
  const coach = COACHES[coachId];
  const quote = isLoggedWorkout ? getLoggedQuote(coachId, stats) : getShareQuote(coachId, stats, elapsed);
  const C = CLASSIC_COLORS;

  return (
    <View style={[classicStyles.card, { backgroundColor: C.bg }]}>
      <View style={[classicStyles.topBar, { backgroundColor: coach.color }]} />

      {/* Header */}
      <View style={classicStyles.header}>
        <View style={classicStyles.brandRow}>
          <Text style={[classicStyles.brandText, { color: C.textSecondary }]}>SAYFIT</Text>
          <Text style={[classicStyles.brandDot, { color: C.textDim }]}>•</Text>
          <Text style={[classicStyles.coachLabel, { color: C.textSecondary }]}>{coach.emoji} {coach.name}</Text>
        </View>
        <Text style={[classicStyles.workoutName, { color: C.textPrimary }]}>{workoutName || 'Workout Complete'}</Text>
        <Text style={[classicStyles.dateText, { color: C.textMuted }]}>{dateString()}</Text>
      </View>

      {/* Stats */}
      <View style={[classicStyles.statsRow, { backgroundColor: C.cardBg }]}>
        {visibility.time && (
          <>
            <View style={classicStyles.statBox}>
              <Text style={[classicStyles.statValue, { color: coach.color }]}>{formatTime(elapsed)}</Text>
              <Text style={[classicStyles.statLabel, { color: C.textMuted }]}>TIME</Text>
            </View>
            <View style={[classicStyles.statDivider, { backgroundColor: coach.color + '30' }]} />
          </>
        )}
        {!isLoggedWorkout && visibility.calories && (
          <>
            <View style={classicStyles.statBox}>
              <Text style={[classicStyles.statValue, { color: coach.color }]}>{stats.calories}</Text>
              <Text style={[classicStyles.statLabel, { color: C.textMuted }]}>CALS</Text>
            </View>
            <View style={[classicStyles.statDivider, { backgroundColor: coach.color + '30' }]} />
          </>
        )}
        {visibility.exercises && (
          <View style={classicStyles.statBox}>
            <Text style={[classicStyles.statValue, { color: coach.color }]}>{stats.exercisesCompleted}</Text>
            <Text style={[classicStyles.statLabel, { color: C.textMuted }]}>EXERCISES</Text>
          </View>
        )}
        {!isLoggedWorkout && visibility.adaptations && stats.adaptations > 0 && (
          <>
            <View style={[classicStyles.statDivider, { backgroundColor: coach.color + '30' }]} />
            <View style={classicStyles.statBox}>
              <Text style={[classicStyles.statValue, { color: coach.color }]}>{stats.adaptations}</Text>
              <Text style={[classicStyles.statLabel, { color: C.textMuted }]}>ADAPTED</Text>
            </View>
          </>
        )}
        {isLoggedWorkout && visibility.sets && (
          <>
            <View style={[classicStyles.statDivider, { backgroundColor: coach.color + '30' }]} />
            <View style={classicStyles.statBox}>
              <Text style={[classicStyles.statValue, { color: coach.color }]}>{stats.totalSets}</Text>
              <Text style={[classicStyles.statLabel, { color: C.textMuted }]}>SETS</Text>
            </View>
          </>
        )}
        {isLoggedWorkout && visibility.volume && stats.totalVolume > 0 && (
          <>
            <View style={[classicStyles.statDivider, { backgroundColor: coach.color + '30' }]} />
            <View style={classicStyles.statBox}>
              <Text style={[classicStyles.statValue, { color: coach.color }]}>{stats.totalVolume.toLocaleString()}</Text>
              <Text style={[classicStyles.statLabel, { color: C.textMuted }]}>VOL</Text>
            </View>
          </>
        )}
      </View>

      {/* Muscles */}
      {visibility.muscles && muscles.length > 0 && (
        <View style={classicStyles.muscleRow}>
          {muscles.map(m => (
            <View key={m} style={[classicStyles.muscleChip, { borderColor: coach.color + '50', backgroundColor: C.cardBg }]}>
              <Text style={[classicStyles.muscleChipText, { color: C.textBody }]}>{MUSCLE_EMOJI[m] || '💪'} {m}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quote */}
      {visibility.coachQuote && (
        <View style={[classicStyles.quoteBox, { borderLeftColor: coach.color }]}>
          <Text style={[classicStyles.quoteText, { color: C.textBody }]}>"{quote}"</Text>
          <Text style={[classicStyles.quoteSig, { color: coach.color }]}>— {coach.name}</Text>
        </View>
      )}

      {/* Streak */}
      {visibility.streak && streak >= 2 && (
        <View style={[classicStyles.streakBadge, { backgroundColor: coach.color + '15', borderColor: coach.color + '30' }]}>
          <Text style={[classicStyles.streakText, { color: C.textBody }]}>🔥 {streak}-day streak</Text>
        </View>
      )}

      {/* Footer */}
      <View style={classicStyles.footer}>
        <Text style={[classicStyles.footerText, { color: C.textDim }]}>Built with SayFit — AI fitness coaching that adapts to you</Text>
      </View>
    </View>
  );
}

const CLASSIC_COLORS = {
  bg: '#0A0A0F',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
  textDim: 'rgba(255,255,255,0.25)',
  textBody: 'rgba(255,255,255,0.8)',
  border: 'rgba(255,255,255,0.07)',
  cardBg: 'rgba(255,255,255,0.024)',
};

const classicStyles = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: CLASSIC_COLORS.border },
  topBar: { height: 4, width: '100%' },
  header: { padding: 20, paddingBottom: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  brandText: { fontSize: 13, fontWeight: '900', letterSpacing: 3 },
  brandDot: { fontSize: 13, marginHorizontal: 8 },
  coachLabel: { fontSize: 13, fontWeight: '600' },
  workoutName: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  dateText: { fontSize: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: 16, borderRadius: 14 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 9, letterSpacing: 1.5, marginTop: 3, fontWeight: '600' },
  statDivider: { width: 1, height: 30 },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, paddingTop: 14 },
  muscleChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  muscleChipText: { fontSize: 11, fontWeight: '500' },
  quoteBox: { marginHorizontal: 20, marginTop: 16, paddingLeft: 14, borderLeftWidth: 3 },
  quoteText: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  quoteSig: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  streakBadge: { alignSelf: 'flex-start', marginLeft: 20, marginTop: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  streakText: { fontSize: 12, fontWeight: '600' },
  footer: { padding: 16, paddingTop: 18, alignItems: 'center' },
  footerText: { fontSize: 10, letterSpacing: 0.5 },
});

// ─── MINIMAL (clean white design) ───────────────────────────

export function MinimalTemplate({ coachId, stats, elapsed, muscles, workoutName, streak, visibility, isLoggedWorkout }) {
  const coach = COACHES[coachId];
  const quote = isLoggedWorkout ? getLoggedQuote(coachId, stats) : getShareQuote(coachId, stats, elapsed);

  return (
    <View style={minimalStyles.card}>
      <Text style={minimalStyles.workoutName}>{workoutName || 'Workout Complete'}</Text>
      <Text style={minimalStyles.dateText}>{dateString()}</Text>

      <View style={minimalStyles.divider} />

      {/* Stats */}
      <View style={minimalStyles.statsRow}>
        {visibility.time && (
          <View style={minimalStyles.statBox}>
            <Text style={minimalStyles.statValue}>{formatTime(elapsed)}</Text>
            <Text style={minimalStyles.statLabel}>Time</Text>
          </View>
        )}
        {!isLoggedWorkout && visibility.calories && (
          <View style={minimalStyles.statBox}>
            <Text style={minimalStyles.statValue}>{stats.calories}</Text>
            <Text style={minimalStyles.statLabel}>Calories</Text>
          </View>
        )}
        {visibility.exercises && (
          <View style={minimalStyles.statBox}>
            <Text style={minimalStyles.statValue}>{stats.exercisesCompleted}</Text>
            <Text style={minimalStyles.statLabel}>Exercises</Text>
          </View>
        )}
        {isLoggedWorkout && visibility.sets && (
          <View style={minimalStyles.statBox}>
            <Text style={minimalStyles.statValue}>{stats.totalSets}</Text>
            <Text style={minimalStyles.statLabel}>Sets</Text>
          </View>
        )}
        {isLoggedWorkout && visibility.volume && stats.totalVolume > 0 && (
          <View style={minimalStyles.statBox}>
            <Text style={minimalStyles.statValue}>{stats.totalVolume.toLocaleString()}</Text>
            <Text style={minimalStyles.statLabel}>Volume</Text>
          </View>
        )}
      </View>

      {/* Muscles */}
      {visibility.muscles && muscles.length > 0 && (
        <Text style={minimalStyles.muscleText}>{muscles.join(' · ')}</Text>
      )}

      {/* Quote */}
      {visibility.coachQuote && (
        <Text style={minimalStyles.quoteText}>"{quote}" — {coach.name}</Text>
      )}

      {/* Streak */}
      {visibility.streak && streak >= 2 && (
        <Text style={minimalStyles.streakText}>🔥 {streak}-day streak</Text>
      )}

      <View style={minimalStyles.divider} />
      <Text style={minimalStyles.footerText}>SayFit</Text>
    </View>
  );
}

const minimalStyles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 28, alignItems: 'center' },
  workoutName: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 4 },
  dateText: { fontSize: 12, color: '#999', marginBottom: 4 },
  divider: { width: 40, height: 2, backgroundColor: '#E0E0E0', marginVertical: 18 },
  statsRow: { flexDirection: 'row', gap: 28, marginBottom: 16 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '900', color: '#1A1A1A', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 10, color: '#999', marginTop: 2, fontWeight: '500' },
  muscleText: { fontSize: 13, color: '#666', marginBottom: 14, textAlign: 'center' },
  quoteText: { fontSize: 13, color: '#555', fontStyle: 'italic', textAlign: 'center', lineHeight: 20, marginBottom: 10, paddingHorizontal: 12 },
  streakText: { fontSize: 13, color: '#FF6B35', fontWeight: '600', marginBottom: 8 },
  footerText: { fontSize: 11, fontWeight: '800', color: '#CCC', letterSpacing: 3 },
});

// ─── STORY (Instagram Stories 9:16) ─────────────────────────

export function StoryTemplate({ coachId, stats, elapsed, muscles, workoutName, streak, visibility, isLoggedWorkout }) {
  const coach = COACHES[coachId];
  const quote = isLoggedWorkout ? getLoggedQuote(coachId, stats) : getShareQuote(coachId, stats, elapsed);
  const C = CLASSIC_COLORS;

  return (
    <View style={[storyStyles.card, { backgroundColor: C.bg }]}>
      {/* Top branding */}
      <View style={storyStyles.topSection}>
        <Text style={[storyStyles.brandText, { color: coach.color }]}>SAYFIT</Text>
        <Text style={[storyStyles.coachBadge, { color: C.textSecondary }]}>{coach.emoji} {coach.name}</Text>
      </View>

      {/* Center content */}
      <View style={storyStyles.centerSection}>
        <Text style={[storyStyles.workoutName, { color: C.textPrimary }]}>{workoutName || 'Workout Complete'}</Text>
        <Text style={[storyStyles.dateText, { color: C.textMuted }]}>{dateString()}</Text>

        {/* Big stats */}
        <View style={storyStyles.statsGrid}>
          {visibility.time && (
            <View style={storyStyles.statBox}>
              <Text style={[storyStyles.statValue, { color: coach.color }]}>{formatTime(elapsed)}</Text>
              <Text style={[storyStyles.statLabel, { color: C.textMuted }]}>TIME</Text>
            </View>
          )}
          {!isLoggedWorkout && visibility.calories && (
            <View style={storyStyles.statBox}>
              <Text style={[storyStyles.statValue, { color: coach.color }]}>{stats.calories}</Text>
              <Text style={[storyStyles.statLabel, { color: C.textMuted }]}>CALS</Text>
            </View>
          )}
          {visibility.exercises && (
            <View style={storyStyles.statBox}>
              <Text style={[storyStyles.statValue, { color: coach.color }]}>{stats.exercisesCompleted}</Text>
              <Text style={[storyStyles.statLabel, { color: C.textMuted }]}>EXERCISES</Text>
            </View>
          )}
          {isLoggedWorkout && visibility.sets && (
            <View style={storyStyles.statBox}>
              <Text style={[storyStyles.statValue, { color: coach.color }]}>{stats.totalSets}</Text>
              <Text style={[storyStyles.statLabel, { color: C.textMuted }]}>SETS</Text>
            </View>
          )}
        </View>

        {/* Muscles */}
        {visibility.muscles && muscles.length > 0 && (
          <View style={storyStyles.muscleRow}>
            {muscles.map(m => (
              <View key={m} style={[storyStyles.muscleChip, { borderColor: coach.color + '40' }]}>
                <Text style={[storyStyles.muscleChipText, { color: C.textBody }]}>{m}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Bottom section */}
      <View style={storyStyles.bottomSection}>
        {visibility.coachQuote && (
          <View style={[storyStyles.quoteBox, { borderLeftColor: coach.color }]}>
            <Text style={[storyStyles.quoteText, { color: C.textBody }]}>"{quote}"</Text>
            <Text style={[storyStyles.quoteSig, { color: coach.color }]}>— {coach.name}</Text>
          </View>
        )}

        {visibility.streak && streak >= 2 && (
          <Text style={[storyStyles.streakText, { color: coach.color }]}>🔥 {streak}-day streak</Text>
        )}

        <Text style={[storyStyles.footerText, { color: C.textDim }]}>Built with SayFit</Text>
      </View>
    </View>
  );
}

const storyStyles = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden', aspectRatio: 9 / 16, justifyContent: 'space-between', padding: 28 },
  topSection: { alignItems: 'center', paddingTop: 20 },
  brandText: { fontSize: 18, fontWeight: '900', letterSpacing: 5 },
  coachBadge: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  centerSection: { alignItems: 'center' },
  workoutName: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  dateText: { fontSize: 12, marginBottom: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center' },
  statBox: { alignItems: 'center', minWidth: 80 },
  statValue: { fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 9, letterSpacing: 1.5, marginTop: 4, fontWeight: '600' },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 20 },
  muscleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  muscleChipText: { fontSize: 12, fontWeight: '500' },
  bottomSection: { alignItems: 'center' },
  quoteBox: { borderLeftWidth: 3, paddingLeft: 14, marginBottom: 16, alignSelf: 'stretch' },
  quoteText: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  quoteSig: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  streakText: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  footerText: { fontSize: 10, letterSpacing: 1 },
});

// ─── NEON (gradient glow) ───────────────────────────────────

export function NeonTemplate({ coachId, stats, elapsed, muscles, workoutName, streak, visibility, isLoggedWorkout }) {
  const coach = COACHES[coachId];
  const quote = isLoggedWorkout ? getLoggedQuote(coachId, stats) : getShareQuote(coachId, stats, elapsed);

  return (
    <View style={neonStyles.card}>
      {/* Glow border effect */}
      <View style={[neonStyles.glowBar, { backgroundColor: coach.color }]} />

      <View style={neonStyles.content}>
        <Text style={[neonStyles.workoutName, { color: coach.color, textShadowColor: coach.color + '60' }]}>{workoutName || 'Workout Complete'}</Text>
        <Text style={neonStyles.dateText}>{dateString()}</Text>

        {/* Stats with glow */}
        <View style={neonStyles.statsRow}>
          {visibility.time && (
            <View style={[neonStyles.statBox, { borderColor: coach.color + '30' }]}>
              <Text style={[neonStyles.statValue, { color: coach.color }]}>{formatTime(elapsed)}</Text>
              <Text style={neonStyles.statLabel}>TIME</Text>
            </View>
          )}
          {!isLoggedWorkout && visibility.calories && (
            <View style={[neonStyles.statBox, { borderColor: coach.color + '30' }]}>
              <Text style={[neonStyles.statValue, { color: coach.color }]}>{stats.calories}</Text>
              <Text style={neonStyles.statLabel}>CALS</Text>
            </View>
          )}
          {visibility.exercises && (
            <View style={[neonStyles.statBox, { borderColor: coach.color + '30' }]}>
              <Text style={[neonStyles.statValue, { color: coach.color }]}>{stats.exercisesCompleted}</Text>
              <Text style={neonStyles.statLabel}>EXCS</Text>
            </View>
          )}
          {isLoggedWorkout && visibility.sets && (
            <View style={[neonStyles.statBox, { borderColor: coach.color + '30' }]}>
              <Text style={[neonStyles.statValue, { color: coach.color }]}>{stats.totalSets}</Text>
              <Text style={neonStyles.statLabel}>SETS</Text>
            </View>
          )}
        </View>

        {/* Muscles */}
        {visibility.muscles && muscles.length > 0 && (
          <Text style={[neonStyles.muscleText, { color: coach.color + 'CC' }]}>{muscles.join(' · ')}</Text>
        )}

        {/* Quote */}
        {visibility.coachQuote && (
          <Text style={neonStyles.quoteText}>"{quote}"</Text>
        )}

        {/* Streak */}
        {visibility.streak && streak >= 2 && (
          <View style={[neonStyles.streakBadge, { backgroundColor: coach.color + '20', borderColor: coach.color + '40' }]}>
            <Text style={[neonStyles.streakBadgeText, { color: coach.color }]}>🔥 {streak}-day streak</Text>
          </View>
        )}
      </View>

      <View style={neonStyles.footer}>
        <Text style={[neonStyles.footerText, { color: coach.color + '60' }]}>SAYFIT</Text>
      </View>
    </View>
  );
}

const neonStyles = StyleSheet.create({
  card: { backgroundColor: '#050510', borderRadius: 20, overflow: 'hidden' },
  glowBar: { height: 3, width: '100%' },
  content: { padding: 24, alignItems: 'center' },
  workoutName: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 4, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  dateText: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  statBox: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, minWidth: 70 },
  statValue: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, marginTop: 4, fontWeight: '600' },
  muscleText: { fontSize: 12, fontWeight: '500', marginBottom: 14, textAlign: 'center' },
  quoteText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', textAlign: 'center', lineHeight: 20, marginBottom: 12, paddingHorizontal: 8 },
  streakBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  streakBadgeText: { fontSize: 12, fontWeight: '600' },
  footer: { padding: 14, alignItems: 'center' },
  footerText: { fontSize: 12, fontWeight: '900', letterSpacing: 5 },
});

// ─── STATS FOCUS (big numbers) ──────────────────────────────

export function StatsFocusTemplate({ coachId, stats, elapsed, muscles, workoutName, streak, visibility, isLoggedWorkout }) {
  const coach = COACHES[coachId];

  return (
    <View style={sfStyles.card}>
      {/* Top bar */}
      <View style={sfStyles.topRow}>
        <Text style={sfStyles.brandText}>SAYFIT</Text>
        <Text style={[sfStyles.coachName, { color: coach.color }]}>{coach.emoji} {coach.name}</Text>
      </View>

      <Text style={sfStyles.workoutName}>{workoutName || 'Workout Complete'}</Text>

      {/* Big stats grid */}
      <View style={sfStyles.statsGrid}>
        {visibility.time && (
          <View style={sfStyles.bigStatBox}>
            <Text style={[sfStyles.bigStatValue, { color: coach.color }]}>{formatTime(elapsed)}</Text>
            <Text style={sfStyles.bigStatLabel}>DURATION</Text>
          </View>
        )}
        {!isLoggedWorkout && visibility.calories && (
          <View style={sfStyles.bigStatBox}>
            <Text style={[sfStyles.bigStatValue, { color: coach.color }]}>{stats.calories}</Text>
            <Text style={sfStyles.bigStatLabel}>CALORIES</Text>
          </View>
        )}
        {visibility.exercises && (
          <View style={sfStyles.bigStatBox}>
            <Text style={[sfStyles.bigStatValue, { color: coach.color }]}>{stats.exercisesCompleted}</Text>
            <Text style={sfStyles.bigStatLabel}>EXERCISES</Text>
          </View>
        )}
        {isLoggedWorkout && visibility.sets && (
          <View style={sfStyles.bigStatBox}>
            <Text style={[sfStyles.bigStatValue, { color: coach.color }]}>{stats.totalSets}</Text>
            <Text style={sfStyles.bigStatLabel}>SETS</Text>
          </View>
        )}
        {isLoggedWorkout && visibility.volume && stats.totalVolume > 0 && (
          <View style={sfStyles.bigStatBox}>
            <Text style={[sfStyles.bigStatValue, { color: coach.color }]}>{stats.totalVolume.toLocaleString()}</Text>
            <Text style={sfStyles.bigStatLabel}>VOLUME</Text>
          </View>
        )}
        {visibility.streak && streak >= 2 && (
          <View style={sfStyles.bigStatBox}>
            <Text style={[sfStyles.bigStatValue, { color: coach.color }]}>🔥 {streak}</Text>
            <Text style={sfStyles.bigStatLabel}>STREAK</Text>
          </View>
        )}
      </View>

      {/* Muscles */}
      {visibility.muscles && muscles.length > 0 && (
        <Text style={sfStyles.muscleText}>{muscles.join(' · ')}</Text>
      )}

      <Text style={sfStyles.dateText}>{dateString()}</Text>
    </View>
  );
}

const sfStyles = StyleSheet.create({
  card: { backgroundColor: '#0A0A0F', borderRadius: 20, padding: 24, alignItems: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 },
  brandText: { fontSize: 12, fontWeight: '900', color: 'rgba(255,255,255,0.3)', letterSpacing: 3 },
  coachName: { fontSize: 12, fontWeight: '600' },
  workoutName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 18 },
  bigStatBox: { alignItems: 'center', minWidth: '40%' },
  bigStatValue: { fontSize: 38, fontWeight: '900', fontVariant: ['tabular-nums'] },
  bigStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, marginTop: 4, fontWeight: '600' },
  muscleText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500', marginBottom: 12, textAlign: 'center' },
  dateText: { fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 0.5 },
});

// ─── TEMPLATE MAP ───────────────────────────────────────────

export const TEMPLATE_COMPONENTS = {
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
  story: StoryTemplate,
  neon: NeonTemplate,
  statsFocus: StatsFocusTemplate,
};
