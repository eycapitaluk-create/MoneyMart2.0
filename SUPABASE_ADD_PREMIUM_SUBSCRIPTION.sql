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

create or replace function public.prevent_client_entitlement_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_premium, false) <> false
      or new.subscription_tier is not null
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null
    then
      raise exception 'Only admins or service role may set billing entitlement fields';
    end if;
    return new;
  end if;

  if coalesce(new.is_premium, false) is distinct from coalesce(old.is_premium, false)
    or new.subscription_tier is distinct from old.subscription_tier
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
  then
    raise exception 'Only admins or service role may change billing entitlement fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_client_entitlement_profile_changes on public.user_profiles;
create trigger trg_prevent_client_entitlement_profile_changes
before insert or update on public.user_profiles
for each row execute function public.prevent_client_entitlement_profile_changes();
