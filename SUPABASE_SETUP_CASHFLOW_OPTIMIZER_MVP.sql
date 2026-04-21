-- MoneyMart 2.0 - Cash Flow Optimizer MVP schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.user_cashflow_optimizer_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year integer not null check (tax_year >= 2024 and tax_year <= 2100),
  cash_balance_yen integer not null default 0 check (cash_balance_yen >= 0),
  current_cash_rate numeric(8,5) not null default 0.00100 check (current_cash_rate >= 0 and current_cash_rate <= 1),
  high_yield_cash_rate numeric(8,5) not null default 0.00300 check (high_yield_cash_rate >= 0 and high_yield_cash_rate <= 1),
  reserve_month_multiplier numeric(8,3) not null default 1.500 check (reserve_month_multiplier >= 0.500 and reserve_month_multiplier <= 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tax_year)
);

create index if not exists idx_user_cashflow_optimizer_profiles_updated
  on public.user_cashflow_optimizer_profiles (updated_at desc);

create table if not exists public.cashflow_optimizer_simulations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year integer not null check (tax_year >= 2024 and tax_year <= 2100),
  reserve_target_yen integer not null default 0 check (reserve_target_yen >= 0),
  idle_cash_yen integer not null default 0 check (idle_cash_yen >= 0),
  additional_interest_yen integer not null default 0 check (additional_interest_yen >= 0),
  status text not null default 'optimized' check (status in ('opportunity', 'buffer_shortage', 'optimized')),
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cashflow_optimizer_sim_user_created
  on public.cashflow_optimizer_simulations (user_id, created_at desc);

create or replace function public.set_updated_at_cashflow_optimizer_mvp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_cashflow_optimizer_profiles_updated_at on public.user_cashflow_optimizer_profiles;
create trigger trg_user_cashflow_optimizer_profiles_updated_at
before update on public.user_cashflow_optimizer_profiles
for each row execute function public.set_updated_at_cashflow_optimizer_mvp();

alter table public.user_cashflow_optimizer_profiles enable row level security;
alter table public.cashflow_optimizer_simulations enable row level security;

drop policy if exists "cashflow_optimizer_profiles_owner_select" on public.user_cashflow_optimizer_profiles;
create policy "cashflow_optimizer_profiles_owner_select"
on public.user_cashflow_optimizer_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "cashflow_optimizer_profiles_owner_upsert" on public.user_cashflow_optimizer_profiles;
create policy "cashflow_optimizer_profiles_owner_upsert"
on public.user_cashflow_optimizer_profiles
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "cashflow_optimizer_sim_owner_read" on public.cashflow_optimizer_simulations;
create policy "cashflow_optimizer_sim_owner_read"
on public.cashflow_optimizer_simulations
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "cashflow_optimizer_sim_owner_insert" on public.cashflow_optimizer_simulations;
create policy "cashflow_optimizer_sim_owner_insert"
on public.cashflow_optimizer_simulations
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "cashflow_optimizer_sim_admin_read" on public.cashflow_optimizer_simulations;
create policy "cashflow_optimizer_sim_admin_read"
on public.cashflow_optimizer_simulations
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);
