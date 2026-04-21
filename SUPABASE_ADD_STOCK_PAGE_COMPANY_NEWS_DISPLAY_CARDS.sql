-- 既存 DB: 企業ニュース右カラム用の「フルカード」JSON（日次クロンが Claude で生成）
alter table public.stock_page_company_news_briefs
  add column if not exists display_cards jsonb not null default '[]'::jsonb;

comment on column public.stock_page_company_news_briefs.display_cards is
  '日次更新。空でなければ StockPage はこの配列のみ表示。各要素: { id, symbol, company, when, phase, point }';

comment on column public.stock_page_company_news_briefs.brief_points is
  'レガシー: 静的マスタと id 単位で point をマージする用途。display_cards が優先。';
