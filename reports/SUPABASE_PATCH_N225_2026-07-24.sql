-- Fix ^N225 2026-07-24: index_prices xlsx duplicated 7/23 OHLC (66422.60).
-- Correct per Kabushiki / Nikkei / Jiji (2026-07-24): close 64611.15 (-1811.45 vs 7/23).
INSERT INTO stock_daily_prices (
  source, symbol, trade_date, open, high, low, close, volume, fetched_at, raw
) VALUES (
  'manual_close',
  '^N225',
  '2026-07-24',
  65584.25,
  65720.81,
  64201.03,
  64611.15,
  1922930000,
  NOW(),
  '{"corrected_from":"index_prices_2026-07-24.xlsx","correction_reason":"xlsx duplicated 7/23 OHLC"}'::jsonb
)
ON CONFLICT (source, symbol, trade_date) DO UPDATE SET
  open = EXCLUDED.open,
  high = EXCLUDED.high,
  low = EXCLUDED.low,
  close = EXCLUDED.close,
  volume = EXCLUDED.volume,
  fetched_at = EXCLUDED.fetched_at,
  raw = EXCLUDED.raw;
