# 2026-09-28 캠페인 감사

캠페인 전체를 완료로 보지 않는다. 이 문서는 로컬 수정과 운영 사실을 구분한다.

## 운영 반영

반영했다. 커밋은 하지 않았다. `--prebuilt`는 쓰지 않았다. 로컬 `dist`는 더미 `VITE_` 값으로 만든 산출물이라 지운 뒤, Vercel이 프로젝트 production env로 원격 빌드하게 했다.

- Deployment: `dpl_HaDkFKN4bLQqE5TdZnXHjf9gSwY7`
- URL: `https://money-mart2-0-61gvr9y8d-moneymarts-projects.vercel.app`
- Alias: `https://www.moneymart.co.jp`. apex `https://moneymart.co.jp/`는 307로 www에 붙는다.
- 운영 인덱스: `index-DWoo7DLm.js`. 직전 운영 `index-DHuXZ_BP.js` / `dpl_D1ENPHpZonCPamJstG1RuQpGg5za`는 이번 배포의 기준이었고, 지금 공개 HTML은 `index-DWoo7DLm.js`다.
- 격리 경로: `/tmp/moneymart-campaign-isolate-20260928`. 운영 파일 트리에서 해시가 같은 파일과, 달라진 캠페인·인증·analytics 17개, 새 유틸·관리자 카드만 넣었다. utn 전체 dirty는 올리지 않았다. `.env`는 복사하거나 출력하지 않았다.
- 원격 빌드 로그는 직전 배포 `D1ENPHpZonCPamJstG1RuQpGg5za`의 빌드 캐시를 썼고, 소스 6785개를 받아 `vercel build`를 실행했다.

공개 확인:

- 홈과 `/campaign/sns-2026`은 브라우저에서 본문이 그려진다. `Supabase env is missing`은 화면에 없고, 운영 `index-DWoo7DLm.js`에도 그 문자열과 `isolate-build-check`가 없다. `createClient`에는 `https://uyrqwsttzktuobunvedu.supabase.co`와 JWT가 들어가 있다.
- 비로그인 `GET /api/campaign/cp2026-sns-sep`은 401, `Cache-Control: private, no-store`.
- 관리자 목록은 인증 없으면 401, Bearer만 있으면 403. 둘 다 `private, no-store`.
- 운영 청크에 `sell_fx_rate`, `適用レート`, `ランキングを取得できませんでした`, `法人営業・事業開発`, `cp2026_sns_oct`가 있다. 메인 인덱스에 `cp2026_sns_sep` 저장 ID는 없다.
- 관리자 청크에 응모 목록, 서류접수, `投稿内容は未確認`이 있다. 실제 응모·메일·추첨은 만들지 않았다.

## 메일 가입 E2E

검증하지 않았다. 신규 계정을 만들지 않았고, 확인 메일을 보내지 않았다.

DB 최근 7일 신규 가입은 0건이라, 확인 메일이 실제로 도착했다는 근거가 없다. Resend 도메인은 Verified이고 Free 한도는 100통/일, 3000통/월이다. 최근 15일 메일 1통은 없는 테스트 주소로 반송되었다. Auth custom SMTP는 Resend에 연결되어 있고, 프로젝트 이메일 rate limit은 25통/시간이다.

콜백 URL에 `?next`를 붙이지 않는다. 운영 Redirect allowlist는 `https://www.moneymart.co.jp/signup-complete` 정확 경로뿐이고, 쿼리 일치는 실측하지 않았다. 클라이언트는 PKCE다. `user_metadata.mm_auth_next`만으로 다른 기기 메일 인증이 끝난 것이 아니다. 그 교환에는 가입을 시작한 브라우저의 code verifier가 필요하다. 같은 브라우저의 새 탭 복귀와 다른 기기 인증은 각각 미검증이다. 같은 탭 sessionStorage 복귀만 코드에 남아 있다.

## 과거 3행과 10월 ID

원본 3행은 삭제하거나 수정하지 않는다. `audit_rollback` 트랜잭션은 ROLLBACK되어 테스트 행은 0이다. 스키마는 바꾸지 않는다. `campaign_id`는 text이고 unique는 `(user_id, campaign_id)`라서 새 ID 행을 추가할 수 있다.

