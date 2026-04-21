-- user_fund_optimizer_sets
-- 펀드 옵티마이저 세트 (웹 localStorage → Supabase 마이그레이션)
-- iOS 앱 + 웹 공통 사용

create table if not exists user_fund_optimizer_sets (
  id           text        not null,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  name         text        not null default '配分セット',
  source       text        not null default 'optimizer',
  funds        jsonb       not null default '[]'::jsonb,
  -- funds 형식: [{"id":"JP90C000FQH3","name":"eMAXIS Slim全世界株式","weightPct":60}, ...]
  summary      jsonb,
  -- summary 형식: {"ret":12.3,"risk":14.5,"fee":0.057}
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists user_fund_optimizer_sets_user_idx
  on user_fund_optimizer_sets (user_id, created_at desc);

-- updated_at 자동 갱신 트리거
create or replace function update_fund_optimizer_sets_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fund_optimizer_sets_updated_at on user_fund_optimizer_sets;
create trigger trg_fund_optimizer_sets_updated_at
  before update on user_fund_optimizer_sets
  for each row execute function update_fund_optimizer_sets_updated_at();

-- RLS
alter table user_fund_optimizer_sets enable row level security;

create policy "users can read own fund optimizer sets"
  on user_fund_optimizer_sets for select
  using (auth.uid() = user_id);

create policy "users can insert own fund optimizer sets"
  on user_fund_optimizer_sets for insert
  with check (auth.uid() = user_id);

create policy "users can update own fund optimizer sets"
  on user_fund_optimizer_sets for update
  using (auth.uid() = user_id);

create policy "users can delete own fund optimizer sets"
  on user_fund_optimizer_sets for delete
  using (auth.uid() = user_id);
