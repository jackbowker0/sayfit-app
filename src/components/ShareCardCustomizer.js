// ============================================================
// SHARE CARD CUSTOMIZER — Template picker + stat toggles
//
// Horizontal carousel of template previews with toggle
// switches for which stats to include on the card.
// ============================================================

import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch,
} from 'react-native';
import {
  LayoutGrid, Minus, Smartphone, Sparkles, BarChart3,
} from 'lucide-react-native';
import { TEMPLATE_LIST } from '../constants/shareTemplates';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT } from '../constants/theme';
import * as haptics from '../services/haptics';

// Map template icon string names to actual Lucide components
const TEMPLATE_ICON_MAP = {
  LayoutGrid,
  Minus,
  Smartphone,
  Sparkles,
  BarChart3,
};

export default function ShareCardCustomizer({
  selectedTemplate,
  onSelectTemplate,
  visibility,
  onToggleStat,
  isLoggedWorkout,
  coachColor,
}) {
  const { colors, isDark } = useTheme();

  const statOptions = isLoggedWorkout
    ? [
      { key: 'time', label: 'Time' },
      { key: 'exercises', label: 'Exercises' },
      { key: 'sets', label: 'Sets' },
      { key: 'volume', label: 'Volume' },
      { key: 'muscles', label: 'Muscles' },
      { key: 'coachQuote', label: 'Coach Quote' },
      { key: 'streak', label: 'Streak' },
    ]
    : [
      { key: 'time', label: 'Time' },
      { key: 'calories', label: 'Calories' },
      { key: 'exercises', label: 'Exercises' },
      { key: 'adaptations', label: 'Adaptations' },
      { key: 'muscles', label: 'Muscles' },
      { key: 'coachQuote', label: 'Coach Quote' },
      { key: 'streak', label: 'Streak' },
    ];

  return (
    <View style={styles.container}>
      {/* Template Carousel */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TEMPLATE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {TEMPLATE_LIST.map(template => {
          const isSelected = template.id === selectedTemplate;
          const IconComponent = TEMPLATE_ICON_MAP[template.icon];
          return (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateCard,
                {
                  backgroundColor: isSelected
                    ? (coachColor + '15')
                    : isDark ? colors.glassBg : colors.bgCard,
                  borderColor: isSelected ? coachColor : isDark ? colors.glassBorder : colors.border,
                },
                // Glass-morphism subtle shadow in light mode
                !isDark && {
                  shadowColor: 'rgba(0,0,0,0.06)',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 1,
                  shadowRadius: 6,
                  elevation: 1,
                },
              ]}
              onPress={() => {
                haptics.tick();
                onSelectTemplate(template.id);
              }}
              activeOpacity={0.7}
            >
              {IconComponent && (
                <IconComponent
                  size={22}
                  color={isSelected ? coachColor : colors.textMuted}
                  strokeWidth={isSelected ? 2.5 : 2}
                />
              )}
              <Text style={[styles.templateName, {
                color: isSelected ? coachColor : colors.textPrimary,
                fontWeight: isSelected ? '700' : '500',
              }]}>
                {template.name}
              </Text>
              <Text style={[styles.templateDesc, { color: colors.textMuted }]} numberOfLines={1}>
                {template.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stat Toggles */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: SPACING.md }]}>SHOW ON CARD</Text>
      <View style={[styles.togglesCard, {
        backgroundColor: isDark ? colors.glassBg : colors.bgCard,
        borderColor: isDark ? colors.glassBorder : colors.border,
      },
      // Glass-morphism shadow in light mode
      !isDark && {
        shadowColor: 'rgba(0,0,0,0.06)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 2,
      },
      ]}>
        {statOptions.map((opt, i) => (
          <View
            key={opt.key}
            style={[
              styles.toggleRow,
              i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
            ]}
          >
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
            <Switch
              value={!!visibility[opt.key]}
              onValueChange={() => {
                haptics.tick();
                onToggleStat(opt.key);
              }}
              trackColor={{ false: colors.bgSubtle, true: coachColor + '60' }}
              thumbColor={visibility[opt.key] ? coachColor : colors.textMuted}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  sectionLabel: {
    ...FONT.label,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  carousel: {
    gap: 10,
    paddingRight: SPACING.md,
  },
  templateCard: {
    width: 100,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 6,
  },
  templateName: {
    ...FONT.caption,
  },
  templateDesc: {
    fontSize: 9,
    textAlign: 'center',
  },
  togglesCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  toggleLabel: {
    ...FONT.body,
    fontWeight: '500',
  },
});
