// ============================================================
// PUSH NOTIFICATION — Supabase Edge Function
//
// Triggered by database webhooks (likes, comments, follows,
// challenge invites). Sends Expo push notifications to the
// target user's registered device.
//
// Webhook payload: { type, record, old_record }
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, record } = payload;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let targetUserId: string | null = null;
    let title = '';
    let body = '';
    let data: Record<string, string> = {};

    switch (type) {
      case 'like': {
        // record is a likes row
        const postId = record.post_id;
        const likerId = record.user_id;

        // Get the post owner
        const { data: post } = await supabase
          .from('feed_posts')
          .select('user_id, workout_name')
          .eq('id', postId)
          .single();

        if (!post || post.user_id === likerId) break; // don't notify self-likes

        targetUserId = post.user_id;

        // Get liker's name
        const { data: liker } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', likerId)
          .single();

        const likerName = liker?.display_name || liker?.username || 'Someone';
        title = 'New Like';
        body = `${likerName} liked your ${post.workout_name || 'workout'} post`;
        data = { type: 'like', post_id: postId, from_user_id: likerId };
        break;
      }

      case 'comment': {
        const postId = record.post_id;
        const commenterId = record.user_id;

        const { data: post } = await supabase
          .from('feed_posts')
          .select('user_id, workout_name')
          .eq('id', postId)
          .single();

        if (!post || post.user_id === commenterId) break;

        targetUserId = post.user_id;

        const { data: commenter } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', commenterId)
          .single();

        const commenterName = commenter?.display_name || commenter?.username || 'Someone';
        const preview = record.body?.substring(0, 80) || '';
        title = 'New Comment';
        body = `${commenterName}: "${preview}"`;
        data = { type: 'comment', post_id: postId, from_user_id: commenterId };
        break;
      }

      case 'follow': {
        // record is a follows row
        const followerId = record.follower_id;
        targetUserId = record.following_id;

        const { data: follower } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', followerId)
          .single();

        const followerName = follower?.display_name || follower?.username || 'Someone';
        title = 'New Follower';
        body = `${followerName} started following you`;
        data = { type: 'follow', from_user_id: followerId };
        break;
      }

      case 'challenge_invite': {
        // record is a challenge_participants row
        targetUserId = record.user_id;
        const challengeId = record.challenge_id;

        const { data: challenge } = await supabase
          .from('challenges')
          .select('title')
          .eq('id', challengeId)
          .single();

        title = 'Challenge Invite';
        body = `You've been invited to "${challenge?.title || 'a challenge'}"`;
        data = { type: 'challenge_invite', challenge_id: challengeId };
        break;
      }

      default:
        return new Response(JSON.stringify({ sent: false, reason: 'unknown type' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ sent: false, reason: 'no target user' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get target user's push token
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', targetUserId)
      .single();

    const pushToken = targetProfile?.push_token;
    if (!pushToken) {
      return new Response(JSON.stringify({ sent: false, reason: 'no push token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send via Expo Push API
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
      }),
    });

    const pushResult = await pushResponse.json();

    return new Response(JSON.stringify({ sent: true, result: pushResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
