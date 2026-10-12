-- SPCX: Space Exploration Technologies Corp. (SpaceX) — StockPage US extra
-- Sector aligns with Industrials / Aerospace & Defense (BA, LMT, RTX bucket).

begin;

insert into public.stock_symbols (symbol, name, exchange, currency, is_active)
values ('SPCX', 'Space Exploration Technologies Corp.', 'NASDAQ', 'USD', true)
on conflict (symbol) do update
set name = excluded.name,
    exchange = excluded.exchange,
    currency = excluded.currency,
    is_active = true;

insert into public.stock_symbol_profiles (
  symbol, region, asset_type, sector, industry, name_en, name_jp, priority
)
values (
  'SPCX',
  'US',
  'stock',
  '資本財・産業',
  'Aerospace & Defense',
  'Space Exploration Technologies Corp.',
  'スペースX',
  5060
)
on conflict (symbol) do update
set region = excluded.region,
    asset_type = excluded.asset_type,
    sector = excluded.sector,
    industry = excluded.industry,
    name_en = excluded.name_en,
    name_jp = excluded.name_jp,
    priority = least(stock_symbol_profiles.priority, excluded.priority),
    updated_at = now();

-- Heatmap: verified market cap 2.105T USD (listing day 2026-06-12)
insert into public.stock_heatmap_profiles (
  symbol,
  asset_type,
  market_cap_base,
  market_cap_base_currency,
  market_cap_as_of,
  heatmap_priority,
  heatmap_enabled,
  source,
  notes
)
values (
  'SPCX',
  'STOCK',
  2105000000000,
  'USD',
  '2026-06-12',
  15,
  true,
  'manual_listing_day',
  'SpaceX listing day market cap 2.105T USD (user-provided)'
)
on conflict (symbol) do update
set asset_type = excluded.asset_type,
    market_cap_base = excluded.market_cap_base,
    market_cap_base_currency = excluded.market_cap_base_currency,
    market_cap_as_of = excluded.market_cap_as_of,
    heatmap_priority = excluded.heatmap_priority,
    heatmap_enabled = excluded.heatmap_enabled,
    source = excluded.source,
    notes = excluded.notes,
    updated_at = now();

commit;
