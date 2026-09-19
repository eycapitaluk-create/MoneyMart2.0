-- 新規 JP ETF: 585A.T / 586A.T / 605A.T / 606A.T / 608A.T
-- 表示名は etfListedJaNameMap / Transformed_ETF_Universe_Final.ja.csv と合わせる。

begin;

insert into public.stock_symbols (
  symbol, name, exchange, currency, is_active,
  asset_type, country, category, subcategory, benchmark,
  nisa_category, trust_fee, aum, isin
)
values
  (
    '585A.T',
    '日本バリュー・ボトムアップ株式投資戦略アクティブ ETF',
    'TSE',
    'JPY',
    true,
    'fund',
    'JP',
    '国内株式',
    'Domestic Equity',
    'Japan Value Bottom-Up Active',
    '成長',
    null,
    null,
    null
  ),
  (
    '586A.T',
    'NEXT FUNDS 日経エンタメ・コンテンツ株指数連動型',
    'TSE',
    'JPY',
    true,
    'fund',
    'JP',
    '国内株式',
    'Domestic Equity',
    'Nikkei Entertainment & Content Index',
    '成長',
    null,
    null,
    null
  ),
  (
    '605A.T',
    'NEXT FUNDS 日本株政策フォーカス上場投信',
    'TSE',
    'JPY',
    true,
    'fund',
    'JP',
    '国内株式',
    'Domestic Equity',
    'Japan Policy Focus',
    '成長',
    null,
    null,
    null
  ),
  (
    '606A.T',
    '金２倍ブルETF',
    'TSE',
    'JPY',
    true,
    'fund',
    'GLOBAL',
    'コモディティ',
    '金',
    'Gold Price',
    'NISA対象外',
    null,
    null,
    null
  ),
  (
    '608A.T',
    '上場インデックスファンド東証REIT高利回り30',
    'TSE',
    'JPY',
    true,
    'fund',
    'GLOBAL',
    'REIT',
    'REIT',
    'TSE REIT High Yield 30',
    '成長',
    null,
    null,
    null
  )
on conflict (symbol) do update
set name = excluded.name,
    exchange = excluded.exchange,
    currency = excluded.currency,
    is_active = true,
    asset_type = excluded.asset_type,
    country = excluded.country,
    category = excluded.category,
    subcategory = excluded.subcategory,
    benchmark = excluded.benchmark,
    nisa_category = excluded.nisa_category,
    trust_fee = excluded.trust_fee,
    aum = excluded.aum,
    isin = coalesce(excluded.isin, stock_symbols.isin);

insert into public.stock_symbol_profiles (
  symbol, region, asset_type, sector, industry, name_en, name_jp, priority
)
values
  (
    '585A.T',
    'JP',
    'etf',
    '国内株式',
    'Domestic Equity',
    'Japan Value Bottom-Up Active Equity ETF',
    '日本バリュー・ボトムアップ株式投資戦略アクティブ ETF',
    5202
  ),
  (
    '586A.T',
    'JP',
    'etf',
    '国内株式',
    'Domestic Equity',
    'NEXT FUNDS Nikkei Entertainment & Content Index ETF',
    'NEXT FUNDS 日経エンタメ・コンテンツ株指数連動型',
    5203
  ),
  (
    '605A.T',
    'JP',
    'etf',
    '国内株式',
    'Domestic Equity',
    'NEXT FUNDS Japan Policy Focus ETF',
    'NEXT FUNDS 日本株政策フォーカス上場投信',
    5204
  ),
  (
    '606A.T',
    'JP',
    'etf',
    'コモディティ',
    '金',
    'Gold 2x Bull ETF',
    '金２倍ブルETF',
    5205
  ),
  (
    '608A.T',
    'JP',
    'etf',
    'REIT',
    'REIT',
    'Listed Index Fund TSE REIT High Yield 30',
    '上場インデックスファンド東証REIT高利回り30',
    5206
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
