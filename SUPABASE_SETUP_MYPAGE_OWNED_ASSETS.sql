-- MoneyMart 2.0 - MyPage owned stock/fund persistence
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- 1) Owned stock lots (transaction-level)
create table if not exists public.user_owned_stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lot_id text not null,
  symbol text not null,
  buy_date date,
  buy_price numeric(18,6) not null default 0 check (buy_price >= 0),
  qty numeric(18,6) not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lot_id)
);

create index if not exists idx_user_owned_stocks_user_created
  on public.user_owned_stocks (user_id, created_at desc);

create index if not exists idx_user_owned_stocks_user_symbol
  on public.user_owned_stocks (user_id, symbol);

-- 2) Owned fund positions (transaction-level)
create table if not exists public.user_owned_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_row_id text not null,
  symbol text not null,
  name text not null default '',
  invest_amount numeric(18,2) not null default 0 check (invest_amount >= 0),
  buy_date date,
  buy_price numeric(18,6) not null default 0 check (buy_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fund_row_id)
);

create index if not exists idx_user_owned_funds_user_created
  on public.user_owned_funds (user_id, created_at desc);

create index if not exists idx_user_owned_funds_user_symbol
  on public.user_owned_funds (user_id, symbol);

-- 3) updated_at trigger
create or replace function public.set_updated_at_mypage_owned_assets()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_owned_stocks_updated_at on public.user_owned_stocks;
create trigger trg_user_owned_stocks_updated_at
before update on public.user_owned_stocks
for each row execute function public.set_updated_at_mypage_owned_assets();

drop trigger if exists trg_user_owned_funds_updated_at on public.user_owned_funds;
create trigger trg_user_owned_funds_updated_at
before update on public.user_owned_funds
for each row execute function public.set_updated_at_mypage_owned_assets();

-- 4) RLS
alter table public.user_owned_stocks enable row level security;
alter table public.user_owned_funds enable row level security;

drop policy if exists "owned_stocks_owner_select" on public.user_owned_stocks;
create policy "owned_stocks_owner_select"
on public.user_owned_stocks
for select
using (auth.uid() = user_id);

drop policy if exists "owned_stocks_owner_insert" on public.user_owned_stocks;
create policy "owned_stocks_owner_insert"
on public.user_owned_stocks
for insert
with check (auth.uid() = user_id);

drop policy if exists "owned_stocks_owner_update" on public.user_owned_stocks;
create policy "owned_stocks_owner_update"
on public.user_owned_stocks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "owned_stocks_owner_delete" on public.user_owned_stocks;
create policy "owned_stocks_owner_delete"
on public.user_owned_stocks
for delete
using (auth.uid() = user_id);

drop policy if exists "owned_funds_owner_select" on public.user_owned_funds;
create policy "owned_funds_owner_select"
on public.user_owned_funds
for select
using (auth.uid() = user_id);

drop policy if exists "owned_funds_owner_insert" on public.user_owned_funds;
create policy "owned_funds_owner_insert"
on public.user_owned_funds
for insert
with check (auth.uid() = user_id);

drop policy if exists "owned_funds_owner_update" on public.user_owned_funds;
create policy "owned_funds_owner_update"
on public.user_owned_funds
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "owned_funds_owner_delete" on public.user_owned_funds;
create policy "owned_funds_owner_delete"
on public.user_owned_funds
for delete
using (auth.uid() = user_id);

-- MoneyMart 2.0 - MyPage owned stock/fund persistence
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.user_owned_stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lot_id text not null,
  symbol text not null,
  buy_date date,
  buy_price numeric(18,6) not null default 0 check (buy_price >= 0),
  qty numeric(18,6) not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lot_id)
);

create index if not exists idx_user_owned_stocks_user_created
  on public.user_owned_stocks (user_id, created_at desc);

create table if not exists public.user_owned_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_row_id text not null,
  symbol text not null,
  name text not null default '',
  invest_amount numeric(18,2) not null default 0 check (invest_amount >= 0),
  buy_date date,
  buy_price numeric(18,6) not null default 0 check (buy_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fund_row_id)
);

create index if not exists idx_user_owned_funds_user_created
  on public.user_owned_funds (user_id, created_at desc);

create or replace function public.set_updated_at_mypage_owned_assets()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_owned_stocks_updated_at on public.user_owned_stocks;
create trigger trg_user_owned_stocks_updated_at
before update on public.user_owned_stocks
for each row execute function public.set_updated_at_mypage_owned_assets();

drop trigger if exists trg_user_owned_funds_updated_at on public.user_owned_funds;
create trigger trg_user_owned_funds_updated_at
before update on public.user_owned_funds
for each row execute function public.set_updated_at_mypage_owned_assets();

alter table public.user_owned_stocks enable row level security;
alter table public.user_owned_funds enable row level security;

drop policy if exists "owned_stocks_owner_select" on public.user_owned_stocks;
create policy "owned_stocks_owner_select"
on public.user_owned_stocks
for select
using (auth.uid() = user_id);

drop policy if exists "owned_stocks_owner_insert" on public.user_owned_stocks;
create policy "owned_stocks_owner_insert"
on public.user_owned_stocks
for insert
with check (auth.uid() = user_id);

drop policy if exists "owned_stocks_owner_update" on public.user_owned_stocks;
create policy "owned_stocks_owner_update"
on public.user_owned_stocks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "owned_stocks_owner_delete" on public.user_owned_stocks;
create policy "owned_stocks_owner_delete"
on public.user_owned_stocks
for delete
using (auth.uid() = user_id);

drop policy if exists "owned_funds_owner_select" on public.user_owned_funds;
create policy "owned_funds_owner_select"
on public.user_owned_funds
for select
using (auth.uid() = user_id);

drop policy if exists "owned_funds_owner_insert" on public.user_owned_funds;
create policy "owned_funds_owner_insert"
on public.user_owned_funds
for insert
with check (auth.uid() = user_id);

drop policy if exists "owned_funds_owner_update" on public.user_owned_funds;
create policy "owned_funds_owner_update"
on public.user_owned_funds
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "owned_funds_owner_delete" on public.user_owned_funds;
create policy "owned_funds_owner_delete"
on public.user_owned_funds
for delete
using (auth.uid() = user_id);
