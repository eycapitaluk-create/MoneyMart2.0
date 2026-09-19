-- ================================================================
-- 運営スタッフ: 指定メールのコミュニティバッジを LV5（コア）に設定
--
-- 前提: SUPABASE_SETUP_COMMUNITY_BADGE_TIERS.sql 適用済み
--       lounge_character_stats テーブルあり
--
-- LV5 = total_exp >= 6000（community_tier_config tier_level 5）
-- Supabase SQL Editor を postgres 権限で実行。
-- auth.users に存在するメールのみ対象。
-- ================================================================

begin;

insert into public.lounge_character_stats (user_id, total_exp, level, character_stage, updated_at)
select
  au.id,
  6000,
  5,
  5,
  now()
from auth.users au
where lower(trim(au.email)) in (
  'justin.nam@moneymart.co.jp',
  'kelly.nam@moneymart.co.jp'
)
on conflict (user_id) do update set
  total_exp = greatest(lounge_character_stats.total_exp, excluded.total_exp),
  level = 5,
  character_stage = 5,
  updated_at = now();

commit;

-- 確認用（実行後コメントを外して結果確認）
-- select
--   au.email,
--   s.total_exp,
--   s.level,
--   s.character_stage,
--   p.tier_level,
--   p.label_ja
-- from auth.users au
-- join public.lounge_character_stats s on s.user_id = au.id
-- cross join lateral public.community_user_permissions(au.id) p
-- where lower(trim(au.email)) in (
--   'justin.nam@moneymart.co.jp',
--   'kelly.nam@moneymart.co.jp'
-- );
