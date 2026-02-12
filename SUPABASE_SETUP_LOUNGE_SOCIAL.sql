-- MoneyMart 2.0 - Lounge full social schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table if not exists public.lounge_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  title text not null,
  content text not null,
  ticker text,
  asset_type text not null default 'general' check (asset_type in ('general', 'stock', 'fund', 'fx', 'crypto')),
  sentiment text not null default 'neutral' check (sentiment in ('bullish', 'neutral', 'bearish')),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  bookmark_count integer not null default 0,
  view_count integer not null default 0,
  hot_score numeric not null default 0,
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lounge_posts_created
  on public.lounge_posts (created_at desc);
create index if not exists idx_lounge_posts_hot
  on public.lounge_posts (hot_score desc, created_at desc);
create index if not exists idx_lounge_posts_status
  on public.lounge_posts (status, created_at desc);
create index if not exists idx_lounge_posts_author
  on public.lounge_posts (author_id, created_at desc);

-- ---------------------------------------------------------------------------
-- post tags
-- ---------------------------------------------------------------------------
create table if not exists public.lounge_post_tags (
  id bigserial primary key,
  post_id uuid not null references public.lounge_posts(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (post_id, tag)
);

create index if not exists idx_lounge_post_tags_tag
  on public.lounge_post_tags (tag);

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create table if not exists public.lounge_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.lounge_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  content text not null,
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lounge_comments_post
  on public.lounge_comments (post_id, created_at asc);
create index if not exists idx_lounge_comments_author
  on public.lounge_comments (author_id, created_at desc);
create index if not exists idx_lounge_comments_status
  on public.lounge_comments (status, created_at desc);

-- ---------------------------------------------------------------------------
-- likes / bookmarks / follows
-- ---------------------------------------------------------------------------
create table if not exists public.lounge_post_likes (
  id bigserial primary key,
  post_id uuid not null references public.lounge_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists idx_lounge_post_likes_user
  on public.lounge_post_likes (user_id, created_at desc);

create table if not exists public.lounge_post_bookmarks (
  id bigserial primary key,
  post_id uuid not null references public.lounge_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists idx_lounge_post_bookmarks_user
  on public.lounge_post_bookmarks (user_id, created_at desc);

create table if not exists public.lounge_user_follows (
  id bigserial primary key,
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists idx_lounge_user_follows_follower
  on public.lounge_user_follows (follower_id);
create index if not exists idx_lounge_user_follows_following
  on public.lounge_user_follows (following_id);

-- ---------------------------------------------------------------------------
-- notifications / reports
-- ---------------------------------------------------------------------------
create table if not exists public.lounge_notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('like', 'comment', 'follow', 'moderation')),
  post_id uuid references public.lounge_posts(id) on delete cascade,
  comment_id uuid references public.lounge_comments(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_lounge_notifications_user
  on public.lounge_notifications (user_id, is_read, created_at desc);

create table if not exists public.lounge_reports (
  id bigserial primary key,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_post_id uuid references public.lounge_posts(id) on delete cascade,
  target_comment_id uuid references public.lounge_comments(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists idx_lounge_reports_status
  on public.lounge_reports (status, created_at desc);
create index if not exists idx_lounge_reports_reporter
  on public.lounge_reports (reporter_id, created_at desc);

-- ---------------------------------------------------------------------------
-- maintenance triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at_lounge()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lounge_posts_updated_at on public.lounge_posts;
create trigger trg_lounge_posts_updated_at
before update on public.lounge_posts
for each row execute function public.set_updated_at_lounge();

drop trigger if exists trg_lounge_comments_updated_at on public.lounge_comments;
create trigger trg_lounge_comments_updated_at
before update on public.lounge_comments
for each row execute function public.set_updated_at_lounge();

create or replace function public.refresh_lounge_post_stats()
returns trigger
language plpgsql
as $$
declare
  target_post uuid;
begin
  target_post := coalesce(new.post_id, old.post_id);

  update public.lounge_posts p
  set
    like_count = (
      select count(*)::int from public.lounge_post_likes l
      where l.post_id = target_post
    ),
    comment_count = (
      select count(*)::int from public.lounge_comments c
      where c.post_id = target_post and c.status = 'published'
    ),
    bookmark_count = (
      select count(*)::int from public.lounge_post_bookmarks b
      where b.post_id = target_post
    ),
    hot_score = (
      (
        select count(*)::numeric * 2 from public.lounge_post_likes l
        where l.post_id = target_post
      ) +
      (
        select count(*)::numeric * 3 from public.lounge_comments c
        where c.post_id = target_post and c.status = 'published'
      ) +
      (
        select count(*)::numeric from public.lounge_post_bookmarks b
        where b.post_id = target_post
      ) +
      greatest(0, 200 - extract(epoch from (now() - p.created_at)) / 3600)
    )
  where p.id = target_post;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_lounge_like_stats_insert on public.lounge_post_likes;
create trigger trg_lounge_like_stats_insert
after insert on public.lounge_post_likes
for each row execute function public.refresh_lounge_post_stats();
drop trigger if exists trg_lounge_like_stats_delete on public.lounge_post_likes;
create trigger trg_lounge_like_stats_delete
after delete on public.lounge_post_likes
for each row execute function public.refresh_lounge_post_stats();

drop trigger if exists trg_lounge_comment_stats_insert on public.lounge_comments;
create trigger trg_lounge_comment_stats_insert
after insert on public.lounge_comments
for each row execute function public.refresh_lounge_post_stats();
drop trigger if exists trg_lounge_comment_stats_update on public.lounge_comments;
create trigger trg_lounge_comment_stats_update
after update of status on public.lounge_comments
for each row execute function public.refresh_lounge_post_stats();
drop trigger if exists trg_lounge_comment_stats_delete on public.lounge_comments;
create trigger trg_lounge_comment_stats_delete
after delete on public.lounge_comments
for each row execute function public.refresh_lounge_post_stats();

drop trigger if exists trg_lounge_bookmark_stats_insert on public.lounge_post_bookmarks;
create trigger trg_lounge_bookmark_stats_insert
after insert on public.lounge_post_bookmarks
for each row execute function public.refresh_lounge_post_stats();
drop trigger if exists trg_lounge_bookmark_stats_delete on public.lounge_post_bookmarks;
create trigger trg_lounge_bookmark_stats_delete
after delete on public.lounge_post_bookmarks
for each row execute function public.refresh_lounge_post_stats();

-- ---------------------------------------------------------------------------
-- notifications triggers
-- ---------------------------------------------------------------------------
create or replace function public.create_lounge_notification_like()
returns trigger
language plpgsql
as $$
declare
  target_user uuid;
begin
  select author_id into target_user from public.lounge_posts where id = new.post_id;
  if target_user is not null and target_user <> new.user_id then
    insert into public.lounge_notifications (user_id, actor_id, type, post_id, payload)
    values (target_user, new.user_id, 'like', new.post_id, jsonb_build_object('event', 'post_liked'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lounge_notify_like on public.lounge_post_likes;
create trigger trg_lounge_notify_like
after insert on public.lounge_post_likes
for each row execute function public.create_lounge_notification_like();

create or replace function public.create_lounge_notification_comment()
returns trigger
language plpgsql
as $$
declare
  target_user uuid;
begin
  select author_id into target_user from public.lounge_posts where id = new.post_id;
  if target_user is not null and target_user <> new.author_id then
    insert into public.lounge_notifications (user_id, actor_id, type, post_id, comment_id, payload)
    values (target_user, new.author_id, 'comment', new.post_id, new.id, jsonb_build_object('event', 'post_commented'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lounge_notify_comment on public.lounge_comments;
create trigger trg_lounge_notify_comment
after insert on public.lounge_comments
for each row execute function public.create_lounge_notification_comment();

create or replace function public.create_lounge_notification_follow()
returns trigger
language plpgsql
as $$
begin
  if new.follower_id <> new.following_id then
    insert into public.lounge_notifications (user_id, actor_id, type, payload)
    values (new.following_id, new.follower_id, 'follow', jsonb_build_object('event', 'followed'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lounge_notify_follow on public.lounge_user_follows;
create trigger trg_lounge_notify_follow
after insert on public.lounge_user_follows
for each row execute function public.create_lounge_notification_follow();

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
alter table public.lounge_posts enable row level security;
alter table public.lounge_post_tags enable row level security;
alter table public.lounge_comments enable row level security;
alter table public.lounge_post_likes enable row level security;
alter table public.lounge_post_bookmarks enable row level security;
alter table public.lounge_user_follows enable row level security;
alter table public.lounge_notifications enable row level security;
alter table public.lounge_reports enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = uid
      and ur.role = 'admin'
  );
$$;

-- posts
drop policy if exists "lounge_posts_public_read" on public.lounge_posts;
create policy "lounge_posts_public_read"
on public.lounge_posts
for select
to anon, authenticated
using (status = 'published' or author_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lounge_posts_owner_insert" on public.lounge_posts;
create policy "lounge_posts_owner_insert"
on public.lounge_posts
for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "lounge_posts_owner_update" on public.lounge_posts;
create policy "lounge_posts_owner_update"
on public.lounge_posts
for update
to authenticated
using (author_id = auth.uid() or public.is_admin(auth.uid()))
with check (author_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lounge_posts_owner_delete" on public.lounge_posts;
create policy "lounge_posts_owner_delete"
on public.lounge_posts
for delete
to authenticated
using (author_id = auth.uid() or public.is_admin(auth.uid()));

-- tags
drop policy if exists "lounge_post_tags_public_read" on public.lounge_post_tags;
create policy "lounge_post_tags_public_read"
on public.lounge_post_tags
for select
to anon, authenticated
using (true);

drop policy if exists "lounge_post_tags_writer_manage" on public.lounge_post_tags;
create policy "lounge_post_tags_writer_manage"
on public.lounge_post_tags
for all
to authenticated
using (
  exists (
    select 1 from public.lounge_posts p
    where p.id = lounge_post_tags.post_id
      and (p.author_id = auth.uid() or public.is_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.lounge_posts p
    where p.id = lounge_post_tags.post_id
      and (p.author_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

-- comments
drop policy if exists "lounge_comments_public_read" on public.lounge_comments;
create policy "lounge_comments_public_read"
on public.lounge_comments
for select
to anon, authenticated
using (
  status = 'published'
  or author_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "lounge_comments_owner_insert" on public.lounge_comments;
create policy "lounge_comments_owner_insert"
on public.lounge_comments
for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "lounge_comments_owner_update" on public.lounge_comments;
create policy "lounge_comments_owner_update"
on public.lounge_comments
for update
to authenticated
using (author_id = auth.uid() or public.is_admin(auth.uid()))
with check (author_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lounge_comments_owner_delete" on public.lounge_comments;
create policy "lounge_comments_owner_delete"
on public.lounge_comments
for delete
to authenticated
using (author_id = auth.uid() or public.is_admin(auth.uid()));

-- likes
drop policy if exists "lounge_post_likes_owner_read" on public.lounge_post_likes;
create policy "lounge_post_likes_owner_read"
on public.lounge_post_likes
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lounge_post_likes_owner_insert" on public.lounge_post_likes;
create policy "lounge_post_likes_owner_insert"
on public.lounge_post_likes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "lounge_post_likes_owner_delete" on public.lounge_post_likes;
create policy "lounge_post_likes_owner_delete"
on public.lounge_post_likes
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- bookmarks
drop policy if exists "lounge_post_bookmarks_owner_read" on public.lounge_post_bookmarks;
create policy "lounge_post_bookmarks_owner_read"
on public.lounge_post_bookmarks
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lounge_post_bookmarks_owner_insert" on public.lounge_post_bookmarks;
create policy "lounge_post_bookmarks_owner_insert"
on public.lounge_post_bookmarks
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "lounge_post_bookmarks_owner_delete" on public.lounge_post_bookmarks;
create policy "lounge_post_bookmarks_owner_delete"
on public.lounge_post_bookmarks
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- follows
drop policy if exists "lounge_user_follows_owner_read" on public.lounge_user_follows;
create policy "lounge_user_follows_owner_read"
on public.lounge_user_follows
for select
to authenticated
using (follower_id = auth.uid() or following_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lounge_user_follows_owner_insert" on public.lounge_user_follows;
create policy "lounge_user_follows_owner_insert"
on public.lounge_user_follows
for insert
to authenticated
with check (follower_id = auth.uid());

drop policy if exists "lounge_user_follows_owner_delete" on public.lounge_user_follows;
create policy "lounge_user_follows_owner_delete"
on public.lounge_user_follows
for delete
to authenticated
using (follower_id = auth.uid() or public.is_admin(auth.uid()));

-- notifications
drop policy if exists "lounge_notifications_owner_read" on public.lounge_notifications;
create policy "lounge_notifications_owner_read"
on public.lounge_notifications
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lounge_notifications_owner_update" on public.lounge_notifications;
create policy "lounge_notifications_owner_update"
on public.lounge_notifications
for update
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

-- reports
drop policy if exists "lounge_reports_owner_insert" on public.lounge_reports;
create policy "lounge_reports_owner_insert"
on public.lounge_reports
for insert
to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "lounge_reports_owner_read" on public.lounge_reports;
create policy "lounge_reports_owner_read"
on public.lounge_reports
for select
to authenticated
using (reporter_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lounge_reports_admin_update" on public.lounge_reports;
create policy "lounge_reports_admin_update"
on public.lounge_reports
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
