-- Optional: GEV 표시용 프로필 (stock_symbols 에 행이 있어야 FK 만족)
-- 백필 스크립트 실행 후 Supabase SQL Editor 에서 1회 실행.

insert into public.stock_symbol_profiles (symbol, region, asset_type, index_tag, sector, name_en, priority)
values ('GEV', 'US', 'stock', 'SP500', 'Capital Goods & Industrials', 'GE Vernova LLC', 5000)
on conflict (symbol) do update
set
  region = excluded.region,
  asset_type = excluded.asset_type,
  index_tag = excluded.index_tag,
  sector = excluded.sector,
  name_en = excluded.name_en,
  priority = excluded.priority,
  updated_at = now();
