-- Fix ^N225 2026-07-23: index_prices xlsx duplicated 7/22 OHLC.
-- Correct per Jiji / Nikkei / Sankei (2026-07-23): close 66422.60 (+307 vs 7/22).
INSERT INTO stock_daily_prices (
  source, symbol, trade_date, open, high, low, close, volume, fetched_at, raw
) VALUES (
  'manual_close',
  '^N225',
  '2026-07-23',
  66421.01,
  67022.37,
  66208.66,
  66422.60,
  1913530000,
  NOW(),
  '{"corrected_from":"index_prices_2026-07-23.xlsx","correction_reason":"xlsx duplicated 7/22 OHLC"}'::jsonb
)
ON CONFLICT (source, symbol, trade_date) DO UPDATE SET
  open = EXCLUDED.open,
  high = EXCLUDED.high,
  low = EXCLUDED.low,
  close = EXCLUDED.close,
  volume = EXCLUDED.volume,
  fetched_at = EXCLUDED.fetched_at,
  raw = EXCLUDED.raw;
