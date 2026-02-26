# PostHog Integration Report — SayFit

## Summary

PostHog analytics has been fully integrated into the SayFit Expo/React Native app.
Events are captured across the entire user journey: onboarding → workout generation → active workout → completion → gym logging.

---

## Environment Variables

Set in `.env` (auto-added to `.gitignore`):

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_POSTHOG_API_KEY` | PostHog project API key |
| `EXPO_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` |

---

## Files Created / Modified

| File | Change |
|---|---|
| `app.config.js` | Dynamic Expo config — forwards env vars to `Constants.expoConfig.extra` |
| `src/services/posthog.js` | Singleton PostHog client + `capture()` helper |
| `.posthog-events.json` | Full event plan (all events, properties, triggers) |
| `App.js` | Wrapped root in `<PostHogProvider>` |
| `src/screens/OnboardingScreen.js` | Added `onboarding_started`, `onboarding_step_completed`, `onboarding_completed` |
| `src/screens/JustTalkScreen.js` | Added `workout_generated`, `workout_started` (talk + build modes) |
| `src/screens/WorkoutScreen.js` | Added `workout_command_sent` |
| `src/screens/CompleteScreen.js` | Added `workout_completed`, `achievement_unlocked` |
| `src/screens/LogWorkoutScreen.js` | Added `workout_logged` |
| `src/components/ErrorBoundary.js` | Added `app_error` capture in `componentDidCatch` |

---

## Events Tracked

### `onboarding_started`
**Trigger:** OnboardingScreen mounts (step 0)
**Properties:** _(none)_

### `onboarding_step_completed`
**Trigger:** User taps "Next" on each step
**Properties:** `step` (0–4), `step_name` (name / fitness_level / equipment / workout_days / training_mode)

### `onboarding_completed`
**Trigger:** User finishes all 6 steps and profile is saved
**Properties:** `fitness_level`, `equipment[]`, `workout_days_count`, `preferred_mode`, `coach_id`

### `workout_generated`
**Trigger:** AI generates a workout plan from natural language
**Properties:** `input_text`, `duration_minutes`, `exercise_count`, `energy_level`, `estimated_calories`, `source` (text | preset), `coach_id`

### `workout_started`
**Trigger:** User taps "Start Workout" (Talk mode) or "Start N Exercises" (Build mode)
**Properties:** `workout_name`, `exercise_count`, `coach_id`, `mode` (talk | build)

### `workout_command_sent`
**Trigger:** User taps a command button during a workout (Harder, Easier, Skip, Pause, etc.)
**Properties:** `command`, `coach_id`, `exercises_completed`, `total_exercises`

### `workout_completed`
**Trigger:** All exercises finish in a guided session (CompleteScreen mounts)
**Properties:** `workout_name`, `calories`, `exercises_completed`, `adaptations`, `duration_seconds`, `coach_id`, `streak`

### `workout_logged`
**Trigger:** User saves a manual strength workout via Gym Log
**Properties:** `exercise_count`, `total_sets`, `total_volume`, `new_prs_count`, `units`, `mode`

### `achievement_unlocked`
**Trigger:** One or more achievements are earned after a workout
**Properties:** `achievement_id`, `achievement_name`, `tier`

### `app_error`
**Trigger:** An uncaught React render error is caught by ErrorBoundary
**Properties:** `error_message`, `component_stack`

---

## PostHog Dashboard

**Dashboard:** [SayFit - App Analytics](https://us.posthog.com/project/324576/dashboard/1311073)

### Insights

| Insight | Type | URL |
|---|---|---|
| Onboarding Funnel | Funnel | https://us.posthog.com/project/324576/insights/3iPLohnL |
| Daily Workouts Started | Trend (line) | https://us.posthog.com/project/324576/insights/rRcrkEke |
| Workouts Started → Completed | Funnel | https://us.posthog.com/project/324576/insights/2BSQdrkt |
| Workout Commands Used | Trend (bar, breakdown by command) | https://us.posthog.com/project/324576/insights/E7gcMr0J |
| Workouts Logged (Gym Log) | Trend (line) | https://us.posthog.com/project/324576/insights/qUbVGHdX |
| Achievements Unlocked | Trend (line) | https://us.posthog.com/project/324576/insights/UCSi2NyN |

---

## Package Installed

```
posthog-react-native   (+ peer deps: expo-file-system, expo-application, expo-device, expo-localization)
```

Installed via: `npx expo install`

---

## How PostHog Is Initialised

`PostHogProvider` wraps the entire app in `App.js` (outermost provider, above ErrorBoundary and ThemeProvider):

```jsx
<PostHogProvider
  apiKey={process.env.EXPO_PUBLIC_POSTHOG_API_KEY}
  options={{ host: process.env.EXPO_PUBLIC_POSTHOG_HOST }}
>
  <ErrorBoundary>
    <ThemeProvider>
      <AppInner ... />
    </ThemeProvider>
  </ErrorBoundary>
</PostHogProvider>
```

A thin `capture()` helper in `src/services/posthog.js` is imported in each screen for fire-and-forget event capture. It silently no-ops if the API key is missing (e.g. in CI).
