-- MoneyMart utn - Fix Lounge: Member display, trending, follow
-- Run in Supabase SQL Editor.

-- 1) user_profiles: expose only public display names through a narrow RPC.
--    A broad SELECT policy leaks profile/entitlement columns to every signed-in user.
drop policy if exists "user_profiles_public_read_display" on public.user_profiles;

create or replace function public.get_user_profile_display_names(user_ids uuid[])
returns table(user_id uuid, nickname text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.nickname, p.full_name
  from public.user_profiles p
  where p.user_id = any(coalesce(user_ids, '{}'::uuid[]));
$$;

revoke all on function public.get_user_profile_display_names(uuid[]) from public;
grant execute on function public.get_user_profile_display_names(uuid[]) to anon, authenticated;
