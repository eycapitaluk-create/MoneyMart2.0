-- MoneyMart — マーケットページ「2026年 主要カレンダー」用
-- Supabase SQL Editor で実行。既に同名テーブルを作成済みの場合は、不足カラムのみ add column で足してください。

create table if not exists public.macro_events_calendar (
  id uuid primary key default gen_random_uuid(),

  /* 安定キー（Claude / スクリプトでの upsert 用。任意） */
  slug text unique,

  /* 画面上の日程ラベル（例: 4/21-23 (火-木)） */
  date_label_ja text not null,

  /* 終了後は一覧から除外するための範囲（event_date_end 省略時は開始日のみで判定） */
  event_date_start date not null,
  event_date_end date,

  country text not null default 'GLOBAL'
    check (country in ('US', 'JP', 'EU', 'UK', 'KR', 'GLOBAL', 'CN', 'IN', 'EM')),

  category text,
  event_title text not null,
  impact_note text,

  importance smallint not null default 3 check (importance >= 1 and importance <= 5),

  sort_order integer not null default 0,

  is_published boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_macro_events_calendar_list
  on public.macro_events_calendar (is_published, event_date_start asc, sort_order asc);

create or replace function public.set_updated_at_macro_events_calendar()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_macro_events_calendar_updated_at on public.macro_events_calendar;
create trigger trg_macro_events_calendar_updated_at
before update on public.macro_events_calendar
for each row execute function public.set_updated_at_macro_events_calendar();

alter table public.macro_events_calendar enable row level security;

drop policy if exists "macro_events_calendar_public_read" on public.macro_events_calendar;
create policy "macro_events_calendar_public_read"
on public.macro_events_calendar
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "macro_events_calendar_admin_manage" on public.macro_events_calendar;
create policy "macro_events_calendar_admin_manage"
on public.macro_events_calendar
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

comment on table public.macro_events_calendar is 'Market page macro calendar; anon SELECT where is_published; admin CRUD.';
comment on column public.macro_events_calendar.slug is 'Optional stable id for tool-assisted upserts (e.g. 2026-04-21-tsla-q1).';
comment on column public.macro_events_calendar.date_label_ja is 'Japanese display string shown next to cards (official ranges OK).';

-- ---------------------------------------------------------------------------
-- すでに空テーブル／別DDLで作成済みのとき：フロント連携用カラムの追加例
-- （同名カラムがあればスキップ）
-- ---------------------------------------------------------------------------
alter table public.macro_events_calendar add column if not exists slug text;
alter table public.macro_events_calendar add column if not exists date_label_ja text;
alter table public.macro_events_calendar add column if not exists event_date_start date;
alter table public.macro_events_calendar add column if not exists event_date_end date;
alter table public.macro_events_calendar add column if not exists country text default 'GLOBAL';
alter table public.macro_events_calendar add column if not exists category text;
alter table public.macro_events_calendar add column if not exists event_title text;
alter table public.macro_events_calendar add column if not exists impact_note text;
alter table public.macro_events_calendar add column if not exists importance smallint default 3;
alter table public.macro_events_calendar add column if not exists sort_order integer default 0;
alter table public.macro_events_calendar add column if not exists is_published boolean default true;
alter table public.macro_events_calendar add column if not exists created_at timestamptz default now();
alter table public.macro_events_calendar add column if not exists updated_at timestamptz default now();

/*
例（Claude / スクリプトからの upsert 用・uuid は省略可）:

insert into public.macro_events_calendar (
  slug, date_label_ja, event_date_start, event_date_end, country, category, event_title, impact_note, importance, sort_order, is_published
) values (
  '2026-04-28-fomc',
  '4/28-29 (火-水)',
  '2026-04-28',
  '2026-04-29',
  'US',
  '金利',
  'FRB FOMC 政策金利',
  '',
  5,
  10,
  true
)
on conflict (slug) do update set
  date_label_ja = excluded.date_label_ja,
  event_date_start = excluded.event_date_start,
  event_date_end = excluded.event_date_end,
  country = excluded.country,
  category = excluded.category,
  event_title = excluded.event_title,
  impact_note = excluded.impact_note,
  importance = excluded.importance,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published,
  updated_at = now();
*/
