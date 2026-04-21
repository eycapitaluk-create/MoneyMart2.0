-- Fix Security Advisor warnings for SECURITY DEFINER views.
-- Recreate target views as SECURITY INVOKER so caller RLS is respected.
-- This script safely skips QUICK view recreation when QUICK tables do not exist.

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

do $$
begin
  if to_regclass('public.quick_fund_price_daily') is not null then
    execute $q$
      create or replace view public.v_quick_fund_latest_price
      with (security_invoker = true)
      as
      select distinct on (quickcode)
        quickcode,
        standard_date,
        price,
        net_asset_value,
        touraku_1d_per,
        touraku_1w_per,
        touraku_1m_per,
        touraku_1y_per
      from public.quick_fund_price_daily
      order by quickcode, standard_date desc
    $q$;

    execute 'grant select on public.v_quick_fund_latest_price to anon, authenticated';
  end if;
end $$;

commit;
