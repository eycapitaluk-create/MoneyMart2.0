-- Restore MarketPage sector/regional heatmap symbols after accidental DELETE from stock_symbols.
-- Run once in Supabase SQL Editor.
-- Copper ETF CPER: see SUPABASE_SEED_BOND_COMMODITY_SYMBOLS.sql if needed.
-- After seeding: run MarketStack daily cron or backfill stock_daily_prices so v_stock_latest has data.

insert into public.stock_symbols (symbol, name, exchange, currency, is_active)
values
  ('IYE', 'iShares U.S. Energy ETF', 'ARCX', 'USD', true),
  ('IYM', 'iShares U.S. Basic Materials ETF', 'ARCX', 'USD', true),
  ('IYJ', 'iShares U.S. Industrials ETF', 'ARCX', 'USD', true),
  ('IYC', 'iShares U.S. Consumer Discretionary ETF', 'ARCX', 'USD', true),
  ('IYK', 'iShares U.S. Consumer Staples ETF', 'ARCX', 'USD', true),
  ('IYH', 'iShares U.S. Healthcare ETF', 'ARCX', 'USD', true),
  ('IYF', 'iShares U.S. Financials ETF', 'ARCX', 'USD', true),
  ('IYW', 'iShares U.S. Technology ETF', 'ARCX', 'USD', true),
  ('IYZ', 'iShares U.S. Telecommunications ETF', 'ARCX', 'USD', true),
  ('IDU', 'iShares U.S. Utilities ETF', 'ARCX', 'USD', true),
  ('IYR', 'iShares U.S. Real Estate ETF', 'ARCX', 'USD', true),
  ('AAXJ', 'iShares MSCI All Country Asia ex Japan ETF', 'XNAS', 'USD', true),
  ('IJH', 'iShares Core S&P Mid-Cap ETF', 'ARCX', 'USD', true),
  ('IJR', 'iShares Core S&P Small-Cap ETF', 'ARCX', 'USD', true)
on conflict (symbol) do update set
  name = excluded.name,
  exchange = coalesce(excluded.exchange, stock_symbols.exchange),
  currency = coalesce(excluded.currency, stock_symbols.currency),
  is_active = excluded.is_active;
