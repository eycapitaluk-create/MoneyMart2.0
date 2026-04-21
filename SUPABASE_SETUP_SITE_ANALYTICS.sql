-- MoneyMart 2.0 - Site analytics tracking
-- Run this in Supabase SQL Editor.

create table if not exists public.site_analytics_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  page_path text not null default '',
  page_query text not null default '',
  page_title text not null default '',
  internal_referrer_path text not null default '',
  referrer_url text not null default '',
  referrer_domain text not null default '',
  source text not null default '',
  medium text not null default '',
  campaign text not null default '',
  dwell_ms integer,
  event_meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_site_analytics_events_created_at
  on public.site_analytics_events (created_at desc);

create index if not exists idx_site_analytics_events_event_name_created_at
  on public.site_analytics_events (event_name, created_at desc);

create index if not exists idx_site_analytics_events_page_path_created_at
  on public.site_analytics_events (page_path, created_at desc);

create index if not exists idx_site_analytics_events_session_created_at
  on public.site_analytics_events (session_id, created_at desc);

create index if not exists idx_site_analytics_events_user_created_at
  on public.site_analytics_events (user_id, created_at desc);

create index if not exists idx_site_analytics_events_meta_gin
  on public.site_analytics_events using gin (event_meta);

create or replace view public.site_analytics_top_pages_30d as
select
  page_path,
  count(*) filter (where event_name = 'page_view') as views,
  count(distinct session_id) filter (where event_name = 'page_view') as unique_sessions,
  round(avg(nullif(dwell_ms::numeric, 0)) filter (where event_name = 'page_exit')) as avg_dwell_ms
from public.site_analytics_events
where created_at >= now() - interval '30 days'
group by page_path
having count(*) filter (where event_name = 'page_view') > 0
order by views desc;

create or replace view public.site_analytics_top_products_30d as
select
  coalesce(event_meta->>'product_type', event_meta->>'item_type', 'unknown') as product_type,
  coalesce(event_meta->>'product_id', event_meta->>'item_id', '') as product_id,
  coalesce(event_meta->>'product_name', event_meta->>'item_name', '') as product_name,
  count(*) as clicks,
  count(distinct session_id) as unique_sessions
from public.site_analytics_events
where created_at >= now() - interval '30 days'
  and event_name in ('fund_select', 'stock_select', 'product_select', 'product_apply_click', 'home_fund_click')
group by 1, 2, 3
having coalesce(event_meta->>'product_id', event_meta->>'item_id', '') <> ''
order by clicks desc;

create or replace view public.site_analytics_top_search_terms_30d as
select
  page_path,
  lower(trim(coalesce(event_meta->>'query', ''))) as query,
  count(*) as searches,
  round(avg(nullif((event_meta->>'result_count')::numeric, 0)), 1) as avg_result_count
from public.site_analytics_events
where created_at >= now() - interval '30 days'
  and event_name = 'search'
group by 1, 2
having lower(trim(coalesce(event_meta->>'query', ''))) <> ''
order by searches desc;

create or replace view public.site_analytics_top_referrers_30d as
select
  nullif(referrer_domain, '') as referrer_domain,
  nullif(source, '') as utm_source,
  nullif(medium, '') as utm_medium,
  count(*) filter (where event_name = 'page_view') as landing_views,
  count(distinct session_id) filter (where event_name = 'page_view') as unique_sessions
from public.site_analytics_events
where created_at >= now() - interval '30 days'
group by 1, 2, 3
having count(*) filter (where event_name = 'page_view') > 0
order by landing_views desc;

alter table public.site_analytics_events enable row level security;

drop policy if exists "site_analytics_insert_anon" on public.site_analytics_events;
create policy "site_analytics_insert_anon"
on public.site_analytics_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "site_analytics_select_admin" on public.site_analytics_events;
create policy "site_analytics_select_admin"
on public.site_analytics_events
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);
