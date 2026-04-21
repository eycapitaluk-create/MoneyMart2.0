-- v_stock_latest: 同一 symbol・最新 trade_date の行が複数 source ある場合に
-- marketstack を優先（日本株などで別ソースの終値が混ざるとヤフー等と大きくズレるのを防ぐ）
-- Supabase SQL エディタで 1 回実行。

begin;

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
