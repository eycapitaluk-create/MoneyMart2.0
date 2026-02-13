# MoneyMart 2.0 런칭 QA 체크리스트 (운영자용)

최종 업데이트: 2026-02-10  
대상 환경: Production (`https://money-mart2-0.vercel.app`)

---

## 0) 배포/버전 확인

- [ ] GitHub `main`이 최신 커밋인지 확인
- [ ] Vercel Production Deployment가 `Ready` 상태인지 확인
- [ ] 브라우저 강력 새로고침 (`Cmd+Shift+R`) 후 최신 UI 반영 확인
- [ ] 주요 페이지 로딩 확인: `/`, `/funds`, `/stocks`, `/market`, `/academy`, `/lounge`

---

## 1) 인증/권한

- [ ] 비로그인 상태에서 `マイページ` 메뉴가 보이지 않는지 확인
- [ ] 로그인 시 네비게이션 버튼이 `ログアウト`로 변경되는지 확인
- [ ] `/mypage` 비로그인 접근 시 `/login` 리다이렉트 확인
- [ ] `/admin` 접근 권한 테스트
  - [ ] admin 계정: 접근 가능
  - [ ] 일반 계정: 홈으로 리다이렉트

---

## 2) Academy (유튜브 강의 운영)

- [ ] Supabase SQL Editor에서 `SUPABASE_SETUP_ACADEMY.sql` 실행 완료
- [ ] `/admin`에서 강의 1개 이상 등록 성공
  - 입력 5개: 제목, YouTube URL, 카테고리, 레벨, 대표강의
- [ ] `/academy`에서 `Data: LIVE` 배지 노출 확인
- [ ] 대표강의 카드 클릭 시 유튜브 새 탭 오픈 확인
- [ ] 하위 강의 카드 클릭 시 유튜브 새 탭 오픈 확인
- [ ] 검색/카테고리 필터 정상 동작 확인

---

## 3) Lounge (커뮤니티)

- [ ] 닉네임 표시 플리커(Guest -> 이름 급변)가 체감상 개선됐는지 확인
- [ ] 비로그인:
  - [ ] 피드 조회 가능
  - [ ] 좋아요/댓글/북마크 시 로그인 유도 동작 확인
- [ ] 로그인:
  - [ ] 게시글 작성
  - [ ] 좋아요/댓글/북마크/팔로우 동작
  - [ ] 알림 뱃지/읽음 처리 동작
- [ ] 신고 기능 제출 및 `/admin` 통보 목록 반영 확인

---

## 4) Fund / Stock / Market 핵심 기능

### Fund
- [ ] 펀드 리스트, 비교(최대 3개), 워치리스트 동작 확인
- [ ] 플로우 바차트 클릭 -> Top3/Bottom3 연동 확인
- [ ] 버블차트에서 워치리스트 빨간색 표시 확인

### Stock
- [ ] 초기 진입 시 스켈레톤 후 자연스럽게 표시 (깜빡임 최소화)
- [ ] Goal Planner / Total Cost 시뮬레이터 계산 확인
- [ ] 결과 저장 버튼(로그인/비로그인 분기) 확인

### Market
- [ ] AI 시장 센티먼트 점수/상태 노출 확인
- [ ] 근거 mini-badge 4개 노출 확인

---

## 5) 법적 문구/컴플라이언스

- [ ] 투자/대출/보험 법적 안내 문구가 각 화면에 표시되는지 확인
- [ ] 과장/보장 표현(확정 수익, 승인 보장 등) 없는지 최종 검토
- [ ] FAQ/약관/개인정보 링크 접근 확인

---

## 6) 데이터/DB 점검 (Supabase)

- [ ] RLS 정책이 테이블별 의도대로 적용되어 있는지 확인
- [ ] 신규 테이블 접근 테스트:
  - [ ] `academy_courses`
  - [ ] `academy_quizzes`
  - [ ] `academy_progress`
  - [ ] `simulator_runs`
  - [ ] `support_inquiries`
  - [ ] `prime_waitlist`
- [ ] `user_roles`에서 운영자 계정이 `admin`인지 확인

---

## 7) 운영 체크 (런칭 주간)

### Daily
- [ ] 프로덕션 접속/핵심 페이지 모니터링
- [ ] 문의(`support_inquiries`) 및 신고(`lounge_reports`) 확인
- [ ] 강의/콘텐츠 신규 반영 여부 확인

### Weekly
- [ ] 사용자 피드백 기반 UI/문구 수정 우선순위 정리
- [ ] 실패 로그/오류 재현 케이스 정리

### Monthly
- [ ] 법적 문구/고지 내용 업데이트 점검
- [ ] 데이터 소스/운영 SOP 갱신

---

## 8) 장애 대응 기본 규칙

- [ ] 장애 발생 시 먼저 사용자 영향 범위 파악 (로그인/결제/핵심페이지)
- [ ] 임시 우회 가능하면 즉시 공지 + 롤포워드
- [ ] 원인/조치/재발방지 3줄 요약을 운영 로그에 남기기

---

## 빠른 확인 링크

- Production: `https://money-mart2-0.vercel.app`
- Funds: `https://money-mart2-0.vercel.app/funds`
- Admin: `https://money-mart2-0.vercel.app/admin`
- Academy: `https://money-mart2-0.vercel.app/academy`
- Lounge: `https://money-mart2-0.vercel.app/lounge`

