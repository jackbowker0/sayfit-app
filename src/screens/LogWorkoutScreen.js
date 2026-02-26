// ============================================================
// LOG WORKOUT SCREEN — Themed with light/dark support
// UPGRADED: Coach nudges, personalized PR celebrations,
// smart autofill, fuzzy search, recent exercises
// FIX: Now saves to workout history so Dashboard shows logged workouts
// ============================================================

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Keyboard,
  Animated, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkoutContext } from '../context/WorkoutContext';
import { COACHES } from '../constants/coaches';
import { EXERCISES } from '../constants/exercises';
import { SPACING, RADIUS, getTextOnColor } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  parseExerciseInput, saveExerciseSession, compareToLast,
  getTemplates, saveTemplate, deleteTemplate, markTemplateUsed,
  getOverloadSuggestion, getSmartRestDuration, COMMON_EXERCISES,
  getExerciseLog,
} from '../services/exerciseLog';
import { saveWorkout } from '../services/storage';
import { getUserProfile } from '../services/userProfile';
import { checkActionAchievement } from '../services/achievements';
import { generateCoachNudges, getCoachPRCelebration } from '../services/coachNudges';
import RestTimer from '../components/RestTimer';
import * as haptics from '../services/haptics';

// ─── MERGED EXERCISE NAME LIST ──────────────────────────────────
const ALL_EXERCISE_NAMES = (() => {
  const fromDB = EXERCISES
    .filter(e => e.category === 'strength' || e.category === 'cardio')
    .map(e => e.name);
  const merged = new Set([...COMMON_EXERCISES, ...fromDB]);
  return [...merged].sort();
})();

// ─── FUZZY MATCH ────────────────────────────────────────────────
function fuzzyMatch(query, text) {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return { match: false, score: 0 };
  if (t.includes(q)) return { match: true, score: 100 - t.indexOf(q) };
  const qWords = q.split(/\s+/);
  const tWords = t.split(/[\s\-]+/);
  const wordMatch = qWords.every(qw => tWords.some(tw => tw.startsWith(qw)));
  if (wordMatch) return { match: true, score: 50 };
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') ? 3 : 1;
      qi++;
    }
  }
  if (qi === q.length) return { match: true, score };
  return { match: false, score: 0 };
}

// ─── PRESETS ────────────────────────────────────────────────────
const PRESETS = [
  { label: '🏋️ Bench', text: 'bench press 4x8, incline bench 3x10, dumbbell fly 3x12' },
  { label: '🦵 Legs', text: 'squat 4x8, leg press 3x12, leg curl 3x10, calf raise 4x15' },
  { label: '💪 Pull', text: 'deadlift 3x5, barbell row 4x8, pull ups 3x10, bicep curl 3x12' },
  { label: '🔺 Push', text: 'overhead press 4x8, bench press 4x8, lateral raise 3x15, tricep pushdown 3x12' },
];

const REST_OPTIONS = [60, 90, 120, 180];

// ─── COACH PR CELEBRATION MODAL ─────────────────────────────────

