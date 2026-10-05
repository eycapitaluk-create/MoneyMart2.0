-- 수집 중 주말 행·전일 대비 급변 행을 본 가격 테이블에 넣지 않고 여기에 둔다.
-- Supabase SQL 에디터에서 1회 실행.

create table if not exists public.stock_daily_price_quarantine (
  source text not null default 'marketstack',
  symbol text not null,
  trade_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric,
  reason text not null,
  prev_trade_date date,
  prev_close numeric,
  ratio numeric,
  created_at timestamptz not null default now(),
  primary key (source, symbol, trade_date)
);

alter table public.stock_daily_price_quarantine enable row level security;

comment on table public.stock_daily_price_quarantine is
  'Held EOD rows: weekend or close move >1.8x / <0.55x vs previous close. Not used for charts.';
