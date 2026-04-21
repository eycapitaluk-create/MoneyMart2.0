-- Add NISA flag for per-stock dividend tax calculation.
ALTER TABLE IF EXISTS user_dividend_watchlist
  ADD COLUMN IF NOT EXISTS is_nisa BOOLEAN NOT NULL DEFAULT false;

-- Helpful for optional analytics/filtering.
CREATE INDEX IF NOT EXISTS idx_dividend_watchlist_user_is_nisa
  ON user_dividend_watchlist(user_id, is_nisa);
