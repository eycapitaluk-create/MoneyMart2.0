-- MoneyMart — CRM activation metrics + internal-user exclusion + signup ref tag
-- Run in Supabase SQL Editor after:
--   SUPABASE_CRM_SIGNUP_ATTRIBUTION.sql
--   SUPABASE_ADMIN_CRM_ENHANCED.sql
--   SUPABASE_SETUP_SITE_ANALYTICS.sql

alter table public.user_profiles
  add column if not exists signup_ref text;

comment on column public.user_profiles.signup_ref is 'First-touch ?ref= / ?invite= community tag (when no utm_source)';

-- Extend profile trigger to persist signup_ref from auth metadata
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
  v_signup_ref text;
  v_land_path text;
  v_land_query text;
  v_attr_at timestamptz;
begin
  v_ref_domain := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_referrer_domain', '')), '');
  v_ref_url := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_referrer_url', '')), '');
  v_utm_src := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_utm_source', '')), '');
  v_utm_med := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_utm_medium', '')), '');
  v_utm_camp := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_utm_campaign', '')), '');
  v_signup_ref := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_ref', '')), '');
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
    signup_ref,
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
    v_signup_ref,
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
    signup_ref = coalesce(excluded.signup_ref, user_profiles.signup_ref),
    signup_landing_path = coalesce(excluded.signup_landing_path, user_profiles.signup_landing_path),
    signup_landing_query = coalesce(excluded.signup_landing_query, user_profiles.signup_landing_query),
    signup_attribution_captured_at = coalesce(excluded.signup_attribution_captured_at, user_profiles.signup_attribution_captured_at);

  return new;
end;
$$;

drop function if exists public.admin_crm_users(integer);

