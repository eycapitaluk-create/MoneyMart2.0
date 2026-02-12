-- MoneyMart 2.0 - support inquiry storage
-- Run this in Supabase SQL Editor.

create table if not exists public.support_inquiries (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  message text not null,
  source text not null default 'chatbot',
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_support_inquiries_created
  on public.support_inquiries (created_at desc);

create index if not exists idx_support_inquiries_status
  on public.support_inquiries (status, created_at desc);

alter table public.support_inquiries enable row level security;

-- Anyone can submit inquiries (MVP), only authenticated owner can read own rows.
drop policy if exists "support_inquiries_public_insert" on public.support_inquiries;
create policy "support_inquiries_public_insert"
on public.support_inquiries
for insert
to anon, authenticated
with check (true);

drop policy if exists "support_inquiries_owner_read" on public.support_inquiries;
create policy "support_inquiries_owner_read"
on public.support_inquiries
for select
to authenticated
using (user_id = auth.uid());

-- Admin-only read/update (requires user_roles table from setup SQL).
drop policy if exists "support_inquiries_admin_manage" on public.support_inquiries;
create policy "support_inquiries_admin_manage"
on public.support_inquiries
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
