# MoneyMart B2B (Xcode) — 금융기관 심사 체크리스트

일본 금융기관이 도입 전에 확인하는 IT·보안·리스크 항목을  
**B2B iOS 앱 기능/설계 체크리스트**로 그대로 옮긴 것입니다.

상태:
- ✅ **있음** — 현재 스택/웹·공통 백엔드에 이미 있거나 재사용 가능
- 🔧 **만들어야 함** — B2B Xcode 앱에 신규 구현 필요
- ⚙️ **도입 시 구성** — 앱 기능 + 계약·인프라·설정으로 맞춤
- 🗺️ **로드맵** — 지금은 약속하지 말 것

---

## 은행이 묻는 한 줄

1. 고객 데이터를 맡겨도 안전한가?  
2. AI가 잘못된 정보를 만들면 누가 확인하는가?  
3. 기존 시스템과 연결되는가?  
4. 장애가 나면 어떻게 대응하는가?

---

## 1. 데이터 저장 위치와 개인정보 처리

| # | 확인 항목 | 상태 | B2B 앱에서 할 일 |
|---|-----------|------|-------------------|
| 1.1 | 데이터가 일본 내에 저장되는가 | ⚙️ | 일본 리전(Supabase/AWS 등) 옵션 설계·계약 문서화. 앱 설정/관리화면에 “호스팅 리전” 표시 |
| 1.2 | AWS, Azure 등 어떤 클라우드인가 | ✅ | 현재: Vercel + Supabase (+ OCR시 GCP/AWS). B2B 제안서에 서브프로세서 목록 |
| 1.3 | 개인정보와 투자정보 구분 처리 | 🔧 | B2B: 고객PII / 포트폴리오 / 미팅노트를 스키마·화면·권한으로 분리 |
| 1.4 | 보관 기간과 삭제 방식 | 🔧 | B2B: 기관별 retention 정책, 삭제 요청 워크플로, 관리자 UI |
| 1.5 | 외부 업체가 데이터 처리에 참여하는가 | ⚙️ | AI/OCR 등 서브프로세서 목록 + 기관 승인 토글 |

**슬라이드 표현**
```
Data Management
• Defined data-hosting location          [⚙️]
• Controlled data access and retention   [🔧]
• Personal-data processing aligned with institutional requirements [🔧]
```
일본 저장 미확정이면: `Data hosting options available for enterprise deployment`

---

## 2. 고객 데이터의 AI 학습 사용 여부

은행이 듣고 싶은 답:  
**Client data is not used to train public or shared AI models.**

| # | 확인 항목 | 상태 | B2B 앱에서 할 일 |
|---|-----------|------|-------------------|
| 2.1 | 외부 AI API로 고객 데이터를 보내는가 | ✅/🔧 | 현재 웹은 Anthropic 등으로 전송 가능. B2B는 **전송 여부·범위 통제 UI** + 감사 |
| 2.2 | API 제공자가 데이터를 보관하는가 | ⚙️ | 벤더 zero-retention / no-training 계약 |
| 2.3 | 모델 개선에 고객 데이터 사용 | ⚙️ | 계약으로 “학습 미사용” 확정 후에만 확정 문구 |
| 2.4 | 고객별 데이터가 타 기관에 영향 | 🔧 | **테넌트 분리**(기관별 workspace) — B2B 핵심 |

**슬라이드 표현**（계약 확정 후에만 단정）
```
AI Data Policy
• Client data is not used to train shared AI models     [⚙️ 계약 후]
• Data is processed only for the authorised client workflow [🔧]
• Enterprise retention controls are available           [⚙️]
```

---

## 3. 설명 가능성 및 출처 표시

