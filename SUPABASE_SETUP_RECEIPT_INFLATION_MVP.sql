-- MoneyMart Receipt Inflation MVP schema
-- Run this in Supabase SQL editor.

-- 1) OCR events (for quality/ops tracking)
create table if not exists public.user_receipt_ocr_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  image_name text,
  ocr_status text not null default 'success', -- success | failed | corrected
  confidence numeric(5,4),
  merchant text,
  category text,
  amount_yen numeric(12,0),
  spent_on date,
  raw_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_receipt_ocr_events_user_id_scanned_at
  on public.user_receipt_ocr_events (user_id, scanned_at desc);

-- 2) Monthly personal CPI cache (optional materialized cache table)
create table if not exists public.user_personal_cpi_monthly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null, -- YYYY-MM
  category text not null,
  avg_ticket_yen numeric(12,2) not null default 0,
  sample_count int not null default 0,
  index_vs_prev numeric(8,2), -- e.g. 108.50
  reliability text, -- A/B/C
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_key, category)
);

create index if not exists idx_user_personal_cpi_monthly_user_id_month_key
  on public.user_personal_cpi_monthly (user_id, month_key desc);

-- 3) In-app inflation alerts
create table if not exists public.user_inflation_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null, -- YYYY-MM
  category text not null,
  severity text not null default 'medium', -- low | medium | high
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, month_key, category, message)
);

create index if not exists idx_user_inflation_alerts_user_id_created_at
  on public.user_inflation_alerts (user_id, created_at desc);

-- 4) RLS
alter table public.user_receipt_ocr_events enable row level security;
alter table public.user_personal_cpi_monthly enable row level security;
alter table public.user_inflation_alerts enable row level security;

drop policy if exists "user_receipt_ocr_events_select_own" on public.user_receipt_ocr_events;
create policy "user_receipt_ocr_events_select_own"
  on public.user_receipt_ocr_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_receipt_ocr_events_insert_own" on public.user_receipt_ocr_events;
create policy "user_receipt_ocr_events_insert_own"
  on public.user_receipt_ocr_events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_receipt_ocr_events_update_own" on public.user_receipt_ocr_events;
create policy "user_receipt_ocr_events_update_own"
  on public.user_receipt_ocr_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_receipt_ocr_events_delete_own" on public.user_receipt_ocr_events;
create policy "user_receipt_ocr_events_delete_own"
  on public.user_receipt_ocr_events
  for delete
  using (auth.uid() = user_id);

drop policy if exists "user_personal_cpi_monthly_select_own" on public.user_personal_cpi_monthly;
create policy "user_personal_cpi_monthly_select_own"
  on public.user_personal_cpi_monthly
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_personal_cpi_monthly_upsert_own" on public.user_personal_cpi_monthly;
create policy "user_personal_cpi_monthly_upsert_own"
  on public.user_personal_cpi_monthly
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_inflation_alerts_select_own" on public.user_inflation_alerts;
create policy "user_inflation_alerts_select_own"
  on public.user_inflation_alerts
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_inflation_alerts_upsert_own" on public.user_inflation_alerts;
create policy "user_inflation_alerts_upsert_own"
  on public.user_inflation_alerts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
