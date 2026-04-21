-- Marketstack ingestion schema check (read-only)
-- Run in Supabase SQL Editor.

-- 1) Required relations existence
select
  n.nspname as schema_name,
  c.relname as object_name,
  c.relkind as object_kind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'stock_symbols',
    'stock_daily_prices',
    'ingestion_jobs',
    'v_stock_latest'
  )
order by c.relname;

-- 2) Required columns existence + type
select
  table_name,
  column_name,
  data_type,
  udt_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'stock_symbols' and column_name in ('symbol', 'name', 'exchange', 'currency', 'is_active'))
    or
    (table_name = 'stock_daily_prices' and column_name in ('source', 'symbol', 'trade_date', 'open', 'high', 'low', 'close', 'volume', 'raw'))
    or
    (table_name = 'ingestion_jobs' and column_name in ('source', 'dataset', 'status', 'started_at', 'finished_at', 'rows_processed', 'error_message', 'meta'))
  )
order by table_name, ordinal_position;

-- 3) Required unique/primary constraints
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
 and tc.table_name = kcu.table_name
where tc.table_schema = 'public'
  and tc.table_name in ('stock_symbols', 'stock_daily_prices')
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
group by tc.table_name, tc.constraint_name, tc.constraint_type
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- 4) Recommended indexes status
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('stock_daily_prices', 'ingestion_jobs')
  and (
    indexname in (
      'idx_stock_daily_symbol_date',
      'idx_stock_daily_date',
      'idx_ingestion_jobs_source_dataset_status_started_at'
    )
    or indexdef ilike '%(source, dataset, status, started_at%'
  )
order by tablename, indexname;

-- 5) RLS enabled check
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('stock_symbols', 'stock_daily_prices', 'ingestion_jobs')
order by tablename;

-- 6) View definition check
select
  schemaname,
  viewname,
  definition
from pg_views
where schemaname = 'public'
  and viewname = 'v_stock_latest';

-- Optional (manual apply): recommended index for cron query performance
-- create index if not exists idx_ingestion_jobs_source_dataset_status_started_at
-- on public.ingestion_jobs (source, dataset, status, started_at desc);

