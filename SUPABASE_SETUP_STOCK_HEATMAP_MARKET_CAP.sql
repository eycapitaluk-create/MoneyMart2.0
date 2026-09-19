-- Stock page heatmap market cap metadata
-- Run once in Supabase SQL Editor.
--
-- Stocks: market cap is calculated as shares_outstanding * v_stock_latest.close.
-- ETFs: aum can be imported separately and used as the sizing value.
-- Do not insert dummy or placeholder market data.

begin;

create table if not exists public.stock_heatmap_profiles (
  symbol text primary key references public.stock_symbols(symbol) on update cascade on delete cascade,
  asset_type text not null default 'STOCK' check (asset_type in ('STOCK', 'ETF')),
  shares_outstanding numeric(24,4) check (shares_outstanding is null or shares_outstanding > 0),
  aum numeric(24,2) check (aum is null or aum > 0),
  metadata_currency text,
  market_cap_base numeric(24,2) check (market_cap_base is null or market_cap_base > 0),
  market_cap_base_currency text,
  market_cap_as_of date,
  heatmap_priority integer not null default 9999,
  heatmap_enabled boolean not null default true,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_heatmap_profiles_stock_or_etf_value_chk check (
    (asset_type = 'STOCK' and shares_outstanding is not null)
    or (asset_type = 'ETF' and aum is not null)
    or market_cap_base is not null
  )
);

alter table public.stock_heatmap_profiles
  add column if not exists asset_type text not null default 'STOCK',
  add column if not exists shares_outstanding numeric(24,4),
  add column if not exists aum numeric(24,2),
  add column if not exists metadata_currency text,
  add column if not exists market_cap_base numeric(24,2),
  add column if not exists market_cap_base_currency text,
  add column if not exists market_cap_as_of date,
  add column if not exists heatmap_priority integer not null default 9999,
  add column if not exists heatmap_enabled boolean not null default true,
  add column if not exists source text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.stock_heatmap_profiles
  alter column market_cap_base drop not null,
  alter column market_cap_base_currency drop not null;

do $$
begin
  alter table public.stock_heatmap_profiles
    add constraint stock_heatmap_profiles_asset_type_chk
    check (asset_type in ('STOCK', 'ETF'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.stock_heatmap_profiles
    add constraint stock_heatmap_profiles_shares_positive_chk
    check (shares_outstanding is null or shares_outstanding > 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.stock_heatmap_profiles
    add constraint stock_heatmap_profiles_aum_positive_chk
    check (aum is null or aum > 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.stock_heatmap_profiles
    add constraint stock_heatmap_profiles_market_cap_base_positive_chk
    check (market_cap_base is null or market_cap_base > 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.stock_heatmap_profiles
    add constraint stock_heatmap_profiles_stock_or_etf_value_chk
    check (
      (asset_type = 'STOCK' and shares_outstanding is not null)
      or (asset_type = 'ETF' and aum is not null)
      or market_cap_base is not null
    );
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_stock_heatmap_profiles_enabled_priority
  on public.stock_heatmap_profiles(heatmap_enabled, heatmap_priority, symbol);

create index if not exists idx_stock_heatmap_profiles_asset_type
  on public.stock_heatmap_profiles(asset_type, heatmap_enabled, heatmap_priority);

alter table public.stock_heatmap_profiles enable row level security;

drop policy if exists "stock_heatmap_profiles_public_read" on public.stock_heatmap_profiles;
create policy "stock_heatmap_profiles_public_read"
on public.stock_heatmap_profiles
for select
to anon, authenticated
using (heatmap_enabled = true);

drop policy if exists "stock_heatmap_profiles_admin_write" on public.stock_heatmap_profiles;
create policy "stock_heatmap_profiles_admin_write"
on public.stock_heatmap_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'editor')
  )
);

create or replace function public.set_stock_heatmap_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_stock_heatmap_profiles_updated_at on public.stock_heatmap_profiles;
create trigger trg_stock_heatmap_profiles_updated_at
before update on public.stock_heatmap_profiles
for each row
execute function public.set_stock_heatmap_profiles_updated_at();

drop view if exists public.v_stock_heatmap_latest;

create view public.v_stock_heatmap_latest
with (security_invoker = true)
as
select
  shp.symbol,
  ss.name,
  ss.exchange,
  ss.currency as price_currency,
  ssp.region,
  ssp.sector,
  ssp.industry,
  shp.asset_type,
  shp.shares_outstanding,
  shp.aum,
  shp.metadata_currency,
  shp.market_cap_base,
  shp.market_cap_base_currency,
  shp.market_cap_as_of,
  shp.heatmap_priority,
  vl.trade_date,
  vl.open,
  vl.close,
  case
    when shp.asset_type = 'STOCK' and shp.shares_outstanding is not null and vl.close is not null
      then round(shp.shares_outstanding * vl.close, 2)
    when shp.asset_type = 'ETF' and shp.aum is not null
      then round(shp.aum, 2)
    else null
  end as market_cap_local,
  case
    when shp.asset_type = 'STOCK' then ss.currency
    when shp.asset_type = 'ETF' then shp.metadata_currency
    else null
  end as market_cap_local_currency,
  coalesce(
    shp.market_cap_base,
    case
      when shp.asset_type = 'STOCK' and shp.shares_outstanding is not null and vl.close is not null
        then round(shp.shares_outstanding * vl.close, 2)
      when shp.asset_type = 'ETF' and shp.aum is not null
        then round(shp.aum, 2)
      else null
    end
  ) as heatmap_size_value,
  coalesce(
    shp.market_cap_base_currency,
    case
      when shp.asset_type = 'STOCK' then ss.currency
      when shp.asset_type = 'ETF' then shp.metadata_currency
      else null
    end
  ) as heatmap_size_currency,
  case
    when vl.open is null or vl.open = 0 or vl.close is null then null
    else round(((vl.close - vl.open) / vl.open) * 100, 4)
  end as intraday_change_pct,
  shp.source,
  shp.updated_at
from public.stock_heatmap_profiles shp
join public.stock_symbols ss on ss.symbol = shp.symbol
left join public.stock_symbol_profiles ssp on ssp.symbol = shp.symbol
left join public.v_stock_latest vl on vl.symbol = shp.symbol
where shp.heatmap_enabled = true
order by heatmap_size_value desc nulls last, shp.heatmap_priority, shp.symbol;

grant select on public.stock_heatmap_profiles to anon, authenticated;
grant select on public.v_stock_heatmap_latest to anon, authenticated;

comment on table public.stock_heatmap_profiles is 'Verified metadata for StockPage heatmap sizing. Stocks use shares_outstanding * latest close; ETFs can use AUM.';
comment on column public.stock_heatmap_profiles.shares_outstanding is 'Verified outstanding shares for stocks. Market cap is calculated from latest close in v_stock_latest.';
comment on column public.stock_heatmap_profiles.aum is 'Verified AUM for ETFs when ETF heatmap support is enabled.';
comment on column public.stock_heatmap_profiles.market_cap_base is 'Optional pre-converted/common-currency market cap override for mixed-currency heatmaps.';
comment on column public.stock_heatmap_profiles.market_cap_as_of is 'Date the metadata value was verified.';
comment on column public.stock_heatmap_profiles.heatmap_priority is 'Manual display priority fallback; lower is earlier.';

commit;
