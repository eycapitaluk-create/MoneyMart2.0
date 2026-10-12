-- MoneyMart — CRM Audience panel (active times heatmap, device, locale, onboarding)
-- Run after SUPABASE_PATCH_CRM_TRAFFIC_EXCLUDE_INTERNAL_USERS.sql

create or replace function public.admin_crm_audience_dashboard(p_days integer default 28)
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
  v_page_views bigint;
  v_peak_label text := '';
begin
  v_uid := auth.uid();
  if v_uid is null or not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_uid and ur.role = 'admin'
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_days := greatest(1, least(366, coalesce(p_days, 28)));
  v_since := v_now - (v_days::text || ' days')::interval;

  select count(*)::bigint into v_page_views
  from public.site_analytics_events e
  where e.created_at >= v_since
    and e.event_name = 'page_view'
    and not public.mm_is_internal_referrer_domain(e.referrer_domain)
    and (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id));

  select format('%s %s–%s JST', dow_lbl, hr_lbl, hr_end)
  into v_peak_label
  from (
    select
      case extract(dow from local_ts)::int
        when 1 then 'Mo' when 2 then 'Tu' when 3 then 'We' when 4 then 'Th'
        when 5 then 'Fr' when 6 then 'Sa' else 'Su'
      end as dow_lbl,
      (array['12am','4am','8am','12pm','4pm','8pm'])[(floor(extract(hour from local_ts) / 4)::int + 1)] as hr_lbl,
      (array['4am','8am','12pm','4pm','8pm','12am'])[(floor(extract(hour from local_ts) / 4)::int + 1)] as hr_end,
      count(*)::bigint as c
    from (
      select (e.created_at at time zone 'Asia/Tokyo') as local_ts
      from public.site_analytics_events e
      where e.created_at >= v_since
        and e.event_name = 'page_view'
        and not public.mm_is_internal_referrer_domain(e.referrer_domain)
        and (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id))
    ) x
    group by 1, 2, 3
    order by c desc
    limit 1
  ) peak;

  return jsonb_build_object(
    'active_times',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb)
      from (
        select
          case extract(dow from local_ts)::int
            when 0 then 6
            else extract(dow from local_ts)::int - 1
          end as mon_index,
          floor(extract(hour from local_ts) / 4)::int as block,
          count(*)::bigint as count
        from (
          select (e.created_at at time zone 'Asia/Tokyo') as local_ts
          from public.site_analytics_events e
          where e.created_at >= v_since
            and e.event_name = 'page_view'
            and not public.mm_is_internal_referrer_domain(e.referrer_domain)
            and (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id))
        ) ev
        group by 1, 2
      ) t
    ), '[]'::jsonb),
    'peak_label', coalesce(v_peak_label, ''),
    'device_breakdown',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.count desc)
      from (
        select
          coalesce(nullif(trim(e.event_meta->>'device_type'), ''), 'unknown') as device_type,
          count(*)::bigint as count,
          round(count(*)::numeric / greatest(1, v_page_views) * 1000) / 10 as pct
        from public.site_analytics_events e
        where e.created_at >= v_since
          and e.event_name = 'page_view'
          and not public.mm_is_internal_referrer_domain(e.referrer_domain)
          and (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id))
        group by 1
        order by count desc
      ) t
    ), '[]'::jsonb),
    'locale_breakdown',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.count desc)
      from (
        select
          upper(coalesce(nullif(split_part(trim(e.event_meta->>'locale'), '-', 1), ''), 'unknown')) as key,
          count(*)::bigint as count,
          round(count(*)::numeric / greatest(1, v_page_views) * 1000) / 10 as pct
        from public.site_analytics_events e
        where e.created_at >= v_since
          and e.event_name = 'page_view'
          and not public.mm_is_internal_referrer_domain(e.referrer_domain)
          and (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id))
        group by 1
        order by count desc
        limit 12
      ) t
    ), '[]'::jsonb),
    'hour_histogram',
    coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.hour asc)
      from (
        select
          extract(hour from local_ts)::int as hour,
          count(*)::bigint as count
        from (
          select (e.created_at at time zone 'Asia/Tokyo') as local_ts
          from public.site_analytics_events e
          where e.created_at >= v_since
            and e.event_name = 'page_view'
            and not public.mm_is_internal_referrer_domain(e.referrer_domain)
            and (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id))
        ) ev
        group by 1
      ) t
    ), '[]'::jsonb),
    'onboarding',
    (
      with customers as (
        select p.*
        from public.user_profiles p
        join auth.users u on u.id = p.user_id
        where not (
          lower(u.email) like '%@moneymart.co.jp'
          or lower(u.email) = 'test@moneymart.co.jp'
          or lower(u.email) like 'test+%'
          or lower(u.email) like '%+test@%'
        )
      ),
      complete as (
        select * from customers c
        where nullif(trim(c.onboarding_asset_mix), '') is not null
          and nullif(trim(c.onboarding_risk_tolerance), '') is not null
          and nullif(trim(c.onboarding_investment_horizon), '') is not null
      ),
      total_c as (select count(*)::bigint as n from customers),
      total_p as (select count(*)::bigint as n from complete)
      select jsonb_build_object(
        'total_customers', (select n from total_c),
        'with_profile', (select n from total_p),
        'risk_tolerance',
        coalesce((
          select jsonb_agg(row_to_json(t)::jsonb order by t.count desc)
          from (
            select onboarding_risk_tolerance as value, count(*)::bigint as count,
              round(count(*)::numeric / greatest(1, (select n from total_p)) * 1000) / 10 as pct
            from complete group by 1
          ) t
        ), '[]'::jsonb),
        'asset_mix',
        coalesce((
          select jsonb_agg(row_to_json(t)::jsonb order by t.count desc)
          from (
            select onboarding_asset_mix as value, count(*)::bigint as count,
              round(count(*)::numeric / greatest(1, (select n from total_p)) * 1000) / 10 as pct
            from complete group by 1
          ) t
        ), '[]'::jsonb),
        'horizon',
        coalesce((
          select jsonb_agg(row_to_json(t)::jsonb order by t.count desc)
          from (
            select onboarding_investment_horizon as value, count(*)::bigint as count,
              round(count(*)::numeric / greatest(1, (select n from total_p)) * 1000) / 10 as pct
            from complete group by 1
          ) t
        ), '[]'::jsonb)
      )
    ),
    'meta',
    jsonb_build_object(
      'days', v_days,
      'since', v_since,
      'timezone', 'Asia/Tokyo',
      'page_views', v_page_views,
      'generated_at', v_now
    )
  );
end;
$$;

comment on function public.admin_crm_audience_dashboard(integer) is
  'Admin CRM Audience: JST heatmap, device/locale breakdown, onboarding self-profile.';

revoke all on function public.admin_crm_audience_dashboard(integer) from public;
grant execute on function public.admin_crm_audience_dashboard(integer) to authenticated;
