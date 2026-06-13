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

-- Billing entitlement fields are service-role controlled. Owner RLS lets users
-- update their profile row, so block client-side writes to Stripe-derived fields.
create or replace function public.protect_user_profile_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    if new.subscription_tier is not null
      or coalesce(new.is_premium, false) is distinct from false
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null
    then
      raise exception 'billing fields are service-role controlled';
    end if;
  elsif TG_OP = 'UPDATE' then
    if new.subscription_tier is distinct from old.subscription_tier
      or new.is_premium is distinct from old.is_premium
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    then
      raise exception 'billing fields are service-role controlled';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_user_profile_billing_fields on public.user_profiles;
create trigger trg_protect_user_profile_billing_fields
before insert or update on public.user_profiles
for each row execute function public.protect_user_profile_billing_fields();
