# Careers web update — user-approved handoff, 2026-09-27

User explicitly asked that Cursor update the web. Changes are already in this worktree: /Users/justinnam/.cursor/worktrees/MoneyMart2.0/utn. Review and finish the web update; do not overwrite unrelated dirty work.

## Final approved role/terms
- 法人営業・事業開発｜銀行・証券・IFA向け
- Hands-on prospecting, demos, pilot proposals, negotiations and contracts. Initial small IFA pilots.
- Remove Director and mandatory 10 years; require new B2B client acquisition and Japanese business communication. Financial institution sales/network preferred.
- 9:00〜18:00; 即日〜応相談; Japan / remote possible with client visits.
- Exact final salary: 給与：競争力のある給与水準。経験・実績を考慮し、協議のうえ決定します。
- User explicitly RETRACTED commission. Do not mention commission or invent a salary amount.
- Recruiting period: 2026-09-27 through 2026-10-27.
- Application: support@moneymart.co.jp.
- Employment category, contract duration, working days/breaks are NOT decided. Do not assume fixed-term, permanent or contractor from hours/pay.

## Implemented files
- src/data/careers.js: shared complete Japanese JD and SEO metadata (new file).
- src/pages/CareersPage.jsx: shared JD, SEO/canonical/social tags, new subject/period.
- api/ssr/static-public.js: full same JD for crawlers, replacing thin placeholder.
- src/lib/seoConfig.js: shared recruiting metadata.
- src/components/layout/Footer.jsx: crawlable careers links.
- scripts/prerender-spa.mjs: careers route included.
- src/pages/HomePage.jsx: old Director recruiting banner replaced.

## Reason and validation
Production Googlebot HTML previously had only “詳細な募集要項はブラウザで...” rather than full job description. Careers was already in sitemap/middleware. General SEO fix is complete locally.
Full Vite build passed (2694 modules, 4m22s) before the final copy-only updates. Final shared JD/SSR test passed all sections, dates, hours, email; no old 10-year/Director/commission wording remains in returned HTML.
No production deployment performed by this chat. Please review latest copy, verify ordinary browser and crawler response, finish normal web deployment, then verify https://www.moneymart.co.jp/careers and home banner. Preserve current other work. Search indexing is not guaranteed/immediate.
Do not add fabricated JobPosting fields. Date is now known; employment arrangement/location details remain incomplete. General SEO does not require inventing those.

## X draft — not posted
【法人営業・事業開発を募集】
銀行・証券・IFAとMoneyMartをつなぐ仲間を探しています。
新規開拓から製品デモ、パイロット提案、契約まで。金融機関向け営業の経験・ネットワークをお持ちの方歓迎。
勤務時間：9:00〜18:00／即日〜応相談
給与：競争力のある給与水準・経験と実績を考慮し応相談
募集締切：10月27日
詳細：https://www.moneymart.co.jp/careers
応募：support@moneymart.co.jp

Do not publish social posts as part of this web handoff.
