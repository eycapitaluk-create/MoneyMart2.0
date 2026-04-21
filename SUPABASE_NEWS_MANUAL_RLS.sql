-- news_manual RLS: public read, admin write
-- Run in Supabase SQL Editor. Requires user_roles table with role='admin'.

-- Grant admin role to designated MoneyMart admins
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email in ('justin.nam@moneymart.co.jp', 'kelly.nam@moneymart.co.jp')
on conflict (user_id) do update set role = 'admin';

alter table public.news_manual enable row level security;

-- Public read (anon + authenticated) for news page
drop policy if exists "news_manual_public_read" on public.news_manual;
create policy "news_manual_public_read"
on public.news_manual
for select
to public
using (true);

-- Admin only: insert, update, delete
drop policy if exists "news_manual_admin_insert" on public.news_manual;
create policy "news_manual_admin_insert"
on public.news_manual
for insert
to authenticated
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
);

drop policy if exists "news_manual_admin_update" on public.news_manual;
create policy "news_manual_admin_update"
on public.news_manual
for update
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

drop policy if exists "news_manual_admin_delete" on public.news_manual;
create policy "news_manual_admin_delete"
on public.news_manual
for delete
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
);