function PRCelebrationModal({ visible, onDismiss, celebration, coach, colors, isDark, units }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const trophyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      trophyAnim.setValue(0);
      haptics.heavy();
      Animated.sequence([
        Animated.spring(trophyAnim, { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();
      setTimeout(() => haptics.success(), 400);
    }
  }, [visible]);

  if (!visible || !celebration) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={{
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)', padding: 24,
      }}>
        <Animated.View style={{
          backgroundColor: colors.bgCard, borderRadius: 20, padding: 28,
          width: '100%', maxWidth: 360, alignItems: 'center',
          borderWidth: 2, borderColor: coach.color + '40',
          transform: [{ scale: scaleAnim }],
        }}>
          <Animated.Text style={{
            fontSize: 56, marginBottom: 12,
            transform: [{ scale: trophyAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.3, 1] }) }],
          }}>
            🏆
          </Animated.Text>
          <Text style={{
            fontSize: 22, fontWeight: '900', color: coach.color,
            textAlign: 'center', marginBottom: 16,
          }}>
            {celebration.title}
          </Text>
          {celebration.prs.map((pr, i) => (
            <View key={i} style={{
              width: '100%', padding: 12, borderRadius: 12,
              backgroundColor: colors.orange + '08',
              borderWidth: 1, borderColor: colors.orange + '25',
              marginBottom: 8,
            }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                {pr.exercise}
              </Text>
              <Text style={{ fontSize: 13, color: colors.orange, marginTop: 2 }}>
                {pr.old > 0 ? `${pr.old} → ` : ''}{pr.new} {units}
              </Text>
            </View>
          ))}
          <View style={{
            width: '100%', marginTop: 8, padding: 12, borderRadius: 12,
            backgroundColor: isDark ? coach.color + '10' : coach.color + '06',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Text style={{ fontSize: 20 }}>{coach.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 3 }}>
                  {coach.name}
                </Text>
                {celebration.reactions.map((line, i) => (
                  <Text key={i} style={{
                    fontSize: 13, lineHeight: 19, color: isDark ? coach.color : colors.textPrimary,
                    fontStyle: 'italic', marginBottom: i < celebration.reactions.length - 1 ? 6 : 0,
                  }}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={{
              backgroundColor: coach.color, padding: 14, borderRadius: RADIUS.lg,
              width: '100%', alignItems: 'center', marginTop: 16,
            }}
            onPress={onDismiss} activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16, fontWeight: '800', color: getTextOnColor(coach.color) }}>
              Let's Go! 💪
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── COACH NUDGE CARD ───────────────────────────────────────────

function CoachNudgeCard({ nudge, coachId, coach, colors, isDark, onDismiss }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const message = nudge.messages[coachId];
  if (!message) return null;

  const typeEmoji = {
    streak: '🔥', plateau: '📊', imbalance: '⚖️',
    volume: '📈', milestone: '🏆',
  };

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
      backgroundColor: isDark ? coach.color + '10' : coach.color + '06',
      borderRadius: RADIUS.lg, borderWidth: 1, borderColor: coach.color + '20',
      padding: 12, marginBottom: 10,
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    }}>
      <Text style={{ fontSize: 16, marginTop: 1 }}>{typeEmoji[nudge.type] || '💡'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, lineHeight: 19, color: isDark ? coach.color : colors.textPrimary }}>
          {message}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDismiss);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={{ fontSize: 14, color: colors.textDim }}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────

