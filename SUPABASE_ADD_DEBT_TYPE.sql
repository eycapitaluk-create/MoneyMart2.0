-- Add debt_type to user_revolving_debts for debt-kind classification.
-- Run in Supabase SQL Editor.

alter table public.user_revolving_debts
  add column if not exists debt_type text not null default 'card'
  check (debt_type in ('mortgage', 'card', 'revolving', 'other'));

comment on column public.user_revolving_debts.debt_type is 'Debt type: mortgage, card, revolving, other';
