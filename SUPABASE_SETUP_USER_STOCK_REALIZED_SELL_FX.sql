-- 개인 매도 기록에 적용 환율을 남긴다.
-- Supabase SQL Editor 에서 실행. 기존 행은 NULL 그대로 둔다.

alter table public.user_stock_realized_trades
  add column if not exists sell_fx_rate numeric(12,4),
  add column if not exists sell_fx_date date;

comment on column public.user_stock_realized_trades.sell_fx_rate is
  'USD 매도 시 적용한 USD/JPY. JPY 종목과 기존 행은 NULL.';
comment on column public.user_stock_realized_trades.sell_fx_date is
  'sell_fx_rate 의 기준일 (fx_daily_usdjpy.as_of_date). 휴일이면 직전 영업일.';
