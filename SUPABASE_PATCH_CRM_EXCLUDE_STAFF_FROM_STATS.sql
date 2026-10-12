-- MoneyMart — Exclude staff (@moneymart.co.jp) from CRM + Analytics stats
-- Run in Supabase SQL Editor after SUPABASE_PATCH_CRM_TRAFFIC_EXCLUDE_INTERNAL_USERS.sql
-- Targets: justin.nam@moneymart.co.jp, kelly.nam@moneymart.co.jp, and all @moneymart.co.jp accounts.

create or replace function public.mm_is_customer_analytics_event(
  p_user_id uuid,
  p_referrer_domain text,
  p_session_id text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not (
    public.mm_is_internal_referrer_domain(p_referrer_domain)
    or (p_user_id is not null and public.mm_is_internal_auth_user(p_user_id))
    or (
      coalesce(p_session_id, '') <> ''
      and exists (
        select 1
        from public.site_analytics_events e
        where e.session_id = p_session_id
          and e.user_id is not null
          and public.mm_is_internal_auth_user(e.user_id)
      )
    )
  );
$$;

comment on function public.mm_is_customer_analytics_event(uuid, text, text) is
  'False for staff page views, moneymart.co.jp referrers, or any session that ever had a staff login.';

create or replace view public.v_customer_site_analytics_events as
select e.*
from public.site_analytics_events e
where (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id))
  and coalesce(e.page_path, '') not like '/admin%';

comment on view public.v_customer_site_analytics_events is
  'Customer product-usage events: exclude logged-in @moneymart.co.jp staff rows and /admin routes only (not whole sessions).';


-- MoneyMart 2.0 — Admin analytics dashboard (server-side aggregation)
-- Run in Supabase SQL Editor after `SUPABASE_SETUP_SITE_ANALYTICS.sql`.
-- Replaces 20k-row client pulls with one RPC (admin role only).

