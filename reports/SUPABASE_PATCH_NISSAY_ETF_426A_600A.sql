-- ニッセイ ETF 新規: 426A.T / 600A.T（FundPage・米国株式）
-- 表示名は etfListedJaNameMap と合わせる。英語名は profiles / EN map で検索可能。

begin;

insert into public.stock_symbols (
  symbol, name, exchange, currency, is_active,
  asset_type, country, category, subcategory, benchmark,
  nisa_category, trust_fee, aum, isin
)
values
  (
    '426A.T',
    'ニッセイ ETF S&P500イコール・ウェイト(H無)',
    'TSE',
    'JPY',
    true,
    'fund',
    'US',
    '米国株式',
    'S&P500 Equal Weight',
    'S&P 500 Equal Weight Index',
    '成長',
    0.2,
    6200000000,
    'JP3050940000'
  ),
  (
    '600A.T',
    'ニッセイ ETF ラッセル2000',
    'TSE',
    'JPY',
    true,
    'fund',
    'US',
    '米国株式',
    'Russell2000',
    'Russell 2000 Index',
    '成長',
    0.432,
    321480000,
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
    '426A.T',
    'JP',
    'etf',
    '米国株式',
    'S&P500 Equal Weight',
    'Nissay ETF S&P500 Equal Weight (No Hedge)',
    'ニッセイ ETF S&P500イコール・ウェイト(H無)',
    5200
  ),
  (
    '600A.T',
    'JP',
    'etf',
    '米国株式',
    'Russell2000',
    'Nissay ETF Russell 2000',
    'ニッセイ ETF ラッセル2000',
    5201
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
