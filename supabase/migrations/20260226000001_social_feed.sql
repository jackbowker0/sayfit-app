-- ============================================================
-- Migration: Social feed tables
--
-- Tables for the in-app social feed: follows, feed_posts,
-- likes, and comments. Includes RLS policies and triggers
-- to maintain denormalized counts.
-- ============================================================

-- ─── FOLLOWS ─────────────────────────────────────────────
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

CREATE POLICY "Anyone can view follows"
  ON public.follows FOR SELECT USING (true);

CREATE POLICY "Users can follow"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);


-- ─── FEED POSTS ─────────────────────────────────────────
CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_type text NOT NULL,              -- 'guided' | 'logged'
  workout_name text,
  coach_id text,
  duration_seconds integer DEFAULT 0,
  calories integer DEFAULT 0,
  exercises_completed integer DEFAULT 0,
  muscles text[] DEFAULT '{}',
  total_sets integer DEFAULT 0,
  total_volume numeric DEFAULT 0,
  new_prs jsonb DEFAULT '[]',
  share_card_template text DEFAULT 'classic',
  share_card_image_url text,
  caption text,
  coach_quote text,
  streak integer DEFAULT 0,
  visibility text DEFAULT 'public',        -- 'public' | 'followers' | 'private'
  like_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_feed_posts_user ON public.feed_posts(user_id);
CREATE INDEX idx_feed_posts_created ON public.feed_posts(created_at DESC);

CREATE POLICY "Users can view feed posts based on visibility"
  ON public.feed_posts FOR SELECT
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR (visibility = 'followers' AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = feed_posts.user_id
    ))
  );

CREATE POLICY "Users can insert own posts"
  ON public.feed_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON public.feed_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON public.feed_posts FOR DELETE
  USING (auth.uid() = user_id);


-- ─── LIKES ──────────────────────────────────────────────
CREATE TABLE public.likes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_likes_post ON public.likes(post_id);

CREATE POLICY "Anyone can view likes"
  ON public.likes FOR SELECT USING (true);

CREATE POLICY "Users can like"
  ON public.likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
  ON public.likes FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to maintain like_count on feed_posts
CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION update_like_count();


-- ─── COMMENTS ───────────────────────────────────────────
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 500),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_comments_post ON public.comments(post_id, created_at);

CREATE POLICY "Anyone can view comments on visible posts"
  ON public.comments FOR SELECT USING (true);

CREATE POLICY "Users can comment"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to maintain comment_count
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();
