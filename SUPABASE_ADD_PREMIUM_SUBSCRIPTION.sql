-- MoneyMart: user_profiles にプレミアム・Stripe 連携用カラムを追加
-- Stripe Webhook（サービスロール）が is_premium / subscription_tier を更新する想定

alter table public.user_profiles
  add column if not exists subscription_tier text,
  add column if not exists is_premium boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

comment on column public.user_profiles.subscription_tier is '例: free, premium。フロントの planTier 判定にも利用';
comment on column public.user_profiles.is_premium is 'Stripe 等で有効な課金があるとき true';
comment on column public.user_profiles.stripe_customer_id is 'Stripe Customer id（任意）';
comment on column public.user_profiles.stripe_subscription_id is 'Stripe Subscription id（任意）';

-- Authenticated clients may update their own profile row via RLS, but must not be
-- able to self-grant paid status or overwrite Stripe identifiers. Revoke the
-- table-wide UPDATE grant and restore UPDATE only on user-editable columns that
-- exist in the current schema. Service-role webhook writes are unaffected.
do $$
declare
  safe_columns text[] := array[
    'user_id',
    'full_name',
    'nickname',
    'phone',
    'marketing_opt_in',
    'event_coupon_opt_in',
    'consent_acknowledged_at',
    'onboarding_asset_mix',
    'onboarding_risk_tolerance',
    'onboarding_investment_horizon',
    'onboarding_answers_at'
  ];
  grant_columns text;
begin
  revoke update on table public.user_profiles from authenticated;

  select string_agg(quote_ident(column_name), ', ')
  into grant_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'user_profiles'
    and column_name = any(safe_columns);

  if grant_columns is not null then
    execute format('grant update (%s) on table public.user_profiles to authenticated', grant_columns);
  end if;
end $$;
