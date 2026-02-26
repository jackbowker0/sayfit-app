-- ============================================================
-- Migration: Moderation tables — blocks, mutes, reports
--
-- Enables block/mute functionality and content reporting.
-- Also adds push_token column to profiles for notifications.
-- ============================================================

-- ─── PUSH TOKEN ON PROFILES ─────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;

-- ─── BLOCKS ──────────────────────────────────────────────
CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON public.blocks(blocked_id);

CREATE POLICY "Users can view own blocks"
  ON public.blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block"
  ON public.blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
  ON public.blocks FOR DELETE
  USING (auth.uid() = blocker_id);


-- ─── MUTES ───────────────────────────────────────────────
CREATE TABLE public.mutes (
  muter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CHECK (muter_id != muted_id)
);

ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mutes_muter ON public.mutes(muter_id);

CREATE POLICY "Users can view own mutes"
  ON public.mutes FOR SELECT
  USING (auth.uid() = muter_id);

CREATE POLICY "Users can mute"
  ON public.mutes FOR INSERT
  WITH CHECK (auth.uid() = muter_id);

CREATE POLICY "Users can unmute"
  ON public.mutes FOR DELETE
  USING (auth.uid() = muter_id);


-- ─── REPORTS ──────────────────────────────────────────────
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_post_id uuid REFERENCES public.feed_posts(id) ON DELETE SET NULL,
  reported_comment_id uuid REFERENCES public.comments(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
  details text CHECK (char_length(details) <= 500),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX idx_reports_status ON public.reports(status);

CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);
