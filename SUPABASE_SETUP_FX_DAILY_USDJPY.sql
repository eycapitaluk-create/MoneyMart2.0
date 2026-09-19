-- ================================================================
-- 日次 USD/JPY（Vercel cron /api/cron/fx-usdjpy-daily で upsert）
-- 評価用の安定したソース（ユーザー毎ページロードでの外部API依存を減らす）
-- ================================================================

create table if not exists public.fx_daily_usdjpy (
  as_of_date date not null primary key,
  usd_jpy numeric not null check (usd_jpy > 0),
  provider text not null default 'frankfurter',
  updated_at timestamptz not null default now()
);

comment on table public.fx_daily_usdjpy is 'USD/JPY 日次終値ベースレート。cron が 1 日複数 upsert 可だが運用は 1 日 1 回想定';

create index if not exists idx_fx_daily_usdjpy_updated_at on public.fx_daily_usdjpy (updated_at desc);

alter table public.fx_daily_usdjpy enable row level security;

-- アプリ経由での直接書込み禁止（サービスロールのみ upsert を想定）
drop policy if exists "fx_daily_usdjpy_read_authenticated" on public.fx_daily_usdjpy;
create policy "fx_daily_usdjpy_read_authenticated"
on public.fx_daily_usdjpy
for select
to authenticated
using (true);
