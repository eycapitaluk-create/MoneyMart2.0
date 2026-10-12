-- MoneyMart 2.0 — Analytics hygiene: drop dev/local traffic and bot-like sessions
--
-- Why: admin_site_analytics_dashboard and admin_crm_traffic_dashboard both read
-- public.v_customer_site_analytics_events, which so far only excluded logged-in
-- staff rows and /admin paths. Localhost traffic, crawler sessions, and staff
-- work sessions were still counted as real customer sessions, inflating session
-- and page-view totals.
--
-- Run order: after SUPABASE_PATCH_CRM_EXCLUDE_STAFF_FROM_STATS.sql.
-- Safe to re-run.
--
-- Nothing here deletes source rows. site_analytics_events keeps every event;
-- exclusions are recorded in public.mm_excluded_sessions so they stay auditable
-- and reversible.


-- ---------------------------------------------------------------------------
-- 1) Dev / preview traffic detector
-- ---------------------------------------------------------------------------
-- page_path holds a pathname only, so the host has to come from the referrer or
-- the landing query string. This catches in-app navigation on localhost and
-- links pasted from a dev/preview origin; a cold first hit on localhost with an
-- empty referrer is not detectable here.

create or replace function public.mm_is_dev_traffic(
  p_referrer_url text,
  p_referrer_domain text,
  p_page_query text
)
returns boolean
language sql
immutable
as $$
  with d as (
    select
      lower(trim(both from coalesce(p_referrer_domain, ''))) as dom,
      lower(trim(both from coalesce(p_referrer_url, ''))) as url,
      lower(trim(both from coalesce(p_page_query, ''))) as qry
  )
  select coalesce(
    (
      d.dom = 'localhost'
      or d.dom like 'localhost:%'
      or d.dom like '127.0.0.1%'
      or d.dom like '0.0.0.0%'
      or d.dom like '%.local'
      or d.dom like '%.vercel.app'
      or d.url like '%localhost%'
      or d.url like '%127.0.0.1%'
      or d.url like '%0.0.0.0%'
      or d.url like '%.vercel.app%'
      or d.qry like '%localhost%'
    ),
    false
  )
  from d;
$$;

comment on function public.mm_is_dev_traffic(text, text, text) is
  'True for local dev / Vercel preview traffic. Production origin is moneymart.co.jp only.';


-- ---------------------------------------------------------------------------
-- 2) Excluded session registry (auditable, reversible)
-- ---------------------------------------------------------------------------

create table if not exists public.mm_excluded_sessions (
  session_id text primary key,
  reason text not null,
  page_views integer not null default 0,
  distinct_paths integer not null default 0,
  interaction_events integer not null default 0,
  first_at timestamptz,
  last_at timestamptz,
  detected_at timestamptz not null default now()
);

comment on table public.mm_excluded_sessions is
  'Sessions removed from customer analytics (bots/crawlers). Source events are never deleted; delete a row here to put a session back.';

create index if not exists idx_mm_excluded_sessions_reason
  on public.mm_excluded_sessions (reason);


-- ---------------------------------------------------------------------------
-- 3) Bot-like session detection
-- ---------------------------------------------------------------------------
-- Deliberately conservative: a session only qualifies when it racks up a large
-- number of page views AND never performs a single human interaction (search,
-- detail view, click, watchlist). Real power users trigger interactions.
-- Review candidates in v_mm_bot_session_candidates before refreshing.

create or replace view public.v_mm_bot_session_candidates as
select
  e.session_id,
  count(*) filter (where e.event_name = 'page_view')::integer as page_views,
  count(distinct e.page_path) filter (where e.event_name = 'page_view')::integer as distinct_paths,
  count(*) filter (where e.event_name not in ('page_view', 'page_exit'))::integer as interaction_events,
  min(e.created_at) as first_at,
  max(e.created_at) as last_at,
  coalesce(
    nullif(max(nullif(trim(e.referrer_domain), '')), ''),
    '(direct / unknown)'
  ) as referrer_domain
from public.site_analytics_events e
where e.created_at >= now() - interval '180 days'
group by e.session_id
having count(*) filter (where e.event_name = 'page_view') >= 40
   and count(*) filter (where e.event_name not in ('page_view', 'page_exit')) = 0;

comment on view public.v_mm_bot_session_candidates is
  'Sessions with 40+ page views and zero interaction events in the last 180 days. Inspect before calling mm_refresh_excluded_sessions().';

grant select on public.v_mm_bot_session_candidates to authenticated;
grant select on public.v_mm_bot_session_candidates to service_role;


-- Staff sessions.
--
-- Row-level filtering is not enough: dropping only the /admin rows leaves the
-- operator's ordinary browsing in the customer numbers. Because session ids had
-- no expiry until the 30-minute TTL shipped, a single staff session could span
-- weeks and hundreds of page views. Any session that ever touched /admin or was
-- ever bound to a staff account is a work session end to end.

create or replace view public.v_mm_staff_session_candidates as
select
  e.session_id,
  count(*) filter (where e.event_name = 'page_view')::integer as page_views,
  count(distinct e.page_path) filter (where e.event_name = 'page_view')::integer as distinct_paths,
  count(*) filter (where e.event_name not in ('page_view', 'page_exit'))::integer as interaction_events,
  count(*) filter (where coalesce(e.page_path, '') like '/admin%')::integer as admin_views,
  min(e.created_at) as first_at,
  max(e.created_at) as last_at
