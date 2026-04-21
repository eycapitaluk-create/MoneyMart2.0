-- Add asset_type to portfolios for fund vs stock support
-- Run after SUPABASE_SETUP_PORTFOLIO.sql

alter table public.portfolios
  add column if not exists asset_type text not null default 'fund' check (asset_type in ('fund', 'stock'));

comment on column public.portfolios.asset_type is 'fund: allocations use {id,name,weightPct}; stock: allocations use {symbol,name,weightPct}';
