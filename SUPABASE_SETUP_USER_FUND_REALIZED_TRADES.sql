-- MyPage: ファンドの売却（実現損益）ログ。保有ロット（user_owned_funds）とは別テーブル。
-- Supabase SQL Editor で実行。
-- set_updated_at_mypage_owned_assets は MYPAGE / 株式実現と共用。

create table if not exists public.user_fund_realized_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id text not null,
  symbol text not null,
  sell_date date,
  qty numeric(18,6) not null default 0 check (qty >= 0),
  sell_price numeric(18,6) not null default 0 check (sell_price >= 0),
  cost_basis_jpy numeric(18,2) not null default 0,
  proceeds_jpy numeric(18,2) not null default 0,
  realized_pnl_jpy numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trade_id)
);

create index if not exists idx_user_fund_realized_trades_user_created
  on public.user_fund_realized_trades (user_id, created_at desc);

create index if not exists idx_user_fund_realized_trades_user_symbol
  on public.user_fund_realized_trades (user_id, symbol);

drop trigger if exists trg_user_fund_realized_trades_updated_at on public.user_fund_realized_trades;
create trigger trg_user_fund_realized_trades_updated_at
before update on public.user_fund_realized_trades
for each row execute function public.set_updated_at_mypage_owned_assets();

alter table public.user_fund_realized_trades enable row level security;

drop policy if exists "fund_realized_owner_select" on public.user_fund_realized_trades;
create policy "fund_realized_owner_select"
on public.user_fund_realized_trades
for select
using (auth.uid() = user_id);

drop policy if exists "fund_realized_owner_insert" on public.user_fund_realized_trades;
create policy "fund_realized_owner_insert"
on public.user_fund_realized_trades
for insert
with check (auth.uid() = user_id);

drop policy if exists "fund_realized_owner_update" on public.user_fund_realized_trades;
create policy "fund_realized_owner_update"
on public.user_fund_realized_trades
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "fund_realized_owner_delete" on public.user_fund_realized_trades;
create policy "fund_realized_owner_delete"
on public.user_fund_realized_trades
for delete
using (auth.uid() = user_id);
