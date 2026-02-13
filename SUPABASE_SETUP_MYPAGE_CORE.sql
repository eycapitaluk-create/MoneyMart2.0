-- MoneyMart 2.0 - MyPage core persistence
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Generic watchlist table for fund/product interests.
create table if not exists public.user_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('fund', 'product')),
  item_id text not null,
  item_name text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create index if not exists idx_user_watchlists_user_type_created
  on public.user_watchlists (user_id, item_type, created_at desc);

-- Expense entries entered by users.
create table if not exists public.user_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spent_on date not null default current_date,
  category text not null default 'その他',
  merchant text not null default '',
  amount integer not null check (amount >= 0),
  payment_method text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_expenses_user_date
  on public.user_expenses (user_id, spent_on desc, created_at desc);

-- Insurance records entered by users.
create table if not exists public.user_insurances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  provider text not null default '',
  monthly_premium integer not null default 0 check (monthly_premium >= 0),
  maturity_date date,
  coverage_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_insurances_user_created
  on public.user_insurances (user_id, created_at desc);

-- Simple user finance profile for MyPage editable fields.
create table if not exists public.user_finance_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  annual_income_manwon integer not null default 0 check (annual_income_manwon >= 0),
  budget_target_yen integer not null default 200000 check (budget_target_yen >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User asset positions for portfolio/total assets.
create table if not exists public.user_asset_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  current_value integer not null default 0 check (current_value >= 0),
  invest_value integer not null default 0 check (invest_value >= 0),
  color text not null default '#3b82f6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_asset_positions_user_created
  on public.user_asset_positions (user_id, created_at desc);

-- User point accounts.
create table if not exists public.user_point_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  balance integer not null default 0 check (balance >= 0),
  expiry date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_point_accounts_user_created
  on public.user_point_accounts (user_id, created_at desc);

create or replace function public.set_updated_at_mypage_core()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_expenses_updated_at on public.user_expenses;
create trigger trg_user_expenses_updated_at
before update on public.user_expenses
for each row execute function public.set_updated_at_mypage_core();

drop trigger if exists trg_user_insurances_updated_at on public.user_insurances;
create trigger trg_user_insurances_updated_at
before update on public.user_insurances
for each row execute function public.set_updated_at_mypage_core();

drop trigger if exists trg_user_finance_profiles_updated_at on public.user_finance_profiles;
create trigger trg_user_finance_profiles_updated_at
before update on public.user_finance_profiles
for each row execute function public.set_updated_at_mypage_core();

drop trigger if exists trg_user_asset_positions_updated_at on public.user_asset_positions;
create trigger trg_user_asset_positions_updated_at
before update on public.user_asset_positions
for each row execute function public.set_updated_at_mypage_core();

drop trigger if exists trg_user_point_accounts_updated_at on public.user_point_accounts;
create trigger trg_user_point_accounts_updated_at
before update on public.user_point_accounts
for each row execute function public.set_updated_at_mypage_core();

alter table public.user_watchlists enable row level security;
alter table public.user_expenses enable row level security;
alter table public.user_insurances enable row level security;
alter table public.user_finance_profiles enable row level security;
alter table public.user_asset_positions enable row level security;
alter table public.user_point_accounts enable row level security;

drop policy if exists "watchlists_owner_select" on public.user_watchlists;
create policy "watchlists_owner_select"
on public.user_watchlists
for select
using (auth.uid() = user_id);

drop policy if exists "watchlists_owner_insert" on public.user_watchlists;
create policy "watchlists_owner_insert"
on public.user_watchlists
for insert
with check (auth.uid() = user_id);

drop policy if exists "watchlists_owner_delete" on public.user_watchlists;
create policy "watchlists_owner_delete"
on public.user_watchlists
for delete
using (auth.uid() = user_id);

drop policy if exists "watchlists_owner_update" on public.user_watchlists;
create policy "watchlists_owner_update"
on public.user_watchlists
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "expenses_owner_select" on public.user_expenses;
create policy "expenses_owner_select"
on public.user_expenses
for select
using (auth.uid() = user_id);

drop policy if exists "expenses_owner_insert" on public.user_expenses;
create policy "expenses_owner_insert"
on public.user_expenses
for insert
with check (auth.uid() = user_id);

drop policy if exists "expenses_owner_update" on public.user_expenses;
create policy "expenses_owner_update"
on public.user_expenses
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "expenses_owner_delete" on public.user_expenses;
create policy "expenses_owner_delete"
on public.user_expenses
for delete
using (auth.uid() = user_id);

drop policy if exists "insurances_owner_select" on public.user_insurances;
create policy "insurances_owner_select"
on public.user_insurances
for select
using (auth.uid() = user_id);

drop policy if exists "insurances_owner_insert" on public.user_insurances;
create policy "insurances_owner_insert"
on public.user_insurances
for insert
with check (auth.uid() = user_id);

drop policy if exists "insurances_owner_update" on public.user_insurances;
create policy "insurances_owner_update"
on public.user_insurances
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "insurances_owner_delete" on public.user_insurances;
create policy "insurances_owner_delete"
on public.user_insurances
for delete
using (auth.uid() = user_id);

drop policy if exists "finance_profile_owner_select" on public.user_finance_profiles;
create policy "finance_profile_owner_select"
on public.user_finance_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "finance_profile_owner_insert" on public.user_finance_profiles;
create policy "finance_profile_owner_insert"
on public.user_finance_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "finance_profile_owner_update" on public.user_finance_profiles;
create policy "finance_profile_owner_update"
on public.user_finance_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "finance_profile_owner_delete" on public.user_finance_profiles;
create policy "finance_profile_owner_delete"
on public.user_finance_profiles
for delete
using (auth.uid() = user_id);

drop policy if exists "asset_positions_owner_select" on public.user_asset_positions;
create policy "asset_positions_owner_select"
on public.user_asset_positions
for select
using (auth.uid() = user_id);

drop policy if exists "asset_positions_owner_insert" on public.user_asset_positions;
create policy "asset_positions_owner_insert"
on public.user_asset_positions
for insert
with check (auth.uid() = user_id);

drop policy if exists "asset_positions_owner_update" on public.user_asset_positions;
create policy "asset_positions_owner_update"
on public.user_asset_positions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "asset_positions_owner_delete" on public.user_asset_positions;
create policy "asset_positions_owner_delete"
on public.user_asset_positions
for delete
using (auth.uid() = user_id);

drop policy if exists "point_accounts_owner_select" on public.user_point_accounts;
create policy "point_accounts_owner_select"
on public.user_point_accounts
for select
using (auth.uid() = user_id);

drop policy if exists "point_accounts_owner_insert" on public.user_point_accounts;
create policy "point_accounts_owner_insert"
on public.user_point_accounts
for insert
with check (auth.uid() = user_id);

drop policy if exists "point_accounts_owner_update" on public.user_point_accounts;
create policy "point_accounts_owner_update"
on public.user_point_accounts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "point_accounts_owner_delete" on public.user_point_accounts;
create policy "point_accounts_owner_delete"
on public.user_point_accounts
for delete
using (auth.uid() = user_id);
