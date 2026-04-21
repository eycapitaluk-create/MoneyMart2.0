-- Add recurring expense support for MyPage budget tracker.
-- Run in Supabase SQL Editor.

alter table public.user_expenses
  add column if not exists recurring_type text check (recurring_type in ('weekly', 'monthly')),
  add column if not exists recurring_anchor_day integer check (recurring_anchor_day between 1 and 31),
  add column if not exists recurring_start_on date,
  add column if not exists recurring_end_on date,
  add column if not exists recurring_parent_id uuid references public.user_expenses(id) on delete cascade;

create index if not exists idx_user_expenses_recurring_templates
  on public.user_expenses (user_id, recurring_type, recurring_start_on, recurring_end_on, spent_on desc)
  where recurring_parent_id is null and recurring_type is not null;

create index if not exists idx_user_expenses_recurring_children
  on public.user_expenses (user_id, recurring_parent_id, spent_on desc)
  where recurring_parent_id is not null;

comment on column public.user_expenses.recurring_type is 'Repeat cadence for template rows: weekly/monthly';
comment on column public.user_expenses.recurring_anchor_day is 'Anchor day for monthly recurrence (1-31)';
comment on column public.user_expenses.recurring_start_on is 'Start date for recurrence generation';
comment on column public.user_expenses.recurring_end_on is 'Optional end date for recurrence generation';
comment on column public.user_expenses.recurring_parent_id is 'Parent template id for auto-generated recurring expense rows';
