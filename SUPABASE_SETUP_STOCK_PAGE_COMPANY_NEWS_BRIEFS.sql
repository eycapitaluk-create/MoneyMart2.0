-- 株式ページ「企業ニュース」右カラム: Claude が生成したカード（display_cards）または point マージ用 brief_points
-- /api/cron/company-news-brief が service role で upsert。クライアントは anon 読み取りのみ。

create table if not exists public.stock_page_company_news_briefs (
  region text primary key check (region in ('US', 'JP')),
  brief_points jsonb not null default '[]'::jsonb,
  display_cards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.stock_page_company_news_briefs is
  '企業ニュース。display_cards 優先（フルカード）。brief_points は静的 id との point マージ用レガシー。';

create index if not exists idx_stock_page_company_news_briefs_updated
  on public.stock_page_company_news_briefs (updated_at desc);

alter table public.stock_page_company_news_briefs enable row level security;

drop policy if exists "stock_page_company_news_briefs_select_anon" on public.stock_page_company_news_briefs;

create policy "stock_page_company_news_briefs_select_anon"
  on public.stock_page_company_news_briefs
  for select
  to anon, authenticated
  using (true);
