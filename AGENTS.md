# MoneyMart repository instructions


## Required before any future web deployment (owner instruction, 2026-10-22)

The account and data deletion page has been deployed on top of Codex's production release. Preserve `account-deletion-2026-10-22` commit `bd1acbb0f8e4a69e1921dbf8c7ad011cf31cc763` in every subsequent web release. An older checkout can remove this page and affect Google Play review.

Before deploying, merge that branch (or verify the exact commit is already an ancestor). Keep `/legal/account-deletion`, its footer link, SEO metadata, sitemap and static SSR content. Verify the release contains the commit and the deployed URL still renders the deletion instructions. Do not deploy an old whole-site snapshot that omits it. This instruction does not itself authorize a new deployment or unrelated changes.

```sh
git merge-base --is-ancestor bd1acbb0f8e4a69e1921dbf8c7ad011cf31cc763 HEAD
```

If this check fails, merge `account-deletion-2026-10-22` and resolve/review any conflicts before continuing. Preserve newer production changes as well.

## Preserve the morning data and alert timing (owner instruction, 2026-10-24)

Price data must be ready by 08:30 Asia/Tokyo/Asia/Seoul for the existing 09:00 portfolio/watchlist close alerts. Preserve the 15 production price cron paths, scope/batch counts and staggered starts from 07:00 through 08:24 JST/KST. The six-minute spacing and five-minute function budget are intentional; do not compress them into concurrent provider requests or restore the old 09:15 FX time from an older checkout. Run `node scripts/check-price-crons.mjs` before future web deployments. Verify the actual current production Git commit and cron configuration, not only a local file or collector version string.

The server-side travel reference jobs run at 08:20/08:21 JST/KST; the four existing portfolio/watchlist close alert jobs run at 09:00. Their commands, thresholds and recipients are outside a routine web release. Do not recreate or manually trigger them. A configured schedule is not evidence that data was collected or a push reached a device. Preserve account deletion, CRM, provider cooldowns and all newer production fixes.
