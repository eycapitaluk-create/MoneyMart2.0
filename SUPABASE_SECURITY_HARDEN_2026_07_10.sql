-- MoneyMart security hardening patch (2026-07-10)
-- Run after the existing user_profiles, lounge, and news image migrations.

begin;

-- 1) Do not let authenticated clients update Stripe/premium entitlement columns.
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

-- 2) Replace broad cross-user profile reads with a narrow display-name RPC.
drop policy if exists "user_profiles_public_read_display" on public.user_profiles;

create or replace function public.get_user_profile_display_names(p_user_ids uuid[])
returns table (
  user_id uuid,
  nickname text,
  full_name text
)
language sql
security definer
set search_path = public
as $$
  select p.user_id, p.nickname, p.full_name
  from public.user_profiles p
  where p.user_id = any(coalesce(p_user_ids, '{}'::uuid[]));
$$;

revoke all on function public.get_user_profile_display_names(uuid[]) from public;
grant execute on function public.get_user_profile_display_names(uuid[]) to authenticated;

-- 3) Limit lounge image mutations to the authenticated user's own object prefix.
drop policy if exists "Authenticated upload lounge images" on storage.objects;
create policy "Authenticated upload lounge images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'lounge-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated update lounge images" on storage.objects;
create policy "Authenticated update lounge images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'lounge-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'lounge-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated delete lounge images" on storage.objects;
create policy "Authenticated delete lounge images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'lounge-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4) News images are admin-managed assets; public read remains allowed.
drop policy if exists "Authenticated upload news images" on storage.objects;
create policy "Authenticated upload news images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'news-images'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists "Authenticated update news images" on storage.objects;
create policy "Authenticated update news images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'news-images'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  bucket_id = 'news-images'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists "Authenticated delete news images" on storage.objects;
create policy "Authenticated delete news images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'news-images'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

commit;
