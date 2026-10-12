-- MoneyMart 2.0 — CRM: first-touch signup attribution (referrer + UTM + landing)
-- Run in Supabase SQL Editor after user_profiles + user_roles exist.
--
-- 1) Adds columns on user_profiles
-- 2) Extends handle_new_user_profile to copy from auth raw_user_meta_data
--
-- For admin RPCs (admin_crm_users, admin_crm_traffic_dashboard), run next:
--   SUPABASE_ADMIN_CRM_ENHANCED.sql
-- Do NOT re-run the old admin_crm_users block here if ENHANCED is already applied.

alter table public.user_profiles
  add column if not exists signup_referrer_domain text,
  add column if not exists signup_referrer_url text,
  add column if not exists signup_utm_source text,
  add column if not exists signup_utm_medium text,
  add column if not exists signup_utm_campaign text,
  add column if not exists signup_landing_path text,
  add column if not exists signup_landing_query text,
  add column if not exists signup_attribution_captured_at timestamptz;

comment on column public.user_profiles.signup_referrer_domain is 'First-touch external referrer hostname (e.g. www.google.com, t.co)';
comment on column public.user_profiles.signup_referrer_url is 'First-touch document.referrer (truncated client-side)';
comment on column public.user_profiles.signup_utm_source is 'UTM source from first landing URL';
comment on column public.user_profiles.signup_utm_medium is 'UTM medium from first landing URL';
comment on column public.user_profiles.signup_utm_campaign is 'UTM campaign from first landing URL';
comment on column public.user_profiles.signup_landing_path is 'First landing pathname on this site';
comment on column public.user_profiles.signup_landing_query is 'First landing query string on this site';
comment on column public.user_profiles.signup_attribution_captured_at is 'When first-touch context was recorded (client clock)';

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_domain text;
  v_ref_url text;
  v_utm_src text;
  v_utm_med text;
  v_utm_camp text;
  v_land_path text;
  v_land_query text;
  v_attr_at timestamptz;
begin
  v_ref_domain := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_referrer_domain', '')), '');
  v_ref_url := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_referrer_url', '')), '');
  v_utm_src := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_utm_source', '')), '');
  v_utm_med := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_utm_medium', '')), '');
  v_utm_camp := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_utm_campaign', '')), '');
  v_land_path := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_landing_path', '')), '');
  v_land_query := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_landing_query', '')), '');
  begin
    v_attr_at := (nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_attribution_captured_at', '')), ''))::timestamptz;
  exception
    when others then
      v_attr_at := null;
  end;

  insert into public.user_profiles (
    user_id,
    full_name,
    nickname,
    phone,
    marketing_opt_in,
    event_coupon_opt_in,
    signup_referrer_domain,
    signup_referrer_url,
    signup_utm_source,
    signup_utm_medium,
    signup_utm_campaign,
    signup_landing_path,
    signup_landing_query,
    signup_attribution_captured_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'event_coupon_opt_in')::boolean, false),
    v_ref_domain,
    v_ref_url,
    v_utm_src,
    v_utm_med,
    v_utm_camp,
    v_land_path,
    v_land_query,
    v_attr_at
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    nickname = excluded.nickname,
    phone = excluded.phone,
    marketing_opt_in = excluded.marketing_opt_in,
    event_coupon_opt_in = excluded.event_coupon_opt_in,
    signup_referrer_domain = coalesce(excluded.signup_referrer_domain, user_profiles.signup_referrer_domain),
    signup_referrer_url = coalesce(excluded.signup_referrer_url, user_profiles.signup_referrer_url),
    signup_utm_source = coalesce(excluded.signup_utm_source, user_profiles.signup_utm_source),
    signup_utm_medium = coalesce(excluded.signup_utm_medium, user_profiles.signup_utm_medium),
    signup_utm_campaign = coalesce(excluded.signup_utm_campaign, user_profiles.signup_utm_campaign),
    signup_landing_path = coalesce(excluded.signup_landing_path, user_profiles.signup_landing_path),
    signup_landing_query = coalesce(excluded.signup_landing_query, user_profiles.signup_landing_query),
    signup_attribution_captured_at = coalesce(excluded.signup_attribution_captured_at, user_profiles.signup_attribution_captured_at);

  return new;
end;
$$;

-- admin_crm_users RPC lives in SUPABASE_ADMIN_CRM_ENHANCED.sql (extended columns + traffic dashboard).
-- Keeping RPC out of this file avoids "cannot change return type" when ENHANCED is already applied.
