// ============================================================
// AUTH GATE — Wraps social screens that require authentication
//
// If the user is signed in, renders children normally.
// If not, shows a friendly prompt to sign in with a button
// that navigates to AuthScreen.
// Premium dark UI with Lucide icons and glass-morphism.
//
// Usage:
//   <AuthGate navigation={navigation}>
//     <SocialFeedScreen />
//   </AuthGate>
// ============================================================

import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Users, Lock, ChevronRight } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import GlassCard from '../components/GlassCard';
import * as haptics from '../services/haptics';

export default function AuthGate({ children, navigation }) {
  const { isAuthenticated, loading } = useContext(AuthContext);
  const { colors, isDark } = useTheme();

  if (loading) return null;

  if (isAuthenticated) return children;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <GlassCard style={styles.card} accentColor={colors.blue} glow>
        <View style={[styles.iconWrap, { backgroundColor: colors.blue + '15' }]}>
          <Users size={32} color={colors.blue} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Join the Community
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Sign in to share workouts, follow friends, and compete in challenges.
        </Text>
        <TouchableOpacity
          style={[styles.button, {
            backgroundColor: colors.blue,
            ...(isDark ? {
              shadowColor: colors.blue,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: GLOW.md,
              elevation: 4,
            } : {}),
          }]}
          onPress={() => {
            haptics.tap();
            navigation.navigate('Auth');
          }}
          activeOpacity={0.8}
        >
          <Lock size={16} color="#fff" />
          <Text style={styles.buttonText}>Sign In or Sign Up</Text>
          <ChevronRight size={16} color="#fff" />
        </TouchableOpacity>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  card: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    maxWidth: 340,
    width: '100%',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONT.title,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  body: {
    ...FONT.body,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    maxWidth: 280,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
  },
  buttonText: {
    color: '#fff',
    ...FONT.subhead,
    fontSize: 16,
    fontWeight: '700',
  },
});
