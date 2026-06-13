-- MoneyMart utn - Fix Lounge: Member display, trending, follow
-- Run in Supabase SQL Editor.

-- 1) user_profiles: expose only display-name fields through an RPC.
--    Do not add a table-wide SELECT policy here; it exposes profile PII.
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
