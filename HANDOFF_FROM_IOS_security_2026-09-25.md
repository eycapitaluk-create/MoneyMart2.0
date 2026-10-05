# iOS 쪽 보안 점검 → 웹(Cursor) 변경 요청 (2026-09-25)

DB 마이그레이션 `20260925_security_hardening` (iOS 레포 supabase/migrations) 적용 시 웹에서 바꿔야 할 부분입니다.

## 1. 다른 회원 닉네임 조회 → `user_public_profiles` 뷰 사용 (필수)
`user_profiles` 에 있던 「로그인 사용자 누구나 전체 행 SELECT」 정책(`user_profiles_public_read_display`)을 제거합니다.
(지금은 이 정책 때문에 로그인만 하면 전 회원의 이름·전화번호·결제 ID 를 읽을 수 있음)

다른 회원의 닉네임을 읽는 코드는 새 뷰 `user_public_profiles (user_id, nickname)` 로 바꿔 주세요:
- `src/lib/loungeApi.js` 60, 162, 957, 1003 행
- `src/lib/portfolioApi.js` 103 행
- `src/lib/loungeCharacterApi.js` 109 행

```js
supabase.from('user_public_profiles').select('user_id,nickname').in('user_id', ids)
```
본인 프로필 조회(`eq('user_id', user.id)`)는 그대로 `user_profiles` 사용.

## 2. 그 밖에 동작이 바뀌는 것 (코드 변경 불필요할 것으로 보임)
- `user_profiles` 의 is_advisor / is_premium / premium_until / plan_tier / subscription_tier / role / stripe·payjp ID 는 클라이언트에서 수정 불가 (서버 API 의 service_role 은 가능)
- `ai_reports`: 본인 것만 조회·삽입 가능 (anon 공개 읽기 제거)
- `event_submissions` 조회, `earnings_calendar_manual` 쓰기, `admin_daily_metrics` 조회: 관리자(`user_roles.role='admin'`)만
- `lounge_notifications` INSERT: `user_id = auth.uid()` 만 (본인 배지 알림은 그대로 동작)
- `refresh_admin_daily_metrics`, `mm_is_internal_auth_user`, `mm_is_customer_analytics_event`, `mm_refresh_excluded_sessions` RPC: 클라이언트 실행 불가
