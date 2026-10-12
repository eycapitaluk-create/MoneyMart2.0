-- Allow logged-in users (Lurker tier) to like community posts
-- Run in Supabase SQL Editor after SUPABASE_SETUP_COMMUNITY_BADGE_TIERS.sql

begin;

update public.community_tier_config
set can_like = true,
    can_read_body = true
where tier_level = 1;

-- Ensure RLS insert policy exists (tier-aware)
drop policy if exists "lounge_post_likes_owner_insert" on public.lounge_post_likes;
create policy "lounge_post_likes_owner_insert"
on public.lounge_post_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (public.is_admin(auth.uid()) or public.community_user_can(auth.uid(), 'like'))
);

commit;