create or replace function public.admin_site_analytics_dashboard(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_since timestamptz;
  v_prev_start timestamptz;
  v_wau_since timestamptz;
  v_uid uuid;
  v_days int;
  v_click_events text[] := array[
    'fund_select',
    'stock_select',
    'product_select',
    'product_apply_click',
    'home_fund_click'
  ];
begin
  v_uid := auth.uid();
  if v_uid is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_uid
      and ur.role = 'admin'
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_days := greatest(1, least(366, coalesce(p_days, 30)));
  v_since := v_now - (v_days::text || ' days')::interval;
  v_prev_start := v_since - (v_days::text || ' days')::interval;
  v_wau_since := v_now - interval '7 days';

  return jsonb_build_object(
    'summary',
    (
      select jsonb_build_object(
        'page_views', coalesce(count(*) filter (where event_name = 'page_view'), 0),
        'unique_sessions_page_view', coalesce(count(distinct session_id) filter (where event_name = 'page_view'), 0),
        'searches', coalesce(count(*) filter (where event_name = 'search'), 0),
        'unique_search_sessions', coalesce(count(distinct session_id) filter (where event_name = 'search'), 0),
        'product_clicks', coalesce(count(*) filter (where event_name = any (v_click_events)), 0),
        'unique_product_click_sessions', coalesce(count(distinct session_id) filter (where event_name = any (v_click_events)), 0),
        'landing_view_events', coalesce(count(*) filter (
          where event_name = 'page_view'
            and (
              trim(coalesce(referrer_domain, '')) <> ''
              or trim(coalesce(source, '')) <> ''
              or trim(coalesce(medium, '')) <> ''
            )
        ), 0),
        'unique_landing_sessions', coalesce(count(distinct session_id) filter (
          where event_name = 'page_view'
            and (
              trim(coalesce(referrer_domain, '')) <> ''
              or trim(coalesce(source, '')) <> ''
              or trim(coalesce(medium, '')) <> ''
            )
        ), 0),
        'avg_dwell_ms', coalesce(round(avg(dwell_ms) filter (where event_name = 'page_exit' and dwell_ms is not null and dwell_ms > 0))::bigint, 0)
      )
      from public.v_customer_site_analytics_events
      where created_at >= v_since
    ),
    'summary_prev',
    (
      select jsonb_build_object(
        'page_views', coalesce(count(*) filter (where event_name = 'page_view'), 0),
        'unique_sessions_page_view', coalesce(count(distinct session_id) filter (where event_name = 'page_view'), 0),
        'searches', coalesce(count(*) filter (where event_name = 'search'), 0),
        'unique_search_sessions', coalesce(count(distinct session_id) filter (where event_name = 'search'), 0),
        'product_clicks', coalesce(count(*) filter (where event_name = any (v_click_events)), 0),
        'unique_product_click_sessions', coalesce(count(distinct session_id) filter (where event_name = any (v_click_events)), 0),
        'landing_view_events', coalesce(count(*) filter (
          where event_name = 'page_view'
            and (
              trim(coalesce(referrer_domain, '')) <> ''
              or trim(coalesce(source, '')) <> ''
              or trim(coalesce(medium, '')) <> ''
            )
        ), 0),
        'unique_landing_sessions', coalesce(count(distinct session_id) filter (
          where event_name = 'page_view'
            and (
              trim(coalesce(referrer_domain, '')) <> ''
              or trim(coalesce(source, '')) <> ''
              or trim(coalesce(medium, '')) <> ''
            )
        ), 0),
        'avg_dwell_ms', coalesce(round(avg(dwell_ms) filter (where event_name = 'page_exit' and dwell_ms is not null and dwell_ms > 0))::bigint, 0)
      )
      from public.v_customer_site_analytics_events
      where created_at >= v_prev_start
        and created_at < v_since
    ),
    'funnel',
    (
      select jsonb_build_array(
        jsonb_build_object(
          'step', 'Landing',
          'sessions', (select count(distinct e.session_id) from public.v_customer_site_analytics_events e where e.created_at >= v_since and e.event_name = 'page_view')
        ),
        jsonb_build_object(
          'step', 'Search',
          'sessions', (select count(distinct e.session_id) from public.v_customer_site_analytics_events e where e.created_at >= v_since and e.event_name = 'search')
        ),
        jsonb_build_object(
          'step', 'Detail View',
          'sessions', (
            select count(distinct e.session_id)
            from public.v_customer_site_analytics_events e
            where e.created_at >= v_since
              and e.event_name in ('fund_detail_view', 'product_detail_view')
          )
        ),
        jsonb_build_object(
          'step', 'Item Click',
          'sessions', (select count(distinct e.session_id) from public.v_customer_site_analytics_events e where e.created_at >= v_since and e.event_name = any (v_click_events))
        ),
        jsonb_build_object(
          'step', 'Apply Click',
          'sessions', (select count(distinct e.session_id) from public.v_customer_site_analytics_events e where e.created_at >= v_since and e.event_name = 'product_apply_click')
        )
      )
    ),
    'top_pages',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.views desc)
      from (
        select
          e.page_path,
          count(*) filter (where e.event_name = 'page_view')::bigint as views,
          count(distinct e.session_id) filter (where e.event_name = 'page_view')::bigint as unique_sessions,
          coalesce(round(avg(e.dwell_ms) filter (where e.event_name = 'page_exit' and e.dwell_ms is not null and e.dwell_ms > 0)), 0)::bigint as avg_dwell_ms
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
        group by e.page_path
        having count(*) filter (where e.event_name = 'page_view') > 0
        order by views desc
        limit 15
      ) t
    ), '[]'::jsonb),
    'top_products',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.clicks desc)
      from (
        select
          coalesce(e.event_meta->>'product_type', e.event_meta->>'item_type', 'unknown') as product_type,
          coalesce(e.event_meta->>'product_id', e.event_meta->>'item_id', '') as product_id,
          coalesce(e.event_meta->>'product_name', e.event_meta->>'item_name', '') as product_name,
          count(*)::bigint as clicks,
          count(distinct e.session_id)::bigint as unique_sessions
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
          and e.event_name = any (v_click_events)
          and coalesce(e.event_meta->>'product_id', e.event_meta->>'item_id', '') <> ''
        group by 1, 2, 3
        order by clicks desc
        limit 15
      ) t
    ), '[]'::jsonb),
    'top_searches',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.searches desc)
      from (
        select
          e.page_path,
          lower(trim(coalesce(e.event_meta->>'query', ''))) as query,
          count(*)::bigint as searches,
          coalesce(round(avg(nullif((e.event_meta->>'result_count')::numeric, 0)), 1), 0)::numeric as avg_result_count
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
          and e.event_name = 'search'
        group by e.page_path, lower(trim(coalesce(e.event_meta->>'query', '')))
        having lower(trim(coalesce(e.event_meta->>'query', ''))) <> ''
        order by searches desc
        limit 15
      ) t
    ), '[]'::jsonb),
    'top_referrers',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.landing_views desc)
      from (
        select
          nullif(trim(e.referrer_domain), '') as referrer_domain,
          nullif(trim(e.source), '') as utm_source,
          nullif(trim(e.medium), '') as utm_medium,
          count(*) filter (where e.event_name = 'page_view')::bigint as landing_views,
          count(distinct e.session_id) filter (where e.event_name = 'page_view')::bigint as unique_sessions
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
          and e.event_name = 'page_view'
          and (
            trim(coalesce(e.referrer_domain, '')) <> ''
            or trim(coalesce(e.source, '')) <> ''
            or trim(coalesce(e.medium, '')) <> ''
          )
        group by 1, 2, 3
        order by landing_views desc
        limit 15
      ) t
    ), '[]'::jsonb),
    'top_campaigns',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.page_views desc)
      from (
        select
          nullif(trim(e.campaign), '') as campaign,
          nullif(trim(e.source), '') as utm_source,
          nullif(trim(e.medium), '') as utm_medium,
          count(*) filter (where e.event_name = 'page_view')::bigint as page_views,
          count(distinct e.session_id) filter (where e.event_name = 'page_view')::bigint as unique_sessions
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
          and trim(coalesce(e.campaign, '')) <> ''
        group by 1, 2, 3
        order by page_views desc
        limit 15
      ) t
    ), '[]'::jsonb),
    'daily_trend',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.sort_day asc)
      from (
        select
          to_char(date_trunc('day', e.created_at at time zone 'UTC'), 'MM-DD') as day,
          date_trunc('day', e.created_at at time zone 'UTC')::date as sort_day,
          count(*) filter (where e.event_name = 'page_view')::bigint as page_views,
          count(*) filter (where e.event_name = 'search')::bigint as searches,
          count(*) filter (where e.event_name = any (v_click_events))::bigint as product_clicks,
          count(distinct e.session_id) filter (where e.event_name = 'page_view')::bigint as unique_sessions
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
        group by 1, 2
        order by sort_day asc
      ) t
    ), '[]'::jsonb),
    'event_breakdown',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.events desc)
      from (
        select
          e.event_name,
          count(*)::bigint as events,
          count(distinct e.session_id)::bigint as unique_sessions
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
        group by e.event_name
        order by events desc
        limit 50
      ) t
    ), '[]'::jsonb),
    'engagement',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.events desc)
      from (
        select
          e.event_name,
          count(*)::bigint as events,
          count(distinct e.session_id)::bigint as unique_sessions
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
          and e.event_name in (
            'home_navigation_click',
            'home_referral_copy',
            'home_referral_share',
            'fund_detail_view',
            'product_detail_view',
            'fund_watchlist_add',
            'fund_watchlist_remove',
            'stock_watchlist_add',
            'stock_watchlist_remove'
          )
        group by e.event_name
        order by events desc
      ) t
    ), '[]'::jsonb),
    'activity',
    jsonb_build_object(
      'dau_daily',
      coalesce((
        select jsonb_agg(row_to_json(t)::jsonb order by t.day asc)
        from (
          select
            gs.d::text as day,
            (
              select count(distinct e.session_id)::bigint
              from public.v_customer_site_analytics_events e
              where e.event_name = 'page_view'
                and (timezone('UTC', e.created_at))::date = gs.d::date
            ) as active_sessions,
            (
              select count(distinct e.user_id)::bigint
              from public.v_customer_site_analytics_events e
              where e.event_name = 'page_view'
                and e.user_id is not null
                and (timezone('UTC', e.created_at))::date = gs.d::date
            ) as active_users
          from generate_series(
            (timezone('UTC', v_since))::date,
            (timezone('UTC', v_now))::date,
            interval '1 day'
          ) as gs(d)
        ) t
      ), '[]'::jsonb),
      'rolling',
      jsonb_build_object(
        'wau_sessions',
        coalesce((
          select count(distinct session_id)::bigint
          from public.v_customer_site_analytics_events
          where created_at >= v_wau_since and event_name = 'page_view'
        ), 0),
        'mau_sessions_window',
        coalesce((
          select count(distinct session_id)::bigint
          from public.v_customer_site_analytics_events
          where created_at >= v_since and event_name = 'page_view'
        ), 0)
      ),
      'cohort_sessions',
      (
        with first_pv as (
          select user_id, min(created_at) as first_at
          from public.v_customer_site_analytics_events
          where user_id is not null and event_name = 'page_view'
          group by user_id
        ),
        sess as (
          select distinct e.session_id, e.user_id
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'page_view' and e.user_id is not null
        ),
        anon as (
          select count(distinct e.session_id)::bigint as c
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'page_view' and e.user_id is null
        )
        select jsonb_build_object(
          'logged_in_sessions', coalesce((select count(*)::bigint from sess), 0),
          'new_user_sessions', coalesce((
            select count(*)::bigint from sess s
            join first_pv f on f.user_id = s.user_id
            where f.first_at >= v_since
          ), 0),
          'returning_user_sessions', coalesce((
            select count(*)::bigint from sess s
            join first_pv f on f.user_id = s.user_id
            where f.first_at < v_since
          ), 0),
          'anonymous_sessions', coalesce((select c from anon), 0)
        )
      ),
      'watchlist',
      jsonb_build_object(
        'fund_watchlist_adds', coalesce((
          select count(*)::bigint from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'fund_watchlist_add'
        ), 0),
        'fund_watchlist_removes', coalesce((
          select count(*)::bigint from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'fund_watchlist_remove'
        ), 0),
        'stock_watchlist_adds', coalesce((
          select count(*)::bigint from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'stock_watchlist_add'
        ), 0),
        'stock_watchlist_removes', coalesce((
          select count(*)::bigint from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'stock_watchlist_remove'
        ), 0),
        'top_add_symbols',
        coalesce((
          select jsonb_agg(row_to_json(t)::jsonb order by t.adds desc)
          from (
            select
              coalesce(
                nullif(trim(e.event_meta->>'symbol'), ''),
                nullif(trim(e.event_meta->>'product_id'), ''),
                nullif(trim(e.event_meta->>'item_id'), ''),
                '(unknown)'
              ) as symbol,
              count(*)::bigint as adds
            from public.v_customer_site_analytics_events e
            where e.created_at >= v_since
              and e.event_name in ('fund_watchlist_add', 'stock_watchlist_add')
            group by 1
            order by adds desc
            limit 15
          ) t
        ), '[]'::jsonb)
      ),
      'attribution_signups',
      jsonb_build_object(
        'signups_in_window', coalesce((
          select count(*)::bigint
          from auth.users u
          where u.created_at >= v_since
            and not (
              lower(u.email) like '%@moneymart.co.jp'
              or lower(u.email) = 'test@moneymart.co.jp'
              or lower(u.email) like 'test+%'
              or lower(u.email) like '%+test@%'
            )
        ), 0),
        'signups_landing_funds_or_tools',
        coalesce((
          select count(*)::bigint
          from auth.users u
          join public.user_profiles p on p.user_id = u.id
          where u.created_at >= v_since
            and not (
              lower(u.email) like '%@moneymart.co.jp'
              or lower(u.email) = 'test@moneymart.co.jp'
              or lower(u.email) like 'test+%'
              or lower(u.email) like '%+test@%'
            )
            and (
              coalesce(p.signup_landing_path, '') like '/tools%'
              or coalesce(p.signup_landing_path, '') like '/funds%'
              or coalesce(p.signup_landing_path, '') = '/stocks'
              or coalesce(p.signup_landing_path, '') like '/market%'
              or coalesce(p.signup_landing_path, '') like '/insights%'
            )
        ), 0),
        'signups_landing_compare',
        coalesce((
          select count(*)::bigint
          from auth.users u
          join public.user_profiles p on p.user_id = u.id
          where u.created_at >= v_since
            and not (
              lower(u.email) like '%@moneymart.co.jp'
              or lower(u.email) = 'test@moneymart.co.jp'
              or lower(u.email) like 'test+%'
              or lower(u.email) like '%+test@%'
            )
            and (
              coalesce(p.signup_landing_path, '') in ('/funds/compare', '/etf-compare')
              or coalesce(p.signup_landing_path, '') like '/funds/compare%'
              or coalesce(p.signup_landing_path, '') like '/etf-compare%'
            )
        ), 0),
        'premium_sessions_pageview',
        coalesce((
          select count(distinct e.session_id)::bigint
          from public.v_customer_site_analytics_events e
          join public.user_profiles p on p.user_id = e.user_id
          where e.created_at >= v_since
            and e.event_name = 'page_view'
            and e.user_id is not null
            and coalesce(p.is_premium, false) = true
        ), 0)
      )
    ),
    'meta',
    jsonb_build_object(
      'days', v_days,
      'since', v_since,
      'prev_since', v_prev_start,
      'generated_at', v_now
    )
  );
