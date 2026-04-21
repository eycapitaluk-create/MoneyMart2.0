-- MoneyMart 2.0 - Tax-Shield MVP schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.tax_shield_rules (
  id uuid primary key default gen_random_uuid(),
  tax_year integer not null check (tax_year >= 2024 and tax_year <= 2100),
  deduction_type text not null check (deduction_type in ('ideco', 'nisa', 'insurance')),
  cap_yen integer not null default 0 check (cap_yen >= 0),
  deduction_rate numeric(8,5) not null default 0.10000 check (deduction_rate >= 0 and deduction_rate <= 1),
  deadline_month integer not null default 12 check (deadline_month >= 1 and deadline_month <= 12),
  deadline_day integer not null default 31 check (deadline_day >= 1 and deadline_day <= 31),
  note text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tax_year, deduction_type)
);

create index if not exists idx_tax_shield_rules_active_year
  on public.tax_shield_rules (is_active, tax_year desc, sort_order asc);

create table if not exists public.user_tax_shield_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year integer not null check (tax_year >= 2024 and tax_year <= 2100),
  annual_income_yen integer not null default 0 check (annual_income_yen >= 0),
  ideco_paid_yen integer not null default 0 check (ideco_paid_yen >= 0),
  nisa_paid_yen integer not null default 0 check (nisa_paid_yen >= 0),
  insurance_paid_yen integer not null default 0 check (insurance_paid_yen >= 0),
  deduction_reflected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tax_year)
);

create index if not exists idx_user_tax_shield_profiles_updated
  on public.user_tax_shield_profiles (updated_at desc);

create table if not exists public.tax_shield_simulations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year integer not null check (tax_year >= 2024 and tax_year <= 2100),
  estimated_deduction_yen integer not null default 0,
  potential_tax_saving_yen integer not null default 0,
  status text not null default 'opportunity' check (status in ('opportunity', 'deadline_soon', 'limit_exceeded', 'optimized')),
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_shield_sim_user_created
  on public.tax_shield_simulations (user_id, created_at desc);

create or replace function public.set_updated_at_tax_shield_mvp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tax_shield_rules_updated_at on public.tax_shield_rules;
create trigger trg_tax_shield_rules_updated_at
before update on public.tax_shield_rules
for each row execute function public.set_updated_at_tax_shield_mvp();

drop trigger if exists trg_user_tax_shield_profiles_updated_at on public.user_tax_shield_profiles;
create trigger trg_user_tax_shield_profiles_updated_at
before update on public.user_tax_shield_profiles
for each row execute function public.set_updated_at_tax_shield_mvp();

alter table public.tax_shield_rules enable row level security;
alter table public.user_tax_shield_profiles enable row level security;
alter table public.tax_shield_simulations enable row level security;

drop policy if exists "tax_shield_rules_read_authenticated" on public.tax_shield_rules;
create policy "tax_shield_rules_read_authenticated"
on public.tax_shield_rules
for select
to authenticated
using (is_active = true or exists (
  select 1
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and ur.role = 'admin'
));

drop policy if exists "tax_shield_rules_admin_manage" on public.tax_shield_rules;
create policy "tax_shield_rules_admin_manage"
on public.tax_shield_rules
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists "tax_shield_profiles_owner_select" on public.user_tax_shield_profiles;
create policy "tax_shield_profiles_owner_select"
on public.user_tax_shield_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "tax_shield_profiles_owner_upsert" on public.user_tax_shield_profiles;
create policy "tax_shield_profiles_owner_upsert"
on public.user_tax_shield_profiles
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "tax_shield_sim_owner_read" on public.tax_shield_simulations;
create policy "tax_shield_sim_owner_read"
on public.tax_shield_simulations
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "tax_shield_sim_owner_insert" on public.tax_shield_simulations;
create policy "tax_shield_sim_owner_insert"
on public.tax_shield_simulations
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "tax_shield_sim_admin_read" on public.tax_shield_simulations;
create policy "tax_shield_sim_admin_read"
on public.tax_shield_simulations
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
