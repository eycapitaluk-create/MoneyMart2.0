-- ================================================================
-- 運営・スタッフ用: メールで指定したユーザーを DB 上プレミアム相当にする
-- （iOS は App.jsx の PREMIUM_EMAIL_ALLOWLIST を読めないため user_profiles を更新）
--
-- 事前: SUPABASE_ADD_PREMIUM_SUBSCRIPTION.sql / SUPABASE_SETUP_PREMIUM_ENTITLEMENTS.sql
--       で is_premium / plan_tier / subscription_tier / premium_until 列があること
--
-- Supabase SQL Editor を postgres 権限で実行。auth.users に存在するメールのみ対象。
-- プロフィール未作成ユーザーはこの INSERT で行が作られる。
-- ================================================================

begin;

insert into public.user_profiles (
  user_id,
  full_name,
  nickname,
  is_premium,
  plan_tier,
  subscription_tier,
  premium_until
)
select
  au.id,
  coalesce(nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''), ''),
  coalesce(nullif(trim(au.raw_user_meta_data ->> 'nickname'), ''), ''),
  true,
  'prime',
  'premium',
  timestamptz '2099-12-31 23:59:59+00'
from auth.users au
where lower(trim(au.email)) in (
  'kelly.nam@moneymart.co.jp',
  'ellen.nam@moneymart.co.jp'
)
on conflict (user_id) do update set
  is_premium = true,
  plan_tier = excluded.plan_tier,
  subscription_tier = excluded.subscription_tier,
  premium_until = excluded.premium_until;

commit;

-- 確認用（実行後コメントを外して結果確認）
-- select au.email, up.is_premium, up.plan_tier, up.subscription_tier, up.premium_until
-- from auth.users au
-- join public.user_profiles up on up.user_id = au.id
-- where lower(trim(au.email)) in ('kelly.nam@moneymart.co.jp', 'ellen.nam@moneymart.co.jp');
