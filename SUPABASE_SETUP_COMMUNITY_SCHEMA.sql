-- MoneyMart Lounge - Community schema (new naming)
-- Run in Supabase SQL editor.

begin;

create extension if not exists pgcrypto;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'insight' check (type in ('insight', 'question')),
  content text not null,
  asset_tag text,
  sentiment text not null default 'neutral' check (sentiment in ('bullish', 'neutral', 'bearish')),
  view_count integer not null default 0,
  hot_score numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_posts_created_at on public.community_posts (created_at desc);
create index if not exists idx_community_posts_user_id on public.community_posts (user_id, created_at desc);
create index if not exists idx_community_posts_asset_tag on public.community_posts (asset_tag);

create table if not exists public.post_engagements (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('insightful', 'comment', 'bookmark')),
  content text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_post_engagements_post on public.post_engagements (post_id, created_at desc);
create index if not exists idx_post_engagements_user on public.post_engagements (user_id, created_at desc);
create index if not exists idx_post_engagements_type on public.post_engagements (type, created_at desc);

create unique index if not exists uniq_post_engagements_insightful
  on public.post_engagements(post_id, user_id, type)
  where type = 'insightful';

create unique index if not exists uniq_post_engagements_bookmark
  on public.post_engagements(post_id, user_id, type)
  where type = 'bookmark';

create or replace view public.trending_assets
with (security_invoker = true)
as
select
  coalesce(nullif(cp.asset_tag, ''), 'TOPIC') as asset_tag,
  count(*)::int as mention_count,
  max(cp.created_at) as last_mentioned_at
from public.community_posts cp
where cp.created_at >= now() - interval '14 days'
group by coalesce(nullif(cp.asset_tag, ''), 'TOPIC');

grant select on public.trending_assets to anon, authenticated;
grant select on public.community_posts to anon, authenticated;
grant select on public.post_engagements to authenticated;

alter table public.community_posts enable row level security;
alter table public.post_engagements enable row level security;

drop policy if exists "community_posts_public_read" on public.community_posts;
create policy "community_posts_public_read"
on public.community_posts
for select
to anon, authenticated
using (true);

drop policy if exists "community_posts_owner_insert" on public.community_posts;
create policy "community_posts_owner_insert"
on public.community_posts
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "community_posts_owner_update" on public.community_posts;
create policy "community_posts_owner_update"
on public.community_posts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "community_posts_owner_delete" on public.community_posts;
create policy "community_posts_owner_delete"
on public.community_posts
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "post_engagements_read_auth" on public.post_engagements;
create policy "post_engagements_read_auth"
on public.post_engagements
for select
to authenticated
using (true);

drop policy if exists "post_engagements_owner_insert" on public.post_engagements;
create policy "post_engagements_owner_insert"
on public.post_engagements
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "post_engagements_owner_delete" on public.post_engagements;
create policy "post_engagements_owner_delete"
on public.post_engagements
for delete
to authenticated
using (user_id = auth.uid());

commit;
