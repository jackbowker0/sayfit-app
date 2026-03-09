import React, { useState, useEffect, useContext, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PostHogProvider } from 'posthog-react-native';

import { ThemeProvider, ThemeContext } from './src/context/ThemeContext';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { WorkoutProvider } from './src/context/WorkoutContext';
import linking from './src/config/linking';
import {
  registerForPushNotifications,
  addNotificationResponseListener,
  getNotificationRoute,
} from './src/services/notifications';
import { scheduleWorkoutReminders } from './src/services/localNotifications';
import ErrorBoundary from './src/components/ErrorBoundary';
import TabBar from './src/components/TabBar';
import { COACHES } from './src/constants/coaches';
import WorkoutScreen from './src/screens/WorkoutScreen';
import CompleteScreen from './src/screens/CompleteScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import JustTalkScreen from './src/screens/JustTalkScreen';
import LogWorkoutScreen from './src/screens/LogWorkoutScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import TutorialScreen from './src/screens/TutorialScreen';
import WeightScreen from './src/screens/WeightScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import AuthScreen from './src/screens/AuthScreen';
import ShareCustomizerScreen from './src/screens/ShareCustomizerScreen';
import SocialFeedScreen from './src/screens/SocialFeedScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import ChallengesScreen from './src/screens/ChallengesScreen';
import ChallengeDetailScreen from './src/screens/ChallengeDetailScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import PRWallScreen from './src/screens/PRWallScreen';
import { hasOnboarded, getUserProfile } from './src/services/userProfile';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Tab Bar Screens ─────────────────────────────
function HomeTabs() {
  const [coachColor, setCoachColor] = useState(null);

  useEffect(() => {
    getUserProfile().then((profile) => {
      const coach = COACHES[profile.coachId || 'drill'];
      if (coach) setCoachColor(coach.color);
    });
  }, []);

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} coachColor={coachColor} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen} />
      <Tab.Screen name="WorkoutTab" component={JustTalkScreen} />
      <Tab.Screen name="LogTab" component={LogWorkoutScreen} />
      <Tab.Screen name="CommunityTab" component={SocialFeedScreen} />
      <Tab.Screen name="ProgressTab" component={ProgressScreen} />
    </Tab.Navigator>
  );
}

// ─── Root Stack (wraps tabs + full-screen flows) ───
function AppInner({ onboarded, needsTutorial }) {
  const { isDark, colors } = useContext(ThemeContext);
  const { isAuthenticated } = useContext(AuthContext);
  const navigationRef = useRef(null);

  // Register for push notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications().catch(() => {});
    }
  }, [isAuthenticated]);

  // Schedule local notifications on mount and whenever app comes to foreground
  useEffect(() => {
    scheduleWorkoutReminders().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleWorkoutReminders().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Handle notification taps — navigate to the relevant screen
  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const route = getNotificationRoute(response.notification);
      if (route && navigationRef.current) {
        navigationRef.current.navigate(route.screen, route.params);
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <WorkoutProvider>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          {!onboarded && (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          )}
          {needsTutorial && (
            <Stack.Screen name="Tutorial" component={TutorialScreen} options={{ gestureEnabled: false }} />
          )}
          <Stack.Screen name="MainTabs" component={HomeTabs} />
          <Stack.Screen name="Weight" component={WeightScreen} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="Workout" component={WorkoutScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Complete" component={CompleteScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="ShareCustomizer" component={ShareCustomizerScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} />
          <Stack.Screen name="Challenges" component={ChallengesScreen} />
          <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
          <Stack.Screen name="PRWall" component={PRWallScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </WorkoutProvider>
  );
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [needsTutorial, setNeedsTutorial] = useState(false);

  useEffect(() => {
    const init = async () => {
      const isOnboarded = await hasOnboarded();
      setOnboarded(isOnboarded);

      if (isOnboarded) {
        // Check if user still needs to see the tutorial
        const profile = await getUserProfile();
        // hasSeenTutorial === false means they onboarded but haven't seen tutorial yet
        // hasSeenTutorial === undefined (existing users) means they're past it — skip
        setNeedsTutorial(profile.hasSeenTutorial === false);
      } else {
        // New users — Tutorial screen is registered so Onboarding can navigate to it
        setNeedsTutorial(true);
      }

      setChecking(false);
    };
    init();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#ffffff40" size="large" />
      </View>
    );
  }

  const appContent = (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppInner onboarded={onboarded} needsTutorial={needsTutorial} />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );

  if (!process.env.EXPO_PUBLIC_POSTHOG_API_KEY) {
    return appContent;
  }

  return (
    <PostHogProvider
      apiKey={process.env.EXPO_PUBLIC_POSTHOG_API_KEY}
      options={{ host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com' }}
    >
      {appContent}
    </PostHogProvider>
  );
}