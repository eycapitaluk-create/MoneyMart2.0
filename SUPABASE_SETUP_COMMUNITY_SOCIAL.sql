-- MoneyMart 2.0 - Community schema (new naming)
-- Run this in Supabase SQL Editor.
-- This is additive and does not drop existing lounge_* tables.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- community posts
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'insight' check (type in ('insight', 'question')),
  content text not null,
  asset_tag text,
  sentiment text not null default 'neutral' check (sentiment in ('bullish', 'neutral', 'bearish')),
  view_count integer not null default 0,
  hot_score numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_community_posts_created
  on public.community_posts (created_at desc);
create index if not exists idx_community_posts_user
  on public.community_posts (user_id, created_at desc);
create index if not exists idx_community_posts_asset_tag
  on public.community_posts (asset_tag);

-- ---------------------------------------------------------------------------
-- engagements (like/comment/bookmark)
-- ---------------------------------------------------------------------------
create table if not exists public.post_engagements (
  id bigserial primary key,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('insightful', 'comment', 'bookmark')),
  content text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_post_engagements_like
  on public.post_engagements (post_id, user_id, type)
  where type = 'insightful';

create unique index if not exists uq_post_engagements_bookmark
  on public.post_engagements (post_id, user_id, type)
  where type = 'bookmark';

create index if not exists idx_post_engagements_post_type
  on public.post_engagements (post_id, type, created_at desc);
create index if not exists idx_post_engagements_user_type
  on public.post_engagements (user_id, type, created_at desc);

-- ---------------------------------------------------------------------------
-- trending assets view
-- ---------------------------------------------------------------------------
create or replace view public.trending_assets
with (security_invoker = true)
as
select
  p.asset_tag,
  count(distinct p.id)::int as post_count,
  count(e.id)::int as mention_count,
  max(p.created_at) as last_posted_at
from public.community_posts p
left join public.post_engagements e on e.post_id = p.id
where p.asset_tag is not null
  and p.asset_tag <> ''
  and p.created_at >= now() - interval '14 days'
group by p.asset_tag;

grant select on public.trending_assets to anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at_community()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_community_posts_updated_at on public.community_posts;
create trigger trg_community_posts_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at_community();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
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

drop policy if exists "post_engagements_public_read" on public.post_engagements;
create policy "post_engagements_public_read"
on public.post_engagements
for select
to anon, authenticated
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
