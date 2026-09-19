-- ================================================================
-- 運営付与: 指定メールに Premium 1ヶ月（30日）
-- auth.users に存在するメールのみ。user_profiles を更新。
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
  'premium',
  'premium',
  timezone('utc', now()) + interval '30 days'
from auth.users au
where lower(trim(au.email)) = 'create357@icloud.com'
on conflict (user_id) do update set
  is_premium = true,
  plan_tier = excluded.plan_tier,
  subscription_tier = excluded.subscription_tier,
  premium_until = greatest(
    coalesce(public.user_profiles.premium_until, '-infinity'::timestamptz),
    excluded.premium_until
  );

commit;

-- 確認
-- select au.email, up.full_name, up.is_premium, up.plan_tier, up.premium_until
-- from auth.users au
-- join public.user_profiles up on up.user_id = au.id
-- where lower(trim(au.email)) = 'create357@icloud.com';
