// ============================================================
// SHARE CARDS SERVICE — Upload images + share to feed
//
// Handles uploading share card images to Supabase Storage
// and creating feed posts with the uploaded image URL.
// ============================================================

import { getSupabaseClient } from './supabaseClient';
import { createFeedPost } from './social';
import { capture } from './posthog';

/**
 * Upload a share card image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadShareImage(localUri) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `${user.id}/${timestamp}.png`;

  // Read the file and upload
  const response = await fetch(localUri.startsWith('file://') ? localUri : `file://${localUri}`);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('share-cards')
    .upload(filename, blob, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('share-cards')
    .getPublicUrl(filename);

  return publicUrl;
}

/**
 * Share a workout to the in-app feed.
 * Uploads the share card image and creates a feed post.
 */
export async function shareToFeed({
  imageUri,
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
  coachQuote,
  streak,
  caption,
  visibility,
}) {
  // Upload image first
  const imageUrl = await uploadShareImage(imageUri);

  // Create feed post
  const post = await createFeedPost({
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
    shareCardImageUrl: imageUrl,
    caption,
    coachQuote,
    streak,
    visibility,
  });

  capture('feed_post_created', {
    visibility,
    has_caption: !!caption,
    workout_type: workoutType,
    template: shareCardTemplate,
  });

  return post;
}
