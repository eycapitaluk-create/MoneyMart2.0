-- 1479.T (ｉＦｒｅｅＥＴＦ MSCI日本株人材設備 等) 2026-03-23 日足 — ユーザー指定終値のみ
-- Supabase SQL エディタで 1 回実行（source=marketstack: JP チャート・Fund 履歴参照と揃える）
--
-- symbol: 1479.T
-- trade_date: 2026-03-23
-- close: 45730（ユーザー提供）。寄り付き〜値幅は未提供のため open/high/low も終値と同値に置く。
-- volume: null（未提供）

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
  '1479.T',
  '2026-03-23',
  45730,
  45730,
  45730,
  45730,
  null,
  jsonb_build_object(
    'patched_from', 'manual_close_only',
    'user_close_jpy', 45730,
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
-- where symbol = '1479.T' and trade_date = '2026-03-23';
