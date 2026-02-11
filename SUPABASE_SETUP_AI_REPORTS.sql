-- MoneyMart 2.0 - AI report storage (MVP)
-- Run this in Supabase SQL Editor.

create table if not exists public.ai_reports (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  report_type text not null default 'summary',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_reports_type_created
  on public.ai_reports (report_type, created_at desc);

create index if not exists idx_ai_reports_user_created
  on public.ai_reports (user_id, created_at desc);

alter table public.ai_reports enable row level security;

drop policy if exists "ai_reports_public_read" on public.ai_reports;
create policy "ai_reports_public_read"
on public.ai_reports
for select
to anon, authenticated
using (true);

drop policy if exists "ai_reports_public_insert" on public.ai_reports;
create policy "ai_reports_public_insert"
on public.ai_reports
for insert
to anon, authenticated
with check (true);

-- Note:
-- For production, tighten this to authenticated users only and scope by user_id.
