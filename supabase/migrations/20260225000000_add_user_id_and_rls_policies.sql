-- ============================================================
-- Migration: Add user_id columns + RLS policies
--
-- Adds user_id (linked to auth.users) to all tables so each
-- user can only read/write their own data.
-- ============================================================

-- ─── 1. ADD user_id COLUMNS ─────────────────────────────────

-- workouts
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- exercises (inherits ownership through workout_id, but direct user_id makes RLS simpler)
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- food_logs
ALTER TABLE public.food_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;


-- ─── 2. BACKFILL (if any existing rows, assign to nobody — they'll need manual cleanup) ──


-- ─── 3. RLS POLICIES FOR workouts ───────────────────────────

-- Users can read their own workouts
CREATE POLICY "Users can view own workouts"
  ON public.workouts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own workouts
CREATE POLICY "Users can insert own workouts"
  ON public.workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own workouts
CREATE POLICY "Users can update own workouts"
  ON public.workouts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own workouts
CREATE POLICY "Users can delete own workouts"
  ON public.workouts FOR DELETE
  USING (auth.uid() = user_id);


-- ─── 4. RLS POLICIES FOR exercises ──────────────────────────

-- Users can read their own exercises
CREATE POLICY "Users can view own exercises"
  ON public.exercises FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own exercises
CREATE POLICY "Users can insert own exercises"
  ON public.exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own exercises
CREATE POLICY "Users can update own exercises"
  ON public.exercises FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own exercises
CREATE POLICY "Users can delete own exercises"
  ON public.exercises FOR DELETE
  USING (auth.uid() = user_id);


-- ─── 5. RLS POLICIES FOR food_logs ──────────────────────────

-- Users can read their own food logs
CREATE POLICY "Users can view own food_logs"
  ON public.food_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own food logs
CREATE POLICY "Users can insert own food_logs"
  ON public.food_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own food logs
CREATE POLICY "Users can update own food_logs"
  ON public.food_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own food logs
CREATE POLICY "Users can delete own food_logs"
  ON public.food_logs FOR DELETE
  USING (auth.uid() = user_id);
