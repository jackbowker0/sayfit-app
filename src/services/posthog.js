// ============================================================
// POSTHOG SERVICE — Analytics client singleton
// Reads config from EXPO_PUBLIC_ env vars (Expo bare / managed)
// ============================================================

import PostHog from 'posthog-react-native';

let client = null;

/**
 * Returns the singleton PostHog client.
 * The client is initialised lazily on first call so it's safe to
 * import this file anywhere (including before the provider is mounted).
 */
export function getPostHogClient() {
  if (client) return client;

  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  if (!apiKey) {
    if (__DEV__) {
      console.warn('[PostHog] EXPO_PUBLIC_POSTHOG_API_KEY is not set — analytics disabled.');
    }
    return null;
  }

  client = new PostHog(apiKey, { host,enableSessionReplay: true });
  return client;
}

/**
 * Fire-and-forget event capture helper.
 * Silently no-ops if the client is unavailable.
 *
 * @param {string} event   - Snake_case event name
 * @param {object} [props] - Optional properties object
 */
export function capture(event, props) {
  try {
    const ph = getPostHogClient();
    if (!ph) return;
    ph.capture(event, props);
  } catch (e) {
    if (__DEV__) console.warn('[PostHog] capture error:', e);
  }
}
