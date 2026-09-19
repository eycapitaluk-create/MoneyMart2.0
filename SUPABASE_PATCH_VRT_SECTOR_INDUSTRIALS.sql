-- Vertiv Holdings (VRT): store GICS sector as Industrials (English canonical).
-- UI maps via normalizeSectorName → 資本財・産業.
-- Run in Supabase SQL Editor (or psql) against production.

update public.stock_symbol_profiles
set
  sector = 'Industrials',
  updated_at = now()
where symbol = 'VRT';
