-- ============================================================
-- Migration: Social profiles table
--
-- Public-facing user data for the social features.
-- Linked to auth.users via id. RLS ensures users can only
-- modify their own profile but can view public profiles.
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  coach_id text NOT NULL DEFAULT 'hype',
  fitness_level text DEFAULT 'intermediate',
  total_workouts integer DEFAULT 0,
  total_calories integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  is_public boolean DEFAULT true,
  share_stats boolean DEFAULT true,
  share_workouts boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read public profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (is_public = true OR auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
