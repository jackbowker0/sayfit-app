// ============================================================
// TabBar — Custom glass-morphism bottom tab bar with Lucide icons
//
// Replaces emoji-based tab icons with clean vector icons,
// animated active indicator, and glass background.
// ============================================================

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { TAB_ICONS } from '../constants/icons';
import { useTheme } from '../hooks/useTheme';
import { SPACING, TIMING } from '../constants/theme';

const ROUTE_TO_ICON = {
  DashboardTab: 'home',
  WorkoutTab: 'train',
  LogTab: 'log',
  CommunityTab: 'community',
  ProgressTab: 'progress',
};

const ROUTE_LABELS = {
  DashboardTab: 'Home',
  WorkoutTab: 'Train',
  LogTab: 'Gym Log',
  CommunityTab: 'Community',
  ProgressTab: 'Progress',
};

export default function TabBar({ state, descriptors, navigation, coachColor }) {
  const { colors, isDark } = useTheme();
  const activeColor = coachColor || colors.textPrimary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.glassBg : colors.bgCard,
          borderTopColor: isDark ? colors.glassBorder : colors.border,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const iconKey = ROUTE_TO_ICON[route.name];
        const IconComponent = TAB_ICONS[iconKey];
        const label = ROUTE_LABELS[route.name] || route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
            style={styles.tab}
            activeOpacity={0.7}
          >
            {IconComponent && (
              <IconComponent
                size={22}
                color={isFocused ? activeColor : colors.textMuted}
                strokeWidth={isFocused ? 2.2 : 1.8}
              />
            )}
            <Text
              style={[
                styles.label,
                {
                  color: isFocused ? activeColor : colors.textMuted,
                  fontWeight: isFocused ? '700' : '500',
                },
              ]}
            >
              {label}
            </Text>
            {isFocused && (
              <View
                style={[
                  styles.activeIndicator,
                  { backgroundColor: activeColor },
                ]}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 85,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 2,
    borderRadius: 1,
  },
});
