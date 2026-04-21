-- Sync nav "site content" read state across devices for logged-in users.
-- Run in Supabase SQL editor after user_profiles exists.

alter table public.user_profiles
  add column if not exists site_content_notify_marks jsonb;

comment on column public.user_profiles.site_content_notify_marks is
  'Optional JSON: { insightMaxPub, manualNewsMaxPub, aiNewsMaxUpdated } — ISO timestamps user has seen (useSiteContentNotification).';
