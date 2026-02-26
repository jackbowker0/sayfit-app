// ============================================================
// PROFILES SERVICE — User profiles, follow/unfollow, search
//
// Public profile data stored in Supabase. Handles the social
// graph (follows) and user discovery.
// ============================================================

import { getSupabaseClient } from './supabaseClient';

// ─── PROFILES ────────────────────────────────────────────

/**
 * Get a user's public profile by ID.
 */
export async function getProfile(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the current user's own profile.
 */
export async function getOwnProfile() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return getProfile(user.id);
}

/**
 * Update the current user's profile.
 */
export async function updateProfile(updates) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── SEARCH ─────────────────────────────────────────────

/**
 * Search for users by username or display name.
 */
export async function searchUsers(query, limit = 20) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, coach_id, is_public')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .eq('is_public', true)
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ─── FOLLOWS ────────────────────────────────────────────

/**
 * Follow a user.
 */
export async function followUser(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, following_id: userId });

  if (error && error.code !== '23505') throw error; // ignore duplicate
}

/**
 * Unfollow a user.
 */
export async function unfollowUser(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('follows')
    .delete()
    .match({ follower_id: user.id, following_id: userId });

  if (error) throw error;
}

/**
 * Check if the current user is following a given user.
 */
export async function isFollowing(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .match({ follower_id: user.id, following_id: userId })
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/**
 * Get follower and following counts for a user.
 */
export async function getFollowCounts(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) return { followers: 0, following: 0 };

  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);

  return { followers: followers || 0, following: following || 0 };
}

/**
 * Get list of followers for a user.
 */
export async function getFollowers(userId, limit = 50) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('follows')
    .select(`
      profiles:follower_id (id, username, display_name, avatar_url, coach_id)
    `)
    .eq('following_id', userId)
    .limit(limit);

  if (error) throw error;
  return (data || []).map(d => d.profiles);
}

/**
 * Get list of users a user is following.
 */
export async function getFollowing(userId, limit = 50) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('follows')
    .select(`
      profiles:following_id (id, username, display_name, avatar_url, coach_id)
    `)
    .eq('follower_id', userId)
    .limit(limit);

  if (error) throw error;
  return (data || []).map(d => d.profiles);
}
