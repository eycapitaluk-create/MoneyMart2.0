-- MoneyMart — Insight articles: members-only read (authenticated users)
-- Run in Supabase SQL Editor. Replaces public anon read on published articles.

drop policy if exists "insight_articles_public_read" on public.insight_articles;

create policy "insight_articles_members_read"
on public.insight_articles
for select
to authenticated
using (is_published = true);
