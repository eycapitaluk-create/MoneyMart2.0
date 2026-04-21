-- 1625.T (NEXT FUNDS 電機・精密) 2026-03-04 日足 — 表データで補完
-- Supabase SQL エディタで 1 回実行（source=marketstack: JP チャート・Fund 履歴がこのソースを参照するため）
--
-- symbol: 1625.T
-- trade_date: 2026-03-04
-- open / high / low / close / volume はユーザー提供スクリーンショット値

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
  raw,
  fetched_at
)
values (
  'marketstack',
  '1625.T',
  '2026-03-04',
  51310,
  52270,
  50130,
  50130,
  1008,
  jsonb_build_object(
    'patched_from', 'manual_table',
    'patched_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ),
  now()
)
on conflict (source, symbol, trade_date) do update set
  open = excluded.open,
  high = excluded.high,
  low = excluded.low,
  close = excluded.close,
  volume = excluded.volume,
  raw = excluded.raw,
  fetched_at = excluded.fetched_at;

commit;

-- verify:
-- select symbol, trade_date, open, high, low, close, volume, source
-- from public.stock_daily_prices
-- where symbol = '1625.T' and trade_date = '2026-03-04';
