-- MoneyMart — Advisor lockdown (run once in Supabase SQL Editor)
--
-- 1) admin_crm_users: restore admin role guard, revoke anon EXECUTE.
--    Return shape stays the CRM directory the admin UI already reads
--    (SUPABASE_PATCH_CRM_EXCLUDE_INTERNAL_REFERRER.sql). authenticated stays
--    granted so AdminPage.rpc('admin_crm_users') keeps working for admins.
-- 2) Clear Security Definer View errors. Analytics view stays readable by
--    logged-in admins via base-table RLS. Campaign stats view is SQL/service only.
-- 3) Stop clients from calling EXP award functions with an arbitrary user_id.
--    Triggers and community_award_exp() still call them as the function owner.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) admin_crm_users
-- ---------------------------------------------------------------------------
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
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  return query
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
      or lower(u.email) like '%@community.seed'
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
        or lower(u.email) like '%@community.seed'
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
end;
$$;

comment on function public.admin_crm_users(integer) is
  'Admin CRM directory. SECURITY DEFINER so it can read auth.users; caller must be user_roles.admin. anon cannot execute.';

revoke all on function public.admin_crm_users(integer) from public;
revoke all on function public.admin_crm_users(integer) from anon;
revoke all on function public.admin_crm_users(integer) from authenticated;
grant execute on function public.admin_crm_users(integer) to authenticated;
grant execute on function public.admin_crm_users(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2) Security definer views
-- ---------------------------------------------------------------------------
-- Base-table SELECT is required once the view runs as the caller.
-- RLS still limits site_analytics_events SELECT to admins.
grant select on public.site_analytics_events to authenticated;

alter view public.v_customer_site_analytics_events set (security_invoker = true);

revoke all on public.v_customer_site_analytics_events from public;
revoke all on public.v_customer_site_analytics_events from anon;
grant select on public.v_customer_site_analytics_events to authenticated;
grant select on public.v_customer_site_analytics_events to service_role;

comment on view public.v_customer_site_analytics_events is
  'Customer product-usage events, security_invoker. Non-admins see no rows via site_analytics_events RLS.';

alter view public.v_campaign_cp2026_sns_sep_stats set (security_invoker = true);

revoke all on public.v_campaign_cp2026_sns_sep_stats from public;
revoke all on public.v_campaign_cp2026_sns_sep_stats from anon;
revoke all on public.v_campaign_cp2026_sns_sep_stats from authenticated;
grant select on public.v_campaign_cp2026_sns_sep_stats to service_role;

comment on view public.v_campaign_cp2026_sns_sep_stats is
  'Campaign aggregate counts. Client roles revoked; query as service_role or SQL editor.';

-- ---------------------------------------------------------------------------
-- 3) EXP award helpers — not client RPCs
-- ---------------------------------------------------------------------------
revoke all on function public.community_award_exp_for_user(uuid, text, text, jsonb) from public;
revoke all on function public.community_award_exp_for_user(uuid, text, text, jsonb) from anon;
revoke all on function public.community_award_exp_for_user(uuid, text, text, jsonb) from authenticated;
grant execute on function public.community_award_exp_for_user(uuid, text, text, jsonb) to service_role;

revoke all on function public.lounge_character_add_exp(uuid, integer) from public;
revoke all on function public.lounge_character_add_exp(uuid, integer) from anon;
revoke all on function public.lounge_character_add_exp(uuid, integer) from authenticated;
grant execute on function public.lounge_character_add_exp(uuid, integer) to service_role;

comment on function public.community_award_exp_for_user(uuid, text, text, jsonb) is
  'Internal EXP award. Not callable by anon/authenticated. Use community_award_exp() which binds auth.uid().';

comment on function public.lounge_character_add_exp(uuid, integer) is
  'Internal EXP writer. Triggers and owner/service_role only.';
