-- MoneyMart Lounge - ラウンジキャラ（たまごっち型）成長システム
-- 投稿・コメント・いいねでEXPが貯まり、キャラが進化。パワーユーザーの可視化用。
-- Run in Supabase SQL Editor.

begin;

-- ---------------------------------------------------------------------------
-- キャラ統計テーブル（user_id 単位で EXP / level / character_stage）
-- ---------------------------------------------------------------------------
create table if not exists public.lounge_character_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_exp integer not null default 0,
  level integer not null default 1,
  character_stage integer not null default 1 check (character_stage between 1 and 5),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lounge_character_stats_total_exp
  on public.lounge_character_stats (total_exp desc);
create index if not exists idx_lounge_character_stats_level
  on public.lounge_character_stats (level desc);

comment on table public.lounge_character_stats is 'ラウンジ参加EXPに基づくキャラレベル・進化段階';
comment on column public.lounge_character_stats.character_stage is '1=たまご, 2=ひよこ, 3=成長, 4=マスター, 5=レジェンド';

-- ---------------------------------------------------------------------------
-- EXP加算と level / character_stage の再計算
-- ルール: 投稿 +10, コメント +3, いいねされた +1
-- レベル: 0-99 Lv1, 100-299 Lv2, 300-599 Lv3, 600-999 Lv4, 1000+ Lv5
-- ステージ: Lv1→1, Lv2→2, Lv3→3, Lv4→4, Lv5→5
-- ---------------------------------------------------------------------------
create or replace function public.lounge_character_add_exp(
  p_user_id uuid,
  p_exp_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_exp integer;
  new_level integer;
  new_stage integer;
begin
  if p_user_id is null or p_exp_delta is null or p_exp_delta <= 0 then
    return;
  end if;

  insert into public.lounge_character_stats (user_id, total_exp, level, character_stage, updated_at)
  values (p_user_id, 0, 1, 1, now())
  on conflict (user_id) do update set
    total_exp = greatest(0, lounge_character_stats.total_exp + p_exp_delta),
    updated_at = now();

  select
    s.total_exp,
    case
      when s.total_exp >= 1000 then 5
      when s.total_exp >= 600  then 4
      when s.total_exp >= 300  then 3
      when s.total_exp >= 100  then 2
      else 1
    end,
    case
      when s.total_exp >= 1000 then 5
      when s.total_exp >= 600  then 4
      when s.total_exp >= 300  then 3
      when s.total_exp >= 100  then 2
      else 1
    end
  into new_exp, new_level, new_stage
  from public.lounge_character_stats s
  where s.user_id = p_user_id;

  update public.lounge_character_stats
  set level = new_level, character_stage = new_stage
  where user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- トリガー: lounge_posts 投稿 → 著者に +10 EXP
-- ---------------------------------------------------------------------------
create or replace function public.trg_lounge_character_on_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.lounge_character_add_exp(new.author_id, 10);
  return new;
end;
$$;

drop trigger if exists trg_lounge_character_post on public.lounge_posts;
create trigger trg_lounge_character_post
after insert on public.lounge_posts
for each row execute function public.trg_lounge_character_on_post();

-- ---------------------------------------------------------------------------
-- トリガー: lounge_comments コメント → 著者に +3 EXP
-- ---------------------------------------------------------------------------
create or replace function public.trg_lounge_character_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.lounge_character_add_exp(new.author_id, 3);
  return new;
end;
$$;

drop trigger if exists trg_lounge_character_comment on public.lounge_comments;
create trigger trg_lounge_character_comment
after insert on public.lounge_comments
for each row execute function public.trg_lounge_character_on_comment();

-- ---------------------------------------------------------------------------
-- トリガー: lounge_post_likes いいね → 投稿の著者に +1 EXP（自分以外）
-- ---------------------------------------------------------------------------
create or replace function public.trg_lounge_character_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  author uuid;
begin
  select author_id into author from public.lounge_posts where id = new.post_id;
  if author is not null and author <> new.user_id then
    perform public.lounge_character_add_exp(author, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lounge_character_like on public.lounge_post_likes;
create trigger trg_lounge_character_like
after insert on public.lounge_post_likes
for each row execute function public.trg_lounge_character_on_like();

-- ---------------------------------------------------------------------------
-- community_posts / post_engagements 用（既存スキーマがある場合）
-- ---------------------------------------------------------------------------
create or replace function public.trg_community_character_on_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.lounge_character_add_exp(new.user_id, 10);
  return new;
end;
$$;

drop trigger if exists trg_community_character_post on public.community_posts;
create trigger trg_community_character_post
after insert on public.community_posts
for each row execute function public.trg_community_character_on_post();

create or replace function public.trg_community_character_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'comment' then
    perform public.lounge_character_add_exp(new.user_id, 3);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_community_character_engagement on public.post_engagements;
create trigger trg_community_character_engagement
after insert on public.post_engagements
for each row execute function public.trg_community_character_on_comment();

-- いいね(insightful) → 投稿者に +1
create or replace function public.trg_community_character_on_insightful()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  author uuid;
begin
  if new.type <> 'insightful' then return new; end if;
  select user_id into author from public.community_posts where id = new.post_id;
  if author is not null and author <> new.user_id then
    perform public.lounge_character_add_exp(author, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_community_character_insightful on public.post_engagements;
create trigger trg_community_character_insightful
after insert on public.post_engagements
for each row execute function public.trg_community_character_on_insightful();

-- ---------------------------------------------------------------------------
-- RLS: 誰でも読める（プロフィール表示用）。書くのはトリガーのみ。
-- ---------------------------------------------------------------------------
alter table public.lounge_character_stats enable row level security;

drop policy if exists "lounge_character_stats_read" on public.lounge_character_stats;
create policy "lounge_character_stats_read"
on public.lounge_character_stats for select
to anon, authenticated using (true);

-- 認証ユーザーが自分用に upsert する必要はない（トリガーで入る）が、
-- 初回表示用に insert のみ許可（0 EXP で行を作る）してもよい。ここではトリガー任せで insert は許可しない。
-- トリガーが security definer で insert/update するので問題なし。

grant select on public.lounge_character_stats to anon, authenticated;

commit;
