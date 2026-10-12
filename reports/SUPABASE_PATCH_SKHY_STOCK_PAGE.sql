-- SKHY: SK hynix Inc. ADS (Nasdaq) — US StockPage + Semiconductors
-- Each ADS = 1/10 common share (KRX:000660). Dividend months from recent KR pay dates.

begin;

insert into public.stock_symbols (symbol, name, exchange, currency, is_active)
values ('SKHY', 'SK hynix Inc.', 'NASDAQ', 'USD', true)
on conflict (symbol) do update
set name = excluded.name,
    exchange = excluded.exchange,
    currency = excluded.currency,
    is_active = true;

insert into public.stock_symbol_profiles (
  symbol, region, asset_type, sector, industry, name_en, name_jp, priority
)
values (
  'SKHY',
  'US',
  'stock',
  'テクノロジー',
  'Semiconductors',
  'SK hynix Inc.',
  'SKハイニックス',
  5055
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

-- Payment months: Feb / May / Aug / Nov — USD 0.250729 per ADS
insert into public.dividend_master_schedule (stock_id, asset_kind, dividend_month, calendar_year, name_hint, notes)
values
  ('SKHY', 'us_stock', 2, null, 'SK hynix Inc. (ADS)', 'USD 0.250729 / ADS'),
  ('SKHY', 'us_stock', 5, null, 'SK hynix Inc. (ADS)', 'USD 0.250729 / ADS'),
  ('SKHY', 'us_stock', 8, null, 'SK hynix Inc. (ADS)', 'USD 0.250729 / ADS'),
  ('SKHY', 'us_stock', 11, null, 'SK hynix Inc. (ADS)', 'USD 0.250729 / ADS')
on conflict do nothing;

-- Heatmap: ADS-equivalent shares (common 728,865,500 × 10). See SUPABASE_PATCH_SKHY_HEATMAP.sql
insert into public.stock_heatmap_profiles (
  symbol, asset_type, shares_outstanding, metadata_currency, market_cap_as_of,
  heatmap_priority, heatmap_enabled, source, notes
)
values (
  'SKHY', 'STOCK', 7288655000, 'USD', '2026-07-10', 5055, true,
  'sec_424b4_ads_ratio',
  'SK hynix ADS; shares = common_outstanding × 10 (1 ADS = 1/10 share)'
)
on conflict (symbol) do update
set asset_type = excluded.asset_type,
    shares_outstanding = excluded.shares_outstanding,
    metadata_currency = excluded.metadata_currency,
    market_cap_base = null,
    market_cap_base_currency = null,
    market_cap_as_of = excluded.market_cap_as_of,
    heatmap_priority = excluded.heatmap_priority,
    heatmap_enabled = true,
    source = excluded.source,
    notes = excluded.notes,
    updated_at = now();

commit;
