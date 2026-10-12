-- 個人マイページ保有株: 入力通貨と買付日の USD/JPY を行に固定する。
-- 列名は iOS ハンドオフと同じ currency / buy_fx_rate / buy_fx_date。
-- 既存行は null のまま。確認が必要な 6 行には自動で入れない。

alter table public.user_owned_stocks
  add column if not exists currency text,
  add column if not exists buy_fx_rate numeric,
  add column if not exists buy_fx_date date;

alter table public.user_owned_stocks
  drop constraint if exists user_owned_stocks_currency_check;
alter table public.user_owned_stocks
  add constraint user_owned_stocks_currency_check
  check (currency is null or currency in ('JPY', 'USD'));

alter table public.user_owned_stocks
  drop constraint if exists user_owned_stocks_buy_fx_rate_check;
alter table public.user_owned_stocks
  add constraint user_owned_stocks_buy_fx_rate_check
  check (buy_fx_rate is null or buy_fx_rate > 0);

comment on column public.user_owned_stocks.currency is '入力した buy_price の単位。上場通貨ではない。未確認行は null。';
comment on column public.user_owned_stocks.buy_fx_rate is 'buy_fx_date の USD/JPY。JPY 入力は 1。未確定は null。';
comment on column public.user_owned_stocks.buy_fx_date is '実際に使った為替の基準日。休日前なら直前営業日。';
