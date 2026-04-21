/**
 * Client-side fund subcategory / asset-class hints (Fund list, Home, Tools).
 * Keep in sync with detectAssetClassAndSubCategory in FundPage.jsx.
 */

export const looksLikeHighDividendFromText = (rawName = '', dbSub = '') => {
  const sub = String(dbSub || '').normalize('NFKC')
  const nm = String(rawName || '').normalize('NFKC')
  if (/高配当|配当(?!性)|配当貴族|高利回り|DIVIDEND|HIGH-YIELD|HIGH YIELD|YIELD|INCOME/i.test(sub)) return true
  if (/高配当|配当貴族|高利回り|DIVIDEND|HIGH-YIELD|HIGH YIELD|YIELD|INCOME|ディビデンド/.test(nm)) return true
  if (/配当/.test(nm)) return true
  return false
}

/** Uppercase / NFKC-normalized fund name (same as FundPage normalizeClassifierText output). */
export const isTrueCommodityName = (normalizedUpperName = '') => {
  const x = String(normalizedUpperName || '')
  // BAR/GOLD/SILVER は単独だと BARCLAYS / GOLDMAN 等に誤マッチするので境界を付ける
  return /COMMODITY|\bGOLD\b|\bSILVER\b|CRUDE|WTI|BRENT|UNG|USO|\bGLD\b|\bSLV\b|\bGDX\b|GDXJ|\bDBA\b|\bDBC\b|\bIAU\b|\bSGOL\b|\bBAR\b|原油|貴金属|商品指数|コモディティ|天然ガス|パラジウム|プラチナ|白金|金先物|銀先物|金地金|ゴールド|金ETF|銀ETF|白金ETF|ETF.*金|金価格/i.test(x)
}

/** 銀行・金融セクター株指数など（DBがコモディティでも株式として扱う） */
export const isEquityFinancialSectorName = (normalizedUpperName = '', rawName = '') => {
  const x = String(normalizedUpperName || '')
  const raw = String(rawName || '').normalize('NFKC')
  if (/銀行|金融業|金融株|金融セクター|フィナンシャル|証券株|バンク|東証銀行業/i.test(raw)) return true
  if (/\bBANK\b|BANKING|FINANCIAL(?:\s+SERVICES)?/i.test(x)) return true
  return false
}

export const isEquitySectorMetalName = (normalizedUpperName = '', rawName = '') => {
  const x = String(normalizedUpperName || '')
  const raw = String(rawName || '').normalize('NFKC')
  if (/鉄鋼|非鉄|金属(?!ETF)|スチール|銅|素材|鉱業/i.test(raw)) return true
  if (/STEEL|NON-?FERROUS|METAL\s+BUSINESS|COPPER/i.test(x)) return true
  return false
}

/** stock_symbols.country: normalize to canonical region token used by FundPage classifier. */
export const normalizeDbCountryToken = (raw) => {
  const base = String(raw || '').trim().normalize('NFKC')
  if (!base) return ''
  const cc = base.toUpperCase().replace(/\s+/g, '')

  if (cc === 'JP' || cc === 'JPN' || cc === 'JAPAN' || cc === 'DOMESTIC' || cc === 'LOCAL' || /日本|国内/.test(base)) return 'JP'
  if (cc === 'US' || cc === 'USA' || /米国|アメリカ/.test(base)) return 'US'
  if (cc === 'GLOBAL' || cc === 'WORLD' || cc === 'WORLDWIDE' || cc === 'INTL' || cc === 'INTERNATIONAL' || /全世界|グローバル|海外/.test(base)) return 'GLOBAL'
  if (cc === 'EM' || cc === 'EMERGING' || /新興国/.test(base)) return 'EM'
  if (cc === 'CN' || cc === 'CHINA' || /中国/.test(base)) return 'CN'
  if (cc === 'IN' || cc === 'INDIA' || /インド/.test(base)) return 'IN'
  if (cc === 'EU' || cc === 'EUROPE' || /欧州/.test(base)) return 'EU'
  if (cc === 'UK' || cc === 'GB' || /英国/.test(base)) return 'UK'
  if (cc === 'REIT' || /REIT|リート/.test(base)) return 'REIT'
  if (cc === 'COMMODITY' || cc === 'COMMODITIES' || /コモディティ|商品/.test(base)) return 'COMMODITY'
  if (cc === 'FX' || cc === 'FOREX' || /為替/.test(base)) return 'FX'
  if (/高配当/.test(base)) return 'HIGH_DIVIDEND'
  return cc
}

/**
 * Map DB country column → FundPage stock subCategoryId when category is generic (e.g. 株式).
 * Returns null if unknown (caller falls through to name/symbol heuristics).
 */
export const stockSubCategoryIdFromDbCountryNorm = (cc) => {
  if (!cc) return null
  if (cc === 'HIGH_DIVIDEND' || /高配当/.test(cc)) return 'stock_dividend'
  if (cc === 'GLOBAL' || cc === 'WORLD' || cc === 'WORLDWIDE' || cc === 'INTL' || cc === 'INTERNATIONAL') return 'stock_global'
  if (
    cc === 'EM' ||
    cc === 'CN' ||
    cc === 'IN' ||
    cc === 'CHINA' ||
    cc === 'INDIA' ||
    cc === 'BRAZIL' ||
    cc === 'BR' ||
    cc === 'LATAM'
  ) {
    return 'stock_em'
  }
  if (cc === 'EU' || cc === 'UK' || cc === 'EUROPE' || cc === 'DE' || cc === 'FR') return 'stock_eu'
  if (cc === 'JP' || cc === 'JPN' || cc === 'JAPAN') return 'stock_jp'
  if (cc === 'US' || cc === 'USA') return 'stock_us'
  if (cc === 'FX' || cc === 'FOREX') return 'stock_global'
  return null
}

/** True when stock_symbols.country tags REIT/J-REIT (manual sheets). */
export const isDbCountryReitTag = (cc) => Boolean(cc && /REIT|J-REIT|JREIT/.test(cc))

/** True when stock_symbols.country tags commodity (e.g. gold ETF rows). */
export const isDbCountryCommodityTag = (cc) => cc === 'COMMODITY' || cc === 'COMMODITIES'
