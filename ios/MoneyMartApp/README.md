# MoneyMart iOS Starter (SwiftUI)

This folder contains a production-oriented iOS starter architecture that mirrors key MoneyMart web logic:

- News (`news_manual`, `ai_news_summaries`)
- Stocks (`v_stock_latest`, `stock_daily_prices`, `stock_symbol_profiles`, `stock_symbols`)
- Budget (`user_expenses`)
- Watchlist + Dividend (`user_watchlists`, `user_dividend_watchlist`, `stock_symbols`)
- Heatmap (latest close vs previous close from recent history)

## Structure

- `MoneyMartApp.swift` - app entry
- `RootTabView.swift` - main tab shell
- `Core/AppConfig.swift` - environment-driven config
- `Core/SupabaseRESTClient.swift` - lightweight PostgREST client
- `Features/*Feature.swift` - one feature per file (models/repo/vm/view)

## Setup

1. Create a new Xcode iOS App project (`SwiftUI`, iOS 17+ recommended).
2. Copy these files into your project.
3. Add two keys to `Info.plist`:
   - `SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `SUPABASE_ANON_KEY` = your anon key
4. Ensure your Supabase RLS allows read/write for required tables per authenticated user.

## Data Integrity Rules

- Never fabricate market/fund values.
- If `prevClose` is missing, do not show a fake percentage.
- If API fails, render explicit empty/error state with retry.

