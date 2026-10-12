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

- `user_watchlists`: align with web — `item_type` (`stock` | `fund` | `product`), `item_id`, `item_name`, `metadata` (same table as `src/lib/myPageApi.js`).
- `user_dividend_watchlist`: `stock_id`, `stock_name`, … (no `symbol` / `target_date` columns on base schema).
- Enrich names from `stock_symbol_profiles` where relevant (`stock` codes).

## 6) Fund list (ETF) — universe, category, NISA filters

Web reference: `src/pages/FundPage.jsx`, `src/lib/fundDisplayUtils.js`, `src/lib/fundSubcategoryHeuristics.js`.

There is **no** `fund_*` price table. Listed ETFs use the same tables as stocks.

### 6.1 Universe (which symbols are “funds”)

| Source | Path | Role |
|--------|------|------|
| Symbol whitelist | `src/data/etfUniverseLite.js` → `ETF_SYMBOLS_FROM_XLSX` | **Only these ~327 `.T` symbols** appear on `/funds` |
| Stub meta | `src/data/etfListFromXlsx.js` | Optional ISIN / stub labels (subset) |
| Listed JP names | `src/data/etfListedJaNameMap.js` | Official Japanese display names |
| Listed NISA | `src/data/etfListedNisaMap.js` | NISA fallback when DB empty |
| Theme flags | `src/data/etfThemeFlags.js` | `AI_THEME_*`, `HIGH_DIVIDEND_*` symbol/ISIN sets for sub-filters |

Rule: row in `v_stock_latest` **without** symbol in `ETF_SYMBOLS_FROM_XLSX` → **exclude** from fund list.

Symbol normalization (DB may use `1306.XTKS`): `normalizeFundSymbolKey()` in `fundDisplayUtils.js` → `1306.T`.

### 6.2 Supabase reads (build each fund row)

Batch by symbol list (web: 80 for latest, 100 for profiles).

| Table / view | Columns | Use |
|--------------|---------|-----|
| `stock_symbols` | `symbol, name, exchange, trust_fee, nisa_category, aum, category, subcategory, country` | **Category / country / NISA / trust fee / AUM** |
| `v_stock_latest` | `symbol, trade_date, open, close, volume` | Latest price |
| `stock_symbol_profiles` | `symbol, name_jp, name_en` | Display name |
| `stock_daily_prices` | `symbol, trade_date, open, high, low, close, volume, source, fetched_at` | ~1y history for returns / vol |

History fetch: `fetchStockDailyHistoryBySymbolMap()` (`src/lib/stockDailyHistory.js`).

- JP ETFs: `jpDedupe: true` — one row per `trade_date` when both `jp_etf_csv` and `marketstack` exist (continuity + `manual_close` priority).
- JP price sources in prod: **`jp_etf_csv`** (manual xlsx), **`marketstack`** (JP stocks).

Returns: split-adjusted closes (`fundAdjustedCloses.js`) + calendar offsets (`calendarDateUtils.js`).  
1Y return only if history span ≥ ~330 days; 3M ≥ ~90 days; 1M ≥ ~25 days.

### 6.3 Display name resolution (`resolveFundDisplayName`)

Priority (first non-empty):

1. `etfListedJaNameMap` (listed JP CSV name)
2. `etfJpNameMap` (US ticker map — rarely used for JP ETFs)
3. `stock_symbol_profiles.name_jp`
4. `stock_symbols.name` (if contains Japanese)
5. `etfListFromXlsx` stub `jpName`
6. `stock_symbols.name` / `name_en` / stub / symbol

### 6.4 NISA category resolution (`resolveFundNisaCategory`)

Priority:

1. **`stock_symbols.nisa_category`** (normalize via `normalizeNisaCategoryField` — mojibake fix; empty → `'-'`)
2. `etfListFromXlsx` stub `nisaCategory`
3. **`etfListedNisaMap`** by symbol

DB patch source for bulk NISA: `reports/SUPABASE_PATCH_fund_convention_2026-05-01.sql`, import `scripts/import-fund-list-nisa-xlsx.mjs`.

**Filter values** (client-side, on normalized `nisaCategory` string):

| Filter id | Match rule |
|-----------|------------|
| `all` | no filter |
| `つみたて投資枠` | includes `つみたて` |
| `成長投資枠` | includes `成長投資枠` or `成長` |
| `対象外` | includes `対象外` or `NISA対象外` |
| `unknown` | missing, empty, or `'-'` |

