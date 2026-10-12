-- MoneyMart — Exclude @moneymart.co.jp staff from CRM visitor "logged in" counts + recent sessions
-- Run after SUPABASE_ADMIN_CRM_ENHANCED.sql
-- Pairs with frontend filter in AdminPage (recent visits list)

create or replace function public.mm_is_internal_referrer_domain(p_domain text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    lower(trim(both from coalesce(p_domain, ''))) in ('moneymart.co.jp', 'www.moneymart.co.jp')
    or lower(trim(both from coalesce(p_domain, ''))) like '%.moneymart.co.jp',
    false
  );
$$;

create or replace function public.mm_is_internal_auth_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and (
        lower(u.email) like '%@moneymart.co.jp'
        or lower(u.email) like '%@community.seed'
        or lower(u.email) = 'test@moneymart.co.jp'
        or lower(u.email) like 'test+%'
        or lower(u.email) like '%+test@%'
      )
  );
$$;

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
        from public.site_analytics_events e
        where e.created_at >= v_since
        group by e.session_id
      ),
      signups as (
        select count(*)::bigint as c
        from auth.users u
        where u.created_at >= v_since
          and not (
            lower(u.email) like '%@moneymart.co.jp'
            or lower(u.email) like '%@community.seed'
            or lower(u.email) = 'test@moneymart.co.jp'
            or lower(u.email) like 'test+%'
            or lower(u.email) like '%+test@%'
          )
      )
      select jsonb_build_object(
        'page_views', coalesce((
          select count(*)::bigint
          from public.site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'page_view'
        ), 0),
        'unique_sessions', coalesce((select count(*)::bigint from sess), 0),
        'anonymous_sessions', coalesce((select count(*)::bigint from sess where not is_logged_in), 0),
        'logged_in_sessions', coalesce((select count(*)::bigint from sess where is_customer_logged_in), 0),
        'attributed_sessions', coalesce((
          select count(distinct e.session_id)::bigint
          from public.site_analytics_events e
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
          from public.site_analytics_events e
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
        from public.site_analytics_events
        where event_name = 'page_view'
        group by session_id
      ),
      window_sess as (
        select distinct e.session_id, e.user_id
        from public.site_analytics_events e
        where e.created_at >= v_since and e.event_name = 'page_view'
      ),
      anon as (
        select count(distinct e.session_id)::bigint as c
        from public.site_analytics_events e
        where e.created_at >= v_since and e.event_name = 'page_view' and e.user_id is null
          and not exists (
            select 1 from public.site_analytics_events e2
            where e2.session_id = e.session_id and e2.user_id is not null
          )
      ),
      logged as (
        select count(distinct e.session_id)::bigint as c
        from public.site_analytics_events e
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
        from public.site_analytics_events e
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
          from public.site_analytics_events e
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
          from public.site_analytics_events e
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
          from public.site_analytics_events e
          where e.created_at >= v_since and e.event_name = 'page_view'
          order by e.session_id, e.created_at asc
        ),
        session_agg as (
          select
            e.session_id,
            count(*) filter (where e.event_name = 'page_view') as page_views
          from public.site_analytics_events e
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
        from public.site_analytics_events e
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
          from public.site_analytics_events e
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
          from public.site_analytics_events e
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