export default function LogWorkoutScreen({ navigation }) {
  const { coachId } = useWorkoutContext();
  const coach = COACHES[coachId];
  const { colors, isDark } = useTheme();

  const [mode, setMode] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [exercises, setExercises] = useState([]);
  const [saving, setSaving] = useState(false);
  const [comparisons, setComparisons] = useState({});
  const [overloads, setOverloads] = useState({});
  const [formName, setFormName] = useState('');
  const [formSets, setFormSets] = useState('3');
  const [formReps, setFormReps] = useState('10');
  const [formWeight, setFormWeight] = useState('');
  const [showFormSuggestions, setShowFormSuggestions] = useState(false);
  const [showTextSuggestions, setShowTextSuggestions] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadedTemplateId, setLoadedTemplateId] = useState(null);
  const [liveMode, setLiveMode] = useState(false);
  const [smartRest, setSmartRest] = useState(true);
  const [completedSets, setCompletedSets] = useState({});
  const [restActive, setRestActive] = useState(false);
  const [restDuration, setRestDuration] = useState(90);
  const [activeRestDuration, setActiveRestDuration] = useState(90);
  const [restReason, setRestReason] = useState('');
  const [units, setUnits] = useState('lbs');
  const [recentExercises, setRecentExercises] = useState([]);

  const [nudges, setNudges] = useState([]);
  const [prCelebration, setPrCelebration] = useState(null);
  const [showPRModal, setShowPRModal] = useState(false);
  const [pendingAfterPR, setPendingAfterPR] = useState(null);

  const scrollRef = useRef();
  const textInputRef = useRef();

  useEffect(() => { loadTemplates(); loadProfile(); loadRecents(); loadNudges(); }, []);

  const loadProfile = async () => {
    const profile = await getUserProfile();
    if (profile.restDuration) setRestDuration(profile.restDuration);
    if (profile.units) setUnits(profile.units);
  };

  const loadNudges = async () => {
    try {
      const n = await generateCoachNudges(coachId);
      setNudges(n);
    } catch (e) {}
  };

  const dismissNudge = (index) => {
    setNudges(prev => prev.filter((_, i) => i !== index));
  };

  const loadRecents = async () => {
    try {
      const log = await getExerciseLog();
      const recent = [];
      const seen = new Set();
      for (let i = log.length - 1; i >= 0 && recent.length < 8; i--) {
        for (const ex of log[i].exercises) {
          const normalized = ex.name.toLowerCase().trim();
          if (!seen.has(normalized)) {
            seen.add(normalized);
            recent.push(ex.name);
          }
        }
      }
      setRecentExercises(recent);
    } catch (e) {}
  };

  const loadTemplates = async () => {
    const t = await getTemplates();
    t.sort((a, b) => { if (a.lastUsed && b.lastUsed) return new Date(b.lastUsed) - new Date(a.lastUsed); if (a.lastUsed) return -1; if (b.lastUsed) return 1; return (b.useCount || 0) - (a.useCount || 0); });
    setTemplates(t);
  };

  // ─── AUTOFILL ─────────────────────────────────────────────────

  const formSuggestions = useMemo(() => {
    if (formName.length < 2) return [];
    return ALL_EXERCISE_NAMES
      .map(name => ({ name, ...fuzzyMatch(formName, name) }))
      .filter(r => r.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(r => r.name);
  }, [formName]);

  const textSuggestions = useMemo(() => {
    if (textInput.length < 2) return [];
    const segments = textInput.split(/[,\n]/);
    const currentSegment = (segments[segments.length - 1] || '').trim();
    if (currentSegment.length < 2) return [];
    const nameQuery = currentSegment
      .replace(/\d+\s*[xX×]\s*\d+/g, '')
      .replace(/\d+\s*(lbs?|kg|pounds?|sets?|reps?)/gi, '')
      .replace(/\d+/g, '')
      .trim();
    if (nameQuery.length < 2) return [];
    return ALL_EXERCISE_NAMES
      .map(name => ({ name, ...fuzzyMatch(nameQuery, name) }))
      .filter(r => r.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => r.name);
  }, [textInput]);

  const handleTextSuggestionTap = useCallback((suggestion) => {
    haptics.tap();
    const segments = textInput.split(/([,\n])/);
    let lastSegIndex = segments.length - 1;
    while (lastSegIndex >= 0 && /^[,\n]$/.test(segments[lastSegIndex])) lastSegIndex--;
    if (lastSegIndex >= 0) {
      const currentSeg = segments[lastSegIndex].trim();
      const setsReps = currentSeg.match(/(\d+\s*[xX×]\s*\d+)/)?.[0] || '';
      const weightMatch = currentSeg.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:lbs?|kg|pounds?)?$/i)?.[0]?.trim() || '';
      const parts = [suggestion.toLowerCase()];
      if (setsReps) parts.push(setsReps);
      else if (weightMatch) parts.push(weightMatch);
      segments[lastSegIndex] = ' ' + parts.join(' ');
      setTextInput(segments.join('').trimStart());
    } else {
      setTextInput(suggestion.toLowerCase() + ' ');
    }
    setShowTextSuggestions(false);
  }, [textInput]);

  const handleFormSuggestionTap = useCallback((suggestion) => {
    haptics.tap();
    setFormName(suggestion);
    setShowFormSuggestions(false);
  }, []);

  // ─── EXERCISE LOGIC ───────────────────────────────────────────

  const loadOverloadForExercises = async (exList) => {
    for (const ex of exList) {
      const suggestion = await getOverloadSuggestion(ex.name);
      if (suggestion) setOverloads(prev => ({ ...prev, [ex.name]: suggestion }));
      const comp = await compareToLast(ex.name, ex.sets);
      if (comp) setComparisons(prev => ({ ...prev, [ex.name]: comp }));
    }
  };

  const applyOverload = (exIndex, suggestedWeight) => {
    const updated = [...exercises];
    updated[exIndex] = { ...updated[exIndex], sets: updated[exIndex].sets.map(s => ({ ...s, weight: suggestedWeight })) };
    setExercises(updated);
    setOverloads(prev => { const next = { ...prev }; delete next[updated[exIndex].name]; return next; });
    checkActionAchievement('overload_used');
  };

  const handleCompleteSet = (exIndex, setIndex) => {
    const key = `${exIndex}-${setIndex}`;
    // Allow undoing a completed set by tapping again
    if (completedSets[key]) {
      haptics.tap();
      setCompletedSets(prev => { const next = { ...prev }; delete next[key]; return next; });
      return;
    }
    haptics.success();
    setCompletedSets(prev => ({ ...prev, [key]: true }));
    const remaining = exercises.reduce((count, ex, ei) => count + ex.sets.filter((_, si) => !completedSets[`${ei}-${si}`] && !(ei === exIndex && si === setIndex)).length, 0);
    if (remaining > 0) {
      Keyboard.dismiss();
      if (smartRest) {
        const ex = exercises[exIndex]; const set = ex.sets[setIndex];
        const smart = getSmartRestDuration(ex.name, set.weight || 0, set.reps || 10, restDuration);
        setActiveRestDuration(smart.duration); setRestReason(smart.reason);
      } else { setActiveRestDuration(restDuration); setRestReason(''); }
      setRestActive(true);
    }
  };

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const doneSets = Object.keys(completedSets).length;
  const allDone = totalSets > 0 && doneSets >= totalSets;

  const handleLoadTemplate = async (template) => {
    haptics.tap();
    const cloned = template.exercises.map(ex => ({ name: ex.name, sets: ex.sets.map(s => ({ ...s })) }));
    setExercises(cloned); setLoadedTemplateId(template.id); setCompletedSets({}); setOverloads({});
    await markTemplateUsed(template.id); loadOverloadForExercises(cloned);
  };

  const handleDeleteTemplate = (template) => {
    Alert.alert('Delete Template', `Delete "${template.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTemplate(template.id); loadTemplates(); } },
    ]);
  };

  const handleParse = () => {
    if (!textInput.trim()) return;
    haptics.tap();
    const parsed = parseExerciseInput(textInput);
    if (parsed.length === 0) { Alert.alert('Hmm', "Couldn't parse that. Try: \"bench press 3x8 185\""); return; }
    setExercises(prev => [...prev, ...parsed]); setTextInput(''); setLoadedTemplateId(null); setCompletedSets({});
    setShowTextSuggestions(false);
    loadOverloadForExercises(parsed);
  };

  const handleAddFromForm = async () => {
    if (!formName.trim()) return;
    haptics.tap();
    const setsArray = [];
    for (let i = 0; i < (parseInt(formSets) || 3); i++) setsArray.push({ reps: parseInt(formReps) || 10, weight: parseFloat(formWeight) || 0 });
    const newEx = { name: formName.trim(), sets: setsArray };
    setExercises(prev => [...prev, newEx]); setLoadedTemplateId(null);
    loadOverloadForExercises([newEx]); setFormName(''); setFormWeight(''); setShowFormSuggestions(false);
  };

  const updateSet = (exIndex, setIndex, field, value) => {
    const updated = [...exercises];
    updated[exIndex] = { ...updated[exIndex], sets: [...updated[exIndex].sets] };
    updated[exIndex].sets[setIndex] = { ...updated[exIndex].sets[setIndex], [field]: parseFloat(value) || 0 };
    setExercises(updated);
    if (field === 'weight') {
      const ex = updated[exIndex];
      compareToLast(ex.name, ex.sets).then(comp => { if (comp) setComparisons(prev => ({ ...prev, [ex.name]: comp })); });
    }
  };

  const addSet = (exIndex) => {
    haptics.tap();
    const updated = [...exercises]; const lastSet = updated[exIndex].sets[updated[exIndex].sets.length - 1];
    updated[exIndex] = { ...updated[exIndex], sets: [...updated[exIndex].sets, { ...lastSet }] }; setExercises(updated);
  };

  const removeSet = (exIndex, setIndex) => {
    haptics.tap();
    const updated = [...exercises]; const newCompleted = { ...completedSets }; delete newCompleted[`${exIndex}-${setIndex}`]; setCompletedSets(newCompleted);
    if (updated[exIndex].sets.length <= 1) updated.splice(exIndex, 1);
    else updated[exIndex] = { ...updated[exIndex], sets: updated[exIndex].sets.filter((_, i) => i !== setIndex) };
    setExercises(updated);
  };

  const removeExercise = (exIndex) => {
    haptics.tap();
    const newCompleted = {}; Object.keys(completedSets).forEach(key => { const [ei] = key.split('-').map(Number); if (ei !== exIndex) { newCompleted[`${ei > exIndex ? ei - 1 : ei}-${key.split('-')[1]}`] = true; } });
    setCompletedSets(newCompleted); setExercises(prev => prev.filter((_, i) => i !== exIndex));
  };

  // ─── SAVE WITH COACH PR CELEBRATION ───────────────────────────

  const handleSave = async () => {
    if (exercises.length === 0) { Alert.alert('Nothing to save', 'Add at least one exercise first.'); return; }
    setSaving(true);
    const { entry, newPRs } = await saveExerciseSession({ exercises, source: mode === 'text' ? 'voice' : 'manual' });

    // *** FIX: Also save to workout history so Dashboard shows logged workouts ***
    const workoutName = exercises.slice(0, 2).map(e => e.name).join(' & ') || 'Logged Workout';
    await saveWorkout({
      name: workoutName,
      exercises: exercises.map(e => ({
        name: e.name,
        sets: e.sets,
      })),
      exerciseCount: exercises.length,
      calories: Math.round(exercises.reduce((sum, ex) => sum + ex.sets.length, 0) * 8),
      elapsed: 0,
      muscles: [...new Set(exercises.map(e => e.name))].slice(0, 6),
      coach: coachId,
      source: 'log',
    });

    setSaving(false);

    const totalSetsCount = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const totalVolume = exercises.reduce((sum, ex) =>
      sum + ex.sets.reduce((s, set) => s + ((set.weight || 0) * (set.reps || 0)), 0), 0);
    const exerciseNames = exercises.map(e => e.name);

    const logData = {
      name: workoutName,
      exerciseCount: exercises.length,
      totalSets: totalSetsCount,
      totalVolume,
      calories: Math.round(totalSetsCount * 8),
      exercises: exercises.map(e => ({ name: e.name, muscle: e.name })),
      muscles: [...new Set(exerciseNames)].slice(0, 6),
      newPRs,
      units,
      elapsed: 0,
    };

    const goToComplete = () => {
      setExercises([]);
      setCompletedSets({});
      setComparisons({});
      setOverloads({});
      setLoadedTemplateId(null);
      setTextInput('');
      setFormName('');
      setFormWeight('');
      loadTemplates();
      loadNudges();
      navigation.navigate('Complete', { logData });
    };

    const askTemplate = () => {
      Alert.alert('Save as Template?', 'Reuse this workout with one tap next time.', [
        { text: 'Skip', onPress: goToComplete },
        { text: 'Save Template', onPress: () => promptTemplateName(goToComplete) },
      ]);
    };

    if (newPRs.length > 0) {
      const celebration = getCoachPRCelebration(coachId, newPRs, units);
      if (celebration) {
        setPrCelebration(celebration);
        setShowPRModal(true);
        setPendingAfterPR(() => askTemplate);
        return;
      }
    }

    askTemplate();
  };

  const handlePRModalDismiss = () => {
    setShowPRModal(false);
    if (pendingAfterPR) {
      const fn = pendingAfterPR;
      setPendingAfterPR(null);
      fn();
    }
  };

  const promptTemplateName = (onDone) => {
    const defaultName = exercises.slice(0, 2).map(e => e.name).join(' & ') || 'My Workout';
    Alert.prompt('Template Name', 'Give this workout a name:', [
      { text: 'Cancel', onPress: onDone, style: 'cancel' },
      { text: 'Save', onPress: async (name) => {
        await saveTemplate((name || '').trim() || defaultName, exercises);
        checkActionAchievement('template_saved');
        onDone();
      } },
    ], 'plain-text', defaultName);
  };

  // ─── RENDER HELPERS ───────────────────────────────────────────

  const renderSuggestionList = (suggestions, onTap) => {
    if (suggestions.length === 0) return null;
    return (
      <View style={{
        backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: coach.color + '30',
        borderRadius: RADIUS.md, marginBottom: 10, overflow: 'hidden',
      }}>
        {suggestions.map((name, i) => (
          <TouchableOpacity
            key={name + i}
            style={{
              flexDirection: 'row', alignItems: 'center',
              padding: 12,
              borderBottomWidth: i < suggestions.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
            onPress={() => onTap(name)}
            activeOpacity={0.6}
          >
            <View style={{
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: coach.color + '12', justifyContent: 'center', alignItems: 'center',
              marginRight: 10,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: coach.color }}>+</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary, flex: 1 }}>{name}</Text>
            <Text style={{ fontSize: 11, color: colors.textDim }}>tap to fill</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderRecentChips = (onTap) => {
    if (recentExercises.length === 0) return null;
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textDim, letterSpacing: 1, marginBottom: 6 }}>
          RECENT
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recentExercises.map((name, i) => (
            <TouchableOpacity
              key={name + i}
              style={{
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
                backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
                marginRight: 6,
              }}
              onPress={() => { haptics.tap(); onTap(name); }}
              activeOpacity={0.6}
            >
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>{name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ─── MAIN RENDER ──────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <RestTimer isActive={restActive} duration={activeRestDuration} coachColor={coach.color} reason={restReason} onComplete={() => setRestActive(false)} onSkip={() => setRestActive(false)} onDismiss={() => setRestActive(false)} />

      <PRCelebrationModal
        visible={showPRModal}
        onDismiss={handlePRModalDismiss}
        celebration={prCelebration}
        coach={coach}
        colors={colors}
        isDark={isDark}
        units={units}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 }}>Log Workout</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 16 }}>Track your lifts and see progress</Text>

          {nudges.length > 0 && exercises.length === 0 && (
            <View style={{ marginBottom: 8 }}>
              {nudges.map((nudge, i) => (
                <CoachNudgeCard
                  key={`${nudge.type}-${i}`}
                  nudge={nudge}
                  coachId={coachId}
                  coach={coach}
                  colors={colors}
                  isDark={isDark}
                  onDismiss={() => dismissNudge(i)}
                />
              ))}
            </View>
          )}

          {exercises.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <TouchableOpacity
                style={{ padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: liveMode ? coach.color : colors.border, alignItems: 'center', backgroundColor: liveMode ? coach.color + '10' : colors.bgCard }}
                onPress={() => { setLiveMode(!liveMode); haptics.tap(); }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: liveMode ? coach.color : colors.textSecondary }}>{liveMode ? '⏱️ Live Mode ON' : '⏱️ Live Mode'}</Text>
              </TouchableOpacity>
              {liveMode && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {REST_OPTIONS.map(sec => (
                    <TouchableOpacity key={sec} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: !smartRest && restDuration === sec ? coach.color + '20' : colors.bgCard, borderWidth: 1, borderColor: !smartRest && restDuration === sec ? coach.color : colors.border }} onPress={() => { setRestDuration(sec); setSmartRest(false); }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: !smartRest && restDuration === sec ? coach.color : colors.textSecondary }}>{sec >= 60 ? `${sec/60}m` : `${sec}s`}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: smartRest ? coach.color + '20' : colors.bgCard, borderWidth: 1, borderColor: smartRest ? coach.color : colors.border }} onPress={() => setSmartRest(true)}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: smartRest ? coach.color : colors.textSecondary }}>🧠 Smart</Text>
                  </TouchableOpacity>
                </View>
              )}
              {liveMode && totalSets > 0 && <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 6 }}>{doneSets}/{totalSets} sets</Text>}
            </View>
          )}

          {templates.length > 0 && exercises.length === 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Templates</Text>
              {templates.map(t => (
                <TouchableOpacity key={t.id} style={{ backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }} onPress={() => handleLoadTemplate(t)} onLongPress={() => handleDeleteTemplate(t)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{t.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{t.exercises.length} exercises{t.useCount > 0 ? ` · ${t.useCount}×` : ''}</Text>
                  </View>
                  <Text style={{ color: coach.color, fontSize: 16 }}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[{ id: 'text', label: '✍️ Type' }, { id: 'form', label: '📋 Form' }].map(m => (
              <TouchableOpacity key={m.id} style={{ flex: 1, padding: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: mode === m.id ? coach.color : colors.border, alignItems: 'center', backgroundColor: mode === m.id ? coach.color + '10' : colors.bgCard }} onPress={() => { setMode(m.id); haptics.tap(); }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: mode === m.id ? coach.color : colors.textSecondary }}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'text' && (
            <View style={{ marginBottom: 20 }}>
              <TextInput
                ref={textInputRef}
                style={{
                  backgroundColor: colors.bgInput, borderWidth: 1,
                  borderColor: showTextSuggestions && textSuggestions.length > 0 ? coach.color + '40' : colors.border,
                  borderRadius: RADIUS.lg, padding: 14, fontSize: 15,
                  color: colors.textPrimary, minHeight: 70, textAlignVertical: 'top', marginBottom: 10,
                }}
                placeholder={'"bench press 3x8 185, squat 225 5x5"'}
                placeholderTextColor={colors.textDim}
                value={textInput}
                onChangeText={(t) => { setTextInput(t); setShowTextSuggestions(t.length >= 2); }}
                onFocus={() => setShowTextSuggestions(textInput.length >= 2)}
                multiline
              />
              {showTextSuggestions && textSuggestions.length > 0 && renderSuggestionList(textSuggestions, handleTextSuggestionTap)}
              {textInput.length < 2 && exercises.length === 0 && renderRecentChips((name) => { setTextInput(name.toLowerCase() + ' '); textInputRef.current?.focus(); })}
              <TouchableOpacity style={{ backgroundColor: coach.color, padding: 14, borderRadius: RADIUS.lg, alignItems: 'center', marginBottom: 10 }} onPress={handleParse}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: getTextOnColor(coach.color) }}>Add Exercises →</Text>
              </TouchableOpacity>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {PRESETS.map((p, i) => (
                  <TouchableOpacity key={i} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginRight: 6 }} onPress={() => setTextInput(p.text)}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {mode === 'form' && (
            <View style={{ marginBottom: 20 }}>
              <TextInput
                style={{
                  backgroundColor: colors.bgInput, borderWidth: 1,
                  borderColor: showFormSuggestions && formSuggestions.length > 0 ? coach.color + '40' : colors.border,
                  borderRadius: RADIUS.md, padding: 12, fontSize: 15,
                  color: colors.textPrimary, marginBottom: showFormSuggestions && formSuggestions.length > 0 ? 0 : 10,
                }}
                placeholder="Exercise name"
                placeholderTextColor={colors.textDim}
                value={formName}
                onChangeText={(t) => { setFormName(t); setShowFormSuggestions(t.length >= 2); }}
                onFocus={() => setShowFormSuggestions(formName.length >= 2)}
              />
              {showFormSuggestions && formSuggestions.length > 0 && (
                <View style={{ marginBottom: 10 }}>{renderSuggestionList(formSuggestions, handleFormSuggestionTap)}</View>
              )}
              {formName.length < 2 && exercises.length === 0 && renderRecentChips((name) => { setFormName(name); })}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {[{ label: 'Sets', val: formSets, set: setFormSets }, { label: 'Reps', val: formReps, set: setFormReps }, { label: `Wt (${units})`, val: formWeight, set: setFormWeight }].map(f => (
                  <View key={f.label} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</Text>
                    <TextInput style={{ backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, padding: 10, fontSize: 16, color: colors.textPrimary, textAlign: 'center', fontWeight: '700' }} value={f.val} onChangeText={f.set} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textDim} />
                  </View>
                ))}
              </View>
              <TouchableOpacity style={{ backgroundColor: coach.color, padding: 14, borderRadius: RADIUS.lg, alignItems: 'center' }} onPress={handleAddFromForm}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: getTextOnColor(coach.color) }}>+ Add Exercise</Text>
              </TouchableOpacity>
            </View>
          )}

          {exercises.map((ex, exIndex) => {
            const comp = comparisons[ex.name]; const overload = overloads[ex.name];
            return (
              <View key={exIndex} style={{ backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...(isDark ? {} : { shadowColor: 'rgba(0,0,0,0.04)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 }) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 }}>{ex.name}</Text>
                  <TouchableOpacity onPress={() => removeExercise(exIndex)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text></TouchableOpacity>
                </View>

                {overload && (
                  <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderRadius: 8, backgroundColor: coach.color + '10', borderWidth: 1, borderColor: coach.color + '25', marginBottom: 8 }} onPress={() => applyOverload(exIndex, overload.suggestedWeight)} activeOpacity={0.7}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: coach.color }}>📈 Last: {overload.lastWeight} {units}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: coach.color }}>Try {overload.suggestedWeight} {units} →</Text>
                  </TouchableOpacity>
                )}

                {comp && (
                  <View style={{ padding: 6, borderRadius: 6, backgroundColor: comp.weightChange > 0 ? colors.green + '10' : comp.weightChange < 0 ? colors.red + '10' : colors.bgSubtle, marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: comp.weightChange > 0 ? colors.green : comp.weightChange < 0 ? colors.red : colors.textMuted }}>
                      {comp.weightChange > 0 ? `⬆️ +${comp.weightChange} ${units}` : comp.weightChange < 0 ? `⬇️ ${comp.weightChange} ${units}` : '➡️ Same weight'} vs last
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', marginBottom: 4, paddingHorizontal: 2 }}>
                  {['SET', 'REPS', `WEIGHT (${units.toUpperCase()})`].map(h => <Text key={h} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: colors.textMuted, letterSpacing: 1, fontWeight: '600' }}>{h}</Text>)}
                  <View style={{ width: liveMode ? 52 : 28 }} />
                </View>
                {ex.sets.map((set, setIndex) => {
                  const isDone = !!completedSets[`${exIndex}-${setIndex}`];
                  return (
                    <View key={setIndex} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, opacity: isDone ? 0.5 : 1 }}>
                      <Text style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600', color: isDone ? colors.green : colors.textMuted }}>{isDone ? '✓' : setIndex + 1}</Text>
                      <TextInput style={{ flex: 1, backgroundColor: colors.bgInput, borderRadius: 6, padding: 6, fontSize: 14, color: colors.textPrimary, textAlign: 'center', fontWeight: '600', marginHorizontal: 3 }} value={String(set.reps)} onChangeText={v => updateSet(exIndex, setIndex, 'reps', v)} keyboardType="number-pad" editable={!isDone} />
                      <TextInput style={{ flex: 1, backgroundColor: colors.bgInput, borderRadius: 6, padding: 6, fontSize: 14, color: colors.textPrimary, textAlign: 'center', fontWeight: '600', marginHorizontal: 3 }} value={String(set.weight)} onChangeText={v => updateSet(exIndex, setIndex, 'weight', v)} keyboardType="decimal-pad" editable={!isDone} />
                      {liveMode ? (
                        <TouchableOpacity style={{ width: 48, paddingVertical: 6, borderRadius: 6, backgroundColor: isDone ? colors.green + '15' : colors.bgInput, borderWidth: 1, borderColor: isDone ? colors.green : colors.border, alignItems: 'center' }} onPress={() => handleCompleteSet(exIndex, setIndex)}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isDone ? colors.green : colors.textSecondary }}>{isDone ? '✓ Undo' : 'Done'}</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => removeSet(exIndex, setIndex)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ width: 24, textAlign: 'center', fontSize: 18, color: colors.textDim }}>−</Text></TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                <TouchableOpacity style={{ alignItems: 'center', paddingTop: 6 }} onPress={() => addSet(exIndex)}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: coach.color }}>+ Add Set</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {exercises.length > 0 && (
            <TouchableOpacity style={{ backgroundColor: allDone ? colors.green : coach.color, padding: 18, borderRadius: RADIUS.lg, alignItems: 'center', marginTop: 8 }} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={allDone ? '#fff' : getTextOnColor(coach.color)} size="small" />
                  <Text style={{ fontSize: 17, fontWeight: '800', color: allDone ? '#fff' : getTextOnColor(coach.color) }}>Saving...</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 17, fontWeight: '800', color: allDone ? '#fff' : getTextOnColor(coach.color) }}>
                  {allDone ? '🎉 Finish Workout' : `Finish Workout (${exercises.length} exercise${exercises.length > 1 ? 's' : ''})`}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}