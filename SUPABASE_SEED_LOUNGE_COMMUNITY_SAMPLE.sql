-- MoneyMart Lounge / Community sample post + comment
-- Run in Supabase SQL Editor after lounge/community schema is applied.
-- Uses the oldest auth user as author by default.

begin;

do $$
declare
  author_id uuid;
  commenter_id uuid;
  post_id uuid;
  post_title text := 'セクターヒートマップを見ながら週末レビュー。エネルギー・素材がリードしてリスクオン色が強めですが、情報技術は伸び悩み。来週の米CPIとFOMC前は、地域分散（IVV / 1329.T）を意識したいですね。#セクター #マーケット';
  post_content text := post_title;
  comment_content text := 'マーケットページの国家別ヒートマップと併せて見ると、地域ローテーションが読みやすいです。個人的には生活必需品とヘルスケアに一点足したいと思います。';
  author_name text := 'Member';
begin
  select u.id
    into author_id
  from auth.users u
  order by u.created_at asc
  limit 1;

  if author_id is null then
    raise exception 'No auth.users row found. Sign up once, then rerun this seed.';
  end if;

  commenter_id := author_id;

  select coalesce(up.nickname, up.full_name, 'Member')
    into author_name
  from public.user_profiles up
  where up.user_id = author_id
  limit 1;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'community_posts'
  ) then
    insert into public.community_posts (user_id, type, content, asset_tag, sentiment)
    values (author_id, 'insight', post_content, 'IVV', 'neutral')
    returning id into post_id;

    insert into public.post_engagements (post_id, user_id, type, content, payload)
    values (post_id, commenter_id, 'comment', comment_content, jsonb_build_object('content', comment_content));
  elsif exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'lounge_posts'
  ) then
    insert into public.lounge_posts (
      author_id, author_name, title, content, ticker, asset_type, sentiment, status
    )
    values (author_id, author_name, left(post_title, 80), post_content, 'IVV', 'general', 'neutral', 'published')
    returning id into post_id;

    insert into public.lounge_post_tags (post_id, tag)
    values
      (post_id, 'セクター'),
      (post_id, 'マーケット')
    on conflict do nothing;

    insert into public.lounge_comments (post_id, author_id, author_name, content, status)
    values (post_id, commenter_id, author_name, comment_content, 'published');
  else
    raise exception 'Neither community_posts nor lounge_posts exists. Run community/lounge setup SQL first.';
  end if;
end $$;

commit;

-- Verify (community schema)
select 'community_posts' as source, id::text, user_id::text as author_id, left(content, 60) as preview, created_at
from public.community_posts
order by created_at desc
limit 3;

-- Verify (legacy lounge schema)
select 'lounge_posts' as source, id::text, author_id::text, left(content, 60) as preview, created_at
from public.lounge_posts
order by created_at desc
limit 3;
