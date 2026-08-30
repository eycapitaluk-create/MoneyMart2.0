-- Fix: authenticated users could overwrite/delete any lounge-images or news-images object.
-- Cause: storage.objects write policies only checked bucket_id.
-- Run once in Supabase SQL Editor after the original bucket setup SQL.

-- lounge-images: writes only under {auth.uid()}/…
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

-- news-images: admins retain full write; everyone else only insights/covers/{auth.uid()}/…
drop policy if exists "Authenticated upload news images" on storage.objects;
create policy "Authenticated upload news images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'news-images'
  and (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
    or (
      (storage.foldername(name))[1] = 'insights'
      and (storage.foldername(name))[2] = 'covers'
      and (storage.foldername(name))[3] = auth.uid()::text
    )
  )
);

drop policy if exists "Authenticated update news images" on storage.objects;
create policy "Authenticated update news images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'news-images'
  and (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
    or (
      (storage.foldername(name))[1] = 'insights'
      and (storage.foldername(name))[2] = 'covers'
      and (storage.foldername(name))[3] = auth.uid()::text
    )
  )
)
with check (
  bucket_id = 'news-images'
  and (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
    or (
      (storage.foldername(name))[1] = 'insights'
      and (storage.foldername(name))[2] = 'covers'
      and (storage.foldername(name))[3] = auth.uid()::text
    )
  )
);

drop policy if exists "Authenticated delete news images" on storage.objects;
create policy "Authenticated delete news images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'news-images'
  and (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
    or (
      (storage.foldername(name))[1] = 'insights'
      and (storage.foldername(name))[2] = 'covers'
      and (storage.foldername(name))[3] = auth.uid()::text
    )
  )
);
