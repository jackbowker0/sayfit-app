// ============================================================
// NOTIFICATIONS SERVICE — Push notification registration & handling
//
// Uses expo-notifications for push tokens and local notifications.
// Registers the device push token with Supabase so the Edge
// Function can send targeted notifications for likes, comments,
// challenge invites, and accountability nudges.
// ============================================================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getSupabaseClient } from './supabaseClient';

// Configure default notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and store token in Supabase.
 * Returns the Expo push token string, or null if unavailable.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    if (__DEV__) console.log('[Notifications] Push requires a physical device');
    return null;
  }

  // Check / request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) console.log('[Notifications] Permission not granted');
    return null;
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF4136',
    });
  }

  // Get the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Store token in Supabase profile
  await savePushToken(token);

  return token;
}

/**
 * Save the push token to the user's profile in Supabase.
 */
async function savePushToken(token) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', user.id);
}

/**
 * Remove push token (on sign out).
 */
export async function removePushToken() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .update({ push_token: null })
    .eq('id', user.id);
}

/**
 * Add a listener for incoming notifications (while app is foregrounded).
 * Returns a subscription that should be removed on cleanup.
 */
export function addNotificationReceivedListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Add a listener for notification taps (user tapped a notification).
 * Returns a subscription that should be removed on cleanup.
 */
export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Get the last notification response (if app was opened via notification tap).
 */
export async function getLastNotificationResponse() {
  return Notifications.getLastNotificationResponseAsync();
}

/**
 * Parse notification data to determine navigation target.
 * Used by notification response listeners in App.js.
 */
export function getNotificationRoute(notification) {
  const data = notification?.request?.content?.data;
  if (!data?.type) return null;

  switch (data.type) {
    case 'like':
    case 'comment':
      return { screen: 'PostDetail', params: { postId: data.post_id } };
    case 'follow':
      return { screen: 'UserProfile', params: { userId: data.from_user_id } };
    case 'challenge_invite':
      return { screen: 'ChallengeDetail', params: { challengeId: data.challenge_id } };
    case 'accountability_nudge':
      return { screen: 'MainTabs' };
    default:
      return null;
  }
}
