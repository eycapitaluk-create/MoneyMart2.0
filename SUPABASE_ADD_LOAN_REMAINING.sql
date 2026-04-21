-- Add loan_remaining_yen to user_finance_profiles for 負債状況 persistence.
-- Run in Supabase SQL Editor.

alter table public.user_finance_profiles
  add column if not exists loan_remaining_yen integer not null default 0 check (loan_remaining_yen >= 0);

comment on column public.user_finance_profiles.loan_remaining_yen is '残債総額（円）';
