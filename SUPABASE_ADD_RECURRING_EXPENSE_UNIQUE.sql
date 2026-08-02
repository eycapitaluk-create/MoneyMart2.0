-- Prevent duplicate auto-generated recurring expense children.
-- Run in Supabase SQL Editor AFTER relying on the unique index in production:
-- 1) Deduplicate any existing (user_id, recurring_parent_id, spent_on) children
-- 2) Then create the unique index below.
--
-- App-side materialize now pages all existing spent_on dates, but this index is
-- defense-in-depth against concurrent MyPage loads racing inserts.

-- Optional cleanup (keeps the newest row per duplicate key):
-- delete from public.user_expenses ue
-- using public.user_expenses newer
-- where ue.recurring_parent_id is not null
--   and newer.recurring_parent_id is not null
--   and ue.user_id = newer.user_id
--   and ue.recurring_parent_id = newer.recurring_parent_id
--   and ue.spent_on = newer.spent_on
--   and ue.created_at < newer.created_at;

create unique index if not exists uq_user_expenses_recurring_child_day
  on public.user_expenses (user_id, recurring_parent_id, spent_on)
  where recurring_parent_id is not null;
