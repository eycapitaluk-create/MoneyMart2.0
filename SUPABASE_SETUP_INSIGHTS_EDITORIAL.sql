-- MoneyMart 2.0 - Insights editorial CMS table
-- Run in Supabase SQL Editor.

create table if not exists public.insights_editorial (
  id bigserial primary key,
  featured boolean not null default false,
  target text not null default '',
  category text not null default '',
  headline text not null,
  summary text not null,
  idea text not null default '',
  rationale text not null default '',
  data jsonb not null default '[]'::jsonb,
  data_note text not null default '',
  risk text not null default '',
  related_tools text[] not null default '{}'::text[],
  published_at timestamptz not null default now(),
  read_time text not null default '5分',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_insights_editorial_active_published
  on public.insights_editorial (is_active, published_at desc);

create index if not exists idx_insights_editorial_featured_sort
  on public.insights_editorial (featured desc, sort_order asc, published_at desc);

create or replace function public.set_insights_editorial_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_insights_editorial_updated_at on public.insights_editorial;
create trigger trg_insights_editorial_updated_at
before update on public.insights_editorial
for each row
execute function public.set_insights_editorial_updated_at();

alter table public.insights_editorial enable row level security;

-- Public read for insights page
drop policy if exists "insights_editorial_public_read" on public.insights_editorial;
create policy "insights_editorial_public_read"
on public.insights_editorial
for select
to public
using (is_active = true);

-- Admin write: requires public.user_roles(role='admin')
drop policy if exists "insights_editorial_admin_insert" on public.insights_editorial;
create policy "insights_editorial_admin_insert"
on public.insights_editorial
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists "insights_editorial_admin_update" on public.insights_editorial;
create policy "insights_editorial_admin_update"
on public.insights_editorial
for update
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

drop policy if exists "insights_editorial_admin_delete" on public.insights_editorial;
create policy "insights_editorial_admin_delete"
on public.insights_editorial
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

