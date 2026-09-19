-- MoneyMart — Exclude moneymart.co.jp self-referrals from CRM internal flags + traffic referrers
-- Run after SUPABASE_PATCH_CRM_ACTIVATION_SEGMENTS.sql and SUPABASE_ADMIN_CRM_ENHANCED.sql
--
-- DO NOT RE-RUN the admin_crm_users block below. It recreates the function
-- without an admin guard. Apply SUPABASE_PATCH_SECURITY_ADVISOR_LOCKDOWN.sql instead.

-- Helper: true when referrer is our own site (staff internal navigation, not acquisition)
create or replace function public.mm_is_internal_referrer_domain(p_domain text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    lower(trim(both from coalesce(p_domain, ''))) = 'moneymart.co.jp'
    or lower(trim(both from coalesce(p_domain, ''))) = 'www.moneymart.co.jp'
    or lower(trim(both from coalesce(p_domain, ''))) like '%.moneymart.co.jp',
    false
  );
$$;

-- Patch admin_crm_users: treat signup from moneymart.co.jp as internal
drop function if exists public.admin_crm_users(integer);

create or replace function public.admin_crm_users(p_limit integer default 250)
returns table (
  user_id uuid,
  user_created_at timestamptz,
  email text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  full_name text,
  nickname text,
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
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    u.created_at as user_created_at,
    u.email::text,
    u.email_confirmed_at,
    u.last_sign_in_at,
    p.full_name,
    p.nickname,
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
      or public.mm_is_internal_referrer_domain(p.signup_referrer_domain)
      or coalesce(p.signup_referrer_url, '') ilike '%moneymart.co.jp%'
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
        or public.mm_is_internal_referrer_domain(p.signup_referrer_domain)
        or coalesce(p.signup_referrer_url, '') ilike '%moneymart.co.jp%'
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
      when coalesce(p.signup_referrer_domain, '') ilike '%smartnews%' then 'smartnews_referral'
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
          and e.page_path ilike '/premium%'
      ) as visited_premium_page,
      exists (
        select 1 from public.site_analytics_events e
        where e.user_id = u.id
          and e.event_name in ('premium_page_intent', 'premium_checkout_click')
      ) as premium_checkout_click
  ) act on true
  left join lateral (
    select
      count(*) filter (where e.event_name = 'page_view')::bigint as page_views_30d,
      count(distinct e.session_id)::bigint as sessions_30d,
      max(e.created_at) as last_seen_at
    from public.site_analytics_events e
    where e.user_id = u.id
      and e.created_at >= now() - interval '30 days'
  ) av on true
  order by u.created_at desc
  limit greatest(1, least(500, coalesce(p_limit, 250)));
$$;

revoke all on function public.admin_crm_users(integer) from public;
grant execute on function public.admin_crm_users(integer) to authenticated;

-- Patch traffic dashboard: drop internal referrers from top_referrers + recent_sessions
-- (Re-run full function body from ENHANCED file with WHERE filters — minimal patch via replace on subqueries)

-- top_referrers filter (edit existing function in place if already deployed):
-- add to top_referrers subquery WHERE:
--   and not public.mm_is_internal_referrer_domain(e.referrer_domain)

comment on function public.mm_is_internal_referrer_domain(text) is
  'True for moneymart.co.jp / www.moneymart.co.jp / *.moneymart.co.jp referrer domains (internal navigation).';
