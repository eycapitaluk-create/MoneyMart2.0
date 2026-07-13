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

-- Entitlement and Stripe identifiers are service-role managed. Authenticated
-- users can read their own is_premium/subscription_tier via RLS, but cannot
-- self-upgrade or read Stripe identifiers through PostgREST.
revoke select, insert, update on public.user_profiles from anon, authenticated;

do $$
declare
  readable_cols text;
  writable_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into readable_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'user_profiles'
    and column_name not in ('stripe_customer_id', 'stripe_subscription_id');

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into writable_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'user_profiles'
    and column_name not in (
      'is_premium',
      'subscription_tier',
      'stripe_customer_id',
      'stripe_subscription_id',
      'plan_tier',
      'membership_tier',
      'plan',
      'is_prime',
      'prime_member'
    );

  if readable_cols is not null then
    execute format('grant select (%s) on public.user_profiles to authenticated', readable_cols);
  end if;

  if writable_cols is not null then
    execute format('grant insert (%s) on public.user_profiles to authenticated', writable_cols);
    execute format('grant update (%s) on public.user_profiles to authenticated', writable_cols);
  end if;
end $$;
