-- ================================================================
--  配当カレンダー: ユーザーごとのウォッチリスト＆保有株数管理
--  Run this in Supabase SQL Editor (as project owner)
-- ================================================================

-- ── テーブル ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_dividend_watchlist (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id      TEXT        NOT NULL,   -- e.g. "8306", "KO"
  stock_name    TEXT        NOT NULL,
  flag          TEXT        DEFAULT '🏳️',
  sector        TEXT        DEFAULT '',
  color         TEXT        DEFAULT '#6b7280',
  price         NUMERIC     DEFAULT 0,
  qty           INTEGER     NOT NULL DEFAULT 10,
  is_nisa       BOOLEAN     NOT NULL DEFAULT false,
  -- 配当データ (JSON array: [{month, amount}, ...])
  dividends     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  notes         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stock_id)
);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE user_dividend_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can select own dividend watchlist"
  ON user_dividend_watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own dividend watchlist"
  ON user_dividend_watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own dividend watchlist"
  ON user_dividend_watchlist FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users can delete own dividend watchlist"
  ON user_dividend_watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- ── 更新日時の自動更新 ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_dividend_watchlist_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dividend_watchlist_updated_at
  BEFORE UPDATE ON user_dividend_watchlist
  FOR EACH ROW EXECUTE FUNCTION update_dividend_watchlist_updated_at();

-- ── インデックス ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dividend_watchlist_user
  ON user_dividend_watchlist(user_id);
