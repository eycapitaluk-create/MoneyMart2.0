-- Fix lounge/community like, comment, and follow rollbacks under RLS.
-- Run in Supabase SQL Editor (project owner). Idempotent.
--
-- Root cause: AFTER INSERT triggers on lounge_post_likes / lounge_comments /
-- lounge_user_follows run as the acting user (SECURITY INVOKER). They try to:
--   1) INSERT lounge_notifications for the *other* user (no INSERT policy)
--   2) UPDATE lounge_posts.like_count / comment_count on another author's row
-- RLS denies those writes, so the original like/comment/follow is rolled back.
-- CommunityPage uses preferLounge: true, so this hits the live /community feed.
--
-- Same class of bug: following a public portfolio cannot bump follower_count
-- because portfolios_owner_update requires user_id = auth.uid().

create or replace function public.refresh_lounge_post_stats()
returns trigger
language plpgsql
security definer
set search_path = public
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

create or replace function public.create_lounge_notification_like()
returns trigger
language plpgsql
security definer
set search_path = public
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

create or replace function public.create_lounge_notification_comment()
returns trigger
language plpgsql
security definer
set search_path = public
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

create or replace function public.create_lounge_notification_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.follower_id <> new.following_id then
    insert into public.lounge_notifications (user_id, actor_id, type, payload)
    values (new.following_id, new.follower_id, 'follow', jsonb_build_object('event', 'followed'));
  end if;
  return new;
end;
$$;

-- Client-side badge inserts (own user_id only). Trigger inserts for other users
-- still go through SECURITY DEFINER above and do not rely on this policy.
drop policy if exists "lounge_notifications_owner_insert" on public.lounge_notifications;
create policy "lounge_notifications_owner_insert"
on public.lounge_notifications
for insert
to authenticated
with check (user_id = auth.uid());

create or replace function public.refresh_portfolio_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.portfolios p
  set follower_count = (
    select count(*)::int from public.portfolio_follows f
    where f.portfolio_id = coalesce(new.portfolio_id, old.portfolio_id)
  )
  where p.id = coalesce(new.portfolio_id, old.portfolio_id);
  return coalesce(new, old);
end;
$$;
