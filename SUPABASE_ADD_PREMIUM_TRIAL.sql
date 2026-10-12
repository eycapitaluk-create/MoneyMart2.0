-- 新規ユーザー向け Premium 7日間無料お試し（user_profiles.premium_trial_ends_at）
-- auth.users 作成時のトリガーで試用終了時刻をセットする。
-- 既存ユーザーで NULL のままの行はお試し対象外（過去利用者に自動付与しない）。
--
-- Supabase SQL Editor で実行。

alter table public.user_profiles
  add column if not exists premium_trial_ends_at timestamptz;

comment on column public.user_profiles.premium_trial_ends_at is '新規登録から7日間の Premium 無料お試し終了時刻（UTC）。NULL は試用なし。';

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    user_id,
    full_name,
    nickname,
    phone,
    marketing_opt_in,
    premium_trial_ends_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    timezone('utc', now()) + interval '7 days'
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    nickname = excluded.nickname,
    phone = excluded.phone,
    marketing_opt_in = excluded.marketing_opt_in,
    premium_trial_ends_at = coalesce(public.user_profiles.premium_trial_ends_at, excluded.premium_trial_ends_at);
  return new;
end;
$$;
