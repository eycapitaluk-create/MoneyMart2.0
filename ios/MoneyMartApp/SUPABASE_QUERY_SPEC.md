# MoneyMart iOS Supabase Query Spec

This spec mirrors web app table usage and keeps data integrity first.

## 1) Market Heatmap

- Latest: `v_stock_latest`
  - `select=symbol,trade_date,close`
  - `symbol=in.(...)`
- Previous close source: `stock_daily_prices`
  - `select=symbol,trade_date,close`
  - `symbol=in.(...)`
  - `trade_date=gte.<today-10d>`
  - `order=trade_date.desc`
- Rule: if previous close is missing, omit tile (no fake change%).

## 2) Stocks

- `v_stock_latest` for current close
- `stock_symbol_profiles` for display name (`company_name_ja` preferred)
- Rule: fallback display name is `company_name -> symbol`.

## 3) News

- Preferred source: `news_manual` buckets
  - `market_ticker`
  - `market_pickup`
  - `fund_pickup`
  - `stock_disclosures`
  - `market_major_event`
  - `market_weekly_summary`
  - read fields: `title`, `description`, `topic`, `published_at`, `source`, `url`
- Fallback: `ai_news_summaries`
- Rule: show explicit empty state if both are empty.

## 4) Budget

- Read/Write: `user_expenses`
- Read filters by `user_id=eq.<uid>`
- Insert includes: `user_id, category, amount, paid_at, note`

## 5) Watchlist + Dividend Calendar

- `user_watchlists` (`symbol` per user)
- `user_dividend_watchlist` (`symbol`, `target_date` per user)
- Enrich names from `stock_symbol_profiles`

## Auth / RLS

- In production, replace manual `user_id` text input with Supabase auth session user id.
- RLS should enforce per-user row access for user tables.

