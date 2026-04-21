-- Portfolio drop alert settings + history
-- MyPage: threshold setting, one-alert-per-day (per baseline), bell badge linkage

create table if not exists user_portfolio_alert_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  threshold_pct numeric(5,2) not null default -5,
  rise_threshold_pct integer,
  updated_at timestamptz not null default now()
);

create table if not exists user_portfolio_alert_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_date date not null,
  baseline_type text not null check (baseline_type in ('daily', 'weekly', 'daily_gain', 'weekly_gain')),
  threshold_pct numeric(5,2) not null,
  change_pct numeric(7,3) not null,
  base_date date,
  as_of_date date,
  base_value numeric(18,2) not null default 0,
  current_value numeric(18,2) not null default 0,
  is_active boolean not null default true,
  read_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, alert_date, baseline_type)
);

create index if not exists idx_user_portfolio_alert_history_user_active
  on user_portfolio_alert_history (user_id, is_active, alert_date desc);

create index if not exists idx_user_portfolio_alert_history_user_date
  on user_portfolio_alert_history (user_id, alert_date desc);

alter table user_portfolio_alert_settings enable row level security;
alter table user_portfolio_alert_history enable row level security;

drop policy if exists "user owns portfolio alert settings select" on user_portfolio_alert_settings;
create policy "user owns portfolio alert settings select"
  on user_portfolio_alert_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists "user owns portfolio alert settings upsert" on user_portfolio_alert_settings;
create policy "user owns portfolio alert settings upsert"
  on user_portfolio_alert_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user owns portfolio alert history select" on user_portfolio_alert_history;
create policy "user owns portfolio alert history select"
  on user_portfolio_alert_history
  for select
  using (auth.uid() = user_id);

drop policy if exists "user owns portfolio alert history upsert" on user_portfolio_alert_history;
create policy "user owns portfolio alert history upsert"
  on user_portfolio_alert_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- アプリ側の取り決め: threshold_pct = 0 は「下落アラート無効」（列は NOT NULL のため NULL は使わない）
