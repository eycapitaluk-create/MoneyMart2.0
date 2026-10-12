-- コミュニティ投稿: 保有資産1件以上で解放（2,500 EXP ライターに加えて）
-- + ファンド・ウォッチリスト登録でも EXP 付与
-- Supabase SQL Editor で実行

begin;

create or replace function public.community_user_has_portfolio_asset(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.user_watchlists w where w.user_id = p_user_id limit 1)
    or exists (select 1 from public.user_owned_stocks s where s.user_id = p_user_id limit 1)
    or exists (select 1 from public.user_owned_funds f where f.user_id = p_user_id limit 1)
    or exists (select 1 from public.user_asset_positions a where a.user_id = p_user_id limit 1);
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
    when 'post' then
      return coalesce(perms.can_post, false)
        or public.community_user_has_portfolio_asset(p_user_id);
    else return false;
  end case;
end;
$$;

-- ファンド登録でも asset_register EXP
create or replace function public.trg_community_exp_on_owned_fund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sym text;
begin
  sym := upper(trim(coalesce(new.symbol, '')));
  if sym = '' then
    return new;
  end if;

  perform public.community_award_exp_for_user(
    new.user_id,
    'asset_register',
    'asset_register:fund:' || sym,
    jsonb_build_object('symbol', sym, 'kind', 'fund')
  );

  return new;
end;
$$;

drop trigger if exists trg_community_exp_owned_fund on public.user_owned_funds;
create trigger trg_community_exp_owned_fund
after insert on public.user_owned_funds
for each row execute function public.trg_community_exp_on_owned_fund();

-- ウォッチリスト追加でも asset_register EXP
create or replace function public.trg_community_exp_on_watchlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_key text;
begin
  item_key := coalesce(new.item_type, '') || ':' || trim(coalesce(new.item_id, ''));
  if trim(item_key, ':') = '' then
    return new;
  end if;

  perform public.community_award_exp_for_user(
    new.user_id,
    'asset_register',
    'asset_register:watch:' || item_key,
    jsonb_build_object('item_type', new.item_type, 'item_id', new.item_id)
  );

  return new;
end;
$$;

drop trigger if exists trg_community_exp_watchlist on public.user_watchlists;
create trigger trg_community_exp_watchlist
after insert on public.user_watchlists
for each row execute function public.trg_community_exp_on_watchlist();

grant execute on function public.community_user_has_portfolio_asset(uuid) to authenticated;

commit;
