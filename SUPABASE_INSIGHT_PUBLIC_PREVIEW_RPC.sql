-- MoneyMart — Insight: anon 向けタイトル・リードのみ（本文は members RLS のまま）
-- Run after SUPABASE_SETUP_INSIGHTS.sql / SUPABASE_PATCH_INSIGHT_MEMBERS_ONLY.sql

create or replace function public.insight_article_preview_text(doc jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(both from coalesce(doc->'hero'->>'sub', '')), ''),
    nullif(trim(both from coalesce(
      (
        select s->>'lead'
        from jsonb_array_elements(coalesce(doc->'sections', '[]'::jsonb)) s
        where s->>'type' = 'prose'
        limit 1
      ),
      ''
    )), ''),
    'MoneyMartの編集インサイト記事です。'
  );
$$;

create or replace function public.insight_article_category_label(doc jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(both from coalesce(doc->'admin'->>'category', '')), ''),
    nullif(trim(both from split_part(coalesce(doc->'hero'->>'badge', ''), '—', 1)), ''),
    'インサイト'
  );
$$;

create or replace function public.get_insight_public_preview(p_slug text)
returns table (
  slug text,
  page_title text,
  published_at timestamptz,
  preview_text text,
  category_label text,
  cover_image_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.slug,
    a.page_title,
    a.published_at,
    left(public.insight_article_preview_text(a.document), 400),
    public.insight_article_category_label(a.document),
    coalesce(
      nullif(trim(both from coalesce(a.document->'admin'->>'coverImageUrl', '')), ''),
      nullif(trim(both from coalesce(a.document->'hero'->>'coverImageUrl', '')), ''),
      ''
    )
  from public.insight_articles a
  where a.slug = trim(p_slug)
    and a.is_published = true
  limit 1;
$$;

create or replace function public.list_insight_public_catalog(p_limit int default 40)
returns table (
  slug text,
  page_title text,
  published_at timestamptz,
  preview_text text,
  category_label text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.slug,
    a.page_title,
    a.published_at,
    left(public.insight_article_preview_text(a.document), 220),
    public.insight_article_category_label(a.document)
  from public.insight_articles a
  where a.is_published = true
  order by a.published_at desc nulls last, a.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

revoke all on function public.get_insight_public_preview(text) from public;
revoke all on function public.list_insight_public_catalog(int) from public;
grant execute on function public.get_insight_public_preview(text) to anon, authenticated;
grant execute on function public.list_insight_public_catalog(int) to anon, authenticated;
