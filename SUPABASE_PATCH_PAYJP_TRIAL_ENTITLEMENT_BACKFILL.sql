-- PAY.JP status=trial が expired 誤同期された行の修復 + is_premium 再計算
-- コード修正（payjpEntitlementStatus）後、既存データ用に 1 回実行。
-- 新規契約は create-subscription / webhook の sync で正しく入る。

begin;

-- 1) trial/trialing かつ期間内なのに expired の entitlement を active に
update public.user_premium_entitlements e
set
  status = 'active',
  updated_at = now()
where e.provider = 'payjp'
  and e.status = 'expired'
  and (
    lower(coalesce(e.raw_payload ->> 'status', '')) in ('trial', 'trialing')
    or lower(coalesce(e.raw_payload ->> 'status', '')) = 'active'
  )
  and e.current_period_end is not null
  and e.current_period_end > now();

-- 2) user_profiles.is_premium を entitlement から再集計
with agg as (
  select
    e.user_id,
    max(e.current_period_end) filter (
      where e.status in ('active', 'trial', 'trialing')
        and (e.current_period_end is null or e.current_period_end > now())
    ) as max_end
  from public.user_premium_entitlements e
  group by e.user_id
)
update public.user_profiles p
set
  is_premium = coalesce(a.max_end > now(), false),
  premium_until = case when a.max_end > now() then a.max_end else null end,
  plan_tier = case when coalesce(a.max_end > now(), false) then 'premium' else 'free' end,
  subscription_tier = case when coalesce(a.max_end > now(), false) then 'premium' else 'free' end
from agg a
where p.user_id = a.user_id
  and a.max_end is not null;

commit;

-- 確認:
-- select au.email, up.is_premium, up.premium_until, e.status, e.current_period_end, e.raw_payload->>'status'
-- from user_premium_entitlements e
-- join auth.users au on au.id = e.user_id
-- join user_profiles up on up.user_id = e.user_id
-- where e.provider = 'payjp'
-- order by e.updated_at desc
-- limit 20;
