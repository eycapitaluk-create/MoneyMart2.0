-- MoneyMart 2.0 - Academy launch schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table if not exists public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  youtube_url text not null default '',
  category_key text not null default 'general',
  level text not null default '初級' check (level in ('初級', '中級', '上級')),
  duration_seconds integer not null default 600,
  thumbnail_style text not null default 'bg-slate-500',
  tutor_name text not null default 'MoneyMart Academy',
  view_count integer not null default 0,
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  is_published boolean not null default true,
  display_order integer not null default 999,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academy_courses
  add column if not exists youtube_url text not null default '';

create index if not exists idx_academy_courses_published_order
  on public.academy_courses (is_published, display_order, created_at desc);
create index if not exists idx_academy_courses_category
  on public.academy_courses (category_key, is_published, display_order);

-- ---------------------------------------------------------------------------
-- quizzes (metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.academy_quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level text not null default '初級' check (level in ('初級', '中級', '上級')),
  question_count integer not null default 10,
  is_published boolean not null default true,
  display_order integer not null default 999,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_academy_quizzes_published_order
  on public.academy_quizzes (is_published, display_order, created_at desc);

-- ---------------------------------------------------------------------------
-- progress
-- ---------------------------------------------------------------------------
create table if not exists public.academy_progress (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  progress_pct integer not null default 0 check (progress_pct between 0 and 100),
  last_watched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists idx_academy_progress_user_updated
  on public.academy_progress (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at_academy()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_academy_courses_updated_at on public.academy_courses;
create trigger trg_academy_courses_updated_at
before update on public.academy_courses
for each row execute function public.set_updated_at_academy();

drop trigger if exists trg_academy_quizzes_updated_at on public.academy_quizzes;
create trigger trg_academy_quizzes_updated_at
before update on public.academy_quizzes
for each row execute function public.set_updated_at_academy();

drop trigger if exists trg_academy_progress_updated_at on public.academy_progress;
create trigger trg_academy_progress_updated_at
before update on public.academy_progress
for each row execute function public.set_updated_at_academy();

-- ---------------------------------------------------------------------------
-- rls
-- ---------------------------------------------------------------------------
alter table public.academy_courses enable row level security;
alter table public.academy_quizzes enable row level security;
alter table public.academy_progress enable row level security;

drop policy if exists "academy_courses_public_read" on public.academy_courses;
create policy "academy_courses_public_read"
on public.academy_courses
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "academy_courses_admin_manage" on public.academy_courses;
create policy "academy_courses_admin_manage"
on public.academy_courses
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

drop policy if exists "academy_quizzes_public_read" on public.academy_quizzes;
create policy "academy_quizzes_public_read"
on public.academy_quizzes
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "academy_quizzes_admin_manage" on public.academy_quizzes;
create policy "academy_quizzes_admin_manage"
on public.academy_quizzes
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

drop policy if exists "academy_progress_owner_read" on public.academy_progress;
create policy "academy_progress_owner_read"
on public.academy_progress
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "academy_progress_owner_write" on public.academy_progress;
create policy "academy_progress_owner_write"
on public.academy_progress
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "academy_progress_admin_read" on public.academy_progress;
create policy "academy_progress_admin_read"
on public.academy_progress
for select
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
);

