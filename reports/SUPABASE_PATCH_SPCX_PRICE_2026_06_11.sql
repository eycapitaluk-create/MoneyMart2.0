-- SPCX IPO offering price (2026-06-11 close = USD 135)
-- Run in Supabase SQL Editor. Requires stock_symbols row for SPCX.

begin;

insert into public.stock_daily_prices (
  source,
  symbol,
  trade_date,
  open,
  high,
  low,
  close,
  volume,
  fetched_at,
  raw
)
values (
  'manual_close',
  'SPCX',
  '2026-06-11',
  135,
  135,
  135,
  135,
  null,
  now(),
  '{"note":"IPO offering price (user-provided)","imported_from":"SUPABASE_PATCH_SPCX_PRICE_2026_06_11.sql"}'::jsonb
)
on conflict (source, symbol, trade_date) do update
set open = excluded.open,
    high = excluded.high,
    low = excluded.low,
    close = excluded.close,
    fetched_at = excluded.fetched_at,
    raw = excluded.raw;

commit;
