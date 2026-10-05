# iOS → 웹(Cursor) 매도 환율 기록 (2026-09-27)

## 배경
- 개인 계정 매도 기록 `user_stock_realized_trades` 는 엔화 금액(`proceeds_jpy`, `realized_pnl_jpy`)만 저장하고, **적용한 USD/JPY 는 남기지 않음** → 나중에 며칠 환율로 계산했는지 확인 불가.
- 웹은 매도일 환율(fx_daily_usdjpy)로 환산 중 (OK). iOS 는 지금까지 **입력 시점 환율**을 쓰고 있어서 웹과 금액이 달랐음 → iOS 는 매도일 환율로 수정 중.
- B2B (`client_realized_trades`) 에는 이미 `sale_fx_rate` / `sale_fx_date` 를 추가해 같은 규칙으로 저장하기 시작함.

## DB (사용자가 SQL Editor 에서 실행)
```sql
alter table public.user_stock_realized_trades
    add column if not exists sell_fx_rate numeric(12,4),
    add column if not exists sell_fx_date date;
```
- 둘 다 NULL 허용. 기존 행·기존 앱(1.6.8) 영향 없음.

## 공통 규칙 (웹·iOS 동일)
1. USD 종목 매도 시 환율 = `fx_daily_usdjpy` 에서 **매도일 이하 가장 최근 영업일** 레이트.
   - 조회 실패 시에만 현재 레이트 사용, 그때도 사용한 레이트와 그 날짜를 저장.
2. `proceeds_jpy` = 매도단가(USD) × 수량 × `sell_fx_rate`.
3. 저장 시 `sell_fx_rate`(적용 레이트), `sell_fx_date`(fx_daily_usdjpy.as_of_date) 같이 저장.
4. JPY 종목은 두 칸 모두 NULL.
5. 기존 행은 NULL 그대로 (재계산하지 않음). 화면에서 레이트를 보여줄 땐 NULL 이면 매도일 레이트를 조회해 표시만.

## 부탁 요약
1. 웹 매도 저장 로직에서 이미 찾은 매도일 레이트를 `sell_fx_rate` / `sell_fx_date` 로 같이 insert/update.
2. 매도 폼의 매도일 기본값이 오늘이라 과거 매도를 날짜 안 바꾸고 저장하면 오늘 환율이 적용됨 → 폼에 「適用レート 1ドル=¥xxx (yyyy-mm-dd)」 미리보기 표시 권장 (iOS 도 동일하게 표시).
3. 거래내역 화면: 가격은 달러, 금액·손익은 엔화, 적용 레이트는 거래내역에서만 한 줄 표시 (보유 목록에는 표시 안 함) — iOS 와 동일 표시 규칙.
