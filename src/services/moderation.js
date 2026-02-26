// ============================================================
// MODERATION SERVICE — Block, mute, and report functionality
//
// Blocks prevent a user from seeing your content or contacting you.
// Mutes hide their content from your feed without them knowing.
// Reports flag content for admin review.
// ============================================================

import { getSupabaseClient } from './supabaseClient';

// ─── BLOCKS ──────────────────────────────────────────────

/**
 * Block a user. Also removes any follow relationship.
 */
export async function blockUser(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Insert block
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.id, blocked_id: userId });

  if (error && error.code !== '23505') throw error;

  // Remove any follow relationships in both directions
  await supabase
    .from('follows')
    .delete()
    .match({ follower_id: user.id, following_id: userId });

  await supabase
    .from('follows')
    .delete()
    .match({ follower_id: userId, following_id: user.id });
}

/**
 * Unblock a user.
 */
export async function unblockUser(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocks')
    .delete()
    .match({ blocker_id: user.id, blocked_id: userId });

  if (error) throw error;
}

/**
 * Check if the current user has blocked a given user.
 */
export async function isBlocked(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('blocks')
    .select('blocker_id')
    .match({ blocker_id: user.id, blocked_id: userId })
    .maybeSingle();

  return !!data;
}

/**
 * Get list of blocked user IDs (for filtering feeds).
 */
export async function getBlockedIds() {
  const supabase = getSupabaseClient();
  if (!supabase) return new Set();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id);

  return new Set((data || []).map(b => b.blocked_id));
}

// ─── MUTES ───────────────────────────────────────────────

/**
 * Mute a user (hide their content from your feed).
 */
export async function muteUser(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('mutes')
    .insert({ muter_id: user.id, muted_id: userId });

  if (error && error.code !== '23505') throw error;
}

/**
 * Unmute a user.
 */
export async function unmuteUser(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('mutes')
    .delete()
    .match({ muter_id: user.id, muted_id: userId });

  if (error) throw error;
}

/**
 * Get list of muted user IDs (for filtering feeds).
 */
export async function getMutedIds() {
  const supabase = getSupabaseClient();
  if (!supabase) return new Set();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from('mutes')
    .select('muted_id')
    .eq('muter_id', user.id);

  return new Set((data || []).map(m => m.muted_id));
}

// ─── REPORTS ──────────────────────────────────────────────

/**
 * Report a user, post, or comment.
 * @param {object} params
 * @param {string} params.reason - 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'other'
 * @param {string} [params.details] - Optional additional details
 * @param {string} [params.userId] - Reported user ID
 * @param {string} [params.postId] - Reported post ID
 * @param {string} [params.commentId] - Reported comment ID
 */
export async function reportContent({ reason, details, userId, postId, commentId }) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      reported_user_id: userId || null,
      reported_post_id: postId || null,
      reported_comment_id: commentId || null,
      reason,
      details: details || null,
    });

  if (error) throw error;
}
