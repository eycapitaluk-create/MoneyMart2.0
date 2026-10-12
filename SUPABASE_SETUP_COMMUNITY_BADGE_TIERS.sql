-- MoneyMart Community — badge tiers, EXP ledger, permission gates
-- Run in Supabase SQL Editor after SUPABASE_SETUP_LOUNGE_SOCIAL.sql + LOUNGE_CHARACTER.sql

begin;

-- ---------------------------------------------------------------------------
-- Tier config (admin-editable)
-- ---------------------------------------------------------------------------
create table if not exists public.community_tier_config (
  tier_level smallint primary key check (tier_level between 1 and 5),
  tier_slug text not null unique,
  label_ja text not null,
  label_en text not null,
  min_exp integer not null default 0,
  can_read_body boolean not null default false,
  can_like boolean not null default false,
  can_comment boolean not null default false,
  can_post boolean not null default false,
  sort_order smallint not null default 0
);

insert into public.community_tier_config (
  tier_level, tier_slug, label_ja, label_en, min_exp,
  can_read_body, can_like, can_comment, can_post, sort_order
) values
  (1, 'lurker',   'ビギナー',   'Lurker',   0,    true,  true,  false, false, 1),
  (2, 'reader',   'リーダー',   'Reader',   300,  true,  true,  false, false, 2),
  (3, 'member',   'メンバー',   'Member',   900,  true,  true,  true,  false, 3),
  (4, 'writer',   'ライター',   'Writer',   2500, true,  true,  true,  true,  4),
  (5, 'core',     'コア',       'Core',     6000, true,  true,  true,  true,  5)
on conflict (tier_level) do update set
  tier_slug = excluded.tier_slug,
  label_ja = excluded.label_ja,
  label_en = excluded.label_en,
  min_exp = excluded.min_exp,
  can_read_body = excluded.can_read_body,
  can_like = excluded.can_like,
  can_comment = excluded.can_comment,
  can_post = excluded.can_post,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- EXP action catalog
-- ---------------------------------------------------------------------------
create table if not exists public.community_exp_actions (
  action_type text primary key,
  exp_delta integer not null check (exp_delta > 0),
  label_ja text not null default '',
  daily_cap integer,
  enabled boolean not null default true
);

insert into public.community_exp_actions (action_type, exp_delta, label_ja, daily_cap) values
  ('daily_login',        5,  '毎日ログイン',           1),
  ('email_verified',    20,  'メール認証完了',         1),
  ('asset_register',    30,  '保有資産1銘柄登録',      null),
  ('portfolio_3',       50,  '3銘柄以上登録ボーナス',  1),
  ('first_post',        40,  '初めての投稿',           1)
on conflict (action_type) do update set
  exp_delta = excluded.exp_delta,
  label_ja = excluded.label_ja,
  daily_cap = excluded.daily_cap;

-- ---------------------------------------------------------------------------
-- EXP ledger (idempotent awards)
-- ---------------------------------------------------------------------------
create table if not exists public.community_exp_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null references public.community_exp_actions(action_type),
  exp_delta integer not null check (exp_delta > 0),
  idempotency_key text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists idx_community_exp_ledger_user
  on public.community_exp_ledger (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Align lounge_character_add_exp level thresholds with community tiers
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

  select s.total_exp into new_exp
  from public.lounge_character_stats s
  where s.user_id = p_user_id;

  select coalesce(max(t.tier_level), 1)
  into new_level
  from public.community_tier_config t
  where t.min_exp <= coalesce(new_exp, 0);

  new_stage := least(5, greatest(1, new_level));

  update public.lounge_character_stats
  set level = new_level, character_stage = new_stage
  where user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tier helpers
-- ---------------------------------------------------------------------------
create or replace function public.community_tier_level_for_exp(p_exp integer)
returns smallint
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select max(t.tier_level) from public.community_tier_config t where t.min_exp <= greatest(0, coalesce(p_exp, 0))),
    1::smallint
  );
