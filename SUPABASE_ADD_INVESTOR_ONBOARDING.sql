-- MoneyMart: 登録時の投資プロフィール（デモグラ用・非助言の自己申告）
-- Supabase SQL Editor で実行
--
-- 前提: signup attribution を使っている場合は先に SUPABASE_CRM_SIGNUP_ATTRIBUTION.sql を当てた状態でこのファイルを実行してください。
-- （handle_new_user_profile を CRM 版とマージした定義に置き換えます）

alter table public.user_profiles
  add column if not exists onboarding_asset_mix text,
  add column if not exists onboarding_risk_tolerance text,
  add column if not exists onboarding_investment_horizon text,
  add column if not exists onboarding_answers_at timestamptz;

comment on column public.user_profiles.onboarding_asset_mix is '自己申告: 金融資産のざっくり割合（コード値）';
comment on column public.user_profiles.onboarding_risk_tolerance is '自己申告: 許容したいリスクのイメージ（コード値）';
comment on column public.user_profiles.onboarding_investment_horizon is '自己申告: 投資・運用の目安年数（コード値）';
comment on column public.user_profiles.onboarding_answers_at is '上記3項目がそろって保存された日時';

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_domain text;
  v_ref_url text;
  v_utm_src text;
  v_utm_med text;
  v_utm_camp text;
  v_land_path text;
  v_land_query text;
  v_attr_at timestamptz;
  v_asset text;
  v_risk text;
  v_horizon text;
  v_onb_at timestamptz;
begin
  v_ref_domain := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_referrer_domain', '')), '');
  v_ref_url := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_referrer_url', '')), '');
  v_utm_src := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_utm_source', '')), '');
  v_utm_med := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_utm_medium', '')), '');
  v_utm_camp := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_utm_campaign', '')), '');
  v_land_path := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_landing_path', '')), '');
  v_land_query := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_landing_query', '')), '');
  begin
    v_attr_at := (nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'signup_attribution_captured_at', '')), ''))::timestamptz;
  exception
    when others then
      v_attr_at := null;
  end;

  v_asset := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'onboarding_asset_mix', '')), '');
  v_risk := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'onboarding_risk_tolerance', '')), '');
  v_horizon := nullif(trim(both from coalesce(new.raw_user_meta_data ->> 'onboarding_investment_horizon', '')), '');
  if v_asset is not null and v_risk is not null and v_horizon is not null then
    v_onb_at := now();
  else
    v_onb_at := null;
  end if;

  insert into public.user_profiles (
    user_id,
    full_name,
    nickname,
    phone,
    marketing_opt_in,
    event_coupon_opt_in,
    signup_referrer_domain,
    signup_referrer_url,
    signup_utm_source,
    signup_utm_medium,
    signup_utm_campaign,
    signup_landing_path,
    signup_landing_query,
    signup_attribution_captured_at,
    onboarding_asset_mix,
    onboarding_risk_tolerance,
    onboarding_investment_horizon,
    onboarding_answers_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'event_coupon_opt_in')::boolean, false),
    v_ref_domain,
    v_ref_url,
    v_utm_src,
    v_utm_med,
    v_utm_camp,
    v_land_path,
    v_land_query,
    v_attr_at,
    v_asset,
    v_risk,
    v_horizon,
    v_onb_at
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    nickname = excluded.nickname,
    phone = excluded.phone,
    marketing_opt_in = excluded.marketing_opt_in,
    event_coupon_opt_in = excluded.event_coupon_opt_in,
    signup_referrer_domain = coalesce(excluded.signup_referrer_domain, user_profiles.signup_referrer_domain),
    signup_referrer_url = coalesce(excluded.signup_referrer_url, user_profiles.signup_referrer_url),
    signup_utm_source = coalesce(excluded.signup_utm_source, user_profiles.signup_utm_source),
    signup_utm_medium = coalesce(excluded.signup_utm_medium, user_profiles.signup_utm_medium),
    signup_utm_campaign = coalesce(excluded.signup_utm_campaign, user_profiles.signup_utm_campaign),
    signup_landing_path = coalesce(excluded.signup_landing_path, user_profiles.signup_landing_path),
    signup_landing_query = coalesce(excluded.signup_landing_query, user_profiles.signup_landing_query),
    signup_attribution_captured_at = coalesce(excluded.signup_attribution_captured_at, user_profiles.signup_attribution_captured_at),
    onboarding_asset_mix = coalesce(excluded.onboarding_asset_mix, user_profiles.onboarding_asset_mix),
    onboarding_risk_tolerance = coalesce(excluded.onboarding_risk_tolerance, user_profiles.onboarding_risk_tolerance),
    onboarding_investment_horizon = coalesce(excluded.onboarding_investment_horizon, user_profiles.onboarding_investment_horizon),
    onboarding_answers_at = coalesce(excluded.onboarding_answers_at, user_profiles.onboarding_answers_at);

  return new;
end;
$$;
