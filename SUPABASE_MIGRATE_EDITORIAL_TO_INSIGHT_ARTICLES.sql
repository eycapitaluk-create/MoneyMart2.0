-- One-time migration: move existing insights_editorial rows into insight_articles
-- Run this in Supabase SQL Editor.

insert into public.insight_articles (
  slug,
  page_title,
  document,
  is_published,
  published_at
)
select
  concat('editorial-', e.id::text) as slug,
  coalesce(nullif(trim(e.headline), ''), '市場インサイト') as page_title,
  jsonb_build_object(
    'hero', jsonb_build_object(
      'badge', trim(concat(coalesce(e.category, ''), case when coalesce(e.target, '') <> '' then ' — ' || e.target else '' end)),
      'titleLines', jsonb_build_array(jsonb_build_array(jsonb_build_object('text', coalesce(nullif(trim(e.headline), ''), '市場インサイト')))),
      'sub', coalesce(nullif(trim(e.summary), ''), '市場インサイト'),
      'meta', jsonb_build_array('MoneyMart Editorial', to_char(coalesce(e.published_at, now()), 'YYYY-MM-DD'), coalesce(nullif(trim(e.read_time), ''), '5分'))
    ),
    'ticker', coalesce(e.data, '[]'::jsonb),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'prose',
        'kicker', '// MARKET INSIGHT',
        'title', coalesce(nullif(trim(e.headline), ''), '市場見通し'),
        'lead', coalesce(nullif(trim(e.summary), ''), ''),
        'paragraphs', to_jsonb(array_remove(array[nullif(trim(e.idea), ''), nullif(trim(e.rationale), '')], null))
      ),
      jsonb_build_object(
        'type', 'callout',
        'variant', 'insight',
        'title', 'データ注記',
        'body', coalesce(nullif(trim(e.data_note), ''), '')
      ),
      jsonb_build_object(
        'type', 'callout',
        'variant', 'warn',
        'title', 'リスク',
        'body', coalesce(nullif(trim(e.risk), ''), '')
      )
    ),
    'admin', jsonb_build_object(
      'category', coalesce(e.category, ''),
      'target', coalesce(e.target, ''),
      'relatedTools', to_jsonb(coalesce(e.related_tools, '{}'::text[])),
      'featured', coalesce(e.featured, false),
      'sortOrder', coalesce(e.sort_order, 0)
    )
  ) as document,
  coalesce(e.is_active, false) as is_published,
  e.published_at
from public.insights_editorial e
on conflict (slug) do update
set
  page_title = excluded.page_title,
  document = excluded.document,
  is_published = excluded.is_published,
  published_at = excluded.published_at,
  updated_at = now();
