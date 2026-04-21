-- Add columns needed for stock-only index universe filtering on StockPage.
-- Run in Supabase SQL Editor (safe with IF NOT EXISTS).

alter table public.stock_symbol_profiles
  add column if not exists asset_type text not null default 'stock';

alter table public.stock_symbol_profiles
  add column if not exists index_tag text;

alter table public.stock_symbol_profiles
  add column if not exists market_cap numeric(20,2);

do $$
begin
  alter table public.stock_symbol_profiles
    add constraint stock_symbol_profiles_asset_type_chk
    check (asset_type in ('stock', 'etf'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_stock_symbol_profiles_index_cap
  on public.stock_symbol_profiles(region, asset_type, index_tag, market_cap desc nulls last, priority);

comment on column public.stock_symbol_profiles.asset_type is 'stock or etf';
comment on column public.stock_symbol_profiles.index_tag is 'US: SP500/NASDAQ100, JP: NIKKEI225, UK: FTSE100, EU: EUROSTOXX';
comment on column public.stock_symbol_profiles.market_cap is 'Latest market cap (same currency unit source), used for ranking';

