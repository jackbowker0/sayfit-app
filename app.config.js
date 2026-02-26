// app.config.js — Dynamic Expo config
// Reads PostHog keys from environment variables and exposes them
// via Constants.expoConfig.extra at runtime.
const appJson = require('./app.json');

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [
      ...(appJson.expo.plugins ?? []),
      'expo-localization',
      'expo-apple-authentication',
      'expo-web-browser',
    ],
    extra: {
      ...(appJson.expo.extra ?? {}),
      posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '',
      posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
};
