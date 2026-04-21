-- Allow stock symbols in user_watchlists (MyPage / StockPage ウォッチリストを端末ローカルからクラウドへ)
-- Supabase SQL Editor で実行してください。

alter table public.user_watchlists
  drop constraint if exists user_watchlists_item_type_check;

alter table public.user_watchlists
  add constraint user_watchlists_item_type_check
  check (item_type in ('fund', 'product', 'stock'));
