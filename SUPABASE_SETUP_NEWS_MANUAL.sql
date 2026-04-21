create table if not exists public.news_manual (
  id bigserial primary key,
  bucket text not null,
  sort_order integer not null default 0,
  source text,
  title text not null,
  description text,
  url text,
  image_url text,
  topic text,
  time_text text,
  language text not null default 'ja',
  published_at timestamptz,
  tone text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_news_manual_bucket_sort
  on public.news_manual (bucket, sort_order, published_at desc);

create index if not exists idx_news_manual_active
  on public.news_manual (is_active, updated_at desc);
