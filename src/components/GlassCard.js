// ============================================================
// GlassCard — Reusable glass-morphism card component
//
// Usage:
//   <GlassCard>Content</GlassCard>
//   <GlassCard accentColor={coach.color} glow>Highlighted</GlassCard>
//   <GlassCard fadeDelay={100}>Animated</GlassCard>
// ============================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import FadeInView from './FadeInView';
import { useTheme } from '../hooks/useTheme';
import { RADIUS, SPACING, GLOW } from '../constants/theme';

export default function GlassCard({
  children,
  style,
  accentColor,
  glow = false,
  entering,
  fadeDelay,
  noPadding = false,
  ...props
}) {
  const { colors, isDark } = useTheme();

  const cardStyle = [
    styles.base,
    {
      backgroundColor: isDark ? colors.glassBg : colors.bgCard,
      borderColor: accentColor ? `${accentColor}20` : colors.glassBorder,
      borderTopColor: colors.glassHighlight,
      padding: noPadding ? 0 : SPACING.md,
    },
    // Neon glow in dark mode
    glow && isDark && accentColor && {
      shadowColor: accentColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: GLOW.md,
      elevation: 4,
    },
    // Light mode shadow
    !isDark && {
      shadowColor: 'rgba(0,0,0,0.06)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 2,
    },
    style,
  ];

  // Support both old `entering` prop (now treated as fadeDelay) and new fadeDelay prop
  const delay = fadeDelay != null ? fadeDelay : (entering ? 0 : null);

  if (delay != null) {
    return (
      <FadeInView delay={delay} style={cardStyle} {...props}>
        {children}
      </FadeInView>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
});
