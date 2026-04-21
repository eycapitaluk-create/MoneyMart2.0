-- MoneyMart 2.0 - User revolving debts (list per user, add/edit/delete)
-- Run in Supabase SQL Editor after SUPABASE_SETUP_REFINANCE_MVP.sql

create table if not exists public.user_revolving_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default '',
  balance_yen integer not null default 0 check (balance_yen >= 0),
  interest_rate numeric(6,3) not null default 0 check (interest_rate >= 0),
  monthly_payment_yen integer not null default 0 check (monthly_payment_yen >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_revolving_debts_user
  on public.user_revolving_debts (user_id, updated_at desc);

create or replace function public.set_updated_at_revolving_debts()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_revolving_debts_updated_at on public.user_revolving_debts;
create trigger trg_user_revolving_debts_updated_at
before update on public.user_revolving_debts
for each row execute function public.set_updated_at_revolving_debts();

alter table public.user_revolving_debts enable row level security;

drop policy if exists "revolving_debts_owner_all" on public.user_revolving_debts;
create policy "revolving_debts_owner_all"
on public.user_revolving_debts
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
