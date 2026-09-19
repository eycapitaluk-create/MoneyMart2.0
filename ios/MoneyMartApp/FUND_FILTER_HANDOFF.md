# Fund list filters — iOS / Xcode handoff

Mirror web `FundPage.jsx`. Full DB spec: `SUPABASE_QUERY_SPEC.md` §6.

---

## 1. What you build

For each symbol in **`ETF_SYMBOLS_FROM_XLSX`** (`src/data/etfUniverseLite.js`):

1. Fetch DB rows → build **`FundRow`**
2. Drop rows that fail **listing gate**
3. Apply **filters** (search → asset class → sub → NISA → watchlist)
4. Sort + paginate

No `fund_*` table. Prices live in `stock_daily_prices` / `v_stock_latest`.

---

## 2. FundRow fields used by filters

```swift
struct FundRow {
    let id: String              // symbol e.g. "1306.T"
    let fundName: String
    let fundCode: String        // same as id
    let isin: String

    let nisaCategory: String    // after resolveFundNisaCategory; "-" = unset

    let assetClassId: AssetClass
    let subCategoryId: String?  // nil for reit/commodity

    let returnRate1Y: Double?
    let returnRate3M: Double?
    let returnRate1M: Double?
    let basePrice: Double?
}
```

---

## 3. Enums (match web exactly)

### AssetClass (`assetClassId`)

| Raw | Tab label (JA) |
|-----|----------------|
| `stock` | 株式 |
| `bond` | 債券 |
| `commodity` | 原材料 |
| `reit` | REIT |

Filter param: `activeFilter` = `all` | `watchlist` | `stock` | `bond` | `commodity` | `reit`

### Stock subcategory (`subCategoryId`, only when asset class = stock)

| Raw | Label |
|-----|-------|
| `stock_global` | Global |
| `stock_em` | EM |
| `stock_eu` | EU |
| `stock_us` | US |
| `stock_jp` | Japan |
| `stock_thematic` | AIテーマ |
| `stock_dividend` | 高配当 |

Filter param: `activeSubFilter` = `all` | one of above

### Bond subcategory (only when asset class = bond)

| Raw | Label |
|-----|-------|
| `bond_jp` | 国内 |
| `bond_global` | Global |

### NISA quick filter (`nisaQuickFilter`)

| Raw | Rule on `nisaCategory` |
|-----|------------------------|
| `all` | no filter |
| `つみたて投資枠` | contains `つみたて` |
| `成長投資枠` | contains `成長投資枠` OR `成長` |
| `対象外` | contains `対象外` |
| `unknown` | empty OR `"-"` |

Typical stored values: `成長`, `つみたて`, `つみたて・成長`, `NISA対象外`.

---

## 4. Where each field comes from

### NISA — `resolveFundNisaCategory(symbol, dbNisa, stubNisa)`

**Priority (first win):**

1. `stock_symbols.nisa_category` (normalize; blank → `"-"`)
2. Local stub from `etfListFromXlsx` (rare)
3. `etfListedNisaMap[symbol]` (`src/data/etfListedNisaMap.js`)

Web: `src/lib/fundDisplayUtils.js` → `resolveFundNisaCategory`  
Normalize: `src/lib/textEncodingUtils.js` → `normalizeNisaCategoryField` (fix mojibake)

### Display name — `resolveFundDisplayName`

1. `etfListedJaNameMap`
2. `stock_symbol_profiles.name_jp`
3. `stock_symbols.name` (if Japanese)
4. profiles `name_en` / symbol

### Category + sub — `detectAssetClassAndSubCategory`

**Priority:**

1. **`stock_symbols.category`** (DB)
   - `債券` → bond (+ `bond_jp` if country JP else `bond_global`)
   - `REIT` → reit
   - `コモディティ` / `原材料` → commodity (with equity-name overrides)
   - `国内株式` → stock / `stock_jp`
   - `米国株式` → stock / `stock_us`
   - `全世界株式` → stock / `stock_global`
   - `新興国株式` → stock / `stock_em`
   - `株式` → stock; region from **`stock_symbols.country`**

