-- ================================================================
-- 配当カレンダー: user_dividend_watchlist.qty を小数保有に対応
-- 既存プロジェクトで SUPABASE_SETUP_DIVIDEND_CALENDAR.sql 適用済みの場合、
-- Supabase SQL Editor でこの ALTER のみ実行してください。
-- ================================================================

ALTER TABLE user_dividend_watchlist
  ALTER COLUMN qty TYPE NUMERIC(18, 6)
  USING ROUND(qty::numeric, 6);
