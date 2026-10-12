# iOS 앱 → 웹(Cursor) 배당 데이터 확인 요청 (2026-09-25)

iOS 앱(MoneyMart iOS)은 이 워크트리의 웹 로직을 **그대로 실행**해서 배당월·배당금을 동기화합니다.
- 사용 모듈: `src/lib/dividendCalendarDetailLookup.js` (getDividendCalendarDetailRecord / listDividendCalendarEligibleRecords), `src/data/dividendStockUniverse.js`, `src/data/dividendCalendarDetail.generated.json`
- 피커 병합 규칙: ToolsHubPage `DIV_STOCK_PICKER` + `DIV_ETF_PICKER` 와 동일 (상세 레코드 배당>0 이면 상세값, 없으면 유니버스 fallback)
- 19:47 버전 기준 **1,160 종목 전부 웹 = 앱 일치 (불일치 0건)**. ETF 295 종목 포함.

웹 데이터가 바뀌면 iOS 쪽에서 아래 한 줄로 다시 맞춥니다 (웹 코드 변경도 자동 반영):
```
scripts/sync_dividends_from_web.sh ~/.cursor/worktrees/MoneyMart2.0/utn --write
```

---

## 확인이 필요한 데이터 (웹 원본 이슈 — 앱은 웹과 동일하게 표시 중)

### A. 무배당/배당 중단 의심인데 연간 배당이 남아 있음
| 종목 | 현재 데이터 | 의심 이유 |
|---|---|---|
| **INTC** | 8月 $0.125 (연 $0.125) | 2024-08-07 이후 배당 중단 (lastExDate 2024-08-07, 779일 전) |
| **ACGL** | 연간 5 | 정기 배당 없음. 2024-11-18 특별배당으로 보임 |
| **4324.T 電通** | 연간 ¥69.75 | 마지막 권리락 2024-12-27 (637일 전). 2025년 무배 발표 여부 확인 |
| **6594.T ニデック** | 연간 ¥40 | 마지막 권리락 2025-03-28 (546일 전). 배당 보류 여부 확인 |

→ TDG 처럼 특별배당·중단이면 `dividends: []`, `annualDividend: 0` 으로 정리 부탁드립니다.

### B. `annualDividend` 와 월별 `dividends` 합계 불일치
웹(getAnnualDividendPerShare)·앱 모두 **월별 합계**를 연간으로 씁니다. `annualDividend` 필드와 어긋나는 레코드:
| 종목 | annualDividend | 월별 합계 |
|---|---|---|
| 1495.T | 622 | 481 (4회분만 존재 — 누락 월?) |
| 2085.T | 23.4 | 24.7 |
| 2096.T | 69 | 71 |
| 451A.T | 10.1 | 7.7 (3회분만 존재) |

### C. 상세 데이터에 없어 유니버스 구값으로 배당이 표시되는 종목 (12개)
웹도 앱도 `dividendStockUniverse.js` 의 구 값 (배당월 × 1회 배당) 을 표시 중입니다.
BK, DFS, FMC, IPG, JNPR, MMC, PARA, PVH, RHI, SEE, VFC, WBA

이 중 **상장폐지·합병 의심** (retiredStockSymbols 추가 또는 유니버스 제거 검토):
- DFS — Capital One 에 인수 (2025)
- JNPR — HPE 에 인수 (2025)
- PARA — Skydance 합병 → PSKY (상세 데이터에 PSKY 존재)
- WBA — 비상장화 (2025)
- MMC — 상세 데이터에 MRSH (Marsh & McLennan) 로 존재 → 티커 변경 여부 확인

나머지 (BK, FMC, IPG, PVH, RHI, SEE, VFC) 는 상세 데이터 동기화 대상에서 빠진 것으로 보입니다.

### D. 참고 (유지 판단 완료)
2098.T 11.5%, 237A.T 10.2%, 238A.T 10.8%, 2865.T 10.1% — 발행사 수치와 일치하여 유지 (이전 확인 결과).

---

## iOS 앱에 반영된 것 (웹과 동일 동작)
- 개인 배당 캘린더: ETF 티커/상품명 검색 → 배당월·월별 배당금 자동 입력 (전각/반각 NFKC 정규화, 133A 같은 영숫자 코드 지원)
- 상장폐지 7205.T / 9719.T 제외 (`retiredStockSymbols.js` 와 동일)
- 연간 배당 = 월별 합계 (B2B 랭킹·고객 예상 배당 포함)
