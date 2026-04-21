-- 가입 중심: 피추천인이 추천 링크로 귀속되는 순간(가입/OAuth claim)에 qualified_at 즉시 설정
-- → 추천인 리워드·내부 집계를 "가입 전환" 기준으로 맞춤. 활동 카운트 트리거는 그대로 두면 리포트용으로만 쌓임.
-- Supabase SQL Editor에서 1회 실행 (SUPABASE_SETUP_REFERRALS_MVP.sql 이후).

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

drop trigger if exists trg_referral_attr_qualify_on_insert on public.referral_attributions;
create trigger trg_referral_attr_qualify_on_insert
after insert on public.referral_attributions
for each row execute function public.mark_referral_qualified_on_attribution();
