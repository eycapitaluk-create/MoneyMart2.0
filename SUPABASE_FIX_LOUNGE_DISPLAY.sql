-- MoneyMart utn - Fix Lounge: Member display, trending, follow
-- Run in Supabase SQL Editor.

-- 1) user_profiles: Allow authenticated users to read other users' display names
--    Without this, fetchProfileNameMap returns empty and everyone shows as "Member"
drop policy if exists "user_profiles_public_read_display" on public.user_profiles;
create policy "user_profiles_public_read_display"
on public.user_profiles
for select
to authenticated
using (true);
