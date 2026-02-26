// ============================================================
// AUTH SCREEN — Premium dark UI redesign
//
// Email + password authentication with Apple & Google social auth.
// Glass-morphism styling, Lucide icons, Reanimated entrance anims.
// ============================================================

import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FadeInView from '../components/FadeInView';
import { Users, Lock, Mail, ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../hooks/useTheme';
import { AuthContext } from '../context/AuthContext';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import * as haptics from '../services/haptics';
import { capture } from '../services/posthog';

export default function AuthScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { signIn, signUp, signInWithApple, signInWithGoogle } = useContext(AuthContext);

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSignUp = mode === 'signup';

  const canSubmit = email.trim() && password.length >= 6 && (!isSignUp || username.trim().length >= 3);

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    haptics.tap();
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email.trim(), password, username.trim());
        capture('auth_signup', { method: 'email' });
        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Tap it to activate your account.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        await signIn(email.trim(), password);
        capture('auth_signin', { method: 'email' });
        navigation.goBack();
      }
    } catch (e) {
      const message = e?.message || 'Something went wrong. Please try again.';
      Alert.alert(isSignUp ? 'Sign up failed' : 'Sign in failed', message);
    } finally {
      setLoading(false);
    }
  };

  const glassInputStyle = [
    styles.input,
    {
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgInput,
      color: colors.textPrimary,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <FadeInView>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <ChevronLeft
                size={22}
                color={colors.textSecondary}
                strokeWidth={2}
              />
              <Text style={[styles.backText, { color: colors.textSecondary }]}>
                Back
              </Text>
            </TouchableOpacity>
          </FadeInView>

          {/* Header */}
          <FadeInView
            delay={80}
            style={styles.headerRow}
          >
            <View style={[styles.headerIcon, {
              backgroundColor: isDark ? 'rgba(127,219,255,0.1)' : 'rgba(0,122,255,0.1)',
            }]}>
              {isSignUp ? (
                <Users size={24} color={colors.blue} strokeWidth={2} />
              ) : (
                <Lock size={24} color={colors.blue} strokeWidth={2} />
              )}
            </View>
          </FadeInView>

          <FadeInView delay={150}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {isSignUp ? 'Join the Community' : 'Welcome Back'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {isSignUp
                ? 'Create an account to share workouts, follow friends, and compete.'
                : 'Sign in to access your social features.'}
            </Text>
          </FadeInView>

          {/* Form Card */}
          <GlassCard
            fadeDelay={250}
            style={styles.formCard}
          >
            {isSignUp && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>USERNAME</Text>
                <View style={styles.inputWrapper}>
                  <Users
                    size={16}
                    color={colors.textMuted}
                    strokeWidth={2}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[
                      ...glassInputStyle,
                      styles.inputWithIcon,
                    ]}
                    placeholder="Choose a username"
                    placeholderTextColor={colors.textDim}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={24}
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>EMAIL</Text>
              <View style={styles.inputWrapper}>
                <Mail
                  size={16}
                  color={colors.textMuted}
                  strokeWidth={2}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    ...glassInputStyle,
                    styles.inputWithIcon,
                  ]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textDim}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Lock
                  size={16}
                  color={colors.textMuted}
                  strokeWidth={2}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    ...glassInputStyle,
                    styles.inputWithIcon,
                    { flex: 1 },
                  ]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textDim}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textMuted} strokeWidth={2} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>

          {/* Submit Button */}
          <FadeInView delay={350}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: canSubmit
                    ? isDark ? 'rgba(127,219,255,0.15)' : colors.blue
                    : isDark ? 'rgba(255,255,255,0.04)' : colors.bgSubtle,
                  borderColor: canSubmit
                    ? isDark ? 'rgba(127,219,255,0.3)' : 'transparent'
                    : isDark ? 'rgba(255,255,255,0.06)' : 'transparent',
                  borderWidth: isDark ? 1 : 0,
                  ...(canSubmit && isDark ? {
                    shadowColor: colors.blue,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.25,
                    shadowRadius: GLOW.md,
                    elevation: 4,
                  } : {}),
                },
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={canSubmit ? colors.blue : colors.textMuted} size="small" />
              ) : (
                <Text style={[styles.submitText, {
                  color: canSubmit
                    ? isDark ? colors.blue : '#fff'
                    : colors.textMuted,
                }]}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>
          </FadeInView>

          {/* Divider */}
          <FadeInView
            delay={420}
            style={styles.dividerRow}
          >
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>or continue with</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </FadeInView>

          {/* Social Auth Buttons */}
          <FadeInView
            delay={500}
            style={styles.socialButtons}
          >
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialBtn, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.textPrimary,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'transparent',
                }]}
                onPress={async () => {
                  if (loading) return;
                  haptics.tap();
                  setLoading(true);
                  try {
                    await signInWithApple();
                    capture('auth_signin', { method: 'apple' });
                    navigation.goBack();
                  } catch (e) {
                    if (!e?.message?.includes('cancelled')) {
                      Alert.alert('Apple Sign-In failed', e?.message || 'Please try again.');
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={[styles.socialBtnText, {
                  color: isDark ? colors.textPrimary : colors.bg,
                }]}>
                  Sign in with Apple
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.socialBtn, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgCard,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
              }]}
              onPress={async () => {
                if (loading) return;
                haptics.tap();
                setLoading(true);
                try {
                  await signInWithGoogle();
                  capture('auth_signin', { method: 'google' });
                  navigation.goBack();
                } catch (e) {
                  if (!e?.message?.includes('cancelled')) {
                    Alert.alert('Google Sign-In failed', e?.message || 'Please try again.');
                  }
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[styles.socialBtnText, { color: colors.textPrimary }]}>
                Sign in with Google
              </Text>
            </TouchableOpacity>
          </FadeInView>

          {/* Toggle sign in / sign up */}
          <FadeInView delay={580}>
            <TouchableOpacity
              onPress={() => {
                haptics.tick();
                setMode(isSignUp ? 'signin' : 'signup');
              }}
              style={styles.toggleButton}
            >
              <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: colors.blue, fontWeight: '700' }}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
    gap: 4,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerRow: {
    marginBottom: SPACING.md,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...FONT.title,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...FONT.body,
    marginBottom: SPACING.xl,
  },
  formCard: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  fieldGroup: {
    gap: SPACING.xs,
  },
  label: {
    ...FONT.label,
    marginLeft: SPACING.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: SPACING.md,
    zIndex: 1,
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    flex: 1,
  },
  inputWithIcon: {
    paddingLeft: SPACING.md + 24,
  },
  eyeButton: {
    position: 'absolute',
    right: SPACING.md,
    zIndex: 1,
  },
  submitButton: {
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  socialButtons: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  socialBtn: {
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  toggleText: {
    fontSize: 14,
  },
});
