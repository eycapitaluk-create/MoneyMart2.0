# MoneyMart 2.0 Operations SOP

## 1) Purpose
- This document defines the standard operation flow for data updates, monitoring, and release checks.
- Goal: keep fund/stock/user/product data reliable for official launch.

---

## 2) Data Ownership Model
- **Fund data (QUICK):** provided manually by operator, then imported and stored in Supabase.
- **Stock data (API):** ingested automatically once per day via cron/API job.
- **User input data:** stored in Supabase tables (auth/profile/simulator/report tables) with RLS.
- **Banking/Product data:** maintained manually via admin input.

---

## 3) Daily Checklist (D-1)

### A. Stock Ingestion Health
- Confirm daily cron success (`ingestion_jobs` or logs).
- Verify latest rows exist in:
  - `stock_daily_prices`
  - `v_stock_latest`
- Spot-check 3 symbols on `StockPage`.

### B. App Health
- Open key pages:
  - `/stocks`
  - `/funds`
  - `/market`
  - `/mypage`
- Verify no blank page / no fatal runtime errors.

### C. Support Queue
- Check `support_inquiries` for new entries.
- Mark triage status in admin workflow (new -> in_progress -> resolved).

---

## 4) Weekly Checklist (W-1)

### A. Fund Data Update (QUICK)
- Receive latest QUICK file/package.
- Run import/update flow.
- Verify:
  - `quick_fund_master`
  - `v_quick_fund_latest_price`
- Spot-check `FundPage`:
  - category flow
  - bubble chart
  - fund list values

### B. Product Data QA (Manual)
- Review product entries from admin:
  - `products`
- Check broken links and outdated specs.

### C. Auth + OAuth QA
- Test:
  - email/password signup/login
  - Google login
  - logout
- Validate redirect behavior for:
  - localhost
  - production domain

---

## 5) Monthly Checklist (M-1)

### A. Security & Access
- Review admin users in `user_roles`.
- Remove stale admin access.
- Rotate exposed/replaced secrets if needed.

### B. Data Quality Review
- Compare key KPI trends:
  - stock ingestion coverage
  - fund rows updated
  - user simulator saves
- Fix schema/index bottlenecks if query latency increases.

### C. Policy/Audit
- Re-check RLS policies for new tables.
- Confirm no public write access beyond intended tables.

---

## 6) Release SOP (Before Vercel Production Deploy)

### A. Pre-deploy
- Run:
  - `npm run build`
- Confirm no lints introduced in changed files.
- Ensure required env vars are present in Vercel.

### B. Deploy
- Typical sequence:
  1. `git add .`
  2. `git commit -m "<message>"`
  3. `git push origin main`
  4. `npx --yes vercel deploy --prod --yes`

### C. Post-deploy Smoke Test
- Verify:
  - `/login`, `/signup`, `/mypage`
  - `/stocks`, `/funds`, `/market`, `/products`
  - Google login callback
- Check latest deployment logs for runtime errors.

---

## 7) Incident SOP

### A. Blank Page / Runtime Error
- Check browser console and Vite/Vercel logs.
- Roll back recent high-risk UI changes if needed.

### B. Data Missing
- Identify source:
  - stock API ingestion failed
  - QUICK fund update missing
  - manual product update omitted
- Restore from latest valid data snapshot.

### C. Auth/OAuth Failure
- Verify:
  - Google OAuth client redirect URIs
  - Supabase `URL Configuration`
  - Supabase Google Provider client ID/secret

---

## 8) Core Tables Reference
- Auth/Profile:
  - `user_profiles`
  - `user_roles`
- Reports/Support:
  - `ai_reports`
  - `support_inquiries`
  - `prime_waitlist`
- Funds/Stocks:
  - `quick_fund_master`
  - `v_quick_fund_latest_price`
  - `stock_symbols`
  - `stock_daily_prices`
  - `v_stock_latest`
  - `ingestion_jobs`
- Simulator:
  - `simulator_assumptions`
  - `simulator_runs`
  - `user_scenarios`

---

## 9) Responsibility Split
- **Operator (You):**
  - QUICK file handoff and approval
  - manual product updates
  - release decision
- **Engineering (Agent support):**
  - ingestion/update scripts
  - schema changes / RLS updates
  - UI/logic fixes and deployment assistance

---

## 10) Notes
- Fund flow visualization is treated as live data display, not user simulation save target.
- Keep OAuth and secrets aligned whenever domain changes.
- Update this SOP whenever operational flow changes.
