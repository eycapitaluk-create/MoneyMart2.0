-- Admin-only page of customer analytics events.
-- The browser must not select v_customer_site_analytics_events (403 for authenticated).
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.admin_customer_analytics_events(
  p_since timestamptz,
  p_limit integer default 1000,
  p_offset integer default 0,
  p_event_name text default null
)
returns table (
  event_name text,
  page_path text,
  session_id text,
  user_id uuid,
  referrer_domain text,
  source text,
  medium text,
  campaign text,
  dwell_ms integer,
  event_meta jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 1000));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_uid
      and ur.role = 'admin'
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  select
    e.event_name,
    e.page_path,
    e.session_id,
    e.user_id,
    e.referrer_domain,
    e.source,
    e.medium,
    e.campaign,
    e.dwell_ms,
    e.event_meta,
    e.created_at
  from public.site_analytics_events e
  where e.created_at >= coalesce(p_since, now() - interval '30 days')
    and (p_event_name is null or e.event_name = p_event_name)
    and (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id))
    and coalesce(e.page_path, '') not like '/admin%'
  order by e.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

comment on function public.admin_customer_analytics_events(timestamptz, integer, integer, text) is
  'Admin CRM/analytics event page. Excludes staff users and /admin paths. Caller must be user_roles.admin.';

revoke all on function public.admin_customer_analytics_events(timestamptz, integer, integer, text) from public;
revoke all on function public.admin_customer_analytics_events(timestamptz, integer, integer, text) from anon;
revoke all on function public.admin_customer_analytics_events(timestamptz, integer, integer, text) from authenticated;
grant execute on function public.admin_customer_analytics_events(timestamptz, integer, integer, text) to authenticated;
grant execute on function public.admin_customer_analytics_events(timestamptz, integer, integer, text) to service_role;
