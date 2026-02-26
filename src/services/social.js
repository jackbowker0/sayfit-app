// ============================================================
// SOCIAL SERVICE — Feed posts, likes, and comments
//
// All operations use the Supabase client and require auth.
// Feed is paginated with cursor-based pagination.
// ============================================================

import { getSupabaseClient } from './supabaseClient';

const PAGE_SIZE = 20;

// ─── FEED ────────────────────────────────────────────────

/**
 * Get the user's feed (posts from followed users + own posts).
 * Returns { posts, nextCursor }.
 */
export async function getFeed(cursor = null) {
  const supabase = getSupabaseClient();
  if (!supabase) return { posts: [], nextCursor: null };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { posts: [], nextCursor: null };

  let query = supabase
    .from('feed_posts')
    .select(`
      *,
      profiles:user_id (id, username, display_name, avatar_url, coach_id)
    `)
    .or(`user_id.eq.${user.id},user_id.in.(${
      // Subquery for followed users
      `select following_id from follows where follower_id = '${user.id}'`
    })`)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    posts: data || [],
    nextCursor: data?.length === PAGE_SIZE ? data[data.length - 1].created_at : null,
  };
}

/**
 * Get public/explore feed (all public posts).
 */
export async function getExploreFeed(cursor = null) {
  const supabase = getSupabaseClient();
  if (!supabase) return { posts: [], nextCursor: null };

  let query = supabase
    .from('feed_posts')
    .select(`
      *,
      profiles:user_id (id, username, display_name, avatar_url, coach_id)
    `)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    posts: data || [],
    nextCursor: data?.length === PAGE_SIZE ? data[data.length - 1].created_at : null,
  };
}

/**
 * Get posts for a specific user.
 */
export async function getUserPosts(userId, cursor = null) {
  const supabase = getSupabaseClient();
  if (!supabase) return { posts: [], nextCursor: null };

  let query = supabase
    .from('feed_posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    posts: data || [],
    nextCursor: data?.length === PAGE_SIZE ? data[data.length - 1].created_at : null,
  };
}

// ─── CREATE / DELETE POSTS ───────────────────────────────

/**
 * Create a feed post from workout data.
 */
export async function createFeedPost({
  workoutType,
  workoutName,
  coachId,
  durationSeconds,
  calories,
  exercisesCompleted,
  muscles,
  totalSets,
  totalVolume,
  newPRs,
  shareCardTemplate,
  shareCardImageUrl,
  caption,
  coachQuote,
  streak,
  visibility = 'public',
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('feed_posts')
    .insert({
      user_id: user.id,
      workout_type: workoutType,
      workout_name: workoutName,
      coach_id: coachId,
      duration_seconds: durationSeconds,
      calories,
      exercises_completed: exercisesCompleted,
      muscles: muscles || [],
      total_sets: totalSets || 0,
      total_volume: totalVolume || 0,
      new_prs: newPRs || [],
      share_card_template: shareCardTemplate || 'classic',
      share_card_image_url: shareCardImageUrl,
      caption,
      coach_quote: coachQuote,
      streak: streak || 0,
      visibility,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a feed post (own posts only).
 */
export async function deletePost(postId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('feed_posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
}

// ─── LIKES ──────────────────────────────────────────────

/**
 * Like a post.
 */
export async function likePost(postId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('likes')
    .insert({ user_id: user.id, post_id: postId });

  if (error && error.code !== '23505') throw error; // ignore duplicate
}

/**
 * Unlike a post.
 */
export async function unlikePost(postId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('likes')
    .delete()
    .match({ user_id: user.id, post_id: postId });

  if (error) throw error;
}

/**
 * Check if the current user has liked a set of posts.
 * Returns a Set of liked post IDs.
 */
export async function getLikedPostIds(postIds) {
  const supabase = getSupabaseClient();
  if (!supabase) return new Set();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', postIds);

  if (error) return new Set();
  return new Set((data || []).map(l => l.post_id));
}

// ─── COMMENTS ───────────────────────────────────────────

/**
 * Get comments for a post (paginated).
 */
export async function getComments(postId, cursor = null) {
  const supabase = getSupabaseClient();
  if (!supabase) return { comments: [], nextCursor: null };

  let query = supabase
    .from('comments')
    .select(`
      *,
      profiles:user_id (id, username, display_name, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(50);

  if (cursor) {
    query = query.gt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    comments: data || [],
    nextCursor: data?.length === 50 ? data[data.length - 1].created_at : null,
  };
}

/**
 * Add a comment to a post.
 */
export async function addComment(postId, body) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: user.id, body })
    .select(`
      *,
      profiles:user_id (id, username, display_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a comment (own comments only).
 */
export async function deleteComment(commentId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}
