-- Remove visible seed markers from published lounge_posts (web / iOS / raw DB reads)
-- Run once in Supabase SQL Editor

begin;

update public.lounge_posts
set
  title = trim(
    regexp_replace(
      regexp_replace(coalesce(title, ''), '<!--\s*mm-community-seed[\w-]*\s*-->', '', 'gi'),
      '\s*mm-community-seed[\w-]*\s*',
      '',
      'gi'
    )
  ),
  content = trim(
    regexp_replace(
      regexp_replace(coalesce(content, ''), '<!--\s*mm-community-seed[\w-]*\s*-->', '', 'gi'),
      '\s*mm-community-seed[\w-]*\s*',
      '',
      'gi'
    )
  )
where coalesce(title, '') ~* 'mm-community-seed'
   or coalesce(content, '') ~* 'mm-community-seed';

update public.lounge_comments
set content = trim(
  regexp_replace(
    regexp_replace(coalesce(content, ''), '<!--\s*mm-community-seed[\w-]*\s*-->', '', 'gi'),
    '\s*mm-community-seed[\w-]*\s*',
    '',
    'gi'
  )
)
where coalesce(content, '') ~* 'mm-community-seed';

commit;
