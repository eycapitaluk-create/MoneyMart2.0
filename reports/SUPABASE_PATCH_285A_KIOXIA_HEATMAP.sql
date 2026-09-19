-- 285A.T キオクシア — StockPage ヒートマップ用（発行済株式数）
-- IPO 後 securities_metadata.xlsx 一括取込対象外だったため手動追加。
-- shares_outstanding: 547,240,000（Yahoo Finance 285A.T key statistics、2026-07 時点）
-- market cap ≈ shares × v_stock_latest.close（JPY）

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
  '285A.T',
  'STOCK',
  547240000,
  'JPY',
  '2026-07-07',
  5050,
  true,
  'yahoo_finance_key_statistics',
  'KIOXIA Holdings IPO 2024-12; added after stock page profile patch'
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
