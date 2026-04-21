-- Manual earnings calendar table for Admin CRUD
create extension if not exists pgcrypto;

create table if not exists public.earnings_calendar_manual (
  id uuid primary key default gen_random_uuid(),
  region text not null check (region in ('US', 'JP', 'UK', 'EU')),
  symbol text not null,
  company text not null,
  when_text text not null,
  phase text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_earnings_calendar_manual_region_active
  on public.earnings_calendar_manual(region, is_active, sort_order, symbol);

create or replace function public.set_updated_at_earnings_calendar_manual()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_earnings_calendar_manual on public.earnings_calendar_manual;
create trigger trg_set_updated_at_earnings_calendar_manual
before update on public.earnings_calendar_manual
for each row
execute function public.set_updated_at_earnings_calendar_manual();

alter table public.earnings_calendar_manual enable row level security;

drop policy if exists "earnings_calendar_manual_select_all" on public.earnings_calendar_manual;
create policy "earnings_calendar_manual_select_all"
on public.earnings_calendar_manual
for select
to anon, authenticated
using (true);

drop policy if exists "earnings_calendar_manual_write_authenticated" on public.earnings_calendar_manual;
create policy "earnings_calendar_manual_write_authenticated"
on public.earnings_calendar_manual
for all
to authenticated
using (true)
with check (true);

