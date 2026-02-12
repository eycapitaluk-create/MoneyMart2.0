-- MoneyMart 2.0 - simulator core tables
-- Run in Supabase SQL Editor.

create table if not exists public.simulator_assumptions (
  id bigserial primary key,
  config_key text not null unique,
  config_value jsonb not null default '{}'::jsonb,
  version text not null default 'v1',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.simulator_runs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  page text not null,
  simulator_type text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  assumption_version text not null default 'v1',
  created_at timestamptz not null default now()
);
create index if not exists idx_simulator_runs_user_created
  on public.simulator_runs (user_id, created_at desc);

create table if not exists public.user_scenarios (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_name text not null,
  target_page text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_user_scenarios_user_updated
  on public.user_scenarios (user_id, updated_at desc);

create or replace function public.set_updated_at_user_scenarios()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_scenarios_updated_at on public.user_scenarios;
create trigger trg_user_scenarios_updated_at
before update on public.user_scenarios
for each row execute function public.set_updated_at_user_scenarios();

alter table public.simulator_assumptions enable row level security;
alter table public.simulator_runs enable row level security;
alter table public.user_scenarios enable row level security;

drop policy if exists "sim_assumptions_admin_read" on public.simulator_assumptions;
create policy "sim_assumptions_admin_read"
on public.simulator_assumptions
for select
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
);

drop policy if exists "sim_assumptions_admin_write" on public.simulator_assumptions;
create policy "sim_assumptions_admin_write"
on public.simulator_assumptions
for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
);

drop policy if exists "sim_runs_owner_read" on public.simulator_runs;
create policy "sim_runs_owner_read"
on public.simulator_runs
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "sim_runs_owner_insert" on public.simulator_runs;
create policy "sim_runs_owner_insert"
on public.simulator_runs
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "sim_runs_admin_read" on public.simulator_runs;
create policy "sim_runs_admin_read"
on public.simulator_runs
for select
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
);

drop policy if exists "user_scenarios_owner_read" on public.user_scenarios;
create policy "user_scenarios_owner_read"
on public.user_scenarios
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_scenarios_owner_write" on public.user_scenarios;
create policy "user_scenarios_owner_write"
on public.user_scenarios
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
