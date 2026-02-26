// ============================================================
// AUTH SERVICE — Supabase authentication helpers
//
// Handles sign up, sign in, sign out, and session management.
// On first login, syncs local AsyncStorage workout history
// to the user's Supabase profile.
// ============================================================

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { getSupabaseClient } from './supabaseClient';
import { getWorkoutHistory } from './storage';
import { getUserProfile } from './userProfile';

WebBrowser.maybeCompleteAuthSession();

/**
 * Sign up with email + password.
 * Creates a Supabase auth user and a public profile row.
 */
export async function signUp(email, password, username) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // Create public profile
  if (data.user) {
    const localProfile = await getUserProfile();
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        username: username.toLowerCase().trim(),
        display_name: localProfile.name || username,
        coach_id: localProfile.coachId || 'hype',
        fitness_level: localProfile.fitnessLevel || 'intermediate',
      });

    if (profileError) {
      console.warn('[Auth] Failed to create profile:', profileError);
    }
  }

  return data;
}

/**
 * Sign in with email + password.
 */
export async function signIn(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  return data;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current authenticated user (or null).
 */
export async function getCurrentUser() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current session (or null).
 */
export async function getSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Listen for auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => callback(event, session)
  );

  return () => subscription.unsubscribe();
}

// ─── APPLE SIGN-IN ─────────────────────────────────────────

/**
 * Sign in with Apple (iOS only).
 * Uses native Apple authentication + Supabase ID token flow.
 */
export async function signInWithApple() {
  if (Platform.OS !== 'ios') throw new Error('Apple Sign-In is only available on iOS');

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  // Generate nonce for security
  const rawNonce = Array.from(
    await Crypto.getRandomBytesAsync(32),
    (b) => b.toString(16).padStart(2, '0')
  ).join('');
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('Apple Sign-In failed: no identity token');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) throw error;

  // Ensure profile exists (Apple may provide name only on first sign-in)
  if (data.user) {
    await ensureProfile(data.user, {
      displayName: credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : null,
    });
  }

  return data;
}

// ─── GOOGLE SIGN-IN ────────────────────────────────────────

/**
 * Sign in with Google using OAuth flow.
 */
export async function signInWithGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const redirectUrl = makeRedirectUri({ scheme: 'sayfit' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('No auth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (result.type !== 'success') {
    throw new Error('Google Sign-In was cancelled');
  }

  // Extract tokens from the redirect URL
  const url = new URL(result.url);
  const params = new URLSearchParams(url.hash.substring(1)); // fragment params
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken) throw new Error('No access token in redirect');

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) throw sessionError;

  // Ensure profile exists
  if (sessionData.user) {
    await ensureProfile(sessionData.user, {});
  }

  return sessionData;
}

// ─── HELPERS ───────────────────────────────────────────────

/**
 * Ensure a public profile row exists for a social auth user.
 * Social auth users may not have a profile created via signUp.
 */
async function ensureProfile(user, { displayName }) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  // Check if profile already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) return;

  const localProfile = await getUserProfile();
  const username = user.email?.split('@')[0] || `user_${user.id.substring(0, 8)}`;

  await supabase
    .from('profiles')
    .insert({
      id: user.id,
      username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      display_name: displayName || localProfile.name || username,
      coach_id: localProfile.coachId || 'hype',
      fitness_level: localProfile.fitnessLevel || 'intermediate',
    });
}

/**
 * Sync local AsyncStorage workout history to Supabase.
 * Called once after first sign-in to migrate existing data.
 */
export async function syncLocalDataToSupabase(userId) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return;

  try {
    const history = await getWorkoutHistory();
    if (history.length === 0) return;

    // Update profile stats from local history
    const totalCalories = history.reduce((sum, w) => sum + (w.calories || 0), 0);
    await supabase
      .from('profiles')
      .update({
        total_workouts: history.length,
        total_calories: totalCalories,
      })
      .eq('id', userId);

    if (__DEV__) {
      console.log(`[Auth] Synced ${history.length} workouts to profile stats`);
    }
  } catch (e) {
    console.warn('[Auth] Sync failed:', e);
  }
}