from public.site_analytics_events e
where e.created_at >= now() - interval '180 days'
group by e.session_id
having bool_or(coalesce(e.page_path, '') like '/admin%')
    or bool_or(e.user_id is not null and public.mm_is_internal_auth_user(e.user_id));

comment on view public.v_mm_staff_session_candidates is
  'Sessions that touched /admin or carried a staff account at any point in the last 180 days.';

grant select on public.v_mm_staff_session_candidates to authenticated;
grant select on public.v_mm_staff_session_candidates to service_role;


create or replace function public.mm_refresh_excluded_sessions(
  p_min_page_views integer default 40
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min integer := greatest(10, coalesce(p_min_page_views, 40));
  v_count integer := 0;
  v_staff integer := 0;
begin
  insert into public.mm_excluded_sessions as x (
    session_id,
    reason,
    page_views,
    distinct_paths,
    interaction_events,
    first_at,
    last_at
  )
  select
    c.session_id,
    'bot_like',
    c.page_views,
    c.distinct_paths,
    c.interaction_events,
    c.first_at,
    c.last_at
  from public.v_mm_bot_session_candidates c
  where c.page_views >= v_min
  on conflict (session_id) do update set
    page_views = excluded.page_views,
    distinct_paths = excluded.distinct_paths,
    interaction_events = excluded.interaction_events,
    last_at = excluded.last_at,
    detected_at = now();

  get diagnostics v_count = row_count;

  -- Staff sessions win over bot_like when a session matches both.
  insert into public.mm_excluded_sessions as x (
    session_id,
    reason,
    page_views,
    distinct_paths,
    interaction_events,
    first_at,
    last_at
  )
  select
    s.session_id,
    'staff_session',
    s.page_views,
    s.distinct_paths,
    s.interaction_events,
    s.first_at,
    s.last_at
  from public.v_mm_staff_session_candidates s
  on conflict (session_id) do update set
    reason = 'staff_session',
    page_views = excluded.page_views,
    distinct_paths = excluded.distinct_paths,
    interaction_events = excluded.interaction_events,
    last_at = excluded.last_at,
    detected_at = now();

  get diagnostics v_staff = row_count;
  return v_count + v_staff;
end;
$$;

comment on function public.mm_refresh_excluded_sessions(integer) is
  'Registers bot-like sessions in mm_excluded_sessions. Run from the SQL editor or a scheduled job.';

revoke all on function public.mm_refresh_excluded_sessions(integer) from public;
revoke all on function public.mm_refresh_excluded_sessions(integer) from anon;
grant execute on function public.mm_refresh_excluded_sessions(integer) to service_role;


-- ---------------------------------------------------------------------------
-- 4) Customer analytics view — staff + /admin + dev + bot sessions removed
-- ---------------------------------------------------------------------------

drop view if exists public.v_customer_site_analytics_events;

create or replace view public.v_customer_site_analytics_events as
select e.*
from public.site_analytics_events e
where (e.user_id is null or not public.mm_is_internal_auth_user(e.user_id))
  and coalesce(e.page_path, '') not like '/admin%'
  and not public.mm_is_dev_traffic(e.referrer_url, e.referrer_domain, e.page_query)
  and not exists (
    select 1
    from public.mm_excluded_sessions x
    where x.session_id = e.session_id
  );

comment on view public.v_customer_site_analytics_events is
  'Customer analytics events: excludes logged-in staff rows, /admin routes, local/preview traffic, and sessions registered in mm_excluded_sessions.';

grant select on public.v_customer_site_analytics_events to authenticated;
grant select on public.v_customer_site_analytics_events to service_role;


-- ---------------------------------------------------------------------------
-- 5) What did we remove? (run this to size the impact)
-- ---------------------------------------------------------------------------

create or replace view public.v_mm_traffic_exclusion_audit as
select
  'staff_or_admin'::text as reason,
  count(distinct e.session_id)::bigint as sessions,
  count(*) filter (where e.event_name = 'page_view')::bigint as page_views
from public.site_analytics_events e
where e.created_at >= now() - interval '30 days'
  and (
    (e.user_id is not null and public.mm_is_internal_auth_user(e.user_id))
    or coalesce(e.page_path, '') like '/admin%'
  )
union all
select
  'dev_or_preview',
  count(distinct e.session_id),
  count(*) filter (where e.event_name = 'page_view')
from public.site_analytics_events e
where e.created_at >= now() - interval '30 days'
  and public.mm_is_dev_traffic(e.referrer_url, e.referrer_domain, e.page_query)
union all
select
  x.reason,
  count(distinct e.session_id),
  count(*) filter (where e.event_name = 'page_view')
from public.site_analytics_events e
join public.mm_excluded_sessions x on x.session_id = e.session_id
where e.created_at >= now() - interval '30 days'
group by x.reason;

comment on view public.v_mm_traffic_exclusion_audit is
  'Last 30 days: sessions and page views removed from customer analytics, by reason.';

grant select on public.v_mm_traffic_exclusion_audit to authenticated;
grant select on public.v_mm_traffic_exclusion_audit to service_role;


-- ---------------------------------------------------------------------------
-- Suggested run sequence
-- ---------------------------------------------------------------------------
-- 1) Inspect candidates first:
--      select * from public.v_mm_bot_session_candidates order by page_views desc;
--      select * from public.v_mm_staff_session_candidates order by page_views desc;
-- 2) Register them:
--      select public.mm_refresh_excluded_sessions();
-- 3) Size the impact:
--      select * from public.v_mm_traffic_exclusion_audit;
-- 4) Put a session back if it was a real user:
--      delete from public.mm_excluded_sessions where session_id = '...';
