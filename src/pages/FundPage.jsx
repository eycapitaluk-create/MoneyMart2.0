import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Heart, Check, Globe, Flag, Loader2, ArrowUpDown, ArrowUp, ArrowDown, BarChart2, X } from 'lucide-react'
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ZAxis,
  ReferenceLine,
} from 'recharts'

import { supabase } from '../lib/supabase'
import { trackAnalyticsEvent } from '../lib/analytics'
import { recordUserActivityEvent } from '../lib/userActivityApi'
import { normalizeFundDisplayName } from '../lib/fundDisplayUtils'
import { normalizeNisaCategoryField } from '../lib/textEncodingUtils'
import { findBaseCloseByCalendarOffset } from '../lib/calendarDateUtils'
import {
  buildSplitAdjustedCloses,
  resolveSpotCloseAndSessionChange,
  skipEodSplitHeuristicForSymbol,
} from '../lib/fundAdjustedCloses'
import { fetchStockDailyHistoryBySymbolMap } from '../lib/stockDailyHistory'
import {
  loadFundOptimizerWatchsets,
  saveFundOptimizerWatchsets,
  normalizeFundOptimizerWatchset,
  upsertFundOptimizerWatchsetToDb,
  deleteFundOptimizerWatchsetFromDb,
  loadFundOptimizerWatchsetsFromDb,
} from '../lib/fundOptimizerWatchsets'
import { isPaidPlanTier } from '../lib/membership'
import { annualizeThreeMonthReturnPct } from '../lib/wealthSimEtfReturns'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import { MM_SIMULATION_PAST_PERFORMANCE_JA } from '../lib/moneymartSimulationDisclaimer'
import AdBanner from '../components/AdBanner'
import AdSidebar from '../components/AdSidebar'
import MarketDataEodFreshnessNote from '../components/MarketDataEodFreshnessNote'
import { signedReturnBarHex, signedReturnTextClassStrong } from '../lib/marketDirectionColors'
const PortfolioOptimizer3D = lazy(() => import('../components/funds/PortfolioOptimizer3D'))
const FundComparePage = lazy(() => import('./FundComparePage'))

function Optimizer3DLoadingCard() {
  return (
    <div className="h-[400px] md:h-[520px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-100 via-[#e6edf9] to-slate-100 dark:from-slate-900 dark:via-[#1c2740] dark:to-slate-900 p-1.5">
      <div className="w-full h-full rounded-lg border border-white/30 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/40 flex items-center justify-center">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">3D optimizer を読み込み中...</p>
      </div>
    </div>
  )
}

function CompareModalLoadingCard() {
  return (
    <div className="min-h-[420px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-300">
        <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
        比較データを読み込み中...
      </div>
    </div>
  )
}
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../data/etfListFromXlsx'
import { getEtfJpName } from '../data/etfJpNameMap'
import {
  AI_THEME_SYMBOL_SET,
  HIGH_DIVIDEND_SYMBOL_SET,
  AI_THEME_ISIN_SET,
  HIGH_DIVIDEND_ISIN_SET,
} from '../data/etfThemeFlags'
import {
  looksLikeHighDividendFromText,
  isTrueCommodityName,
  isEquitySectorMetalName,
  isEquityFinancialSectorName,
  normalizeDbCountryToken,
  stockSubCategoryIdFromDbCountryNorm,
  isDbCountryReitTag,
  isDbCountryCommodityTag,
} from '../lib/fundSubcategoryHeuristics'

const detectCategory = (code, name) => {
  const n = name ? name.toLowerCase() : ''
  if (n.includes('日本') || n.includes('topix') || n.includes('日経') || n.includes('国内')) return '国内株式'
  if (n.includes('米国') || n.includes('s&p') || n.includes('nasdaq') || n.includes('us')) return '米国株式'
  if (n.includes('全世界') || n.includes('global')) return '全世界株式'
  if (n.includes('新興国') || n.includes('emerging')) return '新興国株式'
  if (n.includes('債券') || n.includes('bond')) return '債券型'
  if (n.includes('reit') || n.includes('リート')) return 'REIT'
  if (n.includes('バランス')) return 'バランス型'
  return 'その他'
}

const mapDbCategoryToDisplay = (dbCategory) => {
  const c = String(dbCategory || '').trim()
  if (c === '債券') return '債券型'
  return c || 'その他'
}

const detectEtfCategory = (symbol, name) => {
  if (ETF_BOND_SET.has(symbol)) return '債券型'
  if (ETF_REIT_SET.has(symbol)) return 'REIT'
  if (ETF_COMMODITY_SET.has(symbol)) return 'コモディティ'
  if (ETF_EM_SET.has(symbol)) return '新興国株式'
  if (ETF_GLOBAL_SET.has(symbol)) return '全世界株式'
  if (ETF_JP_SET.has(symbol)) return '国内株式'
  return detectCategory(symbol, name)
}

const inferExposureCountry = (symbol = '', fundName = '') => {
  const n = String(fundName || '').toUpperCase()
  if (n.includes('全世界') || n.includes('GLOBAL') || n.includes('ACWI') || n.includes('オール・カントリー')) return 'GLOBAL'
  if (n.includes('新興国') || n.includes('EMERGING')) return 'EM'
  if (n.includes('米国') || n.includes('S&P') || n.includes('NASDAQ') || n.includes('US ')) return 'US'
  if (n.includes('欧州') || n.includes('EUROPE')) return 'EU'
  if (n.includes('英国') || n.includes('UK')) return 'UK'
  if (n.includes('中国') || n.includes('CHINA')) return 'CN'
  if (n.includes('インド') || n.includes('INDIA')) return 'IN'
  if (n.includes('日本') || n.includes('TOPIX') || n.includes('日経') || symbol.endsWith('.T')) return 'JP'
  if (symbol.endsWith('.L')) return 'UK'
  if (/\.(PA|AS|DE|MI|MC|SW|BR|LS|ST|HE)$/i.test(symbol)) return 'EU'
  return 'US'
}

const calculateRiskFromReturn = (returnRate, category) => {
  if (category === '債券型') return 1.6
  if (category === 'バランス型') return 2.4
  if (returnRate < 5) return 1.8
  if (returnRate < 15) return 2.9
  if (returnRate < 25) return 3.7
  if (returnRate < 40) return 4.6
  return 5.3
}

const calculateRealizedVolatility = (closes = []) => {
  const normalized = closes.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)
  if (normalized.length < 3) return null
  const dailyReturns = []
  for (let i = 1; i < normalized.length; i += 1) {
    dailyReturns.push((normalized[i] - normalized[i - 1]) / normalized[i - 1])
  }
  if (dailyReturns.length < 2) return null
  const mean = dailyReturns.reduce((acc, cur) => acc + cur, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((acc, cur) => acc + ((cur - mean) ** 2), 0) / (dailyReturns.length - 1)
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

const TARGET_ETF_SYMBOL_SET = new Set(ETF_SYMBOLS_FROM_XLSX)
// MarketStack returns XTKS/XLON → 우리는 .T/.L 사용. v_stock_latest 매칭용
const normalizeSymbolFromApi = (s) => {
  if (!s || typeof s !== 'string') return s
  const t = s.trim()
  if (t.endsWith('.XTKS')) return t.slice(0, -5) + '.T'
  if (t.endsWith('.XLON')) return t.slice(0, -5) + '.L'
  return t
}
const TARGET_ETF_META_MAP = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))
const TARGET_ETF_META_BY_ISIN_MAP = new Map(
  ETF_LIST_FROM_XLSX
    .filter((item) => item?.isin)
    .map((item) => [item.isin, item])
)
const ETF_BOND_SET = new Set(['TLT', 'HYG', 'LQD', 'IEF', 'SHY', 'BND', 'AGG', 'EMB', 'TIP'])
const ETF_REIT_SET = new Set(['VNQ', 'VNQI'])
const ETF_COMMODITY_SET = new Set(['GLD', 'SLV', 'USO', 'GDX'])
const ETF_EM_SET = new Set(['EEM', 'MCHI'])
const ETF_GLOBAL_SET = new Set(['VT', 'VXUS', 'ACWI', 'EFA'])
const ETF_JP_SET = new Set(['1475.T', 'EWJ'])

const ASSET_CLASS_LABELS = {
  stock: '株式',
  bond: '債券',
  commodity: 'Commodity',
  reit: 'REIT (不動産)',
}

const STOCK_SUBCATEGORY_LABELS = {
  stock_global: 'Global',
  stock_em: 'EM',
  stock_eu: 'EU',
  stock_us: 'US',
  stock_jp: 'Japan (国内)',
  stock_thematic: 'AIテーマ',
  stock_dividend: '高配当',
}

const BOND_SUBCATEGORY_LABELS = {
  bond_jp: '国内',
  bond_global: 'Global',
}

const normalizeClassifierText = (value = '') => String(value || '').normalize('NFKC').toUpperCase()

const detectAssetClassAndSubCategory = (symbol, fundName, baseCategory, marketCountry, isin = '', dbMeta = null) => {
  const s = String(symbol || '').toUpperCase()
  const isinCode = String(isin || '').trim().toUpperCase()
  const n = normalizeClassifierText(fundName)
  const rawNameForJa = String(fundName || '')
  const c = String(baseCategory || '')
  const dbCategory = String(dbMeta?.category || '').trim()
  const dbSubcategory = String(dbMeta?.subcategory || '').trim()
  const dbCountryNorm = normalizeDbCountryToken(dbMeta?.country)
  const country = dbCountryNorm || normalizeDbCountryToken(marketCountry)

  // Supabase DB 우선: category/country가 있으면 사용
  if (dbCategory === '債券') {
    return { assetClassId: 'bond', subCategoryId: dbCountryNorm === 'JP' ? 'bond_jp' : 'bond_global' }
  }
  const shouldOverrideFalseCommodity =
    (isEquitySectorMetalName(n, rawNameForJa) || isEquityFinancialSectorName(n, rawNameForJa)) && !isTrueCommodityName(n)

  // stock_symbols.country: 자산군·リージョンの正規化（category が 株式 だけなどのときの足がかり）
  if (dbCountryNorm) {
    const rawCountryJa = String(dbMeta?.country || '').trim().normalize('NFKC')
    if (/高配当/.test(rawCountryJa)) {
      return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
    }
    if (isDbCountryReitTag(dbCountryNorm)) {
      return { assetClassId: 'reit', subCategoryId: null }
    }
    if (isDbCountryCommodityTag(dbCountryNorm)) {
      if (shouldOverrideFalseCommodity) {
        const div = looksLikeHighDividendFromText(rawNameForJa, dbSubcategory)
        if (div) return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
        if (country === 'GLOBAL') return { assetClassId: 'stock', subCategoryId: 'stock_global' }
        if (country === 'EM' || country === 'CN' || country === 'IN') return { assetClassId: 'stock', subCategoryId: 'stock_em' }
        if (country === 'EU' || country === 'UK') return { assetClassId: 'stock', subCategoryId: 'stock_eu' }
        if (country === 'JP') return { assetClassId: 'stock', subCategoryId: 'stock_jp' }
        return { assetClassId: 'stock', subCategoryId: 'stock_us' }
      }
      return { assetClassId: 'commodity', subCategoryId: null }
    }
    if (dbCountryNorm === 'FX' || dbCountryNorm === 'FOREX') {
      return { assetClassId: 'stock', subCategoryId: 'stock_global' }
    }
  }

  if (dbCategory === 'REIT' || /REIT|J-REIT/.test(dbCategory)) {
    return { assetClassId: 'reit', subCategoryId: null }
  }

  if (dbCategory === 'コモディティ') {
    if (shouldOverrideFalseCommodity) {
      const div = looksLikeHighDividendFromText(rawNameForJa, dbSubcategory)
      if (div) return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
      if (country === 'GLOBAL') return { assetClassId: 'stock', subCategoryId: 'stock_global' }
      if (country === 'EM' || country === 'CN' || country === 'IN') return { assetClassId: 'stock', subCategoryId: 'stock_em' }
      if (country === 'EU' || country === 'UK') return { assetClassId: 'stock', subCategoryId: 'stock_eu' }
      if (country === 'JP') return { assetClassId: 'stock', subCategoryId: 'stock_jp' }
      return { assetClassId: 'stock', subCategoryId: 'stock_us' }
    }
    return { assetClassId: 'commodity', subCategoryId: null }
  }
  if (dbCategory === '国内株式') {
    if (looksLikeHighDividendFromText(rawNameForJa, dbSubcategory)) return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
    return { assetClassId: 'stock', subCategoryId: 'stock_jp' }
  }
  if (dbCategory === '米国株式') {
    if (looksLikeHighDividendFromText(rawNameForJa, dbSubcategory)) return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
    return { assetClassId: 'stock', subCategoryId: 'stock_us' }
  }
  if (dbCategory === '全世界株式') {
    if (looksLikeHighDividendFromText(rawNameForJa, dbSubcategory)) return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
    return { assetClassId: 'stock', subCategoryId: 'stock_global' }
  }
  if (dbCategory === '新興国株式') {
    if (looksLikeHighDividendFromText(rawNameForJa, dbSubcategory)) return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
    return { assetClassId: 'stock', subCategoryId: 'stock_em' }
  }
  // DB が「株式」だけなどのときは country 列でリージョンを決める
  if (dbCategory === '株式' || dbCategory === '股票') {
    if (looksLikeHighDividendFromText(rawNameForJa, dbSubcategory)) return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
    const subFromCountry =
      stockSubCategoryIdFromDbCountryNorm(dbCountryNorm) || stockSubCategoryIdFromDbCountryNorm(country)
    if (subFromCountry) return { assetClassId: 'stock', subCategoryId: subFromCountry }
  }

  if (c === 'REIT' || /REIT|リート/.test(n)) {
    return { assetClassId: 'reit', subCategoryId: null }
  }
  if (c === '債券型' || /債券|BOND|TREASURY|国債|社債/.test(n) || ETF_BOND_SET.has(s)) {
    const isUsOrGlobalBond = /米国債|米国債券|米国|US.*BOND|TREASURY|新興国債|海外債券|WGBI|GLOBAL/i.test(n) || ETF_BOND_SET.has(s)
    const isDomesticBond = !isUsOrGlobalBond && /国内|日本国債|JGB|国内債券/.test(n)
    return { assetClassId: 'bond', subCategoryId: isDomesticBond ? 'bond_jp' : 'bond_global' }
  }
  if (ETF_COMMODITY_SET.has(s)) {
    return { assetClassId: 'commodity', subCategoryId: null }
  }
  if (c === 'コモディティ' || isTrueCommodityName(n)) {
    if (shouldOverrideFalseCommodity) {
      const div = looksLikeHighDividendFromText(rawNameForJa, dbSubcategory)
      if (div) return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
      if (country === 'GLOBAL') return { assetClassId: 'stock', subCategoryId: 'stock_global' }
      if (country === 'EM' || country === 'CN' || country === 'IN') return { assetClassId: 'stock', subCategoryId: 'stock_em' }
      if (country === 'EU' || country === 'UK') return { assetClassId: 'stock', subCategoryId: 'stock_eu' }
      if (country === 'JP') return { assetClassId: 'stock', subCategoryId: 'stock_jp' }
      return { assetClassId: 'stock', subCategoryId: 'stock_us' }
    }
    return { assetClassId: 'commodity', subCategoryId: null }
  }

  // stock family
  if (HIGH_DIVIDEND_SYMBOL_SET.has(s) || HIGH_DIVIDEND_ISIN_SET.has(isinCode)) {
    return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
  }
  if (AI_THEME_SYMBOL_SET.has(s) || AI_THEME_ISIN_SET.has(isinCode)) {
    return { assetClassId: 'stock', subCategoryId: 'stock_thematic' }
  }
  if (c === '配当' || looksLikeHighDividendFromText(rawNameForJa, dbSubcategory)) {
    return { assetClassId: 'stock', subCategoryId: 'stock_dividend' }
  }
  if (c === 'テクノロジー' || c === '金融' || /半導体|TECH|AI|BIGDATA|ROBOT|CLOUD|FINTECH|クリーン|テーマ|セクター|INNOVATION|DEFENSE|EV|BATTERY|DIGITAL/.test(n)) {
    return { assetClassId: 'stock', subCategoryId: 'stock_thematic' }
  }
  if (country === 'GLOBAL') return { assetClassId: 'stock', subCategoryId: 'stock_global' }
  if (country === 'EM' || country === 'CN' || country === 'IN') return { assetClassId: 'stock', subCategoryId: 'stock_em' }
  if (country === 'EU' || country === 'UK') return { assetClassId: 'stock', subCategoryId: 'stock_eu' }
  if (country === 'JP') return { assetClassId: 'stock', subCategoryId: 'stock_jp' }
  return { assetClassId: 'stock', subCategoryId: 'stock_us' }
}
const FUND_PAGE_CACHE_KEY = 'moneymart.fund.page.cache.v12'
const FUND_PAGE_UI_STATE_KEY = 'moneymart.fund.page.ui.v1'
const FUND_OPTIMIZER_MONTHLY_USAGE_KEY = 'moneymart.fund.optimizer.monthly.usage.v1'
const FREE_FUND_OPTIMIZER_RUNS_PER_MONTH = 1
const PREMIUM_EMAIL_ALLOWLIST = new Set([
  'justin.nam@moneymart.co.jp',
  'kelly.nam@moneymart.co.jp',
])
const FUND_PAGE_CACHE_TTL_MS = 1000 * 60 * 5
const FUND_PAGE_STALE_CACHE_MS = 1000 * 60 * 60 * 24
const formatAum = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '-'
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}兆`
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}万`
  return Math.round(n).toLocaleString('ja-JP')
}
const resolveAumValue = (fund, fallbackMeta = null) => {
  const direct = Number(fund?.aumValue)
  if (Number.isFinite(direct) && direct > 0) return direct
  const metaAum = Number(fallbackMeta?.aum)
  if (Number.isFinite(metaAum) && metaAum > 0) return metaAum
  const isinMetaAum = Number(TARGET_ETF_META_BY_ISIN_MAP.get(fund?.isin)?.aum)
  if (Number.isFinite(isinMetaAum) && isinMetaAum > 0) return isinMetaAum
  return null
}
const sanitizeCachedFundsNisa = (funds) =>
  (Array.isArray(funds) ? funds : []).map((f) => ({
    ...f,
    nisaCategory: normalizeNisaCategoryField(f?.nisaCategory),
  }))

