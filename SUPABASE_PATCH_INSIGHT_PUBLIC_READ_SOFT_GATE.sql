-- Insight: 公開記事は誰でも読める（フロントで下段ブラー＋登録CTA）
-- Run after SUPABASE_SETUP_INSIGHTS.sql
-- RPC は RLS 未変更の環境向けフォールバック（get_insight_public_article）

drop policy if exists "insight_articles_public_read" on public.insight_articles;

create policy "insight_articles_public_read"
on public.insight_articles
for select
to anon, authenticated
using (is_published = true);

-- 全文取得（members-only RLS のままでも API から使えるフォールバック）
create or replace function public.get_insight_public_article(p_slug text)
returns table (
  id uuid,
  slug text,
  page_title text,
  document jsonb,
  is_published boolean,
  published_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    a.slug,
    a.page_title,
    a.document,
    a.is_published,
    a.published_at,
    a.updated_at,
    a.created_at
  from public.insight_articles a
  where a.slug = trim(p_slug)
    and a.is_published = true
  limit 1;
$$;

revoke all on function public.get_insight_public_article(text) from public;
grant execute on function public.get_insight_public_article(text) to anon, authenticated;
