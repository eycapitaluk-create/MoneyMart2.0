-- MoneyMart 2.0 - News images storage bucket
-- Run in Supabase SQL Editor.
-- Creates a public bucket for news page manual images.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-images',
  'news-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Allow public read (images are displayed on news page)
drop policy if exists "Public read news images" on storage.objects;
create policy "Public read news images"
on storage.objects for select
using (bucket_id = 'news-images');

-- Allow only admins to upload/manage news images (admin page)
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

-- Allow only admins to update/delete news images
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
