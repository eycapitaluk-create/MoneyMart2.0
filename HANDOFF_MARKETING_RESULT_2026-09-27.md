# 2026-09-27 marketing launch result

운영 별칭은 복원 배포 기준이다. Git 커밋은 만들지 않았다. SNS 게시와 테스트 신청은 하지 않았다.

## 회귀와 복원

캠페인만 얹은 옛 HEAD 배포(`dpl_7GKpNhE8PojFrVyKqKNygxAFW4KJ`, `index-DztM84hN.js`)가 직전 운영에 있던 마켓 수정과 매도 환율을 지웠다. 그 배포는 최종 상태가 아니다.

직전 운영은 `https://money-mart2-0-rgmpt5dnd-moneymarts-projects.vercel.app` (`index-Dtz_dR3E.js`)였다. 거기 있던 `MarketPage`의 `ランキングを取得できませんでした`, `MyPage` / `myPageApi`의 `sell_fx_rate`·`適用レート`, 채용 공고를 배포 워크트리에 다시 넣었다. utn 작업 폴더의 다른 미커밋 파일은 넣지 않았다.

복원 배포는 READY이고 `https://www.moneymart.co.jp`에 별칭이 붙어 있다.

- Deployment: `dpl_4gEszySSqa3YR4NvzCBvQLnCENos`
- URL: `https://money-mart2-0-apsnevphy-moneymarts-projects.vercel.app`
- 검사: `https://vercel.com/moneymarts-projects/money-mart2-0/4gEszySSqa3YR4NvzCBvQLnCENos`
- 기준 커밋: `7489b20` 분리 워크트리 + 아래 29개 경로만
- 신청 API 기간(2026-10-01 00:00〜10-30 23:59:59 JST), 경품, DB, 스키마, 보안, cron은 변경하지 않았다.

잘못 복사한 중복 9개는 배포 폴더 밖 `campaign-stray-copies-20260927`에 있다. 회귀 배포 묶음에는 앱이 import하지 않는 그 사본이 포함됐을 수 있다. 복원 배포의 파일 목록에는 없다.

## 배포에 포함한 파일

캠페인

- `src/pages/CampaignCp2026SnsSepPage.jsx`
- `src/constants/campaignCp2026SnsSep.js`
- `src/constants/campaignCp2026SnsSepPrizeLaw.js`
- `src/components/campaign/CampaignCp2026SnsSepPanel.jsx`
- `src/components/campaign/CampaignCp2026PrizeLawNotice.jsx`
- `src/lib/campaignUiFlags.js`
- `src/pages/Signup.jsx`
- `src/lib/analytics.js`
- `src/lib/campaignLaunchCohort.js`
- `src/components/admin/dashboard/CampaignLaunchCohortCard.jsx`
- `src/components/admin/dashboard/AdminExecutiveDashboard.jsx`

마켓 (직전 운영과 같은 수정)

- `src/pages/MarketPage.jsx`
- `src/components/market/FearGreedIndex.jsx`
- `src/lib/fearGreedCalc.js`

매도 환율 (직전 운영과 같은 수정, 컴파일에 필요한 신규 파일 포함)

- `src/pages/MyPage.jsx`
- `src/pages/mypage/SellHistorySection.jsx`
- `src/lib/myPageApi.js`
- `src/data/usListedEtfUniverse.js`
- `api/fx.js`
- `api/_lib/fx-usdjpy-db.js`
- `api/_lib/fx-usdjpy-providers.js`

채용

- `src/data/careers.js`
- `src/pages/CareersPage.jsx`
- `src/pages/HomePage.jsx`
- `src/components/layout/Footer.jsx`
- `src/lib/seoConfig.js`
- `api/ssr/static-public.js`
- `api/ssr/lib/seoHead.js`
- `scripts/prerender-spa.mjs`

넣지 않은 것: 가격 격리·수집 가드, 어드바이저 데모, 배당 캘린더 데이터, 워치리스트, 라운지, 펀드 페이지 등 utn에만 있는 다른 작업.

## 캠페인 변경 내용

- 비로그인 기간 전 안내를 홈으로 보내지 않음. 시작 전과 종료 후 문구를 구분.
- 참여 4단계에 게시 URL 제출. 설문 1〜2분은 설문에만 표시. 스크린샷에서 이름·잔액·계좌번호를 가리라는 안내.
- 당첨 발표: 「応募締切後、抽選を行い、当選者の登録メールアドレスへ順次ご連絡します。」 `2026年10月中旬頃` 없음. SNS 당첨 발표를 하지 않는다는 기존 문장 유지.
- `campaign_view` / `campaign_cta`만 UTM 허용값. 원본 쿼리와 `referrer_url`은 넣지 않음.
- 같은 파일에 있던 설문 「おすすめ」→「紹介」와 관리자 대시보드 설명 몇 줄이 함께 올라갔다.

## 운영 검증 (복원 배포 이후)

라이브 인덱스 `index-DRHuttfV.js`.

- 매도 환율: `MyPage-DZMgk5gH.js`에 `sell_fx_rate`, `sell_fx_date`, `適用レート`. `myPageApi-CKhssWer.js`에 `sell_fx_rate`, `sell_fx_date`.
- 마켓: `MarketPage-DtyZWDXN.js`에 `ランキングを取得できませんでした`. `https://www.moneymart.co.jp/market`에 `確認ポイント`가 보이고 `推奨スタンス`는 보이지 않음. 랭킹은 로드되어 오류 문구는 화면에 나오지 않음.
- 채용: 크롤러 HTML과 화면 모두 제목 `法人営業・事業開発｜銀行・証券・IFA向け`, 급여 `競争力のある給与水準。経験・実績を考慮し、協議のうえ決定します。`, 기간 `2026年9月27日〜10月27日`. `Director`, `契約社員`, `コミッション`, `10年以上` 없음. 다른 직무의 통년 접수 문구는 채용 페이지에 남아 있음. 홈 배너는 `法人営業・事業開発メンバーを募集しています`와 같은 모집 기간이며 `通年採用`은 없음.
- 캠페인 `https://www.moneymart.co.jp/campaign/sns-2026`: 주소가 `/`로 바뀌지 않음. 익명 상태에서 「10月1日開始です」가 보이고 설문 전송 폼과 사내 테스트 문구는 없음. 당첨 문구 「応募締切後、抽選を行い…」가 보이고 `10月中旬`은 없음. 가로 390px에서 `scrollWidth` 390.

종료 후 문구는 오늘이 시작 전이라 운영 화면에서 재현하지 않았다. `getCampaignCp2026SnsSepPublicPhase`로 2026-10-31은 `ended`이고, 그때 비로그인 신청은 열리지 않는다.

매도 화면의 클릭 저장은 이번 검증에 포함하지 않았다. 번들에 `sell_fx_rate`와 `適用レート`가 다시 있는지만 확인했다.
