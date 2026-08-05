-- Restrict earnings calendar mutations to administrators.
-- Run once on databases that previously applied
-- SUPABASE_SETUP_EARNINGS_CALENDAR_MANUAL.sql.
-- Requires public.user_roles.

alter table public.earnings_calendar_manual enable row level security;

drop policy if exists "earnings_calendar_manual_write_authenticated"
  on public.earnings_calendar_manual;
drop policy if exists "earnings_calendar_manual_admin_write"
  on public.earnings_calendar_manual;

create policy "earnings_calendar_manual_admin_write"
on public.earnings_calendar_manual
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);
