-- MoneyMart utn - Fix Lounge: Member display, trending, follow
-- Run in Supabase SQL Editor.

-- 1) user_profiles: expose only display-name fields for lounge lookups.
--    A broad SELECT policy leaks phone/Stripe/signup attribution columns because
--    RLS cannot restrict columns, so use a narrow SECURITY DEFINER RPC instead.
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