create or replace function public.admin_crm_users(p_limit integer default 250)
returns table (
  user_id uuid,
  email text,
  user_created_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  full_name text,
  nickname text,
  phone text,
  marketing_opt_in boolean,
  is_premium boolean,
  plan_tier text,
  signup_referrer_domain text,
  signup_utm_source text,
  signup_utm_medium text,
  signup_utm_campaign text,
  signup_ref text,
  signup_landing_path text,
  signup_landing_query text,
  signup_attribution_captured_at timestamptz,
  has_attribution boolean,
  is_internal boolean,
  logged_in_within_7d boolean,
  has_search_7d boolean,
  has_product_view_7d boolean,
  has_watchlist_add_7d boolean,
  visited_premium_page boolean,
  premium_checkout_click boolean,
  is_activated boolean,
  is_dormant boolean,
  has_premium_intent boolean,
  crm_segment text,
  page_views_30d bigint,
  sessions_30d bigint,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    coalesce(p.full_name, ''),
    coalesce(p.nickname, ''),
    p.phone,
    coalesce(p.marketing_opt_in, false),
    coalesce(p.is_premium, false),
    p.plan_tier,
    p.signup_referrer_domain,
    p.signup_utm_source,
    p.signup_utm_medium,
    p.signup_utm_campaign,
    p.signup_ref,
    p.signup_landing_path,
    p.signup_landing_query,
    p.signup_attribution_captured_at,
    (
      p.signup_referrer_domain is not null
      or p.signup_utm_source is not null
      or p.signup_utm_medium is not null
      or p.signup_utm_campaign is not null
      or p.signup_ref is not null
      or p.signup_landing_path is not null
    ) as has_attribution,
    (
      lower(u.email) like '%@moneymart.co.jp'
      or lower(u.email) = 'test@moneymart.co.jp'
      or lower(u.email) like 'test+%'
      or lower(u.email) like '%+test@%'
      or coalesce(p.signup_landing_query, '') ilike '%localhost%'
      or coalesce(p.signup_landing_path, '') ilike '%localhost%'
      or coalesce(p.signup_referrer_url, '') ilike '%localhost%'
    ) as is_internal,
    act.logged_in_within_7d,
    act.has_search_7d,
    act.has_product_view_7d,
    act.has_watchlist_add_7d,
    act.visited_premium_page,
    act.premium_checkout_click,
    (
      act.logged_in_within_7d
      and (act.has_search_7d or act.has_product_view_7d or act.has_watchlist_add_7d)
    ) as is_activated,
    (
      not (
        act.logged_in_within_7d
        and (act.has_search_7d or act.has_product_view_7d or act.has_watchlist_add_7d)
      )
    ) as is_dormant,
    (act.visited_premium_page or act.premium_checkout_click) as has_premium_intent,
    case
      when (
        lower(u.email) like '%@moneymart.co.jp'
        or lower(u.email) = 'test@moneymart.co.jp'
        or lower(u.email) like 'test+%'
        or lower(u.email) like '%+test@%'
        or coalesce(p.signup_landing_query, '') ilike '%localhost%'
        or coalesce(p.signup_landing_path, '') ilike '%localhost%'
        or coalesce(p.signup_referrer_url, '') ilike '%localhost%'
      ) then 'internal_test'
      when (act.visited_premium_page or act.premium_checkout_click) then 'premium_intent'
      when (
        p.signup_referrer_domain is null
        and p.signup_utm_source is null
        and p.signup_utm_medium is null
        and p.signup_utm_campaign is null
        and p.signup_ref is null
      ) then 'unknown_signup'
      when coalesce(p.signup_referrer_domain, '') ilike '%google.%' then 'google_organic'
      when (
        act.logged_in_within_7d
        and (act.has_search_7d or act.has_product_view_7d or act.has_watchlist_add_7d)
      ) then 'activated'
      else 'dormant'
    end as crm_segment,
    coalesce(av.page_views_30d, 0)::bigint,
    coalesce(av.sessions_30d, 0)::bigint,
    av.last_seen_at
  from auth.users u
  left join public.user_profiles p on p.user_id = u.id
  left join lateral (
    select
      (
        u.last_sign_in_at is not null and u.last_sign_in_at <= u.created_at + interval '7 days'
      ) or exists (
        select 1 from public.site_analytics_events e
        where e.user_id = u.id
          and e.created_at <= u.created_at + interval '7 days'
      ) as logged_in_within_7d,
      exists (
        select 1 from public.site_analytics_events e
        where e.user_id = u.id
          and e.event_name = 'search'
          and e.created_at <= u.created_at + interval '7 days'
      ) as has_search_7d,
      exists (
        select 1 from public.site_analytics_events e
        where e.user_id = u.id
          and e.event_name in ('stock_select', 'fund_select', 'fund_detail_view', 'product_detail_view')
          and e.created_at <= u.created_at + interval '7 days'
      ) as has_product_view_7d,
      exists (
        select 1 from public.site_analytics_events e
        where e.user_id = u.id
          and e.event_name in ('stock_watchlist_add', 'fund_watchlist_add')
          and e.created_at <= u.created_at + interval '7 days'
      ) as has_watchlist_add_7d,
      exists (
        select 1 from public.site_analytics_events e
        where e.user_id = u.id
          and e.event_name = 'page_view'
          and coalesce(e.page_path, '') like '/premium%'
      ) as visited_premium_page,
      exists (
        select 1 from public.site_analytics_events e
        where e.user_id = u.id
          and e.event_name = 'premium_checkout_click'
      ) as premium_checkout_click
  ) act on true
  left join lateral (
    select
      count(*) filter (where e.event_name = 'page_view') as page_views_30d,
      count(distinct e.session_id) filter (where e.event_name = 'page_view') as sessions_30d,
      max(e.created_at) as last_seen_at
    from public.site_analytics_events e
    where e.user_id = u.id
      and e.created_at >= now() - interval '30 days'
  ) av on true
  order by u.created_at desc
  limit greatest(1, least(coalesce(p_limit, 250), 500));
end;
$$;

revoke all on function public.admin_crm_users(integer) from public;
grant execute on function public.admin_crm_users(integer) to authenticated;
