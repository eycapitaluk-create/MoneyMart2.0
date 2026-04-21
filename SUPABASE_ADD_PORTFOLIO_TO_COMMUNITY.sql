-- Add portfolio_id to community_posts for Lounge portfolio posts
-- Run after SUPABASE_SETUP_PORTFOLIO.sql (portfolios table must exist)

alter table public.community_posts
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null;

create index if not exists idx_community_posts_portfolio
  on public.community_posts (portfolio_id) where portfolio_id is not null;
