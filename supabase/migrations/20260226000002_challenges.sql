-- ============================================================
-- Migration: Challenges, leaderboards, accountability partners
--
-- Tables for the challenge/compete system including
-- challenge definitions, participant tracking, accountability
-- partnerships, and materialized leaderboard entries.
-- ============================================================

-- ─── CHALLENGES ──────────────────────────────────────────
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  challenge_type text NOT NULL,            -- 'workout_count' | 'calorie_burn' | 'streak' | 'specific_workout'
  target_value integer NOT NULL,           -- e.g., 5 workouts, 2000 calories
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status text DEFAULT 'active',            -- 'pending' | 'active' | 'completed' | 'cancelled'
  is_public boolean DEFAULT false,
  max_participants integer DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_challenges_status ON public.challenges(status, start_date);
CREATE INDEX idx_challenges_creator ON public.challenges(creator_id);

-- Note: SELECT policy for challenges is created AFTER challenge_participants table
-- since it references that table in a subquery.

CREATE POLICY "Users can create challenges"
  ON public.challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update challenges"
  ON public.challenges FOR UPDATE
  USING (auth.uid() = creator_id);


-- ─── CHALLENGE PARTICIPANTS ──────────────────────────────
CREATE TABLE public.challenge_participants (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress integer DEFAULT 0,
  status text DEFAULT 'active',            -- 'active' | 'completed' | 'withdrew'
  joined_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (challenge_id, user_id)
);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_challenge_participants_user ON public.challenge_participants(user_id);

CREATE POLICY "Anyone can view challenge participants"
  ON public.challenge_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join challenges"
  ON public.challenge_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.challenge_participants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave challenges"
  ON public.challenge_participants FOR DELETE
  USING (auth.uid() = user_id);

-- Now that challenge_participants exists, create the SELECT policy on challenges
CREATE POLICY "Anyone can view public challenges"
  ON public.challenges FOR SELECT
  USING (
    is_public = true
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.challenge_participants
      WHERE challenge_id = challenges.id AND user_id = auth.uid()
    )
  );


-- ─── ACCOUNTABILITY PARTNERS ─────────────────────────────
CREATE TABLE public.accountability_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',           -- 'pending' | 'active' | 'ended'
  shared_streak integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_a, user_b),
  CHECK (user_a != user_b)
);

ALTER TABLE public.accountability_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their partnerships"
  ON public.accountability_partners FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can request partnerships"
  ON public.accountability_partners FOR INSERT
  WITH CHECK (auth.uid() = user_a);

CREATE POLICY "Partners can update status"
  ON public.accountability_partners FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Partners can delete partnership"
  ON public.accountability_partners FOR DELETE
  USING (auth.uid() = user_a OR auth.uid() = user_b);


-- ─── LEADERBOARD ENTRIES (materialized) ──────────────────
CREATE TABLE public.leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period text NOT NULL,                    -- 'weekly' | 'monthly' | 'all_time'
  period_start date NOT NULL,
  workout_count integer DEFAULT 0,
  total_calories integer DEFAULT 0,
  total_volume numeric DEFAULT 0,
  streak integer DEFAULT 0,
  rank integer,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_leaderboard_unique ON public.leaderboard_entries(user_id, period, period_start);
CREATE INDEX idx_leaderboard_period ON public.leaderboard_entries(period, period_start, rank);

CREATE POLICY "Anyone can view leaderboard"
  ON public.leaderboard_entries FOR SELECT USING (true);

-- Leaderboard writes handled by edge function with service role
CREATE POLICY "Authenticated users can upsert leaderboard"
  ON public.leaderboard_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own leaderboard"
  ON public.leaderboard_entries FOR UPDATE
  USING (auth.uid() = user_id);
