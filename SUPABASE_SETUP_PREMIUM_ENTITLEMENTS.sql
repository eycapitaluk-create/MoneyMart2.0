-- ================================================================
-- プレミアム権利の単一ソース（現状は iOS=Apple）。user_id で束ねる
-- 事前に SUPABASE_ADD_PREMIUM_SUBSCRIPTION.sql を実行済みであること（is_premium 等）
-- Supabase SQL Editor で実行
--
-- 既に provider が apple|komoju の CHECK 制約がある DB の場合:
--   必要なら user_premium_entitlements の komoju 行を整理したうえで、制約を
--   drop してから本ファイルの create table を実行するか、ALTER で apple のみに差し替えてください。
-- ================================================================

alter table public.user_profiles
  add column if not exists premium_until timestamptz,
  add column if not exists plan_tier text;

comment on column public.user_profiles.premium_until is 'アクティブな課金の最終期限（概ねUTC）。詳細は user_premium_entitlements';
comment on column public.user_profiles.plan_tier is '例: free / premium / prime。フロントの planTier 判定';

-- ソース別の現役レコード（サービスロール API が upsert）
create table if not exists public.user_premium_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple')),
  external_subscription_key text not null,
  status text not null default 'active',
  current_period_end timestamptz,
  product_id text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_subscription_key)
);

create index if not exists idx_user_premium_entitlements_user
  on public.user_premium_entitlements (user_id);

comment on table public.user_premium_entitlements is '課金ソース別の権利。複数ソースがあっても user_profiles は集約結果';

create or replace function public.set_updated_at_user_premium_entitlements()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_premium_entitlements_updated_at on public.user_premium_entitlements;
create trigger trg_user_premium_entitlements_updated_at
before update on public.user_premium_entitlements
for each row execute function public.set_updated_at_user_premium_entitlements();

alter table public.user_premium_entitlements enable row level security;

drop policy if exists "user_premium_entitlements_owner_select" on public.user_premium_entitlements;
create policy "user_premium_entitlements_owner_select"
on public.user_premium_entitlements
for select
to authenticated
using (user_id = auth.uid());

-- INSERT/UPDATE はクライアント禁止（サービスロール API のみ）
