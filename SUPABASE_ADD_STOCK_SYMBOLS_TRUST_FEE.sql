-- Add ETF trust fee column to stock master.
-- Run in Supabase SQL Editor.

alter table public.stock_symbols
add column if not exists trust_fee numeric(8,6);

comment on column public.stock_symbols.trust_fee
is 'ETF trust fee ratio (annual %, e.g. 0.0938 for 0.0938%).';

create index if not exists idx_stock_symbols_trust_fee
  on public.stock_symbols (trust_fee);

