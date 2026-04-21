-- 1306.T / 1629.T の DB を「今日入れた変更」以前に近づけるための候補作業
-- Supabase SQL Editor で、該当するブロックだけ実行すること。
-- バックアップ・件数確認は必ず先に行う。

-- =============================================================================
-- A) 今日（手動 xlsx）で入れた 2026-03-10 / jp_etf_csv を 2銘柄だけ消す
--    ※同じ日に marketstack 等がある銘柄は、その行は残る。
-- =============================================================================

-- 確認（任意）:
-- SELECT source, trade_date, open, close, volume
-- FROM public.stock_daily_prices
-- WHERE symbol IN ('1306.T', '1629.T') AND trade_date = DATE '2026-03-10'
-- ORDER BY symbol, source;

BEGIN;

DELETE FROM public.stock_daily_prices
WHERE symbol IN ('1306.T', '1629.T')
  AND source = 'jp_etf_csv'
  AND trade_date = DATE '2026-03-10';

COMMIT;

-- =============================================================================
-- B) 1306.T に SUPABASE_ADJUST_1306_T_PRICE_SPLIT_SCALE.sql を実行済みなら
--    その UPDATE の逆（四本 ×10、出来高 ÷10）。二重実行しないこと。
-- =============================================================================
-- 事前確認:
-- SELECT trade_date, open, close, volume
-- FROM public.stock_daily_prices
-- WHERE symbol = '1306.T' AND trade_date BETWEEN DATE '2025-02-18' AND DATE '2026-03-27'
-- ORDER BY trade_date DESC LIMIT 5;

-- BEGIN;
-- UPDATE public.stock_daily_prices
-- SET
--   open = CASE WHEN open IS NOT NULL THEN round((open * 10)::numeric, 6) END,
--   high = CASE WHEN high IS NOT NULL THEN round((high * 10)::numeric, 6) END,
--   low = CASE WHEN low IS NOT NULL THEN round((low * 10)::numeric, 6) END,
--   close = CASE WHEN close IS NOT NULL THEN round((close * 10)::numeric, 6) END,
--   volume = CASE WHEN volume IS NOT NULL THEN round((volume::numeric / 10))::bigint END,
--   fetched_at = now()
-- WHERE symbol = '1306.T'
--   AND trade_date >= DATE '2025-02-18'
--   AND trade_date <= DATE '2026-03-27';
-- COMMIT;

-- =============================================================================
-- C) 1629.T で Numbers/xlsx パッチや手動 UPDATE をした場合
--    → 変更前の行の値が分からないと完全復元は不可。Point-in-time バックアップや
--      実行前の SELECT 結果があれば、それに手で戻す。
-- =============================================================================
