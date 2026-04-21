-- One-time: 기존 auth.users 전원에 referral_codes 행이 없으면 발급
-- (앱에서 fetchMyReferralCode / ensure_my_referral_code 로도 개별 발급 가능)
-- Supabase SQL Editor에서 1회 실행.

do $$
declare
  r record;
  v_code text;
  v_try int;
begin
  for r in
    select u.id
    from auth.users u
    where not exists (select 1 from public.referral_codes rc where rc.user_id = u.id)
  loop
    v_try := 0;
    loop
      v_code := upper(encode(gen_random_bytes(4), 'hex'));
      exit when not exists (select 1 from public.referral_codes rc where rc.code = v_code);
      v_try := v_try + 1;
      exit when v_try > 40;
    end loop;
    if v_try <= 40 then
      insert into public.referral_codes (user_id, code) values (r.id, v_code);
    end if;
  end loop;
end $$;
