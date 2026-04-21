-- MarketStack v2 commodities data (Professional+ plan)
-- Run once. Cron api/cron/marketstack-commodities.js upserts daily.

create table if not exists public.commodity_daily_prices (
  id bigserial primary key,
  commodity_name text not null,
  trade_date date not null,
  price numeric(18,6),
  price_change_day numeric(18,6),
  percentage_day numeric(10,4),
  percentage_week numeric(10,4),
  percentage_month numeric(10,4),
  percentage_year numeric(10,4),
  commodity_unit text,
  raw jsonb,
  fetched_at timestamptz not null default now(),
  unique (commodity_name, trade_date)
);

create index if not exists idx_commodity_daily_name_date on public.commodity_daily_prices(commodity_name, trade_date desc);
create index if not exists idx_commodity_daily_date on public.commodity_daily_prices(trade_date desc);

alter table public.commodity_daily_prices enable row level security;

drop policy if exists "commodity_daily_public_read" on public.commodity_daily_prices;
create policy "commodity_daily_public_read"
on public.commodity_daily_prices
for select
to anon, authenticated
using (true);
