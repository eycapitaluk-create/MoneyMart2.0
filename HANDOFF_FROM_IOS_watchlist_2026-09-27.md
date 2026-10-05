# iOS → 웹(Cursor) 워치리스트·배당 워치리스트 동기화 (2026-09-27)

개인 계정 워치리스트는 웹·iOS 가 같은 테이블을 씁니다. 검토에서 양쪽 불일치가 나와서 **공통 규칙**을 정하고 각자 맞추려 합니다. iOS 쪽은 이 규칙대로 수정 중입니다. 웹도 확인 부탁드립니다.

## 공통 규칙 (제안)

### user_watchlists
- `item_type` 은 DB CHECK 대로 `'fund' | 'stock' | 'product'` 만 사용.
  - iOS 가 펀드를 `'etf'` 로 저장하려다 전부 실패하던 버그 → iOS 가 `'fund'` 로 수정.
  - `'product'` (보험 등) 는 iOS 가 펀드 목록에 섞어 보이던 문제 → iOS 는 `'fund'` 만 펀드로 읽음.
- `item_id` 정규화: `trim` + **대문자** + **숫자로 시작하는** 4자리 일본 코드만 `.T` 붙임 (예: `7203` → `7203.T`, `130a` → `130A.T`). ⚠️ `ADBE`, `ORCL` 같은 4글자 미국 티커에는 붙이면 안 됨 (DB 에 21행 있음).
- 펀드 슬러그 id (예: `maxis-nikkei`) 도 iOS 는 대문자로 비교합니다 → 웹도 **대소문자 무시 비교** 부탁. iOS 삭제는 원본·소문자 변형도 같이 지웁니다.
- 저장 방식: **추가/삭제는 개별 upsert/delete** (`on_conflict=user_id,item_type,item_id`).
  - ⚠️ 웹 `replaceStockWatchlistInDb` 가 **stock 행 전체 삭제 후 재삽입** → 그 사이 iOS 에서 추가한 종목이 사라지고, `item_name` 이 심볼로 덮어써짐. **차분(diff) 기반 upsert/delete 로 변경 부탁**.

### user_dividend_watchlist
- 식별 키는 `(user_id, stock_id)` (UNIQUE). 저장은 `on_conflict=user_id,stock_id`, 삭제도 `stock_id` 기준 (iOS 는 id 기준이라 어긋나던 것 수정 중).
- **배당월**: 현재 42행 중 38행이 `months` NULL (웹은 `dividends` JSON 만 저장) → 서버 배당 푸시가 이 38종목에 안 나감.
  - 제안: 웹 저장 시 `months` (int 배열) 도 같이 채워 주세요. 서버(alerts-dividend-daily)는 iOS 쪽에서 `months` 가 없으면 `dividends` JSON / 배당 마스터에서 월을 계산하도록 보강하겠습니다.
- 보유 종목 자동 추가: iOS 가 보유 종목을 배당 리스트에 매번 다시 넣어서 삭제가 안 되던 문제 → iOS 는 **사용자가 지운 종목은 다시 자동 추가하지 않음**(로컬 기록). 웹도 자동 추가 로직이 있으면 같은 규칙 부탁.

### 미국 ETF
- 새로 추가하는 후보에서는 숨김 (웹·iOS 동일). 이미 워치 중인 미국 ETF (예: VOO, SCHD) 는 표시 유지.

## 부탁 요약
1. `replaceStockWatchlistInDb` → 차분 upsert/delete, `item_name` 유지
2. 4자리 일본 코드 `.T` 정규화 확인
3. 배당 워치리스트 저장 시 `months` 채우기, 삭제는 `stock_id` 기준
4. 자동 추가 로직이 있다면 "사용자가 지운 종목은 재추가 안 함"
