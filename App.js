import React, { useState, useEffect, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ThemeProvider, ThemeContext } from './src/context/ThemeContext';
import { WorkoutProvider } from './src/context/WorkoutContext';
import ErrorBoundary from './src/components/ErrorBoundary';
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
import { hasOnboarded, getUserProfile } from './src/services/userProfile';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Tab Bar Screens ─────────────────────────────
function HomeTabs() {
  const { colors, isDark } = useContext(ThemeContext);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 30,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="WorkoutTab"
        component={JustTalkScreen}
        options={{
          tabBarLabel: 'Train',
          tabBarIcon: ({ focused, color }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>💪</Text>
          ),
        }}
      />
      <Tab.Screen
        name="LogTab"
        component={LogWorkoutScreen}
        options={{
          tabBarLabel: 'Gym Log',
          tabBarIcon: ({ focused, color }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>📝</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProgressTab"
        component={ProgressScreen}
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ focused, color }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>📊</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Root Stack (wraps tabs + full-screen flows) ───
function AppInner({ onboarded, needsTutorial }) {
  const { isDark, colors } = useContext(ThemeContext);

  return (
    <WorkoutProvider>
      <NavigationContainer>
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

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppInner onboarded={onboarded} needsTutorial={needsTutorial} />
      </ThemeProvider>
    </ErrorBoundary>
  );
}