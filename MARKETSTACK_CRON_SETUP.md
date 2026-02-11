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

Configured in `vercel.json`:

- `0 6 1 * *` (매월 1일 06:00 UTC)

런칭 전이라 월 1회로 설정. 런칭 후에는 `0 6 * * *` (매일)로 변경 가능.

## 5) Manual test

After deploy, test endpoint once:

```bash
curl -X GET "https://<your-vercel-domain>/api/cron/marketstack-daily" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

If successful, verify rows in:

- `stock_symbols`
- `stock_daily_prices`
- `ingestion_jobs`
