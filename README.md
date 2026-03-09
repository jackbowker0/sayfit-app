# SayFit

AI-powered mobile fitness app that lets you talk through your workouts. Built with React Native, Expo, and Claude API.

## Features

- **Voice-Guided Workouts** — Describe your workout by talking and the AI coach logs it for you
- **AI Workout Generation** — Get personalized workout plans based on your fitness level and goals
- **Progress Tracking** — Track sets, reps, weight, and body weight over time
- **Personal Records Wall** — Automatically detects and celebrates new PRs
- **Text-to-Speech Coaching** — Audio feedback and motivation from your AI coach
- **Social Feed** — Share workouts, follow friends, and compete on leaderboards
- **Challenges** — Join community fitness challenges
- **Achievements** — Earn badges for milestones and consistency
- **Push Notifications** — Workout reminders and social updates
- **Dark Mode** — Full light/dark/system theme support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81 + Expo 54 |
| Language | JavaScript |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| AI | Claude API (via Supabase Edge Functions) |
| Voice | expo-speech-recognition + expo-speech |
| Auth | Supabase Auth (Email, Apple, Google) |
| Analytics | PostHog |
| Storage | AsyncStorage (local) + Supabase (cloud) |

## Architecture

- AI calls are proxied through **Supabase Edge Functions** — API keys stay server-side
- **Dual-layer data**: local AsyncStorage for offline use, Supabase for cloud sync
- **React Context** for state management (Auth, Theme, Workout)
- Voice-first input: speak your workout, AI parses and logs it

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npx expo start
```

## Status

Actively in development. Core workout tracking, AI coaching, and social features are functional. Preparing for TestFlight.

## License

This project is not currently licensed for reuse.
