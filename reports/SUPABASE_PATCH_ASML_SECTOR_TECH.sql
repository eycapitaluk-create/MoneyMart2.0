-- Manual sector correction: ASML is semiconductor equipment.
begin;

insert into public.stock_symbol_profiles (symbol, region, asset_type, sector, industry, priority)
values ('ASML', 'US', 'stock', 'テクノロジー', 'ASML Holding NV', 1960)
on conflict (symbol) do update
set region = excluded.region,
    asset_type = excluded.asset_type,
    sector = excluded.sector,
    industry = coalesce(nullif(excluded.industry, ''), stock_symbol_profiles.industry),
    priority = least(stock_symbol_profiles.priority, excluded.priority),
    updated_at = now();

commit;
