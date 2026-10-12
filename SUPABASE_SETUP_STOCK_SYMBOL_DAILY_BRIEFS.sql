-- 株式ページ: 選択銘柄の「本日のAI解説」（ログインユーザー向け・1銘柄1日1回生成）
-- クライアント直読み不可。/api/stock-daily-brief が service role で読み書き。

create table if not exists public.stock_symbol_daily_briefs (
  symbol text not null,
  brief_date_jst date not null,
  region text not null check (region in ('US', 'JP')),
  company_name text not null default '',
  trade_date date,
  latest_close numeric,
  prev_close numeric,
  change_pct numeric,
  headline text not null default '',
  summary text not null default '',
  drivers jsonb not null default '[]'::jsonb,
  source_headlines jsonb not null default '[]'::jsonb,
  model text,
  status text not null default 'ready' check (status in ('ready', 'empty', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (symbol, brief_date_jst)
);

comment on table public.stock_symbol_daily_briefs is
  '株式ページチャート下AI解説。symbol × JST日付で1日1回。API経由のみ参照。';

create index if not exists idx_stock_symbol_daily_briefs_updated
  on public.stock_symbol_daily_briefs (updated_at desc);

alter table public.stock_symbol_daily_briefs enable row level security;

-- service role のみ（anon/authenticated ポリシーなし）
