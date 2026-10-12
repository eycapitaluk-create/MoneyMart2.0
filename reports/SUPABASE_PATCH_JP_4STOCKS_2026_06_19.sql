-- 6976.T Taiyo Yuden, 4062.T Ibiden, 5706.T Mitsui Kinzoku, 6963.T Rohm
-- JP StockPage profiles (prices imported via import-jp-etf-xlsx.mjs)

begin;

insert into public.stock_symbols (symbol, name, exchange, currency, is_active)
values
  ('6976.T', 'Taiyo Yuden Co., Ltd.', 'XTKS', 'JPY', true),
  ('4062.T', 'Ibiden Co., Ltd.', 'XTKS', 'JPY', true),
  ('5706.T', 'Mitsui Mining & Smelting Co., Ltd.', 'XTKS', 'JPY', true),
  ('6963.T', 'Rohm Co., Ltd.', 'XTKS', 'JPY', true)
on conflict (symbol) do update
set name = excluded.name,
    exchange = excluded.exchange,
    currency = excluded.currency,
    is_active = true;

insert into public.stock_symbol_profiles (
  symbol, region, asset_type, sector, industry, name_en, name_jp, priority
)
values
  (
    '6976.T', 'JP', 'stock', 'テクノロジー', 'Electronic Components',
    'Taiyo Yuden Co., Ltd.', '太陽誘電', 5051
  ),
  (
    '4062.T', 'JP', 'stock', 'テクノロジー', 'Electronic Components',
    'Ibiden Co., Ltd.', 'イビデン', 5051
  ),
  (
    '5706.T', 'JP', 'stock', '素材', 'Non-ferrous Metals',
    'Mitsui Mining & Smelting Co., Ltd.', '三井金属鉱業', 5051
  ),
  (
    '6963.T', 'JP', 'stock', 'テクノロジー', 'Semiconductors',
    'Rohm Co., Ltd.', 'ローム', 5051
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

commit;
