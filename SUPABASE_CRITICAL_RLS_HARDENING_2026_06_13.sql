-- Critical RLS hardening for premium entitlements, profile display names, and public image buckets.
-- Run in the Supabase SQL Editor after the base user_profiles, user_roles, and storage buckets exist.

begin;

-- 1) Billing entitlement fields are service-role controlled. Authenticated users
-- can update their own profile rows, but must not grant themselves premium.
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

-- 2) Remove the broad profile SELECT policy and expose only display-name fields
-- through a security-definer RPC for lounge/leaderboard name maps.
drop policy if exists "user_profiles_public_read_display" on public.user_profiles;

create or replace function public.get_user_profile_display_names(p_user_ids uuid[])
returns table (
  user_id uuid,
  nickname text,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select up.user_id, up.nickname, up.full_name
  from public.user_profiles up
  where up.user_id = any(coalesce(p_user_ids, array[]::uuid[]));
$$;

revoke all on function public.get_user_profile_display_names(uuid[]) from public;
grant execute on function public.get_user_profile_display_names(uuid[]) to authenticated;

-- 3) news-images is public-read but admin-write only.
drop policy if exists "Public read news images" on storage.objects;
create policy "Public read news images"
on storage.objects for select
using (bucket_id = 'news-images');

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

-- 4) lounge-images is public-read, but users can only write/delete objects in
-- their own top-level auth.uid() folder.
drop policy if exists "Public read lounge images" on storage.objects;
create policy "Public read lounge images"
on storage.objects for select
using (bucket_id = 'lounge-images');

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

commit;
