# marketstack Monthly Ingestion Setup (런칭 전)

## 1) Run SQL in Supabase

Open Supabase SQL Editor and run:

- `SUPABASE_SETUP_MARKETSTACK_QUICK.sql`

This creates:

- `stock_symbols`, `stock_daily_prices`
- `ingestion_jobs`
- QUICK-related tables
- RLS policies

## 2) Add Vercel Environment Variables

Project -> Settings -> Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MARKETSTACK_ACCESS_KEY`
- `MARKETSTACK_SYMBOLS` (example: `AAPL,MSFT,7203.XTKS,6758.XTKS`)
- `CRON_SECRET` (random string)

Optional frontend variable:

- `VITE_MARKETSTACK_ACCESS_KEY` (only if direct browser calls are needed; generally avoid)

## 3) Cron Endpoint

File: `api/cron/marketstack-daily.js`

- Fetches latest daily data from marketstack
- Upserts into `stock_symbols`, `stock_daily_prices`
- Writes logs to `ingestion_jobs`

## 4) Cron Schedule

Configured in `vercel.json` (실제 값은 파일 참고):

- `marketstack-daily?us_only=1`: 평일 **00:00 UTC** (`1-5`) — 미국 주식 위주
- `marketstack-daily?jp_only=1&us_only=0`: 평일 **07:00 UTC** (`1-5`) — **한국 시간 16:00**에 일본 주식·펀드(`.T`) EOD 반영
- `marketstack-commodities`: 평일 **22:00 UTC** (`1-5`)

**같은 구간(8시간) 안에서는 `jp` / `us` / `all` scope별로만** 중복 성공 스킵합니다. US 직후 JP 크론이 막히지 않습니다.  
강제 실행이 필요하면 `?force=true`를 붙여 호출합니다.

## 5) Manual test

After deploy, test endpoint once:

```bash
curl -X GET "https://<your-vercel-domain>/api/cron/marketstack-daily" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### 日本ETF（FundPage ユニバース）だけ、特定営業日を MarketStack で上書き

誤データの日を差し替えるとき:

- ローカル: `node scripts/run-marketstack-daily.mjs jp-etf 2026-04-01`（`.env.local` に `CRON_SECRET` 等）
- 本番: `GET /api/cron/marketstack-daily?force=1&jp_etf_only=1&jp_only=1&us_only=0&trade_date=2026-04-01`（`Authorization: Bearer <CRON_SECRET>`）

`trade_date` は東証 EOD として `eod/{日付}&exchange=XTKS` に渡ります（休場日は API が空になり得るので、実際の約定日に合わせる）。

If successful, verify rows in:

- `stock_symbols`
- `stock_daily_prices`
- `ingestion_jobs`
