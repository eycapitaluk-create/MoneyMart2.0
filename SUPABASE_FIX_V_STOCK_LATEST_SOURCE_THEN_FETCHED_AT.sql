-- v_stock_latest: 同一 symbol・最新 trade_date に複数 source があるとき、
-- 「fetched_at が新しい行が常に勝つ」だと、後から取り込んだ誤データ（例: yfinance の異常終値）
-- が marketstack より優先され、一覧の現在値・前日比が壊れる（BRK.B 等）。
-- まず source（marketstack > yfinance > その他）、次に fetched_at で決める。
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
  case
    when sdp.source = 'marketstack' then 0
    when sdp.source = 'yfinance' then 1
    else 2
  end,
  sdp.fetched_at desc nulls last;

grant select on public.v_stock_latest to anon, authenticated;

commit;
