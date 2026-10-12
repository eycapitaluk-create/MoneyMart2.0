-- Fix: lounge_comments INSERT fails with
--   record "new" has no field "actor_name" (42703)
-- Causes:
--   1) create_lounge_notification_comment() must use NEW.author_name (not actor_name).
--   2) notify_community_insert() on lounge_notifications references NEW.actor_name,
--      but that table only has actor_id + payload (author_name in payload JSON).
-- Run in Supabase SQL editor, then re-run:
--   node scripts/backfill-aug2-lounge-comments.mjs

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
    values (
      target_user,
      new.author_id,
      'comment',
      new.post_id,
      new.id,
      jsonb_build_object('event', 'post_commented', 'author_name', new.author_name)
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_community_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  fn_url text := 'https://uyrqwsttzktuobunvedu.supabase.co/functions/v1/notify-community';
  actor_name text;
begin
  if new.user_id is null or new.user_id = new.actor_id then
    return new;
  end if;

  actor_name := coalesce(
    nullif(trim(new.payload->>'author_name'), ''),
    (
      select coalesce(nullif(trim(up.nickname), ''), nullif(trim(up.full_name), ''))
      from public.user_profiles up
      where up.user_id = new.actor_id
      limit 1
    ),
    ''
  );

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'notif_id',   new.id::text,
      'user_id',    new.user_id::text,
      'actor_name', actor_name,
      'type',       new.type,
      'post_id',    coalesce(new.post_id::text, ''),
      'comment_id', coalesce(new.comment_id::text, '')
    )
  );
  return new;
end;
$function$;
