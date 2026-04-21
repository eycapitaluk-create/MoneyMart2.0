-- Stock symbol profile table for manual country/sector curation
-- Run once in Supabase SQL Editor.

create table if not exists public.stock_symbol_profiles (
  symbol text primary key references public.stock_symbols(symbol) on update cascade on delete cascade,
  region text check (region in ('US', 'JP', 'UK', 'EU')),
  asset_type text not null default 'stock' check (asset_type in ('stock', 'etf')),
  index_tag text,
  market_cap numeric(20,2),
  sector text,
  industry text,
  priority integer not null default 9999,
  updated_at timestamptz not null default now()
);

create index if not exists idx_stock_symbol_profiles_region_sector
  on public.stock_symbol_profiles(region, sector, priority);
create index if not exists idx_stock_symbol_profiles_index_cap
  on public.stock_symbol_profiles(region, asset_type, index_tag, market_cap desc nulls last, priority);

alter table public.stock_symbol_profiles enable row level security;

drop policy if exists "stock_symbol_profiles_public_read" on public.stock_symbol_profiles;
create policy "stock_symbol_profiles_public_read"
on public.stock_symbol_profiles
for select
to anon, authenticated
using (true);

drop policy if exists "stock_symbol_profiles_admin_write" on public.stock_symbol_profiles;
create policy "stock_symbol_profiles_admin_write"
on public.stock_symbol_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'editor')
  )
);

-- Optional seed examples:
-- insert into public.stock_symbol_profiles(symbol, region, sector, industry, priority)
-- values
--   ('AAPL', 'US', 'Technology', 'Consumer Electronics', 10),
--   ('7203.T', 'JP', 'Automobiles', 'Auto Manufacturers', 10),
--   ('HSBA.L', 'UK', 'Financials', 'Banks', 10),
--   ('ASML.AS', 'EU', 'Technology', 'Semiconductor Equipment', 10)
-- on conflict (symbol) do update
-- set region = excluded.region,
--     sector = excluded.sector,
--     industry = excluded.industry,
--     priority = excluded.priority,
--     updated_at = now();
