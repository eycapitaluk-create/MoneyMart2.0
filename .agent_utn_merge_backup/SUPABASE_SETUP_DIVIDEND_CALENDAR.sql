-- ================================================================
-- 配当カレンダー: user_dividend_watchlist
-- idempotent version (safe to re-run)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.user_dividend_watchlist (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id      TEXT        NOT NULL,
  stock_name    TEXT        NOT NULL,
  flag          TEXT        DEFAULT '🏳️',
  sector        TEXT        DEFAULT '',
  color         TEXT        DEFAULT '#6b7280',
  price         NUMERIC     DEFAULT 0,
  qty           INTEGER     NOT NULL DEFAULT 10 CHECK (qty > 0),
  dividends     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  notes         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, stock_id)
);

ALTER TABLE public.user_dividend_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can select own dividend watchlist" ON public.user_dividend_watchlist;
DROP POLICY IF EXISTS "users can insert own dividend watchlist" ON public.user_dividend_watchlist;
DROP POLICY IF EXISTS "users can update own dividend watchlist" ON public.user_dividend_watchlist;
DROP POLICY IF EXISTS "users can delete own dividend watchlist" ON public.user_dividend_watchlist;

CREATE POLICY "users can select own dividend watchlist"
  ON public.user_dividend_watchlist
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own dividend watchlist"
  ON public.user_dividend_watchlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own dividend watchlist"
  ON public.user_dividend_watchlist
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own dividend watchlist"
  ON public.user_dividend_watchlist
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_dividend_watchlist_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dividend_watchlist_updated_at ON public.user_dividend_watchlist;
CREATE TRIGGER trg_dividend_watchlist_updated_at
BEFORE UPDATE ON public.user_dividend_watchlist
FOR EACH ROW
EXECUTE FUNCTION public.update_dividend_watchlist_updated_at();

CREATE INDEX IF NOT EXISTS idx_dividend_watchlist_user
  ON public.user_dividend_watchlist(user_id);
