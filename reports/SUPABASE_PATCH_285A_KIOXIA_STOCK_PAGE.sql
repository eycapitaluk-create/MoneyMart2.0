-- 285A.T: KIOXIA Holdings Corporation — JP StockPage + profile
-- Sector: テクノロジー / Semiconductors (NAND flash memory)

begin;

insert into public.stock_symbols (symbol, name, exchange, currency, is_active)
values ('285A.T', 'KIOXIA Holdings Corporation', 'XTKS', 'JPY', true)
on conflict (symbol) do update
set name = excluded.name,
    exchange = excluded.exchange,
    currency = excluded.currency,
    is_active = true;

insert into public.stock_symbol_profiles (
  symbol, region, asset_type, sector, industry, name_en, name_jp, priority
)
values (
  '285A.T',
  'JP',
  'stock',
  'テクノロジー',
  'Semiconductors',
  'KIOXIA Holdings Corporation',
  'キオクシアホールディングス',
  5050
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
