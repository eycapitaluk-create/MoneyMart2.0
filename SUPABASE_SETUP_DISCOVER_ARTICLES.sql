-- MoneyMart — iOS 「発見」/ Magazine 카드용 공개 콘텐츠
-- Supabase SQL Editor에서 실행. `public.user_roles` 가 이미 있어야 관리자 정책이 동작합니다.

create table if not exists public.discover_articles (
  id uuid primary key default gen_random_uuid(),

  /* 목록 정렬 (작을수록 위) */
  sort_order integer not null default 0,

  title text not null,

  /* 피처 카드 요약; 그리드만 쓰면 null 가능 */
  subtitle text,

  /* 탭 후 상세 화면 본문 (Markdown). 비우면 deeplink_url 등으로만 이동 가능 */
  body_markdown text,

  /* 필터용 키: all, nisa, basics, market, tax_save 등 (앱 enum 과 통일) */
  category_key text not null default 'all',

  /* 표시 라벨: NISA, 投資基礎 … */
  category_label text not null,

  /* 분 단위; UI 에서「5 min」표현 */
  reading_minutes integer not null default 5 check (reading_minutes >= 0 and reading_minutes <= 999),

  /* SF Symbol 등 앱 매핑용 */
  icon_name text not null default 'doc.text.fill',

  /* popular=new「人気」, new=new「NEW」 */
  badge text check (badge is null or badge in ('popular', 'new')),

  is_featured boolean not null default false,

  card_tone text,

  background_color text,

  deeplink_url text,

  /* 카드·피처 헤더 이미지 (HTTPS 권장). Supabase Storage public URL 등 */
  image_url text,

  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* 예전 DDL 로 테이블만 만든 경우: 컬럼 추가 (COMMENT 보다 반드시 먼저) */
alter table public.discover_articles
  add column if not exists body_markdown text;

alter table public.discover_articles
  add column if not exists image_url text;

create index if not exists idx_discover_articles_list
  on public.discover_articles (is_published, sort_order asc, published_at desc nulls last);

create index if not exists idx_discover_articles_category
  on public.discover_articles (is_published, category_key, sort_order asc);

create index if not exists idx_discover_articles_featured
  on public.discover_articles (is_published, is_featured desc, sort_order asc);

create or replace function public.set_updated_at_discover_articles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    if new.is_published = true and new.published_at is null then
      new.published_at = now();
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_published = true and coalesce(old.is_published, false) = false and new.published_at is null then
      new.published_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_discover_articles_updated_at on public.discover_articles;
create trigger trg_discover_articles_updated_at
before insert or update on public.discover_articles
for each row execute function public.set_updated_at_discover_articles();

alter table public.discover_articles enable row level security;

drop policy if exists "discover_articles_public_read" on public.discover_articles;
create policy "discover_articles_public_read"
on public.discover_articles
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "discover_articles_admin_manage" on public.discover_articles;
create policy "discover_articles_admin_manage"
on public.discover_articles
for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
);

comment on table public.discover_articles is 'iOS 発見タブ / Magazine cards; fetch replaces hardcoded list when ready.';

comment on column public.discover_articles.body_markdown is 'Optional article body (Markdown) shown in-app when card opens without external deeplink.';

comment on column public.discover_articles.image_url is 'Optional HTTPS URL for card or hero image (e.g. Supabase Storage public URL).';
