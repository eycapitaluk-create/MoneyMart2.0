-- Lounge trending tags optimization (DB-side aggregation)
-- Safe to run multiple times.

begin;

create or replace view public.v_lounge_trending_tags
with (security_invoker = true)
as
select
  t.tag,
  count(distinct t.post_id)::int as post_count,
  max(p.created_at) as last_posted_at
from public.lounge_post_tags t
join public.lounge_posts p on p.id = t.post_id
where p.status = 'published'
  and p.created_at >= now() - interval '14 days'
group by t.tag;

grant select on public.v_lounge_trending_tags to anon, authenticated;

commit;

