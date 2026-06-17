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

create or replace function public.prevent_user_profile_entitlement_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := false;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  ) into is_admin;

  if is_admin then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_premium, false) <> false
      or nullif(new.subscription_tier, '') is not null
      or nullif(new.stripe_customer_id, '') is not null
      or nullif(new.stripe_subscription_id, '') is not null
    then
      raise exception 'Only service role or admins may set profile entitlement fields'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_premium is distinct from old.is_premium
      or new.subscription_tier is distinct from old.subscription_tier
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    then
      raise exception 'Only service role or admins may update profile entitlement fields'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_user_profile_entitlement_tampering on public.user_profiles;
create trigger trg_prevent_user_profile_entitlement_tampering
before insert or update on public.user_profiles
for each row execute function public.prevent_user_profile_entitlement_tampering();
