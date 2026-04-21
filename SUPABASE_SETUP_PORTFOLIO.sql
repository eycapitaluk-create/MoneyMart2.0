-- MoneyMart 2.0 - Portfolio tables for Lounge
-- Run this in Supabase SQL Editor after lounge schema exists.

-- ---------------------------------------------------------------------------
-- 1. portfolios - 포트폴리오 정보
-- ---------------------------------------------------------------------------
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  allocations jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  return_1y numeric,
  fee numeric,
  risk numeric,
  fund_count integer not null default 0,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.portfolios.allocations is 'Array of {id, name, weightPct} for each fund';

create index if not exists idx_portfolios_user on public.portfolios (user_id, updated_at desc);
create index if not exists idx_portfolios_public on public.portfolios (is_public, follower_count desc, updated_at desc) where is_public = true;

-- ---------------------------------------------------------------------------
-- 2. portfolio_follows - 누가 어떤 포트폴리오를 팔로우(参考にする)
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_follows (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, portfolio_id)
);

create index if not exists idx_portfolio_follows_user on public.portfolio_follows (user_id);
create index if not exists idx_portfolio_follows_portfolio on public.portfolio_follows (portfolio_id);

-- ---------------------------------------------------------------------------
-- 3. portfolio_allocation_history - 배분 변경 이력
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_allocation_history (
  id bigserial primary key,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  allocations jsonb not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_portfolio_history_portfolio on public.portfolio_allocation_history (portfolio_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 4. lounge_posts에 portfolio_id 컬럼 추가
-- ---------------------------------------------------------------------------
alter table public.lounge_posts
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null;

create index if not exists idx_lounge_posts_portfolio on public.lounge_posts (portfolio_id) where portfolio_id is not null;

-- lounge_posts asset_type에 portfolio 추가
alter table public.lounge_posts
  drop constraint if exists lounge_posts_asset_type_check;

alter table public.lounge_posts
  add constraint lounge_posts_asset_type_check
  check (asset_type in ('general', 'stock', 'fund', 'fx', 'crypto', 'portfolio'));

-- ---------------------------------------------------------------------------
-- Triggers: portfolio follower_count, updated_at
-- ---------------------------------------------------------------------------
create or replace function public.refresh_portfolio_follower_count()
returns trigger
language plpgsql
as $$
begin
  update public.portfolios p
  set follower_count = (
    select count(*)::int from public.portfolio_follows f
    where f.portfolio_id = coalesce(new.portfolio_id, old.portfolio_id)
  )
  where p.id = coalesce(new.portfolio_id, old.portfolio_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_portfolio_follows_count on public.portfolio_follows;
create trigger trg_portfolio_follows_count
after insert or delete on public.portfolio_follows
for each row execute function public.refresh_portfolio_follower_count();

create or replace function public.set_portfolio_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_portfolios_updated_at on public.portfolios;
create trigger trg_portfolios_updated_at
before update on public.portfolios
for each row execute function public.set_portfolio_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.portfolios enable row level security;
alter table public.portfolio_follows enable row level security;
alter table public.portfolio_allocation_history enable row level security;

-- portfolios: owner full access, public read for is_public
drop policy if exists "portfolios_public_read" on public.portfolios;
create policy "portfolios_public_read"
on public.portfolios for select to anon, authenticated
using (is_public = true or user_id = auth.uid());

drop policy if exists "portfolios_owner_insert" on public.portfolios;
create policy "portfolios_owner_insert"
on public.portfolios for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "portfolios_owner_update" on public.portfolios;
create policy "portfolios_owner_update"
on public.portfolios for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "portfolios_owner_delete" on public.portfolios;
create policy "portfolios_owner_delete"
on public.portfolios for delete to authenticated
using (user_id = auth.uid());

-- portfolio_follows
drop policy if exists "portfolio_follows_owner_read" on public.portfolio_follows;
create policy "portfolio_follows_owner_read"
on public.portfolio_follows for select to authenticated
using (user_id = auth.uid());

drop policy if exists "portfolio_follows_owner_insert" on public.portfolio_follows;
create policy "portfolio_follows_owner_insert"
on public.portfolio_follows for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "portfolio_follows_owner_delete" on public.portfolio_follows;
create policy "portfolio_follows_owner_delete"
on public.portfolio_follows for delete to authenticated
using (user_id = auth.uid());

-- portfolio_allocation_history: owner of portfolio only
drop policy if exists "portfolio_history_owner_read" on public.portfolio_allocation_history;
create policy "portfolio_history_owner_read"
on public.portfolio_allocation_history for select to authenticated
using (
  exists (
    select 1 from public.portfolios p
    where p.id = portfolio_allocation_history.portfolio_id and p.user_id = auth.uid()
  )
);

drop policy if exists "portfolio_history_owner_insert" on public.portfolio_allocation_history;
create policy "portfolio_history_owner_insert"
on public.portfolio_allocation_history for insert to authenticated
with check (
  exists (
    select 1 from public.portfolios p
    where p.id = portfolio_allocation_history.portfolio_id and p.user_id = auth.uid()
  )
);
