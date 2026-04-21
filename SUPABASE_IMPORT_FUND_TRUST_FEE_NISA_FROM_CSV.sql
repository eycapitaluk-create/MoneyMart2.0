-- Import trust fee + NISA category from external CSV into stock master.
-- Target CSV example: MoneyMart_FundList_Precise_Sorting.csv
-- Run in Supabase SQL Editor after uploading CSV rows to staging table.

-- 0) Ensure destination columns exist
alter table public.stock_symbols
  add column if not exists trust_fee numeric(8,6),
  add column if not exists nisa_category text;

comment on column public.stock_symbols.trust_fee
  is 'ETF trust fee ratio in percent units (e.g. 0.077 = 0.077%).';
comment on column public.stock_symbols.nisa_category
  is 'NISA eligibility category text (e.g. つみたて投資枠 / 成長投資枠).';

create index if not exists idx_stock_symbols_nisa_category
  on public.stock_symbols (nisa_category);

-- 1) Create staging table (text columns to avoid import parse failures)
create table if not exists public.stg_fund_fee_nisa_import (
  name text,
  ticker text,
  bbg_ticker text,
  isin text,
  fund_name_jp text,
  active_passive text,
  trust_fee_numeric text,
  nisa_category text,
  trust_fee_percent text
);

comment on table public.stg_fund_fee_nisa_import
  is 'Temporary staging for CSV import of ETF trust fee and NISA category.';

-- 2) IMPORTANT: Upload CSV rows to public.stg_fund_fee_nisa_import first.
--    In Supabase Dashboard:
--    Table Editor -> stg_fund_fee_nisa_import -> Import data (CSV).
--    Map columns:
--      Name -> name
--      Ticker -> ticker
--      BBG Ticker -> bbg_ticker
--      ISIN -> isin
--      Fund Name in JP -> fund_name_jp
--      Active/Passive -> active_passive
--      Trust Fee (Numeric) -> trust_fee_numeric
--      NISA Category -> nisa_category
--      Trust Fee (%) -> trust_fee_percent

-- 3) Merge staging data into stock_symbols
with normalized as (
  select
    -- CSV ticker format: "1306 JP" / "314A JP" -> "1306.T" / "314A.T"
    (
      upper(regexp_replace(split_part(trim(coalesce(nullif(ticker, ''), nullif(bbg_ticker, ''))), ' ', 1), '[^A-Z0-9]', '', 'g'))
      || '.T'
    ) as symbol,
    nullif(trim(fund_name_jp), '') as fund_name_jp,
    case
      when nullif(trim(trust_fee_numeric), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
        then (nullif(trim(trust_fee_numeric), ''))::numeric
      else null
    end as trust_fee,
    nullif(trim(nisa_category), '') as nisa_category
  from public.stg_fund_fee_nisa_import
),
deduped as (
  select distinct on (symbol)
    symbol,
    fund_name_jp,
    trust_fee,
    nisa_category
  from normalized
  where symbol is not null
    and symbol <> '.T'
  order by symbol, trust_fee asc nulls last
)
insert into public.stock_symbols as s (
  symbol,
  name,
  trust_fee,
  nisa_category
)
select
  d.symbol,
  d.fund_name_jp,
  d.trust_fee,
  d.nisa_category
from deduped d
on conflict (symbol) do update
set
  name = coalesce(excluded.name, s.name),
  trust_fee = coalesce(excluded.trust_fee, s.trust_fee),
  nisa_category = coalesce(excluded.nisa_category, s.nisa_category);

-- 4) Quick validation
select
  count(*) as updated_rows,
  count(*) filter (where trust_fee is not null) as rows_with_trust_fee,
  count(*) filter (where nisa_category is not null and nisa_category <> '') as rows_with_nisa
from public.stock_symbols
where symbol like '%.T';

-- Optional checks:
-- select symbol, name, trust_fee, nisa_category from public.stock_symbols where symbol in ('1306.T', '1475.T', '314A.T');
-- select nisa_category, count(*) from public.stock_symbols group by 1 order by 2 desc;

-- 5) Optional cleanup after successful merge
-- truncate table public.stg_fund_fee_nisa_import;
