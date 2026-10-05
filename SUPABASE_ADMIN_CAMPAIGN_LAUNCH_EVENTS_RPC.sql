-- Admin-only event rows for the October campaign flow card.
-- Keep customer analytics private; do not grant SELECT on the underlying view.
create or replace function public.admin_campaign_launch_events(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_events jsonb;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
  into v_events
  from (
    select
      a.created_at,
      a.event_name,
      a.page_path,
      a.session_id,
      a.source,
      a.medium,
      a.event_meta ->> 'campaign_id' as campaign_id
    from public.v_customer_site_analytics_events a
    where a.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 90)))
      and a.created_at >= timestamptz '2026-09-30 15:00:00+00'
      and a.created_at < timestamptz '2026-10-30 15:00:00+00'
      and (
        a.page_path = '/campaign/sns-2026'
        or a.event_name in (
          'campaign_view', 'campaign_cta', 'campaign_survey_submit',
          'campaign_sns_submit', 'campaign_apply'
        )
      )
      and (
        a.user_id is null
        or not exists (
          select 1
          from auth.users u
          where u.id = a.user_id
            and lower(u.email) like '%@community.seed'
        )
      )
    order by a.created_at desc
    limit 8000
  ) e;

  return v_events;
end;
$$;

revoke all on function public.admin_campaign_launch_events(integer) from public, anon;
grant execute on function public.admin_campaign_launch_events(integer) to authenticated;
