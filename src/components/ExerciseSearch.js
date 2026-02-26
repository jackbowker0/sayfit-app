// ============================================================
// EXERCISE SEARCH — Fuzzy autocomplete over exercise database
//
// Features:
// - Fuzzy matching (typing "ben" -> "Bench Press", "Bench Fly")
// - Grouped by muscle when browsing
// - Smart suggestions based on selected exercises
// - Equipment filtering based on user profile
// - Coach-themed styling
//
// Usage:
//   <ExerciseSearch
//     onSelect={(exercise) => handleAddExercise(exercise)}
//     selectedIds={['push-ups', 'lunges']}  // already in workout
//     equipment={['bodyweight', 'dumbbells']} // from profile
//     coachColor="#FF6B35"
//   />
// ============================================================

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Animated, Keyboard,
} from 'react-native';
import { Search, X, Plus, Sparkles } from 'lucide-react-native';

import { EXERCISES } from '../constants/exercises';
import { getMuscleIcon } from '../constants/icons';
import { RADIUS, FONT, GLOW } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import * as haptics from '../services/haptics';

// ---- FUZZY MATCH ----

function fuzzyMatch(query, text) {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();

  // Exact substring match -- highest priority
  if (t.includes(q)) return { match: true, score: 100 - t.indexOf(q) };

  // Word-start matching (each query word matches start of a word in text)
  const queryWords = q.split(/\s+/);
  const textWords = t.split(/\s+/);
  const wordMatches = queryWords.every(qw =>
    textWords.some(tw => tw.startsWith(qw))
  );
  if (wordMatches) return { match: true, score: 50 };

  // Fuzzy character matching
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

// ---- EQUIPMENT MAPPING ----

const PROFILE_TO_EXERCISE_EQUIPMENT = {
  bodyweight: ['none', 'wall', 'chair'],
  dumbbells: ['dumbbell'],
  bands: ['band'],
  full_gym: ['none', 'wall', 'chair', 'dumbbell', 'band'],
};

function getAvailableEquipment(profileEquipment) {
  if (!profileEquipment || profileEquipment.length === 0) return ['none', 'wall', 'chair'];
  const set = new Set();
  profileEquipment.forEach(pe => {
    (PROFILE_TO_EXERCISE_EQUIPMENT[pe] || []).forEach(e => set.add(e));
  });
  return [...set];
}

// ---- MUSCLE GROUP SUGGESTIONS ----

const RELATED_MUSCLES = {
  Chest: ['Shoulders', 'Arms'],
  Back: ['Arms', 'Core'],
  Legs: ['Glutes', 'Cardio'],
  Shoulders: ['Chest', 'Arms'],
  Arms: ['Chest', 'Shoulders'],
  Core: ['Back', 'Full Body'],
  Glutes: ['Legs', 'Core'],
  Cardio: ['Full Body', 'Legs'],
  'Full Body': ['Cardio', 'Core'],
};

// ---- COMPONENT ----

export default function ExerciseSearch({
  onSelect,
  selectedIds = [],
  equipment = [],
  coachColor = '#FF6B35',
  maxHeight = 320,
  placeholder = 'Search exercises... (e.g. "bench", "curl")',
}) {
  const { colors, isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const availableEquipment = useMemo(() => getAvailableEquipment(equipment), [equipment]);

  // ---- FILTERED + SORTED EXERCISES ----

  const filteredExercises = useMemo(() => {
    // Filter by equipment
    const equipFiltered = EXERCISES.filter(e =>
      availableEquipment.includes(e.equipment) &&
      e.category === 'strength' // only show strength exercises for manual building
    );

    if (!query.trim()) {
      // No query -- group by muscle, show all available
      return equipFiltered
        .filter(e => !selectedIds.includes(e.id))
        .sort((a, b) => a.muscle.localeCompare(b.muscle) || a.name.localeCompare(b.name));
    }

    // Fuzzy search
    return equipFiltered
      .map(e => {
        // Search against name, muscle, and description
        const nameMatch = fuzzyMatch(query, e.name);
        const muscleMatch = fuzzyMatch(query, e.muscle);
        const descMatch = fuzzyMatch(query, e.description || '');
        const bestScore = Math.max(nameMatch.score, muscleMatch.score * 0.7, descMatch.score * 0.5);
        const matched = nameMatch.match || muscleMatch.match || descMatch.match;
        return { ...e, _score: bestScore, _matched: matched };
      })
      .filter(e => e._matched && !selectedIds.includes(e.id))
      .sort((a, b) => b._score - a._score);
  }, [query, availableEquipment, selectedIds]);

  // ---- SMART SUGGESTIONS ----

  const suggestions = useMemo(() => {
    if (selectedIds.length === 0 || query.trim()) return [];

    // Find muscles of selected exercises
    const selectedMuscles = [...new Set(
      selectedIds
        .map(id => EXERCISES.find(e => e.id === id)?.muscle)
        .filter(Boolean)
    )];

    // Suggest related muscles not yet covered
    const relatedMuscles = new Set();
    selectedMuscles.forEach(m => {
      (RELATED_MUSCLES[m] || []).forEach(rm => {
        if (!selectedMuscles.includes(rm)) relatedMuscles.add(rm);
      });
    });

    if (relatedMuscles.size === 0) return [];

    // Pick top 3-4 exercises from related muscles
    const suggested = [];
    relatedMuscles.forEach(muscle => {
      const candidates = EXERCISES.filter(e =>
        e.muscle === muscle &&
        e.category === 'strength' &&
        availableEquipment.includes(e.equipment) &&
        !selectedIds.includes(e.id) &&
        e.intensity >= 4 && e.intensity <= 8
      );
      if (candidates.length > 0) {
        suggested.push(candidates[Math.floor(Math.random() * candidates.length)]);
      }
    });

    return suggested.slice(0, 4);
  }, [selectedIds, query, availableEquipment]);

  // ---- ANIMATIONS ----

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showResults ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showResults]);

  // ---- HANDLERS ----

  const handleSelect = useCallback((exercise) => {
    haptics.tap();
    onSelect(exercise);
    setQuery('');
    // Keep results open for adding more
  }, [onSelect]);

  const handleFocus = useCallback(() => {
    setShowResults(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay to allow tap on results
    setTimeout(() => setShowResults(false), 200);
  }, []);

  // ---- RENDER GROUPED RESULTS ----

  const renderGrouped = () => {
    if (query.trim()) {
      // Search results -- flat list sorted by relevance
      return filteredExercises.map(ex => renderExerciseRow(ex));
    }

    // No query -- group by muscle
    const groups = {};
    filteredExercises.forEach(ex => {
      if (!groups[ex.muscle]) groups[ex.muscle] = [];
      groups[ex.muscle].push(ex);
    });

    return Object.entries(groups).map(([muscle, exercises]) => {
      const MuscleIcon = getMuscleIcon(muscle);
      return (
        <View key={muscle}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            marginTop: 12, marginBottom: 6, paddingHorizontal: 4,
          }}>
            <MuscleIcon size={12} color={colors.textDim} strokeWidth={2} />
            <Text style={{
              ...FONT.label, fontSize: 11, color: colors.textDim,
            }}>
              {muscle.toUpperCase()}
            </Text>
          </View>
          {exercises.map(ex => renderExerciseRow(ex))}
        </View>
      );
    });
  };

  const renderExerciseRow = (ex) => {
    const ExIcon = getMuscleIcon(ex.muscle);
    return (
      <TouchableOpacity
        key={ex.id}
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingVertical: 10, paddingHorizontal: 12,
          borderRadius: RADIUS.sm, marginBottom: 2,
        }}
        onPress={() => handleSelect(ex)}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`Add ${ex.name}, ${ex.muscle}`}
      >
        <View style={{
          width: 28, height: 28, borderRadius: 8,
          backgroundColor: coachColor + '10',
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}>
          <ExIcon size={15} color={coachColor} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...FONT.subhead, fontSize: 15, color: colors.textPrimary }}>{ex.name}</Text>
          <Text style={{ ...FONT.caption, color: colors.textMuted, marginTop: 1 }}>
            {ex.muscle}
            {ex.equipment !== 'none' ? ` \u00B7 ${ex.equipment}` : ''}
            {' \u00B7 '}Intensity {ex.intensity}/10
          </Text>
        </View>
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: coachColor + '15', borderWidth: 1.5, borderColor: coachColor + '30',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Plus size={15} color={coachColor} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>
    );
  };

  // ---- MAIN RENDER ----

  return (
    <View>
      {/* Search Input */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.glassBg, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: showResults ? coachColor + '40' : colors.glassBorder,
        paddingHorizontal: 14, paddingVertical: 2,
      }}>
        <Search size={16} color={colors.textDim} strokeWidth={2} style={{ marginRight: 8 }} />
        <TextInput
          ref={inputRef}
          style={{
            flex: 1, color: colors.textPrimary, fontSize: 15,
            minHeight: 44, paddingVertical: 10,
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={setQuery}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search exercises"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => { setQuery(''); haptics.tap(); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Clear search"
          >
            <X size={16} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Smart Suggestions */}
      {suggestions.length > 0 && !query.trim() && showResults && (
        <View style={{ marginTop: 12 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            marginBottom: 8, paddingHorizontal: 4,
          }}>
            <Sparkles size={12} color={coachColor} strokeWidth={2} />
            <Text style={{ ...FONT.label, fontSize: 11, color: coachColor }}>
              SUGGESTED FOR YOUR WORKOUT
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
            {suggestions.map(ex => {
              const SugIcon = getMuscleIcon(ex.muscle);
              return (
                <TouchableOpacity
                  key={ex.id}
                  style={{
                    backgroundColor: coachColor + '10', borderRadius: RADIUS.md,
                    borderWidth: 1, borderColor: coachColor + '20',
                    paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 4,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                  }}
                  onPress={() => handleSelect(ex)}
                  activeOpacity={0.6}
                >
                  <SugIcon size={16} color={coachColor} strokeWidth={2} />
                  <View>
                    <Text style={{ ...FONT.caption, fontWeight: '600', color: colors.textPrimary }}>{ex.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{ex.muscle}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Results Dropdown */}
      {showResults && (
        <Animated.View style={{
          opacity: fadeAnim,
          maxHeight: maxHeight,
          backgroundColor: colors.glassBg, borderRadius: RADIUS.md,
          borderWidth: 1, borderColor: colors.glassBorder,
          marginTop: 8, overflow: 'hidden',
        }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ padding: 8 }}
          >
            {filteredExercises.length > 0 ? (
              <>
                {query.trim() && (
                  <Text style={{ ...FONT.label, fontSize: 11, color: colors.textDim, paddingHorizontal: 4, marginBottom: 4 }}>
                    {filteredExercises.length} result{filteredExercises.length !== 1 ? 's' : ''}
                  </Text>
                )}
                {renderGrouped()}
              </>
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ ...FONT.body, fontSize: 14, color: colors.textMuted }}>
                  {query.trim()
                    ? `No exercises matching "${query}"`
                    : 'All exercises are in your workout!'}
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}
