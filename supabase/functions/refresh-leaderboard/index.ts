// ============================================================
// REFRESH LEADERBOARD — Supabase Edge Function
//
// Recomputes leaderboard rankings from feed_posts data.
// Called periodically (via cron) or after workout completion.
//
// Deploy: supabase functions deploy refresh-leaderboard
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const now = new Date();

    // Calculate period starts
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Fetch all feed posts for current week
    const { data: weeklyPosts } = await supabase
      .from('feed_posts')
      .select('user_id, calories, total_volume, duration_seconds')
      .gte('created_at', weekStart.toISOString());

    // Aggregate by user for weekly
    const weeklyStats = aggregateByUser(weeklyPosts || []);

    // Upsert weekly leaderboard with ranks
    const weeklyEntries = Object.entries(weeklyStats)
      .sort((a, b) => b[1].workoutCount - a[1].workoutCount)
      .map(([userId, stats], index) => ({
        user_id: userId,
        period: 'weekly',
        period_start: weekStartStr,
        workout_count: stats.workoutCount,
        total_calories: stats.totalCalories,
        total_volume: stats.totalVolume,
        rank: index + 1,
        updated_at: now.toISOString(),
      }));

    if (weeklyEntries.length > 0) {
      await supabase
        .from('leaderboard_entries')
        .upsert(weeklyEntries, { onConflict: 'user_id,period,period_start' });
    }

    // Fetch all feed posts for current month
    const { data: monthlyPosts } = await supabase
      .from('feed_posts')
      .select('user_id, calories, total_volume, duration_seconds')
      .gte('created_at', monthStart.toISOString());

    const monthlyStats = aggregateByUser(monthlyPosts || []);

    const monthlyEntries = Object.entries(monthlyStats)
      .sort((a, b) => b[1].workoutCount - a[1].workoutCount)
      .map(([userId, stats], index) => ({
        user_id: userId,
        period: 'monthly',
        period_start: monthStartStr,
        workout_count: stats.workoutCount,
        total_calories: stats.totalCalories,
        total_volume: stats.totalVolume,
        rank: index + 1,
        updated_at: now.toISOString(),
      }));

    if (monthlyEntries.length > 0) {
      await supabase
        .from('leaderboard_entries')
        .upsert(monthlyEntries, { onConflict: 'user_id,period,period_start' });
    }

    return new Response(
      JSON.stringify({
        success: true,
        weekly: weeklyEntries.length,
        monthly: monthlyEntries.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

interface PostStats {
  workoutCount: number;
  totalCalories: number;
  totalVolume: number;
}

function aggregateByUser(
  posts: Array<{ user_id: string; calories: number; total_volume: number }>
): Record<string, PostStats> {
  const stats: Record<string, PostStats> = {};

  for (const post of posts) {
    if (!stats[post.user_id]) {
      stats[post.user_id] = { workoutCount: 0, totalCalories: 0, totalVolume: 0 };
    }
    stats[post.user_id].workoutCount += 1;
    stats[post.user_id].totalCalories += post.calories || 0;
    stats[post.user_id].totalVolume += Number(post.total_volume) || 0;
  }

  return stats;
}
