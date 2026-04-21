-- Lounge post images: storage bucket + DB columns
-- Run in Supabase SQL Editor.

begin;

-- Storage bucket for lounge post images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lounge-images',
  'lounge-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- RLS for lounge-images bucket
drop policy if exists "Public read lounge images" on storage.objects;
create policy "Public read lounge images"
on storage.objects for select
using (bucket_id = 'lounge-images');

drop policy if exists "Authenticated upload lounge images" on storage.objects;
create policy "Authenticated upload lounge images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'lounge-images');

drop policy if exists "Authenticated update lounge images" on storage.objects;
create policy "Authenticated update lounge images"
on storage.objects for update
to authenticated
using (bucket_id = 'lounge-images');

drop policy if exists "Authenticated delete lounge images" on storage.objects;
create policy "Authenticated delete lounge images"
on storage.objects for delete
to authenticated
using (bucket_id = 'lounge-images');

-- Add image_urls to community_posts (if exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'community_posts') then
    alter table public.community_posts add column if not exists image_urls text[] default '{}';
  end if;
end $$;

-- Add image_urls to lounge_posts (if exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'lounge_posts') then
    alter table public.lounge_posts add column if not exists image_urls text[] default '{}';
  end if;
end $$;

commit;
