-- SNSキャンペーン cp2026_sns_sep（2026-10-01〜10-30 JST）
-- Supabase SQL Editor で実行

create extension if not exists pgcrypto;

create table if not exists public.campaign_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id text not null default 'cp2026_sns_sep',
  survey_answers jsonb,
  survey_completed_at timestamptz,
  sns_url text,
  sns_platform text,
  sns_submitted_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'eligible', 'rejected', 'rewarded')),
  applied_at timestamptz,
  signup_utm_source text,
  signup_utm_medium text,
  signup_utm_campaign text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, campaign_id)
);

create index if not exists idx_campaign_entries_campaign_status
  on public.campaign_entries (campaign_id, status, applied_at desc nulls last);

create index if not exists idx_campaign_entries_campaign_applied
  on public.campaign_entries (campaign_id, applied_at desc nulls last);

create or replace function public.set_updated_at_campaign_entries()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_campaign_entries_updated_at on public.campaign_entries;
create trigger trg_campaign_entries_updated_at
before update on public.campaign_entries
for each row execute function public.set_updated_at_campaign_entries();

alter table public.campaign_entries enable row level security;

drop policy if exists "campaign_entries_owner_select" on public.campaign_entries;
create policy "campaign_entries_owner_select"
on public.campaign_entries for select
using (auth.uid() = user_id);

drop policy if exists "campaign_entries_owner_insert" on public.campaign_entries;
create policy "campaign_entries_owner_insert"
on public.campaign_entries for insert
with check (auth.uid() = user_id);

drop policy if exists "campaign_entries_owner_update" on public.campaign_entries;
create policy "campaign_entries_owner_update"
on public.campaign_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 集計用ビュー（service role / SQL のみ）
create or replace view public.v_campaign_cp2026_sns_sep_stats as
select
  campaign_id,
  count(*) filter (where survey_completed_at is not null) as survey_completed,
  count(*) filter (where sns_submitted_at is not null) as sns_submitted,
  count(*) filter (where status = 'eligible') as eligible,
  count(*) filter (where status = 'rewarded') as rewarded,
  count(*) as total_rows
from public.campaign_entries
where campaign_id = 'cp2026_sns_sep'
group by campaign_id;

comment on table public.campaign_entries is 'キャンペーン応募（アンケート・SNS URL・ステータス）';
