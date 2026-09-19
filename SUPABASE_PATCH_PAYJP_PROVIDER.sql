-- PAY.JP ウェブ課金: provider 拡張 + customer/subscription 参照列
-- Supabase SQL Editor で実行（SUPABASE_SETUP_PREMIUM_ENTITLEMENTS.sql 後）

alter table public.user_profiles
  add column if not exists payjp_customer_id text,
  add column if not exists payjp_subscription_id text;

comment on column public.user_profiles.payjp_customer_id is 'PAY.JP customer id (cus_...)';
comment on column public.user_profiles.payjp_subscription_id is '直近の PAY.JP subscription id (sub_...)';

-- provider CHECK を apple のみ → apple|payjp に拡張
alter table public.user_premium_entitlements
  drop constraint if exists user_premium_entitlements_provider_check;

alter table public.user_premium_entitlements
  add constraint user_premium_entitlements_provider_check
  check (provider in ('apple', 'payjp'));

create index if not exists idx_user_profiles_payjp_customer
  on public.user_profiles (payjp_customer_id)
  where payjp_customer_id is not null;