2. **`stock_symbols.country`** (normalized: JP, US, GLOBAL, EM, REIT, COMMODITY, …)
   - `高配当` in country → `stock_dividend`
   - COMMODITY tag → commodity (unless bank/metal sector name → stock)

3. **Name keywords** — bond, REIT, commodity, dividend, AI/tech theme

4. **Static symbol lists** — `src/data/etfThemeFlags.js`
   - `AI_THEME_SYMBOLS` → `stock_thematic`
   - `HIGH_DIVIDEND_SYMBOLS` → `stock_dividend`

Web classifier: `FundPage.jsx` `detectAssetClassAndSubCategory`  
Shared helpers: `src/lib/fundSubcategoryHeuristics.js`

### DB columns to SELECT

```text
stock_symbols:
  symbol, name, trust_fee, nisa_category, aum, category, subcategory, country

v_stock_latest:
  symbol, trade_date, close, open, volume

stock_symbol_profiles:
  symbol, name_jp, name_en

stock_daily_prices (1y, per symbol, jpDedupe for .T):
  trade_date, close, volume, source, fetched_at
```

---

## 5. Listing gate (before filters)

Include row if **any**:

```swift
func passesListingGate(_ f: FundRow) -> Bool {
    if let y = f.returnRate1Y, y.isFinite { return true }
    if let m = f.returnRate3M, m.isFinite { return true }
    if let m = f.returnRate1M, m.isFinite { return true }
    if let p = f.basePrice, p > 0 { return true }
    return false
}
```

---

## 6. Filter pipeline (AND, this order)

```swift
func filteredFunds(
    all: [FundRow],
    search: String,
    activeFilter: String,      // "all" | "watchlist" | assetClass raw
    activeSubFilter: String,    // "all" | subCategoryId
    nisaQuickFilter: String,
    watchlistIds: Set<String>
) -> [FundRow] {
    var r = all

    if !search.isEmpty {
        let q = search.lowercased()
        r = r.filter {
            $0.fundName.lowercased().contains(q)
            || $0.fundCode.lowercased().contains(q)
            || $0.isin.lowercased().contains(q)
        }
    }

    if activeFilter != "all" {
        if activeFilter == "watchlist" {
            r = r.filter { watchlistIds.contains($0.id) }
        } else {
            r = r.filter { $0.assetClassId.rawValue == activeFilter }
        }
    }

    if activeSubFilter != "all" {
        r = r.filter { $0.subCategoryId == activeSubFilter }
    }

    switch nisaQuickFilter {
    case "all": break
    case "unknown":
        r = r.filter { $0.nisaCategory.isEmpty || $0.nisaCategory == "-" }
    case "つみたて投資枠":
        r = r.filter { $0.nisaCategory.contains("つみたて") }
    case "成長投資枠":
        r = r.filter {
            $0.nisaCategory.contains("成長投資枠") || $0.nisaCategory.contains("成長")
        }
    case "対象外":
        r = r.filter { $0.nisaCategory.contains("対象外") }
    default:
        r = r.filter { $0.nisaCategory.contains(nisaQuickFilter) }
    }

    return r
}
```

**Sub-filter UI:** only show stock subs when `activeFilter == stock`; bond subs when `bond`. Hide sub chips for `commodity` / `reit`.

---

## 7. Watchlist

```text
user_watchlists
  item_type = 'fund'
  item_id   = symbol (e.g. "1306.T")
```

---

## 8. Files to port or code-gen from web

| File | Purpose |
|------|---------|
| `src/data/etfUniverseLite.js` | Symbol whitelist |
| `src/data/etfListedNisaMap.js` | NISA fallback |
| `src/data/etfListedJaNameMap.js` | JP names |
| `src/data/etfThemeFlags.js` | AI / high-dividend sets |
| `src/lib/fundDisplayUtils.js` | Name + NISA + symbol normalize |
| `src/lib/fundSubcategoryHeuristics.js` | Country normalize, dividend/commodity name checks |
| `src/pages/FundPage.jsx` | `detectAssetClassAndSubCategory`, filter state |

---

## 9. Do not

- Invent NISA or category when DB + maps are empty (show 未設定 / apply `unknown` filter only).
- Show symbols not in `ETF_SYMBOLS_FROM_XLSX`.
- Fabricate prices for listing gate.
