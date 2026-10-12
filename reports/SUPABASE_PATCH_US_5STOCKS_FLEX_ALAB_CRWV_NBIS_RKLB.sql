-- FLEX, ALAB, CRWV, NBIS, RKLB — US StockPage extras
-- History: FLEX_ALAB_CRWV_NBIS_RKLB_history_2026-06-23.xlsx (import-us-close-xlsx.mjs --multi)

begin;

insert into public.stock_symbols (symbol, name, exchange, currency, is_active)
values
  ('FLEX', 'Flex Ltd.', 'NASDAQ', 'USD', true),
  ('ALAB', 'Astera Labs, Inc.', 'NASDAQ', 'USD', true),
  ('CRWV', 'CoreWeave, Inc.', 'NASDAQ', 'USD', true),
  ('NBIS', 'Nebius Group N.V.', 'NASDAQ', 'USD', true),
  ('RKLB', 'Rocket Lab USA, Inc.', 'NASDAQ', 'USD', true)
on conflict (symbol) do update
set name = excluded.name,
    exchange = excluded.exchange,
    currency = excluded.currency,
    is_active = true;

insert into public.stock_symbol_profiles (
  symbol, region, asset_type, sector, industry, name_en, name_jp, priority
)
values
  ('FLEX', 'US', 'stock', 'テクノロジー', 'Electronic Equipment', 'Flex Ltd.', 'フレックス', 5060),
  ('ALAB', 'US', 'stock', 'テクノロジー', 'Semiconductors', 'Astera Labs, Inc.', 'アステラ・ラボズ', 5060),
  ('CRWV', 'US', 'stock', 'テクノロジー', 'Software Infrastructure', 'CoreWeave, Inc.', 'コアウィーブ', 5060),
  ('NBIS', 'US', 'stock', 'テクノロジー', 'Internet Software & Services', 'Nebius Group N.V.', 'ネビウス', 5060),
  ('RKLB', 'US', 'stock', '資本財・産業', 'Aerospace & Defense', 'Rocket Lab USA, Inc.', 'ロケット・ラボ', 5060)
on conflict (symbol) do update
set region = excluded.region,
    asset_type = excluded.asset_type,
    sector = excluded.sector,
    industry = excluded.industry,
    name_en = excluded.name_en,
    name_jp = excluded.name_jp,
    priority = least(stock_symbol_profiles.priority, excluded.priority),
    updated_at = now();

commit;
