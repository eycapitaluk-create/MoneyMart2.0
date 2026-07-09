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

create or replace function public.prevent_user_profile_entitlement_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  protected_columns constant text[] := array[
    'is_premium',
    'subscription_tier',
    'stripe_customer_id',
    'stripe_subscription_id',
    'is_prime',
    'prime_member',
    'plan_tier',
    'membership_tier',
    'plan'
  ];
  boolean_columns constant text[] := array['is_premium', 'is_prime', 'prime_member'];
  column_name text;
  new_row jsonb := to_jsonb(new);
  old_row jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
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

  foreach column_name in array protected_columns loop
    if tg_op = 'INSERT' then
      if new_row ? column_name
        and (new_row -> column_name) is not null
        and (new_row -> column_name) <> 'null'::jsonb
        and not (column_name = any(boolean_columns) and (new_row -> column_name) = 'false'::jsonb)
      then
        raise exception 'Only service role or admins can set user_profiles.%', column_name;
      end if;
    elsif (new_row ? column_name)
      and (old_row ? column_name)
      and (new_row -> column_name) is distinct from (old_row -> column_name)
    then
      raise exception 'Only service role or admins can update user_profiles.%', column_name;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_prevent_user_profile_entitlement_mutation on public.user_profiles;
create trigger trg_prevent_user_profile_entitlement_mutation
before insert or update on public.user_profiles
for each row execute function public.prevent_user_profile_entitlement_mutation();
