-- MoneyMart 2.0 - Supabase schema for:
-- 1) Daily stock ingestion from marketstack
-- 2) Fund ingestion from QUICK file feeds
-- 3) Manual product management (no affiliate API)
--
-- Run in Supabase SQL Editor once.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Access control helper
-- ------------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'viewer')) default 'viewer',
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_self_read" on public.user_roles;
create policy "user_roles_self_read"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Manual product catalog (cards/loans/savings/insurance)
-- ------------------------------------------------------------
create table if not exists public.products (
  id bigserial primary key,
  category text,
  name text not null,
  provider text,
  link text,
  description text,
  spec text, -- keep compatible with current AdminPage form
  image_url text,
  badge text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_active on public.products(is_active);

alter table public.products enable row level security;

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read"
on public.products
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write"
on public.products
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

-- ------------------------------------------------------------
-- marketstack daily stock data
-- ------------------------------------------------------------
create table if not exists public.stock_symbols (
  symbol text primary key,           -- e.g. AAPL, 7203.TYO
  name text,
  exchange text,
  currency text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_daily_prices (
  id bigserial primary key,
  source text not null default 'marketstack',
  symbol text not null references public.stock_symbols(symbol) on update cascade on delete restrict,
  trade_date date not null,
  open numeric(18,6),
  high numeric(18,6),
  low numeric(18,6),
  close numeric(18,6),
  volume bigint,
  raw jsonb,                         -- full API payload (optional)
  fetched_at timestamptz not null default now(),
  unique (source, symbol, trade_date)
);

create index if not exists idx_stock_daily_symbol_date on public.stock_daily_prices(symbol, trade_date desc);
create index if not exists idx_stock_daily_date on public.stock_daily_prices(trade_date desc);

alter table public.stock_symbols enable row level security;
alter table public.stock_daily_prices enable row level security;

drop policy if exists "stock_symbols_public_read" on public.stock_symbols;
create policy "stock_symbols_public_read"
on public.stock_symbols
for select
to anon, authenticated
using (true);

drop policy if exists "stock_daily_public_read" on public.stock_daily_prices;
create policy "stock_daily_public_read"
on public.stock_daily_prices
for select
to anon, authenticated
using (true);

-- ------------------------------------------------------------
-- QUICK fund data model (TSV ingestion)
-- ------------------------------------------------------------
create table if not exists public.quick_fund_master (
  quickcode text not null,
  standard_date date not null,
  isin_code text,
  fund_code text,
  fund_short_name text,
  official_fund_name text,
  start_date date,
  redemption_flag text,
  net_trustfee numeric(18,6),
  min_investment text,
  benchmark_name text,
  raw jsonb,
  created_at timestamptz not null default now(),
  primary key (quickcode, standard_date)
);

create table if not exists public.quick_fund_price_daily (
  quickcode text not null,
  standard_date date not null,
  price numeric(18,6),
  net_asset_value numeric(18,6),
  surrender_price numeric(18,6),
  touraku_1d_per numeric(18,6),
  touraku_1w_per numeric(18,6),
  touraku_1m_per numeric(18,6),
  touraku_1y_per numeric(18,6),
  raw jsonb,
  created_at timestamptz not null default now(),
  primary key (quickcode, standard_date),
  foreign key (quickcode, standard_date)
    references public.quick_fund_master(quickcode, standard_date)
    on update cascade
    on delete cascade
);

create table if not exists public.quick_fund_asset_composition (
  id bigserial primary key,
  quickcode text not null,
  standard_date date not null,
  allocation_code text,              -- AST/CUN/CUR
  rank integer,
  asset_code text,
  title text,
  percentage numeric(18,6),
  new_fund_flag text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quick_asset_comp_qs on public.quick_fund_asset_composition(quickcode, standard_date);

create table if not exists public.quick_fund_holdings (
  id bigserial primary key,
  quickcode text not null,
  standard_date date not null,
  rank integer,
  title text,
  ratio numeric(18,6),
  syubetsu_code text,
  category text,
  area_nation text,
  currency text,
  percentage numeric(18,6),
  bond_rating text,
  code text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quick_holdings_qs on public.quick_fund_holdings(quickcode, standard_date);

create table if not exists public.quick_fund_property (
  id bigserial primary key,
  quickcode text not null,
  standard_date date not null,
  property_code text not null,
  value text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quick_property_qs on public.quick_fund_property(quickcode, standard_date);
create index if not exists idx_quick_property_code on public.quick_fund_property(property_code);

create table if not exists public.quick_fundcode_master (
  id bigserial primary key,
  code_no1 text not null,
  code_no1_name text,
  code_no2 text not null,
  code_no2_name text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique(code_no1, code_no2)
);

alter table public.quick_fund_master enable row level security;
alter table public.quick_fund_price_daily enable row level security;
alter table public.quick_fund_asset_composition enable row level security;
alter table public.quick_fund_holdings enable row level security;
alter table public.quick_fund_property enable row level security;
alter table public.quick_fundcode_master enable row level security;

drop policy if exists "quick_master_public_read" on public.quick_fund_master;
create policy "quick_master_public_read"
on public.quick_fund_master
for select
to anon, authenticated
using (true);

drop policy if exists "quick_price_public_read" on public.quick_fund_price_daily;
create policy "quick_price_public_read"
on public.quick_fund_price_daily
for select
to anon, authenticated
using (true);

drop policy if exists "quick_asset_public_read" on public.quick_fund_asset_composition;
create policy "quick_asset_public_read"
on public.quick_fund_asset_composition
for select
to anon, authenticated
using (true);

drop policy if exists "quick_holdings_public_read" on public.quick_fund_holdings;
create policy "quick_holdings_public_read"
on public.quick_fund_holdings
for select
to anon, authenticated
using (true);

drop policy if exists "quick_property_public_read" on public.quick_fund_property;
create policy "quick_property_public_read"
on public.quick_fund_property
for select
to anon, authenticated
using (true);

drop policy if exists "quick_code_master_public_read" on public.quick_fundcode_master;
create policy "quick_code_master_public_read"
on public.quick_fundcode_master
for select
to anon, authenticated
using (true);

-- ------------------------------------------------------------
-- Ingestion logs (batch runs)
-- ------------------------------------------------------------
create table if not exists public.ingestion_jobs (
  id bigserial primary key,
  source text not null,              -- marketstack / quick
  dataset text not null,             -- e.g. stock_daily_prices / FUND_MASTER
  status text not null check (status in ('started','success','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_processed integer,
  error_message text,
  meta jsonb
);

alter table public.ingestion_jobs enable row level security;

drop policy if exists "ingestion_jobs_admin_read" on public.ingestion_jobs;
create policy "ingestion_jobs_admin_read"
on public.ingestion_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'editor')
  )
);

-- ------------------------------------------------------------
-- Convenience views
-- ------------------------------------------------------------
create or replace view public.v_stock_latest as
select distinct on (symbol)
  symbol,
  trade_date,
  open,
  high,
  low,
  close,
  volume,
  fetched_at
from public.stock_daily_prices
order by symbol, trade_date desc;

create or replace view public.v_quick_fund_latest_price as
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
order by quickcode, standard_date desc;
