# MoneyMart repository instructions


## Required before any future web deployment (owner instruction, 2026-10-22)

The account and data deletion page has been deployed on top of Codex's production release. Preserve `account-deletion-2026-10-22` commit `bd1acbb0f8e4a69e1921dbf8c7ad011cf31cc763` in every subsequent web release. An older checkout can remove this page and affect Google Play review.

Before deploying, merge that branch (or verify the exact commit is already an ancestor). Keep `/legal/account-deletion`, its footer link, SEO metadata, sitemap and static SSR content. Verify the release contains the commit and the deployed URL still renders the deletion instructions. Do not deploy an old whole-site snapshot that omits it. This instruction does not itself authorize a new deployment or unrelated changes.

```sh
git merge-base --is-ancestor bd1acbb0f8e4a69e1921dbf8c7ad011cf31cc763 HEAD
```

If this check fails, merge `account-deletion-2026-10-22` and resolve/review any conflicts before continuing. Preserve newer production changes as well.