Typical DB values: `成長`, `つみたて`, `つみたて・成長`, `NISA対象外`.

### 6.5 Asset class + subcategory (category filters)

Computed per row as `assetClassId` + `subCategoryId` (`detectAssetClassAndSubCategory` in `FundPage.jsx`; share logic with `fundSubcategoryHeuristics.js`).

**Primary inputs (in order):**

1. `stock_symbols.category` — e.g. `債券`, `REIT`, `コモディティ`, `国内株式`, `米国株式`, `全世界株式`, `新興国株式`, `株式`
2. `stock_symbols.country` — normalized to `JP` / `US` / `GLOBAL` / `EM` / `EU` / `UK` / `REIT` / `COMMODITY` / `HIGH_DIVIDEND` / …
3. `stock_symbols.subcategory` — high-dividend hints in text
4. Fund name heuristics (bond/REIT/commodity/AI/dividend keywords)
5. Static symbol sets: `ETF_BOND_SET`, `ETF_COMMODITY_SET`, `AI_THEME_SYMBOL_SET`, `HIGH_DIVIDEND_SYMBOL_SET`

**`assetClassId` (top filter tabs)**

| id | UI label (JA) |
|----|----------------|
| `stock` | 株式 |
| `bond` | 債券 |
| `commodity` | 原材料 |
| `reit` | REIT (不動産) |

**`subCategoryId` when `assetClassId === 'stock'`**

| id | UI label |
|----|----------|
| `stock_global` | Global |
| `stock_em` | EM |
| `stock_eu` | EU |
| `stock_us` | US |
| `stock_jp` | Japan (国内) |
| `stock_thematic` | AIテーマ |
| `stock_dividend` | 高配当 |

**`subCategoryId` when `assetClassId === 'bond'`**

| id | UI label |
|----|----------|
| `bond_jp` | 国内 |
| `bond_global` | Global |

`commodity` / `reit` have no subcategory filter on web.

**DB `category` / `country` examples**

- `category = 債券` + `country = JP` → `bond` / `bond_jp`
- `category = 株式` + `country = US` → `stock` / `stock_us`
- `country` tag `高配当` → `stock` / `stock_dividend`
- `country` tag `COMMODITY` → `commodity` (unless name is equity-sector metal/bank — override to stock)

### 6.6 Listing gate (before filters)

Include row if **any** of:

- finite `returnRate1Y`, or
- finite `returnRate3M` / `returnRate1M`, or
- `basePrice > 0`

(New listings with price but no 1Y history still show.)

### 6.7 Client filter pipeline (match web order)

Apply **AND** in this order:

1. **Search** — `fundName`, `fundCode`, `isin` (case-insensitive substring)
2. **Asset class** — `activeFilter`: `all` | `watchlist` | `stock` | `bond` | `commodity` | `reit`
3. **Subcategory** — `activeSubFilter`: `all` or `subCategoryId` (only when parent class is `stock` or `bond`)
4. **NISA** — `nisaQuickFilter` (see §6.4)

Watchlist: `user_watchlists` where `item_type = 'fund'` and `item_id` = symbol.

### 6.8 Sort / pagination (web parity)

- Default sort after load: 1Y return desc → 3M/1M → name (`sortFundsForFundPage`)
- UI sort: `random` (session-stable) or column sort via `?sort=&dir=`
- URL params: `?q=&filter=&sub=&nisa=&page=&sort=&dir=`

### 6.9 iOS implementation checklist

- [ ] Bundle or sync `ETF_SYMBOLS_FROM_XLSX` with web `etfUniverseLite.js`
- [ ] Port `normalizeFundSymbolKey`, `resolveFundDisplayName`, `resolveFundNisaCategory`
- [ ] Port `detectAssetClassAndSubCategory` + `fundSubcategoryHeuristics.js`
- [ ] Port listing gate + filter pipeline (§6.6–6.7)
- [ ] Use `jpDedupe` when loading `stock_daily_prices` for `.T` symbols
- [ ] Do not fabricate prices or NISA when DB/local maps are empty — show `未設定` / omit row per gate

## Auth / RLS

- In production, replace manual `user_id` text input with Supabase auth session user id.
- RLS should enforce per-user row access for user tables.