end;
$$;

comment on function public.admin_site_analytics_dashboard(integer) is
  'Admin-only JSON dashboard: events summary + activity (DAU daily, WAU/MAU, cohort sessions, watchlist, signup attribution, premium sessions).';

grant execute on function public.admin_site_analytics_dashboard(integer) to authenticated;


create or replace function public.admin_crm_traffic_dashboard(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_since timestamptz;
  v_days int;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null or not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_uid and ur.role = 'admin'
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_days := greatest(1, least(366, coalesce(p_days, 30)));
  v_since := v_now - (v_days::text || ' days')::interval;

  return jsonb_build_object(
    'summary',
    (
      with sess as (
        select
          e.session_id,
          bool_or(e.user_id is not null) as is_logged_in,
          bool_or(
            e.user_id is not null and not public.mm_is_internal_auth_user(e.user_id)
          ) as is_customer_logged_in,
          count(*) filter (where e.event_name = 'page_view') as page_views
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
        group by e.session_id
      ),
      signups as (
        select count(*)::bigint as c
        from auth.users u
        where u.created_at >= v_since
          and not (
            lower(u.email) like '%@moneymart.co.jp'
            or lower(u.email) = 'test@moneymart.co.jp'
            or lower(u.email) like 'test+%'
            or lower(u.email) like '%+test@%'
          )
      )
      select jsonb_build_object(
        'page_views', coalesce((
          select count(*)::bigint
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'page_view'
        ), 0),
        'unique_sessions', coalesce((select count(*)::bigint from sess), 0),
        'anonymous_sessions', coalesce((select count(*)::bigint from sess where not is_logged_in), 0),
        'logged_in_sessions', coalesce((select count(*)::bigint from sess where is_customer_logged_in), 0),
        'attributed_sessions', coalesce((
          select count(distinct e.session_id)::bigint
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since
            and e.event_name = 'page_view'
            and not public.mm_is_internal_referrer_domain(e.referrer_domain)
            and (
              trim(coalesce(e.referrer_domain, '')) <> ''
              or trim(coalesce(e.source, '')) <> ''
              or trim(coalesce(e.medium, '')) <> ''
              or trim(coalesce(e.campaign, '')) <> ''
            )
        ), 0),
        'direct_unknown_sessions', coalesce((
          select count(distinct e.session_id)::bigint
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since
            and e.event_name = 'page_view'
            and trim(coalesce(e.referrer_domain, '')) = ''
            and trim(coalesce(e.source, '')) = ''
            and trim(coalesce(e.medium, '')) = ''
            and trim(coalesce(e.campaign, '')) = ''
        ), 0),
        'signups_in_window', coalesce((select c from signups), 0),
        'signup_conversion_pct', case
          when coalesce((select count(*) from sess), 0) = 0 then 0
          else round(
            ((select c from signups)::numeric / greatest(1, (select count(*) from sess)::numeric)) * 1000
          ) / 10
        end
      )
    ),
    'cohort',
    (
      with first_sess as (
        select session_id, min(created_at) as first_at
        from public.v_customer_site_analytics_events
        where event_name = 'page_view'
        group by session_id
      ),
      window_sess as (
        select distinct e.session_id, e.user_id
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since and e.event_name = 'page_view'
      ),
      anon as (
        select count(distinct e.session_id)::bigint as c
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since and e.event_name = 'page_view' and e.user_id is null
          and not exists (
            select 1 from public.v_customer_site_analytics_events e2
            where e2.session_id = e.session_id and e2.user_id is not null
          )
      ),
      logged as (
        select count(distinct e.session_id)::bigint as c
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
          and e.event_name = 'page_view'
          and e.user_id is not null
          and not public.mm_is_internal_auth_user(e.user_id)
      ),
      new_sess as (
        select count(*)::bigint as c
        from window_sess ws
        join first_sess fs on fs.session_id = ws.session_id
        where fs.first_at >= v_since
      ),
      ret_sess as (
        select count(*)::bigint as c
        from window_sess ws
        join first_sess fs on fs.session_id = ws.session_id
        where fs.first_at < v_since
      )
      select jsonb_build_object(
        'anonymous_sessions', coalesce((select c from anon), 0),
        'logged_in_sessions', coalesce((select c from logged), 0),
        'new_sessions', coalesce((select c from new_sess), 0),
        'returning_sessions', coalesce((select c from ret_sess), 0)
      )
    ),
    'top_referrers',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.sessions desc)
      from (
        select
          coalesce(nullif(trim(e.referrer_domain), ''), '(direct / unknown)') as referrer_domain,
          nullif(trim(e.source), '') as utm_source,
          nullif(trim(e.medium), '') as utm_medium,
          count(distinct e.session_id)::bigint as sessions,
          count(*) filter (where e.event_name = 'page_view')::bigint as page_views,
          count(distinct e.session_id) filter (where e.user_id is null)::bigint as anonymous_sessions,
          count(distinct e.session_id) filter (
            where e.user_id is not null and not public.mm_is_internal_auth_user(e.user_id)
          )::bigint as logged_in_sessions
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
          and e.event_name = 'page_view'
          and not public.mm_is_internal_referrer_domain(e.referrer_domain)
        group by 1, 2, 3
        order by sessions desc
        limit 20
      ) t
    ), '[]'::jsonb),
    'top_landing_paths',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.sessions desc)
      from (
        with session_landing as (
          select distinct on (e.session_id)
            e.session_id,
            e.page_path as landing_path
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'page_view'
          order by e.session_id, e.created_at asc
        ),
        session_agg as (
          select
            e.session_id,
            bool_or(
              e.user_id is not null and not public.mm_is_internal_auth_user(e.user_id)
            ) as is_logged_in,
            count(*) filter (where e.event_name = 'page_view') as page_views
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since
          group by e.session_id
        )
        select
          coalesce(nullif(trim(sl.landing_path), ''), '(unknown)') as landing_path,
          count(*)::bigint as sessions,
          sum(sa.page_views)::bigint as page_views,
          sum(case when sa.is_logged_in then 1 else 0 end)::bigint as logged_in_sessions,
          sum(case when not sa.is_logged_in then 1 else 0 end)::bigint as anonymous_sessions
        from session_landing sl
        join session_agg sa on sa.session_id = sl.session_id
        group by 1
        order by sessions desc
        limit 20
      ) t
    ), '[]'::jsonb),
    'top_utm_sources',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.sessions desc)
      from (
        with session_landing as (
          select distinct on (e.session_id)
            e.session_id,
            e.source as utm_source
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'page_view'
          order by e.session_id, e.created_at asc
        ),
        session_agg as (
          select
            e.session_id,
            count(*) filter (where e.event_name = 'page_view') as page_views
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since
          group by e.session_id
        )
        select
          coalesce(nullif(trim(sl.utm_source), ''), '(none)') as utm_source,
          count(*)::bigint as sessions,
          sum(sa.page_views)::bigint as page_views
        from session_landing sl
        join session_agg sa on sa.session_id = sl.session_id
        group by 1
        order by sessions desc
        limit 15
      ) t
    ), '[]'::jsonb),
    'daily_trend',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.sort_day asc)
      from (
        select
          to_char(date_trunc('day', e.created_at at time zone 'UTC'), 'MM-DD') as day,
          date_trunc('day', e.created_at at time zone 'UTC')::date as sort_day,
          count(distinct e.session_id) filter (where e.event_name = 'page_view')::bigint as sessions,
          count(distinct e.session_id) filter (
            where e.event_name = 'page_view' and e.user_id is null
          )::bigint as anonymous_sessions,
          count(distinct e.session_id) filter (
            where e.event_name = 'page_view'
              and e.user_id is not null
              and not public.mm_is_internal_auth_user(e.user_id)
          )::bigint as logged_in_sessions,
          count(*) filter (where e.event_name = 'page_view')::bigint as page_views
        from public.v_customer_site_analytics_events e
        where e.created_at >= v_since
        group by 1, 2
        order by sort_day asc
      ) t
    ), '[]'::jsonb),
    'recent_sessions',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.last_at desc)
      from (
        with landing as (
          select distinct on (e.session_id)
            e.session_id,
            e.page_path as landing_path,
            e.referrer_domain,
            e.source as utm_source,
            e.medium as utm_medium,
            e.campaign as utm_campaign,
            e.created_at as first_at
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'page_view'
          order by e.session_id, e.created_at asc
        ),
        agg as (
          select
            e.session_id,
            (array_agg(e.user_id order by e.created_at desc) filter (where e.user_id is not null))[1] as user_id,
            bool_or(e.user_id is not null) as is_logged_in,
            count(*) filter (where e.event_name = 'page_view') as page_views,
            min(e.created_at) as first_at,
            max(e.created_at) as last_at
          from public.v_customer_site_analytics_events e
          where e.created_at >= v_since
          group by e.session_id
        )
        select
          left(a.session_id, 8) || '…' as session_short,
          a.session_id,
          case when a.is_logged_in then 'registered' else 'anonymous' end as visitor_type,
          a.is_logged_in,
          a.user_id,
          u.email::text as email,
          coalesce(nullif(trim(l.referrer_domain), ''), '(direct / unknown)') as referrer_domain,
          nullif(trim(l.utm_source), '') as utm_source,
          nullif(trim(l.utm_medium), '') as utm_medium,
          nullif(trim(l.utm_campaign), '') as utm_campaign,
          coalesce(nullif(trim(l.landing_path), ''), '(unknown)') as landing_path,
          a.page_views::bigint as page_views,
          a.first_at,
          a.last_at,
          exists (
            select 1 from auth.users su
            where su.id = a.user_id
              and su.created_at >= v_since
              and a.first_at >= su.created_at - interval '2 hours'
              and a.first_at <= su.created_at + interval '48 hours'
              and not (
                lower(su.email) like '%@moneymart.co.jp'
                or lower(su.email) like 'test+%'
              )
          ) as signed_up_in_window
        from agg a
        left join landing l on l.session_id = a.session_id
        left join auth.users u on u.id = a.user_id
        where not public.mm_is_internal_referrer_domain(l.referrer_domain)
          and not (a.user_id is not null and public.mm_is_internal_auth_user(a.user_id))
        order by a.last_at desc
        limit 120
      ) t
    ), '[]'::jsonb),
    'meta',
    jsonb_build_object(
      'days', v_days,
      'since', v_since,
      'generated_at', v_now,
      'excludes_internal_users', true
    )
  );
end;
$$;

comment on function public.mm_is_internal_auth_user(uuid) is
  'True for @moneymart.co.jp / test+* staff accounts.';

comment on function public.admin_crm_traffic_dashboard(integer) is
  'Admin CRM: visitor sessions; logged_in excludes staff; recent_sessions hides internal users/referrers.';

revoke all on function public.mm_is_internal_auth_user(uuid) from public;
grant execute on function public.mm_is_internal_auth_user(uuid) to authenticated;

revoke all on function public.admin_crm_traffic_dashboard(integer) from public;
grant execute on function public.admin_crm_traffic_dashboard(integer) to authenticated;
