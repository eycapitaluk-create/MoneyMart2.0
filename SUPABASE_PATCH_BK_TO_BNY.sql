-- Rename Bank of New York Mellon ticker BK → BNY (Yahoo Finance 2026).
-- Run once in Supabase SQL Editor after deploying app normalizeStockSymbolForDb.

begin;

update public.stock_symbols
set symbol = 'BNY',
    name = coalesce(nullif(trim(name), ''), 'BNY')
where symbol = 'BK';

-- Tables without FK cascade to stock_symbols (user portfolio / watchlist)
update public.user_owned_stocks set symbol = 'BNY' where symbol = 'BK';
update public.user_watchlists set symbol = 'BNY' where symbol = 'BK';
update public.user_stock_realized_trades set symbol = 'BNY' where symbol = 'BK';

-- Optional metadata (no FK or text-only symbol columns)
update public.stock_symbol_sectors set symbol = 'BNY' where symbol = 'BK';
update public.dividend_master_schedule set stock_id = 'BNY' where stock_id = 'BK';

commit;
