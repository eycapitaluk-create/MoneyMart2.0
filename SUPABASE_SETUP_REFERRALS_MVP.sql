-- MoneyMart 2.0 — Referral tracking + qualification (MVP)
-- Run in Supabase SQL Editor after auth.users + public.user_activity_events exist
-- (see SUPABASE_SETUP_ADMIN_DASHBOARD.sql for user_activity_events).
--
-- Flow:
-- 1) Each user gets a row in referral_codes (trigger on auth.users insert).
-- 2) Email/password signup: pass referral_code in raw_user_meta_data → attribution row.
-- 3) OAuth: client stores ?ref= in localStorage and calls claim_referral_attribution after session.
-- 4) When referred user logs qualifying user_activity_events, qualifying_event_count increments;
--    at >= 3, qualified_at is set (referrer reward eligibility signal).
--
-- Qualifying event_name list must match app instrumentation (see src/lib/userActivityApi.js).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_codes_code_upper on public.referral_codes (code);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referred_user_id uuid not null references auth.users (id) on delete cascade,
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id text not null default 'default',
  ref_code_used text not null,
  created_at timestamptz not null default now(),
  qualifying_event_count integer not null default 0,
  qualified_at timestamptz,
  constraint referral_attributions_referred_campaign_unique unique (referred_user_id, campaign_id),
  constraint referral_attributions_no_self check (referrer_user_id <> referred_user_id)
);

create index if not exists idx_referral_attributions_referrer
  on public.referral_attributions (referrer_user_id, campaign_id, qualified_at);

create index if not exists idx_referral_attributions_referred
  on public.referral_attributions (referred_user_id, campaign_id);

comment on table public.referral_codes is 'Per-user invite code for ?ref= / signup attribution';
comment on table public.referral_attributions is 'Maps referred user → referrer; qualified_at = activity threshold met';
comment on column public.referral_attributions.qualifying_event_count is 'Increments on select user_activity_events only';
comment on column public.referral_attributions.qualified_at is 'Set when qualifying_event_count reaches threshold';

-- ---------------------------------------------------------------------------
-- Trigger: new auth user → own code + optional metadata referral
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user_referral_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_own_code text;
  v_tries int := 0;
  v_meta_ref text;
  v_ref_user uuid;
