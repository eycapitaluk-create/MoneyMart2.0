-- MoneyMart — Research / Insight articles (JSON document → editorial UI)
-- Run in Supabase SQL Editor after user_roles exists.

create table if not exists public.insight_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  page_title text not null default 'Insight',
  document jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_insight_articles_published
  on public.insight_articles (is_published, published_at desc nulls last);

create or replace function public.set_updated_at_insight_articles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    if new.is_published = true and new.published_at is null then
      new.published_at = now();
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_published = true and coalesce(old.is_published, false) = false and new.published_at is null then
      new.published_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_insight_articles_updated_at on public.insight_articles;
create trigger trg_insight_articles_updated_at
before update on public.insight_articles
for each row execute function public.set_updated_at_insight_articles();

alter table public.insight_articles enable row level security;

drop policy if exists "insight_articles_public_read" on public.insight_articles;
create policy "insight_articles_public_read"
on public.insight_articles
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "insight_articles_admin_manage" on public.insight_articles;
create policy "insight_articles_admin_manage"
on public.insight_articles
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

-- ============================================================================
-- オプション: デモ記事1件を入れる場合は、別ファイル全体を実行してください。
--   파일: SUPABASE_SEED_INSIGHT_SAMPLE.sql
-- Supabase SQL Editor で「New query」にそのファイルを貼り付け → Run
-- （ここに INSERT を長く書くとメンテが二重になるため、シードは分離しています）
-- ============================================================================
