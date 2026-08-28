-- MoneyMart 2.0 - Lounge: Reply-to comments + Post images
-- Run in Supabase SQL Editor.

-- 1) Add reply columns to lounge_comments
alter table public.lounge_comments
  add column if not exists parent_comment_id uuid references public.lounge_comments(id) on delete cascade,
  add column if not exists reply_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists reply_to_name text;

create index if not exists idx_lounge_comments_parent
  on public.lounge_comments (parent_comment_id)
  where parent_comment_id is not null;

-- 2) Add image_url to lounge_posts
alter table public.lounge_posts
  add column if not exists image_url text;

-- 3) Update comment notification: when replying, notify the comment author (not post author)
create or replace function public.create_lounge_notification_comment()
returns trigger
language plpgsql
as $$
declare
  target_user uuid;
begin
  if new.parent_comment_id is not null and new.reply_to_user_id is not null and new.reply_to_user_id <> new.author_id then
    insert into public.lounge_notifications (user_id, actor_id, type, post_id, comment_id, payload)
    values (new.reply_to_user_id, new.author_id, 'comment', new.post_id, new.id, jsonb_build_object('event', 'comment_reply', 'reply_to', new.reply_to_name));
    return new;
  end if;
  select author_id into target_user from public.lounge_posts where id = new.post_id;
  if target_user is not null and target_user <> new.author_id then
    insert into public.lounge_notifications (user_id, actor_id, type, post_id, comment_id, payload)
    values (target_user, new.author_id, 'comment', new.post_id, new.id, jsonb_build_object('event', 'post_commented'));
  end if;
  return new;
end;
$$;

-- 4) Storage: Create bucket "lounge-images" in Supabase Dashboard > Storage > New bucket (public)
--    Then add policy: authenticated users can INSERT, anon/authenticated can SELECT