| # | 확인 항목 | 상태 | B2B 앱에서 할 일 |
|---|-----------|------|-------------------|
| 3.1 | 어떤 시장 데이터에 근거했는가 | ✅/🔧 | 시세 source·시각은 있음 → B2B 인사이트 화면에 **필수 표시** |
| 3.2 | 어떤 보유 종목 때문에 집중 위험인가 | 🔧 | 포트폴리오 리스크 근거(종목·비중) UI |
| 3.3 | 어떤 MoneyMart 리서치를 사용했는가 | ✅/🔧 | 뉴스/인사이트 출처 연결을 Advisor 화면에 노출 |
| 3.4 | 정보 기준 시점은 언제인가 | 🔧 | 모든 AI/분석 카드에 `as-of` 타임스탬프 |

**슬라이드 표현**
```
Explainable Insights
• Source references and data timestamps
• Clear rationale behind key insights
• Distinction between data, analysis and AI-generated commentary
```
→ B2B 앱: **전부 🔧 필수 구현 항목**

---

## 4. Human-in-the-loop 승인 구조

```
AI analysis
     ↓
Advisor review
     ↓
Accept / Edit / Reject
     ↓
Client discussion or report
```

| # | 확인 항목 | 상태 | B2B 앱에서 할 일 |
|---|-----------|------|-------------------|
| 4.1 | AI가 고객에게 자동 발송하지 않음 | 🔧 | 기본: Advisor 승인 전 발송/공유 금지 |
| 4.2 | Advisor Accept / Edit / Reject | 🔧 | **B2B 핵심 화면** |
| 4.3 | 최종 책임 = 기관·Advisor | 🔧 | UI 카피 + 감사 로그에 승인자 기록 |

**슬라이드 표현**
```
Human Oversight
• AI supports—not replaces—advisor judgement
• Advisors review and approve outputs before client use
• Final recommendations remain the responsibility of the institution and advisor
```
→ 전부 **🔧 만들어야 함** (포지셔닝과 가장 잘 맞음)

---

## 5. 감사 로그, SSO, 권한관리, 암호화

| # | 확인 항목 | 상태 | B2B 앱에서 할 일 |
|---|-----------|------|-------------------|
| 5.1 | Audit logs | 🔧 | 로그인·조회·수정·승인·내보내기 기록 + 내보내기(SIEM) |
| 5.2 | SSO | 🔧 | SAML / OIDC (은행 IdP) — Xcode는 ASWebAuthenticationSession 등 |
| 5.3 | Role-based access | 🔧 | Admin / Advisor / Auditor (최소 3역할) |
| 5.4 | Encryption in transit | ✅ | HTTPS/TLS |
| 5.5 | Encryption at rest | ✅ | 클라우드 표준 + 기기측 Keychain 등 |

**슬라이드 표현**
```
Security & Access
• Single Sign-On                    [🔧]
• Role-based access control         [🔧]
• Audit logging                     [🔧]
• Encryption in transit and at rest [✅]
```

---

## 6. API·CRM·코어 시스템 연동

| # | 확인 항목 | 상태 | B2B 앱에서 할 일 |
|---|-----------|------|-------------------|
| 6.1 | CRM에서 고객 정보 가져오기 | 🔧 | 연동 API + 매핑 |
| 6.2 | 포트폴리오 시스템에서 보유자산 가져오기 | 🔧 | import API / 파일 |
| 6.3 | 분석 결과를 CRM에 저장 | 🔧 | export / webhook |
| 6.4 | PDF·데이터 내보내기 | 🔧 | Advisor 리포트 PDF |
| 6.5 | 사내 시스템 API 연결 | 🔧 | Partner API |

**슬라이드 표현**
```
Integration
• API connectivity
• CRM and portfolio-system integration
• Data import and export
• Works alongside existing infrastructure
```
API 없으면: `Integration options available during enterprise deployment`  
→ 현재는 **🔧 / ⚙️** (완성된 Partner API 없음)

---

## 7. 장애 대응, SLA, BCP

