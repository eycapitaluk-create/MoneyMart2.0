-- Allow 'badge' type in lounge_notifications (週間チャレンジ達成用)
-- Run in Supabase SQL Editor once.

alter table public.lounge_notifications drop constraint if exists lounge_notifications_type_check;
alter table public.lounge_notifications
  add constraint lounge_notifications_type_check
  check (type in ('like', 'comment', 'follow', 'moderation', 'badge'));
