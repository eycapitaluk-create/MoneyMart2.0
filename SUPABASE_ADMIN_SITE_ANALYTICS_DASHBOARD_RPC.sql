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
      from public.site_analytics_events
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
      from public.site_analytics_events
      where created_at >= v_prev_start
        and created_at < v_since
    ),
    'funnel',
    (
      select jsonb_build_array(
        jsonb_build_object(
          'step', 'Landing',
          'sessions', (select count(distinct e.session_id) from public.site_analytics_events e where e.created_at >= v_since and e.event_name = 'page_view')
        ),
        jsonb_build_object(
          'step', 'Search',
          'sessions', (select count(distinct e.session_id) from public.site_analytics_events e where e.created_at >= v_since and e.event_name = 'search')
        ),
        jsonb_build_object(
          'step', 'Detail View',
          'sessions', (
            select count(distinct e.session_id)
            from public.site_analytics_events e
            where e.created_at >= v_since
              and e.event_name in ('fund_detail_view', 'product_detail_view')
          )
        ),
        jsonb_build_object(
          'step', 'Item Click',
          'sessions', (select count(distinct e.session_id) from public.site_analytics_events e where e.created_at >= v_since and e.event_name = any (v_click_events))
        ),
        jsonb_build_object(
          'step', 'Apply Click',
          'sessions', (select count(distinct e.session_id) from public.site_analytics_events e where e.created_at >= v_since and e.event_name = 'product_apply_click')
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
        from public.site_analytics_events e
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
        from public.site_analytics_events e
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
        from public.site_analytics_events e
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
        from public.site_analytics_events e
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
        from public.site_analytics_events e
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
        from public.site_analytics_events e
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
        from public.site_analytics_events e
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
        from public.site_analytics_events e
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
              from public.site_analytics_events e
              where e.event_name = 'page_view'
                and (timezone('UTC', e.created_at))::date = gs.d::date
            ) as active_sessions,
            (
              select count(distinct e.user_id)::bigint
              from public.site_analytics_events e
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
          from public.site_analytics_events
          where created_at >= v_wau_since and event_name = 'page_view'
        ), 0),
        'mau_sessions_window',
        coalesce((
          select count(distinct session_id)::bigint
          from public.site_analytics_events
          where created_at >= v_since and event_name = 'page_view'
        ), 0)
      ),
      'cohort_sessions',
      (
        with first_pv as (
          select user_id, min(created_at) as first_at
          from public.site_analytics_events
          where user_id is not null and event_name = 'page_view'
          group by user_id
        ),
        sess as (
          select distinct e.session_id, e.user_id
          from public.site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'page_view' and e.user_id is not null
        ),
        anon as (
          select count(distinct e.session_id)::bigint as c
          from public.site_analytics_events e
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
          select count(*)::bigint from public.site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'fund_watchlist_add'
        ), 0),
        'fund_watchlist_removes', coalesce((
          select count(*)::bigint from public.site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'fund_watchlist_remove'
        ), 0),
        'stock_watchlist_adds', coalesce((
          select count(*)::bigint from public.site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'stock_watchlist_add'
        ), 0),
        'stock_watchlist_removes', coalesce((
          select count(*)::bigint from public.site_analytics_events e
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
            from public.site_analytics_events e
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
          select count(*)::bigint from auth.users u where u.created_at >= v_since
        ), 0),
        'signups_landing_funds_or_tools',
        coalesce((
          select count(*)::bigint
          from auth.users u
          join public.user_profiles p on p.user_id = u.id
          where u.created_at >= v_since
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
            and (
              coalesce(p.signup_landing_path, '') in ('/funds/compare', '/etf-compare')
              or coalesce(p.signup_landing_path, '') like '/funds/compare%'
              or coalesce(p.signup_landing_path, '') like '/etf-compare%'
            )
        ), 0),
        'premium_sessions_pageview',
        coalesce((
          select count(distinct e.session_id)::bigint
          from public.site_analytics_events e
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
