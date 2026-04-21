-- 1306.T アクメ분할(1→10 想定): 指定期間の四本値を 1/10、出来高を 10 倍にスケール調整
-- 期間: 2025-02-18 ～ 2026-03-27（trade_date 含む）
-- Supabase SQL Editor で実行（Table Editor より一括 UPDATE が安全）
-- ※ 二重実行しないこと（さらに 1/10 になる）

-- 事前確認例:
-- select source, trade_date, open, high, low, close, volume
-- from public.stock_daily_prices
-- where symbol = '1306.T' and trade_date between '2025-02-18' and '2026-03-27'
-- order by trade_date desc limit 5;

BEGIN;

UPDATE public.stock_daily_prices
SET
  open = CASE WHEN open IS NOT NULL THEN round((open * 0.1)::numeric, 6) END,
  high = CASE WHEN high IS NOT NULL THEN round((high * 0.1)::numeric, 6) END,
  low = CASE WHEN low IS NOT NULL THEN round((low * 0.1)::numeric, 6) END,
  close = CASE WHEN close IS NOT NULL THEN round((close * 0.1)::numeric, 6) END,
  volume = CASE WHEN volume IS NOT NULL THEN round(volume::numeric * 10)::bigint END,
  fetched_at = now()
WHERE symbol = '1306.T'
  AND trade_date >= DATE '2025-02-18'
  AND trade_date <= DATE '2026-03-27';

-- 影響行確認（実行前に SELECT で件数を見たい場合はトランザクション外で）
-- SELECT count(*) FROM public.stock_daily_prices
-- WHERE symbol = '1306.T' AND trade_date >= '2025-02-18' AND trade_date <= '2026-03-27';

COMMIT;
