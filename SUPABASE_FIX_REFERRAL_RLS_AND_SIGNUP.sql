-- Fix: "Database error saving new user" after referral RLS + qualify-on-signup trigger
-- Cause: RLS on referral_codes / referral_attributions has no INSERT/UPDATE policies.
--        SECURITY DEFINER triggers still obey RLS unless row_security is off for the op.
-- Run once in Supabase SQL Editor.

create or replace function public.handle_new_user_referral_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_own_code text;
  v_tries int := 0;
  v_meta_ref text;
  v_ref_user uuid;
begin
  perform set_config('row_security', 'off', true);

  if exists (select 1 from public.referral_codes rc where rc.user_id = new.id) then
    return new;
  end if;

  loop
    v_own_code := upper(substring(md5(random()::text || new.id::text || clock_timestamp()::text || random()::text) from 1 for 8));
    exit when not exists (select 1 from public.referral_codes rc where rc.code = v_own_code);
    v_tries := v_tries + 1;
    exit when v_tries > 32;
  end loop;

  if v_tries <= 32 then
    insert into public.referral_codes (user_id, code)
    values (new.id, v_own_code);
  end if;

  v_meta_ref := upper(trim(both from coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if length(v_meta_ref) >= 4 then
    select rc.user_id into v_ref_user
    from public.referral_codes rc
    where rc.code = v_meta_ref
    limit 1;

    if v_ref_user is not null and v_ref_user <> new.id then
      insert into public.referral_attributions (
        referred_user_id,
        referrer_user_id,
        ref_code_used,
        campaign_id
      )
      values (new.id, v_ref_user, v_meta_ref, 'default')
      on conflict (referred_user_id, campaign_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.bump_referral_qualification_on_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);

  if new.user_id is null then
    return new;
  end if;

  if new.event_name not in (
    'fund_compare_open',
    'fund_compose_open',
    'fund_watchset_saved',
    'dividend_watch_add'
  ) then
    return new;
  end if;

  update public.referral_attributions ra
  set qualifying_event_count = ra.qualifying_event_count + 1
  where ra.referred_user_id = new.user_id
    and ra.qualified_at is null
    and ra.campaign_id = 'default';

  update public.referral_attributions ra
  set qualified_at = now()
  where ra.referred_user_id = new.user_id
    and ra.qualified_at is null
    and ra.campaign_id = 'default'
    and ra.qualifying_event_count >= 3;

  return new;
end;
$$;

create or replace function public.claim_referral_attribution(p_code text, p_campaign text default 'default')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_norm text;
  v_ref_user uuid;
begin
  perform set_config('row_security', 'off', true);

  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if exists (
    select 1
    from public.referral_attributions ra
    where ra.referred_user_id = v_uid
      and ra.campaign_id = p_campaign
  ) then
    return jsonb_build_object('ok', true, 'reason', 'already_attributed');
  end if;

  v_norm := upper(trim(both from coalesce(p_code, '')));
  if length(v_norm) < 4 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select rc.user_id into v_ref_user
  from public.referral_codes rc
  where rc.code = v_norm
  limit 1;

  if v_ref_user is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_code');
  end if;

  if v_ref_user = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  insert into public.referral_attributions (
    referred_user_id,
    referrer_user_id,
    ref_code_used,
    campaign_id
  )
  values (v_uid, v_ref_user, v_norm, p_campaign)
  on conflict (referred_user_id, campaign_id) do nothing;

  return jsonb_build_object('ok', true, 'reason', 'attached');
end;
$$;

create or replace function public.ensure_my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing text;
  v_own_code text;
  v_tries int := 0;
begin
  perform set_config('row_security', 'off', true);

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select rc.code into v_existing
  from public.referral_codes rc
  where rc.user_id = v_uid;

  if found then
    return v_existing;
  end if;

  loop
    v_own_code := upper(substring(md5(random()::text || v_uid::text || clock_timestamp()::text || random()::text) from 1 for 8));
    exit when not exists (select 1 from public.referral_codes rc where rc.code = v_own_code);
    v_tries := v_tries + 1;
    exit when v_tries > 32;
  end loop;

  if v_tries > 32 then
    raise exception 'code_generation_failed';
  end if;

  insert into public.referral_codes (user_id, code)
  values (v_uid, v_own_code);

  return v_own_code;
end;
$$;

create or replace function public.mark_referral_qualified_on_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);

  if new.qualified_at is not null then
    return new;
  end if;
  if new.campaign_id = 'default' then
    update public.referral_attributions
    set qualified_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;
