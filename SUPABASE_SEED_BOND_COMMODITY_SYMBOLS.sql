-- Seed stock_symbols for bond/commodity ETF proxies used in MarketPage heatmaps.
-- Run once. MarketStack cron will upsert prices when it fetches.
-- Symbols: BNDX, AGG, LQD (bonds), GLD, SLV, CPER, USO (commodities)

insert into public.stock_symbols (symbol, name, exchange, currency, is_active)
values
  ('BNDX', 'Vanguard Total International Bond ETF', 'XNAS', 'USD', true),
  ('AGG', 'iShares Core US Aggregate Bond ETF', 'XNAS', 'USD', true),
  ('LQD', 'iShares iBoxx Investment Grade Corporate Bond ETF', 'XNAS', 'USD', true),
  ('GLD', 'SPDR Gold Shares', 'XNYS', 'USD', true),
  ('SLV', 'iShares Silver Trust', 'XNYS', 'USD', true),
  ('CPER', 'United States Copper Index Fund', 'XNYS', 'USD', true),
  ('USO', 'United States Oil Fund', 'XNYS', 'USD', true)
on conflict (symbol) do update set
  name = excluded.name,
  exchange = coalesce(excluded.exchange, stock_symbols.exchange),
  currency = coalesce(excluded.currency, stock_symbols.currency),
  is_active = excluded.is_active;
