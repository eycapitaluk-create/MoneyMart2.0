# CRM · UTM & acquisition measurement

## Priority 1 — Tag every external link

Generate links with the CLI so `utm_medium` and spelling stay consistent:

```bash
npm run utm:link -- --list
npm run utm:link -- --source twitter --campaign reply_strategy --content pinned
npm run utm:link -- --source note --path /premium --campaign nisa_guide
```

In app code, use `buildUtmLink()` from `src/lib/utmLinks.js` (or `appendUtm()` for full control).

### Canonical `utm_source` values

`twitter` · `instagram` · `facebook` · `youtube` · `note` · `line` · `smartnews` · `newsletter` · `google`

**Spelling matters.** A canonical source gets its own channel in the dashboard. Anything
else (`X`, `insta`, `Note`) still records, but collapses into **UTM tagged (other)** — the
same blind spot tagging is supposed to remove. The registry lives in `UTM_SOURCES`
(`src/lib/utmLinks.js`) and must stay in sync with `SOURCE_ALIASES` in `src/lib/referrerBuckets.js`.

Tagged and untagged traffic from one channel share a bucket: a `t.co` referrer and a
`utm_source=twitter` link both report as **X (Twitter)**, so rolling out tagging doesn't
make old channels look like they disappeared.

### Naming

| Field | Use | Example |
|-------|-----|---------|
| `utm_campaign` | The initiative | `reply_strategy`, `nisa_guide` |
| `utm_content` | Placement within it | `pinned`, `bio`, `footer` |

### X (Twitter) placements — current rollout

| Placement | Link |
|-----------|------|
| Bio | `https://www.moneymart.co.jp/?utm_source=twitter&utm_medium=social&utm_campaign=bio_link&utm_content=profile` |
| Pinned post | `…&utm_campaign=pinned_post&utm_content=pinned` |
| Replies | `…&utm_campaign=reply_2026_09&utm_content=<landing>` |

Replies keep one campaign per month (`reply_2026_09`) and vary `utm_content` by landing
page, so reply volume is comparable month over month while still showing which destination
pulls. X wraps links in `t.co` but preserves the query string, so UTM survives the redirect.

### Share buttons (already tagged in code)

Referral and Insight share buttons tag themselves — X, LINE, Facebook, and email each get
their own `utm_source`, and copy-link / native share report as **User share**. Invite links
keep `?ref=`, so referral credit is unaffected. No manual work needed for these.

### No UTM handy

`https://www.moneymart.co.jp/signup?ref=community_x` — stored as `utm_source=ref`,
`utm_medium=community`, `utm_campaign=<ref>` on first visit, and bucketed as Referral.

## Measuring progress

Admin → **Dashboard** → **Attribution coverage** shows tagged share for sessions and
sign-ups against the 80% goal. Untagged traffic cannot be credited to a channel, so treat
channel experiments as unmeasurable until this clears the goal line.

## Priority 2 — Exclude internal users in Admin CRM

Admin → **CRM · Acquisition** → cohort **Customers only** (default).

Excluded automatically:
- `@moneymart.co.jp` emails
- `test@moneymart.co.jp` and `test+…` variants
- `localhost` in signup landing / referrer

Apply SQL patch for server-side flags: `SUPABASE_PATCH_CRM_ACTIVATION_SEGMENTS.sql`.

## Priority 3 — Activation signals (7 days post-signup)

| Signal | Event / field |
|--------|----------------|
| Login | `last_sign_in_at` or any analytics row |
| Search | `search` |
| Stock / fund view | `stock_select`, `fund_select`, `fund_detail_view` |
| Watchlist | `stock_watchlist_add`, `fund_watchlist_add` |
| Premium page | `page_view` on `/premium` |
| Checkout click | `premium_checkout_click` |

## CRM segments (Admin cohort filter)

| Segment | Meaning |
|---------|---------|
| Customers only | Hide internal / test |
| Unknown signup | No referrer / UTM / ref |
| Google organic | Referrer contains `google.` |
| Activated | Login + (search or product view or watchlist) within 7d |
| Dormant | Signed up, no activation |
| Premium intent | Visited `/premium` or clicked checkout |

## Verify

1. Open tagged link in incognito → sign up → Admin CRM row should show UTM or `ref`.
2. `GET` plan-config not relevant; check user row **UTM** column and **Segment** badge.
