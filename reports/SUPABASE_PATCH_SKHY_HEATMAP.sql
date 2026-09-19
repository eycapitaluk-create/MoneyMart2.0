-- SKHY (SK hynix Inc. ADS) — StockPage ヒートマップ用（発行済株式数）
-- ADS 比率: 1 ADS = 1/10 普通株式（SEC 424B4 / Nasdaq SKHY）
-- 普通株式 outstanding: 728,865,500（オファリング直後、SEC 424B4）
-- ヒートマップは close（USD/ADS）× shares で時価総額を出すため、
-- shares_outstanding は ADS 換算 = 728,865,500 × 10 = 7,288,655,000
-- market cap ≈ 7,288,655,000 × v_stock_latest.close（USD）

begin;

insert into public.stock_heatmap_profiles (
  symbol,
  asset_type,
  shares_outstanding,
  metadata_currency,
  market_cap_as_of,
  heatmap_priority,
  heatmap_enabled,
  source,
  notes
)
values (
  'SKHY',
  'STOCK',
  7288655000,
  'USD',
  '2026-07-10',
  5055,
  true,
  'sec_424b4_ads_ratio',
  'SK hynix ADS Nasdaq listing; shares = common_outstanding × 10 (1 ADS = 1/10 share)'
)
on conflict (symbol) do update
set asset_type = excluded.asset_type,
    shares_outstanding = excluded.shares_outstanding,
    metadata_currency = excluded.metadata_currency,
    market_cap_base = null,
    market_cap_base_currency = null,
    market_cap_as_of = excluded.market_cap_as_of,
    heatmap_priority = excluded.heatmap_priority,
    heatmap_enabled = excluded.heatmap_enabled,
    source = excluded.source,
    notes = excluded.notes,
    updated_at = now();

commit;
