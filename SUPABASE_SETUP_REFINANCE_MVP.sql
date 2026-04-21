-- MoneyMart 2.0 - AI KariKae (Refinance) MVP schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.loan_refinance_products (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  product_name text not null,
  apr_min numeric(6,3) not null check (apr_min >= 0),
  apr_max numeric(6,3) not null check (apr_max >= apr_min),
  fees_yen integer not null default 0 check (fees_yen >= 0),
  min_amount_yen integer not null default 0 check (min_amount_yen >= 0),
  max_amount_yen integer not null default 100000000 check (max_amount_yen >= min_amount_yen),
  apply_url text not null default '',
  source_type text not null default 'manual' check (source_type in ('manual', 'scrape')),
  notes text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_name, product_name)
);

create index if not exists idx_refinance_products_active_apr
  on public.loan_refinance_products (is_active, apr_min asc, updated_at desc);

create table if not exists public.user_revolving_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_yen integer not null default 0 check (balance_yen >= 0),
  apr numeric(6,3) not null default 15.000 check (apr >= 0),
  monthly_payment_yen integer not null default 0 check (monthly_payment_yen >= 0),
  remaining_months_assumed integer not null default 24 check (remaining_months_assumed >= 1 and remaining_months_assumed <= 600),
  refinance_fee_yen integer not null default 0 check (refinance_fee_yen >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_revolving_profiles_updated
  on public.user_revolving_profiles (updated_at desc);

create table if not exists public.refinance_simulations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  best_product_id uuid references public.loan_refinance_products(id) on delete set null,
  current_total_cost_24m integer not null default 0,
  best_offer_total_cost_24m integer not null default 0,
  savings_24m integer not null default 0,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_refinance_simulations_user_created
  on public.refinance_simulations (user_id, created_at desc);

create or replace function public.set_updated_at_refinance_mvp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_refinance_products_updated_at on public.loan_refinance_products;
create trigger trg_refinance_products_updated_at
before update on public.loan_refinance_products
for each row execute function public.set_updated_at_refinance_mvp();

drop trigger if exists trg_user_revolving_profiles_updated_at on public.user_revolving_profiles;
create trigger trg_user_revolving_profiles_updated_at
before update on public.user_revolving_profiles
for each row execute function public.set_updated_at_refinance_mvp();

alter table public.loan_refinance_products enable row level security;
alter table public.user_revolving_profiles enable row level security;
alter table public.refinance_simulations enable row level security;

drop policy if exists "refinance_products_read_authenticated" on public.loan_refinance_products;
create policy "refinance_products_read_authenticated"
on public.loan_refinance_products
for select
to authenticated
using (is_active = true or exists (
  select 1
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and ur.role = 'admin'
));

drop policy if exists "refinance_products_admin_manage" on public.loan_refinance_products;
create policy "refinance_products_admin_manage"
on public.loan_refinance_products
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

drop policy if exists "revolving_profiles_owner_select" on public.user_revolving_profiles;
create policy "revolving_profiles_owner_select"
on public.user_revolving_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "revolving_profiles_owner_upsert" on public.user_revolving_profiles;
create policy "revolving_profiles_owner_upsert"
on public.user_revolving_profiles
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "refinance_simulations_owner_read" on public.refinance_simulations;
create policy "refinance_simulations_owner_read"
on public.refinance_simulations
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "refinance_simulations_owner_insert" on public.refinance_simulations;
create policy "refinance_simulations_owner_insert"
on public.refinance_simulations
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "refinance_simulations_admin_read" on public.refinance_simulations;
create policy "refinance_simulations_admin_read"
on public.refinance_simulations
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