const readFundPageCache = () => {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(FUND_PAGE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const cachedAt = Number(parsed?.cachedAt || 0)
    if (!cachedAt || (Date.now() - cachedAt) > FUND_PAGE_CACHE_TTL_MS) return null
    return Array.isArray(parsed?.funds) ? sanitizeCachedFundsNisa(parsed.funds) : null
  } catch {
    return null
  }
}
const readStaleFundPageCache = () => {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(FUND_PAGE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const cachedAt = Number(parsed?.cachedAt || 0)
    if (!cachedAt || (Date.now() - cachedAt) > FUND_PAGE_STALE_CACHE_MS) return null
    return Array.isArray(parsed?.funds) ? sanitizeCachedFundsNisa(parsed.funds) : null
  } catch {
    return null
  }
}
// In-memory bootstrap cache to avoid chart flicker
// during immediate remount/re-hydration cycles.
let FUND_PAGE_BOOTSTRAP_CACHE = null
const writeFundPageCache = (funds) => {
  try {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      FUND_PAGE_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), funds: Array.isArray(funds) ? funds : [] })
    )
  } catch {
    // ignore storage errors
  }
}
const formatTrustFee = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(2)}%`
}
const normalizeSortValue = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const asNumber = Number(value)
  if (Number.isFinite(asNumber)) return asNumber
  return String(value).toLowerCase()
}
/** Lazily assigns a stable random key per fund id for the session (list order does not reshuffle on every render). */
const randomSortKeyForId = (ref, id) => {
  const m = ref.current
  const k = String(id || '')
  if (!m.has(k)) m.set(k, Math.random())
  return m.get(k)
}

const compareBySortConfig = (a, b, { key, direction }) => {
  const aVal = normalizeSortValue(a?.[key])
  const bVal = normalizeSortValue(b?.[key])
  if (aVal === null && bVal === null) return 0
  if (aVal === null) return 1
  if (bVal === null) return -1
  if (aVal < bVal) return direction === 'ascending' ? -1 : 1
  if (aVal > bVal) return direction === 'ascending' ? 1 : -1
  return 0
}
const fmtPct = (v) => {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}
const fmtYen = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
const fmtYenCompact = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (abs >= 100000000) return `¥${(n / 100000000).toFixed(1)}億`
  if (abs >= 10000) return `¥${(n / 10000).toFixed(0)}万`
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
const fmtNumber = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('ja-JP')
}
const parseNumericInput = (raw) => {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}
const projectFutureValueYen = ({ annualRatePct, initialYen, monthlyYen, years = 5 }) => {
  const months = Math.max(1, Number(years) * 12)
  const monthlyRate = Number(annualRatePct || 0) / 100 / 12
  const safeMonthlyRate = Math.max(-0.99, monthlyRate)
  const initialFuture = Number(initialYen || 0) * Math.pow(1 + safeMonthlyRate, months)
  const monthlyFuture = Math.abs(safeMonthlyRate) < 1e-9
    ? Number(monthlyYen || 0) * months
    : Number(monthlyYen || 0) * ((Math.pow(1 + safeMonthlyRate, months) - 1) / safeMonthlyRate)
  const total = initialFuture + monthlyFuture
  const principal = Number(initialYen || 0) + (Number(monthlyYen || 0) * months)
  const gain = total - principal
  return { total, principal, gain }
}
const simulatePortfolioProjectionByYear = ({
  years = 20,
  initialYen = 1000000,
  monthlyYen = 30000,
  annualReturnPct = 0,
  annualFeePct = 0,
}) => {
  const months = Math.max(1, Number(years) * 12)
  const grossMonthly = Number(annualReturnPct || 0) / 100 / 12
  const feeMonthly = Math.max(0, Number(annualFeePct || 0) / 100 / 12)
  let balance = Math.max(0, Number(initialYen || 0))
  let principal = Math.max(0, Number(initialYen || 0))
  let feePaid = 0
  const series = [{ year: 0, total: balance, principal, gain: 0, feePaid }]
  for (let m = 1; m <= months; m += 1) {
    balance += Math.max(0, Number(monthlyYen || 0))
    principal += Math.max(0, Number(monthlyYen || 0))
    balance *= (1 + grossMonthly)
    const monthFee = Math.max(0, balance * feeMonthly)
    balance -= monthFee
    feePaid += monthFee
    if (m % 12 === 0) {
      const year = m / 12
      series.push({
        year,
        total: balance,
        principal,
        gain: balance - principal,
        feePaid,
      })
    }
  }
  return series
}
const toProjectionAnnualRatePct = (rawPct) => {
  const raw = Number(rawPct)
  if (!Number.isFinite(raw)) return null
  // 1Y return-like metric to projection rate mapping:
  // keep variation by allocation, but avoid unrealistic explosion.
  return Math.max(-20, Math.min(80, raw * 0.35))
}
const toComposeProjectionAnnualRatePct = (rawPct) => {
  const raw = Number(rawPct)
  if (!Number.isFinite(raw)) return null
  // More conservative mapping for long-horizon UX readability.
  return Math.max(-8, Math.min(20, raw * 0.12))
}
const OPTIMIZER_COLORS = ['#38bdf8', '#34d399', '#fb923c']
const SAFE_DIVISOR = 1e-9
const MIN_WEIGHT_FOR_3FUND_OPTIMIZATION = 10
const normalizeRange = (value, min, max) => {
  if (!Number.isFinite(value)) return 0
  const span = Math.max(SAFE_DIVISOR, Number(max) - Number(min))
  return Math.max(0, Math.min(1, (Number(value) - Number(min)) / span))
}

const expandCollapsedRange = (minValue, maxValue, fallbackPad = 1) => {
  const min = Number(minValue)
  const max = Number(maxValue)
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: fallbackPad }
  }
  if (Math.abs(max - min) > SAFE_DIVISOR) {
    return { min, max }
  }
  const center = min
  const pad = Math.max(fallbackPad, Math.abs(center) * 0.08)
  return {
    min: center - pad,
    max: center + pad,
  }
}
const isBondLikeCategory = (category = '') => String(category || '').includes('債券')
const isReitLikeCategory = (category = '') => String(category || '').toUpperCase().includes('REIT')
const estimateCorrelation = (a, b) => {
  if (!a || !b) return 0.35
  const aCat = String(a.category || '')
  const bCat = String(b.category || '')
  if (a.id === b.id) return 1
  if (aCat === bCat) return 0.82
  if (isBondLikeCategory(aCat) && isBondLikeCategory(bCat)) return 0.6
  if (isBondLikeCategory(aCat) || isBondLikeCategory(bCat)) return 0.2
  if (isReitLikeCategory(aCat) || isReitLikeCategory(bCat)) return 0.45
  return 0.65
}
const normalizeWeightVector = (weights = []) => {
  const sanitized = weights.map((w) => Math.max(0, Number(w) || 0))
  const sum = sanitized.reduce((acc, cur) => acc + cur, 0)
  if (sum <= 0) {
    const equal = sanitized.length > 0 ? 100 / sanitized.length : 0
    return sanitized.map(() => equal)
  }
  return sanitized.map((w) => (w / sum) * 100)
}
const generateWeightCombos = (count, step = 5) => {
  if (count <= 1) return [[100]]
  if (count === 2) {
    const out = []
    for (let w1 = 0; w1 <= 100; w1 += step) out.push([w1, 100 - w1])
    return out
  }
  if (count === 3) {
    const out = []
    for (let w1 = 0; w1 <= 100; w1 += step) {
      for (let w2 = 0; w2 <= 100 - w1; w2 += step) {
        const w3 = 100 - w1 - w2
        out.push([w1, w2, w3])
      }
    }
    return out
  }
  return []
}
const calcPortfolioMetrics = (funds, weightPctVector) => {
  const weights = normalizeWeightVector(weightPctVector).map((w) => w / 100)
  let ret = 0
  let fee = 0
  for (let i = 0; i < funds.length; i += 1) {
    ret += weights[i] * Number(funds[i].expectedReturn || 0)
    fee += weights[i] * Number(funds[i].trustFee || 0)
  }
  let variance = 0
  for (let i = 0; i < funds.length; i += 1) {
    for (let j = 0; j < funds.length; j += 1) {
      const corr = estimateCorrelation(funds[i], funds[j])
      variance += weights[i] * weights[j] * Number(funds[i].riskStd || 0) * Number(funds[j].riskStd || 0) * corr
    }
  }
  const risk = Math.sqrt(Math.max(0, variance))
  const hhi = weights.reduce((acc, w) => acc + (w * w), 0)
  const n = Math.max(1, funds.length)
  const minHHI = 1 / n
  const concentration = (hhi - minHHI) / Math.max(SAFE_DIVISOR, 1 - minHHI)
  const diversification = Math.max(0, Math.min(1, 1 - concentration))
  const minWeightPct = Math.min(...weights.map((w) => w * 100))
  const netReturnAfterFee = ret - (fee * 3.2)
  const efficiency = netReturnAfterFee / Math.max(SAFE_DIVISOR, risk)
  return {
    risk,
    ret,
    fee,
    weightsPct: weights.map((w) => w * 100),
    diversification,
    minWeightPct,
    netReturnAfterFee,
    efficiency,
  }
}
const FUND_FAQ_ITEMS = [
  { q: 'この一覧はおすすめ順ですか？', a: 'おすすめではなく、選択した条件と並び替え基準に従って表示されます。' },
  { q: '表示されるデータはいつ更新されますか？', a: '中間データ事業者経由で取得可能な最新データを定期取得して表示します。' },
  { q: 'ここで購入できますか？', a: '購入は外部の公式チャネルで行われます。当ページは比較・検討支援が目的です。' },
]
export default function FundPage({ user: _user, myWatchlist = [], toggleWatchlist: propToggleWatchlist, onUiMessage = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeSubFilter, setActiveSubFilter] = useState('all')
  const [nisaQuickFilter, setNisaQuickFilter] = useState('all')
  const [dbFunds, setDbFunds] = useState([])
  const [selectedFundIds, setSelectedFundIds] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem(FUND_PAGE_UI_STATE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed?.selectedFundIds)) return parsed.selectedFundIds.slice(0, 3)
        }
      }
    } catch {}
    return []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [fetchedDateLabel, setFetchedDateLabel] = useState(
    () => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  )
  const [watchlist, setWatchlist] = useState(() => (Array.isArray(myWatchlist) ? myWatchlist : []))
  const [currentPage, setCurrentPage] = useState(1)
  const lastTrackedSearchRef = useRef('')
  const fundRandomKeysRef = useRef(new Map())
  const [sortConfig, setSortConfig] = useState({ key: 'random', direction: 'descending' })
  const [hoveredBubbleId, setHoveredBubbleId] = useState(null)
  const [bubbleViewMode, setBubbleViewMode] = useState('top_30')
  const [isHydrating, setIsHydrating] = useState(false)
  const [miniScheme, setMiniScheme] = useState('nisa')
  const [miniMonthlyMan, setMiniMonthlyMan] = useState(1)
  const [miniCurrentAge, setMiniCurrentAge] = useState(30)
  const [miniAnnualRate, setMiniAnnualRate] = useState(5)
  const [miniWidgetOpen, setMiniWidgetOpen] = useState(false)
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false)
  const [isComposeLimitModalOpen, setIsComposeLimitModalOpen] = useState(false)
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
  const [composeInitialYen, setComposeInitialYen] = useState(1000000)
  const [composeMonthlyYen, setComposeMonthlyYen] = useState(30000)
  const [optimizerWeightsByFundId, setOptimizerWeightsByFundId] = useState({})
  const pendingOptimizerWeightsFromWatchSet = useRef(null)
  const pendingTop3OptimizerRef = useRef(false)
  const hasHydratedUiStateRef = useRef(false)
  const selectedFundIdsOnComposeOpenRef = useRef([])
  const prevComposeModalOpenRef = useRef(false)
  const isLoggedIn = Boolean(_user?.id)
  const promptLogin = () => {
    navigate('/login', { state: { from: `${location.pathname}${location.search}` } })
    window.setTimeout(() => {
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }, 120)
  }

  useEffect(() => {
    if (!isLoggedIn && bubbleViewMode === 'watchlist') {
      setBubbleViewMode('top_30')
    }
  }, [isLoggedIn, bubbleViewMode])

  useEffect(() => {
    const qsSearch = String(searchParams.get('q') || searchParams.get('search') || '').trim()
    const qsFilter = String(searchParams.get('filter') || '').trim()
    const qsSub = String(searchParams.get('sub') || '').trim()
    const qsNisa = String(searchParams.get('nisa') || '').trim()
    const qsPage = Number(searchParams.get('page'))
    const qsSort = String(searchParams.get('sort') || '').trim()
    const qsDirRaw = String(searchParams.get('dir') || '').trim().toLowerCase()
    const qsDir = qsDirRaw === 'ascending' ? 'ascending' : (qsDirRaw === 'descending' ? 'descending' : '')

    const hasQueryState = Boolean(qsSearch || qsFilter || qsSub || qsNisa || Number.isFinite(qsPage) || qsSort || qsDir)

    if (hasQueryState) {
      if (qsSearch) setSearchTerm(qsSearch)
      if (qsFilter) setActiveFilter(qsFilter)
      if (qsSub) setActiveSubFilter(qsSub)
      if (qsNisa) setNisaQuickFilter(qsNisa)
      if (Number.isFinite(qsPage) && qsPage >= 1) setCurrentPage(Math.floor(qsPage))
      if (qsSort) {
        setSortConfig({
          key: qsSort,
          direction: qsDir || 'descending',
        })
      }
    }

    // always restore selectedFundIds from sessionStorage (never in URL)
    try {
      if (typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem(FUND_PAGE_UI_STATE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed?.selectedFundIds)) {
            setSelectedFundIds(parsed.selectedFundIds.slice(0, 3))
          }
        }
      }
    } catch {
      // ignore
    }

    if (!hasQueryState) {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem(FUND_PAGE_UI_STATE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (typeof parsed?.searchTerm === 'string') setSearchTerm(parsed.searchTerm)
          if (typeof parsed?.activeFilter === 'string') setActiveFilter(parsed.activeFilter)
          if (typeof parsed?.activeSubFilter === 'string') setActiveSubFilter(parsed.activeSubFilter)
          if (typeof parsed?.nisaQuickFilter === 'string') setNisaQuickFilter(parsed.nisaQuickFilter)
          const parsedPage = Number(parsed?.currentPage)
          if (Number.isFinite(parsedPage) && parsedPage >= 1) setCurrentPage(Math.floor(parsedPage))
          if (parsed?.sortConfig && typeof parsed.sortConfig === 'object') {
            const key = String(parsed.sortConfig.key || '')
            const direction = parsed.sortConfig.direction === 'ascending' ? 'ascending' : 'descending'
            if (key) {
              const migrated =
                key === 'returnRate1Y' && direction === 'descending'
                  ? { key: 'random', direction: 'descending' }
                  : { key, direction }
              setSortConfig(migrated)
            }
          }
        }
      }
    } catch {
      // ignore malformed persisted UI state
    }
    }

    hasHydratedUiStateRef.current = true
  }, [searchParams])
  const selectedFundIdsRef = useRef(selectedFundIds)
  selectedFundIdsRef.current = selectedFundIds

  useEffect(() => {
    if (!hasHydratedUiStateRef.current) return
    try {
      if (typeof window === 'undefined') return
      window.sessionStorage.setItem(FUND_PAGE_UI_STATE_KEY, JSON.stringify({
        searchTerm,
        activeFilter,
        activeSubFilter,
        nisaQuickFilter,
        currentPage,
        sortConfig,
        selectedFundIds,
      }))
    } catch {
      // ignore storage errors
    }
  }, [searchTerm, activeFilter, activeSubFilter, nisaQuickFilter, currentPage, sortConfig, selectedFundIds])

  useEffect(() => {
    return () => {
      try {
        if (typeof window === 'undefined') return
        const current = selectedFundIdsRef.current
        const raw = window.sessionStorage.getItem(FUND_PAGE_UI_STATE_KEY)
        const stored = raw ? JSON.parse(raw) : {}
        stored.selectedFundIds = Array.isArray(current) ? current.slice(0, 3) : []
        window.sessionStorage.setItem(FUND_PAGE_UI_STATE_KEY, JSON.stringify(stored))
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (!hasHydratedUiStateRef.current) return
    const next = new URLSearchParams()
    if (searchTerm) next.set('q', searchTerm)
    if (activeFilter && activeFilter !== 'all') next.set('filter', activeFilter)
    if (activeSubFilter && activeSubFilter !== 'all') next.set('sub', activeSubFilter)
    if (nisaQuickFilter && nisaQuickFilter !== 'all') next.set('nisa', nisaQuickFilter)
    if (Number(currentPage) > 1) next.set('page', String(currentPage))
    const isDefaultRandomSort = sortConfig?.key === 'random' && sortConfig?.direction === 'descending'
    if (sortConfig?.key && !isDefaultRandomSort) next.set('sort', String(sortConfig.key))
    if (sortConfig?.direction && sortConfig.direction !== 'descending') next.set('dir', String(sortConfig.direction))

    const prevString = searchParams.toString()
    const nextString = next.toString()
    if (prevString === nextString) return
    setSearchParams(next, { replace: true })
  }, [
    activeFilter,
    activeSubFilter,
    currentPage,
    nisaQuickFilter,
    searchParams,
    searchTerm,
    setSearchParams,
    sortConfig,
  ])

  const [watchSetName, setWatchSetName] = useState('')
  const [savedWatchSets, setSavedWatchSets] = useState(() => {
    return loadFundOptimizerWatchsets()
  })

  // Supabase에서 세트 로드 (iOS 포함 크로스 디바이스 동기화)
  useEffect(() => {
    const userId = _user?.id
    if (!userId) return
    let cancelled = false
    loadFundOptimizerWatchsetsFromDb(userId)
      .then(({ data, available }) => {
        if (cancelled || !available || !data) return
        setSavedWatchSets(data)
        saveFundOptimizerWatchsets(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [_user?.id])
  const [freeOptimizerRunsUsed, setFreeOptimizerRunsUsed] = useState(0)
  const planTier = String(
    _user?.app_metadata?.plan_tier
    || _user?.user_metadata?.plan_tier
    || _user?.app_metadata?.membership_tier
    || _user?.user_metadata?.membership_tier
    || '',
  ).toLowerCase()
  const userEmailLower = String(_user?.email || '').trim().toLowerCase()
  const isPaidMember = isPaidPlanTier(planTier) || PREMIUM_EMAIL_ALLOWLIST.has(userEmailLower)
  const freeOptimizerRunsRemaining = Math.max(0, FREE_FUND_OPTIMIZER_RUNS_PER_MONTH - freeOptimizerRunsUsed)

  const getOptimizerMonthKey = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const getOptimizerUsageKey = (userId) => `${String(userId || 'guest')}:${getOptimizerMonthKey()}`
  const readMonthlyOptimizerUsage = (userId = _user?.id) => {
    try {
      if (typeof window === 'undefined') return 0
      const raw = window.localStorage.getItem(FUND_OPTIMIZER_MONTHLY_USAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      // New format: "<userId>:YYYY-MM" -> count
      const userScopedRaw = parsed?.[getOptimizerUsageKey(userId)]
      if (userScopedRaw != null) {
        const userScoped = Number(userScopedRaw)
        if (Number.isFinite(userScoped)) return Math.max(0, Math.floor(userScoped))
      }
      // Legacy fallback: "YYYY-MM" -> count (shared across users)
      const legacy = Number(parsed?.[getOptimizerMonthKey()] || 0)
      return Number.isFinite(legacy) ? Math.max(0, Math.floor(legacy)) : 0
    } catch {
      return 0
    }
  }
  const consumeMonthlyOptimizerUsage = (userId = _user?.id) => {
    try {
      if (typeof window === 'undefined') return 0
      const raw = window.localStorage.getItem(FUND_OPTIMIZER_MONTHLY_USAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      const key = getOptimizerUsageKey(userId)
      const nextUsed = Math.max(0, Math.floor(Number(parsed?.[key] || 0))) + 1
      parsed[key] = nextUsed
      window.localStorage.setItem(FUND_OPTIMIZER_MONTHLY_USAGE_KEY, JSON.stringify(parsed))
      return nextUsed
    } catch {
      return readMonthlyOptimizerUsage(userId)
    }
  }
  useEffect(() => {
    if (isPaidMember) {
      setFreeOptimizerRunsUsed(0)
      return
    }
    setFreeOptimizerRunsUsed(readMonthlyOptimizerUsage(_user?.id))
  }, [isPaidMember, _user?.id])

  const itemsPerPage = 12
  const pageGroupSize = 6
  const toggleWatchlist = typeof propToggleWatchlist === 'function'
    ? propToggleWatchlist
    : (id) => setWatchlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const effectiveWatchlist = Array.isArray(myWatchlist) && myWatchlist.length > 0 ? myWatchlist : watchlist
  const syncFundsToMyWatchlist = (fundRows = []) => {
    if (typeof toggleWatchlist !== 'function') return
    const currentIds = new Set(Array.isArray(effectiveWatchlist) ? effectiveWatchlist : [])
    fundRows.forEach((fund) => {
      const id = String(fund?.id || '').trim()
      if (!id || currentIds.has(id)) return
      toggleWatchlist(id, {
        name: fund?.fundName || id,
        change: Number(fund?.returnRate1Y || 0),
      })
      currentIds.add(id)
    })
  }
  const miniYearsTo60 = Math.max(1, 60 - Number(miniCurrentAge || 30))
  const miniProjection = useMemo(() => {
    const years = Math.max(1, miniYearsTo60)
    const months = years * 12
    const monthlyYen = Math.max(0, Number(miniMonthlyMan) || 0) * 10000
    const annualRatePct = Math.max(0, Number(miniAnnualRate) || 0)
    const principal = monthlyYen * months
    const monthlyRate = annualRatePct / 100 / 12
    const futureValue = monthlyRate > 0
      ? monthlyYen * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      : principal
    const taxBenefit = miniScheme === 'ideco'
      ? Math.floor(monthlyYen * 12 * 0.2 * years)
      : 0
    const projectedTotal = Math.floor(futureValue + taxBenefit)
    const gain = Math.max(0, projectedTotal - principal)
    const totalReturnPct = principal > 0 ? (gain / principal) * 100 : 0
    return {
      principal: Math.floor(principal),
      projectedTotal,
      gain,
      taxBenefit,
      totalReturnPct,
    }
  }, [miniYearsTo60, miniMonthlyMan, miniAnnualRate, miniScheme])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      if (Array.isArray(FUND_PAGE_BOOTSTRAP_CACHE) && FUND_PAGE_BOOTSTRAP_CACHE.length > 0) {
        setDbFunds(FUND_PAGE_BOOTSTRAP_CACHE)
        setIsLoading(false)
      }
      const cachedFunds = readFundPageCache()
      const staleFunds = readStaleFundPageCache()
      let hasRenderedBase = false
      const hasValidReturn = (f) => f?.returnRate1Y != null && f.returnRate1Y !== '' && Number.isFinite(Number(f.returnRate1Y))
      if (Array.isArray(cachedFunds) && cachedFunds.length > 0) {
        setDbFunds(cachedFunds.filter(hasValidReturn))
        setIsLoading(false)
      } else if (Array.isArray(staleFunds) && staleFunds.length > 0) {
        setDbFunds(staleFunds.filter(hasValidReturn))
        setIsLoading(false)
      } else {
        setIsLoading(true)
      }
      setIsHydrating(true)
      setFetchedDateLabel(new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
      try {
        const etfSymbols = ETF_SYMBOLS_FROM_XLSX
        const latestBatches = []
        for (let i = 0; i < etfSymbols.length; i += 80) {
          latestBatches.push(etfSymbols.slice(i, i + 80))
        }
        const symbolPromise = supabase
          .from('stock_symbols')
          .select('symbol,name,exchange,trust_fee,nisa_category,aum,category,subcategory,country')
          .in('symbol', etfSymbols)
        const latestPromises = latestBatches.map((batch) =>
          supabase
            .from('v_stock_latest')
            .select('symbol,trade_date,open,close,volume')
            .in('symbol', batch)
        )
        const [symbolRes, ...latestResults] = await Promise.all([symbolPromise, ...latestPromises])
        const { data: symbolRows, error: symbolErr } = symbolRes
        if (symbolErr) throw symbolErr
        const latestRows = (latestResults || []).flatMap((r) => r?.data || [])

        let formattedFunds = []

        const symbolMap = new Map((symbolRows || []).map((row) => [row.symbol, row]))
        const latestMap = new Map(
          (latestRows || [])
            .map((row) => ({ ...row, _norm: normalizeSymbolFromApi(row.symbol) }))
            .filter((row) => TARGET_ETF_SYMBOL_SET.has(row._norm))
            .map((row) => [row._norm, { ...row, symbol: row._norm }])
        )
        const baseFunds = [...latestMap.keys()].map((symbol) => {
          const row = latestMap.get(symbol) || {}
          const meta = symbolMap.get(symbol) || {}
          const open = Number(row.open || 0)
          const close = Number(row.close || 0)
          const return1d = open > 0 ? ((close - open) / open) * 100 : 0
          const etfMeta = TARGET_ETF_META_MAP.get(symbol)
          const trustFeeValue = Number.isFinite(Number(meta.trust_fee)) ? Number(meta.trust_fee) : Number(etfMeta?.trustFee)
          const normalizedNisaCategory = normalizeNisaCategoryField(meta.nisa_category || etfMeta?.nisaCategory)
          const displayName = normalizeFundDisplayName(etfMeta?.jpName || getEtfJpName(symbol) || meta.name || symbol)
          const displayCategory = meta.category ? mapDbCategoryToDisplay(meta.category) : detectEtfCategory(symbol, displayName)
          const marketCountry = meta.country || inferExposureCountry(symbol, displayName)
          const { assetClassId, subCategoryId } = detectAssetClassAndSubCategory(symbol, displayName, displayCategory, marketCountry, etfMeta?.isin, meta)
          const riskLvl = calculateRiskFromReturn(Number(return1d || 0), displayCategory)
          const aumValue = Number.isFinite(Number(meta.aum))
            ? Number(meta.aum)
            : Number(etfMeta?.aum)

          return {
            id: symbol,
            fundName: displayName,
            isin: etfMeta?.isin || '-',
            fundCode: symbol,
            category: displayCategory,
            marketRegion: symbol.endsWith('.T') ? 'JP' : 'GLOBAL',
            marketCountry,
            managementCompany: meta.exchange || '中間データ事業者',
            assetClassId,
            assetClassLabel: ASSET_CLASS_LABELS[assetClassId] || 'その他',
            subCategoryId,
            subCategoryLabel: STOCK_SUBCATEGORY_LABELS[subCategoryId] || BOND_SUBCATEGORY_LABELS[subCategoryId] || '-',
            trustFee: Number.isFinite(trustFeeValue) ? trustFeeValue : null,
            nisaCategory: normalizedNisaCategory,
            returnRate1Y: null,
            returnRate3M: null,
            returnRate1M: null,
            aumValue: Number.isFinite(aumValue) && aumValue > 0 ? aumValue : null,
            annualReturnDisplay: '-',
            aumDisplay: formatAum(aumValue),
            riskLevel: riskLvl,
            stdDev: null,
            basePrice: close,
            prevComparison: close - open,
            prevComparisonPercent: Number(return1d || 0).toFixed(2),
            minInvest: 1,
            flowScore: null,
            sharpe: null,
            tradeDate: row.trade_date || null,
          }
        })
        // First paint fast: render with latest snapshot first, then hydrate 1Y history metrics.
        if (!hasRenderedBase && baseFunds.length > 0) {
          setDbFunds(baseFunds)
          FUND_PAGE_BOOTSTRAP_CACHE = baseFunds
          setIsLoading(false)
          hasRenderedBase = true
        }

        const sortedSymbolsByVolume = [...latestMap.values()]
          .sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0))
          .map((row) => row.symbol)
        const etfSymbolsFromLatest = [...new Set(sortedSymbolsByVolume)]
        const cutoff = new Date()
        cutoff.setFullYear(cutoff.getFullYear() - 1)
        const cutoffStr = cutoff.toISOString().slice(0, 10)

        const MAX_SYMBOLS_FOR_HISTORY = 999
        const symbolsForHistory = etfSymbolsFromLatest.slice(0, MAX_SYMBOLS_FOR_HISTORY)
        // Batched multi-symbol queries + pagination (avoids ~1 HTTP round-trip per symbol).
        const historyBySymbol = await fetchStockDailyHistoryBySymbolMap(supabase, symbolsForHistory, cutoffStr, {
          jpDedupe: true,
          jpSourceFilter: null,
          jpChunkSize: 22,
          nonJpChunkSize: 32,
          parallelChunks: 10,
        })

        formattedFunds = [...latestMap.keys()].map((symbol) => {
              const row = latestMap.get(symbol) || {}
              const meta = symbolMap.get(symbol) || {}
              const symbolHistory = historyBySymbol.get(symbol) || []
              const adjustedClosesRaw = buildSplitAdjustedCloses(symbolHistory, {
                skipSplitHeuristic: skipEodSplitHeuristicForSymbol(symbol),
              })
              const closes = adjustedClosesRaw.filter((v) => Number.isFinite(v) && v > 0)
              const { close, sessionDod } = resolveSpotCloseAndSessionChange(symbolHistory, adjustedClosesRaw, row)
              const volumes = symbolHistory.map((r) => Number(r.volume)).filter((v) => Number.isFinite(v) && v >= 0)
              const historyCount = closes.length
              const oneYearBaseClose = findBaseCloseByCalendarOffset(symbolHistory, { years: 1 }, adjustedClosesRaw)
              const threeMonthBaseClose = findBaseCloseByCalendarOffset(symbolHistory, { months: 3 }, adjustedClosesRaw)
              const closeLookback = findBaseCloseByCalendarOffset(symbolHistory, { months: 1 }, adjustedClosesRaw)
              const return1d = Number.isFinite(sessionDod.changePct) ? sessionDod.changePct : 0
              const firstTradeDateRaw = symbolHistory[0]?.trade_date
              const latestTradeDateRaw = symbolHistory[Math.max(0, symbolHistory.length - 1)]?.trade_date
              const firstTradeDate = firstTradeDateRaw ? new Date(firstTradeDateRaw) : null
              const latestTradeDate = latestTradeDateRaw ? new Date(latestTradeDateRaw) : null
              const historySpanDays = (
                firstTradeDate
                && latestTradeDate
                && Number.isFinite(firstTradeDate.getTime())
                && Number.isFinite(latestTradeDate.getTime())
              )
                ? Math.floor((latestTradeDate.getTime() - firstTradeDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0
              const hasReliableOneYearHistory = historyCount >= 2 && historySpanDays >= 330
              const hasReliableThreeMonthHistory = historyCount >= 2 && historySpanDays >= 90
              const hasReliableOneMonthHistory = historyCount >= 2 && historySpanDays >= 25
              const return1y = hasReliableOneYearHistory && oneYearBaseClose != null && oneYearBaseClose > 0
                ? ((close - oneYearBaseClose) / oneYearBaseClose) * 100
                : null
              const return3m = hasReliableThreeMonthHistory && threeMonthBaseClose != null && threeMonthBaseClose > 0
                ? ((close - threeMonthBaseClose) / threeMonthBaseClose) * 100
                : null
              const return1m = closeLookback != null && closeLookback > 0 ? ((close - closeLookback) / closeLookback) * 100 : null
              const return1mRank = hasReliableOneMonthHistory && Number.isFinite(return1m) ? Number(return1m) : null
              const etfMeta = TARGET_ETF_META_MAP.get(symbol)
              const trustFeeValue = Number.isFinite(Number(meta.trust_fee)) ? Number(meta.trust_fee) : Number(etfMeta?.trustFee)
              const normalizedNisaCategory = normalizeNisaCategoryField(meta.nisa_category || etfMeta?.nisaCategory)
              const displayName = normalizeFundDisplayName(etfMeta?.jpName || getEtfJpName(symbol) || meta.name || symbol)
              const displayCategory = meta.category ? mapDbCategoryToDisplay(meta.category) : detectEtfCategory(symbol, displayName)
              const marketCountry = meta.country || inferExposureCountry(symbol, displayName)
              const { assetClassId, subCategoryId } = detectAssetClassAndSubCategory(symbol, displayName, displayCategory, marketCountry, etfMeta?.isin, meta)
              const realizedVol = calculateRealizedVolatility(closes)
              const riskLvl = calculateRiskFromReturn(Number(return1y || return1d || 0), displayCategory)
              const stdDev = Number.isFinite(realizedVol) && realizedVol > 0 ? realizedVol : null
              const avgVol5 = volumes.length > 0
                ? volumes.slice(-5).reduce((acc, cur) => acc + cur, 0) / Math.min(5, volumes.length)
                : 0
              const avgVol30 = volumes.length > 0
                ? volumes.slice(-30).reduce((acc, cur) => acc + cur, 0) / Math.min(30, volumes.length)
                : Math.max(0, Number(row.volume || 0))
              const volumeMomentum = avgVol30 > 0 ? ((avgVol5 - avgVol30) / avgVol30) * 100 : 0
              const aumValue = Number.isFinite(Number(meta.aum))
                ? Number(meta.aum)
                : Number(etfMeta?.aum)
              const flowScore = Number.isFinite(return1m) && historyCount >= 6
                ? ((return1m * 0.7) + (volumeMomentum * 0.3))
                : null
              const yearStartStr = `${new Date().getFullYear()}-01-01`
              const ytdFirstIdx = symbolHistory.findIndex((r) => String(r?.trade_date || '') >= yearStartStr)
              const ytdBaseClose = ytdFirstIdx >= 0 ? Number(adjustedClosesRaw[ytdFirstIdx] ?? symbolHistory[ytdFirstIdx]?.close ?? 0) : null
              const returnYTD = (ytdBaseClose != null && ytdBaseClose > 0 && close > 0)
                ? ((close - ytdBaseClose) / ytdBaseClose) * 100
                : null

          return {
                id: symbol,
                fundName: displayName,
                isin: etfMeta?.isin || '-',
                fundCode: symbol,
            category: displayCategory,
                marketRegion: symbol.endsWith('.T') ? 'JP' : 'GLOBAL',
                marketCountry,
                managementCompany: meta.exchange || '中間データ事業者',
            assetClassId,
            assetClassLabel: ASSET_CLASS_LABELS[assetClassId] || 'その他',
            subCategoryId,
            subCategoryLabel: STOCK_SUBCATEGORY_LABELS[subCategoryId] || BOND_SUBCATEGORY_LABELS[subCategoryId] || '-',
                trustFee: Number.isFinite(trustFeeValue) ? trustFeeValue : null,
                nisaCategory: normalizedNisaCategory,
                returnRate1Y: Number.isFinite(return1y) ? Number(return1y) : null,
                returnRate3M: Number.isFinite(return3m) ? Number(return3m) : null,
                returnRate1M: Number.isFinite(return1mRank) ? return1mRank : null,
                aumValue: Number.isFinite(aumValue) && aumValue > 0 ? aumValue : null,
                annualReturnDisplay: Number.isFinite(return1y)
                  ? `${return1y > 0 ? '+' : ''}${Number(return1y).toFixed(1)}%`
                  : '-',
                aumDisplay: formatAum(aumValue),
            riskLevel: riskLvl,
            stdDev,
                basePrice: close,
                prevComparison: Number.isFinite(sessionDod.change) ? sessionDod.change : 0,
                prevComparisonPercent: Number(return1d || 0).toFixed(2),
                minInvest: 1,
                flowScore,
                sharpe: (Number.isFinite(return1y) && Number.isFinite(stdDev) && stdDev > 0)
                  ? Number((Number(return1y) / stdDev).toFixed(2))
                  : null,
                tradeDate: row.trade_date || null,
                returnYTD: Number.isFinite(returnYTD) ? Number(returnYTD) : null,
              }
            })

        const funds = formattedFunds.filter((f) => f.returnRate1Y != null && f.returnRate1Y !== '' && Number.isFinite(Number(f.returnRate1Y)))
        const sortedFunds = [...funds].sort((a, b) => Number(b.returnRate1Y || -999) - Number(a.returnRate1Y || -999))
        if (cancelled) return
        setDbFunds(sortedFunds)
        FUND_PAGE_BOOTSTRAP_CACHE = sortedFunds
        writeFundPageCache(sortedFunds)
      } catch (error) {
        console.error('Error fetching data:', error.message)
        if (!cancelled && !(Array.isArray(cachedFunds) && cachedFunds.length > 0) && !hasRenderedBase) {
          setDbFunds([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setIsHydrating(false)
        }
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [])

  const filteredFunds = useMemo(() => {
    let result = dbFunds
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter(
        (fund) =>
          (fund.fundName || '').toLowerCase().includes(lowerTerm) ||
          (fund.fundCode || '').toLowerCase().includes(lowerTerm) ||
          (fund.isin || '').toLowerCase().includes(lowerTerm)
      )
    }
    if (activeFilter !== 'all') {
      if (activeFilter === 'watchlist') {
        result = result.filter((f) => Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(f.id))
      } else {
        result = result.filter((f) => (f.assetClassId || 'stock') === activeFilter)
      }
    }
    if (activeSubFilter !== 'all') {
      result = result.filter((f) => (f.subCategoryId || '') === activeSubFilter)
    }
    if (nisaQuickFilter !== 'all') {
      if (nisaQuickFilter === 'unknown') {
        result = result.filter((f) => !f.nisaCategory || f.nisaCategory === '-')
      } else if (nisaQuickFilter === '成長投資枠') {
        result = result.filter((f) => (f.nisaCategory || '').includes('成長投資枠') || (f.nisaCategory || '').includes('成長'))
      } else if (nisaQuickFilter === 'つみたて投資枠') {
        result = result.filter((f) => (f.nisaCategory || '').includes('つみたて'))
      } else if (nisaQuickFilter === '対象外') {
        result = result.filter((f) => (f.nisaCategory || '').includes('対象外'))
      } else {
        result = result.filter((f) => (f.nisaCategory || '').includes(nisaQuickFilter))
      }
    }
    return result
  }, [searchTerm, activeFilter, activeSubFilter, nisaQuickFilter, dbFunds, effectiveWatchlist])

  useEffect(() => {
    const query = String(searchTerm || '').trim()
    if (query.length < 2) return undefined

    const timer = window.setTimeout(() => {
      const signature = `${query.toLowerCase()}::${filteredFunds.length}::${activeFilter}::${activeSubFilter}::${nisaQuickFilter}`
      if (lastTrackedSearchRef.current === signature) return
      lastTrackedSearchRef.current = signature
      trackAnalyticsEvent('search', {
        surface: 'fund_page',
        query,
        result_count: filteredFunds.length,
        active_filter: activeFilter,
        sub_filter: activeSubFilter,
        nisa_filter: nisaQuickFilter,
      })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [searchTerm, filteredFunds.length, activeFilter, activeSubFilter, nisaQuickFilter])

  const assetClassFilterOptions = useMemo(() => {
    const keys = ['stock', 'bond', 'commodity', 'reit']
    const counts = Object.fromEntries(keys.map((k) => [k, 0]))
    dbFunds.forEach((f) => {
      const key = String(f.assetClassId || 'stock')
      if (counts[key] != null) counts[key] += 1
    })
    return keys.map((id) => ({ id, label: ASSET_CLASS_LABELS[id], count: counts[id] || 0 })).filter((opt) => opt.count > 0)
  }, [dbFunds])

  const subCategoryFilterOptions = useMemo(() => {
    if (activeFilter === 'stock') {
      const ids = Object.keys(STOCK_SUBCATEGORY_LABELS)
      const counts = Object.fromEntries(ids.map((id) => [id, 0]))
      dbFunds
        .filter((f) => (f.assetClassId || 'stock') === 'stock')
        .forEach((f) => {
          const sid = String(f.subCategoryId || '')
          if (counts[sid] != null) counts[sid] += 1
        })
      return ids.map((id) => ({ id, label: STOCK_SUBCATEGORY_LABELS[id], count: counts[id] || 0 })).filter((opt) => opt.count > 0)
    }
    if (activeFilter === 'bond') {
      const ids = Object.keys(BOND_SUBCATEGORY_LABELS)
      const counts = Object.fromEntries(ids.map((id) => [id, 0]))
      dbFunds
        .filter((f) => (f.assetClassId || 'stock') === 'bond')
        .forEach((f) => {
          const sid = String(f.subCategoryId || '')
          if (counts[sid] != null) counts[sid] += 1
        })
      return ids.map((id) => ({ id, label: BOND_SUBCATEGORY_LABELS[id], count: counts[id] || 0 })).filter((opt) => opt.count > 0)
    }
    return []
  }, [dbFunds, activeFilter])

  const nisaDisplayLabel = (raw) => {
    const s = String(raw || '').trim()
    if (!s || s === '-') return '未設定'
    if (s.includes('対象外')) return '対象外'
    if (s.includes('つみたて') && s.includes('成長')) return 'つみたて・成長'
    if (s.includes('つみたて')) return 'つみたて'
    if (s.includes('成長投資枠') || s.includes('成長')) return '成長'
    return s
  }

  const nisaQuickFilterOptions = useMemo(() => {
    const normalized = dbFunds.map((f) => String(f.nisaCategory || '').trim()).filter(Boolean)
    const byKeyword = (...keywords) => normalized.filter((v) => keywords.some((keyword) => v.includes(keyword))).length
    const unknownCount = dbFunds.length - normalized.length
    return [
      { id: 'all', label: 'NISAすべて', count: dbFunds.length },
      { id: 'つみたて投資枠', label: 'つみたて', count: byKeyword('つみたて投資枠', 'つみたて') },
      { id: '成長投資枠', label: '成長', count: byKeyword('成長投資枠', '成長') },
      { id: '対象外', label: '対象外', count: byKeyword('NISA対象外', '対象外') },
      { id: 'unknown', label: '未設定', count: unknownCount },
    ].filter((opt) => opt.id === 'all' || opt.count > 0)
  }, [dbFunds])

  useEffect(() => {
    if (activeFilter === 'all' || activeFilter === 'watchlist') return
    if (!assetClassFilterOptions.some((opt) => opt.id === activeFilter)) {
      setActiveFilter('all')
      setActiveSubFilter('all')
    }
  }, [activeFilter, assetClassFilterOptions])

  useEffect(() => {
    if (activeFilter === 'all' || activeFilter === 'watchlist') {
      if (activeSubFilter !== 'all') setActiveSubFilter('all')
      return
    }
    if (activeSubFilter === 'all') return
    if (!subCategoryFilterOptions.some((opt) => opt.id === activeSubFilter && opt.count > 0)) {
      setActiveSubFilter('all')
    }
  }, [activeFilter, activeSubFilter, subCategoryFilterOptions])

  useEffect(() => {
    if (nisaQuickFilter === 'all') return
    if (!nisaQuickFilterOptions.some((opt) => opt.id === nisaQuickFilter && opt.count > 0)) {
      setNisaQuickFilter('all')
    }
  }, [nisaQuickFilter, nisaQuickFilterOptions])

  const resolvedFilteredFunds = useMemo(() => {
    return filteredFunds.map((fund) => {
      const fallbackMeta = (
        TARGET_ETF_META_MAP.get(fund.id)
        || TARGET_ETF_META_MAP.get(fund.fundCode)
        || TARGET_ETF_META_BY_ISIN_MAP.get(fund.isin)
      )
      const resolvedAum = resolveAumValue(fund, fallbackMeta)
      return {
        ...fund,
        aumValue: resolvedAum,
        aumDisplay: formatAum(resolvedAum),
      }
    })
  }, [filteredFunds])

  const sortedFunds = useMemo(() => {
    const sortableItems = [...resolvedFilteredFunds]
    if (sortConfig.key === 'random') {
      sortableItems.sort(
        (a, b) => randomSortKeyForId(fundRandomKeysRef, a.id) - randomSortKeyForId(fundRandomKeysRef, b.id)
      )
      return sortableItems
    }
    sortableItems.sort((a, b) => compareBySortConfig(a, b, sortConfig))
    return sortableItems
  }, [resolvedFilteredFunds, sortConfig])

  const totalPages = Math.ceil(sortedFunds.length / itemsPerPage) || 1

  useEffect(() => {
    if (isLoading || !hasHydratedUiStateRef.current) return
    setCurrentPage((prev) => Math.min(Math.max(1, prev), totalPages))
  }, [isLoading, totalPages])
  const currentGroupStart = Math.floor((currentPage - 1) / pageGroupSize) * pageGroupSize + 1
  const currentGroupEnd = Math.min(totalPages, currentGroupStart + pageGroupSize - 1)
  const visiblePages = Array.from(
    { length: Math.max(0, currentGroupEnd - currentGroupStart + 1) },
    (_, idx) => currentGroupStart + idx
  )
  const paginatedData = useMemo(() => {
    const first = (currentPage - 1) * itemsPerPage
    return sortedFunds.slice(first, first + itemsPerPage)
  }, [sortedFunds, currentPage])

  const returnLeaders = useMemo(() => {
    const ranked = dbFunds
      .filter((f) => Number.isFinite(Number(f.returnRate1M)))
      .sort((a, b) => Number(b.returnRate1M) - Number(a.returnRate1M))
    const top3 = ranked.slice(0, 3)
    const topIds = new Set(top3.map((f) => f.id))
    const bottom3 = [...ranked]
      .sort((a, b) => Number(a.returnRate1M) - Number(b.returnRate1M))
      .filter((f) => !topIds.has(f.id))
      .slice(0, 3)
    return { top3, bottom3 }
  }, [dbFunds])
  const returnLeaderBarData = useMemo(() => {
    const topRows = returnLeaders.top3.map((fund, idx) => ({
      id: `${fund.id}-top`,
      name: `Top ${idx + 1}`,
      fundName: fund.fundName,
      value: Number(fund.returnRate1M || 0),
      tone: 'top',
    }))
    const bottomRows = returnLeaders.bottom3.map((fund, idx) => ({
      id: `${fund.id}-bottom`,
      name: `Bottom ${idx + 1}`,
      fundName: fund.fundName,
      value: Number(fund.returnRate1M || 0),
      tone: 'bottom',
    }))
    return [...topRows, ...bottomRows]
  }, [returnLeaders])

  const lowFeeLeaders = useMemo(() => {
    return [...dbFunds]
      .filter((f) => Number.isFinite(Number(f.trustFee)) && Number(f.trustFee) >= 0)
      .sort((a, b) => Number(a.trustFee) - Number(b.trustFee))
      .slice(0, 5)
  }, [dbFunds])

  const optimizerSelectedFunds = useMemo(() => (
    selectedFundIds
      .slice(0, 3)
      .map((id) => dbFunds.find((f) => f.id === id))
      .filter(Boolean)
      .map((f, idx) => ({
        ...f,
        color: OPTIMIZER_COLORS[idx] || '#94a3b8',
        expectedReturn: (() => {
          if (Number.isFinite(Number(f.returnRate1Y))) return Number(f.returnRate1Y)
          const r3 = Number(f.returnRate3M)
          if (Number.isFinite(r3)) {
            const fromQuarter = annualizeThreeMonthReturnPct(r3)
            if (fromQuarter != null && Number.isFinite(fromQuarter)) return fromQuarter
          }
          return Math.max(2, Number(f.riskLevel || 2.4) * 2.2)
        })(),
        riskStd: Number.isFinite(Number(f.stdDev))
          ? Number(f.stdDev)
          : Math.max(4, Number(f.riskLevel || 2.5) * 4.4),
        trustFee: Number.isFinite(Number(f.trustFee))
          ? Number(f.trustFee)
          : 0.8,
      }))
  ), [selectedFundIds, dbFunds])

  // オプティマイザの最適配分（イコールではなくスコアベース）を算出（optimizerWeightsByFundId に依存しない）
  const optimizerOptimalWeightsMap = useMemo(() => {
    if (optimizerSelectedFunds.length < 2) return null
    const rawCombos = generateWeightCombos(optimizerSelectedFunds.length, optimizerSelectedFunds.length === 3 ? 5 : 2)
    const constrainedCombos = optimizerSelectedFunds.length === 3
      ? rawCombos.filter((weights) => Math.min(...weights) >= MIN_WEIGHT_FOR_3FUND_OPTIMIZATION)
      : rawCombos
    const combos = constrainedCombos.length > 0 ? constrainedCombos : rawCombos
    const points = combos.map((weights) => {
      const m = calcPortfolioMetrics(optimizerSelectedFunds, weights)
      return { ...m, weightsPct: m.weightsPct }
    })
    const riskValues = points.map((p) => p.risk)
    const retValues = points.map((p) => p.ret)
    const feeValues = points.map((p) => p.fee)
    const netReturnValues = points.map((p) => p.netReturnAfterFee ?? p.ret ?? 0)
    const efficiencyValues = points.map((p) => p.efficiency ?? 0)
    const riskRange = expandCollapsedRange(Math.min(...riskValues), Math.max(...riskValues), 0.8)
    const feeRange = expandCollapsedRange(Math.min(...feeValues), Math.max(...feeValues), 0.03)
    const netReturnRange = { min: Math.min(...netReturnValues), max: Math.max(...netReturnValues) }
    const efficiencyRange = { min: Math.min(...efficiencyValues), max: Math.max(...efficiencyValues) }
    const scored = points.map((p) => {
      const riskNorm = normalizeRange(p.risk, riskRange.min, riskRange.max)
      const feeNorm = normalizeRange(p.fee, feeRange.min, feeRange.max)
      const netRetNorm = normalizeRange(p.netReturnAfterFee ?? p.ret, netReturnRange.min, netReturnRange.max)
      const efficiencyNorm = normalizeRange(p.efficiency, efficiencyRange.min, efficiencyRange.max)
      const diversificationNorm = Number(p.diversification || 0)
      const isThreeFund = optimizerSelectedFunds.length === 3
      const score = isThreeFund
        ? (netRetNorm * 0.3) + (efficiencyNorm * 0.22) + ((1 - riskNorm) * 0.18) + ((1 - feeNorm) * 0.1) + (diversificationNorm * 0.2)
        : (netRetNorm * 0.38) + (efficiencyNorm * 0.24) + ((1 - riskNorm) * 0.23) + ((1 - feeNorm) * 0.15)
      return { ...p, score }
    })
    const best = [...scored].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0]
    if (!best?.weightsPct) return null
    const ids = optimizerSelectedFunds.map((f) => f.id)
    const next = {}
    ids.forEach((id, idx) => { next[id] = Number((best.weightsPct[idx] || 0).toFixed(1)) })
    return next
  }, [optimizerSelectedFunds])

  // デフォルトは最適配分（オプティマイジング済み）。ウォッチセット適用時は保存済み配分を優先。上位3件選択時は最適配分を適用
  useEffect(() => {
    if (optimizerSelectedFunds.length === 0) {
      setOptimizerWeightsByFundId({})
      pendingOptimizerWeightsFromWatchSet.current = null
      pendingTop3OptimizerRef.current = false
      return
    }
    const fromWatchSet = pendingOptimizerWeightsFromWatchSet.current
    if (fromWatchSet && Object.keys(fromWatchSet).length > 0) {
      setOptimizerWeightsByFundId(fromWatchSet)
      pendingOptimizerWeightsFromWatchSet.current = null
      return
    }
    if (pendingTop3OptimizerRef.current) return
    const optimal = optimizerOptimalWeightsMap
    if (optimal && Object.keys(optimal).length > 0) {
      setOptimizerWeightsByFundId(optimal)
      return
    }
    const ids = optimizerSelectedFunds.map((f) => f.id)
    const equalPct = ids.length > 0 ? Number((100 / ids.length).toFixed(1)) : 0
    const next = {}
    ids.forEach((id, idx) => {
      next[id] = idx === ids.length - 1 ? Number((100 - equalPct * (ids.length - 1)).toFixed(1)) : equalPct
    })
    setOptimizerWeightsByFundId(next)
  }, [optimizerSelectedFunds, optimizerOptimalWeightsMap])

  // 構成モーダルを開いたときに最適配分を自動適用（isComposeModalOpen のみを deps にして再実行ループを防止）
  useEffect(() => {
    const wasOpen = prevComposeModalOpenRef.current
    prevComposeModalOpenRef.current = isComposeModalOpen
    if (!wasOpen && isComposeModalOpen && optimizerSelectedFunds.length >= 2 && optimizerFrontier.optimalPoint) {
      const ids = optimizerSelectedFunds.map((f) => f.id)
      const next = {}
      ids.forEach((id, idx) => {
        next[id] = Number((optimizerFrontier.optimalPoint.weightsPct[idx] || 0).toFixed(1))
      })
      setOptimizerWeightsByFundId(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- モーダルオープン時のみ実行したいため
  }, [isComposeModalOpen])

  useEffect(() => {
    if (!isComposeModalOpen) return
    const onKey = (e) => { if (e.key === 'Escape') closeComposeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeComposeModal is stable
  }, [isComposeModalOpen])

  useEffect(() => {
    if (!isCompareModalOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setIsCompareModalOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isCompareModalOpen])

  const optimizerCurrentWeights = useMemo(() => {
    if (optimizerSelectedFunds.length === 0) return []
    const raw = optimizerSelectedFunds.map((f) => Number(optimizerWeightsByFundId[f.id] || 0))
    return normalizeWeightVector(raw)
  }, [optimizerSelectedFunds, optimizerWeightsByFundId])

  const optimizerFrontier = useMemo(() => {
    if (optimizerSelectedFunds.length < 2) {
      return {
        points: [],
        pathPoints: [],
        currentPoint: null,
        optimalPoint: null,
        ranges: null,
      }
    }
    const rawCombos = generateWeightCombos(optimizerSelectedFunds.length, optimizerSelectedFunds.length === 3 ? 5 : 2)
    const constrainedCombos = optimizerSelectedFunds.length === 3
      ? rawCombos.filter((weights) => Math.min(...weights) >= MIN_WEIGHT_FOR_3FUND_OPTIMIZATION)
      : rawCombos
    const combos = constrainedCombos.length > 0 ? constrainedCombos : rawCombos
    const points = combos.map((weights, idx) => {
      const metrics = calcPortfolioMetrics(optimizerSelectedFunds, weights)
      return {
        id: `combo-${idx}`,
        ...metrics,
      }
    })
    const riskValues = points.map((p) => p.risk)
    const retValues = points.map((p) => p.ret)
    const feeValues = points.map((p) => p.fee)
    const riskRange = expandCollapsedRange(Math.min(...riskValues), Math.max(...riskValues), 0.8)
    const retRange = expandCollapsedRange(Math.min(...retValues), Math.max(...retValues), 1.2)
    const feeRange = expandCollapsedRange(Math.min(...feeValues), Math.max(...feeValues), 0.03)
    const ranges = {
      riskMin: riskRange.min,
      riskMax: riskRange.max,
      retMin: retRange.min,
      retMax: retRange.max,
      feeMin: feeRange.min,
      feeMax: feeRange.max,
    }
    const efficiencyValues = points.map((p) => Number(p.efficiency || 0))
    const netReturnValues = points.map((p) => Number(p.netReturnAfterFee || 0))
    const efficiencyRange = {
      min: Math.min(...efficiencyValues),
      max: Math.max(...efficiencyValues),
    }
    const netReturnRange = {
      min: Math.min(...netReturnValues),
      max: Math.max(...netReturnValues),
    }
    const scored = points.map((p) => {
      const retNorm = normalizeRange(p.ret, ranges.retMin, ranges.retMax)
      const riskNorm = normalizeRange(p.risk, ranges.riskMin, ranges.riskMax)
      const feeNorm = normalizeRange(p.fee, ranges.feeMin, ranges.feeMax)
      const netRetNorm = normalizeRange(p.netReturnAfterFee, netReturnRange.min, netReturnRange.max)
      const efficiencyNorm = normalizeRange(p.efficiency, efficiencyRange.min, efficiencyRange.max)
      const diversificationNorm = Number(p.diversification || 0)
      const isThreeFund = optimizerSelectedFunds.length === 3
      // 3펀드 최적화에서는 "한 종목 쏠림"보다 분산된 조합을 우선.
      const score = isThreeFund
        ? (netRetNorm * 0.3) + (efficiencyNorm * 0.22) + ((1 - riskNorm) * 0.18) + ((1 - feeNorm) * 0.1) + (diversificationNorm * 0.2)
        : (netRetNorm * 0.38) + (efficiencyNorm * 0.24) + ((1 - riskNorm) * 0.23) + ((1 - feeNorm) * 0.15)
      return {
        ...p,
        score,
        // debug-friendly extra fields for future tuning without changing UI.
        _retNorm: retNorm,
        _riskNorm: riskNorm,
        _feeNorm: feeNorm,
        _netRetNorm: netRetNorm,
        _efficiencyNorm: efficiencyNorm,
        _diversificationNorm: diversificationNorm,
      }
    })
    const optimalPoint = [...scored].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || null
    const currentPoint = calcPortfolioMetrics(optimizerSelectedFunds, optimizerCurrentWeights)
    const pathPoints = [...scored].sort((a, b) => Number(a.risk || 0) - Number(b.risk || 0))
    return { points: scored, pathPoints, currentPoint, optimalPoint, ranges }
  }, [optimizerSelectedFunds, optimizerCurrentWeights])

  // 上位3件選択時は最適配分を適用（イコールではなくオプティマイジング）
  useEffect(() => {
    if (!pendingTop3OptimizerRef.current || !optimizerFrontier.optimalPoint || optimizerSelectedFunds.length < 2) return
    const ids = optimizerSelectedFunds.map((f) => f.id)
    const next = {}
    ids.forEach((id, idx) => {
      next[id] = Number((optimizerFrontier.optimalPoint.weightsPct[idx] || 0).toFixed(1))
    })
    setOptimizerWeightsByFundId(next)
    pendingTop3OptimizerRef.current = false
  }, [optimizerFrontier.optimalPoint, optimizerSelectedFunds])

  const optimizer5yProjectionCurrent = useMemo(() => {
    const current = optimizerFrontier.currentPoint
    if (!current) return null
    const annualRatePct = toProjectionAnnualRatePct(current.netReturnAfterFee ?? current.ret ?? 0)
    if (!Number.isFinite(annualRatePct)) return null
    return projectFutureValueYen({
      annualRatePct,
      initialYen: 1000000,
      monthlyYen: 30000,
      years: 5,
    })
  }, [optimizerFrontier.currentPoint])
  const composePieData = useMemo(() => (
    optimizerSelectedFunds.map((fund, idx) => ({
      id: fund.id,
      name: fund.fundName,
      value: Number(optimizerCurrentWeights[idx] || 0),
      color: OPTIMIZER_COLORS[idx % OPTIMIZER_COLORS.length],
    }))
  ), [optimizerSelectedFunds, optimizerCurrentWeights])
  const composeGrowthSeries = useMemo(() => {
    const current = optimizerFrontier.currentPoint
    if (!current) return []
    const annualRatePct = toComposeProjectionAnnualRatePct(current.ret ?? 0)
    if (!Number.isFinite(annualRatePct)) return []
    return simulatePortfolioProjectionByYear({
      years: 20,
      initialYen: composeInitialYen,
      monthlyYen: composeMonthlyYen,
      annualReturnPct: annualRatePct,
      annualFeePct: Number(current.fee || 0),
    })
  }, [optimizerFrontier.currentPoint, composeInitialYen, composeMonthlyYen])
  const composeGrowthLast = composeGrowthSeries.length > 0 ? composeGrowthSeries[composeGrowthSeries.length - 1] : null
  const composeAnnualProjectionRate = useMemo(() => {
    const current = optimizerFrontier.currentPoint
    if (!current) return null
    return toComposeProjectionAnnualRatePct(current.ret ?? 0)
  }, [optimizerFrontier.currentPoint])

  const applyOptimizerWeight = (targetId, nextValue) => {
    setOptimizerWeightsByFundId((prev) => {
      const ids = optimizerSelectedFunds.map((f) => f.id)
      if (!ids.includes(targetId)) return prev
      const target = Math.max(0, Math.min(100, Number(nextValue) || 0))
      const others = ids.filter((id) => id !== targetId)
      const next = { ...prev, [targetId]: target }
      if (others.length === 0) return next
      const remaining = 100 - target
      const otherRaw = others.map((id) => Math.max(0, Number(prev[id]) || 0))
      const otherSum = otherRaw.reduce((acc, cur) => acc + cur, 0)
      const distributed = otherSum <= 0
        ? others.map(() => remaining / others.length)
        : otherRaw.map((v) => (v / otherSum) * remaining)
      let used = 0
      others.forEach((id, idx) => {
        const val = idx === others.length - 1 ? (remaining - used) : Math.round(distributed[idx] * 10) / 10
        next[id] = Math.max(0, Number(val.toFixed(1)))
        used += next[id]
      })
      return next
    })
  }

  const setTopThreeFundsForOptimizer = () => {
    const withReturn = dbFunds
      .filter((f) => Boolean(f?.id) && Number.isFinite(Number(f?.returnRate1M)))
      .sort((a, b) => Number(b?.returnRate1M || 0) - Number(a?.returnRate1M || 0))
    const picked = withReturn.slice(0, 3)
    const ids = picked.map((f) => f.id).filter(Boolean)

    if (ids.length >= 2) {
      pendingTop3OptimizerRef.current = true
      setSelectedFundIds(ids)
      return
    }

    if (typeof onUiMessage === 'function') onUiMessage('最適化に使えるファンドデータがまだ不足しています。', 'info')
    else window.alert('最適化に使えるファンドデータがまだ不足しています。')
  }

  const applyOptimalAllocationToSlider = () => {
    if (!optimizerFrontier.optimalPoint) return
    const ids = optimizerSelectedFunds.map((f) => f.id)
    const next = {}
    ids.forEach((id, idx) => {
      next[id] = Number((optimizerFrontier.optimalPoint.weightsPct[idx] || 0).toFixed(1))
    })
    setOptimizerWeightsByFundId(next)
  }

  const saveCurrentAllocationAsWatchSet = async () => {
    if (!isPaidMember) {
      if (typeof onUiMessage === 'function') onUiMessage('ウォッチセット保存はプレミアム機能です。', 'premium')
      else alert('ウォッチセット保存はプレミアム機能です。')
      navigate('/premium')
      return
    }
    if (optimizerSelectedFunds.length < 2) {
      if (typeof onUiMessage === 'function') onUiMessage('ウォッチセット保存には2〜3件のファンド選択が必要です。', 'info')
      else alert('ウォッチセット保存には2〜3件のファンド選択が必要です。')
      return
    }
    const name = String(watchSetName || '').trim()
    if (!name) {
      if (typeof onUiMessage === 'function') onUiMessage('ウォッチセット名を入力してください。', 'info')
      else alert('ウォッチセット名を入力してください。')
      return
    }
    const payload = normalizeFundOptimizerWatchset({
      id: `set-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      source: 'fund_page',
      funds: optimizerSelectedFunds.map((fund, idx) => ({
        id: fund.id,
        name: fund.fundName,
        weightPct: Number((optimizerCurrentWeights[idx] || 0).toFixed(1)),
      })),
      summary: optimizerFrontier.currentPoint
        ? {
          ret: Number(optimizerFrontier.currentPoint.ret || 0),
          risk: Number(optimizerFrontier.currentPoint.risk || 0),
          fee: Number(optimizerFrontier.currentPoint.fee || 0),
        }
        : null,
    })
    if (!payload) return
    setSavedWatchSets((prev) => {
      const next = [payload, ...prev].slice(0, 20)
      try {
        saveFundOptimizerWatchsets(next)
        if (_user?.id) upsertFundOptimizerWatchsetToDb(_user.id, payload).catch(() => {})
      } catch {
        // ignore storage errors in UI flow
      }
      return next
    })
    syncFundsToMyWatchlist(optimizerSelectedFunds)
    setWatchSetName('')
    recordUserActivityEvent(_user?.id, 'fund_watchset_saved', {
      source: 'fund_page',
      fund_count: optimizerSelectedFunds.length,
      watchset_name: name.slice(0, 40),
    })

  }

  const applyWatchSet = (setId) => {
    const target = savedWatchSets.find((row) => row.id === setId)
    if (!target || !Array.isArray(target.funds) || target.funds.length < 2) return
    const ids = target.funds.map((f) => f.id).filter(Boolean).slice(0, 3)
    const next = {}
    target.funds.forEach((f) => {
      next[f.id] = Number(f.weightPct || 0)
    })
    pendingOptimizerWeightsFromWatchSet.current = next
    setSelectedFundIds(ids)
    syncFundsToMyWatchlist(
      ids
        .map((id) => dbFunds.find((fund) => fund.id === id))
        .filter(Boolean)
    )
  }

  const removeWatchSet = (setId) => {
    setSavedWatchSets((prev) => {
      const next = prev.filter((row) => row.id !== setId)
      try {
        saveFundOptimizerWatchsets(next)
        if (_user?.id) deleteFundOptimizerWatchsetFromDb(_user.id, setId).catch(() => {})
      } catch {
        // ignore storage errors in UI flow
      }
      return next
    })
  }

  const mapData = useMemo(() => {
    // 全銘柄ベースでバブルチャート表示（フィルター/検索の影響を受けない）
    // Top/Bottomに加えて、ウォッチ中銘柄は常に表示する。
    const watchIds = new Set(Array.isArray(effectiveWatchlist) ? effectiveWatchlist : [])
    const calculable = dbFunds
      .filter((f) => Number.isFinite(Number(f.stdDev)) && Number.isFinite(Number(f.returnRate1Y)))
    if (calculable.length === 0) return []
    const watchlistedOnly = calculable
      .filter((f) => watchIds.has(f.id))
      .sort((a, b) => Number(b.returnRate1Y) - Number(a.returnRate1Y))
    const sortedByReturn = [...calculable].sort((a, b) => Number(b.returnRate1Y) - Number(a.returnRate1Y))
    const top = sortedByReturn.slice(0, 30)
    const topSet = new Set(top.map((f) => f.id))
    const bottom = [...sortedByReturn].reverse().filter((f) => !topSet.has(f.id)).slice(0, 30)
    let finalRows = watchlistedOnly
    if (bubbleViewMode !== 'watchlist') {
      const base = bubbleViewMode === 'bottom_30' ? bottom : top
      const baseIdSet = new Set(base.map((f) => f.id))
      const watchlistedExtras = watchlistedOnly.filter((f) => !baseIdSet.has(f.id))
      finalRows = [...base, ...watchlistedExtras]
    }

    return finalRows.map((f) => {
        const isWatchlisted = watchIds.has(f.id)
        return {
          id: f.id,
        x: Number(f.stdDev),
        y: Number(f.returnRate1Y),
        z: Math.max(180, Math.min(1400, Math.sqrt(f.aumValue || 1) * 0.9)),
          name: f.fundName,
          category: f.category,
          aumDisplay: f.aumDisplay,
        isWatchlisted,
      }
    })
  }, [dbFunds, effectiveWatchlist, bubbleViewMode])

  const requestSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'descending' ? 'ascending' : 'descending'
    setSortConfig({ key, direction })
  }
  const toggleCompareFund = (fundId) => {
    if (!isLoggedIn) {
      promptLogin()
      return
    }
    setSelectedFundIds((prev) => {
      if (prev.includes(fundId)) return prev.filter((id) => id !== fundId)
      if (prev.length >= 3) {
      if (typeof onUiMessage === 'function') onUiMessage('比較は最大3件まで選択できます。', 'info')
      else alert('比較は最大3件まで選択できます。')
        return prev
      }
      return [...prev, fundId]
    })
  }
  const goToComparison = () => {
    if (!isLoggedIn) {
      promptLogin()
      return
    }
    if (selectedFundIds.length < 2) {
      if (typeof onUiMessage === 'function') onUiMessage('比較するには2つのファンドを選択してください。', 'info')
      else alert('比較するには2つのファンドを選択してください。')
      return
    }
    setIsCompareModalOpen(true)
    recordUserActivityEvent(_user?.id, 'fund_compare_open', {
      source: 'fund_page',
      selected_count: selectedFundIds.length,
      symbols: selectedFundIds.slice(0, 3),
    })
  }
  useEffect(() => {
    if (selectedFundIds.length === 0) setIsComposeModalOpen(false)
  }, [selectedFundIds.length])

  const openComposeModal = () => {
    if (!isLoggedIn) {
      promptLogin()
      return
    }
    if (!isPaidMember) {
      const used = readMonthlyOptimizerUsage(_user?.id)
      if (used >= FREE_FUND_OPTIMIZER_RUNS_PER_MONTH) {
        setIsComposeLimitModalOpen(true)
        return
      }
      const nextUsed = consumeMonthlyOptimizerUsage(_user?.id)
      setFreeOptimizerRunsUsed(nextUsed)
    }
    selectedFundIdsOnComposeOpenRef.current = [...selectedFundIds]
    setIsComposeModalOpen(true)
    recordUserActivityEvent(_user?.id, 'fund_compose_open', {
      source: 'fund_page',
      selected_count: selectedFundIds.length,
      symbols: selectedFundIds.slice(0, 3),
    })
  }
  const closeComposeModal = () => {
    setIsComposeModalOpen(false)
    setSharePopoverOpen(false)
    setSelectedFundIds([...selectedFundIdsOnComposeOpenRef.current])
  }
  useEffect(() => {
    if (!isComposeLimitModalOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setIsComposeLimitModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isComposeLimitModalOpen])
  useEffect(() => {
    if (selectedFundIds.length < 2) setIsCompareModalOpen(false)
  }, [selectedFundIds.length])

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown size={13} className="ml-1 text-slate-400" />
    return sortConfig.direction === 'ascending'
      ? <ArrowUp size={13} className="ml-1 text-orange-500" />
      : <ArrowDown size={13} className="ml-1 text-orange-500" />
  }

  const updatedDateLabel = fetchedDateLabel
  const renderFundOptimizerPanel = ({ className = '' } = {}) => (
    <section className={`rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 shadow-2xl p-4 md:p-6 ${className}`.trim()}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">3D ポートフォリオ最適化（リスク / リターン / 信託報酬）</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            比較チェックで2〜3ファンドを選ぶと、配分変更に応じて「Optimal Allocation」がリアルタイムに移動します。
          </p>
        </div>
        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            onClick={setTopThreeFundsForOptimizer}
            title="1ヶ月リターン上位3件"
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            上位3件を自動選択
          </button>
          <button
            type="button"
            disabled={!optimizerFrontier.optimalPoint}
            onClick={applyOptimalAllocationToSlider}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 disabled:opacity-50 disabled:pointer-events-none"
          >
            最適配分を適用
          </button>
        </div>
      </div>

      {optimizerSelectedFunds.length < 2 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/80 p-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            まずファンド一覧で <span className="text-indigo-600 dark:text-indigo-300">2〜3件</span> を比較選択してください。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/70 p-4">
            <p className="text-[11px] font-black tracking-[0.14em] text-slate-600 dark:text-slate-300 mb-4 text-center">ファンド配分コントロール</p>
            <div className="grid grid-cols-3 gap-3">
              {optimizerSelectedFunds.map((fund) => {
                const weight = Number(optimizerWeightsByFundId[fund.id] || 0)
                const sliderTheme = [
                  { accent: 'accent-sky-500', text: 'text-sky-600 dark:text-sky-300', track: 'from-sky-500/30 to-sky-500/10 dark:from-sky-500/20 dark:to-sky-500/5' },
                  { accent: 'accent-emerald-500', text: 'text-emerald-600 dark:text-emerald-300', track: 'from-emerald-500/30 to-emerald-500/10 dark:from-emerald-500/20 dark:to-emerald-500/5' },
                  { accent: 'accent-orange-500', text: 'text-orange-600 dark:text-orange-300', track: 'from-orange-500/30 to-orange-500/10 dark:from-orange-500/20 dark:to-orange-500/5' },
                ][optimizerSelectedFunds.findIndex((f) => f.id === fund.id)] || { accent: 'accent-indigo-500', text: 'text-indigo-600 dark:text-indigo-300', track: 'from-indigo-500/30 to-indigo-500/10 dark:from-indigo-500/20 dark:to-indigo-500/5' }
                return (
                  <div key={`${fund.id}-optimizer-slider`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-2.5 relative">
                    {optimizerSelectedFunds.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setSelectedFundIds((prev) => prev.filter((id) => id !== fund.id))}
                        className="absolute top-1.5 right-1.5 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                        title="比較から除外"
                        aria-label="比較から除外"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <p className={`text-sm text-center font-black ${sliderTheme.text}`}>{weight.toFixed(1)}%</p>
                    <div className="relative h-40 mt-2">
                      <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-2 rounded-full bg-gradient-to-b ${sliderTheme.track}`} />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.5"
                        value={weight}
                        onChange={(e) => applyOptimizerWeight(fund.id, e.target.value)}
                        className={`absolute top-1/2 left-1/2 w-[150px] -translate-x-1/2 -translate-y-1/2 -rotate-90 ${sliderTheme.accent}`}
                      />
                    </div>
                    <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 text-center mt-2 line-clamp-2 min-h-[32px]">{fund.fundName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-1">R {fmtPct(fund.expectedReturn)} / σ {Number(fund.riskStd || 0).toFixed(1)}%</p>
                  </div>
                )
              })}
            </div>

            {optimizerFrontier.optimalPoint && optimizerFrontier.currentPoint && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-slate-950/70 p-3 mt-3">
                <p className="text-[11px] font-black tracking-wider text-indigo-700 dark:text-indigo-300">最適配分</p>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1">
                  リターン {fmtPct(optimizerFrontier.optimalPoint.ret)} / リスク {optimizerFrontier.optimalPoint.risk.toFixed(1)}% / 信託報酬 {optimizerFrontier.optimalPoint.fee.toFixed(2)}%
                </p>
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  現在配分 リターン {fmtPct(optimizerFrontier.currentPoint.ret)} / リスク {optimizerFrontier.currentPoint.risk.toFixed(1)}% / 信託報酬 {optimizerFrontier.currentPoint.fee.toFixed(2)}%
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  比率: {optimizerCurrentWeights.map((w, idx) => `${String.fromCharCode(65 + idx)} ${w.toFixed(1)}%`).join(' / ')}
                </p>
                {optimizer5yProjectionCurrent && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                    現在配分 5年想定（初期100万円 + 毎月3万円）: {fmtYen(optimizer5yProjectionCurrent.total)}
                    <span className={`ml-1 font-black ${signedReturnTextClassStrong(optimizer5yProjectionCurrent.gain)}`}>
                      ({optimizer5yProjectionCurrent.gain >= 0 ? '+' : ''}{fmtYen(optimizer5yProjectionCurrent.gain)})
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          <Suspense fallback={<Optimizer3DLoadingCard />}>
            <PortfolioOptimizer3D
              points={optimizerFrontier.points}
              pathPoints={optimizerFrontier.pathPoints}
              currentPoint={optimizerFrontier.currentPoint}
              optimalPoint={optimizerFrontier.optimalPoint}
              ranges={optimizerFrontier.ranges}
              onOptimalPointClick={applyOptimalAllocationToSlider}
            />
          </Suspense>
        </div>
      )}
    </section>
  )

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-bold">データを読み込んでいます...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn bg-[#F9FAFB] dark:bg-slate-950 min-h-screen font-sans pb-28">
      <div className="hidden 2xl:block fixed right-6 top-28 w-64 z-20">
        <AdSidebar />
        </div>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">ファンド・インテリジェンス</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">資金フロー・リスク・一覧を一画面で確認</p>
        <p className={`text-xs font-bold mt-2 ${
          dbFunds.length === 0
            ? 'text-amber-600 dark:text-amber-300'
            : 'text-emerald-600 dark:text-emerald-300'
        }`}>
          更新日: {updatedDateLabel} / データソース: 中間データ事業者
        </p>
        {isHydrating && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">最新指標を更新中...</p>
        )}
        <div className="mt-3">
          <MarketDataEodFreshnessNote variant="fund" />
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 shadow-xl p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">ポートフォリオ最適化</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              3D最適化・配分調整・ウォッチセット（配分セット）保存は「構成」ポップアップ内でまとめて操作できます。保存したセットはマイページの「保存した配分セット」に一覧表示されます。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              選択中 {selectedFundIds.length}/3
            </span>
            <button
              type="button"
              onClick={setTopThreeFundsForOptimizer}
              title="1ヶ月リターン上位3件"
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              上位3件を自動選択
            </button>
            <button
              type="button"
              onClick={openComposeModal}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black"
            >
              構成で開く
            </button>
          </div>
        </div>
      </section>

      <div className="mb-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/10 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-sm font-black text-emerald-700 dark:text-emerald-300">低コストTOP 5（信託報酬）</h2>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-300/80">全銘柄で算出</p>
        </div>
        {lowFeeLeaders.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-300">信託報酬データが不足しています。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {lowFeeLeaders.map((fund, idx) => (
              <button
                key={`${fund.id}-lowfee`}
                onClick={() => navigate(`/funds/${fund.id}`)}
                className="text-left rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-white/80 dark:bg-slate-900/70 px-3 py-2 hover:border-emerald-400 dark:hover:border-emerald-500 transition"
              >
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-300">#{idx + 1}</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1 mt-0.5">{fund.fundName}</p>
                <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 mt-1">{formatTrustFee(fund.trustFee)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="relative">
          <div className={`${!isLoggedIn ? 'blur-[6px] pointer-events-none select-none' : ''}`}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">1ヶ月リターン Top / Bottom</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">全銘柄で算出</p>
                </div>
              <div className="h-[220px]">
            {returnLeaderBarData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm font-bold text-slate-400">
                1ヶ月リターン算出に必要な履歴データが不足しています
          </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returnLeaderBarData} layout="vertical" margin={{ top: 6, right: 12, left: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fundName || label}
                    formatter={(v) => {
                      const n = Number(v || 0)
                      const rounded = Math.round(n)
                      return [`${rounded > 0 ? '+' : ''}${rounded}%`, '1ヶ月リターン']
                    }}
                  />
                  <ReferenceLine x={0} stroke="#94a3b8" />
                  <Bar dataKey="value" name="1ヶ月リターン" barSize={16}>
                    {returnLeaderBarData.map((entry) => (
                      <Cell key={entry.id} fill={signedReturnBarHex(entry.value)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-900/10 p-3">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300 mb-2">Top 3</p>
              <div className="space-y-1.5">
                {returnLeaders.top3.map((fund, idx) => (
                  <button
                    key={`${fund.id}-top`}
                    onClick={() => navigate(`/funds/${fund.id}`)}
                    className="w-full text-left flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-300"
                  >
                    <span className="truncate">{idx + 1}. {fund.fundName}</span>
                    <span className={`shrink-0 font-bold ${
                      signedReturnTextClassStrong(Number(fund.returnRate1M || 0))
                    }`}>
                      {fmtPct(fund.returnRate1M)}
                    </span>
                </button>
                ))}
                {returnLeaders.top3.length === 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-300">算出可能な上位データが不足しています</p>
                      )}
                    </div>
                  </div>
            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-900/10 p-3">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">Bottom 3</p>
              <div className="space-y-1.5">
                {returnLeaders.bottom3.length === 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-300">比較可能な下位データが不足しています</p>
                )}
                {returnLeaders.bottom3.map((fund, idx) => (
                  <button
                    key={`${fund.id}-bottom`}
                    onClick={() => navigate(`/funds/${fund.id}`)}
                    className="w-full text-left flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-300"
                  >
                    <span className="truncate">{idx + 1}. {fund.fundName}</span>
                    <span className={`shrink-0 font-bold ${
                      signedReturnTextClassStrong(Number(fund.returnRate1M || 0))
                    }`}>
                      {fmtPct(fund.returnRate1M)}
                    </span>
                  </button>
                ))}
                    </div>
                  </div>
            </div>
          </div>
        </div>
          {!isLoggedIn && (
            <div className="absolute inset-0 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-4">
              <div className="max-w-sm w-full rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-center">
                <p className="text-xs font-black text-amber-700 dark:text-amber-300">Top/Bottom分析はログイン後に表示されます。</p>
                <div className="mt-2.5 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={promptLogin}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-black"
                  >
                    ログイン
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/signup')}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-[11px] font-black hover:bg-amber-100 dark:hover:bg-amber-900/20"
                  >
                    会員登録
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">リスク・リターン バブルチャート</h2>
            <select
              value={bubbleViewMode}
              onChange={(e) => setBubbleViewMode(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
            >
              <option value="top_30">Top 30（1年リターン）</option>
              <option value="bottom_30">Bottom 30（1年リターン）</option>
              {isLoggedIn ? (
                <option value="watchlist">ウォッチ中のみ</option>
              ) : null}
            </select>
      </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
            ※ 算出可能な銘柄のみ表示（Top/Bottomではウォッチ銘柄を常時含みます）
          </p>
          <div className="relative">
            <div className={`${!isLoggedIn ? 'blur-[6px] pointer-events-none select-none' : ''}`}>
              <div className="h-[300px]">
                {mapData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm font-bold text-slate-400">
                    バブル表示に必要なリターン/変動性履歴が不足しています
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 16, right: 20, left: 20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="変動性"
                        unit="%"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        label={{
                          value: 'リスク（年率標準偏差 %）',
                          position: 'insideBottom',
                          offset: -2,
                          fontSize: 11,
                          fill: '#475569',
                          fontWeight: 700,
                        }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="1年リターン"
                        unit="%"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        width={48}
                        label={{
                          value: '1年リターン（%）',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 4,
                          fontSize: 11,
                          fill: '#475569',
                          fontWeight: 700,
                        }}
                      />
                      <ZAxis type="number" dataKey="z" range={[120, 1100]} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null
                          const d = payload[0].payload
                          return (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs shadow-lg">
                              <p className="font-bold text-slate-900 dark:text-white mb-1">{d.name}</p>
                              <p className="text-slate-500 dark:text-slate-300">リターン: {fmtPct(d.y)}</p>
                              <p className="text-slate-500 dark:text-slate-300">変動性: {d.x}%</p>
                              <p className="text-slate-500 dark:text-slate-300">AUM: {d.aumDisplay}</p>
                              {d.isWatchlisted && <p className="text-[11px] font-bold text-red-500 mt-1">ウォッチ中</p>}
                            </div>
                          )
                        }}
                      />
                      <Scatter data={mapData} onClick={(entry) => navigate(`/funds/${entry.id}`)}>
                      {mapData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.id === hoveredBubbleId
                                ? '#3b82f6'
                                : (entry.isWatchlisted ? '#ef4444' : '#94a3b8')
                            }
                            fillOpacity={
                              entry.id === hoveredBubbleId
                                ? 0.95
                                : (entry.isWatchlisted ? 0.85 : 0.45)
                            }
                            stroke={
                              entry.id === hoveredBubbleId
                                ? '#1d4ed8'
                                : (entry.isWatchlisted ? '#dc2626' : '#64748b')
                            }
                            strokeWidth={entry.id === hoveredBubbleId ? 2 : 1}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredBubbleId(entry.id)}
                            onMouseLeave={() => setHoveredBubbleId(null)}
                          />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>
            {!isLoggedIn && (
              <div className="absolute inset-0 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-4">
                <div className="max-w-sm w-full rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-center">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-300">バブルチャートの操作はログイン/会員登録後に利用できます。</p>
                  <div className="mt-2.5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={promptLogin}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-black"
                    >
                      ログイン
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/signup')}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-[11px] font-black hover:bg-amber-100 dark:hover:bg-amber-900/20"
                    >
                      会員登録
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
            </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">ファンド一覧</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">件数 {sortedFunds.length}</span>
              {!isLoggedIn && (
                <button
                  type="button"
                  onClick={promptLogin}
                  className="hidden md:inline-flex px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                >
                  比較/構成はログイン後
                </button>
              )}
              <button
                onClick={goToComparison}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-500 text-white hover:bg-orange-400 transition"
              >
                <BarChart2 size={14} /> 比較する ({selectedFundIds.length}/3)
              </button>
            </div>
          </div>
          <div className="mb-3">
            <div className="relative w-full lg:max-w-xl">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ファンド名 / ISIN で検索"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {[
                { id: 'all', label: 'すべて', icon: Check },
                { id: 'watchlist', label: 'ウォッチ', icon: Heart },
                ...assetClassFilterOptions.map((opt) => ({
                  id: opt.id,
                  label: opt.label,
                  icon: opt.id === 'stock' ? Globe : opt.id === 'bond' ? Flag : Globe,
                })),
              ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => {
                      setActiveFilter(filter.id)
                      setActiveSubFilter('all')
                      setCurrentPage(1)
                    }}
                    className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 transition ${
                      activeFilter === filter.id
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-orange-500 dark:border-orange-500'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {filter.id !== 'all' && filter.icon && <filter.icon size={12} />}
                    {filter.label}
                  </button>
              ))}
            </div>

            {subCategoryFilterOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 shrink-0">サブカテゴリ</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubFilter('all')
                    setCurrentPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-full border text-xs font-bold transition ${
                    activeSubFilter === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  すべて
                </button>
                {subCategoryFilterOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => {
                      setActiveSubFilter(opt.id)
                      setCurrentPage(1)
                    }}
                    className={`px-3 py-1.5 rounded-full border text-xs font-bold transition ${
                      activeSubFilter === opt.id
                        ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">NISA:</span>
            {nisaQuickFilterOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setNisaQuickFilter(opt.id)
                  setCurrentPage(1)
                }}
                className={`px-3 py-1 rounded-full border text-[11px] font-bold transition ${
                  nisaQuickFilter === opt.id
                    ? 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-emerald-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {/* Mobile: compact cards */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {paginatedData.map((fund, idx) => {
            const isWatchlisted = Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(fund.id)
            const isCompared = selectedFundIds.includes(fund.id)
            const retDisplay = Number.isFinite(Number(fund.returnRate1Y))
              ? fmtPct(fund.returnRate1Y)
              : (Number.isFinite(Number(fund.returnYTD))
                ? `YTD ${fund.returnYTD >= 0 ? '+' : ''}${Number(fund.returnYTD).toFixed(1)}%`
                : '-')
            const retValue = Number.isFinite(Number(fund.returnRate1Y)) ? Number(fund.returnRate1Y) : Number(fund.returnYTD ?? NaN)
            return (
              <div
                key={fund.id}
                onClick={() => {
                  trackAnalyticsEvent('fund_select', { product_type: 'fund', product_id: fund.id, product_name: fund.fundName, source: 'fund_mobile_card', rank: (currentPage - 1) * itemsPerPage + idx + 1 })
                  navigate(`/funds/${fund.id}`)
                }}
                className="flex flex-col gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <div className="flex items-start gap-2">
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCompareFund(fund.id) }}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                        isCompared ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isCompared ? <Check size={10} strokeWidth={4} /> : null}
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{fund.isin}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <h3 className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-white">{fund.fundName}</h3>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{nisaDisplayLabel(fund.nisaCategory)}</span>
                    </div>
                  </div>
                  {isLoggedIn ? (
                    <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(fund.id, { name: fund.fundName, change: fund.returnRate1Y }) }} className="shrink-0 p-2 -m-2 text-slate-400">
                      <Heart size={18} fill={isWatchlisted ? '#EF4444' : 'none'} className={isWatchlisted ? 'text-red-500' : ''} />
                    </button>
                  ) : (
                    <button type="button" onClick={(e) => { e.stopPropagation(); promptLogin() }} className="shrink-0 px-2 py-1 rounded-full border border-amber-300 bg-amber-50 text-[9px] font-bold text-amber-700">ログイン後</button>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={`font-black ${retDisplay === '-' ? 'text-slate-400' : signedReturnTextClassStrong(retValue)}`}>
                    {retDisplay}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatTrustFee(fund.trustFee)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-300 text-xs">
              <tr>
                <th className="px-4 py-3 text-center">比較</th>
                <th className="px-4 py-3 text-left">順位</th>
                <th className="px-4 py-3 text-left cursor-pointer" onClick={() => requestSort('fundName')}>ファンド <SortIcon colKey="fundName" /></th>
                <th className="px-4 py-3 text-left cursor-pointer" onClick={() => requestSort('nisaCategory')}>NISA区分 <SortIcon colKey="nisaCategory" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('trustFee')}>信託報酬 <SortIcon colKey="trustFee" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('aumValue')}>AUM <SortIcon colKey="aumValue" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('sharpe')}>リスク対リターン <SortIcon colKey="sharpe" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('stdDev')}>変動性 <SortIcon colKey="stdDev" /></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => requestSort('returnRate1Y')}>1年リターン <SortIcon colKey="returnRate1Y" /></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((fund, idx) => {
              const isWatchlisted = Array.isArray(effectiveWatchlist) && effectiveWatchlist.includes(fund.id)
                const isCompared = selectedFundIds.includes(fund.id)
              return (
                  <tr
                  key={fund.id}
                    className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  onClick={() => {
                    trackAnalyticsEvent('fund_select', {
                      product_type: 'fund',
                      product_id: fund.id,
                      product_name: fund.fundName,
                      source: 'fund_table',
                      rank: (currentPage - 1) * itemsPerPage + idx + 1,
                    })
                    navigate(`/funds/${fund.id}`)
                  }}
                  >
                    <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                          toggleCompareFund(fund.id)
                      }}
                        className={`w-5 h-5 rounded border inline-flex items-center justify-center ${
                          isCompared ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300 dark:border-slate-600'
                        }`}
                    >
                        {isCompared ? <Check size={12} /> : null}
                    </button>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                    <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white line-clamp-1">{fund.fundName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{fund.isin}</div>
                    </div>
                    {isLoggedIn ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                            toggleWatchlist(fund.id, {
                              name: fund.fundName,
                              change: fund.returnRate1Y,
                            })
                      }}
                          className={`p-1 rounded ${isWatchlisted ? 'text-red-500' : 'text-slate-400'}`}
                    >
                          <Heart size={14} fill={isWatchlisted ? 'currentColor' : 'none'} />
                    </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          promptLogin()
                        }}
                        className="px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-700"
                      >
                        ログイン後
                      </button>
                    )}
                  </div>
                    </td>
                    <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">
                      <span>{nisaDisplayLabel(fund.nisaCategory)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatTrustFee(fund.trustFee)}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fund.aumDisplay}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{Number.isFinite(fund.sharpe) ? fund.sharpe.toFixed(2) : '-'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{Number.isFinite(fund.stdDev) ? `${fund.stdDev.toFixed(1)}%` : '-'}</td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        Number.isFinite(Number(fund.returnRate1Y))
                          ? signedReturnTextClassStrong(Number(fund.returnRate1Y))
                          : (Number.isFinite(Number(fund.returnYTD))
                            ? signedReturnTextClassStrong(Number(fund.returnYTD))
                            : 'text-slate-400')
                      }`}
                    >
                      <span>
                        {Number.isFinite(Number(fund.returnRate1Y))
                          ? fmtPct(fund.returnRate1Y)
                          : (Number.isFinite(Number(fund.returnYTD))
                            ? `YTD ${fund.returnYTD >= 0 ? '+' : ''}${Number(fund.returnYTD).toFixed(1)}%`
                            : '-')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentGroupStart - pageGroupSize))}
            disabled={currentGroupStart === 1}
            className="px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            aria-label="前のページグループ"
          >
            {'<<'}
          </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
            className="px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            aria-label="前のページ"
              >
            {'<'}
              </button>
          <span className="px-2 text-xs font-bold text-slate-500 dark:text-slate-300">
            {currentGroupStart}-{currentGroupEnd}
          </span>
          {visiblePages.map((page) => (
                    <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-2.5 py-1.5 text-xs rounded border ${
                currentPage === page
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-orange-500 dark:border-orange-500'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {page}
                    </button>
          ))}
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
            className="px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            aria-label="次のページ"
          >
            {'>'}
          </button>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentGroupStart + pageGroupSize))}
            disabled={currentGroupEnd === totalPages}
            className="px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            aria-label="次のページグループ"
          >
            {'>>'}
              </button>
            </div>
        </div>

      <div className="mt-6 mb-6 2xl:hidden">
        <AdBanner variant="horizontal" />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm font-black text-slate-900 dark:text-white mb-3">よくある質問（比較の見方）</p>
          <div className="space-y-3">
            {FUND_FAQ_ITEMS.map((item) => (
              <div key={item.q} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                <p className="text-xs font-black text-slate-700 dark:text-slate-200">Q. {item.q}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">A. {item.a}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm font-black text-slate-900 dark:text-white mb-2">重要なお知らせ</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            本ページは情報提供を目的とした比較画面であり、特定商品の取得・売却を提案するものではありません。
            実際の投資判断は、最新の目論見書・約款・費用情報をご確認のうえ、ご自身の判断と責任で行ってください。
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {LEGAL_NOTICE_TEMPLATES.investment?.title || '投資関連の注意事項'}
            </p>
          </div>
        </div>
      </div>

      {selectedFundIds.length > 0 && (
        <div className="fixed bottom-24 left-4 right-4 md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-slate-900 text-white px-4 py-3 rounded-2xl md:rounded-full shadow-2xl z-50 flex items-center justify-between gap-3 border border-slate-700 safe-area-pb">
          <span className="text-xs font-bold">{selectedFundIds.length}件選択中</span>
          <button onClick={goToComparison} className="text-xs font-bold text-orange-300 hover:text-orange-200 inline-flex items-center gap-1">
            <BarChart2 size={14} /> 比較する
          </button>
          <button
            onClick={openComposeModal}
            className="text-xs font-bold text-sky-300 hover:text-sky-200 inline-flex items-center gap-1"
          >
            構成
          </button>
          <button onClick={() => setSelectedFundIds([])} className="text-xs font-bold text-slate-300 hover:text-white inline-flex items-center gap-1">
            <X size={14} /> 全選択解除
          </button>
        </div>
      )}

      {isComposeLimitModalOpen && (
        <div
          className="fixed inset-0 z-[135] flex items-center justify-center p-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compose-limit-modal-title"
        >
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setIsComposeLimitModalOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="compose-limit-modal-title" className="text-lg font-black text-slate-900 dark:text-white">
              無料プランの利用上限
            </h3>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
              構成シミュレーター（オプティマイザー）は無料プランでは月に{FREE_FUND_OPTIMIZER_RUNS_PER_MONTH}回までです。今月の回数を使い切りました。続けてご利用になる場合はプレミアム（有料）プランへのアップグレードをご検討ください。
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsComposeLimitModalOpen(false)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:w-auto"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsComposeLimitModalOpen(false)
                  navigate('/premium')
                }}
                className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-white hover:bg-amber-400 sm:w-auto"
              >
                プレミアムを見る
              </button>
            </div>
          </div>
        </div>
      )}

      {isComposeModalOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compose-modal-title"
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeComposeModal} aria-hidden="true" />
          <div className="relative z-10 flex h-[min(92dvh,100dvh)] w-full max-w-6xl min-h-0 flex-col">
            <div
              className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  closeComposeModal()
                }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  closeComposeModal()
                }}
                style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                className="absolute right-2 top-2 z-20 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:right-3 sm:top-3"
                aria-label="閉じる"
                title="閉じる (Esc)"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
              <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 px-4 py-3 pr-14 sm:px-5 sm:py-4 sm:pr-16 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-3">
              <div className="min-w-0 w-full md:flex-1">
                <h3 id="compose-modal-title" className="text-lg font-black text-slate-900 dark:text-white break-words">構成シミュレーター</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words leading-relaxed">比率調整→期待収益/リスク/信託報酬→20年成長を一画面で確認。ウォッチセット＝現在の構成を名前付きで保存し、後で「適用」で復元（マイページでは「保存した配分セット」に表示）。保存・適用時、構成銘柄のうちまだウォッチに無いものはマイページのファンドウォッチリストへ自動追加されます。</p>
              </div>
              <div className="flex w-full shrink-0 md:w-auto md:justify-end">
                {optimizerSelectedFunds.length >= 2 && (
                  <div className="flex w-full flex-wrap items-center gap-2 md:max-w-none">
                    <input
                      type="text"
                      value={watchSetName}
                      onChange={(e) => setWatchSetName(e.target.value)}
                      placeholder="ウォッチセット名"
                      disabled={!isPaidMember}
                      className="min-w-0 flex-1 basis-[10rem] md:flex-none md:w-32 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => saveCurrentAllocationAsWatchSet()}
                      disabled={!isPaidMember}
                      className="h-8 shrink-0 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black whitespace-nowrap"
                    >
                      ウォッチセット保存
                    </button>
                    {!isPaidMember ? (
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-300">
                        無料残り {freeOptimizerRunsRemaining} 回 / 保存はプレミアム限定
                      </span>
                    ) : null}
                    {savedWatchSets.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {savedWatchSets.slice(0, 4).map((row) => (
                          <div key={row.id} className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2 py-1">
                            <button type="button" onClick={() => applyWatchSet(row.id)} className="text-[10px] font-black text-emerald-600 dark:text-emerald-300 hover:text-emerald-500">適用</button>
                            <button type="button" onClick={() => removeWatchSet(row.id)} className="text-[10px] font-black text-rose-500 dark:text-rose-300">削除</button>
                            <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[80px]">{row.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 pb-6 sm:pb-8 md:p-5 space-y-4">
              {optimizerSelectedFunds.length < 1 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                  ファンドを選択すると構成シミュレーターが有効になります。
                </div>
              ) : (
                <>
                  {renderFundOptimizerPanel()}
                  <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                      <p className="text-xs font-black text-slate-700 dark:text-slate-200 mb-2">Ratio（配分）</p>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie data={composePieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={2}>
                              {composePieData.map((item) => <Cell key={`compose-cell-${item.id}`} fill={item.color} />)}
                            </Pie>
                            <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-1 mb-2">
                        {composePieData.map((item) => (
                          <div key={`compose-legend-${item.id}`} className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-slate-600 dark:text-slate-300 truncate">{item.name}</span>
                            </div>
                            <span className="font-black text-slate-700 dark:text-slate-200">{item.value.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 mt-2">
                        {optimizerSelectedFunds.map((fund) => {
                          const weight = Number(optimizerWeightsByFundId[fund.id] || 0)
                          return (
                            <div key={`compose-slider-${fund.id}`} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{fund.fundName}</p>
                                <p className="text-[11px] font-black text-orange-500">{weight.toFixed(1)}%</p>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.5"
                                value={weight}
                                onChange={(e) => applyOptimizerWeight(fund.id, e.target.value)}
                                className="w-full mt-1 accent-orange-500"
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80 p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-[17px] sm:text-[20px] md:text-[22px] leading-tight font-black text-slate-900 dark:text-white">将来推移シミュレーション (20年)</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              現在配分ベース | 期待収益 {fmtPct(optimizerFrontier.currentPoint?.ret)} / リスク {Number(optimizerFrontier.currentPoint?.risk || 0).toFixed(1)}% / 信託報酬 {Number(optimizerFrontier.currentPoint?.fee || 0).toFixed(2)}%
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                          <label className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5">
                            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">初期投資額</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={fmtNumber(composeInitialYen)}
                              onChange={(e) => setComposeInitialYen(parseNumericInput(e.target.value))}
                              className="mt-1 w-full bg-transparent outline-none text-[17px] sm:text-[20px] md:text-[22px] leading-none font-black text-slate-900 dark:text-white"
                            />
                          </label>
                          <label className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5">
                            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">毎月の積立額</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={fmtNumber(composeMonthlyYen)}
                              onChange={(e) => setComposeMonthlyYen(parseNumericInput(e.target.value))}
                              className="mt-1 w-full bg-transparent outline-none text-[17px] sm:text-[20px] md:text-[22px] leading-none font-black text-slate-900 dark:text-white"
                            />
                          </label>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3">
                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={composeGrowthSeries}>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#d1d5db" />
                                <XAxis dataKey="year" tickFormatter={(v) => (v === 0 ? '現在' : `${v}年後`)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={(v) => fmtYenCompact(v)} width={96} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(v) => fmtYen(v)} labelFormatter={(v) => `${v}年`} />
                                <Line type="monotone" dataKey="principal" name="投資元本" stroke="#94a3b8" strokeWidth={2.4} strokeDasharray="6 6" dot={false} />
                                <Line type="monotone" dataKey="total" name="運用資産総額" stroke="#2563eb" strokeWidth={3} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {composeGrowthLast && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3">
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">投資元本 (20年)</p>
                              <p className="text-[18px] sm:text-[22px] md:text-[26px] leading-none font-black text-slate-900 dark:text-white mt-2">{fmtYen(composeGrowthLast.principal)}</p>
                            </div>
                            <div className="rounded-xl border border-blue-200 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                              <p className="text-[11px] font-bold text-blue-600 dark:text-blue-300">運用資産総額 (推計)</p>
                              <p className="text-[18px] sm:text-[22px] md:text-[26px] leading-none font-black text-blue-700 dark:text-blue-200 mt-2">{fmtYen(composeGrowthLast.total)}</p>
                              <p className={`text-xs font-black mt-1 ${signedReturnTextClassStrong(composeGrowthLast.gain)}`}>{composeGrowthLast.gain >= 0 ? '+' : ''}{fmtYen(composeGrowthLast.gain)} の損益</p>
                            </div>
                            <div className="rounded-xl border border-rose-200 dark:border-rose-700/50 bg-rose-50/60 dark:bg-rose-950/20 p-3">
                              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-300">支払う手数料 (推計)</p>
                              <p className="text-[18px] sm:text-[22px] md:text-[26px] leading-none font-black text-rose-700 dark:text-rose-200 mt-2">{fmtYen(composeGrowthLast.feePaid)}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">※信託報酬 {Number(optimizerFrontier.currentPoint?.fee || 0).toFixed(2)}% に基づく</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 space-y-1">
                        {Number.isFinite(composeAnnualProjectionRate) ? (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            ※ 保守的換算 年率: {composeAnnualProjectionRate.toFixed(1)}%（表示上の長期シミュレーション用に期待収益を保守的に圧縮）
                          </p>
                        ) : null}
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{MM_SIMULATION_PAST_PERFORMANCE_JA}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {isCompareModalOpen && (
        <div
          className="fixed inset-0 z-[135] flex items-center justify-center p-2 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCompareModalOpen(false)} aria-hidden="true" />
          <div className="relative z-10 flex h-[min(92dvh,100dvh)] w-full max-w-7xl min-h-0 flex-col">
            <div
              className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <Suspense fallback={<CompareModalLoadingCard />}>
                <FundComparePage
                  user={_user || null}
                  myWatchlist={effectiveWatchlist}
                  toggleWatchlist={toggleWatchlist}
                  onUiMessage={onUiMessage}
                  embeddedMode
                  initialSymbols={selectedFundIds}
                  onClose={() => setIsCompareModalOpen(false)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <div className="text-right mt-4 text-xs text-slate-400">※ データ提供: 中間データ事業者（ETF）</div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        ※ 信託報酬は予告なく変更される場合があります。最新情報は各運用会社の公式サイトをご確認ください。
      </p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        ※ 過去の運用実績・リターンは将来の成果を保証するものではありません。
      </p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        ※ 信託報酬等の数値は参考値であり、予告なく変更される場合があります。※ NISAの非課税メリットはお客様個人の状況により異なります。最終的な投資判断はご自身でお願いします。
      </p>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        {LEGAL_NOTICE_TEMPLATES.investment}
      </p>

      {miniWidgetOpen ? (
        <div className="fixed right-4 bottom-24 z-40 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-black text-indigo-500">Fund Widget</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">積立ミニ計算（60歳）</p>
            </div>
            <button
              type="button"
              onClick={() => setMiniWidgetOpen(false)}
              className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center"
              aria-label="close mini widget"
            >
              <X size={14} />
            </button>
          </div>

          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-3">
            <button
              type="button"
              onClick={() => setMiniScheme('nisa')}
              className={`px-3 py-1 rounded text-[11px] font-black ${miniScheme === 'nisa' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
            >
              NISA
            </button>
            <button
              type="button"
              onClick={() => setMiniScheme('ideco')}
              className={`px-3 py-1 rounded text-[11px] font-black ${miniScheme === 'ideco' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
            >
              iDeCo
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-black text-slate-500">毎月の積立額（万円）</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={miniMonthlyMan}
                  onChange={(e) => setMiniMonthlyMan(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-800 dark:text-slate-100"
                />
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={Math.min(30, Number(miniMonthlyMan) || 0)}
                  onChange={(e) => setMiniMonthlyMan(Number(e.target.value) || 0)}
                  className="flex-1 accent-indigo-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black text-slate-500">年齢</label>
                <input
                  type="number"
                  min="20"
                  max="59"
                  value={miniCurrentAge}
                  onChange={(e) => setMiniCurrentAge(Math.min(59, Math.max(20, Number(e.target.value) || 20)))}
                  className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500">想定年利</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={miniAnnualRate}
                  onChange={(e) => setMiniAnnualRate(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5">
            <p className="text-[10px] text-slate-500">60歳時点の想定資産</p>
            <p className="text-base font-black text-indigo-600 dark:text-indigo-300">¥{miniProjection.projectedTotal.toLocaleString()}</p>
            <p className={`text-[11px] font-bold mt-1 ${signedReturnTextClassStrong(miniProjection.gain)}`}>+¥{miniProjection.gain.toLocaleString()}（+{miniProjection.totalReturnPct.toFixed(1)}%）</p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMiniWidgetOpen(true)}
          className="fixed right-4 bottom-24 z-40 rounded-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xl border border-indigo-500"
        >
          積立ミニ計算
        </button>
      )}
    </div>
  )
}
