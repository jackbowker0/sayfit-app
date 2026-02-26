// ============================================================
// SUPABASE CLIENT — Singleton client for Supabase
// Reads config from EXPO_PUBLIC_ env vars (same pattern as posthog.js)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

let client = null;

/**
 * Returns the singleton Supabase client.
 * Initialised lazily on first call — safe to import anywhere.
 */
export function getSupabaseClient() {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (__DEV__) {
      console.warn('[Supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is not set — Supabase disabled.');
    }
    return null;
  }

  client = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}
