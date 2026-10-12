-- MoneyMart web admin CRM analytics v2
-- Admin-only acquisition, activation, engagement and conversion dashboard.

create index if not exists idx_site_analytics_events_user_created_at
  on public.site_analytics_events (user_id, created_at desc)
  where user_id is not null;

create or replace function public.admin_crm_dashboard(
  p_days integer default 30,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_days integer := greatest(7, least(coalesce(p_days, 30), 365));
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
  v_since timestamptz := now() - make_interval(days => greatest(7, least(coalesce(p_days, 30), 365)));
  v_result jsonb;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  with event_agg as (
    select
      e.user_id,
      max(e.created_at) as last_active_at,
      count(*) filter (where e.created_at >= v_since) as events_in_range,
      count(distinct e.session_id) filter (where e.created_at >= v_since) as sessions_in_range,
      count(distinct (e.created_at at time zone 'Asia/Tokyo')::date)
        filter (where e.created_at >= v_since) as active_days_in_range
    from public.site_analytics_events e
    where e.user_id is not null
    group by e.user_id
  ),
  stock_agg as (
    select user_id, count(*)::integer as owned_stock_count
    from public.user_owned_stocks group by user_id
  ),
  fund_agg as (
    select user_id, count(*)::integer as owned_fund_count
    from public.user_owned_funds group by user_id
  ),
  push_agg as (
    select user_id, count(*)::integer as push_device_count
    from public.user_push_tokens group by user_id
  ),
  base as (
    select
      u.id as user_id,
      u.email::text,
      u.created_at as user_created_at,
      u.email_confirmed_at,
      u.last_sign_in_at,
      coalesce(p.full_name, '') as full_name,
      coalesce(p.nickname, '') as nickname,
      p.phone,
      coalesce(p.marketing_opt_in, false) as marketing_opt_in,
      p.signup_referrer_domain,
      p.signup_utm_source,
      p.signup_utm_medium,
      p.signup_utm_campaign,
      p.signup_landing_path,
      p.signup_landing_query,
      p.signup_attribution_captured_at,
      p.subscription_tier,
      p.plan_tier,
      coalesce(p.is_premium, false)
        or coalesce(p.premium_until > now(), false)
        or lower(coalesce(p.subscription_tier, '')) in ('premium','prime')
        or lower(coalesce(p.plan_tier, '')) in ('premium','prime') as is_premium_active,
      ea.last_active_at,
      coalesce(ea.events_in_range, 0)::integer as events_in_range,
      coalesce(ea.sessions_in_range, 0)::integer as sessions_in_range,
      coalesce(ea.active_days_in_range, 0)::integer as active_days_in_range,
      coalesce(sa.owned_stock_count, 0) as owned_stock_count,
      coalesce(fa.owned_fund_count, 0) as owned_fund_count,
      coalesce(pa.push_device_count, 0) as push_device_count,
      case
        when nullif(p.signup_utm_source, '') is not null
          or nullif(p.signup_utm_medium, '') is not null
          or nullif(p.signup_utm_campaign, '') is not null then 'campaign'
        when p.signup_attribution_captured_at is null then 'unattributed'
        when lower(coalesce(p.signup_referrer_domain, '')) ~ '(google|yahoo|bing|duckduckgo|baidu)' then 'organic_search'
        when lower(coalesce(p.signup_referrer_domain, '')) in ('localhost','127.0.0.1') then 'internal_test'
        when lower(coalesce(p.signup_referrer_domain, '')) ~ '(x.com|twitter|instagram|facebook|linkedin|tiktok|threads)' then 'organic_social'
        when lower(coalesce(p.signup_referrer_domain, '')) in ('appleid.apple.com','accounts.google.com') then 'auth_return_unknown'
        when nullif(p.signup_referrer_domain, '') is not null then 'referral'
        else 'direct'
      end as acquisition_channel,
      case
        when nullif(p.signup_utm_source, '') is not null then p.signup_utm_source
        when p.signup_attribution_captured_at is null then 'legacy / tracking unavailable'
        when lower(coalesce(p.signup_referrer_domain, '')) in ('localhost','127.0.0.1') then 'internal test'
        when lower(coalesce(p.signup_referrer_domain, '')) in ('appleid.apple.com','accounts.google.com') then 'authentication return'
        when nullif(p.signup_referrer_domain, '') is not null then p.signup_referrer_domain
        else 'direct'
      end as acquisition_source,
      case
        when ea.last_active_at >= now() - interval '7 days' then 'active'
        when ea.last_active_at >= now() - interval '30 days' then 'warm'
        when ea.last_active_at is not null then 'dormant'
        when u.created_at >= now() - interval '7 days' then 'new_unactivated'
        else 'never_activated'
      end as lifecycle_stage
    from auth.users u
    left join public.user_profiles p on p.user_id = u.id
    left join event_agg ea on ea.user_id = u.id
    left join stock_agg sa on sa.user_id = u.id
    left join fund_agg fa on fa.user_id = u.id
    left join push_agg pa on pa.user_id = u.id
  ),
  metrics as (
    select jsonb_build_object(
      'total_users', count(*),
      'signups_7d', count(*) filter (where user_created_at >= now() - interval '7 days'),
      'signups_30d', count(*) filter (where user_created_at >= now() - interval '30 days'),
      'active_7d', count(*) filter (where last_active_at >= now() - interval '7 days'),
      'active_30d', count(*) filter (where last_active_at >= now() - interval '30 days'),
      'premium_users', count(*) filter (where is_premium_active),
      'portfolio_activated', count(*) filter (where owned_stock_count + owned_fund_count > 0),
      'push_enabled', count(*) filter (where push_device_count > 0),
      'marketing_opt_in', count(*) filter (where marketing_opt_in),
      'email_confirmed', count(*) filter (where email_confirmed_at is not null)
    ) as value from base
  ),
  signup_days as (
    select jsonb_agg(
      jsonb_build_object('day', d.day, 'signups', coalesce(x.signups, 0))
      order by d.day
    ) as value
    from generate_series(
      (now() at time zone 'Asia/Tokyo')::date - (v_days - 1),
      (now() at time zone 'Asia/Tokyo')::date,
      interval '1 day'
    ) as d(day)
    left join (
      select (user_created_at at time zone 'Asia/Tokyo')::date as day, count(*) as signups
      from base
      where user_created_at >= v_since
      group by 1
    ) x on x.day = d.day
  ),
  source_rollup as (
    select jsonb_agg(to_jsonb(s) order by s.signups desc, s.source) as value
    from (
      select
        acquisition_channel as channel,
        acquisition_source as source,
        count(*) as signups,
        count(*) filter (where last_active_at is not null) as activated,
        count(*) filter (where last_active_at >= now() - interval '30 days') as active_30d,
        count(*) filter (where is_premium_active) as premium,
        round(100.0 * count(*) filter (where last_active_at is not null) / nullif(count(*), 0), 1) as activation_rate,
        round(100.0 * count(*) filter (where is_premium_active) / nullif(count(*), 0), 1) as premium_rate
      from base
      group by acquisition_channel, acquisition_source
      order by count(*) desc
      limit 20
    ) s
  ),
  lifecycle_rollup as (
    select jsonb_object_agg(lifecycle_stage, users) as value
    from (select lifecycle_stage, count(*) as users from base group by lifecycle_stage) s
  ),
  users_json as (
    select jsonb_agg(to_jsonb(u) order by u.user_created_at desc) as value
    from (
      select * from base
      order by user_created_at desc
      limit v_limit
    ) u
  )
  select jsonb_build_object(
    'range_days', v_days,
    'generated_at', now(),
    'metrics', coalesce((select value from metrics), '{}'::jsonb),
    'daily_signups', coalesce((select value from signup_days), '[]'::jsonb),
    'sources', coalesce((select value from source_rollup), '[]'::jsonb),
    'lifecycle', coalesce((select value from lifecycle_rollup), '{}'::jsonb),
    'users', coalesce((select value from users_json), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_crm_dashboard(integer, integer) from public;
grant execute on function public.admin_crm_dashboard(integer, integer) to authenticated;
