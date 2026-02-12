-- MoneyMart 2.0 - prime waitlist
-- Run in Supabase SQL editor.

create table if not exists public.prime_waitlist (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  plan_preference text not null default 'yearly' check (plan_preference in ('monthly', 'yearly')),
  source text not null default 'prime_page',
  created_at timestamptz not null default now()
);

create unique index if not exists ux_prime_waitlist_email
  on public.prime_waitlist (lower(email));

create index if not exists idx_prime_waitlist_created
  on public.prime_waitlist (created_at desc);

alter table public.prime_waitlist enable row level security;

-- MVP: allow public submit, admin reads/manages.
drop policy if exists "prime_waitlist_public_insert" on public.prime_waitlist;
create policy "prime_waitlist_public_insert"
on public.prime_waitlist
for insert
to anon, authenticated
with check (true);

drop policy if exists "prime_waitlist_admin_manage" on public.prime_waitlist;
create policy "prime_waitlist_admin_manage"
on public.prime_waitlist
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
