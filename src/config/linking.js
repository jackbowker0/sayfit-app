// ============================================================
// DEEP LINKING CONFIG — URL scheme and path mapping
//
// Handles sayfit:// deep links and notification-based navigation.
// Used by NavigationContainer in App.js.
//
// Supported deep links:
//   sayfit://post/:postId     — Open a specific post
//   sayfit://profile/:userId  — Open a user profile
//   sayfit://challenge/:id    — Open a challenge
//   sayfit://leaderboard      — Open the leaderboard
//   sayfit://feed             — Open the community feed
// ============================================================

const linking = {
  prefixes: ['sayfit://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          CommunityTab: 'feed',
        },
      },
      PostDetail: 'post/:postId',
      UserProfile: 'profile/:userId',
      ChallengeDetail: 'challenge/:challengeId',
      Challenges: 'challenges',
      Leaderboard: 'leaderboard',
      Auth: 'auth',
    },
  },
};

export default linking;
