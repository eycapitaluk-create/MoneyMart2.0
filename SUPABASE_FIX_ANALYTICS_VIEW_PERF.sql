-- Fix admin analytics / CRM traffic RPC timeouts after SUPABASE_PATCH_CRM_EXCLUDE_STAFF_FROM_STATS.sql
--
-- Root cause (perf): v_customer_site_analytics_events called mm_is_customer_analytics_event()
-- with a per-row EXISTS scan over site_analytics_events → statement timeout (57014).
--
-- Root cause (low counts): view dropped (a) moneymart.co.jp first-touch referrers and
-- (b) entire browser sessions after any staff login. Product usage should only exclude
-- rows where user_id is @moneymart.co.jp staff (plus /admin routes).
--
-- Run this in Supabase SQL Editor. Safe to re-run.

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
        limit 1
      )
    )
  );
$$;

comment on function public.mm_is_customer_analytics_event(uuid, text, text) is
  'Row-level staff filter helper. Product-usage aggregates use v_customer_site_analytics_events (staff only). Traffic RPCs apply mm_is_internal_referrer_domain separately.';

drop view if exists public.v_customer_site_analytics_events;

create or replace view public.v_customer_site_analytics_events as
select e.*
from public.site_analytics_events e
where (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id))
  and coalesce(e.page_path, '') not like '/admin%';

comment on view public.v_customer_site_analytics_events is
  'Customer product-usage events: exclude logged-in @moneymart.co.jp staff rows and /admin routes only (not whole sessions).';

grant select on public.v_customer_site_analytics_events to authenticated;
grant select on public.v_customer_site_analytics_events to service_role;
