// ============================================================
// CHALLENGES SERVICE — Create, join, track challenges
//
// Handles challenge CRUD, participant management, progress
// updates, and leaderboard queries.
// ============================================================

import { getSupabaseClient } from './supabaseClient';
import { capture } from './posthog';

// ─── CHALLENGES CRUD ─────────────────────────────────────

/**
 * Create a new challenge.
 */
export async function createChallenge({
  title,
  description,
  challengeType,
  targetValue,
  startDate,
  endDate,
  isPublic = false,
  maxParticipants = 10,
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('challenges')
    .insert({
      creator_id: user.id,
      title,
      description,
      challenge_type: challengeType,
      target_value: targetValue,
      start_date: startDate,
      end_date: endDate,
      is_public: isPublic,
      max_participants: maxParticipants,
    })
    .select()
    .single();

  if (error) throw error;

  // Auto-join creator
  await joinChallenge(data.id);

  capture('challenge_created', {
    type: challengeType,
    target: targetValue,
    duration_days: Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000),
    is_public: isPublic,
  });

  return data;
}

/**
 * Get challenges (filterable).
 */
export async function getChallenges(filter = 'active') {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('challenges')
    .select(`
      *,
      profiles:creator_id (id, username, display_name, avatar_url, coach_id),
      challenge_participants (user_id, progress, status)
    `)
    .order('created_at', { ascending: false });

  if (filter === 'active') {
    query = query.eq('status', 'active');
  } else if (filter === 'mine' && user) {
    query = query.or(`creator_id.eq.${user.id},challenge_participants.user_id.eq.${user.id}`);
  } else if (filter === 'public') {
    query = query.eq('is_public', true).eq('status', 'active');
  }

  const { data, error } = await query.limit(30);
  if (error) throw error;
  return data || [];
}

/**
 * Get a single challenge with full details.
 */
export async function getChallengeDetail(challengeId) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('challenges')
    .select(`
      *,
      profiles:creator_id (id, username, display_name, avatar_url, coach_id),
      challenge_participants (
        user_id,
        progress,
        status,
        joined_at,
        completed_at,
        profiles:user_id (id, username, display_name, avatar_url, coach_id)
      )
    `)
    .eq('id', challengeId)
    .single();

  if (error) throw error;
  return data;
}

// ─── PARTICIPATION ───────────────────────────────────────

/**
 * Join a challenge.
 */
export async function joinChallenge(challengeId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('challenge_participants')
    .insert({
      challenge_id: challengeId,
      user_id: user.id,
      progress: 0,
      status: 'active',
    });

  if (error && error.code !== '23505') throw error;

  capture('challenge_joined');
}

/**
 * Leave a challenge.
 */
export async function leaveChallenge(challengeId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('challenge_participants')
    .delete()
    .match({ challenge_id: challengeId, user_id: user.id });

  if (error) throw error;
}

/**
 * Update progress for all active challenges after a workout.
 * Called automatically from saveWorkout.
 */
export async function updateChallengeProgress({ calories = 0, workoutCount = 1 }) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    // Get all active challenge participations
    const { data: participations } = await supabase
      .from('challenge_participants')
      .select(`
        challenge_id,
        progress,
        challenges:challenge_id (challenge_type, target_value, status)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!participations || participations.length === 0) return;

    for (const p of participations) {
      const challenge = p.challenges;
      if (!challenge || challenge.status !== 'active') continue;

      let increment = 0;
      if (challenge.challenge_type === 'workout_count') {
        increment = workoutCount;
      } else if (challenge.challenge_type === 'calorie_burn') {
        increment = calories;
      }

      if (increment <= 0) continue;

      const newProgress = p.progress + increment;
      const completed = newProgress >= challenge.target_value;

      await supabase
        .from('challenge_participants')
        .update({
          progress: newProgress,
          status: completed ? 'completed' : 'active',
          completed_at: completed ? new Date().toISOString() : null,
        })
        .match({ challenge_id: p.challenge_id, user_id: user.id });

      if (completed) {
        capture('challenge_completed', { challenge_id: p.challenge_id });
      }
    }
  } catch (e) {
    console.warn('[Challenges] Progress update failed:', e);
  }
}

// ─── ACCOUNTABILITY PARTNERS ─────────────────────────────

/**
 * Request an accountability partnership.
 */
export async function requestPartner(partnerUserId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('accountability_partners')
    .insert({
      user_a: user.id,
      user_b: partnerUserId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Accept a partnership request.
 */
export async function acceptPartner(partnershipId) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('accountability_partners')
    .update({ status: 'active' })
    .eq('id', partnershipId);

  if (error) throw error;
}

/**
 * Get the current user's accountability partner(s).
 */
export async function getPartners() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('accountability_partners')
    .select(`
      *,
      partner_a:user_a (id, username, display_name, avatar_url, coach_id, current_streak),
      partner_b:user_b (id, username, display_name, avatar_url, coach_id, current_streak)
    `)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .in('status', ['pending', 'active']);

  if (error) return [];

  // Map to show the "other" partner
  return (data || []).map(p => ({
    ...p,
    partner: p.user_a === user.id ? p.partner_b : p.partner_a,
    isPending: p.status === 'pending',
    isRequester: p.user_a === user.id,
  }));
}

// ─── LEADERBOARD ─────────────────────────────────────────

/**
 * Get leaderboard entries for a period.
 */
export async function getLeaderboard(period = 'weekly') {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  // Calculate current period start
  const now = new Date();
  let periodStart;
  if (period === 'weekly') {
    const dayOfWeek = now.getDay();
    periodStart = new Date(now);
    periodStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    periodStart.setHours(0, 0, 0, 0);
  } else if (period === 'monthly') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    periodStart = new Date('2020-01-01');
  }

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select(`
      *,
      profiles:user_id (id, username, display_name, avatar_url, coach_id)
    `)
    .eq('period', period)
    .eq('period_start', periodStart.toISOString().split('T')[0])
    .order('rank', { ascending: true })
    .limit(50);

  if (error) throw error;
  return data || [];
}