| # | 확인 항목 | 상태 | B2B 앱에서 할 일 |
|---|-----------|------|-------------------|
| 7.1 | Incident response | ✅/⚙️ | 사내 SOP 있음 → 고객용 절차서로 격상 |
| 7.2 | SLA | 🔧/⚙️ | 가동률·지원시간·응답시간 **계약 후** (숫자 함부로 쓰지 말 것) |
| 7.3 | Backup | ⚙️ | 벤더 백업 + 기관 요구 RPO |
| 7.4 | Disaster recovery | ⚙️ | RTO 합의 |
| 7.5 | BCP | 🔧 | 사업연속계획 문서 |

**슬라이드 표현**
```
Operational Resilience
• Incident response and escalation process
• Backup and disaster recovery
• Service-level commitments
• Business continuity planning
```
⚠️ `99.9%` 같은 숫자는 SLA 확정 전 **쓰지 말 것**

---

## 8. 클라우드·프라이빗 환경 등 배포 옵션

| # | 형태 | 상태 | 비고 |
|---|------|------|------|
| 8.1 | 일반 SaaS 클라우드 | ✅ | 현재 |
| 8.2 | 금융기관 전용 환경 | ⚙️ | Dedicated tenant |
| 8.3 | Private cloud / 전용 VPC | ⚙️ | 요건 협의 |
| 8.4 | 일본 리전 호스팅 | ⚙️ | 미확정 → 옵션으로만 |
| 8.5 | 온프레미스 | 🗺️ | 로드맵 |

**슬라이드 표현**
```
Deployment
• Lightweight cloud deployment                              [✅]
• Dedicated enterprise environment available                [⚙️]
• Private deployment options subject to institutional requirements [⚙️]
```
모든 옵션을 제공한다고 **쓰지 말 것**

---

## B2B 앱 우선순위 (만들 순서)

### P0 — 없으면 은행 심사 통과 어려움
1. 테넌트(기관) 분리  
2. 역할: Admin / Advisor / Auditor  
3. Advisor Accept / Edit / Reject (HITL)  
4. 감사 로그  
5. AI/분석 출처·기준시각 표시  
6. 「고객 데이터 학습 미사용」계약 + API 전송 통제  

### P1 — 도입 프로젝트에서 필수
7. SSO (SAML/OIDC)  
8. 일본 리전 / 전용 환경 옵션  
9. CRM·포트폴리오 연동·PDF export  
10. 고객용 Incident / SLA / BCP 문서  

### P2 — 로드맵
11. 온프레미스  
12. 고급 SIEM 연동  

---

## 본편 1장용 — Enterprise Ready

```
Enterprise Ready

Data & AI Governance
• Defined data-hosting and retention controls     [⚙️]
• Client-data AI-training policy                  [⚙️]
• Explainable outputs with source references      [🔧]
• Human review and approval                       [🔧]

Security & Access
• SSO and role-based access                       [🔧]
• Audit logs                                      [🔧]
• Encryption in transit and at rest               [✅]

Integration & Resilience
• API, CRM and portfolio-system connectivity      [🔧/⚙️]
• Incident response, backup and BCP               [⚙️]
• Flexible deployment options                     [⚙️]
```

본편은 이 **한 장**, 상세는 위 1–8을 **Security & AI Governance Appendix**.

---

## 상태 요약 (한눈에)

| 영역 | ✅ 있음 | 🔧 만들어야 함 | ⚙️ 도입 시 | 🗺️ 로드맵 |
|------|---------|----------------|------------|-----------|
| 1 데이터 | 클라우드 구성 파악 | PII/보관/삭제 UI | 일본 리전 | — |
| 2 AI 학습 | API 사용 사실 | 전송통제·테넌트 | 계약 no-train | — |
| 3 설명가능성 | 일부 시세·뉴스 | Advisor용 근거 UI | — | — |
| 4 HITL | — | **전부** | — | — |
| 5 보안접근 | 암호화 | SSO·RBAC·Audit | — | — |
| 6 연동 | — | API/CRM/PDF | 도입 커스텀 | — |
| 7 운영 | 사내 SOP | — | SLA/BCP | — |
| 8 배포 | SaaS | — | Dedicated/VPC/JP | On-prem |
