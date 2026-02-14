-- MoneyMart 2.0 - Admin business dashboard metrics
-- Run this in Supabase SQL Editor.

create table if not exists public.user_activity_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_activity_events_created_at
  on public.user_activity_events (created_at desc);

create index if not exists idx_user_activity_events_name_created
  on public.user_activity_events (event_name, created_at desc);

create index if not exists idx_user_activity_events_user_created
  on public.user_activity_events (user_id, created_at desc);

create table if not exists public.admin_daily_metrics (
  metric_date date primary key,
  dau integer not null default 0,
  signup_count integer not null default 0,
  mypage_save_attempts integer not null default 0,
  mypage_save_success integer not null default 0,
  mypage_save_success_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_daily_metrics_date_desc
  on public.admin_daily_metrics (metric_date desc);

create or replace function public.refresh_admin_daily_metrics(p_date date default current_date)
returns void
language plpgsql
security definer
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_dau integer := 0;
  v_signup_count integer := 0;
  v_save_attempts integer := 0;
  v_save_success integer := 0;
  v_save_success_rate numeric(5,2) := 0;
begin
  v_start := p_date::timestamptz;
  v_end := (p_date + 1)::timestamptz;

  select count(distinct e.user_id)
    into v_dau
  from public.user_activity_events e
  where e.created_at >= v_start
    and e.created_at < v_end
    and e.user_id is not null;

  select count(*)
    into v_signup_count
  from auth.users u
  where u.created_at >= v_start
    and u.created_at < v_end;

  select count(*)
    into v_save_attempts
  from public.user_activity_events e
  where e.created_at >= v_start
    and e.created_at < v_end
    and e.event_name = 'mypage_save_attempt';

  select count(*)
    into v_save_success
  from public.user_activity_events e
  where e.created_at >= v_start
    and e.created_at < v_end
    and e.event_name = 'mypage_save_success';

  if v_save_attempts > 0 then
    v_save_success_rate := round((v_save_success::numeric / v_save_attempts::numeric) * 100, 2);
  else
    v_save_success_rate := 0;
  end if;

  insert into public.admin_daily_metrics (
    metric_date,
    dau,
    signup_count,
    mypage_save_attempts,
    mypage_save_success,
    mypage_save_success_rate,
    updated_at
  )
  values (
    p_date,
    coalesce(v_dau, 0),
    coalesce(v_signup_count, 0),
    coalesce(v_save_attempts, 0),
    coalesce(v_save_success, 0),
    coalesce(v_save_success_rate, 0),
    now()
  )
  on conflict (metric_date) do update set
    dau = excluded.dau,
    signup_count = excluded.signup_count,
    mypage_save_attempts = excluded.mypage_save_attempts,
    mypage_save_success = excluded.mypage_save_success,
    mypage_save_success_rate = excluded.mypage_save_success_rate,
    updated_at = now();
end;
$$;

alter table public.user_activity_events enable row level security;
alter table public.admin_daily_metrics enable row level security;

drop policy if exists "events_insert_authenticated" on public.user_activity_events;
create policy "events_insert_authenticated"
on public.user_activity_events
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "events_select_own" on public.user_activity_events;
create policy "events_select_own"
on public.user_activity_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "admin_daily_metrics_read_authenticated" on public.admin_daily_metrics;
create policy "admin_daily_metrics_read_authenticated"
on public.admin_daily_metrics
for select
to authenticated
using (true);

-- Example daily run (for manual test):
-- select public.refresh_admin_daily_metrics(current_date);