begin
  perform set_config('row_security', 'off', true);

  if exists (select 1 from public.referral_codes rc where rc.user_id = new.id) then
    return new;
  end if;

  loop
    v_own_code := upper(substring(md5(random()::text || new.id::text || clock_timestamp()::text || random()::text) from 1 for 8));
    exit when not exists (select 1 from public.referral_codes rc where rc.code = v_own_code);
    v_tries := v_tries + 1;
    exit when v_tries > 32;
  end loop;

  if v_tries <= 32 then
    insert into public.referral_codes (user_id, code)
    values (new.id, v_own_code);
  end if;

  v_meta_ref := upper(trim(both from coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if length(v_meta_ref) >= 4 then
    select rc.user_id into v_ref_user
    from public.referral_codes rc
    where rc.code = v_meta_ref
    limit 1;

    if v_ref_user is not null and v_ref_user <> new.id then
      insert into public.referral_attributions (
        referred_user_id,
        referrer_user_id,
        ref_code_used,
        campaign_id
      )
      values (new.id, v_ref_user, v_meta_ref, 'default')
      on conflict (referred_user_id, campaign_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_referral on auth.users;
create trigger on_auth_user_created_referral
after insert on auth.users
for each row execute function public.handle_new_user_referral_setup();

-- ---------------------------------------------------------------------------
-- Trigger: activity → qualify referred user (threshold = 3)
-- ---------------------------------------------------------------------------

create or replace function public.bump_referral_qualification_on_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);

  if new.user_id is null then
    return new;
  end if;

  if new.event_name not in (
    'fund_compare_open',
    'fund_compose_open',
    'fund_watchset_saved',
    'dividend_watch_add'
  ) then
    return new;
  end if;

  update public.referral_attributions ra
  set qualifying_event_count = ra.qualifying_event_count + 1
  where ra.referred_user_id = new.user_id
    and ra.qualified_at is null
    and ra.campaign_id = 'default';

  update public.referral_attributions ra
  set qualified_at = now()
  where ra.referred_user_id = new.user_id
    and ra.qualified_at is null
    and ra.campaign_id = 'default'
    and ra.qualifying_event_count >= 3;

  return new;
end;
$$;

drop trigger if exists trg_user_activity_referral_qualify on public.user_activity_events;
create trigger trg_user_activity_referral_qualify
after insert on public.user_activity_events
for each row execute function public.bump_referral_qualification_on_activity();

-- ---------------------------------------------------------------------------
-- RPC: OAuth / late attribution (same rules as metadata path)
-- ---------------------------------------------------------------------------

create or replace function public.claim_referral_attribution(p_code text, p_campaign text default 'default')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_norm text;
  v_ref_user uuid;
begin
  perform set_config('row_security', 'off', true);

  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if exists (
    select 1
    from public.referral_attributions ra
    where ra.referred_user_id = v_uid
      and ra.campaign_id = p_campaign
  ) then
    return jsonb_build_object('ok', true, 'reason', 'already_attributed');
  end if;

  v_norm := upper(trim(both from coalesce(p_code, '')));
  if length(v_norm) < 4 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select rc.user_id into v_ref_user
  from public.referral_codes rc
  where rc.code = v_norm
  limit 1;

  if v_ref_user is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_code');
  end if;

  if v_ref_user = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  insert into public.referral_attributions (
    referred_user_id,
    referrer_user_id,
    ref_code_used,
    campaign_id
  )
  values (v_uid, v_ref_user, v_norm, p_campaign)
  on conflict (referred_user_id, campaign_id) do nothing;

  return jsonb_build_object('ok', true, 'reason', 'attached');
end;
$$;

grant execute on function public.claim_referral_attribution(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: legacy users without referral_codes row
-- ---------------------------------------------------------------------------

create or replace function public.ensure_my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing text;
  v_own_code text;
  v_tries int := 0;
begin
  perform set_config('row_security', 'off', true);

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select rc.code into v_existing
  from public.referral_codes rc
  where rc.user_id = v_uid;

  if found then
    return v_existing;
  end if;

  loop
    v_own_code := upper(substring(md5(random()::text || v_uid::text || clock_timestamp()::text || random()::text) from 1 for 8));
    exit when not exists (select 1 from public.referral_codes rc where rc.code = v_own_code);
    v_tries := v_tries + 1;
    exit when v_tries > 32;
  end loop;

  if v_tries > 32 then
    raise exception 'code_generation_failed';
  end if;

  insert into public.referral_codes (user_id, code)
  values (v_uid, v_own_code);

  return v_own_code;
end;
$$;

grant execute on function public.ensure_my_referral_code() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;

drop policy if exists "referral_codes_select_own" on public.referral_codes;
create policy "referral_codes_select_own"
on public.referral_codes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "referral_codes_admin_all" on public.referral_codes;
create policy "referral_codes_admin_all"
on public.referral_codes
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

drop policy if exists "referral_attr_select_parties" on public.referral_attributions;
create policy "referral_attr_select_parties"
on public.referral_attributions
for select
to authenticated
using (
  referred_user_id = auth.uid()
  or referrer_user_id = auth.uid()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

-- No client insert/update on attributions (RPC + triggers only)

-- ---------------------------------------------------------------------------
-- Optional one-time backfill for existing auth.users (run manually):
-- ---------------------------------------------------------------------------
-- insert into public.referral_codes (user_id, code)
-- select u.id, upper(encode(gen_random_bytes(4), 'hex'))
-- from auth.users u
-- where not exists (select 1 from public.referral_codes rc where rc.user_id = u.id)
-- on conflict do nothing;
-- Note: tiny collision risk; re-run failed rows or call ensure_my_referral_code per user from app.
--
-- 가입 전환만 보려면: SUPABASE_REFERRAL_QUALIFY_ON_SIGNUP.sql 추가 실행 (귀속 시점에 qualified_at 즉시).
