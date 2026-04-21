-- Lightweight import for Transformed_ETF_Universe_Final.ja.csv
-- Recommended flow:
-- 1) Run this SQL once in Supabase SQL Editor.
-- 2) In Table Editor, open public.stg_transformed_etf_universe_final.
-- 3) Import CSV: reports/Transformed_ETF_Universe_Final.ja.csv
-- 4) Run the MERGE section in this same file.
--
-- Policy:
-- - Keep existing trust_fee if already present in public.stock_symbols
-- - Overwrite JP display name / NISA / metadata from CSV when provided

-- ============================================================
-- A. Ensure destination columns exist
-- ============================================================
alter table public.stock_symbols
  add column if not exists raw_ticker text,
  add column if not exists isin text,
  add column if not exists asset_type text not null default 'stock',
  add column if not exists country text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists benchmark text,
  add column if not exists nisa_category text,
  add column if not exists trust_fee numeric(12,6),
  add column if not exists aum numeric(20,2),
  add column if not exists notes text;

do $$
begin
  alter table public.stock_symbols
    add constraint stock_symbols_asset_type_chk
    check (asset_type in ('stock', 'fund', 'etf', 'index'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_stock_symbols_asset_type
  on public.stock_symbols (asset_type);

create index if not exists idx_stock_symbols_nisa_category
  on public.stock_symbols (nisa_category);

create index if not exists idx_stock_symbols_isin
  on public.stock_symbols (isin);

-- ============================================================
-- B. Create staging table for CSV upload
-- ============================================================
create table if not exists public.stg_transformed_etf_universe_final (
  symbol text,
  raw_ticker text,
  asset_type text,
  jp_name text,
  name_en text,
  isin text,
  exchange text,
  country text,
  category text,
  subcategory text,
  benchmark text,
  nisa_category text,
  trust_fee text,
  aum text,
  currency text,
  is_active text,
  notes text
);

comment on table public.stg_transformed_etf_universe_final is
  'Temporary staging for Transformed_ETF_Universe_Final.ja.csv upload.';

-- Optional reset before re-import
truncate table public.stg_transformed_etf_universe_final;

-- ============================================================
-- C. CSV upload instructions
-- ============================================================
-- In Supabase Dashboard:
-- Table Editor -> stg_transformed_etf_universe_final -> Import data
-- Upload file: reports/Transformed_ETF_Universe_Final.ja.csv
--
-- Map these columns exactly:
-- symbol -> symbol
-- raw_ticker -> raw_ticker
-- asset_type -> asset_type
-- jp_name -> jp_name
-- name_en -> name_en
-- isin -> isin
-- exchange -> exchange
-- country -> country
-- category -> category
-- subcategory -> subcategory
-- benchmark -> benchmark
-- nisa_category -> nisa_category
-- trust_fee -> trust_fee
-- aum -> aum
-- currency -> currency
-- is_active -> is_active
-- notes -> notes

-- ============================================================
-- D. Merge staging -> stock_symbols
-- Run this AFTER the CSV import succeeds.
-- ============================================================
with normalized as (
  select
    upper(nullif(trim(symbol), '')) as symbol,
    nullif(trim(raw_ticker), '') as raw_ticker,
    case
      when lower(coalesce(nullif(trim(asset_type), ''), 'fund')) in ('fund', 'etf', 'stock', 'index')
        then lower(trim(asset_type))
      else 'fund'
    end as asset_type,
    nullif(trim(jp_name), '') as jp_name,
    nullif(trim(name_en), '') as name_en,
    nullif(trim(isin), '') as isin,
    nullif(trim(exchange), '') as exchange,
    nullif(trim(country), '') as country,
    nullif(trim(category), '') as category,
    nullif(trim(subcategory), '') as subcategory,
    nullif(trim(benchmark), '') as benchmark,
    nullif(trim(nisa_category), '') as nisa_category,
    case
      when nullif(trim(trust_fee), '') ~ '^-?[0-9]+(\.[0-9]+)?$' then trim(trust_fee)::numeric
      else null
    end as trust_fee,
    case
      when nullif(trim(aum), '') ~ '^-?[0-9]+(\.[0-9]+)?$' then trim(aum)::numeric
      else null
    end as aum,
    nullif(trim(currency), '') as currency,
    case
      when lower(coalesce(nullif(trim(is_active), ''), 'true')) in ('true', 't', '1', 'yes', 'y') then true
      when lower(trim(is_active)) in ('false', 'f', '0', 'no', 'n') then false
      else true
    end as is_active,
    nullif(trim(notes), '') as notes
  from public.stg_transformed_etf_universe_final
),
deduped as (
  select distinct on (symbol)
    symbol,
    raw_ticker,
    asset_type,
    jp_name,
    name_en,
    isin,
    exchange,
    country,
    category,
    subcategory,
    benchmark,
    nisa_category,
    trust_fee,
    aum,
    currency,
    is_active,
    notes
  from normalized
  where symbol is not null
    and symbol <> ''
  order by symbol, jp_name desc nulls last, name_en desc nulls last
)
insert into public.stock_symbols as s (
  symbol,
  name,
  exchange,
  currency,
  is_active,
  raw_ticker,
  isin,
  asset_type,
  country,
  category,
  subcategory,
  benchmark,
  nisa_category,
  trust_fee,
  aum,
  notes
)
select
  d.symbol,
  coalesce(d.jp_name, d.name_en, d.symbol) as name,
  d.exchange,
  d.currency,
  coalesce(d.is_active, true) as is_active,
  d.raw_ticker,
  d.isin,
  d.asset_type,
  d.country,
  d.category,
  d.subcategory,
  d.benchmark,
  d.nisa_category,
  d.trust_fee,
  d.aum,
  d.notes
from deduped d
on conflict (symbol) do update
set
  name = coalesce(excluded.name, s.name),
  exchange = coalesce(excluded.exchange, s.exchange),
  currency = coalesce(excluded.currency, s.currency),
  is_active = coalesce(excluded.is_active, s.is_active),
  raw_ticker = coalesce(excluded.raw_ticker, s.raw_ticker),
  isin = coalesce(excluded.isin, s.isin),
  asset_type = coalesce(excluded.asset_type, s.asset_type),
  country = coalesce(excluded.country, s.country),
  category = coalesce(excluded.category, s.category),
  subcategory = coalesce(excluded.subcategory, s.subcategory),
  benchmark = coalesce(excluded.benchmark, s.benchmark),
  nisa_category = coalesce(excluded.nisa_category, s.nisa_category),
  trust_fee = coalesce(s.trust_fee, excluded.trust_fee),
  aum = coalesce(excluded.aum, s.aum),
  notes = coalesce(excluded.notes, s.notes);

-- ============================================================
-- E. Validation
-- ============================================================
select count(*) as staged_rows
from public.stg_transformed_etf_universe_final;

select
  count(*) as total_symbols,
  count(*) filter (where asset_type in ('fund', 'etf')) as total_funds_etfs,
  count(*) filter (where nisa_category is not null and nisa_category <> '') as rows_with_nisa
from public.stock_symbols;

select symbol, name, raw_ticker, asset_type, trust_fee, nisa_category
from public.stock_symbols
where symbol in ('1306.T', '1540.T', '2014.T', '2558.T', '513A.T')
order by symbol;
