-- Fix fund metadata using the already uploaded staging table.
-- Use this AFTER stg_transformed_etf_universe_final has CSV rows.
--
-- This version overwrites:
-- - name
-- - nisa_category
-- - trust_fee
-- - raw_ticker / isin / exchange / asset_type / country / category / subcategory / benchmark / aum / currency / is_active / notes
--
-- If you want the CSV values to be the source of truth, run this file.

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
  trust_fee = coalesce(excluded.trust_fee, s.trust_fee),
  aum = coalesce(excluded.aum, s.aum),
  notes = coalesce(excluded.notes, s.notes);

select symbol, name, trust_fee, nisa_category
from public.stock_symbols
where symbol in ('1542.T', '412A.T', '282A.T', '408A.T', '513A.T', '466A.T')
order by symbol;