- 과거 저장 ID `cp2026_sns_sep`는 읽기 전용이다. status와 `applied_at`(7월 5일, 7월 25일)을 바꾸지 않는다.
- 10월 응모 저장 ID는 `cp2026_sns_oct`이다. URL `/campaign/sns-2026`와 API 경로 `/api/campaign/cp2026-sns-sep`는 유지한다.
- 7월 eligible 일반 회원은 10월에 새 `cp2026_sns_oct` draft를 만들고 응모할 수 있다. `prior_event` 409로 막지 않는다.
- 10월 창 안의 같은 `cp2026_sns_oct` eligible/rewarded만 재제출 no-op이다. rejected는 409이며 eligible로 되돌리지 않는다.

## 판정

`classifyCampaignEntry`는 시작일만 보지 않는다.

- JST 시작 `2026-10-01 00:00`과 종료 `2026-10-30 23:59:59.999`를 양끝 포함으로 본다. 종료 후 `applied_at`은 countable이 아니다.
- `campaign_id`가 `cp2026_sns_oct`인지 본다.
- `eligible`은 자동 서류접수(`autoReceipt`)다. `rewarded`는 최종 심사·당첨(`awarded`)이며 접수 건수에 넣지 않는다. 이 코드는 `rewarded`를 쓰지 않고 추첨하지 않는다.
- 설문 완료와 SNS 제출(게시 URL)이 둘 다 있어야 접수다.
- staff 이메일 조회가 실패하면 그 행을 일반 고객으로 세지 않는다. 고객 합계는 null이고, 접수·당첨 버킷과 CSV는 503으로 거절한다. auth schema는 PostgREST로 열지 않는다. Auth Admin `listUsers` 페이지네이션으로 찾고, 실연결에서 설정된 staff 2/2가 1페이지에서 확인됐다.

## 관리자 목록

`GET /api/admin/campaign-cp2026-entries`는 읽기 전용이다. HTTP Basic은 기존 관리자와 같다. Bearer 일반 회원은 403이다. service_role은 서버만 쓴다. 상태 변경, 추첨, 지급은 없다. `Cache-Control: private, no-store`는 401·403을 포함한다.

- 목록은 DB `range`와 exact count다. 메모리에서 500행을 잘라 페이지하지 않는다.
- 이메일은 현재 페이지(최대 50)만, 동시 4건으로 조회한다.
- 전체 집계는 count 쿼리다. staff id는 `listUsers`로 해석하고, CSV는 그 이메일을 행에 남긴 뒤 다시 분류한다. 직원 행의 staff 표시가 빠지지 않는다.
- 목록과 CSV는 `applied_at` 내림차순 다음 `id` 오름차순으로 순서를 고정한다.
- CSV는 2000행을 넘으면 파일을 만들지 않고 total과 limit을 돌려준다. 상한 안에서는 DB를 100행씩 모두 읽는다. 수식 주입은 셀 앞에 따옴표를 붙인다.
- 기존 관리자 화면의 October applications 카드가 이 API를 호출한다. 상태, 설문 상세, SNS 링크, 페이지, CSV를 보여 준다. 저장된 URL은 미확인이며 자동검증이나 당첨으로 표시하지 않는다.
- 과거 `cp2026_sns_sep`는 건수만 반환하고 갱신하지 않는다.

## 로컬 검증

`node scripts/verify-cp2026-campaign-rules.mjs`는 격리본에서 58/58 통과했다. 네트워크와 DB 쓰기는 없다. `analytics.js`를 import하지 않는다.

다룬 경우: JST 양끝, 시작 전, 종료 후, 7월 legacy ID, 설문 누락, SNS 누락, 행 2건은 2접수로 집계, 같은 세션의 view/apply 중복은 1회이고 채널은 첫 view, staff 조회 실패는 고객 합계를 숨김, CSV에서 직원 제외가 재분류 후에도 유지, 미확인 URL은 당첨이 아님, `id` tie-break, `listUsers` 실패는 unresolved, 콜백에 `?next` 없음, unique 충돌 후 재조회, insert campaign_id는 `cp2026_sns_oct`.

격리본의 로컬 `vite build`는 컴파일 확인용이다. 그 산출물의 env는 정상이 아니므로 배포에 넣지 않았다.

## 배포 범위

기준은 `dpl_D1ENPHpZonCPamJstG1RuQpGg5za` / `index-DHuXZ_BP.js`였다. 해시가 다른 파일은 캠페인·인증·analytics 17개뿐이었다. HEAD `7489b20`로 롤백하지 않았다. 캠페인은 완료로 보지 않는다. 메일 가입 E2E는 여전히 미검증이다.
