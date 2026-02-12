# MoneyMart 2.0 운영 SOP (한국어 체크리스트)

## 1) 운영 원칙
- [ ] 펀드 데이터(QUICK): 운영자가 제공 -> 반영 -> Supabase 저장
- [ ] 주식 데이터(API): 1일 1회 자동 수집 -> Supabase 저장
- [ ] 사용자 입력 데이터: DB 저장 + RLS로 본인 데이터만 접근
- [ ] 은행/금융상품 데이터: 관리자에서 수동 입력/수정

---

## 2) 일간 체크리스트 (매일)

### A. 주식 데이터 수집 상태
- [ ] 배치/크론 성공 여부 확인 (`ingestion_jobs` 또는 로그)
- [ ] `stock_daily_prices` 최신 데이터 적재 확인
- [ ] `v_stock_latest` 최신 데이터 확인
- [ ] `StockPage` 주요 3개 종목 수동 확인

### B. 서비스 기본 동작
- [ ] `/stocks` 접속 확인
- [ ] `/funds` 접속 확인
- [ ] `/market` 접속 확인
- [ ] `/mypage` 접속 확인
- [ ] 빈 화면/치명 에러 없는지 확인

### C. 문의 대응
- [ ] `support_inquiries` 신규 문의 확인
- [ ] 상태 업데이트 (new -> in_progress -> resolved)

---

## 3) 주간 체크리스트 (매주)

### A. 펀드 데이터(QUICK) 업데이트
- [ ] QUICK 최신 파일 수신
- [ ] 업데이트/적재 실행
- [ ] `quick_fund_master` 반영 확인
- [ ] `v_quick_fund_latest_price` 반영 확인
- [ ] `FundPage` 값 샘플 검증 (플로우/버블/리스트)

### B. 금융상품(수동 관리) 점검
- [ ] `products` 테이블 신규/수정 항목 검토
- [ ] 만료/깨진 링크 확인
- [ ] 주요 스펙/혜택 최신화 확인

### C. 인증/로그인 QA
- [ ] 이메일 가입/로그인 테스트
- [ ] 구글 로그인 테스트
- [ ] 로그아웃 테스트
- [ ] 로컬/운영 Redirect 정상 동작 확인

---

## 4) 월간 체크리스트 (매월)

### A. 권한/보안
- [ ] `user_roles` 관리자 계정 점검
- [ ] 불필요한 관리자 권한 제거
- [ ] 노출된 시크릿/키 교체 필요 여부 점검

### B. 데이터 품질
- [ ] 주식 수집 커버리지 점검
- [ ] 펀드 업데이트 누락 점검
- [ ] 시뮬레이터 저장 데이터 정상 누적 확인
- [ ] 느린 쿼리/인덱스 개선 필요 여부 점검

### C. 정책/RLS 점검
- [ ] 신규 테이블 RLS 정책 재검토
- [ ] 의도하지 않은 공개 쓰기 권한 점검

---

## 5) 배포 체크리스트 (Vercel 운영 배포 전/후)

### A. 배포 전
- [ ] `npm run build` 성공
- [ ] 변경 파일 lint 문제 없음
- [ ] Vercel 환경변수 최신 상태 확인
- [ ] DB 마이그레이션(SQL) 반영 여부 확인

### B. 배포 실행
- [ ] `git add .`
- [ ] `git commit -m "<메시지>"`
- [ ] `git push origin main`
- [ ] `npx --yes vercel deploy --prod --yes`

### C. 배포 후 스모크 테스트
- [ ] `/login`, `/signup`, `/mypage`
- [ ] `/stocks`, `/funds`, `/market`, `/products`
- [ ] 구글 로그인 콜백 정상
- [ ] Vercel 로그 치명 에러 없음

---

## 6) 장애 대응 체크리스트

### A. 빈 화면/런타임 오류
- [ ] 브라우저 콘솔 에러 확인
- [ ] Vite/Vercel 로그 확인
- [ ] 최근 변경분 기준 롤백 필요성 판단

### B. 데이터 누락
- [ ] 원인 구분 (주식 배치 실패 / QUICK 반영 실패 / 수동 입력 누락)
- [ ] 최신 정상 스냅샷 기준 복구
- [ ] 재발 방지 조치 기록

### C. OAuth/로그인 장애
- [ ] Google OAuth Redirect URI 확인
- [ ] Supabase URL Configuration 확인
- [ ] Supabase Google Provider ID/Secret 확인

---

## 7) 핵심 테이블 체크
- [ ] `user_profiles`, `user_roles`
- [ ] `ai_reports`, `support_inquiries`, `prime_waitlist`
- [ ] `quick_fund_master`, `v_quick_fund_latest_price`
- [ ] `stock_symbols`, `stock_daily_prices`, `v_stock_latest`, `ingestion_jobs`
- [ ] `simulator_assumptions`, `simulator_runs`, `user_scenarios`

---

## 8) 역할 분담

### 운영자(대표)
- [ ] QUICK 데이터 제공/승인
- [ ] 금융상품 수동 업데이트
- [ ] 운영 배포 승인

### 개발/에이전트
- [ ] 적재/업데이트 스크립트 관리
- [ ] 스키마/RLS 변경 및 안정화
- [ ] UI/기능 수정 및 배포 지원

---

## 9) 비고
- [ ] 펀드 플로우는 시뮬레이션 저장 대상이 아니라 실데이터 시각화로 운영
- [ ] 도메인 변경 시 OAuth/Supabase URL 설정 동기화
- [ ] 운영 프로세스 변경 시 본 문서 즉시 갱신
