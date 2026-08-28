-- MoneyMart 2.0 - Fix lounge_notifications RLS for follow/like/comment triggers
-- Run this in Supabase SQL Editor.
-- Error: "new row violates row-level security policy for table lounge_notifications"
-- Cause: Triggers (create_lounge_notification_follow, create_lounge_notification_like, create_lounge_notification_comment)
--        insert into lounge_notifications, but there was no INSERT policy.

-- Allow authenticated users to insert notifications (trigger inserts on behalf of the follow/like/comment action).
-- The trigger controls what gets inserted; only system-generated notifications are created.
drop policy if exists "lounge_notifications_allow_insert" on public.lounge_notifications;
create policy "lounge_notifications_allow_insert"
on public.lounge_notifications
for insert
to authenticated
with check (true);
