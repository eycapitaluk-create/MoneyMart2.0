-- Add event/coupon opt-in + OAuth consent flow
-- Run in Supabase SQL editor.

alter table public.user_profiles
  add column if not exists event_coupon_opt_in boolean not null default false;

alter table public.user_profiles
  add column if not exists consent_acknowledged_at timestamptz;

comment on column public.user_profiles.consent_acknowledged_at is '利用規約・プライバシー同意日時。null=OAuth初回で未完了';

-- Backfill: existing users = already consented
update public.user_profiles set consent_acknowledged_at = created_at where consent_acknowledged_at is null;

comment on column public.user_profiles.event_coupon_opt_in is 'イベント当選・クーポン付与の通知希望。電話番号入力が必要';

-- Update trigger to handle new column
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, full_name, nickname, phone, marketing_opt_in, event_coupon_opt_in)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'event_coupon_opt_in')::boolean, false)
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    nickname = excluded.nickname,
    phone = excluded.phone,
    marketing_opt_in = excluded.marketing_opt_in,
    event_coupon_opt_in = excluded.event_coupon_opt_in;
  return new;
end;
$$;