$$;

create or replace function public.community_user_permissions(p_user_id uuid)
returns table (
  tier_level smallint,
  tier_slug text,
  label_ja text,
  total_exp integer,
  can_read_body boolean,
  can_like boolean,
  can_comment boolean,
  can_post boolean,
  exp_to_next integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exp integer := 0;
  v_tier smallint;
begin
  if p_user_id is null then
    return query
    select 1::smallint, 'lurker'::text, 'ビギナー'::text, 0,
      false, false, false, false,
      (select min(t.min_exp) from public.community_tier_config t where t.tier_level = 2);
    return;
  end if;

  select coalesce(s.total_exp, 0) into v_exp
  from public.lounge_character_stats s
  where s.user_id = p_user_id;

  v_exp := coalesce(v_exp, 0);
  v_tier := public.community_tier_level_for_exp(v_exp);

  return query
  select
    c.tier_level,
    c.tier_slug,
    c.label_ja,
    v_exp,
    c.can_read_body,
    c.can_like,
    c.can_comment,
    c.can_post,
    (
      select min(n.min_exp) - v_exp
      from public.community_tier_config n
      where n.min_exp > v_exp
    )::integer as exp_to_next
  from public.community_tier_config c
  where c.tier_level = v_tier;
end;
$$;

create or replace function public.community_user_can(p_user_id uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  perms record;
begin
  if p_user_id is null then
    return false;
  end if;
  if public.is_admin(p_user_id) then
    return true;
  end if;

  select * into perms from public.community_user_permissions(p_user_id) limit 1;

  case p_permission
    when 'read_body' then return coalesce(perms.can_read_body, false);
    when 'like' then return coalesce(perms.can_like, false);
    when 'comment' then return coalesce(perms.can_comment, false);
    when 'post' then return coalesce(perms.can_post, false);
    else return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Award EXP (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.community_award_exp_for_user(
  p_user_id uuid,
  p_action_type text,
  p_idempotency_key text,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer;
  v_enabled boolean;
  v_inserted boolean := false;
  v_total integer;
  v_perms record;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_user');
  end if;

  select a.exp_delta, a.enabled
  into v_delta, v_enabled
  from public.community_exp_actions a
  where a.action_type = p_action_type;

  if not found or not coalesce(v_enabled, false) or coalesce(v_delta, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'unknown_action');
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_idempotency_key');
  end if;

  begin
    insert into public.community_exp_ledger (user_id, action_type, exp_delta, idempotency_key, meta)
    values (p_user_id, p_action_type, v_delta, p_idempotency_key, coalesce(p_meta, '{}'::jsonb));
    v_inserted := true;
  exception when unique_violation then
    v_inserted := false;
  end;

  if v_inserted then
    perform public.lounge_character_add_exp(p_user_id, v_delta);
  end if;

  select coalesce(s.total_exp, 0) into v_total
  from public.lounge_character_stats s
  where s.user_id = p_user_id;

  select * into v_perms from public.community_user_permissions(p_user_id) limit 1;

  return jsonb_build_object(
    'ok', true,
    'awarded', v_inserted,
    'exp_delta', case when v_inserted then v_delta else 0 end,
    'total_exp', coalesce(v_total, 0),
    'tier_level', coalesce(v_perms.tier_level, 1),
    'tier_slug', coalesce(v_perms.tier_slug, 'lurker'),
    'label_ja', coalesce(v_perms.label_ja, 'ビギナー'),
    'exp_to_next', v_perms.exp_to_next
  );
end;
$$;

create or replace function public.community_award_exp(
  p_action_type text,
  p_idempotency_key text,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  return public.community_award_exp_for_user(v_user_id, p_action_type, p_idempotency_key, p_meta);
end;
$$;

-- Daily login convenience
create or replace function public.community_award_daily_login()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jst_date text;
begin
  jst_date := to_char((now() at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD');
  return public.community_award_exp(
    'daily_login',
    'daily_login:' || jst_date,
    jsonb_build_object('jst_date', jst_date)
  );
end;
$$;

-- Asset registration trigger
create or replace function public.trg_community_exp_on_owned_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sym text;
  cnt integer;
begin
  sym := upper(trim(coalesce(new.symbol, '')));
  if sym = '' then
    return new;
  end if;

  perform public.community_award_exp_for_user(
    new.user_id,
    'asset_register',
    'asset_register:' || sym,
    jsonb_build_object('symbol', sym)
  );

  select count(distinct upper(trim(coalesce(s.symbol, ''))))::integer
  into cnt
  from public.user_owned_stocks s
  where s.user_id = new.user_id
    and trim(coalesce(s.symbol, '')) <> '';

  if cnt >= 3 then
    perform public.community_award_exp_for_user(
      new.user_id,
      'portfolio_3',
      'portfolio_3:once',
      jsonb_build_object('symbol_count', cnt)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_community_exp_owned_stock on public.user_owned_stocks;
create trigger trg_community_exp_owned_stock
after insert on public.user_owned_stocks
for each row execute function public.trg_community_exp_on_owned_stock();

-- First post bonus
create or replace function public.trg_community_exp_on_first_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.lounge_posts p
    where p.author_id = new.author_id and p.id <> new.id
  ) then
    perform public.community_award_exp_for_user(
      new.author_id,
      'first_post',
      'first_post:once',
      jsonb_build_object('post_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_community_exp_first_post on public.lounge_posts;
create trigger trg_community_exp_first_post
after insert on public.lounge_posts
for each row execute function public.trg_community_exp_on_first_post();

-- ---------------------------------------------------------------------------
-- RLS: tighten write paths by tier
-- ---------------------------------------------------------------------------
drop policy if exists "lounge_posts_owner_insert" on public.lounge_posts;
create policy "lounge_posts_owner_insert"
on public.lounge_posts
for insert
to authenticated
with check (
  author_id = auth.uid()
  and (public.is_admin(auth.uid()) or public.community_user_can(auth.uid(), 'post'))
);

drop policy if exists "lounge_comments_owner_insert" on public.lounge_comments;
create policy "lounge_comments_owner_insert"
on public.lounge_comments
for insert
to authenticated
with check (
  author_id = auth.uid()
  and (public.is_admin(auth.uid()) or public.community_user_can(auth.uid(), 'comment'))
);

drop policy if exists "lounge_post_likes_owner_insert" on public.lounge_post_likes;
create policy "lounge_post_likes_owner_insert"
on public.lounge_post_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (public.is_admin(auth.uid()) or public.community_user_can(auth.uid(), 'like'))
);

-- Ledger read: own rows only
alter table public.community_exp_ledger enable row level security;
drop policy if exists "community_exp_ledger_owner_read" on public.community_exp_ledger;
create policy "community_exp_ledger_owner_read"
on public.community_exp_ledger for select to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

alter table public.community_tier_config enable row level security;
drop policy if exists "community_tier_config_public_read" on public.community_tier_config;
create policy "community_tier_config_public_read"
on public.community_tier_config for select to anon, authenticated using (true);

alter table public.community_exp_actions enable row level security;
drop policy if exists "community_exp_actions_public_read" on public.community_exp_actions;
create policy "community_exp_actions_public_read"
on public.community_exp_actions for select to anon, authenticated using (true);

grant select on public.community_tier_config to anon, authenticated;
grant select on public.community_exp_actions to anon, authenticated;
grant select on public.community_exp_ledger to authenticated;
grant execute on function public.community_award_exp(text, text, jsonb) to authenticated;
grant execute on function public.community_award_daily_login() to authenticated;
grant execute on function public.community_user_permissions(uuid) to anon, authenticated;
grant execute on function public.community_user_can(uuid, text) to authenticated;

commit;
