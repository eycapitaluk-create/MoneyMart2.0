-- Marketstack minimum schema fix
-- Safe to run multiple times.

begin;

-- 1) Cron query performance index
create index if not exists idx_ingestion_jobs_source_dataset_status_started_at
on public.ingestion_jobs (source, dataset, status, started_at desc);

-- 2) Ensure latest-price view exists and is RLS-safe (security_invoker)
create or replace view public.v_stock_latest
with (security_invoker = true)
as
with latest as (
  select symbol, max(trade_date) as trade_date
  from public.stock_daily_prices
  group by symbol
)
select distinct on (sdp.symbol)
  sdp.symbol,
  sdp.trade_date,
  sdp.open,
  sdp.high,
  sdp.low,
  sdp.close,
  sdp.volume,
  sdp.fetched_at
from public.stock_daily_prices sdp
inner join latest l on sdp.symbol = l.symbol and sdp.trade_date = l.trade_date
order by
  sdp.symbol,
  sdp.fetched_at desc nulls last,
  case
    when sdp.source = 'marketstack' then 0
    when sdp.source = 'yfinance' then 1
    else 2
  end;

grant select on public.v_stock_latest to anon, authenticated;

commit;

