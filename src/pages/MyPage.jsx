import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  PieChart, Wallet, CreditCard, TrendingUp, TrendingDown,
  AlertTriangle, ShieldCheck, ChevronRight, Bell, Calendar,
  ArrowUpRight, Zap, Coins,
  FileText, Home, PiggyBank, Smartphone, Star, X, Loader2, Trash2, Pencil, Plus, Lock,
  Sparkles, Target, ArrowRight, Calculator,
  UtensilsCrossed, Bus, ShoppingCart, Gift,   ChevronLeft,
  ForkKnifeCrossed, Gamepad2, Stethoscope, GraduationCap, Plane, Shirt, Dog, MoreHorizontal,
  ChevronDown,
  HelpCircle,
} from 'lucide-react'
import {
  Cell, Pie, ResponsiveContainer, Tooltip,
  PieChart as RechartsPieChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Line,
  ComposedChart, Legend,
  AreaChart, Area, LabelList
} from 'recharts'
import { supabase } from '../lib/supabase'
import { monthlyChange, splitRatioAfter } from '../lib/portfolioCalc'
import { signedReturnTextClassStrong } from '../lib/marketDirectionColors'
import {
  loadMyPageData,
  loadOwnedAssetPositions,
  replaceOwnedAssetPositions,
  addExpense,
  deleteExpenseById,
  updateExpense,
  addInsurance,
  deleteInsuranceById,
  updateInsurance,
  saveFinanceProfile,
  addPointAccount,
  deletePointAccountById,
  updatePointAccount,
  addAssetPosition,
  updateAssetPosition,
  deleteAssetPositionById,
  loadRefinanceProducts,
  loadUserRevolvingDebts,
  addRevolvingDebt,
  updateRevolvingDebt,
  deleteRevolvingDebt,
  saveRefinanceSimulation,
  loadTaxShieldRules,
  loadUserTaxShieldProfile,
  saveUserTaxShieldProfile,
  saveTaxShieldSimulation,
  loadUserCashFlowOptimizerProfile,
  saveUserCashFlowOptimizerProfile,
  saveCashFlowOptimizerSimulation,
  loadStockWatchlistSymbolsFromDb,
  mergeStockWatchlistSymbolsInDb,
  removeDbWatchlistItem,
  normalizeListedSymbolId,
  dividendMonthsFromDividends,
  loadDividendWatchlist,
  upsertDividendWatchlistItem,
  updateDividendWatchlistQty,
  deleteDividendWatchlistItem,
  DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT,
  DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT,
  normalizeRiseThresholdPct,
  loadUserPortfolioDropAlertSetting,
  saveUserPortfolioDropAlertSetting,
  upsertPortfolioDropAlertHistory,
  acknowledgePortfolioDropAlerts,
} from '../lib/myPageApi'
import { shouldReloadStockWatchlistFromStorageKey } from '../lib/watchlistSyncEvents'
import { rankRefinanceOffers } from '../lib/refinanceCalc'
import { evaluateTaxShield } from '../lib/taxShieldCalc'
import { evaluateCashFlowOptimizer } from '../lib/cashFlowOptimizerCalc'
import { calculateRiskScore } from '../simulators/engine/riskEngine'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import { MM_SIMULATION_PAST_PERFORMANCE_JA, MM_DEBT_SIMULATION_DISCLAIMER_JA } from '../lib/moneymartSimulationDisclaimer'
import { MOCK_STOCKS } from '../data/mockStocks'
import { STOCK_LIST_400 } from '../data/stockList400'
import { isUsListedEtfSymbol } from '../data/usListedEtfUniverse'
import { getStockNameFallback } from '../data/stockNameFallback'
import { ETF_LIST_FROM_XLSX } from '../data/etfListFromXlsx'
import { decodeHtmlEntities, normalizeFundDisplayName, resolveFundDisplayName } from '../lib/fundDisplayUtils'
import { lookupDividendStockBySymbol, fetchStockFromSupabase } from '../data/dividendStockUniverse'
import { isRetiredStockSymbol } from '../lib/retiredStockSymbols'
import { fetchNewsManualData, getFallbackNewsData } from '../lib/newsManualClient'
const PortfolioDiagnosisPanel = lazy(() => import('../components/mypage/PortfolioDiagnosisPanel'))
const DividendCalendarSection = lazy(() => import('./mypage/DividendCalendarSection'))
const SellHistorySection = lazy(() => import('./mypage/SellHistorySection'))
import {
  buildFundOptimizerCompareUrl,
  loadFundOptimizerWatchsets,
  saveFundOptimizerWatchsets,
  loadFundOptimizerWatchsetsFromDb,
  upsertFundOptimizerWatchsetToDb,
  deleteFundOptimizerWatchsetFromDb,
  migrateFundOptimizerSetsToDb,
} from '../lib/fundOptimizerWatchsets'
import { recordUserActivityEvent } from '../lib/userActivityApi'
import { displayedMonthEndSpending, getCurrentMonthBudgetUsage, projectMonthEndSpending, samePeriodExpenseBounds, spentOnInBounds } from '../lib/mypageBudgetAlerts'
import { householdMemoText } from '../lib/householdExpenseMemo'
import { fetchEtfThreeMonthReturnPct, annualizeThreeMonthReturnPct, WEALTH_SIM_ETF_SYMBOL } from '../lib/wealthSimEtfReturns'
import {
  ENFORCE_FREE_OWNED_DISTINCT_SYMBOL_CAPS,
  FREE_OWNED_DISTINCT_STOCK_SYMBOLS,
  FREE_OWNED_DISTINCT_FUND_SYMBOLS,
  PREMIUM_DISCOUNT_YEN,
  PREMIUM_LIST_PRICE_YEN,
  PREMIUM_SALE_PRICE_YEN,
  hasPremiumEntitlement,
} from '../lib/membership'
import { fetchMyReferralCode } from '../lib/referralApi'
import { REFERRAL_INVITE_UI_ENABLED } from '../lib/referralUiFlags'
import MyPagePromotionsSection from '../components/mypage/MyPagePromotionsSection'
import PortfolioRelatedPanel from '../components/news/PortfolioRelatedPanel'
import { usePortfolioExposureProfile } from '../hooks/usePortfolioExposureProfile'
import { fetchAiNewsData } from '../lib/aiNewsClient'
import {
  getAnnualDividendPerShare,
  getDividendCadenceMeta,
  getDividendYieldPct,
  getFirstDividendMonth,
  formatDividendCash,
  isLikelyUsdDivStock,
  getDividendNetCashInNative,
  getDividendItemIsNisa,
  normalizeDividendStockFlag,
} from '../lib/dividendCalendar'
import {
  getDividendCalendarDetailRecord,
  searchDividendCalendarRecords,
  isHighYieldDetailSymbol,
  dividendDetailMatchesUserInput,
} from '../lib/dividendCalendarDetailLookup'
import { isMisclassifiedStockHeldAsFundSymbol } from '../lib/ownedFundSymbolGuard'

const STOCK_WATCHLIST_STORAGE_KEY_PREFIX = 'mm_stock_watchlist_v1'
const FREE_FUND_WATCHLIST_LIMIT = 3
const getStockWatchlistStorageKey = (userId) =>
  (userId ? `${STOCK_WATCHLIST_STORAGE_KEY_PREFIX}_${userId}` : `${STOCK_WATCHLIST_STORAGE_KEY_PREFIX}_guest`)
const MY_PAGE_ETF_META_BY_SYMBOL = new Map(
  (Array.isArray(ETF_LIST_FROM_XLSX) ? ETF_LIST_FROM_XLSX : []).map((r) => [String(r.symbol || '').toUpperCase(), r])
)
const isMyPageEtfSymbol = (stockId) => {
  const raw = String(stockId || '').trim().toUpperCase()
  if (!raw) return false
  if (MY_PAGE_ETF_META_BY_SYMBOL.has(raw)) return true
  if (!raw.endsWith('.T') && MY_PAGE_ETF_META_BY_SYMBOL.has(`${raw}.T`)) return true
  if (raw.endsWith('.T') && MY_PAGE_ETF_META_BY_SYMBOL.has(raw.slice(0, -2))) return true
  return false
}

/** 保有の symbol（例: 7203）と配当ウォッチの stock_id（7203 / 7203.T）を同一銘柄として扱う */
const ownedSymbolMatchesDividendStockId = (ownedSym, divStockId) => {
  const o = String(ownedSym || '').trim().toUpperCase()
  const d = String(divStockId || '').trim().toUpperCase()
  if (!o || !d) return false
  if (o === d) return true
  const jpCode = (x) => {
    const m = String(x || '').match(/^(\d{4}|\d{3}[A-Z])(\.T)?$/i)
    return m ? m[1].toUpperCase() : ''
  }
  const oC = jpCode(o)
  const dC = jpCode(d)
  return Boolean(oC && dC && oC === dC)
}

const dividendDismissStorageKey = (userId) => `mm-dividend-watchlist-dismissed:${userId || 'guest'}`

const readDismissedDividendSymbols = (userId) => {
  try {
    const raw = window.localStorage.getItem(dividendDismissStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(
      (Array.isArray(parsed) ? parsed : [])
        .map((id) => normalizeListedSymbolId(id))
        .filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

const writeDismissedDividendSymbols = (userId, ids) => {
  try {
    window.localStorage.setItem(
      dividendDismissStorageKey(userId),
      JSON.stringify([...ids]),
    )
  } catch {
    // ignore
  }
}

const isDividendWatchlistDismissed = (userId, stockId) => (
  readDismissedDividendSymbols(userId).has(normalizeListedSymbolId(stockId))
)

const rememberDismissedDividendSymbol = (userId, stockId) => {
  const id = normalizeListedSymbolId(stockId)
  if (!userId || !id) return
  const next = readDismissedDividendSymbols(userId)
  next.add(id)
  writeDismissedDividendSymbols(userId, next)
}

const forgetDismissedDividendSymbol = (userId, stockId) => {
  const id = normalizeListedSymbolId(stockId)
  if (!userId || !id) return
  const next = readDismissedDividendSymbols(userId)
  next.delete(id)
  writeDismissedDividendSymbols(userId, next)
}

/** stock_symbols がティッカーのみでも、JP上場CSV・ETFマスタ等で表示名を補う（resolveFundDisplayName に委譲） */
const resolveOwnedFundDisplayName = (symbol, stockSymbolName, storedName) => {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) return ''
  const sn = decodeHtmlEntities(String(stockSymbolName || '').trim())
  const dbn = decodeHtmlEntities(String(storedName || '').trim())
  const tickerOnly = (x) => !x || String(x).trim().toUpperCase() === sym
  if (!tickerOnly(dbn)) return normalizeFundDisplayName(dbn)
  const meta = MY_PAGE_ETF_META_BY_SYMBOL.get(sym)
  return resolveFundDisplayName(sym, { name: sn }, meta || null, null)
}

const normalizeOwnedStockLabelToken = (value) => {
  const s = decodeHtmlEntities(String(value || '').trim()).replace(/\s+/g, ' ').trim()
  return s
}

const isTickerOnlyStockLabel = (sym, candidate) => {
  const c = String(candidate || '').trim()
  if (!c) return true
  return c.toUpperCase() === String(sym || '').trim().toUpperCase()
}

/** プロフィールに和名・英名があるときは「和名 / 英名」で併記（株タブで英語も見えるように） */
const resolveOwnedStockDisplayName = (symbol, stockSymbolName, profileNameJp, profileNameEn, fallbackName = '') => {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) return ''
  const jp = normalizeOwnedStockLabelToken(profileNameJp)
  const en = normalizeOwnedStockLabelToken(profileNameEn)
  const stockN = normalizeOwnedStockLabelToken(stockSymbolName)
  const fb = normalizeOwnedStockLabelToken(fallbackName)
  const mapFallback = normalizeOwnedStockLabelToken(getStockNameFallback(sym) || '')

  const jpOk = jp && !isTickerOnlyStockLabel(sym, jp)
  const enOk = en && !isTickerOnlyStockLabel(sym, en)

  const dupOfProfile = (c) => {
    if (!c) return false
    const x = c.normalize('NFKC').toLowerCase()
    if (jpOk && x === jp.normalize('NFKC').toLowerCase()) return true
    if (enOk && x === en.normalize('NFKC').toLowerCase()) return true
    return false
  }

  if (jpOk && enOk) {
    const j = jp.normalize('NFKC').toLowerCase()
    const e = en.normalize('NFKC').toLowerCase()
    if (j === e) return normalizeFundDisplayName(jp)
    return `${normalizeFundDisplayName(jp)} / ${normalizeFundDisplayName(en)}`
  }
  if (jpOk) {
    const extras = [stockN, fb, mapFallback]
    for (const raw of extras) {
      if (!raw || isTickerOnlyStockLabel(sym, raw) || dupOfProfile(raw)) continue
      const j = jp.normalize('NFKC').toLowerCase()
      const e = raw.normalize('NFKC').toLowerCase()
      if (j !== e) return `${normalizeFundDisplayName(jp)} / ${normalizeFundDisplayName(raw)}`
    }
    return normalizeFundDisplayName(jp)
  }
  if (enOk) return normalizeFundDisplayName(en)

  // stock_symbols は英名のみのことが多い。マスタ側で「和 / 英」を持つときはそちらを優先（例: VRT）
  if (mapFallback && /\s+\/\s+/.test(mapFallback)) {
    return normalizeFundDisplayName(mapFallback)
  }

  const singles = [stockN, fb, mapFallback]
  for (const raw of singles) {
    if (!raw || isTickerOnlyStockLabel(sym, raw) || dupOfProfile(raw)) continue
    return normalizeFundDisplayName(raw)
  }
  return sym
}

const OWNED_STOCKS_STORAGE_KEY_PREFIX = 'mm_owned_stocks_v1'
const OWNED_FUNDS_STORAGE_KEY_PREFIX = 'mm_owned_funds_v1'
const OWNED_REALIZED_STOCKS_STORAGE_KEY_PREFIX = 'mm_owned_realized_stock_v1'
const OWNED_REALIZED_FUNDS_STORAGE_KEY_PREFIX = 'mm_owned_realized_fund_v1'
const LOCAL_FUND_POSITIONS_STORAGE_KEY_PREFIX = 'mm_local_fund_positions_v1'
const getOwnedStocksStorageKey = (userId) =>
  (userId ? `${OWNED_STOCKS_STORAGE_KEY_PREFIX}_${userId}` : `${OWNED_STOCKS_STORAGE_KEY_PREFIX}_guest`)
const getOwnedFundsStorageKey = (userId) =>
  (userId ? `${OWNED_FUNDS_STORAGE_KEY_PREFIX}_${userId}` : `${OWNED_FUNDS_STORAGE_KEY_PREFIX}_guest`)
const getOwnedRealizedStockTradesStorageKey = (userId) =>
  (userId
    ? `${OWNED_REALIZED_STOCKS_STORAGE_KEY_PREFIX}_${userId}`
    : `${OWNED_REALIZED_STOCKS_STORAGE_KEY_PREFIX}_guest`)
const getOwnedRealizedFundTradesStorageKey = (userId) =>
  (userId
    ? `${OWNED_REALIZED_FUNDS_STORAGE_KEY_PREFIX}_${userId}`
    : `${OWNED_REALIZED_FUNDS_STORAGE_KEY_PREFIX}_guest`)
const getLocalFundPositionsStorageKey = (userId) =>
  (userId ? `${LOCAL_FUND_POSITIONS_STORAGE_KEY_PREFIX}_${userId}` : `${LOCAL_FUND_POSITIONS_STORAGE_KEY_PREFIX}_guest`)

const clearLegacyOwnedPortfolioLocalStorage = (userId) => {
  if (!userId) return
  try {
    localStorage.removeItem(getOwnedStocksStorageKey(userId))
    localStorage.removeItem(getOwnedFundsStorageKey(userId))
  } catch {
    // ignore
  }
}

const normalizeRealizedStockTrades = (rows = []) => (
  (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const symbol = String(row?.symbol || '').trim().toUpperCase()
      const tradeId = String(row?.tradeId || row?.trade_id || '').trim()
      if (!symbol || !tradeId) return null
      const qty = Number(row?.qty || 0)
      const sellPrice = Number(row?.sellPrice ?? row?.sell_price ?? 0)
      const costBasisJpy = Number(row?.costBasisJpy ?? row?.cost_basis_jpy ?? 0)
      const proceedsJpy = Number(row?.proceedsJpy ?? row?.proceeds_jpy ?? 0)
      const realizedPnlJpy = Number(row?.realizedPnlJpy ?? row?.realized_pnl_jpy ?? (proceedsJpy - costBasisJpy))
      const sellFxRate = Number(row?.sellFxRate ?? row?.sell_fx_rate)
      const sellFxDate = String(row?.sellFxDate || row?.sell_fx_date || '').slice(0, 10)
      return {
        tradeId,
        symbol,
        sellDate: String(row?.sellDate || row?.sell_date || ''),
        qty: Number.isFinite(qty) && qty >= 0 ? qty : 0,
        sellPrice: Number.isFinite(sellPrice) && sellPrice >= 0 ? sellPrice : 0,
        costBasisJpy: Number.isFinite(costBasisJpy) ? costBasisJpy : 0,
        proceedsJpy: Number.isFinite(proceedsJpy) ? proceedsJpy : 0,
        realizedPnlJpy: Number.isFinite(realizedPnlJpy) ? realizedPnlJpy : 0,
        sellFxRate: Number.isFinite(sellFxRate) && sellFxRate > 0 ? sellFxRate : null,
        sellFxDate: /^\d{4}-\d{2}-\d{2}$/.test(sellFxDate) ? sellFxDate : '',
        buyLots: (Array.isArray(row?.buyLots) ? row.buyLots : Array.isArray(row?.buy_lots) ? row.buy_lots : [])
          .map((lot) => {
            const buyDate = String(lot?.buyDate || lot?.buy_date || '').slice(0, 10)
            const lotQty = Number(lot?.qty)
            const costJpy = Number(lot?.costJpy ?? lot?.cost_jpy)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(buyDate) || !(lotQty > 0)) return null
            return { buyDate, qty: lotQty, costJpy: Number.isFinite(costJpy) ? costJpy : 0 }
          })
          .filter(Boolean),
      }
    })
    .filter(Boolean)
)

const normalizeRealizedFundTrades = normalizeRealizedStockTrades

const loadLocalRealizedStockTradesList = (userId) => {
  try {
    const raw = localStorage.getItem(getOwnedRealizedStockTradesStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return normalizeRealizedStockTrades(parsed)
  } catch {
    return []
  }
}

const loadLocalRealizedFundTradesList = (userId) => {
  try {
    const raw = localStorage.getItem(getOwnedRealizedFundTradesStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return normalizeRealizedFundTrades(parsed)
  } catch {
    return []
  }
}

const readLocalStockWatchlistSymbolIds = (userId) => {
  try {
    const raw = localStorage.getItem(getStockWatchlistStorageKey(userId))
    const ids = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? [...new Set(ids.map((v) => String(v).trim()).filter(Boolean))] : []
  } catch {
    return []
  }
}

const clearLocalStockWatchlistKey = (userId) => {
  try {
    localStorage.removeItem(getStockWatchlistStorageKey(userId))
  } catch {
    // ignore
  }
}
const FUND_WATCHLIST_MEMO_STORAGE_KEY_PREFIX = 'mm_fund_watchlist_memo_v1'
const getFundWatchlistMemoStorageKey = (userId) =>
  (userId ? `${FUND_WATCHLIST_MEMO_STORAGE_KEY_PREFIX}_${userId}` : `${FUND_WATCHLIST_MEMO_STORAGE_KEY_PREFIX}_guest`)
const AI_REPORT_DRAFT_STORAGE_KEY = 'mm_ai_report_draft_v1'
const MYPAGE_TAB_STORAGE_KEY = 'mm_mypage_active_tab_v1'
const MYPAGE_ALLOWED_TABS = ['wealth', 'stock', 'fund', 'related', 'sellhistory', 'point', 'debt', 'coach', 'dividend']
const normalizeMyPageTab = (value = '') => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'wealth'
  if (raw === 'summary') return 'wealth'
  if (raw === 'budget') return 'point'
  if (raw === 'stocks') return 'stock'
  if (raw === 'funds') return 'fund'
  if (raw === 'coach') return 'debt'
  if (raw === 'history' || raw === 'sell-history' || raw === 'sell_history') return 'sellhistory'
  if (raw === 'impact' || raw === 'exposure' || raw === 'kanren') return 'related'
  return raw
}
/** App の通知バッジのみ更新。家計の保存成功時だけ呼ぶ（レンダー連動の useEffect では呼ばない）。 */
const notifyBudgetAlertRefresh = () => {
  try {
    window.dispatchEvent(new CustomEvent('mm-budget-alert-refresh'))
  } catch {
    // ignore
  }
}
const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000
/** Supabase 応答が止まったとき、マイページ全体がスピナー固定にならないよう上限 */
const PORTFOLIO_QUOTES_HYDRATE_TIMEOUT_MS = 25_000
const OWNED_ASSET_SYNC_TIMEOUT_MS = 20_000
const POINT_EXPIRY_ALERT_DAYS = 30
const PRICE_STALE_ALERT_DAYS = 3
const PORTFOLIO_DROP_ALERT_THRESHOLD_OPTIONS = [
  { value: null, label: 'オフ' },
  { value: -3, label: '-3%' },
  { value: -5, label: '-5%' },
  { value: -7, label: '-7%' },
]
const PORTFOLIO_RISE_ALERT_THRESHOLD_OPTIONS = [
  { value: null, label: 'オフ' },
  { value: 5, label: '+5%' },
  { value: 10, label: '+10%' },
]
const DEBT_TYPE_LABELS = {
  mortgage: 'Mortgage',
  card: 'Card',
  revolving: 'Revolving',
  other: 'Other',
}
const sanitizeNumericInput = (raw = '') => String(raw)
  .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
  .replace(/[^\d]/g, '')

const sanitizeDecimalInput = (raw = '') => {
  const normalized = String(raw)
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
    .replace(/[．。]/g, '.')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '')
  const firstDot = normalized.indexOf('.')
  if (firstDot === -1) return normalized
  return `${normalized.slice(0, firstDot + 1)}${normalized.slice(firstDot + 1).replace(/\./g, '')}`
}

const sanitizeIntegerInput = (raw = '') => String(raw)
  .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
  .replace(/[^\d]/g, '')
const sanitizeDecimalOneInput = (raw = '') => {
  const normalized = sanitizeDecimalInput(raw)
  if (!normalized) return ''
  const [intPart = '', decimalPart = ''] = normalized.split('.')
  if (normalized.includes('.')) return `${intPart}.${decimalPart.slice(0, 1)}`
  return intPart
}
/** 株式・配当ウォッチの保有株数入力（小数第3位まで） */
const STOCK_SHARE_FRAC_DIGITS = 3
const sanitizeStockShareQtyInput = (raw = '') => sanitizeDecimalManyInput(raw, STOCK_SHARE_FRAC_DIGITS)
const roundStockShareQty = (raw) => {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  const p = 10 ** STOCK_SHARE_FRAC_DIGITS
  return Math.round(n * p) / p
}
/** 売却口数・小数株など。既定 10 桁まで（投資元本÷基準価額の桁あふれ対策） */
const sanitizeDecimalManyInput = (raw = '', maxFracDigits = 10) => {
  const n = Math.max(0, Math.min(16, Number(maxFracDigits) || 10))
  const normalized = sanitizeDecimalInput(raw)
  if (!normalized) return ''
  const [intPart = '', decimalPart = ''] = normalized.split('.')
  if (normalized.includes('.')) {
    const d = n > 0 ? decimalPart.slice(0, n) : ''
    if (d.length === 0 && normalized.endsWith('.')) return `${intPart}.`
    return d.length > 0 ? `${intPart}.${d}` : intPart
  }
  return intPart
}
const formatMaxSellUnitsInput = (u) => {
  const n = Number(u)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n.toFixed(16).replace(/\.?0+$/, '')
}
const DEFAULT_REVOLVING_PROFILE = {
  balance_yen: 0,
  apr: 15,
  monthly_payment_yen: 0,
  remaining_months_assumed: 24,
  refinance_fee_yen: 0,
}
const DEFAULT_TAX_SHIELD_PROFILE = {
  tax_year: new Date().getFullYear(),
  annual_income_manwon: 0,
  ideco_paid_yen: 0,
  nisa_paid_yen: 0,
  insurance_paid_yen: 0,
  deduction_reflected: false,
}
const DEFAULT_CASH_FLOW_PROFILE = {
  tax_year: new Date().getFullYear(),
  cash_balance_yen: 0,
  current_cash_rate: 0.001,
  high_yield_cash_rate: 0.003,
  reserve_month_multiplier: 1.5,
}

const loadLocalList = (key) => {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const toIsoDate = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const validateYmd = (y, mm, dd) => {
    if (!Number.isFinite(y) || !Number.isFinite(mm) || !Number.isFinite(dd)) return ''
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return ''
    const iso = `${String(y).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    const dt = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(dt.getTime())) return ''
    return iso
  }
  // ISO日時・DBの timestamptz 文字列など（先頭 YYYY-MM-DD / YYYY/MM/DD のみ採用）
  const head = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (head) {
    const iso = validateYmd(Number(head[1]), Number(head[2]), Number(head[3]))
    if (iso) return iso
  }
  // 2024年3月15日
  const jp = raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (jp) {
    const iso = validateYmd(Number(jp[1]), Number(jp[2]), Number(jp[3]))
    if (iso) return iso
  }
  const normalized = raw.replace(/\./g, '/').replace(/-/g, '/')
  const m = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!m) return ''
  return validateYmd(Number(m[1]), Number(m[2]), Number(m[3]))
}

/** 表示用 YYYY/MM/DD（日本表記） */
const formatDateJpSlash = (value) => {
  const iso = toIsoDate(value || '')
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return '—'
  return `${y}/${m}/${d}`
}

/** 買付日入力欄用（type=date のロケール依存 mm/dd 表示を避ける） */
const isoToSlashInputDisplay = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${y}/${m}/${d}`
}

const OwnedBuyDateTextInput = ({ value, onCommit, className, onKeyDown }) => {
  const committedIso = toIsoDate(value || '')
  const displayCommitted = committedIso ? isoToSlashInputDisplay(committedIso) : String(value || '').trim()
  const [draft, setDraft] = useState(displayCommitted)
  const [focused, setFocused] = useState(false)
  const nativeDateInputRef = useRef(null)

  useEffect(() => {
    if (focused) return
    setDraft(displayCommitted)
  }, [value, focused, displayCommitted])

  const shown = focused ? draft : displayCommitted

  const calendarBtnClass =
    'relative flex h-full min-h-[44px] min-w-[44px] shrink-0 touch-manipulation cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-orange-300 hover:text-orange-600 active:opacity-90 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-orange-600 dark:hover:text-orange-400 sm:min-h-[38px] sm:min-w-[44px] sm:px-2.5 sm:py-1.5'

  return (
    <div className="relative flex items-stretch gap-1.5 min-w-0 w-full">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        placeholder="YYYY/MM/DD"
        title="年/月/日（例: 2026/01/15）。ハイフン区切りも可。"
        className={`${className} flex-1 min-w-0`}
        value={shown}
        onFocus={() => {
          setFocused(true)
          const iso = toIsoDate(value || '')
          setDraft(iso ? isoToSlashInputDisplay(iso) : String(value || '').trim())
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = toIsoDate(draft)
          if (parsed) onCommit(parsed)
          else if (!String(draft || '').trim()) onCommit('')
          else {
            const iso = toIsoDate(value || '')
            setDraft(iso ? isoToSlashInputDisplay(iso) : String(value || '').trim())
          }
          setFocused(false)
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />
      <button
        type="button"
        className={`${calendarBtnClass} m-0 p-0`}
        title="カレンダーで選択"
        aria-label="カレンダーで日付を選択"
        onClick={() => {
          const el = nativeDateInputRef.current
          if (!el) return
          if (typeof el.showPicker === 'function') {
            el.showPicker()
            return
          }
          el.click()
        }}
      >
        <span className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center" aria-hidden>
          <Calendar size={18} strokeWidth={2} className="sm:h-[17px] sm:w-[17px]" />
        </span>
        <input
          ref={nativeDateInputRef}
          type="date"
          value={committedIso || ''}
          onChange={(e) => {
            const v = String(e.target.value || '').trim()
            if (v) onCommit(v)
          }}
          className="absolute left-0 top-0 z-[-1] m-0 box-border h-0 w-0 overflow-hidden border-0 p-0 opacity-0 pointer-events-none [color-scheme:light] dark:[color-scheme:dark]"
          style={{ fontSize: 16 }}
        />
      </button>
    </div>
  )
}

/** 保有資産フォーム・表内入力: モバイルは16px以上(iOSズーム防止)・min-h 44px タップ領域 */
const ownedFieldInputClass = 'w-full min-h-[44px] sm:min-h-0 text-base sm:text-sm py-2.5 px-3 sm:py-1.5 sm:px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
const ownedFieldInputRightClass = `${ownedFieldInputClass} text-right`
const ownedMobileFieldLabelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 sm:hidden'

/** 保有ポジション表（株・ファンド）PC: ヘッダー強調・行ホバー・銘柄列アクセント */
const ownedPortfolioTableScrollWrapClass =
  'hidden lg:block overflow-x-auto touch-pan-x rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 shadow-md shadow-slate-900/[0.06] dark:shadow-none ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06]'
const ownedPortfolioTableBaseClass = 'w-full text-base lg:text-sm tabular-nums'
const ownedPortfolioTheadRowClass =
  'bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.07)]'
const ownedPortfolioThBaseClass =
  'px-3 py-3.5 lg:px-5 lg:py-3.5 font-extrabold text-[11px] sm:text-xs text-white/95 tracking-wide align-bottom whitespace-nowrap'
const ownedPortfolioTbodyRowClass =
  'border-t border-slate-100 dark:border-slate-800/90 transition-[background-color] duration-150 hover:bg-orange-50/40 dark:hover:bg-orange-950/25'
const ownedPortfolioNameCellClass =
  'px-3 py-4 sm:px-5 border-l-[3px] border-l-orange-500 dark:border-l-orange-400 align-top min-w-0 max-w-[14rem] xl:max-w-[18rem]'
const ownedPortfolioTickerPillClass =
  'inline-flex mt-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-600 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200'
const ownedPortfolioLotRowClass =
  'border-t border-slate-100 dark:border-slate-800/90 bg-slate-50/80 dark:bg-slate-900/40'
const ownedPortfolioTfootClass =
  'bg-gradient-to-r from-slate-100 via-orange-50/45 to-amber-50/35 dark:from-slate-800/90 dark:via-slate-900 dark:to-slate-900 border-t-2 border-orange-200/70 dark:border-orange-900/45'
const ownedPortfolioMobileCardClass =
  'rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-md shadow-slate-900/[0.05] dark:shadow-none ring-1 ring-orange-500/12 dark:ring-orange-400/10 space-y-3'
const ownedPortfolioMobileTotalsClass =
  'rounded-xl border-2 border-orange-200/80 dark:border-orange-900/50 bg-gradient-to-br from-slate-50 to-orange-50/40 dark:from-slate-800/60 dark:to-orange-950/25 p-3 space-y-2 text-sm shadow-sm'

/** MyPage ネイティブ date: 44px タップ・16px ベース（iOS ズーム回避）、sm 以上は text-sm */
const myPageNativeDateInputTouchClass =
  'min-h-[44px] touch-manipulation text-base sm:min-h-0 sm:text-sm [color-scheme:light] dark:[color-scheme:dark]'

/** 家計簿: 表示は YYYY/MM/DD、API は YYYY-MM-DD */
const HOUSEHOLD_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function formatHouseholdDateSlash(iso) {
  const s = String(iso || '').slice(0, 10)
  if (!HOUSEHOLD_ISO_DATE_RE.test(s)) return ''
  const [y, m, d] = s.split('-')
  return `${y}/${m}/${d}`
}
function parseHouseholdDateSlash(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (HOUSEHOLD_ISO_DATE_RE.test(s)) return s
  const norm = s.replace(/\./g, '/').replace(/-/g, '/')
  const parts = norm.split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 3 || parts[0].length !== 4) return ''
  const y = Number(parts[0])
  const mo = Number(parts[1])
  const da = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return ''
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || da < 1 || da > 31) return ''
  const out = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`
  const check = new Date(`${out}T12:00:00`)
  if (
    Number.isNaN(check.getTime())
    || check.getFullYear() !== y
    || check.getMonth() + 1 !== mo
    || check.getDate() !== da
  ) {
    return ''
  }
  return out
}

const createOwnedLotId = () => `lot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const normalizeOwnedLots = (rows = []) => (
  (Array.isArray(rows) ? rows : [])
    .map((row, idx) => {
      const symbol = String(row?.symbol || row?.id || row?.code || '').trim().toUpperCase()
      if (!symbol) return null
      const currency = String(row?.currency || '').trim().toUpperCase()
      const buyFxRate = Number(row?.buyFxRate)
      return {
        lotId: String(row?.lotId || `legacy_${symbol}_${idx}`),
        symbol,
        buyDate: String(row?.buyDate || ''),
        buyPrice: row?.buyPrice ?? '',
        qty: row?.qty ?? '',
        currency: currency === 'USD' || currency === 'JPY' || currency === 'EUR' || currency === 'GBP' ? currency : '',
        buyFxRate: Number.isFinite(buyFxRate) && buyFxRate > 0 ? buyFxRate : '',
        buyFxDate: String(row?.buyFxDate || ''),
      }
    })
    .filter(Boolean)
)

const normalizeOwnedFundAmounts = (rows = []) => (
  (Array.isArray(rows) ? rows : [])
    .map((row, idx) => {
      const symbol = String(row?.symbol || row?.id || row?.code || '').trim().toUpperCase()
      if (!symbol) return null
      const investFromLegacy = Math.max(0, Number(row?.qty || 0)) * Math.max(0, Number(row?.buyPrice || 0))
      const investAmount = Number(row?.investAmount ?? row?.invest ?? investFromLegacy)
      const buyPrice = Number(row?.buyPrice ?? 0)
      const buyDate = toIsoDate(row?.buyDate || '')
      return {
        id: String(row?.id || row?.lotId || `fund_${symbol}_${idx}`),
        symbol,
        name: decodeHtmlEntities(String(row?.name || symbol)),
        investAmount: Number.isFinite(investAmount) && investAmount >= 0 ? investAmount : 0,
        buyDate,
        buyPrice: Number.isFinite(buyPrice) && buyPrice >= 0 ? buyPrice : 0,
      }
    })
    .filter(Boolean)
)

// LSE symbols are commonly stored in GBX (pence). Align MyPage with StockPage display logic.
const normalizeOwnedDisplayPrice = (symbol, value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  if (/\.(L|LN)$/i.test(String(symbol || ''))) return n / 100
  return n
}

const FX_RATES_TO_JPY = {
  JPY: 1,
}

const isJpListedCode = (symbol = '') => {
  const s = String(symbol || '').trim().toUpperCase()
  const bare = s.endsWith('.T') ? s.slice(0, -2) : s
  return /^\d{4}$/.test(bare) || /^\d{3}[A-Z]$/.test(bare)
}

const inferStockCurrency = (symbol = '') => {
  const s = String(symbol || '').toUpperCase()
  if (s.endsWith('.T') || isJpListedCode(s)) return 'JPY'
  if (s.endsWith('.L') || s.endsWith('.LN')) return 'GBP'
  if (/\.(PA|AS|DE|MI|MC|SW|BR|LS|ST|HE)$/i.test(s)) return 'EUR'
  return 'USD'
}

const storedLotCurrency = (lot) => {
  const c = String(lot?.currency || '').trim().toUpperCase()
  return c === 'USD' || c === 'JPY' || c === 'EUR' || c === 'GBP' ? c : ''
}

/** 保存済み通貨を優先。未保存の米国ティッカーは取得単価が現在値の 0.2〜5 倍のときだけ USD。 */
const resolveLotCurrency = (lot, latestPrice) => {
  const stored = storedLotCurrency(lot)
  if (stored) return stored
  const inferred = inferStockCurrency(lot?.symbol || lot?.code || '')
  if (inferred !== 'USD') return inferred
  const buy = Number(lot?.buyPrice || 0)
  const px = Number(latestPrice || lot?.price || 0)
  if (buy > 0 && px > 0 && buy >= px * 0.2 && buy <= px * 5) return 'USD'
  return ''
}

/** 指定日以前の直近営業日レート。150 固定は使わない。 */
const fxOnOrBefore = (iso, fxByDate) => {
  const day = String(iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !fxByDate || typeof fxByDate !== 'object') return null
  let bestDate = ''
  let best = null
  for (const [rawKey, raw] of Object.entries(fxByDate)) {
    const key = String(rawKey).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key > day) continue
    const v = Number(raw)
    if (!(Number.isFinite(v) && v > 0)) continue
    if (key > bestDate) {
      bestDate = key
      best = v
    }
  }
  return best == null ? null : { rate: best, asOf: bestDate }
}

/** 매도일 이하 가장 최근 영업일 USD/JPY. 실패하면 null. 현재 환율로 대체하지 않는다. */
const lookupUsdJpyOnOrBefore = async (iso) => {
  const day = toIsoDate(iso)
  if (!day) return null
  try {
    const r = await fetch(`/api/fx?date=${encodeURIComponent(day)}`)
    if (!r.ok) return null
    const j = await r.json()
    const rate = Number(j?.rates?.USD)
    const asOf = String(j?.fxAsOf || '').slice(0, 10)
    if (!(rate > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null
    return { rate, asOf }
  } catch {
    return null
  }
}

/** 매도 저장용. 매도일 조회가 실패할 때만 현재 환율과 그 기준일을 쓴다. */
const resolveUsdSellFx = async ({ sellDateIso, currentRate, currentAsOf }) => {
  const found = await lookupUsdJpyOnOrBefore(sellDateIso)
  if (found) return found
  const rate = Number(currentRate)
  const asOf = String(currentAsOf || '').slice(0, 10)
  if (rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) return { rate, asOf }
  return null
}

const formatAppliedUsdJpy = (rate, asOf) => {
  const n = Number(rate)
  const day = String(asOf || '').slice(0, 10)
  if (!(n > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return ''
  const yen = n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return `適用レート 1ドル=¥${yen} (${day})`
}

const resolveBuyFx = (lot, fxByDate, latestPrice) => {
  const stored = Number(lot?.buyFxRate)
  if (Number.isFinite(stored) && stored > 0) {
    return { rate: stored, asOf: String(lot?.buyFxDate || '').slice(0, 10), locked: true }
  }
  const ccy = resolveLotCurrency(lot, latestPrice)
  if (ccy === 'JPY') return { rate: 1, asOf: '', locked: false }
  if (ccy !== 'USD') return { rate: null, asOf: '', locked: false }
  const buyDate = String(lot?.buyDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(buyDate)) return { rate: null, asOf: '', locked: false }
  const found = fxOnOrBefore(buyDate, fxByDate)
  return found ? { ...found, locked: false } : { rate: null, asOf: '', locked: false }
}

const positiveUsdJpy = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

const formatSignedYen = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '--'
  const v = Math.round(Number(n))
  return `${v >= 0 ? '+' : ''}¥${v.toLocaleString('ja-JP')}`
}

/** 円換算。通貨未確定・為替なしは included:false（150 では埋めない）。 */
const lotYenParts = (lot, qty, buyPrice, currentPrice, fxByDate, valuationUsdJpy) => {
  const ccy = resolveLotCurrency(lot, currentPrice)
  if (!ccy) {
    return { costJpy: 0, valueJpy: 0, pricePnlJpy: null, fxPnlJpy: null, included: false, costKnown: false, currency: '' }
  }
  if (ccy === 'JPY') {
    const costJpy = qty * buyPrice
    const listing = inferStockCurrency(lot?.symbol || lot?.code || '')
    if (listing !== 'USD') {
      const valueJpy = qty * currentPrice
      return { costJpy, valueJpy, pricePnlJpy: valueJpy - costJpy, fxPnlJpy: 0, included: true, costKnown: true, currency: 'JPY', hideFxSplit: false }
    }
    const now = positiveUsdJpy(valuationUsdJpy)
    if (now == null) {
      return { costJpy: 0, valueJpy: 0, pricePnlJpy: null, fxPnlJpy: null, included: false, costKnown: false, currency: 'JPY', hideFxSplit: true }
    }
    const valueJpy = qty * currentPrice * now
    return { costJpy, valueJpy, pricePnlJpy: null, fxPnlJpy: null, included: true, costKnown: true, currency: 'JPY', hideFxSplit: true }
  }
  if (ccy !== 'USD') {
    const costJpy = toJpy(qty * buyPrice, ccy)
    const valueJpy = toJpy(qty * currentPrice, ccy)
    return { costJpy, valueJpy, pricePnlJpy: valueJpy - costJpy, fxPnlJpy: 0, included: true, costKnown: true, currency: ccy }
  }
  const storedBuyFx = Number(lot?.buyFxRate)
  const buyRate = Number.isFinite(storedBuyFx) && storedBuyFx > 0 ? storedBuyFx : null
  const now = positiveUsdJpy(valuationUsdJpy)
  const costKnown = buyRate != null
  const valueKnown = now != null
  const valueJpy = valueKnown ? qty * currentPrice * now : 0
  if (!costKnown || !valueKnown) {
    return { costJpy: 0, valueJpy, pricePnlJpy: null, fxPnlJpy: null, included: valueKnown, costKnown: false, currency: 'USD' }
  }
  const costJpy = qty * buyPrice * buyRate
  return {
    costJpy,
    valueJpy,
    pricePnlJpy: (currentPrice - buyPrice) * qty * buyRate,
    fxPnlJpy: currentPrice * qty * (now - buyRate),
    included: true,
    costKnown: true,
    currency: 'USD',
  }
}

/** 円入力の米国株は評価額ベース。それ以外の取引行は従来の価格差率。 */
const stockLotPnlRate = (lot, stock, qty, buyPrice, fxByDate, valuationUsdJpy) => {
  const price = Number(stock?.price || 0)
  const raw = qty > 0 && buyPrice > 0 && price > 0
    ? ((price - buyPrice) / buyPrice) * 100
    : null
  const symbol = lot?.symbol || lot?.code || stock?.symbol || ''
  const inputCcy = resolveLotCurrency({ ...lot, symbol }, price)
  if (inputCcy !== 'JPY' || inferStockCurrency(symbol) !== 'USD') return raw
  const parts = lotYenParts({ ...lot, symbol }, qty, buyPrice, price, fxByDate, valuationUsdJpy)
  if (!(parts.costKnown && parts.included && parts.costJpy > 0)) return null
  return ((parts.valueJpy - parts.costJpy) / parts.costJpy) * 100
}

const inferFundCurrency = (name = '') => {
  const n = String(name || '').toUpperCase()
  if (n.includes('米国') || n.includes('S&P') || n.includes('NASDAQ') || n.includes('US')) return 'USD'
  if (n.includes('欧州') || n.includes('EUROPE')) return 'EUR'
  if (n.includes('英国') || n.includes('UK')) return 'GBP'
  return 'JPY'
}

/** ファンド国別パイ用: 銘柄コード＋名前から 日本/米国/欧州/英国/全世界/新興国 を返す */
const FUND_WATCH_BOND_SET = new Set(['TLT', 'HYG', 'LQD', 'IEF', 'SHY', 'BND', 'AGG', 'EMB', 'TIP'])
const FUND_WATCH_REIT_SET = new Set(['VNQ', 'VNQI'])
const FUND_WATCH_COMMODITY_SET = new Set(['GLD', 'SLV', 'USO', 'GDX'])

const inferWatchFundCategoryLabel = (row = {}) => {
  const explicit = String(row?.category || row?.assetClassLabel || '').trim()
  if (explicit) return explicit
  const code = String(row?.id || row?.symbol || '').trim().toUpperCase()
  const name = String(row?.name || '').toUpperCase()
  if (FUND_WATCH_REIT_SET.has(code) || /REIT|リート/.test(name)) return 'REIT'
  if (FUND_WATCH_BOND_SET.has(code) || /債券|BOND|TREASURY|国債|社債/.test(name)) return '債券'
  if (FUND_WATCH_COMMODITY_SET.has(code) || /COMMODITY|原油|金|銀|GOLD|SILVER/.test(name)) return '原材料'
  return '株式'
}

const inferFundCountryLabel = (symbol = '', name = '') => {
  const s = String(symbol || '').toUpperCase().trim()
  const n = String(name || '').toUpperCase()
  // 上場市場(.T 等)より先に「投資対象地域」を名称から推定（東証上場の米国指数ETFが全件「日本」になるのを防ぐ）
  if (s.endsWith('.L') || s.endsWith('.LN')) return '英国'
  if (/\.(PA|AS|DE|MI|MC|SW|BR|LS|ST|HE)$/i.test(s)) return '欧州'
  if (n.includes('全世界') || n.includes('GLOBAL') || n.includes('ACWI') || n.includes('VXUS') || n.includes('EFA') || n.includes('オール・カントリー') || n.includes('オールカントリー')) return '全世界'
  if (s === 'VTI' || n.includes('VTI')) return '米国'
  if (s === 'VT' || (n.includes('VT') && !n.includes('VTI'))) return '全世界'
  if (n.includes('新興国') || n.includes('EMERGING') || n.includes('EEM') || n.includes('MCHI')) return '新興国'
  if (
    n.includes('米国') ||
    n.includes('アメリカ株') ||
    n.includes('Ｓ＆Ｐ') ||
    n.includes('S&P') ||
    n.includes('SAP500') ||
    n.includes('NASDAQ') ||
    n.includes('ナスダック') ||
    n.includes('NYダウ') ||
    n.includes('ＮＹダウ') ||
    n.includes('ダウ平均') ||
    n.includes('US ') ||
    n.includes('U.S.') ||
    n.includes('IVV') ||
    n.includes('SPY') ||
    n.includes('VOO') ||
    n.includes('QQQ') ||
    n.includes('RUSSELL') ||
    n.includes('ラッセル')
  ) return '米国'
  if (n.includes('欧州') || n.includes('EUROPE')) return '欧州'
  if (n.includes('英国') || n.includes('UK')) return '英国'
  if (n.includes('日本') || n.includes('TOPIX') || n.includes('日経')) return '日本'
  if (s.endsWith('.T')) return '日本'
  // FXAIX / BRK.B など 1–5 文字以外の米ドル建てティッカーが「日本」に落ちてパイに米国が出ない問題
  if (inferStockCurrency(symbol) === 'USD') return '米国'
  return '日本'
}

const toJpy = (value, currency = 'JPY') => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  if (String(currency || 'JPY').toUpperCase() !== 'JPY') return 0
  return n
}

const formatStockNativePrice = (value, currency = 'JPY') => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  const cur = String(currency || 'JPY').toUpperCase()
  if (cur === 'JPY') return `¥${n.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`
  try {
    return new Intl.NumberFormat(cur === 'USD' ? 'en-US' : 'ja-JP', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${n.toLocaleString('ja-JP', { maximumFractionDigits: 2 })} ${cur}`
  }
}

const formatStockNativeMoney = (value, currency = 'JPY') => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  const cur = String(currency || 'JPY').toUpperCase()
  if (cur === 'JPY') return `¥${Math.round(n).toLocaleString('ja-JP')}`
  try {
    return new Intl.NumberFormat(cur === 'USD' ? 'en-US' : 'ja-JP', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(n))
  } catch {
    return `${Math.round(n).toLocaleString('ja-JP')} ${cur}`
  }
}

const inferStockSector = (name = '', symbol = '', extraHints = '') => {
  const sym = String(symbol || '').trim().toUpperCase()
  const n = `${name} ${sym} ${extraHints}`.toLowerCase()
  // テクノロジー
  if (/(tech|テック|テクノロジ|情報.?技術|it\s|ソフト|software|cloud|saas|ai\b|半導体|semiconductor|chip|nvidia|apple|microsoft|google|alphabet|meta|facebook|amazon|adobe|oracle|salesforce|intel|cisco|broadcom|micron|qualcomm|asml|パナソニック|ソニー|富士通|nec|キーエンス|東京エレクトロン|アドバンテスト|screen|信越化学|電機|精密機器)/i.test(n)) {
    return 'テクノロジー'
  }
  // 金融（英語社名・日本語業種）
  if (/(bank|銀行|金融|保険|insurance|securities|証券|capital\s*market|フィンテック|fintech|asset\s*management|credit\s*card|visa|mastercard|jpmorgan|goldman|morgan\s*stanley|citigroup|wells\s*fargo|blackrock|berkshire|三菱.?ufj|みずほ|三井住友|りそな|ゆうちょ|野村|大和|smbc|smfg|生命|損保|あいおい|東京海上|第一生命)/i.test(n)) {
    return '金融'
  }
  // エネルギー（石油・ガス；鉱業は素材へ）
  if (/(energy|エネルギー|oil|petroleum|gas\b|原油|石油|天然ガス|chevron|exxon|conocophillips|shell|bp\b)/i.test(n)) {
    return 'エネルギー'
  }
  // 電力・ガス（旧ラベル「公益」／水道・送配電も含む）
  if (/(utility|utilities|公益|電力|ガス事業|水道|送配電|next.?era|southern\s*company|関西電力|東京電力|中部電力)/i.test(n)) {
    return '電力・ガス'
  }
  // 自動車
  if (/(auto|自動車|mobility|toyota|トヨタ|tesla|テスラ|ford|gm\b|honda|ホンダ|マツダ|スズキ|スバル|日産|nissan|isuzu|デンソー|アイシン)/i.test(n)) {
    return '自動車'
  }
  // ヘルスケア
  if (/(health|医療|ヘルス|pharma|製薬|バイオ|biotech|ドラッグ|薬品|病院|医薬|ジョンソン|ファイザー|merck|unitedhealth|eli\s*lilly|novo\s*nordisk|武田|中外|第一三共|安斯泰来)/i.test(n)) {
    return 'ヘルスケア'
  }
  // 生活必需品（食料品・日用品）
  if (/(consumer\s*staples|staples|生活必需|必須消費|食料品|飲料|たばこ|ウォルマート|walmart|コカ|コーラ|ペプシ|宝洁|p&g|ユニリーバ|ネスレ|味の素|キッコーマン|伊藤園)/i.test(n)) {
    return '生活必需品'
  }
  // 一般消費・小売
  if (/(consumer\s*discretionary|consumer\s*cyclical|小売|retail|百貨|アパレル|外食|マクドナルド|スタバ|nike|ディズニー|booking|amazon\s*retail|良品計画|ファーストリテイリング|セブン|イオン)/i.test(n)) {
    return '消費財'
  }
  // 産業・運輸・建設・防衛（社名に industrial が無くてもティーカー・製品で寄せる）
  if (/(industrial|産業|industrials|machinery|機械|建設|重工|造船|航空宇宙|aerospace|defense|防衛|ボーイング|lockheed|キャタピラー|caterpillar|deere|vernova|vertiv|\bgev\b|\bvrt\b|データ.?センタ|critical\s*infrastructure|物流|運輸|運送|郵便|logistics|freight|railway|鉄道|海運|空運|倉庫|三菱重工|川崎重工|いすゞ)/i.test(n)) {
    return '産業'
  }
  // コミュニケーション・メディア
  if (/(communication|通信|テレコム|telecom|wireless|キャリア|ソフトバンク|kddi|ntt|メディア|entertainment|netflix|ディズニー\+|放送|広告)/i.test(n)) {
    return 'コミュニケーション'
  }
  // 素材・化学・商社
  if (/(material|素材|化学|chemical|鉄鋼|steel|aluminum|copper|mining|鉱物|linde|rio\s*tinto|三菱商事|三井物産|伊藤忠|住友商事|丸紅|豊田通商)/i.test(n)) {
    return '素材'
  }
  // 不動産
  if (/(reit|不動産|real\s*estate|プロパティ|住友不動産|三井不動産|三菱地所|東急|野村不動産)/i.test(n)) {
    return '不動産'
  }
  return 'その他'
}

/**
 * DB に無い銘柄でも GICS に合わせて円グラフへ。必要ならここに追加。
 * （プロフィール未設定時は infer に落ちる）
 */
const PIE_SECTOR_BY_SYMBOL = {
  GEV: '産業', // GE Vernova — GICS Industrials / Heavy Electrical Equipment
  VRT: '産業', // Vertiv — GICS Industrials / Electrical Equipment
}

/** DBの sector / industry 文字列を円グラフ用の日本語カテゴリに寄せる（GICS・日英混在対応）。未判定は '' */
const mapProfileSectorToPieCategory = (raw) => {
  const s = String(raw || '').trim()
  if (!s) return ''
  const lower = s.toLowerCase()
  const pairs = [
    [/technology|information\s*technology|\btech\b|software|semiconductor|hardware|internet|electronics|e-?commerce\s*platform|it\s*services|テクノロジ|情報.?通信|半導体|電気.?通信/i, 'テクノロジー'],
    [/financial|financ(e|ial)|\bbank|insurance|reinsurance|asset\s*management|capital\s*markets|wealth|lending|broker|金融|銀行|保険|証券/i, '金融'],
    [/health|医療|製薬|pharma|バイオ|biotech|ドラッグ|medical|life\s*sciences|ヘルス/i, 'ヘルスケア'],
    [/energy|エネルギー|oil|petroleum|原油|石油|天然ガス|integrated\s*oil|oil\s*&\s*gas|chevron|exxon|conocophillips|shell|\bbp\b/i, 'エネルギー'],
    [/utilities|utility|公益|電力.?ガス|電気.?ガス|water\s*utilities|multi-utilities/i, '電力・ガス'],
    [/consumer\s*cyclical|consumer\s*discretionary|一般消費|非必須|discretionary|小売|retail/i, '消費財'],
    [/consumer\s*defensive|consumer\s*staples|生活必需|必須消費|staples/i, '生活必需品'],
    // Industrials: 英語 industry が "Heavy Electrical Equipment" 等で industrial 語を含まないことがある
    [/electrical\s*equipment|heavy\s*electrical|industrial\s*machinery|building\s*products|trading\s*companies/i, '産業'],
    [/industrial|industrials|産業|資本財|capital\s*goods|機械|建設|航空宇宙|aerospace|defense|防衛/i, '産業'],
    [/communication\s*services|communication|telecom|テレコム|メディア|entertainment/i, 'コミュニケーション'],
    [/materials|basic\s*materials|素材|化学|鉄鋼|金属|mining|packaging|paper/i, '素材'],
    [/real\s*estate|不動産|reit/i, '不動産'],
    [/auto|自動車|mobility/i, '自動車'],
  ]
  for (const [re, label] of pairs) {
    if (re.test(s) || re.test(lower)) return label
  }
  return ''
}

const sectorForOwnedStockPie = (stock) => {
  const symU = String(stock.symbol || '').trim().toUpperCase()
  if (symU && PIE_SECTOR_BY_SYMBOL[symU]) return PIE_SECTOR_BY_SYMBOL[symU]
  let mapped = mapProfileSectorToPieCategory(stock.profileSector)
  if (mapped) return mapped
  mapped = mapProfileSectorToPieCategory(stock.profileIndustry)
  if (mapped) return mapped
  const fb = getStockNameFallback(stock.symbol) || ''
  const hints = `${stock.profileSector || ''} ${stock.profileIndustry || ''}`.trim()
  return inferStockSector(`${stock.name} ${fb}`.trim(), stock.symbol, hints)
}

/** 小さなスライスも円上に最低角度を確保（モバイルで消えないように） */
const MY_PAGE_PIE_MIN_ANGLE = 3

const saveAiReportDraft = ({ userId, payload }) => {
  try {
    const raw = localStorage.getItem(AI_REPORT_DRAFT_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const key = userId ? String(userId) : 'guest'
    parsed[key] = {
      report_type: 'summary_hybrid',
      updated_at: new Date().toISOString(),
      payload,
    }
    localStorage.setItem(AI_REPORT_DRAFT_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // ignore storage failures
  }
}

const PORTFOLIO = [
  { id: 1, name: 'Fund A (Global Tech)', value: 1250000, invest: 1000000, return: 25.0, color: '#3b82f6' },
  { id: 2, name: 'Fund B (Bond Mix)', value: 925000, invest: 1000000, return: -7.5, color: '#ef4444' },
  { id: 3, name: 'Fund C (REITs)', value: 105000, invest: 100000, return: 5.0, color: '#10b981' },
]

const POINTS = {
  total: 1000,
  expiring: 0,
  list: [{ name: 'PayPayポイント', balance: 1000, expiry: '2027/1/22' }],
}

const DEMO_EXPENSES = [
  { id: 'demo-exp-1', spent_on: '2026-02-05', category: '食費', merchant: 'スーパーA', amount: 42000, payment_method: 'クレジットカード' },
  { id: 'demo-exp-2', spent_on: '2026-02-10', category: '交通', merchant: '通勤定期', amount: 18000, payment_method: 'モバイル決済' },
  { id: 'demo-exp-3', spent_on: '2026-01-20', category: 'ショッピング', merchant: '家電ストア', amount: 36000, payment_method: 'クレジットカード' },
  { id: 'demo-exp-4', spent_on: '2025-12-15', category: 'その他', merchant: 'サブスク', amount: 12000, payment_method: '口座振替' },
]

const DEMO_INSURANCES = [
  { id: 'demo-ins-1', product_name: '医療保険ライト', provider: 'ABC生命', monthly_premium: 7800, maturity_date: '2026-09-30', coverage_summary: '入院日額 1万円' },
  { id: 'demo-ins-2', product_name: '就業不能保険', provider: 'XYZ保険', monthly_premium: 5400, maturity_date: '2027-03-31', coverage_summary: '月額 15万円' },
]

const DEMO_POINT_ACCOUNTS = [
  { id: 'demo-pt-1', name: 'PayPayポイント', balance: 12400, expiry: '2026-11-30' },
  { id: 'demo-pt-2', name: '楽天ポイント', balance: 8600, expiry: '2026-08-31' },
]

const DEBT_INFO = {
  current: 35000000,
  remaining: 32000000,
  dti: 28.5,
  alerts: [
    { id: 1, type: 'opportunity', msg: '金利 0.3% 低いローンへの借り換えチャンス' },
    { id: 2, type: 'warning', msg: '来月、市場金利の上昇が見込まれます' },
  ],
}

const calcMonthlyPayment = (principal, annualRatePct, years) => {
  const monthlyRate = (annualRatePct / 100) / 12
  const months = years * 12
  if (principal <= 0 || months <= 0) return 0
  if (monthlyRate <= 0) return principal / months
  const factor = Math.pow(1 + monthlyRate, months)
  return (principal * monthlyRate * factor) / (factor - 1)
}

const buildAiSummaryReport = ({ totalReturnRate, dti, concentration, bestReturn }) => {
  const marketTone = totalReturnRate >= 8 ? '順調' : totalReturnRate >= 3 ? '中立' : '慎重'
  const riskScoreResult = calculateRiskScore({
    volatilityRisk: concentration,
    breadthRisk: Math.min(100, dti * 2),
    flowRisk: Math.max(0, 50 - totalReturnRate),
    fxRisk: 45,
  })
  const riskLevel = riskScoreResult.score >= 70 ? '低め' : riskScoreResult.score >= 40 ? '中程度' : 'やや高め'

  const actions = [
    concentration >= 55
      ? '単一テーマ集中が高めです。低相関アセットを含めた分散余地を確認する観点があります。'
      : '現状の分散は良好です。定期的に配分を確認し、急な比率変更の影響を見ておく観点があります。',
    dti >= 35
      ? '返済負担率が高めです。投資額と返済余力のバランス確認が重要です。'
      : '負債比率は許容範囲です。積立比率の見直し余地を確認できます。',
    bestReturn >= 20
      ? '高リターン銘柄の比率が大きくなっていないか、事前ルールと照らして確認できます。'
      : '登録したコストと保有の散らばりを、あとから見比べる材料になります。',
  ]

  const confidence = riskScoreResult.score >= 70 ? '高' : riskScoreResult.score >= 40 ? '中' : '中'

  return {
    marketTone,
    riskLevel,
    confidence,
    riskScore: riskScoreResult.score,
    riskStatus: riskScoreResult.status,
    actions,
  }
}

const buildDailyMarketBrief = (newsBrief, newsUpdatedAt) => {
  if (newsBrief?.headline) {
    return {
      dateLabel: new Date(newsUpdatedAt || Date.now()).toLocaleDateString('ja-JP'),
      tone: newsBrief.tone || '中立',
      headline: newsBrief.headline,
      note: newsBrief.note || '',
      source: newsBrief.source || 'TheNewsAPI',
    }
  }
  const today = new Date()
  const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
  const templates = [
    {
      tone: '中立',
      headline: '主要指数は方向感に欠ける一日',
      note: '材料待ち相場のため、分散とポジション管理を優先する局面です。',
    },
    {
      tone: 'やや強気',
      headline: '大型株中心に買いが優勢',
      note: '短期の過熱感に注意しつつ、押し目待ちの姿勢が有効です。',
    },
    {
      tone: 'やや慎重',
      headline: '金利・為替の変動が意識される展開',
      note: '値動きの大きい銘柄は比率管理を厳格にするのが安全です。',
    },
  ]
  const idx = Math.abs(
    dayKey.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  ) % templates.length
  return {
    dateLabel: today.toLocaleDateString('ja-JP'),
    source: 'Daily Template',
    ...templates[idx],
  }
}

/** X軸: 月/日（日本語で先に月）。未来の日付は含めない */
const formatAssetTrendMd = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const formatAssetTrendMonth = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月`
}
const formatAssetTrendLatestLabel = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return d.getDate() < lastDay ? formatAssetTrendMd(d) : formatAssetTrendMonth(d)
}

/** 単純2点モードの左ラベル（「保有開始」は紛らわしいので買付日が取れれば M/D） */
const trendChartStartLabel = (isoDateStr) => {
  const raw = String(isoDateStr || '').trim().slice(0, 10)
  if (!raw) return '開始'
  const p = new Date(`${raw}T12:00:00`)
  if (!Number.isFinite(p.getTime())) return '開始'
  return formatAssetTrendMd(p) || '開始'
}

const toLocalYmd = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

/** 株式の実現損益サマリー用。sell_date（YYYY-MM-DD）で絞り込み。暦年は cyYYYY（例: cy2026 = その年1/1〜12/31）。 */
const filterRealizedStockTradesByWindow = (trades, windowKey) => {
  const rows = Array.isArray(trades) ? trades : []
  if (!windowKey || windowKey === 'all') return rows
  const m = /^cy(\d{4})$/.exec(String(windowKey))
  if (m) {
    const y = m[1]
    const fromIso = `${y}-01-01`
    const toIso = `${y}-12-31`
    return rows.filter((t) => {
      const sd = toIsoDate(t.sellDate || '')
      return sd && sd >= fromIso && sd <= toIso
    })
  }
  return rows
}

const realizedPnlWindowLabelJaCompact = (windowKey) => {
  if (!windowKey || windowKey === 'all') return '全期間'
  const cy = /^cy(\d{4})$/.exec(String(windowKey))
  if (cy) return `${String(cy[1]).slice(-2)}年`
  return '全期間'
}

/** レポート「実現の期間」に出す暦年（ローンチ年のみなど。年が変わったら追記） */
const REALIZED_PNL_SELECT_CALENDAR_YEARS = [2026]

const parseIsoDateToLocalNoon = (iso) => {
  const raw = String(iso || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 同一カレンダー月の複数買付を1本の柱にまとめる（評価はその月の代表日＝月末 or 月内最遅買付） */
const collapseLotBuysToMonthlyAnchors = (isoDates, now = new Date()) => {
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
  const nowKey = toLocalYmd(todayLocal)
  const byYm = new Map()
  for (const iso of isoDates || []) {
    const raw = String(iso || '').trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) continue
    const ym = raw.slice(0, 7)
    const cur = byYm.get(ym)
    if (!cur || raw > cur) byYm.set(ym, raw)
  }
  const anchorIsos = []
  const labelByYmd = {}
  const sortedYm = [...byYm.keys()].sort()
  for (const ym of sortedYm) {
    const maxBuy = byYm.get(ym)
    const [y, mo] = ym.split('-').map(Number)
    const lastDayDate = new Date(y, mo, 0, 12, 0, 0)
    const lastDayStr = toLocalYmd(lastDayDate)
    const anchorStr = lastDayStr <= nowKey ? lastDayStr : maxBuy
    anchorIsos.push(anchorStr)
    labelByYmd[anchorStr] = `${mo}月`
  }
  return { anchorIsos, labelByYmd }
}

/**
 * 月次アンカーだけだと「同じ銘柄の2回目以降の買付」が軸から落ちる。
 * 各ロットの買付日を混ぜ、最後は必ず now（ライブ評価と揃える）。
 */
const mergeMonthEndsAndLotBuysIntoAnchors = ({
  monthEndAnchorDates,
  now,
  lotBuyIsoDates,
  lotMonthlyLabelByYmd = null,
  earliestBuyRaw,
}) => {
  const nowMs = now.getTime()
  let earliestYm = null
  if (earliestBuyRaw) {
    const p = new Date(`${String(earliestBuyRaw).trim().slice(0, 10)}T12:00:00`)
    if (Number.isFinite(p.getTime())) earliestYm = p.getFullYear() * 12 + p.getMonth()
  }
  const todayKey = toLocalYmd(now)
  const byDay = new Map()
  const consider = (d) => {
    if (!d || Number.isNaN(d.getTime())) return
    if (d.getTime() > nowMs) return
    if (earliestYm != null) {
      const ym = d.getFullYear() * 12 + d.getMonth()
      if (ym < earliestYm) return
    }
    const key = toLocalYmd(d)
    if (!key) return
    const prev = byDay.get(key)
    if (!prev || d.getTime() > prev.getTime()) byDay.set(key, d)
  }
  ;(monthEndAnchorDates || []).forEach(consider)
  ;(lotBuyIsoDates || []).forEach((iso) => {
    const d = parseIsoDateToLocalNoon(iso)
    if (!d) return
    if (toLocalYmd(d) === todayKey) return
    consider(d)
  })
  consider(now)
  const sorted = [...byDay.values()].sort((a, b) => a.getTime() - b.getTime())
  if (sorted.length < 2) return null
  const labels = sorted.map((d, idx) => {
    if (idx === sorted.length - 1) return formatAssetTrendLatestLabel(now)
    const k = toLocalYmd(d)
    if (lotMonthlyLabelByYmd && typeof lotMonthlyLabelByYmd[k] === 'string' && lotMonthlyLabelByYmd[k]) {
      return lotMonthlyLabelByYmd[k]
    }
    return formatAssetTrendMonth(d)
  })
  return { anchors: sorted, labels }
}

/**
 * 過去月はその月の最終日、今月は「今日」まで。未来月は出さない。
 * 既定は元本→現在評価の線形補間。保有タブでは stock_daily_prices を読み、
 * 各日付時点の保有ロット×その日前の終値で再評価した系列に置き換える。
 */
const buildAssetGrowthTrendData = (totalInvested, totalCurrentValue, opts = {}) => {
  const base = Math.max(0, Number(totalInvested || 0))
  const end = Math.max(0, Number(totalCurrentValue || 0))
  const earliestBuyRaw = opts.earliestBuyDate ? String(opts.earliestBuyDate).trim().slice(0, 10) : ''
  const now = new Date()
  const cst = Math.round(base)
  return [
    { month: trendChartStartLabel(earliestBuyRaw), value: base, costJpy: cst, pnlJpy: Math.round(base - cst) },
    { month: formatAssetTrendMd(now), value: end, costJpy: cst, pnlJpy: Math.round(end - cst) },
  ]
}

const buildAssetGrowthTrendSplitData = (stockInvested, stockCurrent, fundInvested, fundCurrent, opts = {}) => {
  const si = Math.max(0, Number(stockInvested || 0))
  const se = Math.max(0, Number(stockCurrent || 0))
  const fi = Math.max(0, Number(fundInvested || 0))
  const fe = Math.max(0, Number(fundCurrent || 0))
  const combinedBase = si + fi
  const combinedEnd = se + fe
  const template = buildAssetGrowthTrendData(combinedBase, combinedEnd, opts)
  const len = template.length
  return template.map((row, idx) => {
    const t = len > 1 ? idx / (len - 1) : 1
    const stockJpy = Math.max(0, Math.round(si + (se - si) * t))
    const fundJpy = Math.max(0, Math.round(fi + (fe - fi) * t))
    return { month: row.month, stockJpy, fundJpy }
  })
}

const closeOnOrBeforeSorted = (sortedRows, asOfIso) => {
  if (!asOfIso || !Array.isArray(sortedRows) || sortedRows.length === 0) return null
  let lo = 0
  let hi = sortedRows.length - 1
  let best = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const td = String(sortedRows[mid].trade_date || '')
    if (td <= asOfIso) {
      best = sortedRows[mid]
      lo = mid + 1
    } else hi = mid - 1
  }
  if (!best) return null
  const c = Number(best.close)
  return Number.isFinite(c) && c > 0 ? c : null
}

const lookupFxUsdJpyOn = (iso, fxMap) => {
  const found = fxOnOrBefore(iso, fxMap)
  return found?.rate > 0 ? found.rate : null
}

const shiftIsoDateByDays = (iso, days) => {
  const base = String(iso || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return ''
  const dt = new Date(`${base}T12:00:00`)
  if (Number.isNaN(dt.getTime())) return ''
  dt.setDate(dt.getDate() + Number(days || 0))
  return toLocalYmd(dt)
}

const resolveStockPriceOnDate = ({ lot, series, asOfIso }) => {
  const px = series ? closeOnOrBeforeSorted(series, asOfIso) : null
  if (Number.isFinite(px) && px > 0) return px
  // If daily market history is missing around buy date (timezone/holiday gaps),
  // fall back to the user's recorded buy price instead of dropping to zero.
  const buyPx = Number(lot?.buyPrice || 0)
  if (Number.isFinite(buyPx) && buyPx > 0) return buyPx
  return null
}

const computePortfolioValueOnDate = ({
  asOfIso,
  ownedStockItems,
  ownedFundItems,
  priceBySymbol,
  fxByDate,
  valuationUsdJpy,
}) => {
  if (!asOfIso) return 0
  const stockRows = Array.isArray(ownedStockItems) ? ownedStockItems : []
  const fundRows = Array.isArray(ownedFundItems) ? ownedFundItems : []
  let stockJpy = 0
  let fundJpy = 0

  for (const lot of stockRows) {
    const buyIso = toIsoDate(lot.buyDate || '')
    if (!buyIso || buyIso > asOfIso) continue
    const sym = String(lot.symbol || '').trim().toUpperCase()
    if (!sym) continue
    const qty = Math.max(0, Number(lot.qty || 0))
    if (qty <= 0) continue
    const series = priceBySymbol.get(sym)
    const px = resolveStockPriceOnDate({ lot, series, asOfIso })
    if (!px) continue
    const cur = inferStockCurrency(sym)
    const nativeVal = qty * px
    if (cur === 'USD') {
      const r = lookupFxUsdJpyOn(asOfIso, fxByDate)
      if (!(r > 0)) continue
      stockJpy += nativeVal * r
    } else {
      stockJpy += toJpy(nativeVal, cur)
    }
  }

  for (const lot of fundRows) {
    const buyIso = toIsoDate(lot.buyDate || lot.buy_date || '')
    if (!buyIso || buyIso > asOfIso) continue
    const sym = String(lot.symbol || '').trim().toUpperCase()
    if (!sym) continue
    const invest = Math.max(0, Number(lot.investAmount || lot.invest_amount || 0))
    const buyPx = Math.max(0, Number(lot.buyPrice || lot.buy_price || 0))
    const units = buyPx > 0 ? invest / buyPx : 0
    if (units <= 0) continue
    const series = priceBySymbol.get(sym)
    const px = series ? closeOnOrBeforeSorted(series, asOfIso) : null
    if (!px) continue
    const cur = inferStockCurrency(sym)
    const nativeVal = units * px
    if (cur === 'USD') {
      const r = lookupFxUsdJpyOn(asOfIso, fxByDate)
      if (!(r > 0)) continue
      fundJpy += nativeVal * r
    } else {
      fundJpy += toJpy(nativeVal, cur)
    }
  }

  return Math.max(0, stockJpy + fundJpy)
}

const ownedStockLotCostJpy = (lot, sym, fxByDate) => {
  const s = String(sym || lot?.symbol || '').trim().toUpperCase()
  const q = Math.max(0, Number(lot?.qty || 0))
  const buy = Math.max(0, Number(lot?.buyPrice || 0))
  if (!q || !s) return 0
  const row = { ...lot, symbol: s }
  const ccy = resolveLotCurrency(row, lot?.price)
  if (!ccy) return 0
  if (ccy === 'USD') {
    const stored = Number(row?.buyFxRate)
    if (!(stored > 0)) return 0
    return q * buy * stored
  }
  if (ccy === 'JPY') return q * buy
  return toJpy(q * buy, ccy)
}

const ownedFundLotCostJpy = (lot, fxByDate) => {
  const invest = Math.max(0, Number(lot.investAmount || lot.invest_amount || 0))
  if (invest <= 0) return 0
  const sym = String(lot.symbol || '').trim().toUpperCase()
  const fundCurrency = inferStockCurrency(sym)
  if (fundCurrency === 'USD') {
    const stored = Number(lot?.buyFxRate)
    if (!(stored > 0)) return 0
    return invest * stored
  }
  return toJpy(invest, fundCurrency)
}

/** 売却代金（円）。USD 株は sell 日の USD/JPY（無ければフォールバック）。 */
const stockSaleProceedsJpy = (symbol, qty, sellPrice, sellDateIso, fxByDate) => {
  const sym = String(symbol || '').trim().toUpperCase()
  const q = Math.max(0, Number(qty || 0))
  const px = Math.max(0, Number(sellPrice || 0))
  if (!q || !px || !sym) return 0
  const cur = inferStockCurrency(sym)
  const native = q * px
  if (cur === 'USD') {
    const d = toIsoDate(sellDateIso || '')
    const found = fxOnOrBefore(d, fxByDate)
    if (!(found?.rate > 0)) return null
    return native * found.rate
  }
  return toJpy(native, cur)
}

/**
 * FIFO で売却数量を切り出し、売却部分の取得原価（円）を合算。残りロットで owned を置き換え。
 */
const fifoStockSellFromLots = ({ symbol, sellQty, ownedLots, fxByDate }) => {
  const symU = String(symbol || '').trim().toUpperCase()
  const wantRaw = Math.max(0, Number(sellQty || 0))
  if (!symU || !Number.isFinite(wantRaw) || wantRaw <= 0) {
    return { ok: false, reason: '売却数量を入力してください。' }
  }
  const symLots = (Array.isArray(ownedLots) ? ownedLots : []).filter(
    (l) => String(l?.symbol || '').trim().toUpperCase() === symU,
  )
  const totalAvail = symLots.reduce((s, l) => s + Math.max(0, Number(l?.qty || 0)), 0)
  const tol = Math.max(1e-9, 1e-12 * Math.max(1, totalAvail))
  if (wantRaw > totalAvail + tol) {
    return { ok: false, reason: '保有数量が不足しています。数量またはロットを確認してください。' }
  }
  const want = Math.min(wantRaw, totalAvail)
  const sorted = [...symLots].sort((a, b) => {
    const da = toIsoDate(a.buyDate || '') || '9999-12-31'
    const db = toIsoDate(b.buyDate || '') || '9999-12-31'
    return da.localeCompare(db)
  })
  let remaining = want
  let costBasisJpy = 0
  const buyLots = []
  const updatedSymLots = []
  for (const lot of sorted) {
    const q = Math.max(0, Number(lot.qty || 0))
    if (q <= 0) continue
    if (remaining <= 0) {
      updatedSymLots.push(lot)
      continue
    }
    const take = Math.min(remaining, q)
    const frac = q > 0 ? take / q : 0
    const portionCost = ownedStockLotCostJpy(lot, symU, fxByDate) * frac
    costBasisJpy += portionCost
    const buyDate = toIsoDate(lot.buyDate || lot.buy_date || '')
    if (buyDate && take > 0) buyLots.push({ buyDate, qty: take, costJpy: portionCost })
    remaining -= take
    const left = q - take
    if (left > 1e-9) {
      updatedSymLots.push({
        ...lot,
        qty: left,
      })
    }
  }
  const otherLots = (Array.isArray(ownedLots) ? ownedLots : []).filter(
    (l) => String(l?.symbol || '').trim().toUpperCase() !== symU,
  )
  const updatedOwned = normalizeOwnedLots([...otherLots, ...updatedSymLots])
  return { ok: true, updatedOwned, costBasisJpy, sellQty: want, buyLots }
}

/**
 * ファンド: 投資元本÷買付価格＝口数。FIFO で売却口数を切り出し、売却分の取得原価（円）を合算。
 */
const fifoFundSellFromLots = ({ symbol, sellUnits, ownedFundLots, fxByDate }) => {
  const symU = String(symbol || '').trim().toUpperCase()
  const wantRaw = Math.max(0, Number(sellUnits || 0))
  if (!symU || !Number.isFinite(wantRaw) || wantRaw <= 0) {
    return { ok: false, reason: '売却口数を入力してください。' }
  }
  const lotUnits = (lot) => {
    const invest = Math.max(0, Number(lot?.investAmount ?? lot?.invest_amount ?? 0))
    const buyP = Math.max(0, Number(lot?.buyPrice ?? lot?.buy_price ?? 0))
    return buyP > 0 ? invest / buyP : 0
  }
  const symLots = (Array.isArray(ownedFundLots) ? ownedFundLots : []).filter(
    (l) => String(l?.symbol || '').trim().toUpperCase() === symU,
  )
  const totalAvail = symLots.reduce((s, l) => s + lotUnits(l), 0)
  const tol = Math.max(1e-9, 1e-12 * Math.max(1, totalAvail))
  if (wantRaw > totalAvail + tol) {
    return { ok: false, reason: '保有口数が不足しています。投資元本・買付価格またはロットを確認してください。' }
  }
  let want = Math.min(wantRaw, totalAvail)
  if (totalAvail > 0) {
    const gap = totalAvail - want
    if (gap >= 0 && (gap <= tol || gap / totalAvail <= 1e-12)) want = totalAvail
  }
  const sorted = [...symLots].sort((a, b) => {
    const da = toIsoDate(a.buyDate || a.buy_date || '') || '9999-12-31'
    const db = toIsoDate(b.buyDate || b.buy_date || '') || '9999-12-31'
    return da.localeCompare(db)
  })
  let remaining = want
  let costBasisJpy = 0
  const buyLots = []
  const updatedSymLots = []
  for (const lot of sorted) {
    const q = lotUnits(lot)
    if (q <= 0) {
      updatedSymLots.push(lot)
      continue
    }
    if (remaining <= 0) {
      updatedSymLots.push(lot)
      continue
    }
    const take = Math.min(remaining, q)
    const frac = q > 0 ? take / q : 0
    const portionCost = ownedFundLotCostJpy(lot, fxByDate) * frac
    costBasisJpy += portionCost
    const buyDate = toIsoDate(lot.buyDate || lot.buy_date || '')
    if (buyDate && take > 0) buyLots.push({ buyDate, qty: take, costJpy: portionCost })
    remaining -= take
    const invest = Math.max(0, Number(lot.investAmount ?? lot.invest_amount ?? 0))
    const buyP = Math.max(0, Number(lot.buyPrice ?? lot.buy_price ?? 0))
    const newInvest = invest * (1 - frac)
    const qRemain = q - take
    const negligibleUnits =
      qRemain <= Math.max(1e-14, 1e-14 * Math.max(1, q)) || newInvest <= Math.max(1e-10, invest * 1e-14)
    if (negligibleUnits) {
      continue
    }
    if (newInvest > 1e-6) {
      updatedSymLots.push({
        ...lot,
        investAmount: newInvest,
      })
    }
  }
  const otherLots = (Array.isArray(ownedFundLots) ? ownedFundLots : []).filter(
    (l) => String(l?.symbol || '').trim().toUpperCase() !== symU,
  )
  const updatedOwned = normalizeOwnedFundAmounts([...otherLots, ...updatedSymLots])
  return { ok: true, updatedOwned, costBasisJpy, sellUnits: want, buyLots }
}

/** buildAssetGrowthTrendData と同じ日付軸（アンカー + ラベル） */
const collectTrendAnchorsFromOpts = (opts = {}) => {
  const simplified = opts.simplified === true
  const nPoints = Math.max(2, Math.min(36, Number(opts.months) || 6))
  const earliestBuyRaw = opts.earliestBuyDate ? String(opts.earliestBuyDate).trim().slice(0, 10) : ''
  const now = new Date()

  if (simplified) {
    const d0 = earliestBuyRaw ? new Date(`${earliestBuyRaw}T12:00:00`) : null
    if (!d0 || Number.isNaN(d0.getTime())) {
      return {
        anchors: [now, now],
        labels: [formatAssetTrendLatestLabel(now), formatAssetTrendLatestLabel(now)],
      }
    }
    return {
      anchors: [d0, now],
      labels: [trendChartStartLabel(earliestBuyRaw), formatAssetTrendLatestLabel(now)],
    }
  }

  let earliestYm = null
  if (earliestBuyRaw) {
    const parsed = new Date(`${earliestBuyRaw}T12:00:00`)
    if (Number.isFinite(parsed.getTime())) {
      earliestYm = parsed.getFullYear() * 12 + parsed.getMonth()
    }
  }

  const y = now.getFullYear()
  const m = now.getMonth()
  const monthEndAnchors = []
  for (let k = nPoints - 1; k >= 1; k -= 1) {
    const firstOfMonth = new Date(y, m - k, 1)
    const lastDay = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 0)
    if (lastDay.getTime() > now.getTime()) continue
    const lastYm = lastDay.getFullYear() * 12 + lastDay.getMonth()
    if (earliestYm != null && lastYm < earliestYm) continue
    monthEndAnchors.push(lastDay)
  }

  const mergedAnchors = mergeMonthEndsAndLotBuysIntoAnchors({
    monthEndAnchorDates: monthEndAnchors,
    now,
    lotBuyIsoDates: Array.isArray(opts.lotBuyIsoDates) ? opts.lotBuyIsoDates : [],
    lotMonthlyLabelByYmd: opts.lotMonthlyLabelByYmd && typeof opts.lotMonthlyLabelByYmd === 'object' ? opts.lotMonthlyLabelByYmd : null,
    earliestBuyRaw,
  })
  let anchors = mergedAnchors ? mergedAnchors.anchors : [...monthEndAnchors, now]
  let labels = mergedAnchors
    ? mergedAnchors.labels
    : anchors.map((d, idx) => (idx === anchors.length - 1 ? formatAssetTrendLatestLabel(now) : formatAssetTrendMonth(d)))

  // Same month can be inserted twice (month-end + current day),
  // which looks like duplicated labels such as "4月" and "4/10".
  // Keep only one point per year-month, preferring the later anchor.
  if (anchors.length >= 2) {
    const compactAnchors = []
    const compactLabels = []
    for (let i = 0; i < anchors.length; i += 1) {
      const d = anchors[i]
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const prev = compactAnchors.length > 0 ? compactAnchors[compactAnchors.length - 1] : null
      const prevKey = prev ? `${prev.getFullYear()}-${prev.getMonth()}` : ''
      if (prev && prevKey === key) {
        compactAnchors[compactAnchors.length - 1] = d
        compactLabels[compactLabels.length - 1] = labels[i]
      } else {
        compactAnchors.push(d)
        compactLabels.push(labels[i])
      }
    }
    anchors = compactAnchors
    labels = compactLabels
  }

  if (anchors.length < 2) {
    const d0 = earliestBuyRaw ? new Date(`${earliestBuyRaw}T12:00:00`) : new Date(y, m, 1)
    anchors = [d0, now]
    labels = [trendChartStartLabel(earliestBuyRaw), formatAssetTrendLatestLabel(now)]
  }
  return { anchors, labels }
}

/**
 * 各アンカー: 買付日≦アンカーのロットのみ × その日以前の終値で円換算。
 * 最終アンカーは一覧の最新評価（ライブ）に合わせる。
 */
const computeHistoricalWealthTrendSeries = ({
  anchorPack,
  ownedStockItems,
  ownedFundItems,
  priceBySymbol,
  fxByDate,
  valuationUsdJpy,
  liveStockJpy,
  liveFundJpy,
  splits = [],
  trades = [],
}) => {
  const { anchors, labels } = anchorPack
  const stockRows = Array.isArray(ownedStockItems) ? ownedStockItems : []
  const fundRows = Array.isArray(ownedFundItems) ? ownedFundItems : []

  const split = anchors.map((anchorDate, idx) => {
    const anchorIso = toLocalYmd(anchorDate)
    const isLast = idx === anchors.length - 1
    if (isLast) {
      const ls = Math.max(0, Math.round(Number(liveStockJpy || 0)))
      const lf = Math.max(0, Math.round(Number(liveFundJpy || 0)))
      let stockCostJpy = 0
      let fundCostJpy = 0
      for (const lot of stockRows) {
        stockCostJpy += ownedStockLotCostJpy(lot, lot.symbol, fxByDate)
      }
      for (const lot of fundRows) {
        fundCostJpy += ownedFundLotCostJpy(lot, fxByDate)
      }
      return {
        month: labels[idx],
        stockJpy: ls,
        fundJpy: lf,
        stockCostJpy: Math.round(stockCostJpy),
        fundCostJpy: Math.round(fundCostJpy),
      }
    }
    let stockJpy = 0
    let fundJpy = 0
    let stockCostJpy = 0
    let fundCostJpy = 0

    for (const lot of stockRows) {
      const buyIso = toIsoDate(lot.buyDate || '')
      if (!buyIso || buyIso > anchorIso) continue
      const sym = String(lot.symbol || '').trim().toUpperCase()
      if (!sym) continue
      const rawQty = Math.max(0, Number(lot.qty || 0))
      const ratio = splitRatioAfter(buyIso, sym, splits)
      const qty = rawQty * ratio
      if (qty <= 0) continue
      const series = priceBySymbol.get(sym)
      const adjustedBuy = ratio > 0 ? Number(lot.buyPrice || 0) / ratio : Number(lot.buyPrice || 0)
      const px = resolveStockPriceOnDate({ lot: { ...lot, buyPrice: adjustedBuy }, series, asOfIso: anchorIso })
      if (!px) continue
      const cur = inferStockCurrency(sym)
      const nativeVal = qty * px
      if (cur === 'USD') {
        const r = lookupFxUsdJpyOn(anchorIso, fxByDate)
        if (r > 0) stockJpy += nativeVal * r
      } else if (cur === 'JPY') {
        stockJpy += nativeVal
      }
      stockCostJpy += ownedStockLotCostJpy(lot, sym, fxByDate)
    }

    for (const lot of fundRows) {
      const buyIso = toIsoDate(lot.buyDate || lot.buy_date || '')
      if (!buyIso || buyIso > anchorIso) continue
      const sym = String(lot.symbol || '').trim().toUpperCase()
      if (!sym) continue
      const invest = Math.max(0, Number(lot.investAmount || lot.invest_amount || 0))
      const buyPx = Math.max(0, Number(lot.buyPrice || lot.buy_price || 0))
      const units = buyPx > 0 ? invest / buyPx : 0
      if (units <= 0) continue
      const series = priceBySymbol.get(sym)
      const px = series ? closeOnOrBeforeSorted(series, anchorIso) : null
      if (!px) continue
      const cur = inferStockCurrency(sym)
      const nativeVal = units * px
      if (cur === 'USD') {
        const r = lookupFxUsdJpyOn(anchorIso, fxByDate)
        if (r > 0) fundJpy += nativeVal * r
      } else if (cur === 'JPY') {
        fundJpy += nativeVal
      }
      fundCostJpy += ownedFundLotCostJpy(lot, fxByDate)
    }

    for (const trade of Array.isArray(trades) ? trades : []) {
      const sell = toIsoDate(trade.sellDate || trade.sell_date || '')
      if (!sell || anchorIso >= sell) continue
      const sym = String(trade.symbol || '').trim().toUpperCase()
      const soldLots = Array.isArray(trade.buyLots) ? trade.buyLots : []
      for (const sold of soldLots) {
        const buy = toIsoDate(sold.buyDate || sold.buy_date || '')
        if (!buy || buy > anchorIso) continue
        const soldQty = Number(sold.qty)
        const soldCost = Number(sold.costJpy ?? sold.cost_jpy)
        if (!(soldQty > 0)) continue
        const series = priceBySymbol.get(sym)
        const px = series ? closeOnOrBeforeSorted(series, anchorIso) : null
        const price = px || (Number.isFinite(soldCost) && soldCost > 0 ? soldCost / soldQty : 0)
        if (!(price > 0)) continue
        const cur = inferStockCurrency(sym)
        let value = soldQty * price
        if (cur === 'USD') {
          const r = lookupFxUsdJpyOn(anchorIso, fxByDate)
          if (!(r > 0)) continue
          value *= r
        } else if (cur !== 'JPY') {
          continue
        }
        if (trade.kind === 'fund') {
          fundJpy += value
          fundCostJpy += Number.isFinite(soldCost) ? soldCost : 0
        } else {
          stockJpy += value
          stockCostJpy += Number.isFinite(soldCost) ? soldCost : 0
        }
      }
    }

    return {
      month: labels[idx],
      stockJpy: Math.max(0, Math.round(stockJpy)),
      fundJpy: Math.max(0, Math.round(fundJpy)),
      stockCostJpy: Math.round(stockCostJpy),
      fundCostJpy: Math.round(fundCostJpy),
    }
  })

  const assetGrowthData = split.map((r) => {
    const sv = Math.max(0, Math.round((r.stockJpy || 0) + (r.fundJpy || 0)))
    const sc = Number.isFinite(r.stockCostJpy) ? Number(r.stockCostJpy) : 0
    const fc = Number.isFinite(r.fundCostJpy) ? Number(r.fundCostJpy) : 0
    const pnlJpy = (r.stockJpy || 0) - sc + (r.fundJpy || 0) - fc
    return {
      month: r.month,
      value: sv,
      pnlJpy: Math.round(pnlJpy),
    }
  })

  const stockGrowthData = split.map((r, idx) => {
    const v = idx === split.length - 1
      ? Math.max(0, Math.round(Number(liveStockJpy || 0)))
      : Math.max(0, Math.round(r.stockJpy || 0))
    const c = Number.isFinite(r.stockCostJpy) ? Number(r.stockCostJpy) : 0
    const ci = Math.round(c)
    return {
      month: r.month,
      value: v,
      costJpy: ci,
      pnlJpy: Math.round(v - ci),
    }
  })

  const fundGrowthData = split.map((r, idx) => {
    const v = idx === split.length - 1
      ? Math.max(0, Math.round(Number(liveFundJpy || 0)))
      : Math.max(0, Math.round(r.fundJpy || 0))
    const c = Number.isFinite(r.fundCostJpy) ? Number(r.fundCostJpy) : 0
    const ci = Math.round(c)
    return {
      month: r.month,
      value: v,
      costJpy: ci,
      pnlJpy: Math.round(v - ci),
    }
  })

  return { assetGrowthSplitData: split, assetGrowthData, stockGrowthData, fundGrowthData }
}

const getAssetGrowthYAxisDomainSplit = (data = []) => {
  const sums = (Array.isArray(data) ? data : [])
    .map((row) => Number(row?.stockJpy || 0) + Number(row?.fundJpy || 0))
    .filter((v) => Number.isFinite(v))
  if (sums.length === 0) return [0, 100000]
  const minValue = Math.min(...sums)
  const maxValue = Math.max(...sums)
  const range = Math.max(1, maxValue - minValue)
  const padding = Math.max(30000, Math.round(range * 0.45))
  const lower = Math.max(0, minValue - padding)
  const upper = Math.max(lower + 50000, maxValue + padding)
  return [lower, upper]
}

/** 資産タブ・積み上げ棒: ホバーで内訳＋合計（コンパクト） */
const AssetGrowthSplitTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  let fundJpy = 0
  let stockJpy = 0
  for (const p of payload) {
    if (p.dataKey === 'fundJpy') fundJpy = Number(p.value || 0)
    if (p.dataKey === 'stockJpy') stockJpy = Number(p.value || 0)
  }
  const total = fundJpy + stockJpy
  const yen = (n) => `¥${Math.round(Number(n) || 0).toLocaleString('ja-JP')}`
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 shadow-sm max-w-[11rem]">
      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight mb-0.5">{String(label ?? '')}</p>
      <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 tabular-nums leading-snug">ファンド {yen(fundJpy)}</p>
      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums leading-snug">株式 {yen(stockJpy)}</p>
      <p className="mt-0.5 pt-0.5 border-t border-slate-100 dark:border-slate-700 text-[11px] font-black text-slate-900 dark:text-white tabular-nums leading-snug">合計 {yen(total)}</p>
    </div>
  )
}

const getAssetGrowthYAxisDomain = (data = []) => {
  const values = data
    .map((item) => Number(item?.value))
    .filter((value) => Number.isFinite(value))

  if (values.length === 0) return [0, 100000]

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = Math.max(1, maxValue - minValue)
  const padding = Math.max(30000, Math.round(range * 0.45))
  const lower = Math.max(0, minValue - padding)
  const upper = Math.max(lower + 50000, maxValue + padding)

  return [lower, upper]
}

/** 株式パフォーマンス: 棒の高さは max(評価, 原価)（含み益・含み損の積み上げ） */
const getStockPerformanceYAxisDomain = (data = []) => {
  const rows = Array.isArray(data) ? data : []
  const heights = rows
    .map((r) => {
      const v = Math.max(0, Number(r?.value))
      let c = Number(r?.costJpy)
      if (!Number.isFinite(c)) {
        const p = Number(r?.pnlJpy)
        c = Number.isFinite(v) && Number.isFinite(p) ? v - p : NaN
      }
      if (!Number.isFinite(v)) return null
      if (!Number.isFinite(c)) c = v
      c = Math.max(0, c)
      return Math.max(v, c)
    })
    .filter((h) => h != null && Number.isFinite(h))
  if (heights.length === 0) return [0, 100000]
  const minValue = Math.min(...heights)
  const maxValue = Math.max(...heights)
  const range = Math.max(1, maxValue - minValue)
  const padding = Math.max(30000, Math.round(range * 0.45))
  const lower = Math.max(0, minValue - padding)
  const upper = Math.max(lower + 50000, maxValue + padding)
  return [lower, upper]
}

const StockPerformanceStackTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  const v = Math.max(0, Math.round(Number(row?.value || 0)))
  let c = Number(row?.costJpy)
  if (!Number.isFinite(c)) {
    const p = Number(row?.pnlJpy)
    c = Number.isFinite(p) ? v - p : NaN
  }
  if (!Number.isFinite(c)) c = v
  c = Math.max(0, Math.round(c))
  const pnl = v - c
  const basisJpy = Number(row?.basisJpy)
  const gainJpy = Number(row?.gainJpy)
  const lossJpy = Number(row?.lossJpy)
  const yen = (n) => `¥${Math.round(Number(n) || 0).toLocaleString('ja-JP')}`
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 shadow-sm max-w-[14rem]">
      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight mb-1">{String(label ?? '')}</p>
      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums leading-snug">
        評価合計 {yen(v)}
      </p>
      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums leading-snug">
        取得原価 {yen(c)}
      </p>
      {Number.isFinite(basisJpy) && Number.isFinite(gainJpy) && gainJpy > 0 ? (
        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 tabular-nums leading-snug">
          原価（下段） {yen(basisJpy)} · 含み益 {yen(gainJpy)}
        </p>
      ) : null}
      {Number.isFinite(basisJpy) && Number.isFinite(lossJpy) && lossJpy > 0 ? (
        <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 tabular-nums leading-snug">
          評価（下段） {yen(basisJpy)} · 含み損 {yen(lossJpy)}
        </p>
      ) : null}
      <p className={`mt-1 pt-1 border-t border-slate-100 dark:border-slate-700 text-[11px] font-black tabular-nums leading-snug ${signedReturnTextClassStrong(pnl)}`}>
        含み損益 {pnl >= 0 ? '+' : ''}{yen(pnl)}
      </p>
    </div>
  )
}

const DTI_THRESHOLD = 35
const DTI_VISUAL_MAX = 60
const MOCK_SWAP_UNIT_YEN = 600
const ENABLE_SERVER_RECEIPT_OCR = true

const getDtiMeta = (value) => {
  const dti = Number.isFinite(Number(value)) ? Number(value) : 0
  if (dti <= 20) {
    return {
      label: '健全',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    }
  }
  if (dti <= DTI_THRESHOLD) {
    return {
      label: '注意',
      textClass: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    }
  }
  return {
    label: '警戒',
    textClass: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
  }
}

const isFallbackMerchantValue = (value) => {
  const t = String(value || '').trim()
  return !t || t === 'レシート支出' || t.toLowerCase() === 'unknown'
}
const isLikelyInvalidOcrDate = (value) => {
  const t = String(value || '').trim()
  if (!t) return true
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return true
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return true
  if (y < 2020 || y > 2100) return true
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return true
  return false
}

const normalizeReceiptText = (text) => (
  String(text || '')
    .normalize('NFKC')
    .replace(/\r/g, '\n')
    .replace(/\u3000/g, ' ')
    .replace(/[，]/g, ',')
    .replace(/[．]/g, '.')
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    // OCR often confuses 1/0 with I/l/O in numeric contexts.
    .replace(/(?<=\d)[Il|](?=\d)/g, '1')
    .replace(/(?<=\d)[oO](?=\d)/g, '0')
)

const MERCHANT_ALIAS_RULES = [
  {
    canonical: 'マツモトキヨシ',
    aliases: [
      /マ.?ツ.?モ.?ト.?キ.?ヨ.?シ/i,
      /matsumoto\s*kiyoshi/i,
      /matsukiyo/i,
      /マツキヨ/i,
    ],
    contextHints: [/ミーナ\s*天神店/, /親切なお店/, /マツモトキヨシ九州販売/, /092-741-2888/],
    branchName: 'マツモトキヨシ ミーナ天神店',
  },
  {
    canonical: 'セリア',
    aliases: [/([sc5]eria|s[e3]ria|s\s*e\s*r\s*i\s*a|セリア|ｾﾘｱ)/i],
  },
  {
    canonical: 'ダイソー',
    aliases: [/(daiso|ダイソー|大創)/i],
  },
  {
    canonical: 'キャンドゥ',
    aliases: [/(can\s*do|cando|キャンドゥ)/i],
  },
  {
    canonical: 'ローソン',
    aliases: [/(lawson|ローソン)/i],
  },
  {
    canonical: 'ファミリーマート',
    aliases: [/(family\s*mart|familymart|ファミマ|ファミリーマート)/i],
  },
  {
    canonical: 'セブン-イレブン',
    aliases: [/(7[-\s]?11|seven\s*eleven|セブン-?イレブン)/i],
  },
  {
    canonical: 'イオン',
    aliases: [/(aeon|イオン)/i],
  },
]

const normalizeMerchantName = (rawMerchant = '', fullContext = '') => {
  const raw = String(rawMerchant || '').trim()
  if (isFallbackMerchantValue(raw)) return ''
  const cleaned = raw
    .replace(/^\s*(親切なお店|ご利用店舗)\s*/i, '')
    .replace(/\s+\d{1,3}\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (isFallbackMerchantValue(cleaned)) return ''

  const normalizedContext = normalizeReceiptText(fullContext)
  const textForMatch = `${normalizeReceiptText(cleaned)}\n${normalizedContext}`

  for (const rule of MERCHANT_ALIAS_RULES) {
    const aliasHit = rule.aliases.some((regex) => regex.test(textForMatch))
    if (!aliasHit) continue
    if (rule.contextHints?.length && rule.branchName) {
      const contextHit = rule.contextHints.some((regex) => regex.test(textForMatch))
      if (contextHit) return rule.branchName
    }
    return rule.canonical
  }
  return cleaned
}

const countJapaneseChars = (text = '') => {
  const m = String(text).match(/[\u3040-\u30ff\u3400-\u9fff]/g)
  return m ? m.length : 0
}

const isLikelyNoiseLine = (line = '') => {
  const trimmed = String(line || '').trim()
  if (!trimmed) return true
  if (trimmed.length < 2) return true
  if (/^[\d\s\-:/.]+$/.test(trimmed)) return true
  if (/^[A-Z](\s+[A-Z]){3,}$/i.test(trimmed)) return true
  if (/^[^A-Za-z\u3040-\u30ff\u3400-\u9fff]{3,}$/.test(trimmed)) return true
  const jpCount = countJapaneseChars(trimmed)
  const alphaCount = (trimmed.match(/[A-Za-z]/g) || []).length
  if (jpCount === 0 && alphaCount > 0 && alphaCount >= Math.max(6, Math.floor(trimmed.length * 0.7))) return true
  return false
}

const isHeicFile = (file) => {
  const type = String(file?.type || '').toLowerCase()
  const name = String(file?.name || '').toLowerCase()
  return type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')
}

const convertHeicFileToJpegBlob = async (file) => {
  const heic2any = (await import('heic2any')).default
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.95,
  })
  const blob = Array.isArray(converted) ? converted[0] : converted
  if (!(blob instanceof Blob)) throw new Error('HEIC_CONVERT_FAILED')
  return blob
}

const loadImageElementFromBlob = (blob) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    URL.revokeObjectURL(url)
    resolve(img)
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('IMAGE_DECODE_FAILED'))
  }
  img.src = url
})

const preprocessReceiptImageForOcr = async (file) => {
  if (!file) throw new Error('NO_FILE')
  try {
    let sourceBlob = file
    if (isHeicFile(file)) {
      sourceBlob = await convertHeicFileToJpegBlob(file)
    }
    let width = 0
    let height = 0
    let drawSource = null
    try {
      const bitmap = await createImageBitmap(sourceBlob)
      width = bitmap.width
      height = bitmap.height
      drawSource = bitmap
    } catch {
      const imgEl = await loadImageElementFromBlob(sourceBlob)
      width = imgEl.naturalWidth || imgEl.width
      height = imgEl.naturalHeight || imgEl.height
      drawSource = imgEl
    }
    const scale = Math.min(3, Math.max(1.6, 1800 / Math.max(width, 1)))
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('NO_CANVAS_CTX')

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(drawSource, 0, 0, width, height)

    // OCR 정확도를 올리기 위해 밝기/대비를 정리한 흑백 이미지로 변환.
    const img = ctx.getImageData(0, 0, width, height)
    const { data } = img
    let luminanceSum = 0
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114)
      luminanceSum += lum
    }
    const avgLum = luminanceSum / Math.max(1, data.length / 4)
    const threshold = Math.max(120, Math.min(205, avgLum * 0.92))
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114)
      const v = lum >= threshold ? 255 : 0
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
    })
    if (!blob) throw new Error('PREPROCESS_FAILED')
    return blob
  } catch (err) {
    if (isHeicFile(file)) throw new Error('HEIC_PREPROCESS_FAILED')
    throw err
  }
}

const blobToBase64 = async (blob) => {
  const buffer = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const TEXTRACT_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/pdf',
])

const guessMimeFromName = (file) => {
  const name = String(file?.name || '').toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.tif') || name.endsWith('.tiff')) return 'image/tiff'
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.bmp')) return 'image/bmp'
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic'
  return ''
}

const convertImageBlobToJpegBlob = async (blob, maxEdge = 2600) => {
  let width = 0
  let height = 0
  let drawSource = null
  try {
    const bitmap = await createImageBitmap(blob)
    width = bitmap.width
    height = bitmap.height
    drawSource = bitmap
  } catch {
    const imgEl = await loadImageElementFromBlob(blob)
    width = imgEl.naturalWidth || imgEl.width
    height = imgEl.naturalHeight || imgEl.height
    drawSource = imgEl
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('NO_CANVAS_CTX')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.drawImage(drawSource, 0, 0, targetW, targetH)
  const out = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
  })
  if (!(out instanceof Blob)) throw new Error('JPEG_CONVERT_FAILED')
  return out
}

const prepareReceiptBlobForServer = async (file) => {
  if (!file) throw new Error('NO_FILE')
  const mime = String(file?.type || '').toLowerCase() || guessMimeFromName(file)
  if (mime === 'application/pdf') {
    return file
  }
  if (mime.startsWith('image/')) {
    const source = isHeicFile(file)
      ? await convertHeicFileToJpegBlob(file)
      : file
    // Normalize every image upload into JPEG to avoid provider-side format edge cases.
    return convertImageBlobToJpegBlob(source)
  }
  if (TEXTRACT_ALLOWED_MIME.has(mime)) return file
  throw new Error(`UNSUPPORTED_RECEIPT_FORMAT:${mime || 'unknown'}`)
}

const extractExpenseByServerOcr = async (file) => {
  const blob = await prepareReceiptBlobForServer(file)
  const imageBase64 = await blobToBase64(blob)
  const mimeType = blob.type || 'image/jpeg'
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token || ''
  const resp = await fetch('/api/ocr/receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      imageBase64,
      mimeType,
    }),
  })
  const json = await resp.json()
  if (!resp.ok || !json?.ok) {
    throw new Error(json?.error || 'SERVER_OCR_FAILED')
  }
  const parsed = json?.parsed || {}
  const parsedByText = buildExpenseFromReceiptText(
    String(json?.rawText || ''),
    Array.isArray(json?.words) ? json.words : []
  )
  const parsedMerchant = String(parsed?.merchant || '').trim()
  const textMerchant = String(parsedByText?.merchant || '').trim()
  const finalMerchantRaw = !isFallbackMerchantValue(parsedMerchant)
    ? parsedMerchant
    : (!isFallbackMerchantValue(textMerchant) ? textMerchant : '')
  const finalMerchant = normalizeMerchantName(
    finalMerchantRaw,
    `${String(json?.rawText || '')}\n${textMerchant}`
  )
  const parsedAmountNum = Number(parsed?.amount || 0)
  const textAmountNum = Number(parsedByText?.amount || 0)
  // Trust server OCR amount first. Text parsing is fallback-only.
  const finalAmount = parsedAmountNum > 0
    ? String(Math.round(parsedAmountNum))
    : (textAmountNum > 0 ? String(Math.round(textAmountNum)) : '')
  const parsedDate = String(parsed?.spent_on || '').trim()
  const textDate = String(parsedByText?.spent_on || '').trim()
  const finalDate = isLikelyInvalidOcrDate(parsedDate)
    ? (isLikelyInvalidOcrDate(textDate) ? '' : textDate)
    : parsedDate
  return {
    category: parsedByText.category || 'その他',
    merchant: finalMerchant,
    amount: finalAmount,
    payment_method: parsed.payment_method || parsedByText.payment_method || '',
    spent_on: finalDate,
    confidence: parsed.confidence || {},
    entitiesCount: Number(json?.entitiesCount || 0),
  }
}

const extractExpenseByLocalOcr = async (file) => {
  let worker = null
  try {
    const { createWorker } = await import('tesseract.js')
    worker = await createWorker('jpn+eng')
    await worker.setParameters({
      tessedit_pageseg_mode: 6,
      preserve_interword_spaces: '1',
    })
    let ocrInput = file
    try {
      ocrInput = await preprocessReceiptImageForOcr(file)
    } catch (prepErr) {
      if (!String(prepErr?.message || '').includes('HEIC_PREPROCESS_FAILED')) throw prepErr
    }
    const { data } = await worker.recognize(ocrInput)
    const text = String(data?.text || '')
    if (!text.trim()) throw new Error('OCR_EMPTY')
    return buildExpenseFromReceiptText(text, data?.words || [])
  } finally {
    if (worker) {
      try {
        await worker.terminate()
      } catch {
        // no-op
      }
    }
  }
}

const extractReceiptDate = (text) => {
  const normalized = normalizeReceiptText(text)
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)

  const parseYmd = (y, m, d) => {
    const yy = Number(y)
    const mm = Number(m)
    const dd = Number(d)
    if (yy >= 2000 && yy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    }
    return ''
  }

  const fullPatterns = [
    /(20\d{2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/,
    /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
    // Handles OCR text like "2026年 1月29日(木)11:33"
    /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s*\([^)]+\))?/,
  ]
  for (const pattern of fullPatterns) {
    const m = normalized.match(pattern)
    if (!m) continue
    const parsed = parseYmd(m[1], m[2], m[3])
    if (parsed) return parsed
  }

  // 짧은 날짜(M/D)는 날짜 문맥이 있을 때만 인정해서 오탐(상품코드 등) 방지.
  const dateContext = /(日付|日時|発行|購入|取引|会計|date)/i
  for (const line of lines) {
    if (!dateContext.test(line)) continue
    const short = line.match(/(\d{1,2})[\/\-](\d{1,2})/)
    if (!short) continue
    const now = new Date()
    const y = now.getFullYear()
    const m = Number(short[1])
    const d = Number(short[2])
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  return ''
}

const extractReceiptAmount = (text) => {
  const normalized = normalizeReceiptText(text)
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const parseNum = (v) => Number(String(v || '').replace(/[^\d]/g, ''))
  const inRange = (n) => Number.isFinite(n) && n >= 1 && n <= 2_000_000

  const strongKeywords = /(合計|ご利用額|お買上.?計|請求額|総額|総計|取引金額|支払金額|領収金額|ご請求額|現計|お預り|ご請求|ご利用代金)/i
  const weakKeywords = /(税.?込|税込|税抜|小計|内税|外税|値引|割引)/i
  const noiseKeywords = /(tel|電話|住所|〒|no\.|伝票|担当|レジ|取引番号|カード番号|承認|端末|会員|ic|we\s*\d{2,}|je\s*-\s*\d+)/i
  const candidates = []
  const countByNumber = new Map()
  for (const line of lines) {
    const matches = [...line.matchAll(/(?:¥|￥)?\s*([\d][\d,]{0,12})/g)]
    if (matches.length === 0) continue
    for (const m of matches) {
      const num = parseNum(m?.[1])
      if (!inRange(num)) continue
      let score = 0
      if (strongKeywords.test(line)) score += 80
      if (weakKeywords.test(line)) score += 30
      if (/(¥|￥|円)/.test(line)) score += 20
      if (num <= 50_000) score += 12
      if (num <= 5_000) score += 8
      if (num <= 1_000) score += 4
      if (/^\d{4,}$/.test(String(num)) && !/(¥|￥|円)/.test(line) && !strongKeywords.test(line)) score -= 28
      if ((line.match(/\d{2,}/g) || []).length >= 3 && !strongKeywords.test(line)) score -= 18
      if (noiseKeywords.test(line)) score -= 45
      if (/^\d+$/.test(line.trim())) score -= 20
      countByNumber.set(num, (countByNumber.get(num) || 0) + 1)
      candidates.push({ num, score, line })
    }
  }
  if (candidates.length > 0) {
    candidates.forEach((c) => {
      const freq = countByNumber.get(c.num) || 0
      if (freq >= 2) c.score += 10
      if (/(¥|￥|円)/.test(c.line)) c.score += 6
    })
    candidates.sort((a, b) => (b.score - a.score) || (b.num - a.num))
    if (candidates[0].score >= 20) return candidates[0].num
  }

  const totalPatterns = [
    /(?:合計|お買上.?計|請求額|総額)[^\d]{0,8}([\d,]{2,12})/i,
    /(?:税込|税.?込)[^\d]{0,8}([\d,]{2,12})/i,
  ]
  for (const pattern of totalPatterns) {
    const m = normalized.match(pattern)
    if (m?.[1]) {
      const num = Number(String(m[1]).replace(/,/g, ''))
      if (Number.isFinite(num) && num > 0) return num
    }
  }
  const yenMatches = [...normalized.matchAll(/¥\s*([\d,]{2,12})/g)]
  if (yenMatches.length > 0) {
    const maxValue = Math.max(
      ...yenMatches
        .map((m) => Number(String(m[1] || '').replace(/,/g, '')))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
    if (Number.isFinite(maxValue) && maxValue > 0) return maxValue
  }
  const anyNumbers = [...normalized.matchAll(/([\d,]{2,12})/g)]
    .map((m) => Number(String(m[1] || '').replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 2_000_000)
  return anyNumbers.length > 0 ? Math.max(...anyNumbers) : 0
}

const extractReceiptMerchant = (text) => {
  const normalizedAll = normalizeReceiptText(text)
  const lowerAll = normalizedAll.toLowerCase()
  const compactAll = normalizedAll.replace(/[\s\-ー・_]/g, '')
  if (/マ.?ツ.?モ.?ト.?キ.?ヨ.?シ/i.test(compactAll)) {
    if (/ミーナ|天神/.test(normalizedAll)) return normalizeMerchantName('マツモトキヨシ ミーナ天神店', normalizedAll)
    return normalizeMerchantName('マツモトキヨシ', normalizedAll)
  }
  // OCR sometimes misses the logo text but keeps branch/catchphrase lines.
  if (
    /ミーナ\s*天神店/.test(normalizedAll)
    && (/(親切なお店|マツモトキヨシ九州販売|092-741-2888)/.test(normalizedAll))
  ) {
    return normalizeMerchantName('マツモトキヨシ ミーナ天神店', normalizedAll)
  }
  for (const rule of MERCHANT_ALIAS_RULES) {
    if (rule.aliases.some((regex) => regex.test(lowerAll))) {
      return normalizeMerchantName(rule.canonical, normalizedAll)
    }
  }

  const lines = normalizeReceiptText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 16)
  const cleanMerchantLine = (line = '') => (
    String(line || '')
      .replace(/\s+\d{1,3}\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  )
  const ignorePattern = /(領収|レシート|合計|小計|税込|税|日時|電話|tel|no\.|現金|釣銭|カード|visa|master|jcb|amex|paypay|line pay|apple pay|google pay|thank you|ありがとうございます|担当|伝票|we\s*\d+|je\s*-\s*\d+|ic|取引|承認)/i
  const strongMerchantHint = /(株式会社|有限会社|店|ストア|マーケット|スーパー|コンビニ|ドラッグ|薬局|カフェ|喫茶|商店|百貨店|モール|イオン|セブン|ローソン|ファミマ|mart|store|shop|market|inc|corp|co\.)/i

  for (const line of lines) {
    if (line.length < 2 || line.length > 40) continue
    if ((line.match(/\d{2,}/g) || []).length >= 2) continue
    if (ignorePattern.test(line)) continue
    if (isLikelyNoiseLine(line)) continue
    if (strongMerchantHint.test(line)) return normalizeMerchantName(cleanMerchantLine(line), normalizedAll)
  }

  // Header-area fallback: store names are usually in the first few lines.
  const headerCandidates = lines.slice(0, 8)
  let bestHeader = { line: '', score: -1 }
  for (const line of headerCandidates) {
    if (line.length < 2 || line.length > 48) continue
    if (ignorePattern.test(line)) continue
    const compact = line.replace(/[\s\-ー・_]/g, '')
    if (/^\d+$/.test(compact)) continue
    let score = 0
    if (/マ.?ツ.?モ.?ト.?キ.?ヨ.?シ/i.test(compact)) score += 120
    if (/ミーナ|天神|店/.test(line)) score += 18
    const kataCount = (line.match(/[\u30A0-\u30FF]/g) || []).length
    const jpCount = countJapaneseChars(line)
    if (kataCount >= 4) score += 20
    if (jpCount >= 3) score += 12
    if ((line.match(/\d/g) || []).length >= 4) score -= 20
    if (isLikelyNoiseLine(line)) score -= 30
    if (score > bestHeader.score) bestHeader = { line, score }
  }
  if (bestHeader.score >= 35) return normalizeMerchantName(bestHeader.line, normalizedAll)

  for (const line of lines) {
    if (line.length < 2 || line.length > 40) continue
    if ((line.match(/\d{2,}/g) || []).length >= 2) continue
    if (ignorePattern.test(line)) continue
    if (isLikelyNoiseLine(line)) continue
    if (/^\d+$/.test(line)) continue
    if (countJapaneseChars(line) < 1) continue
    return normalizeMerchantName(cleanMerchantLine(line), normalizedAll)
  }
  return 'レシート支出'
}

const inferCategoryFromReceipt = (text) => {
  const normalized = normalizeReceiptText(text).toLowerCase()
  if (/(スーパー|コンビニ|ドラッグ|食料|食品|牛乳|米|パン|弁当|cafe|coffee|starbucks|7-11|familymart|lawson)/i.test(normalized)) return '食費'
  if (/(駅|電車|地下鉄|メトロ|バス|タクシー|交通|jr|suica|pasmo|高速)/i.test(normalized)) return '交通'
  if (/(amazon|楽天|ユニクロ|nike|adidas|家電|衣料|ネット注文|shopping|store)/i.test(normalized)) return 'ショッピング'
  return 'その他'
}

const inferPaymentMethodFromReceipt = (text) => {
  const normalized = normalizeReceiptText(text).toLowerCase()
  if (/(visa|master|jcb|amex|credit|クレジット|カード)/i.test(normalized)) return 'クレジットカード'
  if (/(paypay|line pay|apple pay|google pay|電子マネー|id|quicpay|suica|pasmo)/i.test(normalized)) return 'モバイル決済'
  if (/(現金|cash)/i.test(normalized)) return '現金'
  return ''
}

const buildExpenseFromReceiptText = (text, words = []) => {
  const wordBlob = Array.isArray(words)
    ? words.map((w) => String(w?.text || '')).join(' ')
    : ''
  const mergedText = `${text || ''}\n${wordBlob || ''}`
  const amount = extractReceiptAmount(mergedText)
  return {
    category: inferCategoryFromReceipt(mergedText),
    merchant: extractReceiptMerchant(mergedText),
    amount: amount > 0 ? String(Math.round(amount)) : '',
    payment_method: inferPaymentMethodFromReceipt(mergedText),
    spent_on: extractReceiptDate(mergedText),
  }
}

const TRACKED_PURCHASE_ITEMS = [
  { id: 'shampoo', label: 'シャンプー', keywords: ['シャンプー', 'shampoo'] },
  { id: 'rice', label: '米', keywords: ['米', 'お米', '白米', 'rice'] },
  { id: 'milk', label: '牛乳', keywords: ['牛乳', 'ミルク', 'milk'] },
  { id: 'coffee', label: 'コーヒー', keywords: ['コーヒー', 'coffee', 'cafe', 'カフェ'] },
]

const LoanApprovalDiagnosisModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)

  const questions = [
    {
      category: '収入',
      q: '現在の雇用形態は？',
      options: [
        { text: '正社員（勤続3年以上）', score: 5, reason: '雇用の継続性が高い' },
        { text: '正社員（勤続1年以上）/契約社員', score: 3, reason: '雇用の安定性は中程度' },
        { text: '自営業・フリーランス（収入変動あり）', score: 2, reason: '収入変動リスクがある' },
        { text: '無職・収入不安定', score: 0, reason: '返済原資の証明が難しい' },
      ],
    },
    {
      category: '収入',
      q: '年収レンジは？',
      options: [
        { text: '800万円以上', score: 5, reason: '返済余力が高い' },
        { text: '500〜799万円', score: 4, reason: '返済余力は十分' },
        { text: '300〜499万円', score: 2, reason: '返済余力は限定的' },
        { text: '300万円未満', score: 0, reason: '返済余力が不足しやすい' },
      ],
    },
    {
      category: '負債',
      q: '現在の返済負担率（DTI）は？',
      options: [
        { text: '20%未満', score: 5, reason: 'DTIが低く審査で有利' },
        { text: '20〜30%', score: 3, reason: '標準的な返済負担率' },
        { text: '30〜35%', score: 2, reason: '返済負担がやや高い' },
        { text: '35%以上', score: 0, reason: '返済比率が高く否決要因になりやすい' },
      ],
    },
    {
      category: '信用',
      q: '過去24ヶ月で延滞はありましたか？',
      options: [
        { text: '延滞なし', score: 5, reason: '支払い履歴が良好' },
        { text: '1回のみ（軽微）', score: 2, reason: '軽微な遅延履歴がある' },
        { text: '複数回ある', score: 0, reason: '延滞履歴が審査に強く影響' },
      ],
    },
    {
      category: '信用',
      q: '過去6ヶ月のローン申込み回数は？',
      options: [
        { text: '0〜1回', score: 4, reason: '短期多重申込リスクが低い' },
        { text: '2〜3回', score: 2, reason: '申込件数がやや多い' },
        { text: '4回以上', score: 0, reason: '短期多重申込の懸念がある' },
      ],
    },
    {
      category: '資産',
      q: '生活防衛資金（3〜6ヶ月分）はありますか？',
      options: [
        { text: '十分にある', score: 4, reason: '不測時の返済継続力が高い' },
        { text: '一部ある', score: 2, reason: '一定のバッファはある' },
        { text: 'ほぼない', score: 0, reason: '緊急時の返済余力が不足' },
      ],
    },
    {
      category: '属性',
      q: '頭金（または自己資金）はどの程度ありますか？',
      options: [
        { text: '借入額の20%以上', score: 4, reason: '自己資金比率が高く与信にプラス' },
        { text: '借入額の10〜20%', score: 2, reason: '自己資金は平均的' },
        { text: '10%未満', score: 0, reason: '借入依存度が高い' },
      ],
    },
    {
      category: '最終確認',
      q: '健康状態・勤務先情報の提出に問題はありませんか？',
      options: [
        { text: '問題なし', score: 3, reason: '必要書類の整備が見込める' },
        { text: '一部不明点あり', score: 1, reason: '追加確認が必要になる可能性' },
        { text: '提出が難しい項目がある', score: 0, reason: '審査手続きの遅延・否決リスク' },
      ],
    },
  ]

  const buildResult = (total, answerList) => {
    const max = 35
    const normalized = Math.max(0, Math.min(1, total / max))
    const prob = Math.round(35 + normalized * 60) // 35% ~ 95%
    const margin = Math.max(5, 13 - Math.round(normalized * 6))
    const confidenceLow = Math.max(0, prob - margin)
    const confidenceHigh = Math.min(100, prob + margin)
    const isGood = prob >= 70
    const reasons = [...answerList]
      .sort((a, b) => (isGood ? b.score - a.score : a.score - b.score))
      .slice(0, 3)
      .map((item) => item.reason)

    if (prob >= 80) return { prob, label: '高め', color: 'text-emerald-500', confidenceLow, confidenceHigh, reasons }
    if (prob >= 60) return { prob, label: '標準', color: 'text-amber-500', confidenceLow, confidenceHigh, reasons }
    return { prob, label: '低め', color: 'text-red-500', confidenceLow, confidenceHigh, reasons }
  }

  const handleAnswer = (option) => {
    const question = questions[step - 1]
    const newScore = score + option.score
    const newAnswers = [...answers, { score: option.score, reason: `${question.category}: ${option.reason}` }]
    setScore(newScore)
    setAnswers(newAnswers)

    if (step < questions.length) {
      setStep(step + 1)
    } else {
      setStep(9)
      setTimeout(() => {
        setResult(buildResult(newScore, newAnswers))
        setStep(10)
      }, 1200)
    }
  }

  const reset = () => {
    setStep(0)
    setScore(0)
    setAnswers([])
    setResult(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative min-h-[500px] flex flex-col border border-slate-200 dark:border-slate-800">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition z-10">
          <X size={24} className="text-slate-400" />
        </button>

        {step === 0 && (
          <div className="p-10 text-center flex-1 flex flex-col justify-center">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">ローン承認可能性診断</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">
              8つの質問で、現在の属性ベースの<br />
              <span className="text-blue-500 font-bold">承認可能性の目安</span>を表示します。<br />
              <span className="text-[11px] text-slate-400 font-bold mt-2 block bg-slate-100 dark:bg-slate-800 py-1 px-3 rounded-full w-fit mx-auto">
                参考値です。審査結果を保証するものではありません。
              </span>
            </p>
            <button onClick={() => setStep(1)} className="w-full py-4 bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-2xl shadow-lg transition transform hover:scale-[1.02]">
              診断スタート
            </button>
          </div>
        )}

        {step >= 1 && step <= 8 && (
          <div className="p-8 flex-1 flex flex-col">
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">質問 {step}/8</span>
                <span className="text-xs font-bold text-blue-500">{Math.round((step / 8) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${(step / 8) * 100}%` }} />
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full w-fit mb-4">{questions[step - 1].category}</span>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-8 leading-snug">{questions[step - 1].q}</h3>
              <div className="space-y-3">
                {questions[step - 1].options.map((opt, i) => (
                  <button key={i} onClick={() => handleAnswer(opt)} className="w-full p-5 text-left bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group flex justify-between items-center hover:shadow-md">
                    <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-900 dark:group-hover:text-blue-400 text-sm md:text-base">{opt.text}</span>
                    <ChevronRight className="text-slate-300 group-hover:text-blue-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 9 && (
          <div className="p-12 text-center flex-1 flex flex-col justify-center items-center">
            <Loader2 className="text-blue-500 animate-spin mb-6" size={40} />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">診断中...</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">入力データを解析しています</p>
          </div>
        )}

        {step === 10 && result && (
          <div className="bg-slate-50 dark:bg-slate-950 h-full animate-slideUp overflow-y-auto p-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-400 mb-2">ローン承認可能性（推定）</p>
              <div className="flex items-end gap-3 mb-2">
                <span className={`text-5xl font-black ${result.color}`}>{result.prob}%</span>
                <span className={`text-sm font-bold mb-2 ${result.color}`}>{result.label}</span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">
                信頼区間: {result.confidenceLow}% - {result.confidenceHigh}%
              </p>
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <p className="text-xs font-black text-slate-500 mb-2">判定理由 Top 3</p>
                <ul className="space-y-2">
                  {result.reasons.map((reason, idx) => (
                    <li key={idx} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {idx + 1}. {reason}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-4">{LEGAL_NOTICE_TEMPLATES.loan}</p>
            </div>
            <button onClick={reset} className="w-full mt-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl shadow-lg transition">
              もう一度診断する
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const SummarySection = ({
  watchlistCount,
  user,
  insuranceSummary,
  portfolio = PORTFOLIO,
  stockWatchlistItems = [],
  summaryDti = DEBT_INFO.dti,
  isMockMode = false,
}) => {
  const navigate = useNavigate()
  const [reportGeneratedAt, setReportGeneratedAt] = useState(new Date())
  const [savedReport, setSavedReport] = useState(null)
  const [reportStatus, setReportStatus] = useState('')
  const [manualNewsBrief, setManualNewsBrief] = useState(() => getFallbackNewsData().dailyBrief)
  const [manualNewsUpdatedAt, setManualNewsUpdatedAt] = useState(() => getFallbackNewsData().updatedAt)
  const totalInvested = portfolio.reduce((acc, item) => acc + item.invest, 0)
  const totalCurrentValue = portfolio.reduce((acc, item) => acc + item.value, 0)
  const totalPnL = totalCurrentValue - totalInvested
  const totalReturnRate = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const bestReturn = portfolio.length > 0 ? Math.max(...portfolio.map((item) => item.return)) : 0
  const concentration = totalCurrentValue > 0 && portfolio.length > 0
    ? Math.max(...portfolio.map((item) => (item.value / totalCurrentValue) * 100))
    : 0
  const generatedReport = buildAiSummaryReport({ totalReturnRate, dti: summaryDti, concentration, bestReturn })
  const aiReport = savedReport || generatedReport
  const dailyMarketBrief = buildDailyMarketBrief(manualNewsBrief, manualNewsUpdatedAt)
  const personalizedBrief = useMemo(() => ([
    `あなたの総損益率は ${totalReturnRate >= 0 ? '+' : ''}${totalReturnRate.toFixed(1)}% です。`,
    `負債比率 (DTI) は ${Number(summaryDti).toFixed(1)}% で、${Number(summaryDti) >= 35 ? '返済余力の確保が優先' : '許容レンジ内'}です。`,
    `最大集中比率は ${concentration.toFixed(1)}% で、${concentration >= 55 ? '分散強化が必要' : '分散状態は比較的良好'}です。`,
  ]), [totalReturnRate, summaryDti, concentration])

  useEffect(() => {
    saveAiReportDraft({
      userId: user?.id,
      payload: {
        market_brief: dailyMarketBrief,
        personalized_brief: personalizedBrief,
        metrics: {
          total_invested: totalInvested,
          total_current_value: totalCurrentValue,
          total_pnl: totalPnL,
          total_return_rate: Number(totalReturnRate.toFixed(2)),
          dti: Number(summaryDti.toFixed(2)),
          concentration: Number(concentration.toFixed(2)),
          best_return: Number(bestReturn.toFixed(2)),
        },
        ai_report: aiReport,
      },
    })
  }, [
    user?.id,
    dailyMarketBrief,
    personalizedBrief,
    totalInvested,
    totalCurrentValue,
    totalPnL,
    totalReturnRate,
    summaryDti,
    concentration,
    bestReturn,
    aiReport,
  ])

  useEffect(() => {
    let cancelled = false
    let idleId = null
    let timeoutId = null
    const loadManualNews = async () => {
      const fallback = getFallbackNewsData()
      try {
        const payload = await fetchNewsManualData()
        if (cancelled) return
        setManualNewsBrief(payload.dailyBrief || fallback.dailyBrief)
        setManualNewsUpdatedAt(payload.updatedAt || fallback.updatedAt)
      } catch {
        // keep fallback
      }
    }
    const schedule = () => {
      if (cancelled) return
      loadManualNews()
    }
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(schedule, { timeout: 2500 })
    } else {
      timeoutId = window.setTimeout(schedule, 1)
    }
    return () => {
      cancelled = true
      if (idleId != null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [])
  const assetGrowthData = buildAssetGrowthTrendData(totalInvested, totalCurrentValue)

  useEffect(() => {
    let alive = true
    const loadLatestReport = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_reports')
          .select('payload,created_at')
          .eq('user_id', user?.id)
          .eq('report_type', 'summary')
          .order('created_at', { ascending: false })
          .limit(1)
        if (error) throw error

        const latest = data?.[0]
        if (latest?.payload?.report && alive) {
          setSavedReport(latest.payload.report)
          setReportGeneratedAt(new Date(latest.created_at))
          setReportStatus('保存済みレポートを表示中')
        }
      } catch {
        if (alive) setReportStatus('ローカル生成レポートを表示中')
      }
    }

    loadLatestReport()
    return () => {
      alive = false
    }
  }, [user?.id])

  const marketToneText = String(aiReport?.marketTone || '')
  const riskLevelText = String(aiReport?.riskLevel || '')
  const confidenceText = String(aiReport?.confidence || '')
  const riskScoreValue = Math.max(0, Math.min(100, Number(aiReport?.riskScore || 0)))

  const marketToneMeta = marketToneText.includes('順調')
    || marketToneText.toLowerCase().includes('smooth')
    || marketToneText.toLowerCase().includes('strong')
    ? { tone: 'positive', label: '良好' }
    : marketToneText.includes('慎重')
      || marketToneText.toLowerCase().includes('caut')
      || marketToneText.toLowerCase().includes('weak')
      ? { tone: 'negative', label: '要注意' }
      : { tone: 'neutral', label: '標準' }

  const riskLevelValue = riskLevelText.includes('低')
    || riskLevelText.toLowerCase().includes('low')
    ? 30
    : riskLevelText.includes('高')
      || riskLevelText.toLowerCase().includes('high')
      ? 78
      : 56

  const confidenceValue = confidenceText.includes('高')
    || confidenceText.toLowerCase().includes('high')
    ? 84
    : confidenceText.includes('低')
      || confidenceText.toLowerCase().includes('low')
      ? 36
      : 62

  const toneClassMap = {
    positive: {
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
      bar: 'bg-emerald-500',
    },
    neutral: {
      badge: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
      bar: 'bg-sky-500',
    },
    negative: {
      badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
      bar: 'bg-rose-500',
    },
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-500" /> 総合レポート
              </h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">投資元本</p>
                <p className="text-xl md:text-2xl 2xl:text-[2rem] font-black text-slate-900 dark:text-white leading-tight whitespace-nowrap tracking-tight">¥{totalInvested.toLocaleString('ja-JP')}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">現在価値</p>
                <p className="text-xl md:text-2xl 2xl:text-[2rem] font-black text-slate-900 dark:text-white leading-tight whitespace-nowrap tracking-tight">¥{totalCurrentValue.toLocaleString('ja-JP')}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">総損益</p>
                <p className={`text-xl md:text-2xl 2xl:text-[2rem] font-black leading-tight whitespace-nowrap tracking-tight ${totalPnL >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}¥{totalPnL.toLocaleString('ja-JP')}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">損益率</p>
                <p className={`text-xl md:text-2xl 2xl:text-[2rem] font-black leading-tight whitespace-nowrap tracking-tight ${totalReturnRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {totalReturnRate >= 0 ? '+' : ''}{totalReturnRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5">
              <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-indigo-500" /> ファンド概要
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">保有銘柄数</span>
                  <span className="font-black text-slate-900 dark:text-white">{portfolio.length}銘柄</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ウォッチリスト</span>
                  <span className="font-black text-slate-900 dark:text-white">{watchlistCount}銘柄</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">最高リターン</span>
                  <span className="font-black text-red-600 dark:text-red-400">+{bestReturn.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5">
              <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <ShieldCheck size={16} className="text-emerald-500" /> 保険概要
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">登録保険数</span>
                  <span className="font-black text-slate-900 dark:text-white">{insuranceSummary.registered}件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">満期間近</span>
                  <span className="font-black text-slate-900 dark:text-white">{insuranceSummary.expiringSoon}件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">負債比率 (DTI)</span>
                  <span className="font-black text-slate-900 dark:text-white">{Number(summaryDti).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
              <h3 className="font-black text-slate-900 dark:text-white">資産成長トレンド (6ヶ月)</h3>
            </div>
            <div className="p-5">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assetGrowthData} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-28} textAnchor="end" height={46} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      domain={getAssetGrowthYAxisDomain(assetGrowthData)}
                      tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                    />
                    <Tooltip formatter={(v) => `¥${Number(v).toLocaleString('ja-JP')}`} labelFormatter={(l) => String(l || '')} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[5, 5, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                過去月は月末・今月は本日までの目盛り。棒の高さは元本〜現在評価の補間イメージです（実績の日次NAVではありません）。
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
              <h3 className="font-black text-slate-900 dark:text-white">株式パフォーマンス</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/40">
                  <tr className="text-left text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">銘柄コード</th>
                    <th className="px-5 py-3 text-right">投資額</th>
                    <th className="px-5 py-3 text-right">現在価値</th>
                    <th className="px-5 py-3 text-right">損益</th>
                    <th className="px-5 py-3 text-right">損益率</th>
                  </tr>
                </thead>
                <tbody>
                  {(!Array.isArray(stockWatchlistItems) || stockWatchlistItems.length === 0) && (
                    <tr className="border-t border-slate-100 dark:border-slate-800">
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        <p className="mb-3">株式ウォッチリストがまだありません。株式ページで追加すると、ここに表示されます。</p>
                        <button
                          type="button"
                          onClick={() => navigate('/stocks')}
                          className="inline-flex items-center justify-center rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 text-xs font-black text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                        >
                          株式ページへ
                        </button>
                      </td>
                    </tr>
                  )}
                  {Array.isArray(stockWatchlistItems) && stockWatchlistItems.slice(0, 10).map((stock) => {
                    const rate = Number(stock.rate || 0)
                    const investmentAmount = 100000
                    const presentValue = Math.round(investmentAmount * (1 + (rate / 100)))
                    const pnl = presentValue - investmentAmount
                    return (
                      <tr key={`summary-stock-${stock.id}`} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">{stock.code}</td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-700 dark:text-slate-300">
                          ¥{investmentAmount.toLocaleString('ja-JP')}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900 dark:text-white">
                          ¥{presentValue.toLocaleString('ja-JP')}
                        </td>
                        <td className={`px-5 py-4 text-right font-black ${pnl >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {pnl >= 0 ? '+' : ''}¥{pnl.toLocaleString('ja-JP')}
                        </td>
                        <td className={`px-5 py-4 text-right font-black ${rate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {rate >= 0 ? '+' : ''}{rate.toFixed(2)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
              ※ 各銘柄は比較のため基準投資額を一律 ¥100,000 として表示しています。
            </p>
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <PieChart size={18} className="text-indigo-500" /> 資産配分
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={portfolio} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2} minAngle={MY_PAGE_PIE_MIN_ANGLE}>
                    {portfolio.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `¥${Number(value).toLocaleString('ja-JP')}`} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {portfolio.map((fund) => {
                const weight = totalCurrentValue > 0 ? (fund.value / totalCurrentValue) * 100 : 0
                return (
                  <div key={fund.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: fund.color }} />
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{fund.name}</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white">{weight.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => navigate('/funds')}
              className="w-full mt-5 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              詳細アセット分析 <ArrowUpRight size={14} />
            </button>
            <p className="text-[10px] text-slate-400 mt-3">
              {isMockMode
                ? '※ 現在は表示用データです。Supabase連携後に実データへ切り替わります。'
                : '※ 表示データはユーザー保存情報をもとに更新されます。'}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-4 mt-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2">クイックインサイト</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              表示中の数値は登録データに基づきます。特定の金融商品の売買を勧誘するものではありません。
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5 mt-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-black flex items-center gap-2 text-slate-900 dark:text-white">
                  <Zap size={16} className="text-amber-500 fill-amber-500" /> AI リポート（Beta）
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  最終更新: {reportGeneratedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {reportStatus && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{reportStatus}</p>}
              </div>
              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                日次自動更新
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 grid grid-rows-[22px_36px_6px] gap-1">
                <p className="text-[10px] text-slate-500 dark:text-slate-300 leading-tight">市場トーン</p>
                <div className="flex items-start">
                  <p className="font-black text-sm leading-tight text-slate-900 dark:text-white">{aiReport.marketTone}</p>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden self-end">
                  <div className={`h-full ${toneClassMap[marketToneMeta.tone].bar}`} style={{ width: `${marketToneMeta.tone === 'positive' ? 78 : marketToneMeta.tone === 'negative' ? 36 : 56}%` }} />
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 grid grid-rows-[22px_36px_6px] gap-1">
                <p className="text-[10px] text-slate-500 dark:text-slate-300 leading-tight">ポートフォリオリスク</p>
                <div className="flex items-start">
                  <p className="font-black text-sm leading-tight text-slate-900 dark:text-white">{aiReport.riskLevel}</p>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden self-end">
                  <div className={`${riskLevelValue >= 70 ? 'bg-rose-500' : riskLevelValue >= 45 ? 'bg-amber-500' : 'bg-emerald-500'} h-full`} style={{ width: `${riskLevelValue}%` }} />
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 grid grid-rows-[22px_36px_6px] gap-1">
                <p className="text-[10px] text-slate-500 dark:text-slate-300 leading-tight">リスクスコア</p>
                <div className="flex items-start">
                  <p className="font-black text-lg leading-tight text-slate-900 dark:text-white">{aiReport.riskScore || '-'} <span className="text-xs text-slate-500 dark:text-slate-400">/100</span></p>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden self-end">
                  <div className={`${riskScoreValue >= 70 ? 'bg-emerald-500' : riskScoreValue >= 40 ? 'bg-amber-500' : 'bg-rose-500'} h-full`} style={{ width: `${riskScoreValue}%` }} />
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 grid grid-rows-[22px_36px_6px] gap-1">
                <p className="text-[10px] text-slate-500 dark:text-slate-300 leading-tight">データ充足度</p>
                <div className="flex items-start">
                  <p className="font-black text-sm leading-tight text-slate-900 dark:text-white">{aiReport.confidence}</p>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden self-end">
                  <div className={`${confidenceValue >= 75 ? 'bg-emerald-500' : confidenceValue >= 50 ? 'bg-sky-500' : 'bg-rose-500'} h-full`} style={{ width: `${confidenceValue}%` }} />
                </div>
              </div>
            </div>

            <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-300 font-bold">Daily Market (共通)</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{dailyMarketBrief.dateLabel} ・ {dailyMarketBrief.tone} ・ {dailyMarketBrief.source}</p>
              <p className="text-sm font-bold mt-1 text-slate-900 dark:text-white">{dailyMarketBrief.headline}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{dailyMarketBrief.note}</p>
            </div>

            <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-300 font-bold">入力情報ベース</p>
              <div className="mt-2 space-y-1.5">
                {personalizedBrief.map((line, idx) => (
                  <p key={`brief-${idx}`} className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    ・{line}
                  </p>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {aiReport.actions.map((action, idx) => (
                <p key={idx} className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5">
                  {idx + 1}. {action}
                </p>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3">※ {LEGAL_NOTICE_TEMPLATES.investment}</p>
          </div>
        </div>
      </div>

    </div>
  )
}

/**
 * 月次積立の複利試算（内部検算用 Excel「calculation」と同じ定義）。
 * - 参考年率 R は実効年率（(1+四半期)^4−1 由来の simAnnualPct を % として解釈）
 * - 月利率: (1+R)^(1/12)−1（単純 R/12 ではない）
 * - 各月: 前月末評価額 + 当月積立 → そこに月次複利（期初払い年金・先に積立を足してから当月末まで複利）
 */
const futureValueMonthlyContributionsJpy = (monthlyYen, annualPercent, years) => {
  const pmt = Math.max(0, Math.floor(Number(monthlyYen) || 0))
  const y = Math.max(0, Math.min(60, Number(years) || 0))
  const R = Math.max(-80, Math.min(80, Number(annualPercent) || 0)) / 100
  const n = Math.floor(y * 12)
  if (n <= 0 || pmt <= 0) return { fv: 0, contributed: 0 }
  const contributed = pmt * n
  if (Math.abs(R) < 1e-15) return { fv: Math.round(contributed), contributed }
  if (R <= -1) return { fv: Math.round(contributed), contributed }
  const i = Math.pow(1 + R, 1 / 12) - 1
  if (!Number.isFinite(i) || Math.abs(i) < 1e-18) return { fv: Math.round(contributed), contributed }
  const fv = pmt * (1 + i) * (Math.pow(1 + i, n) - 1) / i
  return { fv: Math.round(Math.max(0, fv)), contributed }
}

/** null = 未設定（初回は開く）。'1' 開く / '0' 閉じる */
const WEALTH_ACCUM_SIM_EXPANDED_KEY = 'mm_wealth_accum_sim_expanded_v1'

const WealthAccumulationSimCard = () => {
  const [simExpanded, setSimExpanded] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = window.localStorage.getItem(WEALTH_ACCUM_SIM_EXPANDED_KEY)
      if (v === null) return true
      return v === '1'
    } catch {
      return true
    }
  })
  const persistSimExpanded = useCallback((next) => {
    setSimExpanded(next)
    try {
      window.localStorage.setItem(WEALTH_ACCUM_SIM_EXPANDED_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const [indexLabel, setIndexLabel] = useState('topix')
  const [monthlyStr, setMonthlyStr] = useState('1000')
  const [years, setYears] = useState(10)
  const [realized3m, setRealized3m] = useState(null)
  const [realized3mLoading, setRealized3mLoading] = useState(true)
  const [realized3mError, setRealized3mError] = useState(null)

  useEffect(() => {
    let alive = true
    const key = indexLabel === 'nikkei' ? 'nikkei' : 'topix'
    setRealized3mLoading(true)
    setRealized3mError(null)
    fetchEtfThreeMonthReturnPct(key)
      .then((res) => {
        if (!alive) return
        if (!res.ok) {
          setRealized3m(null)
          setRealized3mError(res.error || 'fetch_failed')
          return
        }
        setRealized3m(res)
      })
      .catch(() => {
        if (!alive) return
        setRealized3m(null)
        setRealized3mError('fetch_failed')
      })
      .finally(() => {
        if (alive) setRealized3mLoading(false)
      })
    return () => { alive = false }
  }, [indexLabel])

  const monthlyNum = Math.max(0, Math.floor(Number(monthlyStr.replace(/[^\d]/g, '')) || 0))
  const monthsTotal = years * 12
  const { simAnnualPct, rateFromRealized } = useMemo(() => {
    if (realized3m?.ok) {
      const ann = annualizeThreeMonthReturnPct(realized3m.pct)
      if (ann != null && Number.isFinite(ann)) return { simAnnualPct: ann, rateFromRealized: true }
    }
    return { simAnnualPct: 5, rateFromRealized: false }
  }, [realized3m])
  const { fv, contributed } = useMemo(
    () => futureValueMonthlyContributionsJpy(monthlyNum, simAnnualPct, years),
    [monthlyNum, simAnnualPct, years],
  )
  const fmt = (n) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Math.max(0, n))

  const indexTitle = indexLabel === 'nikkei' ? '日経225連動（代表ETF）' : 'TOPIX連動（代表ETF）'
  const etfCode = indexLabel === 'nikkei' ? WEALTH_SIM_ETF_SYMBOL.nikkei : WEALTH_SIM_ETF_SYMBOL.topix
  const indexShortJa = indexLabel === 'nikkei' ? '日経225' : 'TOPIX'
  const summaryOneLine = `毎月${fmt(monthlyNum)}・${years}年・${indexShortJa}ベースの試算 → 評価額 ${fmt(fv)}（積立合計 ${fmt(contributed)}）`

  return (
    <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/90 to-white dark:from-indigo-950/40 dark:to-slate-900 px-3 py-3 sm:px-4 sm:py-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 lg:mb-0">
        <div className="flex items-start gap-2 min-w-0 sm:flex-1">
          <div className="rounded-lg bg-indigo-500/15 dark:bg-indigo-400/10 p-1.5 shrink-0">
            <PiggyBank className="text-indigo-600 dark:text-indigo-400" size={20} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug min-w-0 flex-1">
                資産形成のイメージ：少額の積立シミュレーション
              </h3>
              <button
                type="button"
                onClick={() => persistSimExpanded(!simExpanded)}
                aria-expanded={simExpanded}
                aria-controls={simExpanded ? 'wealth-accum-sim-details' : undefined}
                className="shrink-0 rounded-xl border border-indigo-200/90 dark:border-indigo-800/60 bg-white/90 dark:bg-slate-800/80 p-1.5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors touch-manipulation"
                title={simExpanded ? '折りたたむ' : '開いて詳細を表示'}
              >
                <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${simExpanded ? 'rotate-180' : ''}`} aria-hidden />
                <span className="sr-only">{simExpanded ? '少額積立シミュレーションを折りたたむ' : '少額積立シミュレーションの詳細を開く'}</span>
              </button>
            </div>
            {simExpanded ? (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                代表ETFの直近約3か月リターンを、同じペースが年4回続くと仮定して参考年率（複利）に換算し、その金利で毎月積み立てた場合のイメージ額です。表の±%と試算年率は別物なのでご注意ください。
              </p>
            ) : (
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-1 leading-snug">
                {summaryOneLine}
              </p>
            )}
          </div>
        </div>
        <Link
          to="/funds"
          className="shrink-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 self-start sm:pt-0.5"
        >
          ファンド一覧 <ChevronRight size={14} className="opacity-80" aria-hidden />
        </Link>
      </div>

      {simExpanded ? (
      <div id="wealth-accum-sim-details" className="mt-3 grid grid-cols-1 lg:grid-cols-2 lg:gap-4 lg:items-stretch gap-3">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'topix', label: 'TOPIX' },
              { id: 'nikkei', label: '日経225' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setIndexLabel(opt.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                  indexLabel === opt.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-800/50 px-3 py-2.5 flex-1 lg:min-h-0">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight mb-1.5">
              {indexTitle}（{etfCode}）
              <span className="font-semibold text-slate-400 dark:text-slate-500"> · 直近約3か月（終値）</span>
            </p>
            {realized3mLoading ? (
              <p className="text-sm font-bold text-slate-400">取得中…</p>
            ) : realized3m?.ok ? (
              <p className={`text-2xl font-black tabular-nums leading-none ${signedReturnTextClassStrong(realized3m.pct)}`}>
                {realized3m.pct >= 0 ? '+' : ''}{realized3m.pct.toFixed(2)}%
              </p>
            ) : (
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-snug">
                {realized3mError === 'history_span_mismatch' || realized3mError === 'implausible_return'
                  ? 'この期間の実績を表示できません（履歴の欠損などの可能性があります）。'
                  : '実績を取得できませんでした。'}
                {realized3mError ? <span className="sr-only">{realized3mError}</span> : null}
              </p>
            )}
            {realized3m?.ok ? (
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1.5">
                {realized3m.pastDate} 比 → {realized3m.latestDate} 時点
              </p>
            ) : null}
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2 leading-snug">
              指数そのものではなく、当該銘柄のDB日次データから算出しています。
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wide">積み立ての条件</p>
          <div className="grid grid-cols-2 gap-2 items-end">
            <label className="block min-w-0">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">毎月の積立額（円）</span>
              <input
                type="text"
                inputMode="numeric"
                value={monthlyStr}
                onChange={(e) => setMonthlyStr(sanitizeNumericInput(e.target.value))}
                className="mt-0.5 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold"
                placeholder="1000"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">積立 {years}年（{monthsTotal}か月）</span>
              <select
                value={years}
                onChange={(e) => setYears(Number(e.target.value) || 10)}
                className="mt-0.5 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
              >
                {[5, 10, 15, 20, 30].map((y) => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 bg-white/90 dark:bg-slate-800/50 px-3 py-2.5 flex-1 flex flex-col lg:min-h-0">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-snug">試算の結果（月次・複利・税・手数料・インフレは含みません）</p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
              仮定の年率{' '}
              <span className="font-black text-slate-800 dark:text-slate-100">{simAnnualPct.toFixed(1)}%</span>
              {realized3mLoading
                ? '（取得中は暫定で年率5%）'
                : rateFromRealized
                  ? `（直近約3か月 ${realized3m.pct >= 0 ? '+' : ''}${realized3m.pct.toFixed(2)}% を (1+その数)^4−1 で年換算した参考値）`
                  : '（実績が使えないため参考として年率5%）'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-1 leading-snug">
              月利率は (1+参考年率)^(1/12)−1 とし、毎月「前月末評価額＋当月積立」に当月末まで複利（先積立・社内検算Excelと同じ手順）です。
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 items-end">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 truncate">積立合計（元本）</p>
                <p className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums truncate">{fmt(contributed)}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[10px] font-bold text-slate-400">試算の評価額</p>
                <p className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{fmt(fv)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {simExpanded ? (
      <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2.5 leading-snug">
        ※試算の年率は過去の短期実績からの参考であり、将来の運用成果を保証するものではありません。実際の投資は余裕資金の範囲で、商品説明書をご確認ください。
      </p>
      ) : (
      <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2 leading-snug">
        ※試算は参考です。詳細・条件変更は開いてください。
      </p>
      )}
    </div>
  )
}

const AVG_DOWN_TARGET_STEP = 0.01

/** 追加買いは現在価格で行う前提。目標平均 T は必ず (現在価格, 現在の平均) の開区間。 */
function getAvgDownTargetSliderBounds(avgBuyPrice, currentPrice) {
  const avg = Number(avgBuyPrice)
  const now = Number(currentPrice)
  const step = AVG_DOWN_TARGET_STEP
  const targetMin = Math.ceil((now + step) * 100) / 100
  const targetMax = Math.floor((avg - step) * 100) / 100
  const targetEnabled = Number.isFinite(targetMin) && Number.isFinite(targetMax) && targetMin < targetMax
  return { targetMin, targetMax, targetEnabled, targetStep: step }
}

/** モーダル初期値: 平均と現在価格の中点をスライダー範囲にクランプ（avg*0.9 のような誤初期値は使わない） */
function getAvgDownDefaultTargetPriceInput(avgBuyPrice, currentPrice) {
  const { targetMin, targetMax, targetEnabled } = getAvgDownTargetSliderBounds(avgBuyPrice, currentPrice)
  if (!targetEnabled) return ''
  const mid = (Number(avgBuyPrice) + Number(currentPrice)) / 2
  const clamped = Math.max(targetMin, Math.min(targetMax, mid))
  return clamped.toFixed(2)
}

const calcAveragingDownPlan = ({ avgBuyPrice, currentPrice, currentQty, targetAvgPrice }) => {
  const avg = Number(avgBuyPrice || 0)
  const now = Number(currentPrice || 0)
  const qty = Number(currentQty || 0)
  const target = Number(targetAvgPrice || 0)
  if (!Number.isFinite(avg) || !Number.isFinite(now) || !Number.isFinite(qty) || !Number.isFinite(target)) {
    return { ok: false, reason: '入力値が不正です。' }
  }
  if (qty <= 0 || avg <= 0 || now <= 0 || target <= 0) {
    return { ok: false, reason: '数量・価格は 0 より大きい値が必要です。' }
  }
  if (target >= avg) {
    return { ok: false, reason: '目標平単価が現在の平均買付価格以上です。追加買いで下げる目標を入力してください。' }
  }
  if (target <= now) {
    return { ok: false, reason: '現在価格より上の目標平単価が必要です（現在価格以下は追加買いだけでは到達できません）。' }
  }
  const addQty = (qty * (avg - target)) / (target - now)
  if (!Number.isFinite(addQty) || addQty <= 0) {
    return { ok: false, reason: 'この条件では必要数量を計算できません。' }
  }
  return {
    ok: true,
    addQty,
    addQtyRoundedUp: Math.ceil(addQty),
  }
}

/** 保有ロット削除の確認（実際の売却・実現損益とは別経路） */
const CONFIRM_DELETE_OWNED_LOT_JA =
  'この取引（ロット）を削除しますか？誤入力の取り消しであり、「売却記録」とは別です。実現損益の集計・売却履歴には影響しません。'

const WealthSection = ({
  stockWatchlistItems = [],
  ownedStocks = [],
  ownedFunds = [],
  ownedStockItems = [],
  ownedFundItems = [],
  userId = null,
  fxRatesByDate = {},
  valuationUsdJpy = null,
  valuationFxDate = '',
  onAddOwnedStock,
  searchStockSuggestions,
  searchFundSuggestions,
  onRemoveStockWatchlist,
  onUpdateOwnedStock,
  onRemoveOwnedStock,
  onLoadOwnedStockPrice,
  onAddOwnedFund,
  onRemoveOwnedFund,
  onUpdateOwnedFund,
  onLoadOwnedFundPrice,
  productInterests: _productInterests = [],
  fundWatchlist = [],
  fundOptimizerSets = [],
  onToggleFundWatchlist,
  onUpdateFundWatchlistMeta: _onUpdateFundWatchlistMeta,
  onRemoveFundOptimizerSet,
  portfolio = PORTFOLIO,
  isMockMode: _isMockMode = false,
  canEditAssets: _canEditAssets = false,
  onAddAsset: _onAddAsset,
  onUpdateAsset: _onUpdateAsset,
  onDeleteAsset: _onDeleteAsset,
  pointAccounts = [],
  insurances = [],
  tabMode = 'wealth',
  isPaidMember = false,
  onUiMessage = null,
  realizedStockTrades = [],
  onRecordStockSale = null,
  realizedFundTrades = [],
  onRecordFundSale = null,
  onSwitchPortfolioTab = null,
  portfolioQuotesHydrating = false,
}) => {
  const navigate = useNavigate()
  const [newOwnedSymbol, setNewOwnedSymbol] = useState('')
  const [newOwnedBuyDate, setNewOwnedBuyDate] = useState('')
  const [newOwnedBuyPrice, setNewOwnedBuyPrice] = useState('')
  const [newOwnedQty, setNewOwnedQty] = useState('')
  const [newOwnedCurrency, setNewOwnedCurrency] = useState('USD')
  const [newOwnedCurrencyTouched, setNewOwnedCurrencyTouched] = useState(false)
  useEffect(() => {
    if (newOwnedCurrencyTouched) return
    const sym = String(newOwnedSymbol || '').trim()
    if (!sym) return
    setNewOwnedCurrency(inferStockCurrency(sym))
  }, [newOwnedSymbol, newOwnedCurrencyTouched])
  const [ownedSymbolOptions, setOwnedSymbolOptions] = useState([])
  const [stockSuggestOpen, setStockSuggestOpen] = useState(false)
  const [stockSuggestIndex, setStockSuggestIndex] = useState(-1)
  const [expandedSymbols, setExpandedSymbols] = useState({})
  const [expandedFundSymbols, setExpandedFundSymbols] = useState({})
  const [newOwnedFundSymbol, setNewOwnedFundSymbol] = useState('')
  const [newOwnedFundInvestAmount, setNewOwnedFundInvestAmount] = useState('')
  const [newOwnedFundBuyDate, setNewOwnedFundBuyDate] = useState('')
  const [newOwnedFundBuyPrice, setNewOwnedFundBuyPrice] = useState('')
  const [ownedFundSymbolOptions, setOwnedFundSymbolOptions] = useState([])
  const [fundSuggestOpen, setFundSuggestOpen] = useState(false)
  const [fundSuggestIndex, setFundSuggestIndex] = useState(-1)
  const [ownedFundDrafts, setOwnedFundDrafts] = useState({})
  const [ownedStockDrafts, setOwnedStockDrafts] = useState({})
  const [fundWatchMemoById, setFundWatchMemoById] = useState({})
  const [wealthChartMonths, setWealthChartMonths] = useState(6)
  const [avgDownModalOpen, setAvgDownModalOpen] = useState(false)
  const [avgDownMode, setAvgDownMode] = useState('target')
  const [avgDownTargetPriceInput, setAvgDownTargetPriceInput] = useState('')
  const [avgDownAddQtyInput, setAvgDownAddQtyInput] = useState('')
  const [avgDownSelectedStock, setAvgDownSelectedStock] = useState(null)
  const [stockSellModalOpen, setStockSellModalOpen] = useState(false)
  const [stockSellContext, setStockSellContext] = useState(null)
  const [stockSellQtyInput, setStockSellQtyInput] = useState('')
  const [stockSellPriceInput, setStockSellPriceInput] = useState('')
  const [stockSellDateInput, setStockSellDateInput] = useState('')
  const [stockSellFxPreview, setStockSellFxPreview] = useState(null)
  const [stockSellBusy, setStockSellBusy] = useState(false)
  const [fundSellModalOpen, setFundSellModalOpen] = useState(false)
  const [fundSellContext, setFundSellContext] = useState(null)
  const [fundSellUnitsInput, setFundSellUnitsInput] = useState('')
  const [fundSellPriceInput, setFundSellPriceInput] = useState('')
  const [fundSellDateInput, setFundSellDateInput] = useState('')
  const [fundSellBusy, setFundSellBusy] = useState(false)
  const [stockRealizedWindow, setStockRealizedWindow] = useState('cy2026')
  const [wealthMonthlyStockRealizedOpen, setWealthMonthlyStockRealizedOpen] = useState(false)
  const [wealthMonthlyFundRealizedOpen, setWealthMonthlyFundRealizedOpen] = useState(false)
  /** stock_daily_prices から再評価した推移。取得できないときは null（補間フォールバック） */
  const [historicalWealthTrend, setHistoricalWealthTrend] = useState(null)
  const [stockSplits, setStockSplits] = useState([])
  const [monthlyPnlBase, setMonthlyPnlBase] = useState(null)
  useEffect(() => {
    let alive = true
    supabase.from('stock_splits').select('symbol,ex_date,ratio').then(({ data, error }) => {
      if (!alive || error) return
      setStockSplits(Array.isArray(data) ? data : [])
    })
    return () => { alive = false }
  }, [])
  const [portfolioDropSnapshot, setPortfolioDropSnapshot] = useState(null)
  const [portfolioDropThresholdPct, setPortfolioDropThresholdPct] = useState(DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT)
  const [portfolioRiseThresholdPct, setPortfolioRiseThresholdPct] = useState(DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT)
  const [portfolioAlertReadAtDate, setPortfolioAlertReadAtDate] = useState('')
  /** 履歴 upsert の currentValue。effect から totalCurrentValue 依存を外す */
  const portfolioAlertLatestTotalJpyRef = useRef(0)
  /** チャート再計算用の最新評価額。価格 effect の依存から live 合計を外し Supabase 連打を防ぐ */
  const liveWealthTotalsRef = useRef({ stock: 0, fund: 0 })
  /** stock_daily_prices 再取得のデバウンス（依存が細かく変わると無限に近いループになるのを防ぐ） */
  const wealthPriceResyncTimerRef = useRef(null)

  const [stockTabHelpOpen, setStockTabHelpOpen] = useState(false)
  const [fundTabHelpOpen, setFundTabHelpOpen] = useState(false)

  useEffect(() => {
    if (tabMode !== 'stock') setStockTabHelpOpen(false)
    if (tabMode !== 'fund') setFundTabHelpOpen(false)
  }, [tabMode])

  useEffect(() => {
    if (!stockTabHelpOpen && !fundTabHelpOpen) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (stockTabHelpOpen) setStockTabHelpOpen(false)
      if (fundTabHelpOpen) setFundTabHelpOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stockTabHelpOpen, fundTabHelpOpen])

  const realizedPnlBySymbol = useMemo(() => {
    const m = new Map()
    for (const t of Array.isArray(realizedStockTrades) ? realizedStockTrades : []) {
      const k = String(t.symbol || '').trim().toUpperCase()
      if (!k) continue
      m.set(k, (m.get(k) || 0) + Number(t.realizedPnlJpy || 0))
    }
    return m
  }, [realizedStockTrades])

  const realizedFundPnlBySymbol = useMemo(() => {
    const m = new Map()
    for (const t of Array.isArray(realizedFundTrades) ? realizedFundTrades : []) {
      const k = String(t.symbol || '').trim().toUpperCase()
      if (!k) continue
      m.set(k, (m.get(k) || 0) + Number(t.realizedPnlJpy || 0))
    }
    return m
  }, [realizedFundTrades])

  const openFundSellModal = (fund) => {
    if (!onRecordFundSale) return
    if (!userId) {
      if (typeof onUiMessage === 'function') onUiMessage('売却記録はログイン後にご利用ください。', 'info')
      return
    }
    const sym = String(fund?.symbol || fund?.code || '').trim().toUpperCase()
    if (!sym) return
    const maxU = Math.max(0, Number(fund?.units || 0))
    setFundSellContext({
      symbol: sym,
      name: fund?.name || fund?.code || sym,
      maxUnits: maxU,
      hintPrice: Math.max(0, Number(fund?.latestPrice || 0)),
    })
    setFundSellUnitsInput('')
    setFundSellPriceInput(Number(fund?.latestPrice || 0) > 0 ? String(fund.latestPrice) : '')
    setFundSellDateInput(new Date().toISOString().slice(0, 10))
    setFundSellModalOpen(true)
  }

  const openStockSellModal = (stock) => {
    if (!onRecordStockSale) return
    if (!userId) {
      if (typeof onUiMessage === 'function') onUiMessage('売却記録はログイン後にご利用ください。', 'info')
      return
    }
    const sym = String(stock?.symbol || '').trim().toUpperCase()
    if (!sym) return
    setStockSellContext({
      symbol: sym,
      name: stock?.name || stock?.code || sym,
      maxQty: Math.max(0, Number(stock?.totalQty || 0)),
      hintPrice: Math.max(0, Number(stock?.price || 0)),
    })
    setStockSellQtyInput('')
    setStockSellPriceInput(Number(stock?.price || 0) > 0 ? String(stock.price) : '')
    setStockSellDateInput(new Date().toISOString().slice(0, 10))
    setStockSellFxPreview(null)
    setStockSellModalOpen(true)
  }

  useEffect(() => {
    if (!stockSellModalOpen || inferStockCurrency(stockSellContext?.symbol) !== 'USD') {
      setStockSellFxPreview(null)
      return undefined
    }
    const iso = toIsoDate(stockSellDateInput || '')
    if (!iso) {
      setStockSellFxPreview(null)
      return undefined
    }
    let alive = true
    setStockSellFxPreview({ status: 'loading' })
    resolveUsdSellFx({
      sellDateIso: iso,
      currentRate: valuationUsdJpy,
      currentAsOf: valuationFxDate,
    }).then((fx) => {
      if (!alive) return
      setStockSellFxPreview(fx ? { status: 'ready', ...fx } : { status: 'missing' })
    })
    return () => {
      alive = false
    }
  }, [stockSellModalOpen, stockSellContext?.symbol, stockSellDateInput, valuationUsdJpy, valuationFxDate])

  useEffect(() => {
    const uid = userId
    if (!uid) {
      setPortfolioDropThresholdPct(DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT)
      setPortfolioRiseThresholdPct(DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT)
      return
    }
    if (!isPaidMember) {
      setPortfolioDropThresholdPct(DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT)
      setPortfolioRiseThresholdPct(DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT)
      return
    }
    let alive = true
    loadUserPortfolioDropAlertSetting(uid)
      .then((res) => {
        if (!alive) return
        const t = res?.thresholdPct
        if (t === null) setPortfolioDropThresholdPct(null)
        else {
          const nextThreshold = Number(t)
          setPortfolioDropThresholdPct(
            Number.isFinite(nextThreshold)
              ? nextThreshold
              : DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT,
          )
        }
        const rNorm = normalizeRiseThresholdPct(res?.riseThresholdPct)
        setPortfolioRiseThresholdPct(rNorm === 5 || rNorm === 10 ? rNorm : DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT)
      })
      .catch(() => {
        if (alive) {
          setPortfolioDropThresholdPct(DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT)
          setPortfolioRiseThresholdPct(DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT)
        }
      })
    return () => {
      alive = false
    }
  }, [userId, isPaidMember])

  const getFundMemoValue = (fundId) => {
    const id = String(fundId || '').trim().toUpperCase()
    if (!id) return ''
    return String(fundWatchMemoById?.[id] || '')
  }

  const handleFundMemoChange = (fundId, nextValue) => {
    const id = String(fundId || '').trim().toUpperCase()
    if (!id) return
    setFundWatchMemoById((prev) => {
      const next = { ...prev, [id]: String(nextValue || '') }
      try {
        localStorage.setItem(getFundWatchlistMemoStorageKey(userId), JSON.stringify(next))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getFundWatchlistMemoStorageKey(userId))
      const parsed = raw ? JSON.parse(raw) : {}
      const normalized = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      setFundWatchMemoById(normalized)
    } catch {
      setFundWatchMemoById({})
    }
  }, [userId])

  const getDraftFieldValue = (draftMap, key, field, fallback = '') => {
    const id = String(key || '')
    if (!id) return String(fallback ?? '')
    const row = draftMap?.[id]
    if (!row || row[field] == null) return String(fallback ?? '')
    return String(row[field])
  }

  const setDraftFieldValue = (setDrafts, key, field, value) => {
    const id = String(key || '')
    if (!id || !field) return
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }))
  }

  const clearDraftFieldValue = (setDrafts, key, field) => {
    const id = String(key || '')
    if (!id || !field) return
    setDrafts((prev) => {
      const row = prev[id]
      if (!row || row[field] == null) return prev
      const nextRow = { ...row }
      delete nextRow[field]
      if (Object.keys(nextRow).length === 0) {
        const { [id]: _removed, ...rest } = prev
        return rest
      }
      return {
        ...prev,
        [id]: nextRow,
      }
    })
  }

  const commitOwnedFundDraftField = (fundId, field, fallback = '') => {
    const id = String(fundId || '')
    if (!id || !field) return
    const raw = ownedFundDrafts?.[id]?.[field]
    if (raw == null) return
    const normalized = field === 'investAmount' || field === 'buyPrice'
      ? sanitizeDecimalInput(raw)
      : String(raw)
    if (normalized !== String(fallback ?? '')) {
      onUpdateOwnedFund?.(fundId, { [field]: normalized })
    }
    clearDraftFieldValue(setOwnedFundDrafts, id, field)
  }

  const commitOwnedStockDraftField = (lotId, field, fallback = '') => {
    const id = String(lotId || '')
    if (!id || !field) return
    const raw = ownedStockDrafts?.[id]?.[field]
    if (raw == null) return
    const normalized = field === 'qty'
      ? sanitizeStockShareQtyInput(raw)
      : field === 'buyPrice'
        ? sanitizeDecimalInput(raw)
        : String(raw)
    if (normalized !== String(fallback ?? '')) {
      onUpdateOwnedStock?.(lotId, { [field]: normalized })
    }
    clearDraftFieldValue(setOwnedStockDrafts, id, field)
  }
  const watchsetNamesByFundId = useMemo(() => {
    const map = {}
    ;(Array.isArray(fundOptimizerSets) ? fundOptimizerSets : []).forEach((set) => {
      ;(Array.isArray(set?.funds) ? set.funds : []).forEach((fund) => {
        const id = String(fund?.id || '').trim().toUpperCase()
        if (!id) return
        if (!Array.isArray(map[id])) map[id] = []
        map[id].push(set.name || '配分セット')
      })
    })
    return map
  }, [fundOptimizerSets])
  const fundRows = (Array.isArray(portfolio) ? portfolio : []).map((item) => {
    const currency = inferFundCurrency(item.name)
    const investJpy = toJpy(item.invest || 0, currency)
    const valueJpy = toJpy(item.value || 0, currency)
    const name = decodeHtmlEntities(String(item?.name || ''))
    return { ...item, name: name || item.name, currency, investJpy, valueJpy }
  })

  useEffect(() => {
    let alive = true
    const q = String(newOwnedSymbol || '').trim()
    if (!q) {
      setOwnedSymbolOptions((prev) => (prev.length > 0 ? [] : prev))
      setStockSuggestOpen(false)
      setStockSuggestIndex(-1)
      return () => { alive = false }
    }
    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchStockSuggestions?.(q)
        if (!alive) return
        setOwnedSymbolOptions(Array.isArray(rows) ? rows.slice(0, 20) : [])
        // 候補の再取得だけ行い、ここで開くとチップ／一覧選択直後に再オープンする
        setStockSuggestIndex(-1)
      } catch {
        if (alive) {
          setOwnedSymbolOptions([])
          setStockSuggestOpen(false)
          setStockSuggestIndex(-1)
        }
      }
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [newOwnedSymbol, searchStockSuggestions])
  useEffect(() => {
    let alive = true
    const q = String(newOwnedFundSymbol || '').trim()
    if (!q) {
      setOwnedFundSymbolOptions((prev) => (prev.length > 0 ? [] : prev))
      setFundSuggestOpen(false)
      setFundSuggestIndex(-1)
      return () => { alive = false }
    }
    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchFundSuggestions?.(q)
        if (!alive) return
        setOwnedFundSymbolOptions(Array.isArray(rows) ? rows.slice(0, 20) : [])
        setFundSuggestIndex(-1)
      } catch {
        if (alive) {
          setOwnedFundSymbolOptions([])
          setFundSuggestOpen(false)
          setFundSuggestIndex(-1)
        }
      }
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [newOwnedFundSymbol, searchFundSuggestions])
  const groupedOwnedStocks = Object.values(
    (Array.isArray(ownedStockItems) ? ownedStockItems : []).reduce((acc, lot) => {
      const symbol = String(lot?.symbol || lot?.code || '').trim()
      if (!symbol) return acc
      if (!acc[symbol]) {
        acc[symbol] = {
          symbol,
          code: lot.code || symbol,
          name: lot.name || symbol,
          price: Number(lot.price || 0),
          tradeDate: lot.tradeDate || '',
          lots: [],
        }
      }
      acc[symbol].lots.push(lot)
      return acc
    }, {})
  ).map((group) => {
    const totalQty = group.lots.reduce((sum, lot) => sum + Math.max(0, Number(lot.qty || 0)), 0)
    const totalCost = group.lots.reduce((sum, lot) => {
      const qty = Math.max(0, Number(lot.qty || 0))
      const buy = Math.max(0, Number(lot.buyPrice || 0))
      return sum + (qty * buy)
    }, 0)
    const stockCurrency = inferStockCurrency(group.symbol)
    const price = Math.max(0, Number(group.price || 0))
    const currentValue = totalQty * price
    let totalCostJpy = 0
    let currentValueJpy = 0
    let pricePnlJpy = 0
    let fxPnlJpy = 0
    let sawUsd = false
    let fxSplitReady = true
    let hideFxSplit = false
    let pnlValueJpy = 0
    for (const lot of group.lots) {
      const storedQty = Math.max(0, Number(lot.qty || 0))
      const storedBuy = Math.max(0, Number(lot.buyPrice || 0))
      const ratio = splitRatioAfter(toIsoDate(lot.buyDate || ''), group.symbol, stockSplits)
      const q = storedQty * ratio
      const buy = ratio > 0 ? storedBuy / ratio : storedBuy
      const parts = lotYenParts(lot, q, buy, price, fxRatesByDate, valuationUsdJpy)
      if (parts.currency === 'USD') sawUsd = true
      if (parts.hideFxSplit) hideFxSplit = true
      if (!parts.costKnown) fxSplitReady = false
      if (parts.included) currentValueJpy += parts.valueJpy
      if (parts.costKnown) {
        totalCostJpy += parts.costJpy
        pnlValueJpy += parts.valueJpy
      }
      if (parts.pricePnlJpy != null) pricePnlJpy += parts.pricePnlJpy
      if (parts.fxPnlJpy != null) fxPnlJpy += parts.fxPnlJpy
    }
    const pnlRate = fxSplitReady && totalCostJpy > 0 ? ((currentValueJpy - totalCostJpy) / totalCostJpy) * 100 : null
    const profileSector = String(group.lots[0]?.profileSector || '').trim()
    const profileIndustry = String(group.lots[0]?.profileIndustry || '').trim()
    return {
      ...group,
      profileSector,
      profileIndustry,
      stockCurrency,
      totalQty,
      totalCost,
      totalCostJpy,
      currentValue,
      currentValueJpy,
      pnlValueJpy,
      pnlRate,
      pricePnlJpy: sawUsd && fxSplitReady && !hideFxSplit ? pricePnlJpy : null,
      fxPnlJpy: sawUsd && fxSplitReady && !hideFxSplit ? fxPnlJpy : null,
    }
  })
  const avgDownPreview = useMemo(() => {
    if (!avgDownSelectedStock) return null
    const avgBuyPrice = Number(avgDownSelectedStock?.avgBuyPrice || 0)
    const currentPrice = Number(avgDownSelectedStock?.currentPrice || 0)
    const currentQty = Number(avgDownSelectedStock?.currentQty || 0)
    if (avgDownMode === 'qty') {
      const addQty = Number(sanitizeIntegerInput(avgDownAddQtyInput || ''))
      if (!Number.isFinite(addQty) || addQty <= 0) {
        return { ok: false, reason: '追加買い数量を入力してください。' }
      }
      if (!Number.isFinite(avgBuyPrice) || !Number.isFinite(currentPrice) || !Number.isFinite(currentQty) || avgBuyPrice <= 0 || currentPrice <= 0 || currentQty <= 0) {
        return { ok: false, reason: '数量・価格は 0 より大きい値が必要です。' }
      }
      const buyAmount = addQty * currentPrice
      const nextAvgPrice = (avgBuyPrice * currentQty + currentPrice * addQty) / Math.max(1, currentQty + addQty)
      return {
        ok: true,
        addQty,
        buyAmount,
        nextAvgPrice,
        targetAvgPrice: nextAvgPrice,
      }
    }
    const targetAvgPrice = Number(sanitizeDecimalInput(avgDownTargetPriceInput || ''))
    const plan = calcAveragingDownPlan({
      avgBuyPrice,
      currentPrice,
      currentQty,
      targetAvgPrice,
    })
    if (!plan?.ok) return { ok: false, reason: plan?.reason || '計算できません。' }
    const addQty = Number(plan.addQtyRoundedUp || 0)
    const buyAmount = addQty * currentPrice
    const nextAvgPrice = (avgBuyPrice * currentQty + currentPrice * addQty) / Math.max(1, currentQty + addQty)
    return {
      ok: true,
      addQty,
      buyAmount,
      nextAvgPrice,
      targetAvgPrice,
      /** 目標が現在価格に近いと分母 (T − P) が小さくなり必要株数が急増する（数学上正しい） */
      highAddQty: addQty >= 150,
    }
  }, [avgDownSelectedStock, avgDownTargetPriceInput, avgDownMode, avgDownAddQtyInput])
  const avgDownUiMeta = useMemo(() => {
    if (!avgDownSelectedStock) return null
    const avgBuyPrice = Number(avgDownSelectedStock?.avgBuyPrice || 0)
    const currentPrice = Number(avgDownSelectedStock?.currentPrice || 0)
    const currentQty = Number(avgDownSelectedStock?.currentQty || 0)
    const { targetMin, targetMax, targetEnabled, targetStep } = getAvgDownTargetSliderBounds(avgBuyPrice, currentPrice)
    const targetRaw = Number(sanitizeDecimalInput(avgDownTargetPriceInput || ''))
    const targetValue = targetEnabled
      ? Math.max(targetMin, Math.min(targetMax, Number.isFinite(targetRaw) ? targetRaw : targetMin))
      : targetRaw
    const qtyMax = Math.max(100, Math.ceil(Math.max(1, currentQty) * 3))
    const qtyRaw = Number(sanitizeIntegerInput(avgDownAddQtyInput || ''))
    const qtyValue = Math.max(1, Math.min(qtyMax, Number.isFinite(qtyRaw) ? qtyRaw : 1))
    return {
      targetStep,
      targetMin,
      targetMax,
      targetEnabled,
      targetValue,
      qtyMax,
      qtyValue,
    }
  }, [avgDownSelectedStock, avgDownTargetPriceInput, avgDownAddQtyInput])

  const groupedOwnedFunds = Object.values(
    (Array.isArray(ownedFundItems) ? ownedFundItems : []).reduce((acc, row) => {
      const sym = String(row?.symbol || '').trim().toUpperCase()
      if (!sym) return acc
      if (!acc[sym]) {
        acc[sym] = {
          symbol: sym,
          code: sym,
          name: String(row?.name || sym).trim() || sym,
          lots: [],
        }
      }
      acc[sym].lots.push(row)
      const n = String(row?.name || '').trim()
      if (n && n !== sym) acc[sym].name = n
      return acc
    }, {})
  ).map((group) => {
    const lotCalcs = group.lots.map((row) => {
      const fundCurrency = inferStockCurrency(row.symbol)
      const totalCost = Math.max(0, Number(row.investAmount || 0))
      const buyPrice = Math.max(0, Number(row.buyPrice || 0))
      const latestPrice = Math.max(0, Number(row.latestPrice || 0))
      const effectiveLatestPrice = latestPrice > 0 ? latestPrice : buyPrice
      const units = buyPrice > 0 ? totalCost / buyPrice : 0
      const currentValue = units > 0 && effectiveLatestPrice > 0 ? units * effectiveLatestPrice : 0
      const storedFundFx = Number(row.buyFxRate)
      const liveUsd = positiveUsdJpy(valuationUsdJpy)
      let totalCostJpy = 0
      let currentValueJpy = 0
      let costKnown = false
      if (fundCurrency === 'USD') {
        currentValueJpy = liveUsd != null ? currentValue * liveUsd : 0
        if (storedFundFx > 0 && liveUsd != null) {
          totalCostJpy = totalCost * storedFundFx
          costKnown = true
        }
      } else if (fundCurrency === 'JPY') {
        totalCostJpy = totalCost
        currentValueJpy = currentValue
        costKnown = true
      }
      const pnlValueJpy = costKnown ? currentValueJpy : 0
      return {
        id: row.id,
        symbol: row.symbol,
        name: row.name || row.symbol,
        fundCurrency,
        buyDate: row.buyDate || '',
        buyPrice,
        latestPrice,
        effectiveLatestPrice,
        tradeDate: row.tradeDate || '',
        units,
        totalCost,
        currentValue,
        totalCostJpy,
        currentValueJpy,
        pnlValueJpy,
        raw: row,
      }
    })
    const totalCostJpy = lotCalcs.reduce((s, x) => s + x.totalCostJpy, 0)
    const currentValueJpy = lotCalcs.reduce((s, x) => s + x.currentValueJpy, 0)
    const pnlValueJpy = lotCalcs.reduce((s, x) => s + Number(x.pnlValueJpy || 0), 0)
    const totalCostNative = lotCalcs.reduce((s, x) => s + x.totalCost, 0)
    const totalUnits = lotCalcs.reduce((s, x) => s + x.units, 0)
    const pnlRate = totalCostJpy > 0 ? ((currentValueJpy - totalCostJpy) / totalCostJpy) * 100 : null
    const latestPrice = Math.max(...lotCalcs.map((x) => x.effectiveLatestPrice), 0)
    const tradeDates = lotCalcs.map((x) => x.tradeDate).filter(Boolean).sort()
    const tradeDate = tradeDates.length > 0 ? tradeDates[tradeDates.length - 1] : ''
    const buyDates = lotCalcs.map((x) => toIsoDate(x.buyDate || '')).filter(Boolean).sort()
    const buyDateLabel = buyDates.length === 0 ? '' : buyDates.length === 1 ? buyDates[0] : `${buyDates[0]}〜`
    const avgBuyPrice = totalUnits > 0 ? totalCostNative / totalUnits : 0
    const fundCurrency = lotCalcs[0]?.fundCurrency || 'JPY'
    const currentValue = lotCalcs.reduce((s, x) => s + x.currentValue, 0)
    return {
      symbol: group.symbol,
      code: group.code,
      name: group.name,
      fundCurrency,
      lots: lotCalcs,
      buyDate: buyDateLabel,
      buyPrice: avgBuyPrice,
      latestPrice,
      tradeDate,
      units: totalUnits,
      totalCost: totalCostNative,
      currentValue,
      totalCostJpy,
      currentValueJpy,
      pnlValueJpy,
      pnlRate,
    }
  })
  const stockEarliestBuy = (() => {
    const dates = []
    groupedOwnedStocks.forEach((s) => s.lots?.forEach((l) => { const d = toIsoDate(l.buyDate || ''); if (d) dates.push(d) }))
    if (dates.length > 0) return dates.sort()[0]
    const raw = (Array.isArray(ownedStocks) ? ownedStocks : [])
      .map((r) => toIsoDate(r.buyDate || ''))
      .filter(Boolean)
    return raw.length > 0 ? raw.sort()[0] : null
  })()
  const rawStockSlots = Array.isArray(ownedStocks) ? ownedStocks.length : 0
  const rawFundSlots = Array.isArray(ownedFunds) ? ownedFunds.length : 0
  const hasRawStockHoldings = rawStockSlots > 0
  const hasRawFundHoldings = rawFundSlots > 0
  /** DB 同期直後は live 行が未構築 → 総資産が 0 や別ソース（モック資産など）でチラつくのを防ぐ */
  const ownedLiveRowsSynced = (
    (!hasRawStockHoldings
      || (Array.isArray(ownedStockItems) && ownedStockItems.length === rawStockSlots))
    && (!hasRawFundHoldings
      || (Array.isArray(ownedFundItems) && ownedFundItems.length === rawFundSlots))
  )
  /** 評価額依存の数字だけ隠してスピナー（保有取得原価はそのまま） */
  const portfolioNumbersHydratingMask =
    Boolean(portfolioQuotesHydrating && userId && (hasRawStockHoldings || hasRawFundHoldings))
  const stockLotBuyIsoDates = (() => {
    const s = new Set()
    const add = (rows) => {
      (rows || []).forEach((r) => {
        const d = toIsoDate(r?.buyDate || '')
        if (d) s.add(d)
      })
    }
    add(ownedStockItems)
    add(ownedStocks)
    return [...s].sort()
  })()
  const fundLotBuyIsoDates = (() => {
    const s = new Set()
    const add = (rows) => {
      (rows || []).forEach((r) => {
        const d = toIsoDate(r?.buyDate || '')
        if (d) s.add(d)
      })
    }
    add(ownedFundItems)
    add(ownedFunds)
    return [...s].sort()
  })()
  const assetLotBuyIsoDates = (() => {
    const s = new Set()
    ;[ownedStockItems, ownedStocks, ownedFundItems, ownedFunds].forEach((rows) => {
      (rows || []).forEach((r) => {
        const d = toIsoDate(r?.buyDate || '')
        if (d) s.add(d)
      })
    })
    return [...s].sort()
  })()
  const assetLotBuyIsoKey = assetLotBuyIsoDates.join('|')
  const stockLotMonthly = collapseLotBuysToMonthlyAnchors(stockLotBuyIsoDates)
  const fundLotMonthly = collapseLotBuysToMonthlyAnchors(fundLotBuyIsoDates)
  const assetLotMonthly = collapseLotBuysToMonthlyAnchors(assetLotBuyIsoDates)
  const stockTotalInvestedJpy = groupedOwnedStocks.reduce((sum, stock) => sum + Number(stock.totalCostJpy || 0), 0)
  const stockTotalCurrentJpy = groupedOwnedStocks.reduce((sum, stock) => sum + Number(stock.currentValueJpy || 0), 0)
  /** simplified: アイテム未取得でも ownedStocks/Funds があれば月次アンカー（2点買付日モードを避ける） */
  const stockGrowthOpts = {
    simplified: !hasRawStockHoldings,
    months: wealthChartMonths,
    earliestBuyDate: stockEarliestBuy,
    lotBuyIsoDates: stockLotMonthly.anchorIsos,
    lotMonthlyLabelByYmd: stockLotMonthly.labelByYmd,
  }
  const stockGrowthDataFb = buildAssetGrowthTrendData(stockTotalInvestedJpy, stockTotalCurrentJpy, stockGrowthOpts)
  const fundRowsByTransactions = groupedOwnedFunds.map((row) => ({
    id: row.symbol,
    name: row.name || row.symbol,
    symbol: row.symbol,
    color: '#3b82f6',
    investJpy: Number(row.totalCostJpy || 0),
    valueJpy: Number(row.currentValueJpy || 0),
  }))
  const effectiveFundRows = fundRowsByTransactions.length > 0 ? fundRowsByTransactions : fundRows
  const fundEarliestBuy = (() => {
    const dates = (groupedOwnedFunds || []).flatMap((g) => (g.lots || []).map((l) => toIsoDate(l.buyDate || ''))).filter(Boolean)
    if (dates.length > 0) return dates.sort()[0]
    const raw = (Array.isArray(ownedFunds) ? ownedFunds : [])
      .map((r) => toIsoDate(r.buyDate || ''))
      .filter(Boolean)
    return raw.length > 0 ? raw.sort()[0] : null
  })()
  const fundTotalInvestedJpy = effectiveFundRows.reduce((sum, item) => sum + Number(item.investJpy || 0), 0)
  const fundTotalCurrentJpy = effectiveFundRows.reduce((sum, item) => sum + Number(item.valueJpy || 0), 0)
  const fundGrowthOpts = {
    simplified: effectiveFundRows.length === 0 && !hasRawFundHoldings,
    months: wealthChartMonths,
    earliestBuyDate: fundEarliestBuy,
    lotBuyIsoDates: fundLotMonthly.anchorIsos,
    lotMonthlyLabelByYmd: fundLotMonthly.labelByYmd,
  }
  const fundGrowthDataFb = buildAssetGrowthTrendData(fundTotalInvestedJpy, fundTotalCurrentJpy, fundGrowthOpts)
  const totalInvested = stockTotalInvestedJpy + fundTotalInvestedJpy
  const totalCurrentValue = stockTotalCurrentJpy + fundTotalCurrentJpy
  liveWealthTotalsRef.current = { stock: stockTotalCurrentJpy, fund: fundTotalCurrentJpy }
  const stockPnlValueJpy = groupedOwnedStocks.reduce((sum, stock) => sum + Number(stock.pnlValueJpy || 0), 0)
  const fundPnlValueJpy = groupedOwnedFunds.reduce((sum, row) => sum + Number(row.pnlValueJpy || 0), 0)
  const totalPnL = (stockPnlValueJpy + fundPnlValueJpy) - totalInvested
  const totalReturnRate = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const stockRealizedPnlSum = (Array.isArray(realizedStockTrades) ? realizedStockTrades : []).reduce(
    (s, t) => s + Number(t.realizedPnlJpy || 0),
    0,
  )
  const stockRealizedCostSum = (Array.isArray(realizedStockTrades) ? realizedStockTrades : []).reduce(
    (s, t) => s + Number(t.costBasisJpy || 0),
    0,
  )
  const stockRealizedProceedsSum = (Array.isArray(realizedStockTrades) ? realizedStockTrades : []).reduce(
    (s, t) => s + Number(t.proceedsJpy || 0),
    0,
  )
  const realizedStockTradesWindowed = filterRealizedStockTradesByWindow(realizedStockTrades, stockRealizedWindow)
  const stockRealizedPnlSumWindow = (Array.isArray(realizedStockTradesWindowed) ? realizedStockTradesWindowed : []).reduce(
    (s, t) => s + Number(t.realizedPnlJpy || 0),
    0,
  )
  const stockRealizedCostSumWindow = (Array.isArray(realizedStockTradesWindowed) ? realizedStockTradesWindowed : []).reduce(
    (s, t) => s + Number(t.costBasisJpy || 0),
    0,
  )
  const stockRealizedReturnPctWindow =
    stockRealizedCostSumWindow > 0 && Number.isFinite(stockRealizedPnlSumWindow)
      ? (stockRealizedPnlSumWindow / stockRealizedCostSumWindow) * 100
      : null
  const stockOpenAndRealizedCostDenom = stockTotalInvestedJpy + stockRealizedCostSum
  const stockPnlWithRealizedJpy =
    stockPnlValueJpy - Number(stockTotalInvestedJpy || 0) + stockRealizedPnlSum
  const stockReturnWithRealizedPct =
    stockOpenAndRealizedCostDenom > 0 && Number.isFinite(stockPnlWithRealizedJpy)
      ? (stockPnlWithRealizedJpy / stockOpenAndRealizedCostDenom) * 100
      : null
  const fundRealizedPnlSum = (Array.isArray(realizedFundTrades) ? realizedFundTrades : []).reduce(
    (s, t) => s + Number(t.realizedPnlJpy || 0),
    0,
  )
  const fundRealizedCostSum = (Array.isArray(realizedFundTrades) ? realizedFundTrades : []).reduce(
    (s, t) => s + Number(t.costBasisJpy || 0),
    0,
  )
  const fundRealizedProceedsSum = (Array.isArray(realizedFundTrades) ? realizedFundTrades : []).reduce(
    (s, t) => s + Number(t.proceedsJpy || 0),
    0,
  )
  const realizedFundTradesWindowed = filterRealizedStockTradesByWindow(realizedFundTrades, stockRealizedWindow)
  const fundRealizedPnlSumWindow = (Array.isArray(realizedFundTradesWindowed) ? realizedFundTradesWindowed : []).reduce(
    (s, t) => s + Number(t.realizedPnlJpy || 0),
    0,
  )
  const fundRealizedCostSumWindow = (Array.isArray(realizedFundTradesWindowed) ? realizedFundTradesWindowed : []).reduce(
    (s, t) => s + Number(t.costBasisJpy || 0),
    0,
  )
  const fundRealizedReturnPctWindow =
    fundRealizedCostSumWindow > 0 && Number.isFinite(fundRealizedPnlSumWindow)
      ? (fundRealizedPnlSumWindow / fundRealizedCostSumWindow) * 100
      : null
  const wealthRealizedPnlSumWindow = stockRealizedPnlSumWindow + fundRealizedPnlSumWindow
  const wealthRealizedCostSumWindow = stockRealizedCostSumWindow + fundRealizedCostSumWindow
  const wealthRealizedReturnPctWindow =
    wealthRealizedCostSumWindow > 0 && Number.isFinite(wealthRealizedPnlSumWindow)
      ? (wealthRealizedPnlSumWindow / wealthRealizedCostSumWindow) * 100
      : null
  const fundOpenAndRealizedCostDenom = fundTotalInvestedJpy + fundRealizedCostSum
  const fundPnlWithRealizedJpy =
    fundPnlValueJpy - Number(fundTotalInvestedJpy || 0) + fundRealizedPnlSum
  const fundReturnWithRealizedPct =
    fundOpenAndRealizedCostDenom > 0 && Number.isFinite(fundPnlWithRealizedJpy)
      ? (fundPnlWithRealizedJpy / fundOpenAndRealizedCostDenom) * 100
      : null
  const accountPnlWithRealizedJpy = totalPnL + stockRealizedPnlSum + fundRealizedPnlSum
  const accountCostWithRealizedDenom = totalInvested + stockRealizedCostSum + fundRealizedCostSum
  const accountReturnWithRealizedPct =
    accountCostWithRealizedDenom > 0 && Number.isFinite(accountPnlWithRealizedJpy)
      ? (accountPnlWithRealizedJpy / accountCostWithRealizedDenom) * 100
      : null
  const monthlyDeltaJpy = monthlyPnlBase
    ? accountPnlWithRealizedJpy - Number(monthlyPnlBase.basePnl || 0)
    : null
  const monthlyDeltaPct = monthlyDeltaJpy != null && accountCostWithRealizedDenom > 0
    ? (monthlyDeltaJpy / accountCostWithRealizedDenom) * 100
    : null
  const totalHoldingsCount = groupedOwnedStocks.length + effectiveFundRows.length
  const assetEarliestBuy = (() => {
    const stockDates = []
    groupedOwnedStocks.forEach((s) => s.lots?.forEach((l) => { const d = toIsoDate(l.buyDate || ''); if (d) stockDates.push(d) }))
    const fundDates = (groupedOwnedFunds || []).flatMap((g) => (g.lots || []).map((l) => toIsoDate(l.buyDate || ''))).filter(Boolean)
    let all = [...stockDates, ...fundDates].filter(Boolean)
    if (all.length === 0) {
      const sr = (Array.isArray(ownedStocks) ? ownedStocks : []).map((r) => toIsoDate(r.buyDate || '')).filter(Boolean)
      const fr = (Array.isArray(ownedFunds) ? ownedFunds : []).map((r) => toIsoDate(r.buyDate || '')).filter(Boolean)
      all = [...sr, ...fr]
    }
    return all.length > 0 ? all.sort()[0] : null
  })()
  const assetGrowthOpts = {
    simplified: totalHoldingsCount === 0 && !hasRawStockHoldings && !hasRawFundHoldings,
    months: wealthChartMonths,
    earliestBuyDate: assetEarliestBuy,
    lotBuyIsoDates: assetLotMonthly.anchorIsos,
    lotMonthlyLabelByYmd: assetLotMonthly.labelByYmd,
  }
  const assetGrowthDataFb = buildAssetGrowthTrendData(totalInvested, totalCurrentValue, assetGrowthOpts)
  const assetGrowthSplitDataFb = buildAssetGrowthTrendSplitData(
    stockTotalInvestedJpy,
    stockTotalCurrentJpy,
    fundTotalInvestedJpy,
    fundTotalCurrentJpy,
    assetGrowthOpts,
  )

  useEffect(() => {
    let alive = true

    const runWealthPriceResync = async () => {
      const stocks = Array.isArray(ownedStockItems) ? ownedStockItems : []
      const funds = Array.isArray(ownedFundItems) ? ownedFundItems : []
      if (stocks.length === 0 && funds.length === 0) {
        if (!alive) return
        setHistoricalWealthTrend(null)
        setPortfolioDropSnapshot(null)
        return
      }
      const buyDates = [
        ...stocks.map((r) => toIsoDate(r.buyDate || '')),
        ...funds.map((r) => toIsoDate(r.buyDate || '')),
      ].filter(Boolean)
      if (buyDates.length === 0) {
        if (!alive) return
        setHistoricalWealthTrend(null)
        setPortfolioDropSnapshot(null)
        return
      }

      const endForPack = toLocalYmd(new Date())
      let startForPack = [...buyDates].sort()[0]
      const minStart = shiftIsoDateByDays(endForPack, -399)
      if (minStart && startForPack < minStart) startForPack = minStart
      const dailyAnchors = []
      for (let day = startForPack, n = 0; day && day <= endForPack && n < 400; day = shiftIsoDateByDays(day, 1), n += 1) {
        dailyAnchors.push(new Date(`${day}T12:00:00`))
      }
      const dailyPack = {
        anchors: dailyAnchors,
        labels: dailyAnchors.map((d, idx) => (idx === dailyAnchors.length - 1 ? formatAssetTrendLatestLabel(d) : formatAssetTrendMd(d))),
      }
      const packC = dailyPack.anchors.length >= 2 ? dailyPack : collectTrendAnchorsFromOpts(assetGrowthOpts)
      const packS = packC
      const packF = packC

      const endStr = toLocalYmd(new Date())
      const startCandidates = [
        ...buyDates,
        ...packC.anchors.map((d) => toLocalYmd(d)),
        ...packS.anchors.map((d) => toLocalYmd(d)),
        ...packF.anchors.map((d) => toLocalYmd(d)),
      ].filter(Boolean)
      const startStr = startCandidates.sort()[0]
      if (!startStr || !endStr) {
        if (!alive) return
        setHistoricalWealthTrend(null)
        setPortfolioDropSnapshot(null)
        return
      }
      const startFetchStr = shiftIsoDateByDays(startStr, -10) || startStr

      const symSet = new Set()
      stocks.forEach((r) => {
        const s = String(r.symbol || '').trim().toUpperCase()
        if (s) symSet.add(s)
      })
      funds.forEach((r) => {
        const s = String(r.symbol || '').trim().toUpperCase()
        if (s) symSet.add(s)
      })
      const symbols = [...symSet]
      if (symbols.length === 0) {
        if (!alive) return
        setHistoricalWealthTrend(null)
        setPortfolioDropSnapshot(null)
        return
      }

      try {
        const priceResults = await Promise.all(
          symbols.map(async (sym) => {
            const { data, error } = await supabase
              .from('stock_daily_prices')
              .select('trade_date,close')
              .eq('symbol', sym)
              .gte('trade_date', startFetchStr)
              .lte('trade_date', endStr)
              .order('trade_date', { ascending: true })
              .limit(600)
            if (error) throw error
            return { sym, rows: Array.isArray(data) ? data : [] }
          }),
        )
        if (!alive) return
        const priceBySymbol = new Map()
        for (const { sym, rows } of priceResults) {
          if (!sym) continue
          priceBySymbol.set(
            String(sym).trim().toUpperCase(),
            rows.filter((r) => r && r.trade_date),
          )
        }

        let fxByDate = {}
        try {
          const fr = await fetch(`/api/fx?start_date=${startFetchStr}&end_date=${endStr}`)
          const fj = await fr.json()
          fxByDate = fj?.ratesByDate && typeof fj.ratesByDate === 'object' ? fj.ratesByDate : {}
        } catch {
          fxByDate = {}
        }
        const mergedFx = {
          ...(fxRatesByDate && typeof fxRatesByDate === 'object' ? fxRatesByDate : {}),
          ...fxByDate,
        }
        if (!alive) return

        const todayIso = toLocalYmd(new Date())
        const prevDayIso = shiftIsoDateByDays(todayIso, -1)
        const prevWeekIso = shiftIsoDateByDays(todayIso, -7)
        const prevDayValue = computePortfolioValueOnDate({
          asOfIso: prevDayIso,
          ownedStockItems: stocks,
          ownedFundItems: funds,
          priceBySymbol,
          fxByDate: mergedFx,
          valuationUsdJpy,
        })
        const prevWeekValue = computePortfolioValueOnDate({
          asOfIso: prevWeekIso,
          ownedStockItems: stocks,
          ownedFundItems: funds,
          priceBySymbol,
          fxByDate: mergedFx,
          valuationUsdJpy,
        })

        const live = liveWealthTotalsRef.current
        const stockTrades = (Array.isArray(realizedStockTrades) ? realizedStockTrades : []).map((t) => ({ ...t, kind: 'stock' }))
        const fundTrades = (Array.isArray(realizedFundTrades) ? realizedFundTrades : []).map((t) => ({ ...t, kind: 'fund' }))
        const seriesC = computeHistoricalWealthTrendSeries({
          anchorPack: packC,
          ownedStockItems: stocks,
          ownedFundItems: funds,
          priceBySymbol,
          fxByDate: mergedFx,
          valuationUsdJpy,
          liveStockJpy: Number(live.stock || 0),
          liveFundJpy: Number(live.fund || 0),
          splits: stockSplits,
          trades: [...stockTrades, ...fundTrades],
        })
        const seriesS = computeHistoricalWealthTrendSeries({
          anchorPack: packS,
          ownedStockItems: stocks,
          ownedFundItems: [],
          priceBySymbol,
          fxByDate: mergedFx,
          valuationUsdJpy,
          liveStockJpy: Number(live.stock || 0),
          liveFundJpy: 0,
          splits: stockSplits,
          trades: stockTrades,
        })
        const seriesF = computeHistoricalWealthTrendSeries({
          anchorPack: packF,
          ownedStockItems: [],
          ownedFundItems: funds,
          priceBySymbol,
          fxByDate: mergedFx,
          valuationUsdJpy,
          liveStockJpy: 0,
          liveFundJpy: Number(live.fund || 0),
          splits: stockSplits,
          trades: fundTrades,
        })
        const priceBook = {}
        for (const [sym, rows] of priceBySymbol) {
          priceBook[sym] = (rows || []).map((r) => [String(r.trade_date || ''), Number(r.close)])
        }
        const month = monthlyChange({
          today: toLocalYmd(new Date()),
          fx_latest: valuationUsdJpy,
          splits: stockSplits,
          prices: priceBook,
          lots: [
            ...stocks.map((lot) => ({
              ticker: lot.symbol,
              buy_date: toIsoDate(lot.buyDate || ''),
              qty: Number(lot.qty),
              buy_price: Number(lot.buyPrice),
              buy_fx_rate: Number(lot.buyFxRate) > 0 ? Number(lot.buyFxRate) : null,
            })),
            ...funds.map((lot) => ({
              ticker: lot.symbol,
              buy_date: toIsoDate(lot.buyDate || lot.buy_date || ''),
              qty: Number(lot.buyPrice || lot.buy_price) > 0 ? Number(lot.investAmount || lot.invest_amount) / Number(lot.buyPrice || lot.buy_price) : 0,
              buy_price: Number(lot.buyPrice || lot.buy_price),
              invest_amount: Number(lot.investAmount || lot.invest_amount),
              buy_fx_rate: Number(lot.buyFxRate) > 0 ? Number(lot.buyFxRate) : null,
            })),
          ],
          trades: [...stockTrades, ...fundTrades].map((t) => ({
            symbol: t.symbol,
            sell_date: toIsoDate(t.sellDate || ''),
            realized_pnl_jpy: Number(t.realizedPnlJpy || 0),
            cost_basis_jpy: Number(t.costBasisJpy || 0),
            buy_lots: t.buyLots || [],
          })),
        })
        if (alive) setMonthlyPnlBase({ baseDate: month.base_date, basePnl: month.base_pnl })

        if (!alive) return
        setHistoricalWealthTrend({
          assetGrowthData: seriesC.assetGrowthData,
          assetGrowthSplitData: seriesC.assetGrowthSplitData,
          stockGrowthData: seriesS.stockGrowthData,
          fundGrowthData: seriesF.fundGrowthData,
        })
        setPortfolioDropSnapshot({
          asOfDate: todayIso,
          prevDayDate: prevDayIso,
          prevWeekDate: prevWeekIso,
          prevDayValue,
          prevWeekValue,
        })
      } catch {
        if (alive) {
          setHistoricalWealthTrend(null)
          setPortfolioDropSnapshot(null)
        }
      }
    }

    if (wealthPriceResyncTimerRef.current) {
      clearTimeout(wealthPriceResyncTimerRef.current)
      wealthPriceResyncTimerRef.current = null
    }
    wealthPriceResyncTimerRef.current = setTimeout(() => {
      wealthPriceResyncTimerRef.current = null
      if (!alive) return
      void runWealthPriceResync()
    }, 550)

    return () => {
      alive = false
      if (wealthPriceResyncTimerRef.current) {
        clearTimeout(wealthPriceResyncTimerRef.current)
        wealthPriceResyncTimerRef.current = null
      }
    }
  }, [
    ownedStockItems,
    ownedFundItems,
    rawStockSlots,
    rawFundSlots,
    assetLotBuyIsoKey,
    wealthChartMonths,
    valuationUsdJpy,
    fxRatesByDate,
    stockEarliestBuy,
    fundEarliestBuy,
    assetEarliestBuy,
    totalHoldingsCount,
    groupedOwnedStocks.length,
    effectiveFundRows.length,
    stockTotalInvestedJpy,
    fundTotalInvestedJpy,
    stockSplits,
    realizedStockTrades,
    realizedFundTrades,
  ])

  const stockGrowthData = historicalWealthTrend?.stockGrowthData ?? stockGrowthDataFb
  const fundGrowthData = historicalWealthTrend?.fundGrowthData ?? fundGrowthDataFb
  const assetGrowthData = historicalWealthTrend?.assetGrowthData ?? assetGrowthDataFb
  const assetGrowthSplitData = historicalWealthTrend?.assetGrowthSplitData ?? assetGrowthSplitDataFb

  const stockPerformanceBarRows = useMemo(() => {
    const rows = Array.isArray(stockGrowthData) ? stockGrowthData : []
    return rows.map((r) => {
      const v = Math.max(0, Math.round(Number(r.value || 0)))
      let c = Number(r.costJpy)
      if (!Number.isFinite(c)) {
        const p = Number(r.pnlJpy)
        c = Number.isFinite(p) ? v - p : NaN
      }
      if (!Number.isFinite(c)) c = v
      c = Math.max(0, Math.round(c))
      let basisJpy = 0
      let gainJpy = 0
      let lossJpy = 0
      if (v >= c) {
        basisJpy = c
        gainJpy = v - c
      } else {
        basisJpy = v
        lossJpy = c - v
      }
      return { ...r, basisJpy, gainJpy, lossJpy }
    })
  }, [stockGrowthData])

  const fundPerformanceBarRows = useMemo(() => {
    const rows = Array.isArray(fundGrowthData) ? fundGrowthData : []
    return rows.map((r) => {
      const v = Math.max(0, Math.round(Number(r.value || 0)))
      let c = Number(r.costJpy)
      if (!Number.isFinite(c)) {
        const p = Number(r.pnlJpy)
        c = Number.isFinite(p) ? v - p : NaN
      }
      if (!Number.isFinite(c)) c = v
      c = Math.max(0, Math.round(c))
      let basisJpy = 0
      let gainJpy = 0
      let lossJpy = 0
      if (v >= c) {
        basisJpy = c
        gainJpy = v - c
      } else {
        basisJpy = v
        lossJpy = c - v
      }
      return { ...r, basisJpy, gainJpy, lossJpy }
    })
  }, [fundGrowthData])

  const stockSectorData = Object.values(groupedOwnedStocks.reduce((acc, stock) => {
    const sector = sectorForOwnedStockPie(stock)
    if (!acc[sector]) {
      acc[sector] = { name: sector, value: 0, color: '#94a3b8' }
    }
    acc[sector].value += Number(stock.currentValueJpy || 0)
    return acc
  }, {})).sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .map((row, idx) => ({
      ...row,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b'][idx % 7],
    }))
  const fundPieValueJpy = (fund) => {
    const v = Number(fund?.valueJpy || 0)
    if (Number.isFinite(v) && v > 0) return v
    const cost = Number(fund?.investJpy || 0)
    return Number.isFinite(cost) && cost > 0 ? cost : 0
  }
  const fundTotalPieJpy = effectiveFundRows.reduce((sum, f) => sum + fundPieValueJpy(f), 0)
  const fundCountryData = Object.values(effectiveFundRows.reduce((acc, fund) => {
    const key = inferFundCountryLabel(fund.symbol || fund.id, fund.name)
    if (!acc[key]) acc[key] = { name: key, value: 0, color: '#94a3b8' }
    acc[key].value += fundPieValueJpy(fund)
    return acc
  }, {})).sort((a, b) => Number(b.value || 0) - Number(a.value || 0)).map((row, idx) => ({
    ...row,
    color: ['#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899'][idx % 6],
  }))
  const isWealthTab = tabMode === 'wealth'
  const isStockTab = tabMode === 'stock'
  const isFundTab = tabMode === 'fund'
  const stockHasInputs = groupedOwnedStocks.length > 0
  /** ownedStockItems は v_stock_latest / プロファイル取得より遅れる。raw の保有ロットがあれば「未登録」バナーを出さない */
  const stockReportHasData =
    hasRawStockHoldings
    || stockHasInputs
    || (Array.isArray(realizedStockTrades) && realizedStockTrades.length > 0)
  const stockRealizedWindowLabelJaCompact = realizedPnlWindowLabelJaCompact(stockRealizedWindow)
  const fundHasInputs = groupedOwnedFunds.length > 0
  const fundReportHasData =
    hasRawFundHoldings
    || fundHasInputs
    || (Array.isArray(realizedFundTrades) && realizedFundTrades.length > 0)
  const wealthReportHasData =
    hasRawStockHoldings
    || hasRawFundHoldings
    || stockHasInputs
    || fundHasInputs
    || (Array.isArray(realizedStockTrades) && realizedStockTrades.length > 0)
    || (Array.isArray(realizedFundTrades) && realizedFundTrades.length > 0)
  const calcStaleDays = (tradeDate) => {
    const iso = toIsoDate(tradeDate || '')
    if (!iso) return null
    const base = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(base.getTime())) return null
    const now = new Date()
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const baseUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
    return Math.max(0, Math.floor((todayUtc - baseUtc) / (1000 * 60 * 60 * 24)))
  }
  const stalePriceRows = [
    ...groupedOwnedStocks
      .map((row) => ({
        type: '株式',
        symbol: row.symbol,
        name: row.name || row.symbol,
        tradeDate: row.tradeDate || '',
        staleDays: calcStaleDays(row.tradeDate),
      })),
    ...groupedOwnedFunds
      .map((row) => ({
        type: 'ファンド',
        symbol: row.symbol,
        name: row.name || row.symbol,
        tradeDate: row.tradeDate || '',
        staleDays: calcStaleDays(row.tradeDate),
      })),
  ]
    .filter((row) => Number.isFinite(Number(row.staleDays)) && Number(row.staleDays) >= PRICE_STALE_ALERT_DAYS)
    .sort((a, b) => Number(b.staleDays || 0) - Number(a.staleDays || 0))
  const prevDayPortfolioValue = Number(portfolioDropSnapshot?.prevDayValue || 0)
  const prevWeekPortfolioValue = Number(portfolioDropSnapshot?.prevWeekValue || 0)
  // 0.01% 単位（centis）に量子化 — 評価額の微変動で useMemo→履歴 effect→dispatch が連鎖しないようにする
  const dayChangePctCentis = useMemo(() => {
    if (!(prevDayPortfolioValue > 0)) return null
    const raw = ((totalCurrentValue - prevDayPortfolioValue) / prevDayPortfolioValue) * 100
    if (!Number.isFinite(raw)) return null
    return Math.round(raw * 100)
  }, [totalCurrentValue, prevDayPortfolioValue])
  const weekChangePctCentis = useMemo(() => {
    if (!(prevWeekPortfolioValue > 0)) return null
    const raw = ((totalCurrentValue - prevWeekPortfolioValue) / prevWeekPortfolioValue) * 100
    if (!Number.isFinite(raw)) return null
    return Math.round(raw * 100)
  }, [totalCurrentValue, prevWeekPortfolioValue])
  const dayChangePct = dayChangePctCentis == null ? null : dayChangePctCentis / 100
  const weekChangePct = weekChangePctCentis == null ? null : weekChangePctCentis / 100
  const currentPortfolioAlertDate = String(portfolioDropSnapshot?.asOfDate || '')
  // 毎レンダー新しい配列参照になると、下の履歴 upsert useEffect が常に再実行され、
  // アラート表示中は dispatch → App setState → 無限ループになり得るため useMemo で安定化する。
  const portfolioDropAlerts = useMemo(() => {
    if (!isPaidMember || portfolioDropThresholdPct == null) return []
    const thrCentis = Math.round(Number(portfolioDropThresholdPct) * 100)
    return [
      dayChangePctCentis != null && dayChangePctCentis <= thrCentis
        ? {
            key: 'daily',
            label: '前日比',
            pct: dayChangePctCentis / 100,
            baseDate: portfolioDropSnapshot?.prevDayDate || '',
            baseValue: prevDayPortfolioValue,
          }
        : null,
      weekChangePctCentis != null && weekChangePctCentis <= thrCentis
        ? {
            key: 'weekly',
            label: '前週比',
            pct: weekChangePctCentis / 100,
            baseDate: portfolioDropSnapshot?.prevWeekDate || '',
            baseValue: prevWeekPortfolioValue,
          }
        : null,
    ].filter(Boolean)
  }, [
    isPaidMember,
    portfolioDropThresholdPct,
    dayChangePctCentis,
    weekChangePctCentis,
    portfolioDropSnapshot?.prevDayDate,
    portfolioDropSnapshot?.prevWeekDate,
    prevDayPortfolioValue,
    prevWeekPortfolioValue,
  ])
  const hasPortfolioDropAlert = portfolioDropAlerts.length > 0
  const portfolioRiseAlerts = useMemo(() => {
    if (!isPaidMember) return []
    const riseThrCentis =
      portfolioRiseThresholdPct === 5 || portfolioRiseThresholdPct === 10
        ? Math.round(Number(portfolioRiseThresholdPct) * 100)
        : null
    const riseThresholdActive = riseThrCentis != null
    return [
      riseThresholdActive && dayChangePctCentis != null && dayChangePctCentis >= riseThrCentis
        ? {
            key: 'daily_gain',
            label: '前日比',
            pct: dayChangePctCentis / 100,
            baseDate: portfolioDropSnapshot?.prevDayDate || '',
            baseValue: prevDayPortfolioValue,
          }
        : null,
      riseThresholdActive && weekChangePctCentis != null && weekChangePctCentis >= riseThrCentis
        ? {
            key: 'weekly_gain',
            label: '前週比',
            pct: weekChangePctCentis / 100,
            baseDate: portfolioDropSnapshot?.prevWeekDate || '',
            baseValue: prevWeekPortfolioValue,
          }
        : null,
    ].filter(Boolean)
  }, [
    isPaidMember,
    portfolioRiseThresholdPct,
    dayChangePctCentis,
    weekChangePctCentis,
    portfolioDropSnapshot?.prevDayDate,
    portfolioDropSnapshot?.prevWeekDate,
    prevDayPortfolioValue,
    prevWeekPortfolioValue,
  ])
  const hasPortfolioRiseAlert = portfolioRiseAlerts.length > 0
  const isPortfolioAlertReadForCurrentDate =
    Boolean(currentPortfolioAlertDate)
    && String(portfolioAlertReadAtDate) === currentPortfolioAlertDate
  const visiblePortfolioDropAlerts = isPortfolioAlertReadForCurrentDate ? [] : portfolioDropAlerts
  const visiblePortfolioRiseAlerts = isPortfolioAlertReadForCurrentDate ? [] : portfolioRiseAlerts
  const hasVisiblePortfolioDropAlert = visiblePortfolioDropAlerts.length > 0
  const hasVisiblePortfolioRiseAlert = visiblePortfolioRiseAlerts.length > 0
  /** 配列参照ではなく閾値＋centis＋発火マスクだけで履歴 effect を駆動（+5% 直後の再実行ループ防止） */
  const portfolioAlertHistoryKey = useMemo(() => {
    const alertDate = String(portfolioDropSnapshot?.asOfDate || '')
    if (!isPaidMember || !userId || !alertDate) return ''
    const thrC = portfolioDropThresholdPct == null ? null : Math.round(Number(portfolioDropThresholdPct) * 100)
    const riseC =
      portfolioRiseThresholdPct === 5 || portfolioRiseThresholdPct === 10
        ? Math.round(Number(portfolioRiseThresholdPct) * 100)
        : null
    const dc = dayChangePctCentis
    const wc = weekChangePctCentis
    const bits = []
    if (thrC != null && dc != null && dc <= thrC) bits.push('dd')
    if (thrC != null && wc != null && wc <= thrC) bits.push('dw')
    if (riseC != null && dc != null && dc >= riseC) bits.push('rd')
    if (riseC != null && wc != null && wc >= riseC) bits.push('rw')
    if (!bits.length) return ''
    const mask = [...bits].sort().join('')
    return `${String(userId)}@${alertDate}@thr:${thrC}@rise:${riseC ?? 'x'}@dc:${dc}@wc:${wc}@m:${mask}`
  }, [
    userId,
    isPaidMember,
    portfolioDropSnapshot?.asOfDate,
    portfolioDropThresholdPct,
    portfolioRiseThresholdPct,
    dayChangePctCentis,
    weekChangePctCentis,
  ])
  const openPortfolioAlertsPremium = () => {
    if (typeof onUiMessage === 'function') {
      onUiMessage('ポートフォリオ下落・上昇アラートはプレミアム限定です。', 'premium')
    }
    navigate('/premium')
  }

  const handlePortfolioThresholdChange = (nextThresholdRaw) => {
    if (!isPaidMember) {
      openPortfolioAlertsPremium()
      return
    }
    const nextThreshold =
      nextThresholdRaw === null || nextThresholdRaw === undefined || nextThresholdRaw === 'off'
        ? null
        : Number(nextThresholdRaw)
    if (nextThreshold !== null) {
      if (!Number.isFinite(nextThreshold)) return
      if (![-3, -5, -7].includes(Math.round(nextThreshold))) return
    }
    const riseAtClick = portfolioRiseThresholdPct
    setPortfolioDropThresholdPct(nextThreshold)
    const uid = userId
    if (!uid) return
    void (async () => {
      try {
        await saveUserPortfolioDropAlertSetting({
          userId: uid,
          thresholdPct: nextThreshold,
          riseThresholdPct: riseAtClick,
        })
        // 成功後は再 setState / dispatch しない（낙관 UI が既に正しい。二重更新で 깜빡임 방지）
      } catch {
        // ignore temporary failure
      }
    })()
  }
  const handlePortfolioRiseThresholdChange = (nextRiseRaw) => {
    if (!isPaidMember) {
      openPortfolioAlertsPremium()
      return
    }
    const nextRise = nextRiseRaw === null || nextRiseRaw === undefined || nextRiseRaw === 'off'
      ? null
      : Number(nextRiseRaw)
    if (nextRise !== null && nextRise !== 5 && nextRise !== 10) return
    const dropAtClick = portfolioDropThresholdPct
    setPortfolioRiseThresholdPct(nextRise)
    const uid = userId
    if (!uid) return
    void (async () => {
      try {
        await saveUserPortfolioDropAlertSetting({
          userId: uid,
          thresholdPct: dropAtClick,
          riseThresholdPct: nextRise,
        })
        // 成功後は再 setState / dispatch しない（낙관 UI 유지、깜빡임 방지）
      } catch {
        // ignore temporary failure
      }
    })()
  }
  const acknowledgePortfolioDropAlertToday = async () => {
    if (!userId || !isPaidMember) return
    const alertDate = currentPortfolioAlertDate
    if (!alertDate) return
    try {
      // Clear all active portfolio alerts together to avoid stale badge leftovers.
      await acknowledgePortfolioDropAlerts({ userId })
      setPortfolioAlertReadAtDate(alertDate)
      window.dispatchEvent(new CustomEvent('mm-portfolio-alert-refresh'))
    } catch {
      // ignore
    }
  }
  portfolioAlertLatestTotalJpyRef.current = Number(totalCurrentValue || 0)
  useEffect(() => {
    if (!portfolioAlertHistoryKey) return
    const uid = userId
    const alertDate = String(portfolioDropSnapshot?.asOfDate || '')
    if (!uid || !alertDate || (portfolioDropAlerts.length === 0 && portfolioRiseAlerts.length === 0)) return
    let cancelled = false
    ;(async () => {
      const latestTotal = Number(portfolioAlertLatestTotalJpyRef.current || 0)
      for (const row of portfolioDropAlerts) {
        try {
          await upsertPortfolioDropAlertHistory({
            userId: uid,
            alertDate,
            baselineType: row?.key,
            thresholdPct: portfolioDropThresholdPct,
            changePct: Number(row?.pct || 0),
            baseDate: row?.baseDate || null,
            asOfDate: alertDate,
            baseValue: Number(row?.baseValue || 0),
            currentValue: latestTotal,
            payload: {
              label: row?.label || '',
              direction: 'drop',
            },
          })
        } catch {
          // ignore on unsupported schema
        }
      }
      for (const row of portfolioRiseAlerts) {
        try {
          await upsertPortfolioDropAlertHistory({
            userId: uid,
            alertDate,
            baselineType: row?.key,
            thresholdPct: portfolioRiseThresholdPct,
            changePct: Number(row?.pct || 0),
            baseDate: row?.baseDate || null,
            asOfDate: alertDate,
            baseValue: Number(row?.baseValue || 0),
            currentValue: latestTotal,
            payload: {
              label: row?.label || '',
              direction: 'rise',
            },
          })
        } catch {
          // ignore on unsupported schema
        }
      }
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [portfolioAlertHistoryKey])
  /** 株式／ファンドを分けた累計（評価−元本）と収益率（月次変動サマリー・合計の定義は totalPnL／totalReturnRate と一致） */
  const aggStockPnLJpy = stockPnlValueJpy - Number(stockTotalInvestedJpy || 0)
  const aggFundPnLJpy = fundPnlValueJpy - Number(fundTotalInvestedJpy || 0)
  const aggStockReturnPct = stockTotalInvestedJpy > 0 && Number.isFinite(aggStockPnLJpy)
    ? (aggStockPnLJpy / stockTotalInvestedJpy) * 100
    : null
  const aggFundReturnPct = fundTotalInvestedJpy > 0 && Number.isFinite(aggFundPnLJpy)
    ? (aggFundPnLJpy / fundTotalInvestedJpy) * 100
    : null
  /** 含み損益合計に占める株式／ファンドの割合（同方向のときのみバー表示。相殺時は説明のみ） */
  const monthlyUnrealizedPnlSplit = (() => {
    if (!Number.isFinite(totalPnL) || totalInvested <= 0) return { mode: 'none' }
    if (Math.abs(totalPnL) < 1e-9) return { mode: 'zero' }
    const s = aggStockPnLJpy
    const f = aggFundPnLJpy
    const stockOk = Number.isFinite(s)
    const fundOk = Number.isFinite(f)
    if (!stockOk || !fundOk) return { mode: 'none' }
    const sameDirection =
      (totalPnL > 0 && s >= 0 && f >= 0) || (totalPnL < 0 && s <= 0 && f <= 0)
    if (!sameDirection) return { mode: 'offset' }
    const stockPct = (s / totalPnL) * 100
    const fundPct = (f / totalPnL) * 100
    const stockBarW = Math.max(0, Math.min(100, stockPct))
    const fundBarW = Math.max(0, Math.min(100, 100 - stockBarW))
    return { mode: 'bar', stockPct, fundPct, stockBarW, fundBarW }
  })()
  const [nowTsForExpiry] = useState(() => Date.now())
  const calcDaysLeftFromIso = (value) => {
    const iso = toIsoDate(value || '')
    if (!iso) return null
    const target = new Date(`${iso}T00:00:00Z`).getTime()
    if (!Number.isFinite(target)) return null
    return Math.ceil((target - nowTsForExpiry) / (1000 * 60 * 60 * 24))
  }
  const expiringPointCount = (Array.isArray(pointAccounts) ? pointAccounts : [])
    .filter((row) => {
      const d = calcDaysLeftFromIso(row?.expiry)
      return d != null && d >= 0 && d <= POINT_EXPIRY_ALERT_DAYS
    }).length
  const expiringInsuranceCount = (Array.isArray(insurances) ? insurances : [])
    .filter((row) => {
      const d = calcDaysLeftFromIso(row?.maturity_date)
      return d != null && d >= 0 && d <= POINT_EXPIRY_ALERT_DAYS
    }).length
  const latestTradeDate = (() => {
    const dates = [
      ...groupedOwnedStocks.map((row) => toIsoDate(row.tradeDate || '')),
      ...groupedOwnedFunds.map((row) => toIsoDate(row.tradeDate || '')),
    ].filter(Boolean).sort()
    const iso = dates[dates.length - 1]
    return iso ? formatDateJpSlash(iso) : '--'
  })()
  /** 売却記録の取得原価は含めない（一覧の投資元本合計と揃える） */
  const reportInvestYen = isStockTab
    ? (stockReportHasData ? stockTotalInvestedJpy : null)
    : isFundTab
      ? (fundReportHasData ? fundTotalInvestedJpy : null)
      : wealthReportHasData
        ? totalInvested
        : null
  const reportHoldingsValueYen = isStockTab
    ? (stockReportHasData ? stockTotalCurrentJpy : null)
    : isFundTab
      ? (fundReportHasData ? fundTotalCurrentJpy : null)
      : wealthReportHasData
        ? stockTotalCurrentJpy + fundTotalCurrentJpy
        : null
  const reportPnlYen = isStockTab
    ? (stockReportHasData ? stockPnlWithRealizedJpy : null)
    : isFundTab
      ? (fundReportHasData ? fundPnlWithRealizedJpy : null)
      : wealthReportHasData
        ? accountPnlWithRealizedJpy
        : null
  const reportRatePct = isStockTab
    ? (stockReportHasData ? stockReturnWithRealizedPct : null)
    : isFundTab
      ? (fundReportHasData ? fundReturnWithRealizedPct : null)
      : wealthReportHasData
        ? accountReturnWithRealizedPct
        : null

  const stockDiagnosisHoldings = groupedOwnedStocks
    .map((stock) => {
      const currency = inferStockCurrency(stock.symbol)
      const category = currency === 'JPY' ? '国内株式' : '海外株式'
      const flag = currency === 'JPY' ? '🇯🇵' : currency === 'USD' ? '🇺🇸' : currency === 'GBP' ? '🇬🇧' : '🇪🇺'
      const resolvedName = (() => {
        const rawName = String(stock?.name || '').trim()
        if (rawName && rawName !== stock.symbol) return rawName
        return getStockNameFallback(stock.symbol) || stock.symbol
      })()
      return {
        ticker: stock.symbol,
        name: resolvedName,
        flag,
        sector: sectorForOwnedStockPie(stock),
        category,
        value: Number(stock.currentValueJpy || 0),
      }
    })
    .filter((row) => row.value > 0)
  const fundDiagnosisHoldings = effectiveFundRows
    .map((fund) => {
      const country = inferFundCountryLabel(fund.symbol || fund.id, fund.name)
      const flag = country === '日本' ? '🇯🇵' : country === '米国' ? '🇺🇸' : country === '英国' ? '🇬🇧' : country === '欧州' ? '🇪🇺' : '🌍'
      return {
        ticker: fund.symbol || fund.id,
        name: fund.name || fund.symbol || fund.id,
        flag,
        sector: country,
        category: 'ファンド',
        value: fundPieValueJpy(fund),
      }
    })
    .filter((row) => row.value > 0)
  const diagnosisScopeLabel = isStockTab ? '株式' : isFundTab ? 'ファンド' : '資産運用'
  const diagnosisHoldings = isStockTab
    ? stockDiagnosisHoldings
    : isFundTab
      ? fundDiagnosisHoldings
      : [...stockDiagnosisHoldings, ...fundDiagnosisHoldings]
  const showFreeHoldingsBanner = ENFORCE_FREE_OWNED_DISTINCT_SYMBOL_CAPS && !isPaidMember && (isStockTab || isFundTab || tabMode === 'wealth')
  return (
    <div className="space-y-6">
      {avgDownModalOpen && avgDownSelectedStock ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55"
            onClick={() => setAvgDownModalOpen(false)}
            aria-label="close averaging down modal"
          />
          <div className="relative z-[121] w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">平均取得単価計算</p>
                <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  {avgDownSelectedStock.name}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  現在平均 {formatStockNativePrice(avgDownSelectedStock.avgBuyPrice, avgDownSelectedStock.currency || inferStockCurrency(avgDownSelectedStock.symbol))} / 現在価格 {formatStockNativePrice(avgDownSelectedStock.currentPrice, avgDownSelectedStock.currency || inferStockCurrency(avgDownSelectedStock.symbol))} / 保有 {Number(avgDownSelectedStock.currentQty || 0).toLocaleString('ja-JP')}株
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAvgDownModalOpen(false)}
                className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-bold text-slate-500"
              >
                閉じる
              </button>
            </div>
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAvgDownMode('target')}
                  className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                    avgDownMode === 'target'
                      ? 'border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-500 dark:bg-orange-950/30 dark:text-orange-300'
                      : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  目標平均で調整
                </button>
                <button
                  type="button"
                  onClick={() => setAvgDownMode('qty')}
                  className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                    avgDownMode === 'qty'
                      ? 'border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-500 dark:bg-orange-950/30 dark:text-orange-300'
                      : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  追加数量で調整
                </button>
              </div>
              {avgDownMode === 'target' ? (
                <>
                  <label className="mt-3 block text-xs font-bold text-slate-500 dark:text-slate-400">目標平均取得単価</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={avgDownTargetPriceInput}
                    onChange={(e) => setAvgDownTargetPriceInput(sanitizeDecimalInput(e.target.value))}
                    placeholder="例: 80000"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold"
                  />
                  {avgDownUiMeta?.targetEnabled ? (
                    <>
                      <input
                        type="range"
                        min={avgDownUiMeta.targetMin}
                        max={avgDownUiMeta.targetMax}
                        step={String(avgDownUiMeta.targetStep || 0.01)}
                        value={avgDownUiMeta.targetValue}
                        onChange={(e) => setAvgDownTargetPriceInput(String(e.target.value))}
                        className="mm-touch-slider mt-2"
                      />
                      <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span>{avgDownUiMeta.targetMin.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}</span>
                        <span>目標: {avgDownUiMeta.targetValue.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}</span>
                        <span>{avgDownUiMeta.targetMax.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">この銘柄は現在価格が平均取得に近く、目標平均スライダーを表示できません。</p>
                  )}
                </>
              ) : (
                <>
                  <label className="mt-3 block text-xs font-bold text-slate-500 dark:text-slate-400">追加買い数量（株）</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={avgDownAddQtyInput}
                    onChange={(e) => setAvgDownAddQtyInput(sanitizeIntegerInput(e.target.value))}
                    placeholder="例: 50"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold"
                  />
                  <input
                    type="range"
                    min="1"
                    max={String(avgDownUiMeta?.qtyMax || 100)}
                    step="1"
                    value={String(avgDownUiMeta?.qtyValue || 1)}
                    onChange={(e) => setAvgDownAddQtyInput(String(e.target.value))}
                    className="mm-touch-slider mt-2"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <span>1株</span>
                    <span>現在: {Number(avgDownUiMeta?.qtyValue || 0).toLocaleString('ja-JP')}株</span>
                    <span>{Number(avgDownUiMeta?.qtyMax || 100).toLocaleString('ja-JP')}株</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[10, 25, 50, 100].map((qtyPreset) => (
                      <button
                        key={`avg-down-qty-preset-${qtyPreset}`}
                        type="button"
                        onClick={() => setAvgDownAddQtyInput(String(Math.min(Number(avgDownUiMeta?.qtyMax || 100), qtyPreset)))}
                        className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {qtyPreset}株
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
              {avgDownPreview?.ok ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    現在価格で <span className="text-orange-600 dark:text-orange-300">{Number(avgDownPreview.addQty || 0).toLocaleString('ja-JP')}株</span> の追加買いが必要です
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    追加買い想定金額: {formatStockNativeMoney(avgDownPreview.buyAmount, avgDownSelectedStock.currency || inferStockCurrency(avgDownSelectedStock.symbol))}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    目標平均取得単価: {formatStockNativePrice(avgDownPreview.targetAvgPrice, avgDownSelectedStock.currency || inferStockCurrency(avgDownSelectedStock.symbol))}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    反映後の想定平均: {formatStockNativePrice(avgDownPreview.nextAvgPrice, avgDownSelectedStock.currency || inferStockCurrency(avgDownSelectedStock.symbol))}
                  </p>
                  {avgDownPreview.highAddQty ? (
                    <p className="text-[10px] text-amber-800 dark:text-amber-200/95 leading-relaxed">
                      ※ 目標を現在価格に近づけると、必要株数が急増します（式上の結果です）。現実的な目標にスライダーを動かして確認してください。
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs font-bold text-rose-600 dark:text-rose-300">
                  {avgDownPreview?.reason || '目標平均取得単価を入力してください。'}
                </p>
              )}
            </div>
            <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
              ※ 参考用の計算であり、投資勧誘ではありません。
            </p>
          </div>
        </div>
      ) : null}
      {stockSellModalOpen && stockSellContext ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55"
            onClick={() => { if (!stockSellBusy) setStockSellModalOpen(false) }}
            aria-label="close stock sell modal"
          />
          <div className="relative z-[121] w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">売却を記録（実現損益・FIFO）</p>
                <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  {stockSellContext.name} ({stockSellContext.symbol})
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  保有数量 {stockSellContext.maxQty.toLocaleString('ja-JP')} まで。売却に応じた取得原価は買付日が古いロットから自動で充当されます。
                </p>
              </div>
              <button
                type="button"
                disabled={stockSellBusy}
                onClick={() => setStockSellModalOpen(false)}
                className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-bold text-slate-500 disabled:opacity-50"
              >
                閉じる
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">売却日</span>
                <OwnedBuyDateTextInput
                  value={stockSellDateInput}
                  onCommit={(iso) => setStockSellDateInput(iso)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold tabular-nums"
                />
                {inferStockCurrency(stockSellContext?.symbol) === 'USD' ? (
                  <p className="mt-1.5 text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
                    {stockSellFxPreview?.status === 'ready'
                      ? formatAppliedUsdJpy(stockSellFxPreview.rate, stockSellFxPreview.asOf)
                      : stockSellFxPreview?.status === 'missing'
                        ? '売却日の為替を取得できません'
                        : '適用レートを確認しています…'}
                  </p>
                ) : null}
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">売却数量</span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={stockSellQtyInput}
                    onChange={(e) => setStockSellQtyInput(sanitizeDecimalManyInput(e.target.value, 6))}
                    placeholder={`最大 ${stockSellContext.maxQty.toLocaleString('ja-JP')}`}
                    className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-right tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={stockSellBusy || !stockSellContext.maxQty}
                    onClick={() => setStockSellQtyInput(formatMaxSellUnitsInput(stockSellContext.maxQty))}
                    className="shrink-0 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-[11px] font-black text-slate-800 dark:text-slate-100 disabled:opacity-45"
                  >
                    全数量
                  </button>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">売却単価（株式の建て貨幣）</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={stockSellPriceInput}
                  onChange={(e) => setStockSellPriceInput(sanitizeDecimalInput(e.target.value))}
                  placeholder={stockSellContext.hintPrice > 0 ? String(stockSellContext.hintPrice) : '例: 328.15'}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-right tabular-nums"
                />
              </div>
              <button
                type="button"
                disabled={
                  stockSellBusy
                  || !stockSellContext.maxQty
                  || !onRecordStockSale
                }
                onClick={async () => {
                  if (!onRecordStockSale) return
                  setStockSellBusy(true)
                  try {
                    await onRecordStockSale({
                      symbol: stockSellContext.symbol,
                      sellDate: stockSellDateInput,
                      sellQty: stockSellQtyInput,
                      sellPrice: stockSellPriceInput,
                    })
                    setStockSellModalOpen(false)
                    setStockSellContext(null)
                  } finally {
                    setStockSellBusy(false)
                  }
                }}
                className="mt-2 w-full min-h-[48px] rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-sm font-black hover:opacity-90 disabled:opacity-50"
              >
                {stockSellBusy ? '保存中…' : '記録する（ロットを FIFO で減算）'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {fundSellModalOpen && fundSellContext ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55"
            onClick={() => { if (!fundSellBusy) setFundSellModalOpen(false) }}
            aria-label="close fund sell modal"
          />
          <div className="relative z-[121] w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">ファンド売却を記録（実現損益・FIFO）</p>
                <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  {fundSellContext.name} ({fundSellContext.symbol})
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  売却口数は最大 {fundSellContext.maxUnits.toLocaleString('ja-JP', { maximumFractionDigits: 6 })} まで。取得原価は買付日が古いロットから自動で充当されます。
                </p>
              </div>
              <button
                type="button"
                disabled={fundSellBusy}
                onClick={() => setFundSellModalOpen(false)}
                className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-bold text-slate-500 disabled:opacity-50"
              >
                閉じる
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">売却日</span>
                <OwnedBuyDateTextInput
                  value={fundSellDateInput}
                  onCommit={(iso) => setFundSellDateInput(iso)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold tabular-nums"
                />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">売却口数</span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fundSellUnitsInput}
                    onChange={(e) => setFundSellUnitsInput(sanitizeDecimalManyInput(e.target.value, 16))}
                    placeholder={`最大 ${formatMaxSellUnitsInput(fundSellContext.maxUnits) || fundSellContext.maxUnits.toLocaleString('ja-JP', { maximumFractionDigits: 10 })}`}
                    className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-right tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={fundSellBusy || !fundSellContext.maxUnits}
                    onClick={() => setFundSellUnitsInput(formatMaxSellUnitsInput(fundSellContext.maxUnits))}
                    className="shrink-0 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-[11px] font-black text-slate-800 dark:text-slate-100 disabled:opacity-45"
                  >
                    全口数
                  </button>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">売却単価（基準価額・建て貨幣）</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={fundSellPriceInput}
                  onChange={(e) => setFundSellPriceInput(sanitizeDecimalInput(e.target.value))}
                  placeholder={fundSellContext.hintPrice > 0 ? String(fundSellContext.hintPrice) : '例: 300000'}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-right tabular-nums"
                />
              </div>
              <button
                type="button"
                disabled={
                  fundSellBusy
                  || !fundSellContext.maxUnits
                  || !onRecordFundSale
                }
                onClick={async () => {
                  if (!onRecordFundSale) return
                  setFundSellBusy(true)
                  try {
                    await onRecordFundSale({
                      symbol: fundSellContext.symbol,
                      sellDate: fundSellDateInput,
                      sellUnits: fundSellUnitsInput,
                      sellPrice: fundSellPriceInput,
                    })
                    setFundSellModalOpen(false)
                    setFundSellContext(null)
                  } finally {
                    setFundSellBusy(false)
                  }
                }}
                className="mt-2 w-full min-h-[48px] rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-sm font-black hover:opacity-90 disabled:opacity-50"
              >
                {fundSellBusy ? '保存中…' : '記録する（口数を FIFO で減算）'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showFreeHoldingsBanner ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/25 px-4 py-3 text-xs text-amber-950 dark:text-amber-100">
          <p className="font-black">保有の登録上限（参考）</p>
          <p className="mt-1 font-semibold leading-relaxed text-amber-900/95 dark:text-amber-200/95">
            株式
            <strong className="mx-0.5">{groupedOwnedStocks.length}/{FREE_OWNED_DISTINCT_STOCK_SYMBOLS}</strong>
            銘柄・ファンド
            <strong className="mx-0.5">{groupedOwnedFunds.length}/{FREE_OWNED_DISTINCT_FUND_SYMBOLS}</strong>
            銘柄まで（同一銘柄の追加入力は可能）。上限に達した場合は一部銘柄を整理してから追加してください。
          </p>
        </div>
      ) : null}
      {tabMode === 'wealth' ? <WealthAccumulationSimCard /> : null}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {(isStockTab && !stockReportHasData) ? (
          <div className="xl:col-span-12 rounded-2xl border border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/25 px-6 py-10 text-center shadow-sm">
            <p className="text-lg font-black text-slate-900 dark:text-white">まだ株式の保有が登録されていません</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto">
              下の「株式パフォーマンス」から銘柄・数量・買付情報を追加すると、評価損益やセクター配分が表示されます（実現損益のみの場合はこのカードは表示されません）。
            </p>
            <button
              type="button"
              onClick={() => document.getElementById('mypage-stock-holdings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-orange-500 text-white text-sm font-black px-6 py-3 hover:opacity-90 shadow-md"
            >
              保有株式を追加する（入力へスクロール）
            </button>
          </div>
        ) : (isFundTab && !fundReportHasData) ? (
          <div className="xl:col-span-12 rounded-2xl border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/25 px-6 py-10 text-center shadow-sm">
            <p className="text-lg font-black text-slate-900 dark:text-white">まだファンドの保有が登録されていません</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto">
              「ファンドパフォーマンス」から銘柄と取得情報を追加すると、レポートや配分チャートが表示されます。
            </p>
            <button
              type="button"
              onClick={() => document.getElementById('mypage-owned-fund-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-sm font-black px-6 py-3 hover:opacity-90 shadow-md"
            >
              保有ファンドを追加する（入力へスクロール）
            </button>
          </div>
        ) : (isWealthTab && !wealthReportHasData) ? (
          <div className="xl:col-span-12 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 px-6 py-10 text-center shadow-sm">
            <p className="text-lg font-black text-slate-900 dark:text-white">まだ保有資産がありません</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto">
              株式またはファンドタブで保有を登録すると、総合レポートと資産推移が表示されます。
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
              <button
                type="button"
                onClick={() => typeof onSwitchPortfolioTab === 'function' && onSwitchPortfolioTab('stock')}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-700 dark:bg-emerald-600 text-white text-sm font-black px-6 py-3 hover:opacity-90 shadow-md"
              >
                株式タブで追加
              </button>
              <button
                type="button"
                onClick={() => typeof onSwitchPortfolioTab === 'function' && onSwitchPortfolioTab('fund')}
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 dark:bg-blue-600 text-white text-sm font-black px-6 py-3 hover:opacity-90 shadow-md"
              >
                ファンドタブで追加
              </button>
            </div>
          </div>
        ) : (
          <>
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-500" /> {isStockTab ? '株式レポート' : isFundTab ? 'ファンドレポート' : '総合レポート'}
              </h3>
              {(isStockTab || isWealthTab || isFundTab) ? (
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                  <span className="whitespace-nowrap">実現の期間</span>
                  <select
                    value={stockRealizedWindow}
                    onChange={(e) => setStockRealizedWindow(e.target.value)}
                    className="max-w-[11rem] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-black text-slate-800 dark:text-slate-100"
                  >
                    <option value="all">全期間</option>
                    {REALIZED_PNL_SELECT_CALENDAR_YEARS.map((y) => (
                      <option key={y} value={`cy${y}`}>{y}年（1〜12月）</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            {isStockTab && stockRealizedWindow !== 'all' ? (
              <p className="mt-2 text-[10px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                上行の「損益」「損益率」は全期間の実現を含みます。下段の「実現」は{stockRealizedWindowLabelJaCompact}の売却分のみです。
              </p>
            ) : null}
            {isWealthTab && stockRealizedWindow !== 'all' ? (
              <p className="mt-2 text-[10px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                上行の「損益」「損益率」は、保有の含み損益に株式・ファンドの全期間実現損益を加えたポートフォリオ合算です。下段の「実現」は売却記録ベース（{stockRealizedWindowLabelJaCompact}・株式+ファンド）です。
              </p>
            ) : null}
            {isFundTab && stockRealizedWindow !== 'all' ? (
              <p className="mt-2 text-[10px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                上行の「損益」「損益率」は全期間の実現を含みます。下段の「実現」は{stockRealizedWindowLabelJaCompact}の売却分のみです。
              </p>
            ) : null}
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600 rounded-xl p-4 flex flex-col justify-between min-h-[132px]">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">保有取得原価</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{reportInvestYen == null ? '--' : `¥${Math.round(reportInvestYen).toLocaleString('ja-JP')}`}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                <p className="text-xs font-bold text-slate-500 mb-1">現在評価額（保有）</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{portfolioNumbersHydratingMask ? (
                  <span className="inline-flex items-center gap-2 text-slate-400 dark:text-slate-500 tabular-nums">
                    <Loader2 className="animate-spin shrink-0 text-orange-500" size={22} aria-hidden />
                    …
                  </span>
                ) : reportHoldingsValueYen == null ? '--' : `¥${Math.round(reportHoldingsValueYen).toLocaleString('ja-JP')}`}</p>
              </div>
            </div>
            <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600 rounded-xl p-4 flex flex-col justify-between min-h-[132px]">
              {isStockTab ? (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">損益</p>
                    <p className={`text-2xl font-black tabular-nums ${reportPnlYen == null ? 'text-slate-400' : reportPnlYen >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {reportPnlYen == null ? '--' : `${reportPnlYen >= 0 ? '+' : ''}¥${Math.round(reportPnlYen).toLocaleString('ja-JP')}`}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-1.5">
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">含み</span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !stockReportHasData
                            ? 'text-slate-400'
                            : aggStockPnLJpy >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {stockReportHasData ? `${aggStockPnLJpy >= 0 ? '+' : ''}¥${Math.round(aggStockPnLJpy).toLocaleString('ja-JP')}` : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        実現{stockRealizedWindow !== 'all' ? `（${stockRealizedWindowLabelJaCompact}）` : ''}
                      </span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !stockReportHasData
                            ? 'text-slate-400'
                            : stockRealizedPnlSumWindow >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {stockReportHasData ? `${stockRealizedPnlSumWindow >= 0 ? '+' : ''}¥${Math.round(stockRealizedPnlSumWindow).toLocaleString('ja-JP')}` : '--'}
                      </span>
                    </div>
                  </div>
                </>
              ) : isFundTab ? (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">損益</p>
                    <p className={`text-2xl font-black tabular-nums ${reportPnlYen == null ? 'text-slate-400' : reportPnlYen >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {reportPnlYen == null ? '--' : `${reportPnlYen >= 0 ? '+' : ''}¥${Math.round(reportPnlYen).toLocaleString('ja-JP')}`}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-1.5">
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">含み</span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !fundReportHasData
                            ? 'text-slate-400'
                            : aggFundPnLJpy >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {fundReportHasData ? `${aggFundPnLJpy >= 0 ? '+' : ''}¥${Math.round(aggFundPnLJpy).toLocaleString('ja-JP')}` : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        実現{stockRealizedWindow !== 'all' ? `（${stockRealizedWindowLabelJaCompact}）` : ''}
                      </span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !fundReportHasData
                            ? 'text-slate-400'
                            : fundRealizedPnlSumWindow >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {fundReportHasData ? `${fundRealizedPnlSumWindow >= 0 ? '+' : ''}¥${Math.round(fundRealizedPnlSumWindow).toLocaleString('ja-JP')}` : '--'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">損益</p>
                    <p className={`text-2xl font-black tabular-nums ${reportPnlYen == null ? 'text-slate-400' : reportPnlYen >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {reportPnlYen == null ? '--' : `${reportPnlYen >= 0 ? '+' : ''}¥${Math.round(reportPnlYen).toLocaleString('ja-JP')}`}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-1.5">
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">含み</span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !wealthReportHasData
                            ? 'text-slate-400'
                            : totalPnL >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {wealthReportHasData ? `${totalPnL >= 0 ? '+' : ''}¥${Math.round(totalPnL).toLocaleString('ja-JP')}` : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        実現{stockRealizedWindow !== 'all' ? `（${stockRealizedWindowLabelJaCompact}）` : ''}
                      </span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !(Array.isArray(realizedStockTrades) && realizedStockTrades.length > 0)
                          && !(Array.isArray(realizedFundTrades) && realizedFundTrades.length > 0)
                            ? 'text-slate-400'
                            : wealthRealizedPnlSumWindow >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {(Array.isArray(realizedStockTrades) && realizedStockTrades.length > 0)
                        || (Array.isArray(realizedFundTrades) && realizedFundTrades.length > 0)
                          ? `${wealthRealizedPnlSumWindow >= 0 ? '+' : ''}¥${Math.round(wealthRealizedPnlSumWindow).toLocaleString('ja-JP')}`
                          : '--'}
                      </span>
                    </div>
                  </div>
                </>
              )}
              {portfolioNumbersHydratingMask ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/75 dark:bg-slate-950/55 backdrop-blur-[1px]"
                  aria-busy="true"
                >
                  <Loader2 className="animate-spin text-orange-500" size={24} aria-hidden />
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 px-2 text-center leading-tight">評価を同期中…</span>
                </div>
              ) : null}
            </div>
            <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600 rounded-xl p-4 flex flex-col justify-between min-h-[132px]">
              {isStockTab ? (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">損益率</p>
                    <p className={`text-2xl font-black tabular-nums ${reportRatePct == null ? 'text-slate-400' : reportRatePct >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {reportRatePct == null ? '--' : `${reportRatePct >= 0 ? '+' : ''}${reportRatePct.toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-1.5">
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">含み</span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !stockReportHasData || aggStockReturnPct == null
                            ? 'text-slate-400'
                            : aggStockReturnPct >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {stockReportHasData && aggStockReturnPct != null
                          ? `${aggStockReturnPct >= 0 ? '+' : ''}${aggStockReturnPct.toFixed(1)}%`
                          : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        実現{stockRealizedWindow !== 'all' ? `（${stockRealizedWindowLabelJaCompact}）` : ''}
                      </span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !stockReportHasData || stockRealizedReturnPctWindow == null
                            ? 'text-slate-400'
                            : stockRealizedReturnPctWindow >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {stockReportHasData && stockRealizedReturnPctWindow != null
                          ? `${stockRealizedReturnPctWindow >= 0 ? '+' : ''}${stockRealizedReturnPctWindow.toFixed(1)}%`
                          : '--'}
                      </span>
                    </div>
                  </div>
                </>
              ) : isFundTab ? (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">損益率</p>
                    <p className={`text-2xl font-black tabular-nums ${reportRatePct == null ? 'text-slate-400' : reportRatePct >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {reportRatePct == null ? '--' : `${reportRatePct >= 0 ? '+' : ''}${reportRatePct.toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-1.5">
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">含み</span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !fundReportHasData || aggFundReturnPct == null
                            ? 'text-slate-400'
                            : aggFundReturnPct >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {fundReportHasData && aggFundReturnPct != null
                          ? `${aggFundReturnPct >= 0 ? '+' : ''}${aggFundReturnPct.toFixed(1)}%`
                          : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        実現{stockRealizedWindow !== 'all' ? `（${stockRealizedWindowLabelJaCompact}）` : ''}
                      </span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !fundReportHasData || fundRealizedReturnPctWindow == null
                            ? 'text-slate-400'
                            : fundRealizedReturnPctWindow >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {fundReportHasData && fundRealizedReturnPctWindow != null
                          ? `${fundRealizedReturnPctWindow >= 0 ? '+' : ''}${fundRealizedReturnPctWindow.toFixed(1)}%`
                          : '--'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-1">損益率</p>
                    <p className={`text-2xl font-black tabular-nums ${reportRatePct == null ? 'text-slate-400' : reportRatePct >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {reportRatePct == null ? '--' : `${reportRatePct >= 0 ? '+' : ''}${reportRatePct.toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-1.5">
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">含み</span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          !wealthReportHasData || totalInvested <= 0
                            ? 'text-slate-400'
                            : totalReturnRate >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {wealthReportHasData && totalInvested > 0
                          ? `${totalReturnRate >= 0 ? '+' : ''}${totalReturnRate.toFixed(1)}%`
                          : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2 text-[11px] sm:text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        実現{stockRealizedWindow !== 'all' ? `（${stockRealizedWindowLabelJaCompact}）` : ''}
                      </span>
                      <span
                        className={`font-black tabular-nums text-right ${
                          (!(Array.isArray(realizedStockTrades) && realizedStockTrades.length > 0)
                          && !(Array.isArray(realizedFundTrades) && realizedFundTrades.length > 0))
                          || wealthRealizedReturnPctWindow == null
                            ? 'text-slate-400'
                            : wealthRealizedReturnPctWindow >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {(Array.isArray(realizedStockTrades) && realizedStockTrades.length > 0
                        || (Array.isArray(realizedFundTrades) && realizedFundTrades.length > 0))
                        && wealthRealizedReturnPctWindow != null
                          ? `${wealthRealizedReturnPctWindow >= 0 ? '+' : ''}${wealthRealizedReturnPctWindow.toFixed(1)}%`
                          : '--'}
                      </span>
                    </div>
                  </div>
                </>
              )}
              {portfolioNumbersHydratingMask ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/75 dark:bg-slate-950/55 backdrop-blur-[1px]"
                  aria-busy="true"
                >
                  <Loader2 className="animate-spin text-orange-500" size={24} aria-hidden />
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 px-2 text-center leading-tight">評価を同期中…</span>
                </div>
              ) : null}
            </div>
            </div>
          </div>
        </div>
        <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5">
          <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-indigo-500" /> {isStockTab ? '株式レポート' : isFundTab ? 'ファンドレポート' : '資産運用サマリー'}
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">{isStockTab ? '保有株式数' : isFundTab ? '保有ファンド数' : '保有資産数'}</span>
              <span className="font-black text-slate-900 dark:text-white">{isStockTab ? groupedOwnedStocks.length : isFundTab ? groupedOwnedFunds.length : groupedOwnedStocks.length + effectiveFundRows.length}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{isStockTab ? 'セクター数' : isFundTab ? 'ウォッチリスト' : '株式/ファンド比率'}</span>
              <span className="font-black text-slate-900 dark:text-white">
                {(portfolioNumbersHydratingMask && isWealthTab) ? (
                  <span className="inline-flex items-center gap-1.5 text-slate-400 tabular-nums">
                    <Loader2 className="animate-spin shrink-0 text-orange-500" size={16} aria-hidden />
                    …
                  </span>
                ) : isStockTab ? stockSectorData.length : isFundTab ? fundWatchlist.length : `${Math.round((stockTotalCurrentJpy / Math.max(1, totalCurrentValue)) * 100)}% / ${Math.round((fundTotalCurrentJpy / Math.max(1, totalCurrentValue)) * 100)}%`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{isStockTab ? '株式評価額(円換算)' : isFundTab ? 'ファンド評価額(円換算)' : '合算評価額(円換算)'}</span>
              {portfolioNumbersHydratingMask ? (
                <span className="inline-flex items-center gap-1.5 text-slate-400 tabular-nums font-black">
                  <Loader2 className="animate-spin shrink-0 text-orange-500" size={16} aria-hidden />
                  …
                </span>
              ) : isStockTab ? (
                <span className="font-black text-slate-900 dark:text-white">¥{Math.round(stockTotalCurrentJpy).toLocaleString('ja-JP')}</span>
              ) : isFundTab ? (
                <span className="font-black text-slate-900 dark:text-white">¥{Math.round(fundTotalCurrentJpy).toLocaleString('ja-JP')}</span>
              ) : (
                <span className="font-black text-slate-900 dark:text-white">¥{Math.round(totalCurrentValue).toLocaleString('ja-JP')}</span>
              )}
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {isPaidMember ? (
        <Suspense
          fallback={(
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-6 animate-pulse min-h-[140px]" aria-hidden />
          )}
        >
          <div id="mypage-asset-diagnosis">
            <PortfolioDiagnosisPanel
              scopeLabel={diagnosisScopeLabel}
              holdings={diagnosisHoldings}
              userId={userId}
            />
          </div>
        </Suspense>
      ) : (
        <div id="mypage-asset-diagnosis">
        <button
          type="button"
          onClick={() => {
            if (typeof onUiMessage === 'function') onUiMessage('資産AIレポートはプレミアム限定です。', 'premium')
            navigate('/premium')
          }}
          className="w-full rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900 p-5 text-left shadow-sm hover:border-indigo-300"
        >
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
            <Sparkles size={16} />
            <p className="text-xs font-black tracking-wide uppercase">AI ASSET REPORT (PREMIUM)</p>
          </div>
          <p className="mt-2 text-base font-black text-slate-900 dark:text-white">資産AIレポートはプレミアム限定でご利用いただけます。</p>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">保有データから確認ポイントを自動抽出します（投資助言ではありません）。</p>
          <p className="mt-3 inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-3 py-1 text-xs font-black text-indigo-700 dark:text-indigo-200">クリックしてプレミアムで確認</p>
        </button>
        </div>
      )}

      {isStockTab && Boolean(globalThis?.__MM_DEV__) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">株式ウォッチリスト</h3>
          </div>
          <div className="p-5">
            {stockWatchlistItems.length === 0 ? (
              <div className="text-base text-slate-500 dark:text-slate-400 space-y-3">
                <p>株式ウォッチリストがありません。</p>
                <button
                  type="button"
                  onClick={() => navigate('/stocks')}
                  className="inline-flex rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-sm font-black text-orange-700 dark:text-orange-300"
                >
                  株式ページで追加
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stockWatchlistItems.map((stock) => (
                  <div key={`stock-watch-${stock.id}`} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-slate-900 dark:text-white">{stock.name || stock.code}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{stock.code}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {Number(stock.price || 0) > 0 ? `¥${Math.round(Number(stock.price || 0)).toLocaleString('ja-JP')}` : '--'}
                          </span>
                          <span className={`font-black tabular-nums ${Number(stock.rate || 0) >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {Number.isFinite(Number(stock.rate)) ? `${Number(stock.rate || 0) >= 0 ? '+' : ''}${Number(stock.rate || 0).toFixed(2)}%` : '--'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{stock.tradeDate ? formatDateJpSlash(stock.tradeDate) : ''}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/stocks?symbol=${encodeURIComponent(String(stock.id || ''))}`)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-orange-400"
                        >
                          株式ページ
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveStockWatchlist?.(stock.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isFundTab && fundHasInputs && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
              <h3 className="font-black text-slate-900 dark:text-white">ファンド 国別配分 (円換算)</h3>
            </div>
            <div className="p-5">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={fundCountryData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={84}
                      innerRadius={48}
                      paddingAngle={2}
                      minAngle={MY_PAGE_PIE_MIN_ANGLE}
                    >
                      {fundCountryData.map((entry) => (
                        <Cell key={`fund-split-top-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `¥${Number(value).toLocaleString('ja-JP')}`} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {fundCountryData.map((row) => {
                  const base = Math.max(1, fundTotalPieJpy)
                  const weight = (Number(row.value || 0) / base) * 100
                  return (
                    <div key={`fund-split-top-legend-${row.name}`} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color || '#94a3b8' }} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{row.name}</span>
                      </div>
                      <span className="font-black text-slate-900 dark:text-white">{weight.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="xl:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart size={18} className="text-indigo-500" /> ファンドパフォーマンス推移 ({wealthChartMonths}ヶ月)
              </h3>
              <select value={wealthChartMonths} onChange={(e) => setWealthChartMonths(Number(e.target.value))} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                <option value={6}>6ヶ月</option>
                <option value={12}>12ヶ月</option>
                <option value={24}>24ヶ月</option>
                <option value={36}>36ヶ月</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fundPerformanceBarRows} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-28} textAnchor="end" height={46} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      domain={getStockPerformanceYAxisDomain(fundPerformanceBarRows)}
                      tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                    />
                    <Tooltip content={StockPerformanceStackTooltip} wrapperStyle={{ outline: 'none' }} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar name="ベース" dataKey="basisJpy" stackId="fundperf" fill="#93c5fd" maxBarSize={44} />
                    <Bar name="含み益" dataKey="gainJpy" stackId="fundperf" fill="#2563eb" maxBarSize={44} radius={[5, 5, 0, 0]} />
                    <Bar name="含み損" dataKey="lossJpy" stackId="fundperf" fill="#60a5fa" maxBarSize={44} radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-[10px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400 px-0.5">
                <p>
                  <span className="font-black text-slate-600 dark:text-slate-300">読み方：</span>
                  各柱は、その日時点の<span className="font-black">保有ロット</span>について、終値（取引無い日は直近終値）で円換算した<span className="font-black">評価額</span>と<span className="font-black">取得原価</span>（投資元本ベース）を積み上げたものです。最後の柱は画面と同じ最新のファンド評価です。
                </p>
                <p>
                  <span className="font-black text-slate-600 dark:text-slate-300">ベース／含み益・損：</span>
                  評価が原価以上のとき → 灰＝<span className="font-black">取得原価</span>、その上の青＝<span className="font-black">含み益</span>（柱の合計高さ＝評価額）。評価が原価を下回るとき → 灰＝<span className="font-black">評価額</span>、その上の薄青＝<span className="font-black">含み損</span>の分（合計高さ＝原価）。「ベース」が常に原価だけではありません。
                </p>
                <p>
                  売却記録の<span className="font-black">実現損益</span>はこのグラフには入りません（上部レポートの「実現」）。売却でロットが減ると、以降の柱は評価・原価ともに下がって見えます。売却した分は、買付日から売却日の前日まで推移に含めます。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFundTab && !fundHasInputs && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            保有ファンドが未登録のため、国別配分・6ヶ月推移は表示されません。
          </p>
        </div>
      )}

      {isFundTab && (
        <div className="space-y-4">
          <div id="mypage-owned-fund-section" className="scroll-mt-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <h3 id="fund-performance-heading" className="font-black text-slate-900 dark:text-white shrink-0">ファンドパフォーマンス</h3>
                <button
                  type="button"
                  onClick={() => setFundTabHelpOpen(true)}
                  className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-300 dark:hover:border-orange-500 transition-colors"
                  aria-label="保有ファンドの入力方法を表示"
                  aria-describedby="fund-performance-heading"
                  title="入力のしかた"
                >
                  <HelpCircle className="w-5 h-5" aria-hidden />
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">実際に買ったファンドを追加して、取引別・合算損益率を管理できます。</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[2.1fr_1fr_1fr_1fr_auto] gap-3 md:gap-2 xl:items-end">
                {(() => {
                  const submitOwnedFund = async () => {
                    const ok = await onAddOwnedFund?.({
                      symbol: newOwnedFundSymbol,
                      investAmount: newOwnedFundInvestAmount,
                      buyDate: newOwnedFundBuyDate,
                      buyPrice: newOwnedFundBuyPrice,
                    })
                    if (ok) {
                      setNewOwnedFundSymbol('')
                      setNewOwnedFundInvestAmount('')
                      setNewOwnedFundBuyDate('')
                      setNewOwnedFundBuyPrice('')
                      setOwnedFundSymbolOptions([])
                    setFundSuggestOpen(false)
                    setFundSuggestIndex(-1)
                    }
                  }
                  const onFundInputKeyDown = async (e) => {
                    if (e.key === 'ArrowDown') {
                      if (ownedFundSymbolOptions.length === 0) return
                      e.preventDefault()
                      setFundSuggestOpen(true)
                      setFundSuggestIndex((prev) => {
                        const next = prev + 1
                        return next >= ownedFundSymbolOptions.length ? 0 : next
                      })
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      if (ownedFundSymbolOptions.length === 0) return
                      e.preventDefault()
                      setFundSuggestOpen(true)
                      setFundSuggestIndex((prev) => {
                        if (prev <= 0) return ownedFundSymbolOptions.length - 1
                        return prev - 1
                      })
                      return
                    }
                    if (e.key === 'Escape') {
                      setFundSuggestOpen(false)
                      setFundSuggestIndex(-1)
                      return
                    }
                    if (e.key !== 'Enter') return
                    if (fundSuggestOpen && fundSuggestIndex >= 0 && fundSuggestIndex < ownedFundSymbolOptions.length) {
                      e.preventDefault()
                      const picked = ownedFundSymbolOptions[fundSuggestIndex]
                      if (picked?.symbol) setNewOwnedFundSymbol(picked.symbol)
                      setFundSuggestOpen(false)
                      setFundSuggestIndex(-1)
                      return
                    }
                    e.preventDefault()
                    await submitOwnedFund()
                  }
                  return (
                    <>
                      <div className="relative md:col-span-2 xl:col-span-1">
                        <span className={ownedMobileFieldLabelClass}>ファンドコード / 名称</span>
                        <input
                          type="text"
                          value={newOwnedFundSymbol}
                          onChange={(e) => {
                            setNewOwnedFundSymbol(e.target.value)
                            setFundSuggestOpen(true)
                            setFundSuggestIndex(-1)
                          }}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setFundSuggestOpen(false)
                              setFundSuggestIndex(-1)
                            }, 120)
                          }}
                          onKeyDown={onFundInputKeyDown}
                          placeholder="ファンドコード/名称 (例: 2558.T, S&P500)"
                          className={ownedFieldInputClass}
                        />
                        {fundSuggestOpen && ownedFundSymbolOptions.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                            {ownedFundSymbolOptions.slice(0, 20).map((item, idx) => (
                              <button
                                key={`owned-fund-suggest-menu-${item.symbol}-${idx}`}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setNewOwnedFundSymbol(item.symbol)
                                  setFundSuggestOpen(false)
                                  setFundSuggestIndex(-1)
                                }}
                                className={`w-full text-left px-3 py-2 text-xs border-b last:border-b-0 border-slate-100 dark:border-slate-800 border-l-2 transition-colors ${
                                  fundSuggestIndex === idx
                                    ? 'bg-orange-100 dark:bg-orange-950/45 border-l-orange-500 font-semibold'
                                    : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/70'
                                }`}
                              >
                                <span className="font-black text-slate-800 dark:text-slate-100">{item.name || item.symbol}</span>
                                {String(item.name || '') !== String(item.symbol || '') ? (
                                  <span className="ml-1 text-slate-500 dark:text-slate-400">({item.symbol})</span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {ownedFundSymbolOptions.length > 0 && (
                        <div className="md:col-span-2 xl:col-span-5 -mt-1 flex flex-wrap gap-2 sm:gap-1.5 max-h-[7.5rem] overflow-y-auto">
                          {ownedFundSymbolOptions.slice(0, 8).map((item, chipIdx) => {
                            const symU = String(item.symbol || '').toUpperCase().trim()
                            const inputU = String(newOwnedFundSymbol || '').toUpperCase().trim()
                            const isChosen = symU.length > 0 && symU === inputU
                            const isKbHighlight = fundSuggestOpen && fundSuggestIndex === chipIdx
                            const chipActive = isChosen || isKbHighlight
                            return (
                            <button
                              key={`owned-fund-suggest-chip-${item.symbol}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setNewOwnedFundSymbol(item.symbol)
                                setFundSuggestOpen(false)
                                setFundSuggestIndex(-1)
                              }}
                              className={`min-h-[40px] sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1 rounded-full border text-xs sm:text-[11px] font-bold transition-colors ${
                                chipActive
                                  ? 'border-orange-500 bg-orange-100 dark:bg-orange-950/55 dark:border-orange-400 text-orange-950 dark:text-orange-100 shadow-sm ring-2 ring-orange-400/35 dark:ring-orange-500/25'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-600/60'
                              }`}
                            >
                              {String(item.name || '') !== String(item.symbol || '')
                                ? `${item.name} (${item.symbol})`
                                : (item.symbol || item.name)}
                            </button>
                            )
                          })}
                        </div>
                      )}
                      <div>
                        <span className={ownedMobileFieldLabelClass}>投資元本</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={newOwnedFundInvestAmount}
                          onChange={(e) => setNewOwnedFundInvestAmount(sanitizeDecimalInput(e.target.value))}
                          onKeyDown={onFundInputKeyDown}
                          placeholder="投資元本"
                          className={ownedFieldInputRightClass}
                        />
                      </div>
                      <div>
                        <span className={ownedMobileFieldLabelClass}>買付日</span>
                        <OwnedBuyDateTextInput
                          value={newOwnedFundBuyDate}
                          onCommit={(iso) => setNewOwnedFundBuyDate(iso)}
                          onKeyDown={onFundInputKeyDown}
                          className={`${ownedFieldInputClass} tabular-nums`}
                        />
                      </div>
                      <div>
                        <span className={ownedMobileFieldLabelClass}>買付価格 (基準価格)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={newOwnedFundBuyPrice}
                          onChange={(e) => setNewOwnedFundBuyPrice(sanitizeDecimalInput(e.target.value))}
                          onKeyDown={onFundInputKeyDown}
                          placeholder="買付価格"
                          className={ownedFieldInputRightClass}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={submitOwnedFund}
                        className="w-full md:col-span-2 xl:col-span-1 min-h-[48px] xl:min-h-0 px-4 py-3 xl:px-3 xl:py-2 rounded-xl xl:rounded-lg bg-slate-900 dark:bg-orange-500 text-white text-sm xl:text-xs font-black hover:opacity-90 whitespace-nowrap"
                      >
                        保有ファンドを追加
                      </button>
                    </>
                  )
                })()}
              </div>
            </div>
            <p className="lg:hidden px-4 pt-3 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 leading-snug">
              スマホではカードで縦スクロールのみ。表は横幅のある画面（PC）で表示されます。
            </p>
            <div className="lg:hidden px-3 pb-3 space-y-3">
              {groupedOwnedFunds.length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">保有ファンドがまだありません。上のフォームから追加してください。</p>
              ) : (
                groupedOwnedFunds.map((fund) => {
                  const pnlYen = fund.currentValueJpy - fund.totalCostJpy
                  const symRealFund = realizedFundPnlBySymbol.get(fund.symbol) || 0
                  const buyDatesSorted = fund.lots.map((l) => toIsoDate(l.buyDate || '')).filter(Boolean).sort()
                  const buyDateDisplay = buyDatesSorted.length === 0
                    ? '—'
                    : buyDatesSorted.length === 1
                      ? formatDateJpSlash(buyDatesSorted[0])
                      : `${formatDateJpSlash(buyDatesSorted[0])}〜`
                  const isExpanded = Boolean(expandedFundSymbols[fund.symbol])
                  return (
                    <div key={`m-owned-fund-${fund.symbol}`} className={ownedPortfolioMobileCardClass}>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-[15px] leading-snug">{fund.name || fund.code}</p>
                        <span className={`${ownedPortfolioTickerPillClass} mt-0.5`}>{fund.code}</span>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-sm">
                        <dt className="text-slate-500 text-[11px] font-semibold">取引数</dt>
                        <dd className="text-right font-semibold tabular-nums">{fund.lots.length}</dd>
                        <dt className="text-slate-500 text-[11px] font-semibold">投資元本</dt>
                        <dd className="text-right font-semibold tabular-nums whitespace-nowrap min-w-0">¥{Math.round(fund.totalCostJpy).toLocaleString('ja-JP')}</dd>
                        <dt className="text-slate-500 text-[11px] font-semibold">買付日</dt>
                        <dd className="text-right font-semibold text-xs break-all">{buyDateDisplay}</dd>
                        <dt className="text-slate-500 text-[11px] font-semibold">平均買付</dt>
                        <dd className="text-right font-semibold tabular-nums text-xs">{fund.units > 0 ? Number(fund.buyPrice || 0).toLocaleString('ja-JP', { maximumFractionDigits: 2 }) : '—'}</dd>
                        <dt className="text-slate-500 text-[11px] font-semibold">最新価格</dt>
                        <dd className="text-right font-semibold tabular-nums">{fund.latestPrice > 0 ? Number(fund.latestPrice).toLocaleString('ja-JP') : '--'}</dd>
                        <dt className="text-slate-500 text-[11px] font-semibold">現在価値</dt>
                        <dd className="text-right font-bold tabular-nums whitespace-nowrap min-w-0">¥{Math.round(fund.currentValueJpy).toLocaleString('ja-JP')}</dd>
                        <dt className="text-slate-500 text-[11px] font-semibold">損益</dt>
                        <dd className={`text-right font-black tabular-nums whitespace-nowrap min-w-0 ${pnlYen >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {`${pnlYen >= 0 ? '+' : ''}¥${Math.round(pnlYen).toLocaleString('ja-JP')}`}
                        </dd>
                        <dt className="text-slate-500 text-[11px] font-semibold">損益率</dt>
                        <dd className={`text-right font-black tabular-nums whitespace-nowrap ${fund.pnlRate == null ? 'text-slate-400' : fund.pnlRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {fund.pnlRate == null ? '--' : `${fund.pnlRate >= 0 ? '+' : ''}${fund.pnlRate.toFixed(2)}%`}
                        </dd>
                        {symRealFund !== 0 ? (
                          <>
                            <dt className="text-slate-500 text-[11px] font-semibold">実現累計</dt>
                            <dd className={`text-right font-black tabular-nums whitespace-nowrap ${symRealFund >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              {symRealFund >= 0 ? '+' : ''}¥{Math.round(symRealFund).toLocaleString('ja-JP')}
                            </dd>
                          </>
                        ) : null}
                      </dl>
                      {fund.tradeDate ? (
                        <p className="text-[10px] text-slate-400">価格基準日: {formatDateJpSlash(fund.tradeDate)}</p>
                      ) : null}
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedFundSymbols((prev) => ({ ...prev, [fund.symbol]: !prev[fund.symbol] }))}
                          className="w-full min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        >
                          {isExpanded ? '取引を隠す' : '取引を表示・編集'}
                        </button>
                        <button
                          type="button"
                          disabled={Number(fund.units || 0) <= 0}
                          onClick={() => openFundSellModal(fund)}
                          className="w-full min-h-[44px] rounded-lg border border-indigo-300 dark:border-indigo-700 text-sm font-black text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-45 disabled:pointer-events-none"
                        >
                          売却を記録（実現損益）
                        </button>
                      </div>
                      {isExpanded && fund.lots.map((lot) => {
                        const lotPnlYen = lot.currentValueJpy - lot.totalCostJpy
                        const lotPnlRate = lot.totalCostJpy > 0 ? ((lot.currentValueJpy - lot.totalCostJpy) / lot.totalCostJpy) * 100 : null
                        const raw = lot.raw || {}
                        return (
                          <div key={`m-fund-lot-${lot.id}`} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-2">
                            <p className="text-xs font-black text-slate-600 dark:text-slate-300">取引</p>
                            <div>
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">投資元本</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={getDraftFieldValue(ownedFundDrafts, lot.id, 'investAmount', raw.investAmount ?? '')}
                                onChange={(e) => setDraftFieldValue(setOwnedFundDrafts, lot.id, 'investAmount', sanitizeDecimalInput(e.target.value))}
                                onBlur={() => commitOwnedFundDraftField(lot.id, 'investAmount', raw.investAmount ?? '')}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return
                                  e.preventDefault()
                                  commitOwnedFundDraftField(lot.id, 'investAmount', raw.investAmount ?? '')
                                  e.currentTarget.blur()
                                }}
                                className={`${ownedFieldInputRightClass} w-full max-w-none mt-1`}
                              />
                            </div>
                            <div>
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">買付日</span>
                              <OwnedBuyDateTextInput
                                value={lot.buyDate || ''}
                                onCommit={(iso) => onUpdateOwnedFund?.(lot.id, { buyDate: iso })}
                                className={`${ownedFieldInputClass} w-full max-w-none mt-1 tabular-nums`}
                              />
                            </div>
                            <div>
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">買付価格</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={getDraftFieldValue(ownedFundDrafts, lot.id, 'buyPrice', raw.buyPrice ?? '')}
                                onChange={(e) => setDraftFieldValue(setOwnedFundDrafts, lot.id, 'buyPrice', sanitizeDecimalInput(e.target.value))}
                                onBlur={() => commitOwnedFundDraftField(lot.id, 'buyPrice', raw.buyPrice ?? '')}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return
                                  e.preventDefault()
                                  commitOwnedFundDraftField(lot.id, 'buyPrice', raw.buyPrice ?? '')
                                  e.currentTarget.blur()
                                }}
                                className={`${ownedFieldInputRightClass} w-full max-w-none mt-1`}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-500 font-semibold">最新</span>
                                <p className="font-semibold tabular-nums">{lot.effectiveLatestPrice > 0 ? Number(lot.effectiveLatestPrice).toLocaleString('ja-JP') : '--'}</p>
                                <p className="text-[10px] text-slate-400">{lot.tradeDate ? formatDateJpSlash(lot.tradeDate) : ''}</p>
                              </div>
                              <div>
                                <span className="text-slate-500 font-semibold">現在価値</span>
                                <p className="font-semibold tabular-nums">{lot.currentValueJpy > 0 ? `¥${Math.round(lot.currentValueJpy).toLocaleString('ja-JP')}` : '--'}</p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 text-xs font-black sm:flex-row sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
                              <span className={`whitespace-nowrap tabular-nums ${lotPnlYen >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                損益 {`${lotPnlYen >= 0 ? '+' : ''}¥${Math.round(lotPnlYen).toLocaleString('ja-JP')}`}
                              </span>
                              <span className={`whitespace-nowrap tabular-nums ${lotPnlRate == null ? 'text-slate-400' : lotPnlRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {lotPnlRate == null ? '--' : `${lotPnlRate >= 0 ? '+' : ''}${lotPnlRate.toFixed(2)}%`}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => onLoadOwnedFundPrice?.(lot.id, fund.symbol, lot.buyDate)}
                                className="min-h-[44px] w-full rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300"
                              >
                                終値反映
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(CONFIRM_DELETE_OWNED_LOT_JA)) return
                                  onRemoveOwnedFund?.(lot.id)
                                }}
                                className="min-h-[44px] w-full rounded-lg border border-red-200 dark:border-red-800 text-sm font-bold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                取引を削除
                              </button>
                              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-snug">
                                削除は実現損益に影響しません。実売却での口数減は「売却を記録」へ。
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
              {groupedOwnedFunds.length > 0 && (
                <div className={ownedPortfolioMobileTotalsClass}>
                  <div className="flex justify-between gap-3 font-bold text-slate-700 dark:text-slate-300">
                    <span>投資元本合計（円換算）</span>
                    <span className="tabular-nums shrink-0">¥{Math.round(fundTotalInvestedJpy).toLocaleString('ja-JP')}</span>
                  </div>
                  <div className="flex justify-between gap-3 font-black text-indigo-900 dark:text-indigo-200">
                    <span>現在評価額合計</span>
                    <span className="tabular-nums shrink-0">¥{Math.round(fundTotalCurrentJpy).toLocaleString('ja-JP')}</span>
                  </div>
                </div>
              )}
            </div>
            <div className={ownedPortfolioTableScrollWrapClass}>
              <table className={`${ownedPortfolioTableBaseClass} min-w-[1180px] xl:min-w-[1240px]`}>
                <thead>
                  <tr className={`text-left ${ownedPortfolioTheadRowClass}`}>
                    <th className={`${ownedPortfolioThBaseClass} text-left max-w-[14rem] xl:max-w-[18rem]`}>ファンド名</th>
                    <th className={`${ownedPortfolioThBaseClass} text-right`}>取引数</th>
                    <th className={`${ownedPortfolioThBaseClass} text-right`}>投資元本(合計)</th>
                    <th className={`${ownedPortfolioThBaseClass} text-right`}>買付日</th>
                    <th className={`${ownedPortfolioThBaseClass} text-right`}>平均買付価格</th>
                    <th className={`${ownedPortfolioThBaseClass} text-right`}>最新価格</th>
                    <th className={`${ownedPortfolioThBaseClass} text-right`}>現在価値(円)</th>
                    <th className={`${ownedPortfolioThBaseClass} text-right`}>損益</th>
                    <th className={`${ownedPortfolioThBaseClass} text-right`}>損益率</th>
                    <th className={`${ownedPortfolioThBaseClass} text-right`}>管理</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedOwnedFunds.length === 0 && (
                    <tr className="border-t border-slate-100 dark:border-slate-800">
                      <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        保有ファンドがまだありません。上のフォームから追加してください。
                      </td>
                    </tr>
                  )}
                  {groupedOwnedFunds.map((fund) => {
                    const pnlYen = fund.currentValueJpy - fund.totalCostJpy
                    const symRealFund = realizedFundPnlBySymbol.get(fund.symbol) || 0
                    const buyDatesSorted = fund.lots.map((l) => toIsoDate(l.buyDate || '')).filter(Boolean).sort()
                    const buyDateDisplay = buyDatesSorted.length === 0
                      ? '—'
                      : buyDatesSorted.length === 1
                        ? formatDateJpSlash(buyDatesSorted[0])
                        : `${formatDateJpSlash(buyDatesSorted[0])}〜`
                    const isExpanded = Boolean(expandedFundSymbols[fund.symbol])
                    return (
                      <Fragment key={`wealth-fund-group-${fund.symbol}`}>
                        <tr className={ownedPortfolioTbodyRowClass}>
                          <td className={`${ownedPortfolioNameCellClass} !py-2 sm:!py-2.5 lg:!py-2`}>
                            <p className="font-bold text-slate-900 dark:text-slate-50 text-[15px] lg:text-sm break-words leading-snug">{fund.name || fund.code}</p>
                            <span className={`${ownedPortfolioTickerPillClass} break-all`}>{fund.code}</span>
                          </td>
                          <td className="px-3 py-2 sm:px-5 lg:py-2 text-right font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{fund.lots.length}</td>
                          <td className="px-3 py-2 sm:px-5 lg:py-2 text-right font-semibold text-slate-700 dark:text-slate-300 text-[15px] lg:text-sm whitespace-nowrap">
                            ¥{Math.round(fund.totalCostJpy).toLocaleString('ja-JP')}
                          </td>
                          <td className="px-3 py-2 sm:px-5 lg:py-2 text-right font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{buyDateDisplay}</td>
                          <td className="px-3 py-2 sm:px-5 lg:py-2 text-right font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {fund.units > 0 ? Number(fund.buyPrice || 0).toLocaleString('ja-JP', { maximumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-3 py-2 sm:px-5 lg:py-2 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            {fund.latestPrice > 0 ? Number(fund.latestPrice).toLocaleString('ja-JP') : '--'}
                            <p className="text-xs lg:text-[11px] text-slate-400 whitespace-normal leading-tight">{fund.tradeDate ? formatDateJpSlash(fund.tradeDate) : ''}</p>
                          </td>
                          <td className="px-3 py-2 sm:px-5 lg:py-2 text-right font-black text-indigo-900 dark:text-indigo-200 text-[15px] lg:text-sm whitespace-nowrap">
                            {fund.currentValueJpy > 0 ? `¥${Math.round(fund.currentValueJpy).toLocaleString('ja-JP')}` : '--'}
                          </td>
                          <td className={`px-3 py-2 sm:px-5 lg:py-2 text-right font-black text-[15px] lg:text-sm whitespace-nowrap tabular-nums ${pnlYen >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {`${pnlYen >= 0 ? '+' : ''}¥${Math.round(pnlYen).toLocaleString('ja-JP')}`}
                          </td>
                          <td className={`px-3 py-2 sm:px-5 lg:py-2 text-right font-black text-[15px] lg:text-sm whitespace-nowrap tabular-nums ${fund.pnlRate == null ? 'text-slate-400' : fund.pnlRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {fund.pnlRate == null ? '--' : `${fund.pnlRate >= 0 ? '+' : ''}${fund.pnlRate.toFixed(2)}%`}
                            {symRealFund !== 0 ? (
                              <span className={`mt-1 block text-[10px] lg:text-[9px] font-bold tabular-nums ${symRealFund >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                実現累計 {symRealFund >= 0 ? '+' : ''}¥{Math.round(symRealFund).toLocaleString('ja-JP')}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 sm:px-5 lg:py-2 text-right whitespace-nowrap align-middle">
                            <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedFundSymbols((prev) => ({ ...prev, [fund.symbol]: !prev[fund.symbol] }))}
                                className="min-h-[44px] lg:min-h-0 px-3 py-2.5 lg:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm lg:text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-orange-400"
                              >
                                {isExpanded ? '取引を隠す' : '取引を表示'}
                              </button>
                              <button
                                type="button"
                                disabled={Number(fund.units || 0) <= 0}
                                onClick={() => openFundSellModal(fund)}
                                className="min-h-[44px] lg:min-h-0 shrink-0 px-3 py-2.5 lg:py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-sm lg:text-xs font-black text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/25 disabled:opacity-45 disabled:pointer-events-none"
                              >
                                売却記録
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && fund.lots.map((lot) => {
                          const lotPnlYen = lot.currentValueJpy - lot.totalCostJpy
                          const lotPnlRate = lot.totalCostJpy > 0 ? ((lot.currentValueJpy - lot.totalCostJpy) / lot.totalCostJpy) * 100 : null
                          const raw = lot.raw || {}
                          return (
                            <tr key={`wealth-fund-lot-${lot.id}`} className={ownedPortfolioLotRowClass}>
                              <td className="px-3 py-3 sm:px-5 text-sm lg:text-xs text-slate-500 dark:text-slate-400 align-top min-w-0 max-w-[14rem] xl:max-w-[18rem]">└ 取引</td>
                              <td className="px-3 py-3 sm:px-5 text-right text-sm lg:text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">-</td>
                              <td className="px-3 py-3 sm:px-5 text-right whitespace-nowrap">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={getDraftFieldValue(ownedFundDrafts, lot.id, 'investAmount', raw.investAmount ?? '')}
                                  onChange={(e) => setDraftFieldValue(setOwnedFundDrafts, lot.id, 'investAmount', sanitizeDecimalInput(e.target.value))}
                                  onBlur={() => commitOwnedFundDraftField(lot.id, 'investAmount', raw.investAmount ?? '')}
                                  onKeyDown={(e) => {
                                    if (e.key !== 'Enter') return
                                    e.preventDefault()
                                    commitOwnedFundDraftField(lot.id, 'investAmount', raw.investAmount ?? '')
                                    e.currentTarget.blur()
                                  }}
                                  className={`${ownedFieldInputRightClass} max-w-full sm:max-w-[180px] ml-auto`}
                                />
                              </td>
                              <td className="px-3 py-3 sm:px-5 text-right min-w-[10rem]">
                                <OwnedBuyDateTextInput
                                  value={lot.buyDate || ''}
                                  onCommit={(iso) => onUpdateOwnedFund?.(lot.id, { buyDate: iso })}
                                  className={`${ownedFieldInputClass} max-w-full sm:max-w-[170px] ml-auto tabular-nums`}
                                />
                              </td>
                              <td className="px-3 py-3 sm:px-5 text-right whitespace-nowrap">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={getDraftFieldValue(ownedFundDrafts, lot.id, 'buyPrice', raw.buyPrice ?? '')}
                                  onChange={(e) => setDraftFieldValue(setOwnedFundDrafts, lot.id, 'buyPrice', sanitizeDecimalInput(e.target.value))}
                                  onBlur={() => commitOwnedFundDraftField(lot.id, 'buyPrice', raw.buyPrice ?? '')}
                                  onKeyDown={(e) => {
                                    if (e.key !== 'Enter') return
                                    e.preventDefault()
                                    commitOwnedFundDraftField(lot.id, 'buyPrice', raw.buyPrice ?? '')
                                    e.currentTarget.blur()
                                  }}
                                  className={`${ownedFieldInputRightClass} max-w-full sm:max-w-[140px] ml-auto`}
                                />
                              </td>
                              <td className="px-3 py-3 sm:px-5 text-right font-semibold text-slate-900 dark:text-white text-sm lg:text-xs whitespace-nowrap">
                                {lot.effectiveLatestPrice > 0 ? Number(lot.effectiveLatestPrice).toLocaleString('ja-JP') : '--'}
                                <p className="text-xs lg:text-[11px] text-slate-400 whitespace-normal">{lot.tradeDate ? formatDateJpSlash(lot.tradeDate) : ''}</p>
                              </td>
                              <td className="px-3 py-3 sm:px-5 text-right font-semibold text-slate-900 dark:text-white text-sm lg:text-xs whitespace-nowrap">
                                {lot.currentValueJpy > 0 ? `¥${Math.round(lot.currentValueJpy).toLocaleString('ja-JP')}` : '--'}
                              </td>
                              <td className={`px-3 py-3 sm:px-5 text-right font-black text-sm lg:text-xs whitespace-nowrap tabular-nums ${lotPnlYen >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {`${lotPnlYen >= 0 ? '+' : ''}¥${Math.round(lotPnlYen).toLocaleString('ja-JP')}`}
                              </td>
                              <td className={`px-3 py-3 sm:px-5 text-right font-black text-sm lg:text-xs whitespace-nowrap tabular-nums ${lotPnlRate == null ? 'text-slate-400' : lotPnlRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {lotPnlRate == null ? '--' : `${lotPnlRate >= 0 ? '+' : ''}${lotPnlRate.toFixed(2)}%`}
                              </td>
                              <td className="px-3 py-3 sm:px-5 text-right whitespace-nowrap max-w-[11rem]">
                                <div className="flex flex-col gap-1.5 items-end">
                                  <button
                                    type="button"
                                    onClick={() => onLoadOwnedFundPrice?.(lot.id, fund.symbol, lot.buyDate)}
                                    className="min-h-[44px] sm:min-h-0 px-3 py-2.5 sm:px-2 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-sm sm:text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-orange-400"
                                  >
                                    終値反映
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!window.confirm(CONFIRM_DELETE_OWNED_LOT_JA)) return
                                      onRemoveOwnedFund?.(lot.id)
                                    }}
                                    className="min-h-[44px] sm:min-h-0 px-3 py-2.5 sm:px-2 sm:py-1 rounded-lg border border-red-200 dark:border-red-800 text-sm sm:text-[11px] font-bold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  >
                                    取引削除
                                  </button>
                                </div>
                                <p className="mt-2 text-left sm:text-right text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-snug">
                                  削除は実現損益に影響しません
                                </p>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot className={ownedPortfolioTfootClass}>
                  <tr>
                    <td colSpan={6} className="px-3 py-2.5 sm:px-5 sm:py-2 text-right font-bold text-slate-700 dark:text-slate-300 text-sm lg:text-xs">投資元本合計（円換算）</td>
                    <td className="px-3 py-2.5 sm:px-5 sm:py-2 text-right font-bold text-slate-900 dark:text-slate-100 text-[15px] lg:text-sm whitespace-nowrap tabular-nums">¥{Math.round(fundTotalInvestedJpy).toLocaleString('ja-JP')}</td>
                    <td colSpan={3} className="px-3 sm:px-5 py-2" />
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-3 py-3.5 sm:px-5 sm:py-3 text-right font-black text-slate-800 dark:text-slate-100 text-sm lg:text-xs">現在評価額合計</td>
                    <td className="px-3 py-3.5 sm:px-5 sm:py-3 text-right font-black text-indigo-900 dark:text-indigo-200 text-[15px] lg:text-sm whitespace-nowrap tabular-nums">¥{Math.round(fundTotalCurrentJpy).toLocaleString('ja-JP')}</td>
                    <td colSpan={3} className="px-3 sm:px-5 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="px-4 sm:px-5 py-3 text-xs sm:text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
              ※ 買付日入力後の「終値反映」は、その日以前の直近終値を買付価格に入れます（買付日は変えません）。
              <span className="block mt-2">
                投資元本・買付価格・買付日の編集は保存され損益に反映されます。誤追加した取引は各行から削除できます（
                <span className="font-bold text-slate-700 dark:text-slate-200">削除は実現損益に影響しません</span>
                ）。実売却で口数を減らす場合は「売却記録」を使ってください。
              </span>
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white">保存した配分セット</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {isPaidMember
                      ? 'ファンド一覧の配分シミュレーションで保存した「ウォッチセット」と同じデータです（ここでは配分セットと表示）。銘柄と比率を保ったまま「シミュレーションで開く」から比較画面に戻れます。'
                      : '配分セットの保存/削除はプレミアム限定です。無料では閲覧のみ可能です。'}
                  </p>
                </div>
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                  {fundOptimizerSets.length} sets
                </span>
              </div>
            </div>
            <div className="p-5">
              {fundOptimizerSets.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">まだ保存した配分セットがありません。</p>
              ) : (
                <div className="grid lg:grid-cols-2 gap-3">
                  {fundOptimizerSets.map((set) => (
                    <div key={set.id} className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900 dark:text-white">{set.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {(Array.isArray(set.funds) ? set.funds : []).map((fund) => `${fund.name} ${Number(fund.weightPct || 0).toFixed(1)}%`).join(' / ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(buildFundOptimizerCompareUrl(set))}
                            className="px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold text-indigo-700 dark:text-indigo-200 hover:bg-white/80 dark:hover:bg-indigo-900/30"
                          >
                            シミュレーションで開く
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFundOptimizerSet?.(set.id)}
                            disabled={!isPaidMember}
                            title={isPaidMember ? '配分セット削除' : 'プレミアム限定機能'}
                            className={`px-2.5 py-1 rounded-md border text-[11px] font-bold ${
                              isPaidMember
                                ? 'border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                : 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      {set.summary && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-3">
                          R {Number(set.summary.ret || 0).toFixed(1)}% / σ {Number(set.summary.risk || 0).toFixed(1)}% / Fee {Number(set.summary.fee || 0).toFixed(2)}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">ファンドウォッチリスト</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {isPaidMember
                      ? 'ファンド一覧のハート登録と同じウォッチリストです。メモはブラウザに保存されます。配分セットに含まれる銘柄は、各カードの「配分セット」欄にセット名が表示されます。配分シミュレーションでウォッチセットを保存したとき、まだウォッチに無い構成銘柄は自動で追加されます。'
                      : `無料プランは最大${FREE_FUND_WATCHLIST_LIMIT}件まで表示されます。`}
                  </p>
                </div>
                <span className={`text-sm font-black px-3 py-1 rounded-full ${
                  isPaidMember
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                }`}>
                  {fundWatchlist.length}/{isPaidMember ? '∞' : FREE_FUND_WATCHLIST_LIMIT}
                </span>
              </div>
            </div>
            <div className="p-5">
              {fundWatchlist.length === 0 ? (
                <div className="text-base text-slate-500 dark:text-slate-400 space-y-3">
                  <p>ファンドウォッチリストがありません。</p>
                  <button
                    type="button"
                    onClick={() => navigate('/funds')}
                    className="inline-flex rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-sm font-black text-orange-700 dark:text-orange-300"
                  >
                    ファンド一覧で追加
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(Array.isArray(fundWatchlist) ? fundWatchlist : []).map((row) => {
                    const setNames = Array.isArray(watchsetNamesByFundId[String(row.id || '').trim().toUpperCase()])
                      ? watchsetNamesByFundId[String(row.id || '').trim().toUpperCase()]
                      : []
                    const oneYear = Number(row.change || 0)
                    const categoryLabel = inferWatchFundCategoryLabel(row)
                    return (
                      <div key={row.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">{row.name || row.id}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <p className="text-sm text-slate-500 dark:text-slate-400">{row.id}</p>
                              <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                                {categoryLabel}
                              </span>
                            </div>
                          </div>
                          <span className={`shrink-0 text-base font-black tabular-nums ${oneYear >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {`${oneYear >= 0 ? '+' : ''}${oneYear.toFixed(2)}%`}
                          </span>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 px-3 py-2.5">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">配分セット</p>
                          {setNames.length > 0 ? (
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{setNames.join(', ')}</p>
                          ) : (
                            <p className="mt-1 text-sm text-slate-400">-</p>
                          )}
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/30 px-3 py-2.5">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">メモ</p>
                          <textarea
                            value={getFundMemoValue(row.id)}
                            onChange={(e) => handleFundMemoChange(row.id, e.target.value)}
                            placeholder="このファンドのメモを入力"
                            rows={2}
                            className="mt-1.5 w-full min-h-[3.25rem] resize-y rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-orange-400"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/funds/${encodeURIComponent(String(row.id || ''))}`)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-orange-400"
                          >
                            ファンドページ
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleFundWatchlist?.(row.id, row)}
                            className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!isFundTab && (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div id={isWealthTab ? 'wealth-allocation-chart' : undefined} className={`${isStockTab || isWealthTab ? 'xl:col-span-5' : 'xl:col-span-7'} bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
            <h3 className="font-black text-slate-900 dark:text-white">{isWealthTab ? '株式/ファンド構成比' : isStockTab ? '株式 セクター別配分 (円換算)' : isFundTab ? 'ファンド 国別配分 (円換算)' : '資産成長トレンド (6ヶ月)'}</h3>
          </div>
          <div className="p-5">
            <div className="h-52">
              {isWealthTab ? (
                (() => {
                  const wealthPieSlices = [
                    { name: '株式', value: stockTotalCurrentJpy, color: '#10b981' },
                    { name: 'ファンド', value: fundTotalCurrentJpy, color: '#3b82f6' },
                  ].filter((r) => Number(r.value || 0) > 0)
                  if (wealthPieSlices.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center px-3">
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                          株式またはファンドの保有を登録すると、構成比チャートが表示されます。
                        </p>
                      </div>
                    )
                  }
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={wealthPieSlices}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={84}
                          innerRadius={48}
                          paddingAngle={wealthPieSlices.length > 1 ? 2 : 0}
                          minAngle={MY_PAGE_PIE_MIN_ANGLE}
                          stroke="none"
                        >
                          {wealthPieSlices.map((entry) => (
                            <Cell key={`wealth-split-${entry.name}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `¥${Number(value).toLocaleString('ja-JP')}`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  )
                })()
              ) : isStockTab && stockSectorData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-3">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                    保有株式を追加すると、セクター別の配分が表示されます。
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={stockSectorData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={84}
                      innerRadius={48}
                      paddingAngle={2}
                      minAngle={0}
                      stroke="none"
                    >
                      {stockSectorData.map((entry) => (
                        <Cell key={`asset-split-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `¥${Number(value).toLocaleString('ja-JP')}`} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              )}
            </div>
            {isWealthTab && (
              <div className="mt-3 space-y-2">
                {[
                  { name: '株式', value: stockTotalCurrentJpy, color: '#10b981' },
                  { name: 'ファンド', value: fundTotalCurrentJpy, color: '#3b82f6' },
                ].filter((r) => Number(r.value || 0) > 0).map((row) => {
                  const base = Math.max(1, totalCurrentValue)
                  const weight = (Number(row.value || 0) / base) * 100
                  return (
                    <div key={`wealth-legend-${row.name}`} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color || '#94a3b8' }} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{row.name}</span>
                      </div>
                      <span className="font-black text-slate-900 dark:text-white">{weight.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            )}
            {(isStockTab || isFundTab) && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(isStockTab ? stockSectorData : fundCountryData).map((row) => {
                  const base = Math.max(1, isStockTab ? stockTotalCurrentJpy : fundTotalPieJpy)
                  const weight = (Number(row.value || 0) / base) * 100
                  return (
                    <div key={`asset-split-legend-${row.name}`} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color || '#94a3b8' }} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{row.name}</span>
                      </div>
                      <span className="font-black text-slate-900 dark:text-white">{weight.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className={`${isStockTab || isWealthTab ? 'xl:col-span-7' : 'xl:col-span-5'} bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5`}>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart size={18} className="text-indigo-500" /> {isWealthTab ? '資産成長トレンド' : isStockTab ? '株式パフォーマンス推移' : isFundTab ? 'ファンドパフォーマンス推移' : '株式/ファンド構成比'}
            </h3>
            {((isWealthTab && (totalHoldingsCount >= 1 || hasRawStockHoldings || hasRawFundHoldings)) || (isStockTab && (groupedOwnedStocks.length >= 1 || hasRawStockHoldings)) || (isFundTab && (effectiveFundRows.length >= 1 || hasRawFundHoldings))) && (
              <select value={wealthChartMonths} onChange={(e) => setWealthChartMonths(Number(e.target.value))} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                <option value={6}>6ヶ月</option>
                <option value={12}>12ヶ月</option>
                <option value={24}>24ヶ月</option>
                <option value={36}>36ヶ月</option>
              </select>
            )}
          </div>
          {isWealthTab ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetGrowthSplitData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-28} textAnchor="end" height={46} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    domain={getAssetGrowthYAxisDomainSplit(assetGrowthSplitData)}
                    tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                  />
                  <Tooltip content={AssetGrowthSplitTooltip} wrapperStyle={{ outline: 'none' }} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="fundJpy" name="ファンド" stackId="wealth" fill="#3b82f6" maxBarSize={40} />
                  <Bar dataKey="stockJpy" name="株式" stackId="wealth" fill="#10b981" maxBarSize={40} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : isStockTab ? (
            <div className="space-y-2">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockPerformanceBarRows} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-28} textAnchor="end" height={46} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      domain={getStockPerformanceYAxisDomain(stockPerformanceBarRows)}
                      tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                    />
                    <Tooltip content={StockPerformanceStackTooltip} wrapperStyle={{ outline: 'none' }} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar name="ベース" dataKey="basisJpy" stackId="stk" fill="#94a3b8" maxBarSize={44} />
                    <Bar name="含み益" dataKey="gainJpy" stackId="stk" fill="#10b981" maxBarSize={44} radius={[5, 5, 0, 0]} />
                    <Bar name="含み損" dataKey="lossJpy" stackId="stk" fill="#f43f5e" maxBarSize={44} radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-[10px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400 px-0.5">
                <p>
                  <span className="font-black text-slate-600 dark:text-slate-300">読み方：</span>
                  各柱は、その日時点の<span className="font-black">保有ロット</span>について、終値（取引無い日は直近終値）で円換算した<span className="font-black">評価額</span>と<span className="font-black">取得原価</span>を積み上げたものです。最後の柱は画面と同じ最新の株式評価です。
                </p>
                <p>
                  <span className="font-black text-slate-600 dark:text-slate-300">ベース／含み益・損：</span>
                  評価が原価以上のとき → 灰＝<span className="font-black">取得原価</span>、その上の緑＝<span className="font-black">含み益</span>（柱の合計高さ＝評価額）。評価が原価を下回るとき → 灰＝<span className="font-black">評価額</span>、その上の赤＝<span className="font-black">含み損</span>の分（合計高さ＝原価）。「ベース」が常に原価だけではありません。
                </p>
                <p>
                  売却記録の<span className="font-black">実現損益</span>はこのグラフには入りません（上部レポートの「実現」）。売却でロットが減ると、以降の柱は評価・原価ともに下がって見えます。売却した分は、買付日から売却日の前日まで推移に含めます。
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      )}

      {isWealthTab && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:items-stretch">
          {totalCurrentValue > 0 ? (
            <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5 flex flex-col min-h-0 max-xl:h-auto xl:h-full">
              <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart size={16} className="text-indigo-500" /> 構成比
              </h3>
              <p className="mt-3 text-sm font-black text-slate-900 dark:text-white">
                目標配分は未設定です
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                特定の金融商品の売買を勧誘するものではありません。
              </p>
              <button
                type="button"
                onClick={() => document.getElementById('wealth-allocation-chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="mt-4 w-full px-3 py-2 rounded-lg bg-slate-900 dark:bg-orange-500 text-white text-xs font-black hover:opacity-90"
              >
                構成比の内訳を見る
              </button>
              {monthlyUnrealizedPnlSplit.mode === 'bar' ? (
                <div className="mt-4 pt-3 border-t border-slate-200/90 dark:border-slate-700/80">
                  <p className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">
                    含み損益の寄与度（合計損益に占める割合）
                  </p>
                  <div
                    className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80"
                    role="img"
                    aria-label={`含み損益の合計に対し、株式が${monthlyUnrealizedPnlSplit.stockPct.toFixed(0)}パーセント、ファンドが${monthlyUnrealizedPnlSplit.fundPct.toFixed(0)}パーセントを占めます`}
                  >
                    <div className="h-full bg-emerald-500 dark:bg-emerald-500/90" style={{ width: `${monthlyUnrealizedPnlSplit.stockBarW}%` }} />
                    <div className="h-full bg-blue-500 dark:bg-blue-500/90" style={{ width: `${monthlyUnrealizedPnlSplit.fundBarW}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] sm:text-[11px] font-bold tabular-nums">
                    <span className="text-emerald-700 dark:text-emerald-300">
                      株式（損益シェア）{' '}
                      {monthlyUnrealizedPnlSplit.stockPct >= 10
                        ? monthlyUnrealizedPnlSplit.stockPct.toFixed(0)
                        : monthlyUnrealizedPnlSplit.stockPct.toFixed(1)}
                      %
                    </span>
                    <span className="text-blue-700 dark:text-blue-300">
                      ファンド（損益シェア）{' '}
                      {monthlyUnrealizedPnlSplit.fundPct >= 10
                        ? monthlyUnrealizedPnlSplit.fundPct.toFixed(0)
                        : monthlyUnrealizedPnlSplit.fundPct.toFixed(1)}
                      %
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5 flex flex-col min-h-0 max-xl:h-auto xl:h-full">
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-500 shrink-0" aria-hidden /> 月次変動サマリー
            </h3>
            <div className="mt-4 flex flex-col min-h-0 xl:flex-1 xl:min-h-0">
            <div className="space-y-3 text-sm">
              {accountCostWithRealizedDenom > 0 && Number.isFinite(accountPnlWithRealizedJpy) ? (
                <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 pr-1">
                      <span className="text-slate-600 dark:text-slate-300 text-xs sm:text-[13px] block leading-snug font-bold">
                        総損益（評価額 − 保有原価 + 実現損益）
                      </span>
                      <span className="mt-1 block text-[11px] sm:text-xs font-semibold leading-snug text-emerald-800/80 dark:text-emerald-300/80">
                        元本は保有原価に、売却した分の取得原価を足したもの。括弧の%は総損益÷元本。
                      </span>
                    </div>
                    <div className={`shrink-0 font-black tabular-nums text-right leading-tight ${signedReturnTextClassStrong(accountPnlWithRealizedJpy)}`}>
                      <div className="text-lg sm:text-xl">{accountPnlWithRealizedJpy >= 0 ? '+' : ''}¥{Math.round(accountPnlWithRealizedJpy).toLocaleString('ja-JP')}</div>
                      {accountReturnWithRealizedPct != null && Number.isFinite(accountReturnWithRealizedPct) ? (
                        <div className="text-xs sm:text-sm font-bold mt-0.5">
                          ({accountReturnWithRealizedPct >= 0 ? '+' : ''}{accountReturnWithRealizedPct.toFixed(1)}%)
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              {monthlyDeltaJpy != null && Number.isFinite(monthlyDeltaJpy) ? (
                <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 pr-1">
                      <span className="text-slate-600 dark:text-slate-300 text-xs sm:text-[13px] block leading-snug font-bold">
                        1ヶ月の変化
                      </span>
                      <span className="mt-1 block text-[11px] sm:text-xs font-semibold leading-snug text-indigo-900/80 dark:text-indigo-200/85">
                        今日の総損益から、1ヶ月前以前で最後に評価できた日{monthlyPnlBase?.baseDate ? `（${monthlyPnlBase.baseDate}）` : ''}の総損益を引いた差。括弧の%はその差÷今日の元本。
                      </span>
                    </div>
                    <div className={`shrink-0 font-black tabular-nums text-right leading-tight ${signedReturnTextClassStrong(monthlyDeltaJpy)}`}>
                      <div className="text-lg sm:text-xl">
                        {monthlyDeltaJpy >= 0 ? '+' : ''}¥{Math.round(monthlyDeltaJpy || 0).toLocaleString('ja-JP')}
                      </div>
                      {monthlyDeltaPct != null && Number.isFinite(monthlyDeltaPct) ? (
                        <div className="text-xs sm:text-sm font-bold mt-0.5">
                          ({monthlyDeltaPct >= 0 ? '+' : ''}{monthlyDeltaPct.toFixed(1)}%)
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              {totalCurrentValue <= 0 && monthlyUnrealizedPnlSplit.mode === 'bar' ? (
                <div className="rounded-xl border border-slate-200/90 dark:border-slate-600/80 bg-slate-50/90 dark:bg-slate-800/50 px-3 py-2.5">
                  <p className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">
                    含み損益の寄与度（合計損益に占める割合）
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                    ※ 評価額の構成比とは別指標です（損益の大きさの分け合い）。
                  </p>
                  <div
                    className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80"
                    role="img"
                    aria-label={`含み損益の合計に対し、株式が${monthlyUnrealizedPnlSplit.stockPct.toFixed(0)}パーセント、ファンドが${monthlyUnrealizedPnlSplit.fundPct.toFixed(0)}パーセントを占めます`}
                  >
                    <div
                      className="h-full bg-emerald-500 dark:bg-emerald-500/90"
                      style={{ width: `${monthlyUnrealizedPnlSplit.stockBarW}%` }}
                    />
                    <div
                      className="h-full bg-blue-500 dark:bg-blue-500/90"
                      style={{ width: `${monthlyUnrealizedPnlSplit.fundBarW}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] sm:text-[11px] font-bold tabular-nums">
                    <span className="text-emerald-700 dark:text-emerald-300">
                      株式（損益シェア）{' '}
                      {monthlyUnrealizedPnlSplit.stockPct >= 10
                        ? monthlyUnrealizedPnlSplit.stockPct.toFixed(0)
                        : monthlyUnrealizedPnlSplit.stockPct.toFixed(1)}
                      %
                    </span>
                    <span className="text-blue-700 dark:text-blue-300">
                      ファンド（損益シェア）{' '}
                      {monthlyUnrealizedPnlSplit.fundPct >= 10
                        ? monthlyUnrealizedPnlSplit.fundPct.toFixed(0)
                        : monthlyUnrealizedPnlSplit.fundPct.toFixed(1)}
                      %
                    </span>
                  </div>
                </div>
              ) : monthlyUnrealizedPnlSplit.mode === 'offset' && totalInvested > 0 && Number.isFinite(totalPnL) && totalPnL !== 0 ? (
                <p className="rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/25 px-3 py-2 text-[10px] sm:text-[11px] font-semibold leading-relaxed text-amber-950 dark:text-amber-100/95">
                  株式とファンドで損益の方向が異なる（相殺）ため、合計に対する％内訳バーは表示しません。下の金額ベースをご覧ください。
                </p>
              ) : null}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3 space-y-3">
                <div>
                  <div className="text-xs sm:text-[13px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">株式</div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-snug min-w-0">
                      <div className="font-semibold text-slate-600 dark:text-slate-300">含み損益（評価−元本）</div>
                      <div className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-500">
                        取得元本 ¥{Math.round(stockTotalInvestedJpy || 0).toLocaleString('ja-JP')} ／ 現在評価 ¥{Math.round(stockTotalCurrentJpy || 0).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <div className="shrink-0 font-black tabular-nums text-right leading-tight">
                      <div className={`text-base sm:text-[17px] ${signedReturnTextClassStrong(aggStockPnLJpy)}`}>
                        {aggStockPnLJpy >= 0 ? '+' : ''}¥{Math.round(aggStockPnLJpy).toLocaleString('ja-JP')}
                      </div>
                      {aggStockReturnPct != null && Number.isFinite(aggStockReturnPct) ? (
                        <div className={`text-[11px] sm:text-xs font-bold mt-0.5 ${signedReturnTextClassStrong(aggStockPnLJpy)}`}>
                          （{aggStockReturnPct >= 0 ? '+' : ''}{aggStockReturnPct.toFixed(2)}%）
                        </div>
                      ) : (
                        <div className="text-[11px] font-bold text-slate-400 mt-0.5">（―）</div>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const stockMonthlyDetailExpandable =
                      stockRealizedPnlSum !== 0 ||
                      stockRealizedWindow !== 'all' ||
                      (stockReturnWithRealizedPct != null &&
                        Number.isFinite(stockReturnWithRealizedPct) &&
                        stockOpenAndRealizedCostDenom > 0)
                    if (!stockMonthlyDetailExpandable) return null
                    return (
                      <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-600">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 text-left outline-none ring-offset-2 ring-offset-white focus-visible:ring-2 focus-visible:ring-indigo-400 dark:ring-offset-slate-900"
                          aria-expanded={wealthMonthlyStockRealizedOpen}
                          onClick={() => setWealthMonthlyStockRealizedOpen((v) => !v)}
                        >
                          <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">
                            株式の実現損益・総収益率（詳細）
                          </span>
                          <ChevronDown
                            size={18}
                            className={`shrink-0 text-slate-400 transition-transform ${wealthMonthlyStockRealizedOpen ? 'rotate-180' : ''}`}
                            aria-hidden
                          />
                        </button>
                        {wealthMonthlyStockRealizedOpen ? (
                          <div className="mt-2 space-y-3">
                            {stockRealizedPnlSum !== 0 || stockRealizedWindow !== 'all' ? (
                              <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-700/80 dark:bg-slate-800/40">
                                <div className="flex items-start justify-between gap-2.5">
                                  <div className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-snug min-w-0">
                                    <div className="font-semibold text-slate-600 dark:text-slate-300">
                                      実現損益（株式・{stockRealizedWindowLabelJaCompact}）
                                    </div>
                                    <div className="mt-0.5 text-[10px] sm:text-[11px]">
                                      「売却を記録」に基づく確定損益（株式のみ）。期間は<span className="font-black">株式タブ</span>のレポート上部「実現の期間」と同じです。
                                    </div>
                                  </div>
                                  <div className={`shrink-0 font-black tabular-nums text-right ${signedReturnTextClassStrong(stockRealizedPnlSumWindow)}`}>
                                    {stockRealizedPnlSumWindow >= 0 ? '+' : ''}¥{Math.round(stockRealizedPnlSumWindow).toLocaleString('ja-JP')}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {stockReturnWithRealizedPct != null && Number.isFinite(stockReturnWithRealizedPct) && stockOpenAndRealizedCostDenom > 0 ? (
                              <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-700/80 dark:bg-slate-800/40">
                                <div className="flex items-start justify-between gap-2.5">
                                  <div className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-snug min-w-0">
                                    <div className="font-semibold text-slate-600 dark:text-slate-300">株式・総収益率（含み+実現）</div>
                                    <div className="mt-0.5 text-[10px] sm:text-[11px]">
                                      分母: 現在の株式元本 + 売却済みロットの取得原価（累計）。
                                    </div>
                                  </div>
                                  <div className={`shrink-0 font-black tabular-nums text-right ${signedReturnTextClassStrong(stockPnlWithRealizedJpy)}`}>
                                    <div className={`text-base sm:text-[17px] ${signedReturnTextClassStrong(stockPnlWithRealizedJpy)}`}>
                                      {stockPnlWithRealizedJpy >= 0 ? '+' : ''}¥{Math.round(stockPnlWithRealizedJpy).toLocaleString('ja-JP')}
                                    </div>
                                    <div className={`text-[11px] sm:text-xs font-bold mt-0.5 ${signedReturnTextClassStrong(stockPnlWithRealizedJpy)}`}>
                                      （{stockReturnWithRealizedPct >= 0 ? '+' : ''}{stockReturnWithRealizedPct.toFixed(2)}%）
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })()}
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <div className="text-xs sm:text-[13px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">ファンド</div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-snug min-w-0">
                      <div className="font-semibold text-slate-600 dark:text-slate-300">含み損益（評価−元本）</div>
                      <div className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-500">
                        取得元本 ¥{Math.round(fundTotalInvestedJpy || 0).toLocaleString('ja-JP')} ／ 現在評価 ¥{Math.round(fundTotalCurrentJpy || 0).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <div className="shrink-0 font-black tabular-nums text-right leading-tight">
                      <div className={`text-base sm:text-[17px] ${signedReturnTextClassStrong(aggFundPnLJpy)}`}>
                        {aggFundPnLJpy >= 0 ? '+' : ''}¥{Math.round(aggFundPnLJpy).toLocaleString('ja-JP')}
                      </div>
                      {aggFundReturnPct != null && Number.isFinite(aggFundReturnPct) ? (
                        <div className={`text-[11px] sm:text-xs font-bold mt-0.5 ${signedReturnTextClassStrong(aggFundPnLJpy)}`}>
                          （{aggFundReturnPct >= 0 ? '+' : ''}{aggFundReturnPct.toFixed(2)}%）
                        </div>
                      ) : (
                        <div className="text-[11px] font-bold text-slate-400 mt-0.5">（―）</div>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const fundMonthlyDetailExpandable =
                      fundRealizedPnlSum !== 0 ||
                      stockRealizedWindow !== 'all' ||
                      (fundReturnWithRealizedPct != null &&
                        Number.isFinite(fundReturnWithRealizedPct) &&
                        fundOpenAndRealizedCostDenom > 0)
                    if (!fundMonthlyDetailExpandable) return null
                    return (
                      <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-600">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 text-left outline-none ring-offset-2 ring-offset-white focus-visible:ring-2 focus-visible:ring-indigo-400 dark:ring-offset-slate-900"
                          aria-expanded={wealthMonthlyFundRealizedOpen}
                          onClick={() => setWealthMonthlyFundRealizedOpen((v) => !v)}
                        >
                          <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">
                            ファンドの実現損益・総収益率（詳細）
                          </span>
                          <ChevronDown
                            size={18}
                            className={`shrink-0 text-slate-400 transition-transform ${wealthMonthlyFundRealizedOpen ? 'rotate-180' : ''}`}
                            aria-hidden
                          />
                        </button>
                        {wealthMonthlyFundRealizedOpen ? (
                          <div className="mt-2 space-y-3">
                            {fundRealizedPnlSum !== 0 || stockRealizedWindow !== 'all' ? (
                              <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-700/80 dark:bg-slate-800/40">
                                <div className="flex items-start justify-between gap-2.5">
                                  <div className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-snug min-w-0">
                                    <div className="font-semibold text-slate-600 dark:text-slate-300">
                                      実現損益（ファンド・{stockRealizedWindowLabelJaCompact}）
                                    </div>
                                    <div className="mt-0.5 text-[10px] sm:text-[11px]">
                                      「売却を記録」に基づく確定損益（ファンドのみ）。期間は<span className="font-black">ファンドタブ</span>のレポート上部「実現の期間」と同じです。
                                    </div>
                                  </div>
                                  <div className={`shrink-0 font-black tabular-nums text-right ${signedReturnTextClassStrong(fundRealizedPnlSumWindow)}`}>
                                    {fundRealizedPnlSumWindow >= 0 ? '+' : ''}¥{Math.round(fundRealizedPnlSumWindow).toLocaleString('ja-JP')}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {fundReturnWithRealizedPct != null && Number.isFinite(fundReturnWithRealizedPct) && fundOpenAndRealizedCostDenom > 0 ? (
                              <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-700/80 dark:bg-slate-800/40">
                                <div className="flex items-start justify-between gap-2.5">
                                  <div className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-snug min-w-0">
                                    <div className="font-semibold text-slate-600 dark:text-slate-300">ファンド・総収益率（含み+実現）</div>
                                    <div className="mt-0.5 text-[10px] sm:text-[11px]">
                                      分母: 現在のファンド元本 + 売却済みロットの取得原価（累計）。
                                    </div>
                                  </div>
                                  <div className={`shrink-0 font-black tabular-nums text-right ${signedReturnTextClassStrong(fundPnlWithRealizedJpy)}`}>
                                    <div className={`text-base sm:text-[17px] ${signedReturnTextClassStrong(fundPnlWithRealizedJpy)}`}>
                                      {fundPnlWithRealizedJpy >= 0 ? '+' : ''}¥{Math.round(fundPnlWithRealizedJpy).toLocaleString('ja-JP')}
                                    </div>
                                    <div className={`text-[11px] sm:text-xs font-bold mt-0.5 ${signedReturnTextClassStrong(fundPnlWithRealizedJpy)}`}>
                                      （{fundReturnWithRealizedPct >= 0 ? '+' : ''}{fundReturnWithRealizedPct.toFixed(2)}%）
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
            <div className="min-h-3 shrink-0 xl:flex-1" aria-hidden="true" />
            <p className="mt-3 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-3 border-t border-slate-200/90 dark:border-slate-700/80">
              ※数値は保有一覧ベースです。評価は取得可能な最新終値、元本は登録済み約定です。株式・ファンドの実現損益は「売却を記録」に基づき、ロットは FIFO で自動減算されます。
            </p>
            </div>
          </div>
          <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 p-5 flex flex-col min-h-0 max-xl:h-auto xl:h-full">
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-500" /> 今後予定 / リスク
            </h3>
            <div className="mt-4 flex flex-col min-h-0 xl:flex-1 xl:min-h-0">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                <span className="text-slate-500">満期迫る（保険/ポイント）</span>
                <span className="inline-flex items-center gap-2">
                  {(expiringInsuranceCount + expiringPointCount) > 0 ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">優先</span> : null}
                  <span className="font-black text-slate-900 dark:text-white">{expiringInsuranceCount + expiringPointCount}件</span>
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                <span className="text-slate-500">価格未更新資産</span>
                <span className="inline-flex items-center gap-2">
                  {stalePriceRows.length > 0 ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">優先</span> : null}
                  <span className="font-black text-slate-900 dark:text-white">{stalePriceRows.length}件</span>
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                <span className="text-slate-500">価格データ最終更新日</span>
                <span className="font-black text-slate-900 dark:text-white">{latestTradeDate}</span>
              </div>
              <div className="relative rounded-xl border border-dashed border-slate-300/80 dark:border-slate-600/80 p-1">
                {!isPaidMember ? (
                  <button
                    type="button"
                    onClick={openPortfolioAlertsPremium}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-lg bg-white/75 dark:bg-slate-900/70 hover:bg-white/85 dark:hover:bg-slate-900/80 border border-slate-200/90 dark:border-slate-600/80 transition"
                  >
                    <Lock className="text-slate-800 dark:text-slate-100" size={22} aria-hidden />
                    <span className="text-[11px] font-black text-slate-900 dark:text-white">プレミアム限定</span>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">下落・上昇アラート設定</span>
                  </button>
                ) : null}
                <div className={`space-y-2 ${!isPaidMember ? 'pointer-events-none select-none opacity-50' : ''}`}>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <span className="text-slate-500">
                      ポートフォリオ下落アラート（{portfolioDropThresholdPct == null ? 'オフ' : `${portfolioDropThresholdPct}%`}）
                    </span>
                    <span className="inline-flex items-center gap-2">
                      {hasVisiblePortfolioDropAlert ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white">優先</span> : null}
                      <span className={`font-black ${hasVisiblePortfolioDropAlert ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                        {hasVisiblePortfolioDropAlert ? `${visiblePortfolioDropAlerts.length}件` : 'なし'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 gap-2">
                    <span className="text-slate-500 shrink-0">下落アラート閾値</span>
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {PORTFOLIO_DROP_ALERT_THRESHOLD_OPTIONS.map((opt) => {
                        const selected =
                          (opt.value === null && (portfolioDropThresholdPct === null || portfolioDropThresholdPct === undefined))
                          || (opt.value !== null && Number(portfolioDropThresholdPct) === Number(opt.value))
                        return (
                          <button
                            key={`portfolio-threshold-${opt.label}`}
                            type="button"
                            onClick={() => handlePortfolioThresholdChange(opt.value)}
                            className={`px-2 py-1 rounded-md text-[11px] font-black border transition ${
                              selected
                                ? 'bg-slate-900 text-white border-slate-900 dark:bg-orange-500 dark:border-orange-500'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-slate-500'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <span className="text-slate-500">
                      ポートフォリオ上昇アラート（{portfolioRiseThresholdPct == null ? 'オフ' : `+${portfolioRiseThresholdPct}%`}）
                    </span>
                    <span className="inline-flex items-center gap-2">
                      {hasVisiblePortfolioRiseAlert ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white">優先</span> : null}
                      <span className={`font-black ${hasVisiblePortfolioRiseAlert ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        {hasVisiblePortfolioRiseAlert ? `${visiblePortfolioRiseAlerts.length}件` : 'なし'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 gap-2">
                    <span className="text-slate-500 shrink-0">上昇アラート閾値</span>
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {PORTFOLIO_RISE_ALERT_THRESHOLD_OPTIONS.map((opt) => {
                        const selected =
                          (opt.value === null && (portfolioRiseThresholdPct === null || portfolioRiseThresholdPct === undefined))
                          || (opt.value !== null && Number(portfolioRiseThresholdPct) === Number(opt.value))
                        return (
                          <button
                            key={`portfolio-rise-threshold-${opt.label}`}
                            type="button"
                            onClick={() => handlePortfolioRiseThresholdChange(opt.value)}
                            className={`px-2 py-1 rounded-md text-[11px] font-black border transition ${
                              selected
                                ? 'bg-slate-900 text-white border-slate-900 dark:bg-red-600 dark:border-red-600'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-slate-500'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {isPaidMember ? (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      <span className="font-bold text-slate-600 dark:text-slate-300">アラートの見方: </span>
                      閾値（例: -3%）は、登録中の株・ファンドの<strong className="text-slate-600 dark:text-slate-300">合計評価額</strong>が、
                      <strong className="text-slate-600 dark:text-slate-300">前営業日</strong>の基準額、または<strong className="text-slate-600 dark:text-slate-300">約1週間前</strong>の基準額（いずれもその時点の終値ベース推計）に対して、
                      下がり幅 / 上がり幅が条件を満たしたときに出ます。条件を満たす<strong className="text-slate-600 dark:text-slate-300">前日比</strong>と<strong className="text-slate-600 dark:text-slate-300">前週比</strong>は別々に数えるため、
                      最大<strong className="text-slate-600 dark:text-slate-300">2件</strong>が同時に表示されることがあります。
                      左の<strong className="text-slate-600 dark:text-slate-300">構成比</strong>（目標配分の有無）は、この上下アラートとは別の表示です。
                    </p>
                  ) : null}
                  {(hasVisiblePortfolioDropAlert || hasVisiblePortfolioRiseAlert) ? (
                    <div className="mt-1 space-y-2">
                      {hasVisiblePortfolioDropAlert ? (
                        <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 px-3 py-2.5">
                          <p className="text-xs font-black text-rose-700 dark:text-rose-300">資産急落アラート</p>
                          <div className="mt-1.5 space-y-1">
                            {visiblePortfolioDropAlerts.map((row) => (
                              <p key={`portfolio-drop-alert-${row.key}`} className="text-[11px] text-rose-800 dark:text-rose-200 font-semibold leading-relaxed">
                                {row.label} {row.pct.toFixed(2)}%（基準日 {formatDateJpSlash(row.baseDate)} / 基準額 ¥{Math.round(Number(row.baseValue || 0)).toLocaleString('ja-JP')}）
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {hasVisiblePortfolioRiseAlert ? (
                        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5">
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">資産上昇アラート</p>
                          <div className="mt-1.5 space-y-1">
                            {visiblePortfolioRiseAlerts.map((row) => (
                              <p key={`portfolio-rise-alert-${row.key}`} className="text-[11px] text-emerald-800 dark:text-emerald-200 font-semibold leading-relaxed">
                                {row.label} +{row.pct.toFixed(2)}%（基準日 {formatDateJpSlash(row.baseDate)} / 基準額 ¥{Math.round(Number(row.baseValue || 0)).toLocaleString('ja-JP')}）
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={acknowledgePortfolioDropAlertToday}
                        className="text-[11px] font-black text-slate-600 dark:text-slate-300 underline underline-offset-2"
                      >
                        今日のポートフォリオアラートを既読にする
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="min-h-3 shrink-0 xl:flex-1" aria-hidden="true" />
            <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200/90 dark:border-slate-700/80">
              ※ 参考情報であり、投資判断の助言ではありません。
            </p>
            </div>
          </div>
        </div>
      )}

      {isStockTab && (
      <div id="mypage-stock-holdings" className="scroll-mt-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
            <div className="flex items-start justify-between gap-3">
              <h3 id="stock-performance-heading" className="font-black text-slate-900 dark:text-white shrink-0">株式パフォーマンス</h3>
              <button
                type="button"
                onClick={() => setStockTabHelpOpen(true)}
                className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-300 dark:hover:border-orange-500 transition-colors"
                aria-label="保有株式の入力方法を表示"
                aria-describedby="stock-performance-heading"
                title="入力のしかた"
              >
                <HelpCircle className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ウォッチリストとは別に、実際に買った銘柄を追加して損益率を管理できます。</p>
            {userId ? (
              <div
                className="mt-3 rounded-xl border-2 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 shadow-sm ring-1 ring-amber-200/80 dark:ring-amber-700/50"
                role="note"
              >
                <p className="text-[11px] sm:text-xs font-black text-amber-950 dark:text-amber-50 leading-relaxed">
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/90 dark:bg-amber-800/80 px-1.5 py-0.5 text-[10px] font-black text-amber-950 dark:text-amber-50">
                    自動連携
                  </span>
                  <span className="block sm:inline sm:ml-1 mt-1 sm:mt-0">
                    ここで保有株式を追加・編集すると、
                    <strong className="underline decoration-2 underline-offset-2 decoration-amber-700 dark:decoration-amber-300 mx-0.5">
                      配当カレンダー
                    </strong>
                    タブの同一銘柄の株数に自動で反映されます。
                  </span>
                </p>
                <p className="mt-1.5 text-[10px] font-semibold text-amber-900/90 dark:text-amber-100/90 leading-relaxed">
                  ※ 配当カレンダー側で銘柄を削除しても、この株式タブの保有行は残ります（別機能です）。
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                  ログインして保有を保存すると、入力した株数は<strong className="text-slate-800 dark:text-slate-100">配当カレンダー</strong>にも自動で連携されます。
                </p>
              </div>
            )}
            <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                例) 銘柄コード: `AAPL` または会社名: `Apple` / 買付日: `2026/01/15` / 保有数量: `10` または `12.345`（小数第3位まで） / 買付価格: `195.2` → 「保有銘柄を追加」
              </p>
            </div>
            <div className="mt-2 rounded-lg border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/25 px-3 py-2.5">
              <p className="text-[10px] font-bold text-indigo-900 dark:text-indigo-100 leading-relaxed">
                編集・削除・売却の違い
              </p>
              <ul className="mt-1.5 space-y-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 leading-relaxed list-disc pl-4">
                <li>
                  <span className="text-slate-800 dark:text-slate-200">フィールドの編集</span>
                  （数量・買付価格・買付日）: 内容が保存され、含み損益・損益率・評価額に直ちに反映されます。ログイン中はクラウドにも同期されます。
                </li>
                <li>
                  <span className="text-slate-800 dark:text-slate-200">取引（ロット）の削除</span>
                  : 誤って追加した1行を消すだけです。売却記録ではないため、
                  <span className="font-black text-slate-900 dark:text-white">実現損益の集計や売却履歴には影響しません</span>。
                </li>
                <li>
                  <span className="text-slate-800 dark:text-slate-200">売却を記録</span>
                  : 実際に売却したときに使います。FIFOで原価を消化し、実現損益に計上されます。
                </li>
              </ul>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[2.2fr_1.1fr_1fr_1fr_auto] gap-3 md:gap-2 xl:items-end">
              {/*
                Enter key should submit from any input to make quick entry possible.
              */}
              {(() => {
                const submitOwnedStock = async () => {
                  const ok = await onAddOwnedStock?.({
                    symbol: newOwnedSymbol,
                    buyDate: newOwnedBuyDate,
                    buyPrice: newOwnedBuyPrice,
                    qty: newOwnedQty,
                    currency: newOwnedCurrency,
                  })
                  if (ok) {
                    setNewOwnedSymbol('')
                    setNewOwnedBuyDate('')
                    setNewOwnedBuyPrice('')
                    setNewOwnedQty('')
                    setNewOwnedCurrency('USD')
                    setNewOwnedCurrencyTouched(false)
                    setOwnedSymbolOptions([])
                    setStockSuggestOpen(false)
                    setStockSuggestIndex(-1)
                  }
                }
                const onInputKeyDown = async (e) => {
                  if (e.key === 'ArrowDown') {
                    if (ownedSymbolOptions.length === 0) return
                    e.preventDefault()
                    setStockSuggestOpen(true)
                    setStockSuggestIndex((prev) => {
                      const next = prev + 1
                      return next >= ownedSymbolOptions.length ? 0 : next
                    })
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    if (ownedSymbolOptions.length === 0) return
                    e.preventDefault()
                    setStockSuggestOpen(true)
                    setStockSuggestIndex((prev) => {
                      if (prev <= 0) return ownedSymbolOptions.length - 1
                      return prev - 1
                    })
                    return
                  }
                  if (e.key === 'Escape') {
                    setStockSuggestOpen(false)
                    setStockSuggestIndex(-1)
                    return
                  }
                  if (e.key !== 'Enter') return
                  if (stockSuggestOpen && stockSuggestIndex >= 0 && stockSuggestIndex < ownedSymbolOptions.length) {
                    e.preventDefault()
                    const picked = ownedSymbolOptions[stockSuggestIndex]
                    if (picked?.symbol) setNewOwnedSymbol(picked.symbol)
                    setStockSuggestOpen(false)
                    setStockSuggestIndex(-1)
                    return
                  }
                  e.preventDefault()
                  await submitOwnedStock()
                }
                return (
                  <>
              <div className="relative md:col-span-2 xl:col-span-1">
                <span className={ownedMobileFieldLabelClass}>銘柄コード / 会社名</span>
                <input
                  type="text"
                  value={newOwnedSymbol}
                  onChange={(e) => {
                    setNewOwnedSymbol(e.target.value)
                    setStockSuggestOpen(true)
                    setStockSuggestIndex(-1)
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setStockSuggestOpen(false)
                      setStockSuggestIndex(-1)
                    }, 120)
                  }}
                  onKeyDown={onInputKeyDown}
                  placeholder="銘柄コード/会社名 (例: AAPL, Apple, トヨタ)"
                  className={ownedFieldInputClass}
                />
                {stockSuggestOpen && ownedSymbolOptions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                    {ownedSymbolOptions.slice(0, 20).map((item, idx) => (
                      <button
                        key={`owned-stock-suggest-menu-${item.symbol}-${idx}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setNewOwnedSymbol(item.symbol)
                          setStockSuggestOpen(false)
                          setStockSuggestIndex(-1)
                        }}
                        className={`w-full text-left px-3 py-2 text-xs border-b last:border-b-0 border-slate-100 dark:border-slate-800 border-l-2 transition-colors ${
                          stockSuggestIndex === idx
                            ? 'bg-orange-100 dark:bg-orange-950/45 border-l-orange-500 font-semibold'
                            : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <span className="font-black text-slate-800 dark:text-slate-100">{item.name || item.symbol}</span>
                        <span className="ml-1 text-slate-500 dark:text-slate-400">({item.symbol})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {ownedSymbolOptions.length > 0 && (
                <div className="md:col-span-2 xl:col-span-5 -mt-1 flex flex-wrap gap-2 sm:gap-1.5 max-h-[7.5rem] overflow-y-auto">
                  {ownedSymbolOptions.slice(0, 8).map((item, chipIdx) => {
                    const symU = String(item.symbol || '').toUpperCase().trim()
                    const inputU = String(newOwnedSymbol || '').toUpperCase().trim()
                    const isChosen = symU.length > 0 && symU === inputU
                    const isKbHighlight = stockSuggestOpen && stockSuggestIndex === chipIdx
                    const chipActive = isChosen || isKbHighlight
                    return (
                    <button
                      key={`owned-suggest-chip-${item.symbol}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setNewOwnedSymbol(item.symbol)
                        setStockSuggestOpen(false)
                        setStockSuggestIndex(-1)
                      }}
                      className={`min-h-[40px] sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1 rounded-full border text-xs sm:text-[11px] font-bold transition-colors ${
                        chipActive
                          ? 'border-orange-500 bg-orange-100 dark:bg-orange-950/55 dark:border-orange-400 text-orange-950 dark:text-orange-100 shadow-sm ring-2 ring-orange-400/35 dark:ring-orange-500/25'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-600/60'
                      }`}
                    >
                      {item.name || item.symbol} ({item.symbol})
                    </button>
                    )
                  })}
                </div>
              )}
              <div>
                <span className={ownedMobileFieldLabelClass}>買付日</span>
                <OwnedBuyDateTextInput
                  value={newOwnedBuyDate}
                  onCommit={(iso) => setNewOwnedBuyDate(iso)}
                  onKeyDown={onInputKeyDown}
                  className={`${ownedFieldInputClass} tabular-nums`}
                />
              </div>
              <div>
                <span className={ownedMobileFieldLabelClass}>保有数量</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newOwnedQty}
                  onChange={(e) => setNewOwnedQty(sanitizeStockShareQtyInput(e.target.value))}
                  onKeyDown={onInputKeyDown}
                  placeholder="例: 100 / 12.345"
                  className={ownedFieldInputRightClass}
                />
              </div>
              <div>
                <span className={ownedMobileFieldLabelClass}>1株あたり取得価格 ({newOwnedCurrency})</span>
                <div className="flex gap-1">
                  <select
                    value={newOwnedCurrency}
                    onChange={(e) => {
                      setNewOwnedCurrencyTouched(true)
                      setNewOwnedCurrency(e.target.value === 'JPY' ? 'JPY' : 'USD')
                    }}
                    className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-bold text-slate-700 dark:text-slate-200"
                    aria-label="取得価格の通貨"
                  >
                    <option value="USD">USD</option>
                    <option value="JPY">JPY</option>
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newOwnedBuyPrice}
                    onChange={(e) => setNewOwnedBuyPrice(sanitizeDecimalInput(e.target.value))}
                    onKeyDown={onInputKeyDown}
                    placeholder={newOwnedCurrency === 'USD' ? '例: 195.2' : '例: 3500'}
                    className={ownedFieldInputRightClass}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={submitOwnedStock}
                className="w-full md:col-span-2 xl:col-span-1 min-h-[48px] xl:min-h-0 px-4 py-3 xl:px-3 xl:py-2 rounded-xl xl:rounded-lg bg-slate-900 dark:bg-orange-500 text-white text-sm xl:text-xs font-black hover:opacity-90 whitespace-nowrap"
              >
                保有銘柄を追加
              </button>
                  </>
                )
              })()}
            </div>
          </div>
          <p className="lg:hidden px-4 pt-3 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 leading-snug">
            スマホではカードで縦スクロールのみ。表は横幅のある画面（PC）で表示されます。
          </p>
          <div className="lg:hidden px-3 pb-3 space-y-3">
            {groupedOwnedStocks.length === 0 ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">保有銘柄がまだありません。上のフォームから追加してください。</p>
            ) : (
              groupedOwnedStocks.map((stock) => {
                const avgBuyPrice = stock.totalQty > 0 ? (stock.totalCost / stock.totalQty) : 0
                const isExpanded = Boolean(expandedSymbols[stock.symbol])
                const symReal = realizedPnlBySymbol.get(stock.symbol) || 0
                return (
                  <div key={`m-owned-stock-${stock.symbol}`} className={ownedPortfolioMobileCardClass}>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-[15px] leading-snug">{stock.name || stock.code}</p>
                      <span className={`${ownedPortfolioTickerPillClass} mt-0.5`}>{stock.code}</span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-sm">
                      <dt className="text-slate-500 text-[11px] font-semibold">セクター</dt>
                      <dd className="text-right font-bold text-violet-700 dark:text-violet-300 text-xs sm:text-sm">{sectorForOwnedStockPie(stock)}</dd>
                      <dt className="text-slate-500 text-[11px] font-semibold">取引数</dt>
                      <dd className="text-right font-semibold tabular-nums">{stock.lots.length}</dd>
                      <dt className="text-slate-500 text-[11px] font-semibold">保有数量</dt>
                      <dd className="text-right font-semibold tabular-nums">{stock.totalQty.toLocaleString('ja-JP')}</dd>
                      <dt className="text-slate-500 text-[11px] font-semibold">平均買付</dt>
                      <dd className="text-right font-semibold tabular-nums">{stock.totalQty > 0 ? avgBuyPrice.toFixed(2) : '--'}</dd>
                      <dt className="text-slate-500 text-[11px] font-semibold">最新価格</dt>
                      <dd className="text-right font-semibold tabular-nums">{Number(stock.price || 0) > 0 ? Number(stock.price).toLocaleString('ja-JP') : '--'}</dd>
                      <dt className="text-slate-500 text-[11px] font-semibold">現在価値</dt>
                      <dd className="text-right font-bold tabular-nums whitespace-nowrap min-w-0">{stock.currentValueJpy > 0 ? `¥${Math.round(stock.currentValueJpy).toLocaleString('ja-JP')}` : '--'}</dd>
                      <dt className="text-slate-500 text-[11px] font-semibold">損益率</dt>
                      <dd className={`text-right font-black tabular-nums whitespace-nowrap ${stock.pnlRate == null ? 'text-slate-400' : stock.pnlRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {stock.pnlRate == null ? '--' : `${stock.pnlRate >= 0 ? '+' : ''}${stock.pnlRate.toFixed(2)}%`}
                        {stock.pricePnlJpy != null ? (
                          <span className="mt-1 block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            株価 {formatSignedYen(stock.pricePnlJpy)} / 為替 {formatSignedYen(stock.fxPnlJpy)}
                          </span>
                        ) : null}
                      </dd>
                      {symReal !== 0 ? (
                        <>
                          <dt className="text-slate-500 text-[11px] font-semibold">実現累計</dt>
                          <dd className={`text-right font-black tabular-nums whitespace-nowrap ${symReal >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {symReal >= 0 ? '+' : ''}¥{Math.round(symReal).toLocaleString('ja-JP')}
                          </dd>
                        </>
                      ) : null}
                    </dl>
                    {stock.tradeDate ? (
                      <p className="text-[10px] text-slate-400">価格基準日: {formatDateJpSlash(stock.tradeDate)}</p>
                    ) : null}
                    <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedSymbols((prev) => ({ ...prev, [stock.symbol]: !prev[stock.symbol] }))}
                        className="flex-1 min-w-0 min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        {isExpanded ? '取引を隠す' : '取引を表示・編集'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isPaidMember) {
                            if (typeof onUiMessage === 'function') onUiMessage('平均取得単価計算の詳細シミュレーションはプレミアム限定です。', 'premium')
                            navigate('/premium')
                            return
                          }
                          const avgBuyPrice = stock.totalQty > 0 ? (stock.totalCost / stock.totalQty) : 0
                          const currentPrice = Math.max(0, Number(stock.price || 0))
                          setAvgDownSelectedStock({
                            symbol: stock.symbol,
                            name: stock.name || stock.code || stock.symbol,
                            currency: stock.stockCurrency || inferStockCurrency(stock.symbol),
                            avgBuyPrice,
                            currentPrice,
                            currentQty: Number(stock.totalQty || 0),
                          })
                          setAvgDownMode('target')
                          setAvgDownTargetPriceInput(getAvgDownDefaultTargetPriceInput(avgBuyPrice, currentPrice))
                          setAvgDownAddQtyInput(String(Math.max(1, Math.ceil(Number(stock.totalQty || 0) * 0.1))))
                          setAvgDownModalOpen(true)
                        }}
                        className="flex-1 min-w-0 min-h-[44px] rounded-lg border border-orange-300 dark:border-orange-700 text-sm font-black text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                      >
                        平均取得単価計算
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={Number(stock.totalQty || 0) <= 0}
                      onClick={() => openStockSellModal(stock)}
                      className="w-full min-h-[44px] rounded-lg border border-indigo-300 dark:border-indigo-700 text-sm font-black text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-45 disabled:pointer-events-none"
                    >
                      売却を記録（実現損益）
                    </button>
                    </div>
                    {isExpanded && stock.lots.map((lot) => {
                      const lotQty = Math.max(0, Number(lot.qty || 0))
                      const lotBuyPrice = Math.max(0, Number(lot.buyPrice || 0))
                      const lotPnlRate = stockLotPnlRate(lot, stock, lotQty, lotBuyPrice, fxRatesByDate, valuationUsdJpy)
                      return (
                        <div key={`m-stock-lot-${lot.lotId}`} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-2">
                          <p className="text-xs font-black text-slate-600 dark:text-slate-300">取引</p>
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">保有数量</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={getDraftFieldValue(ownedStockDrafts, lot.lotId, 'qty', lot.qty ?? '')}
                              onChange={(e) => setDraftFieldValue(setOwnedStockDrafts, lot.lotId, 'qty', sanitizeStockShareQtyInput(e.target.value))}
                              onBlur={() => commitOwnedStockDraftField(lot.lotId, 'qty', lot.qty ?? '')}
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter') return
                                e.preventDefault()
                                commitOwnedStockDraftField(lot.lotId, 'qty', lot.qty ?? '')
                                e.currentTarget.blur()
                              }}
                              className={`${ownedFieldInputRightClass} w-full max-w-none mt-1`}
                            />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">買付価格</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={getDraftFieldValue(ownedStockDrafts, lot.lotId, 'buyPrice', lot.buyPrice ?? '')}
                              onChange={(e) => setDraftFieldValue(setOwnedStockDrafts, lot.lotId, 'buyPrice', sanitizeDecimalInput(e.target.value))}
                              onBlur={() => commitOwnedStockDraftField(lot.lotId, 'buyPrice', lot.buyPrice ?? '')}
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter') return
                                e.preventDefault()
                                commitOwnedStockDraftField(lot.lotId, 'buyPrice', lot.buyPrice ?? '')
                                e.currentTarget.blur()
                              }}
                              className={`${ownedFieldInputRightClass} w-full max-w-none mt-1`}
                            />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">買付日</span>
                            <OwnedBuyDateTextInput
                              value={lot.buyDate || ''}
                              onCommit={(iso) => onUpdateOwnedStock?.(lot.lotId, { buyDate: iso })}
                              className={`${ownedFieldInputClass} w-full max-w-none mt-1 tabular-nums`}
                            />
                          </div>
                          <p className={`text-xs font-black tabular-nums ${lotPnlRate == null ? 'text-slate-400' : lotPnlRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            取引損益率 {lotPnlRate == null ? '--' : `${lotPnlRate >= 0 ? '+' : ''}${lotPnlRate.toFixed(2)}%`}
                          </p>
                          <div className="pt-1 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => onLoadOwnedStockPrice?.(lot.lotId, stock.symbol, lot.buyDate)}
                              className="min-h-[44px] w-full rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300"
                            >
                              終値反映
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm(CONFIRM_DELETE_OWNED_LOT_JA)) return
                                onRemoveOwnedStock?.(lot.lotId)
                              }}
                              className="min-h-[44px] w-full rounded-lg border border-red-200 dark:border-red-800 text-sm font-bold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              取引を削除
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
            {groupedOwnedStocks.length > 0 && (
              <div className={ownedPortfolioMobileTotalsClass}>
                <div className="flex justify-between gap-3 font-bold text-slate-700 dark:text-slate-300">
                  <span>投資元本合計（円換算）</span>
                  <span className="tabular-nums shrink-0">¥{Math.round(stockTotalInvestedJpy).toLocaleString('ja-JP')}</span>
                </div>
                <div className="flex justify-between gap-3 font-black text-indigo-900 dark:text-indigo-200">
                  <span>現在評価額合計</span>
                  <span className="tabular-nums shrink-0">¥{Math.round(stockTotalCurrentJpy).toLocaleString('ja-JP')}</span>
                </div>
              </div>
            )}
          </div>
          <div className={ownedPortfolioTableScrollWrapClass}>
            <table className={`${ownedPortfolioTableBaseClass} min-w-[1180px] xl:min-w-[1260px]`}>
              <thead>
                <tr className={`text-left ${ownedPortfolioTheadRowClass}`}>
                  <th className={`${ownedPortfolioThBaseClass} text-left max-w-[14rem] xl:max-w-[18rem]`}>会社名</th>
                  <th className={`${ownedPortfolioThBaseClass} text-left whitespace-nowrap`}>セクター</th>
                  <th className={`${ownedPortfolioThBaseClass} text-right`}>取引数</th>
                  <th className={`${ownedPortfolioThBaseClass} text-right`}>総保有数量</th>
                  <th className={`${ownedPortfolioThBaseClass} text-right`}>平均買付価格</th>
                  <th className={`${ownedPortfolioThBaseClass} text-right`}>最新価格</th>
                  <th className={`${ownedPortfolioThBaseClass} text-right`}>現在価値(円)</th>
                  <th className={`${ownedPortfolioThBaseClass} text-right`}>合算損益率</th>
                  <th className={`${ownedPortfolioThBaseClass} text-right`}>管理</th>
                </tr>
              </thead>
              <tbody>
                {groupedOwnedStocks.length === 0 && (
                  <tr className="border-t border-slate-100 dark:border-slate-800">
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      保有銘柄がまだありません。上のフォームから追加してください。
                    </td>
                  </tr>
                )}
                {groupedOwnedStocks.map((stock) => {
                  const avgBuyPrice = stock.totalQty > 0 ? (stock.totalCost / stock.totalQty) : 0
                  const isExpanded = Boolean(expandedSymbols[stock.symbol])
                  const symReal = realizedPnlBySymbol.get(stock.symbol) || 0
                  return (
                    <Fragment key={`wealth-stock-group-${stock.symbol}`}>
                      <tr key={`wealth-stock-summary-${stock.symbol}`} className={ownedPortfolioTbodyRowClass}>
                        <td className={ownedPortfolioNameCellClass}>
                          <p className="font-bold text-slate-900 dark:text-slate-50 text-[15px] lg:text-sm break-words leading-snug">{stock.name || stock.code}</p>
                          <span className={`${ownedPortfolioTickerPillClass} break-all`}>{stock.code}</span>
                        </td>
                        <td className="px-3 py-4 sm:px-5 align-top whitespace-nowrap max-w-[7.5rem]">
                          <span className="inline-flex items-center rounded-lg border border-violet-200/80 dark:border-violet-900/50 bg-violet-50/80 dark:bg-violet-950/30 px-2 py-1 text-[11px] sm:text-xs font-bold text-violet-800 dark:text-violet-200">
                            {sectorForOwnedStockPie(stock)}
                          </span>
                        </td>
                        <td className="px-3 py-4 sm:px-5 text-right font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{stock.lots.length}</td>
                        <td className="px-3 py-4 sm:px-5 text-right font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{stock.totalQty.toLocaleString('ja-JP')}</td>
                        <td className="px-3 py-4 sm:px-5 text-right font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {stock.totalQty > 0 ? avgBuyPrice.toFixed(2) : '--'}
                        </td>
                        <td className="px-3 py-4 sm:px-5 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {Number(stock.price || 0) > 0 ? Number(stock.price).toLocaleString('ja-JP') : '--'}
                          <p className="text-xs lg:text-[11px] text-slate-400 whitespace-normal">{stock.tradeDate ? formatDateJpSlash(stock.tradeDate) : ''}</p>
                        </td>
                        <td className="px-3 py-4 sm:px-5 text-right font-black text-indigo-900 dark:text-indigo-200 text-[15px] lg:text-sm whitespace-nowrap">
                          {stock.currentValueJpy > 0 ? `¥${Math.round(stock.currentValueJpy).toLocaleString('ja-JP')}` : '--'}
                        </td>
                        <td className={`px-3 py-4 sm:px-5 text-right font-black text-[15px] lg:text-sm whitespace-nowrap tabular-nums ${stock.pnlRate == null ? 'text-slate-400' : stock.pnlRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {stock.pnlRate == null ? '--' : `${stock.pnlRate >= 0 ? '+' : ''}${stock.pnlRate.toFixed(2)}%`}
                          {stock.pricePnlJpy != null ? (
                            <span className="mt-1 block text-[10px] lg:text-[9px] font-bold text-slate-500 dark:text-slate-400">
                              株価 {formatSignedYen(stock.pricePnlJpy)} / 為替 {formatSignedYen(stock.fxPnlJpy)}
                            </span>
                          ) : null}
                          {symReal !== 0 ? (
                            <span className={`mt-1 block text-[10px] lg:text-[9px] font-bold tabular-nums ${symReal >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              実現累計 {symReal >= 0 ? '+' : ''}¥{Math.round(symReal).toLocaleString('ja-JP')}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-4 sm:px-5 text-right whitespace-nowrap align-middle">
                          <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedSymbols((prev) => ({ ...prev, [stock.symbol]: !prev[stock.symbol] }))}
                              className="min-h-[44px] lg:min-h-0 shrink-0 px-3 py-2.5 lg:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm lg:text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-orange-400"
                            >
                              {isExpanded ? '取引を隠す' : '取引を表示'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isPaidMember) {
                                  if (typeof onUiMessage === 'function') onUiMessage('平均取得単価計算の詳細シミュレーションはプレミアム限定です。', 'premium')
                                  navigate('/premium')
                                  return
                                }
                                const avgBuyPrice = stock.totalQty > 0 ? (stock.totalCost / stock.totalQty) : 0
                                const currentPrice = Math.max(0, Number(stock.price || 0))
                                setAvgDownSelectedStock({
                                  symbol: stock.symbol,
                                  name: stock.name || stock.code || stock.symbol,
                                  currency: stock.stockCurrency || inferStockCurrency(stock.symbol),
                                  avgBuyPrice,
                                  currentPrice,
                                  currentQty: Number(stock.totalQty || 0),
                                })
                                setAvgDownMode('target')
                                setAvgDownTargetPriceInput(getAvgDownDefaultTargetPriceInput(avgBuyPrice, currentPrice))
                                setAvgDownAddQtyInput(String(Math.max(1, Math.ceil(Number(stock.totalQty || 0) * 0.1))))
                                setAvgDownModalOpen(true)
                              }}
                              className="min-h-[44px] lg:min-h-0 shrink-0 px-3 py-2.5 lg:py-1.5 rounded-lg border border-orange-300 dark:border-orange-700 text-sm lg:text-xs font-black text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                            >
                              平均取得単価計算
                            </button>
                            <button
                              type="button"
                              disabled={Number(stock.totalQty || 0) <= 0}
                              onClick={() => openStockSellModal(stock)}
                              className="min-h-[44px] lg:min-h-0 shrink-0 px-3 py-2.5 lg:py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-sm lg:text-xs font-black text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/25 disabled:opacity-45 disabled:pointer-events-none"
                            >
                              売却記録
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && stock.lots.map((lot) => {
                        const lotQty = Math.max(0, Number(lot.qty || 0))
                        const lotBuyPrice = Math.max(0, Number(lot.buyPrice || 0))
                        const lotPnlRate = stockLotPnlRate(lot, stock, lotQty, lotBuyPrice, fxRatesByDate, valuationUsdJpy)
                        return (
                          <tr key={`wealth-stock-lot-${lot.lotId}`} className={ownedPortfolioLotRowClass}>
                            <td className="px-3 py-3 sm:px-5 text-sm lg:text-xs text-slate-500 dark:text-slate-400 align-top min-w-0 max-w-[14rem] xl:max-w-[18rem]">└ 取引</td>
                            <td className="px-3 py-3 sm:px-5 text-sm lg:text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">—</td>
                            <td className="px-3 py-3 sm:px-5 text-right text-sm lg:text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">-</td>
                            <td className="px-3 py-3 sm:px-5 text-right whitespace-nowrap">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={getDraftFieldValue(ownedStockDrafts, lot.lotId, 'qty', lot.qty ?? '')}
                                onChange={(e) => setDraftFieldValue(setOwnedStockDrafts, lot.lotId, 'qty', sanitizeStockShareQtyInput(e.target.value))}
                                onBlur={() => commitOwnedStockDraftField(lot.lotId, 'qty', lot.qty ?? '')}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return
                                  e.preventDefault()
                                  commitOwnedStockDraftField(lot.lotId, 'qty', lot.qty ?? '')
                                  e.currentTarget.blur()
                                }}
                                className={`${ownedFieldInputRightClass} max-w-full sm:max-w-[110px] ml-auto`}
                              />
                            </td>
                            <td className="px-3 py-3 sm:px-5 text-right whitespace-nowrap">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={getDraftFieldValue(ownedStockDrafts, lot.lotId, 'buyPrice', lot.buyPrice ?? '')}
                                onChange={(e) => setDraftFieldValue(setOwnedStockDrafts, lot.lotId, 'buyPrice', sanitizeDecimalInput(e.target.value))}
                                onBlur={() => commitOwnedStockDraftField(lot.lotId, 'buyPrice', lot.buyPrice ?? '')}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return
                                  e.preventDefault()
                                  commitOwnedStockDraftField(lot.lotId, 'buyPrice', lot.buyPrice ?? '')
                                  e.currentTarget.blur()
                                }}
                                className={`${ownedFieldInputRightClass} max-w-full sm:max-w-[130px] ml-auto`}
                              />
                            </td>
                            <td className="px-3 py-3 sm:px-5 text-right min-w-[10rem]">
                              <OwnedBuyDateTextInput
                                value={lot.buyDate || ''}
                                onCommit={(iso) => onUpdateOwnedStock?.(lot.lotId, { buyDate: iso })}
                                className={`${ownedFieldInputClass} max-w-full sm:max-w-[160px] ml-auto tabular-nums`}
                              />
                            </td>
                            <td className="px-3 py-3 sm:px-5 text-right text-sm lg:text-xs text-slate-400 whitespace-nowrap">—</td>
                            <td className={`px-3 py-3 sm:px-5 text-right font-black text-sm lg:text-xs whitespace-nowrap tabular-nums ${lotPnlRate == null ? 'text-slate-400' : lotPnlRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              {lotPnlRate == null ? '--' : `${lotPnlRate >= 0 ? '+' : ''}${lotPnlRate.toFixed(2)}%`}
                            </td>
                            <td className="px-3 py-3 sm:px-5 text-right whitespace-nowrap">
                              <div className="flex flex-col gap-1.5 items-end">
                                <button
                                  type="button"
                                  onClick={() => onLoadOwnedStockPrice?.(lot.lotId, stock.symbol, lot.buyDate)}
                                  className="min-h-[44px] sm:min-h-0 px-3 py-2.5 sm:px-2 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-sm sm:text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-orange-400"
                                >
                                  終値反映
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!window.confirm(CONFIRM_DELETE_OWNED_LOT_JA)) return
                                    onRemoveOwnedStock?.(lot.lotId)
                                  }}
                                  className="min-h-[44px] sm:min-h-0 px-3 py-2.5 sm:px-2 sm:py-1 rounded-lg border border-red-200 dark:border-red-800 text-sm sm:text-[11px] font-bold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  取引削除
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot className={ownedPortfolioTfootClass}>
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 sm:px-5 sm:py-2 text-right font-bold text-slate-700 dark:text-slate-300 text-sm lg:text-xs">投資元本合計（円換算）</td>
                  <td className="px-3 py-2.5 sm:px-5 sm:py-2 text-right font-bold text-slate-900 dark:text-slate-100 text-[15px] lg:text-sm whitespace-nowrap tabular-nums">¥{Math.round(stockTotalInvestedJpy).toLocaleString('ja-JP')}</td>
                  <td className="px-3 sm:px-5 py-2" />
                  <td className="px-3 sm:px-5 py-2" />
                </tr>
                <tr>
                  <td colSpan={6} className="px-3 py-3.5 sm:px-5 sm:py-3 text-right font-black text-slate-800 dark:text-slate-100 text-sm lg:text-xs">現在評価額合計</td>
                  <td className="px-3 py-3.5 sm:px-5 sm:py-3 text-right font-black text-indigo-900 dark:text-indigo-200 text-[15px] lg:text-sm whitespace-nowrap tabular-nums">¥{Math.round(stockTotalCurrentJpy).toLocaleString('ja-JP')}</td>
                  <td className="px-3 sm:px-5 py-3" />
                  <td className="px-3 sm:px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="px-4 sm:px-5 py-3 text-xs sm:text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
            ※ 買付日を入力後「終値反映」を押すと、その日付以前の直近終値を買付価格として自動入力します（買付日そのものは変更しません。DBに当日行が無い場合は直近の取引日行の終値になり、ステータスに注意が出ます）。
            <span className="block mt-2">
              数量・買付価格・買付日の編集は保存され、損益率に反映されます。誤追加した取引は各行から削除できます（
              <span className="font-bold text-slate-700 dark:text-slate-200">削除は売却記録ではなく実現損益に影響しません</span>
              ）。実売却で减少させる場合は「売却を記録（実現損益）」を使ってください。
            </span>
          </p>
      </div>
      )}

      {isStockTab && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">株式ウォッチリスト</h3>
          </div>
          <div className="p-5">
            {stockWatchlistItems.length === 0 ? (
              <div className="text-base text-slate-500 dark:text-slate-400 space-y-3">
                <p>株式ウォッチリストがありません。</p>
                <button
                  type="button"
                  onClick={() => navigate('/stocks')}
                  className="inline-flex rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-sm font-black text-orange-700 dark:text-orange-300"
                >
                  株式ページで追加
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stockWatchlistItems.map((stock) => (
                  <div key={`stock-watch-bottom-${stock.id}`} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-slate-900 dark:text-white">{stock.name || stock.code}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{stock.code}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {Number(stock.price || 0) > 0 ? `¥${Math.round(Number(stock.price || 0)).toLocaleString('ja-JP')}` : '--'}
                          </span>
                          <span className={`font-black tabular-nums ${Number(stock.rate || 0) >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {Number.isFinite(Number(stock.rate)) ? `${Number(stock.rate || 0) >= 0 ? '+' : ''}${Number(stock.rate || 0).toFixed(2)}%` : '--'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/stocks?symbol=${encodeURIComponent(String(stock.id || ''))}`)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-orange-400"
                        >
                          株式ページ
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveStockWatchlist?.(stock.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {stockTabHelpOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4 bg-black/45 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => setStockTabHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-tab-help-title"
            className="relative w-full max-w-lg max-h-[min(85vh,720px)] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-xl shadow-slate-900/20 dark:shadow-black/40 p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setStockTabHelpOpen(false)}
              className="absolute top-3 right-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition"
              aria-label="閉じる"
            >
              <X size={20} aria-hidden />
            </button>
            <h2 id="stock-tab-help-title" className="text-base font-black text-slate-900 dark:text-white pr-10 leading-snug">
              保有株式の登録のしかた
            </h2>
            <ol className="mt-3 space-y-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-relaxed list-decimal pl-4 marker:font-black marker:text-orange-700 dark:marker:text-orange-300">
              <li>
                <span className="text-slate-900 dark:text-white">銘柄</span>
                ：下の「銘柄コード／会社名」に入力すると候補が出ます。
                <strong className="font-black text-slate-900 dark:text-white">一覧からタップして確定</strong>
                するか、正しいコード（例: <span className="font-mono text-[10px]">7203</span>、<span className="font-mono text-[10px]">AAPL</span>）をそのまま入れてください。
              </li>
              <li>
                <span className="text-slate-900 dark:text-white">保有数量</span>
                ：今もっている株数（株の単位）。端株は小数で入力できます（小数第3位まで）。
              </li>
              <li>
                <span className="text-slate-900 dark:text-white">買付価格</span>
                ：そのロットの
                <strong className="font-black text-slate-900 dark:text-white">1株あたり取得価格</strong>
                。単位は入力欄の USD / JPY です。米国ティッカーの初期値は USD、日本株・日本上場ETFは JPY です。
              </li>
              <li>
                <span className="text-slate-900 dark:text-white">買付日</span>
                ：その買い付けに対応する日付（忘れた場合はおおよその日付でも構いません）。
              </li>
            </ol>
            <p className="mt-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
              入力できたら右端の
              <span className="text-slate-900 dark:text-white">「保有銘柄を追加」</span>
              を押してください。キーボードの Enter でも送信できます。
            </p>
            <button
              type="button"
              onClick={() => setStockTabHelpOpen(false)}
              className="mt-4 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-sm font-black hover:opacity-90"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}

      {fundTabHelpOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4 bg-black/45 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => setFundTabHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fund-tab-help-title"
            className="relative w-full max-w-lg max-h-[min(85vh,720px)] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-xl shadow-slate-900/20 dark:shadow-black/40 p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFundTabHelpOpen(false)}
              className="absolute top-3 right-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition"
              aria-label="閉じる"
            >
              <X size={20} aria-hidden />
            </button>
            <h2 id="fund-tab-help-title" className="text-base font-black text-slate-900 dark:text-white pr-10 leading-snug">
              保有ファンドの登録のしかた
            </h2>
            <ol className="mt-3 space-y-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-relaxed list-decimal pl-4 marker:font-black marker:text-orange-700 dark:marker:text-orange-300">
              <li>
                <span className="text-slate-900 dark:text-white">ファンドコード／名称</span>
                ：「ファンドコード／名称」に入力すると候補が出ます。
                <strong className="font-black text-slate-900 dark:text-white">一覧からタップして確定</strong>
                するか、正しいコード（例: <span className="font-mono text-[10px]">2558.T</span>）をそのまま入れてください。
              </li>
              <li>
                <span className="text-slate-900 dark:text-white">投資元本</span>
                ：その取引に対応する投資元本（円）。
              </li>
              <li>
                <span className="text-slate-900 dark:text-white">買付日</span>
                ：その買い付けに対応する日付（忘れた場合はおおよその日付でも構いません）。
              </li>
              <li>
                <span className="text-slate-900 dark:text-white">買付価格（基準価格）</span>
                ：その時点の基準価格（ナビなど、銘柄により単位が異なる場合があります）。
              </li>
            </ol>
            <p className="mt-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
              例) ファンドコード: <span className="font-mono text-[10px] text-slate-800 dark:text-slate-200">2558.T</span>
              {' '}/ 投資元本: <span className="font-mono text-[10px] text-slate-800 dark:text-slate-200">10000000</span>
              {' '}/ 買付日: <span className="font-mono text-[10px] text-slate-800 dark:text-slate-200">2026/01/15</span>
              {' '}/ 買付価格: <span className="font-mono text-[10px] text-slate-800 dark:text-slate-200">300000</span>
              {' '}→ <span className="text-slate-900 dark:text-white">「保有ファンドを追加」</span>
            </p>
            <p className="mt-3 text-[10px] font-bold text-indigo-900 dark:text-indigo-100 leading-relaxed">
              編集・削除・売却の違い
            </p>
            <ul className="mt-1.5 space-y-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 leading-relaxed list-disc pl-4">
              <li>
                <span className="text-slate-800 dark:text-slate-200">数量・買付価格・買付日の編集</span>
                は保存され、損益率・評価額に直ちに反映されます（ログイン中はクラウド同期）。
              </li>
              <li>
                <span className="text-slate-800 dark:text-slate-200">取引行の削除</span>
                は誤入力の取り消しです。売却記録ではないため、
                <span className="font-black text-slate-900 dark:text-white">実現損益には影響しません</span>
                。実売却は銘柄の「売却を記録（実現損益）」を使ってください。
              </li>
            </ul>
            <p className="mt-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
              入力できたら
              <span className="text-slate-900 dark:text-white">「保有ファンドを追加」</span>
              を押してください。キーボードの Enter でも送信できます。
            </p>
            <button
              type="button"
              onClick={() => setFundTabHelpOpen(false)}
              className="mt-4 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-sm font-black hover:opacity-90"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}

    </div>
  )
}

const EXPENSE_LEDGER_PAGE_SIZE = 10

/** 家計「最近の支出」ページ番号用（ギャップは … 表示） */
const buildExpenseLedgerPageList = (current, total) => {
  const t = Math.max(1, Math.floor(Number(total) || 0))
  const c = Math.min(Math.max(1, Math.floor(Number(current) || 1)), t)
  if (t <= 7) return [...Array(t)].map((_, i) => i + 1)
  const set = new Set([1, t, c, c - 1, c + 1].filter((x) => x >= 1 && x <= t))
  const sorted = [...set].sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
    out.push(sorted[i])
  }
  return out
}

const BudgetSection = ({
  user,
  productInterests = [],
  expenses = [],
  insurances = [],
  pointAccounts = [],
  budgetTargetYen = 0,
  onSaveBudgetTarget,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onAddInsurance,
  onDeleteInsurance,
  onUpdateInsurance,
  onAddPointAccount,
  onDeletePointAccount,
  onUpdatePointAccount,
  expenseSaving = false,
  insuranceSaving = false,
  pointSaving = false,
}) => {
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [editingInsuranceId, setEditingInsuranceId] = useState(null)
  const [editingPointId, setEditingPointId] = useState(null)
  const [expenseForm, setExpenseForm] = useState({
    category: '食費',
    merchant: '',
    amount: '',
    payment_method: '',
    spent_on: new Date().toISOString().slice(0, 10),
  })
  const [showInsuranceForm, setShowInsuranceForm] = useState(false)
  const [insuranceForm, setInsuranceForm] = useState({
    product_name: '',
    provider: '',
    monthly_premium: '',
    maturity_date: '',
    coverage_summary: '',
  })
  const [showPointForm, setShowPointForm] = useState(false)
  const [pointForm, setPointForm] = useState({
    name: '',
    balance: '',
    expiry: '',
  })
  const [budgetInput, setBudgetInput] = useState(String(budgetTargetYen))
  const [receiptImageFile, setReceiptImageFile] = useState(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState('')
  const [receiptOcrLoading, setReceiptOcrLoading] = useState(false)
  const [receiptOcrError, setReceiptOcrError] = useState('')
  const [showShibaDetails, setShowShibaDetails] = useState(false)
  const [trendPeriodMonths, setTrendPeriodMonths] = useState(6)

  const toMonthKey = (dateStr) => {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const recentMonthKeys = (() => {
    const n = trendPeriodMonths === 'all' ? 120 : Math.max(1, Number(trendPeriodMonths) || 6)
    if (n >= 120) {
      const fromExpenses = (Array.isArray(expenses) ? expenses : [])
        .map((e) => toMonthKey(e?.spent_on))
        .filter(Boolean)
      const unique = [...new Set(fromExpenses)].sort()
      if (unique.length === 0) {
        const keys = []
        for (let i = 5; i >= 0; i -= 1) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        }
        return keys
      }
      return unique
    }
    const keys = []
    for (let i = n - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return keys
  })()
  const [categoryMonthKey, setCategoryMonthKey] = useState(currentMonthKey)
  const [expenseLedgerPage, setExpenseLedgerPage] = useState(1)
  useEffect(() => {
    setExpenseLedgerPage(1)
  }, [categoryMonthKey])
  const thisMonthExpenses = expenses
    .filter((e) => toMonthKey(e.spent_on) === currentMonthKey)
  const thisMonthTotal = thisMonthExpenses
    .reduce((acc, e) => acc + Number(e.amount || 0), 0)
  const usedPct = budgetTargetYen > 0 ? Math.min(100, (thisMonthTotal / budgetTargetYen) * 100) : 0

  const trendData = (() => {
    const map = new Map(recentMonthKeys.map((k) => [k, 0]))
    expenses.forEach((e) => {
      const k = toMonthKey(e.spent_on)
      if (map.has(k)) map.set(k, map.get(k) + Number(e.amount || 0))
    })
    const showYear = recentMonthKeys.length > 12
    return recentMonthKeys.map((k) => {
      const [y, m] = k.split('-')
      const monthLabel = showYear ? `${Number(y) % 100}/${Number(m)}` : `${Number(m)}月`
      return { month: monthLabel, amount: map.get(k) || 0 }
    })
  })()

  const categorySeries = (() => {
    const colorMap = { 食費: '#f97316', ショッピング: '#8b5cf6', 交通: '#0ea5e9', その他: '#94a3b8' }
    const map = new Map()
    expenses
      .filter((e) => toMonthKey(e.spent_on) === categoryMonthKey)
      .forEach((e) => {
        const cat = e.category || 'その他'
        map.set(cat, (map.get(cat) || 0) + Number(e.amount || 0))
      })
    const list = [...map.entries()].map(([name, value]) => ({
      name,
      value,
      color: colorMap[name] || '#94a3b8',
    }))
    return list
  })()
  const pieData = categorySeries.length > 0
    ? categorySeries
    : [{ name: 'データなし', value: 1, color: '#e2e8f0' }]

  const expensesForCategoryMonth = useMemo(() => {
    return (Array.isArray(expenses) ? expenses : [])
      .filter((e) => toMonthKey(e.spent_on) === categoryMonthKey)
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.spent_on || 0).getTime()
        const tb = new Date(b.spent_on || 0).getTime()
        if (tb !== ta) return tb - ta
        return String(b.id || '').localeCompare(String(a.id || ''))
      })
  }, [expenses, categoryMonthKey])

  const expenseLedgerPageCount = Math.max(
    1,
    Math.ceil(expensesForCategoryMonth.length / EXPENSE_LEDGER_PAGE_SIZE),
  )
  const expenseLedgerPageSafe = Math.min(Math.max(1, expenseLedgerPage), expenseLedgerPageCount)
  const pagedRecentExpenses = useMemo(() => {
    const page = Math.min(Math.max(1, expenseLedgerPage), expenseLedgerPageCount)
    const start = (page - 1) * EXPENSE_LEDGER_PAGE_SIZE
    return expensesForCategoryMonth.slice(start, start + EXPENSE_LEDGER_PAGE_SIZE)
  }, [expensesForCategoryMonth, expenseLedgerPage, expenseLedgerPageCount])

  const expenseLedgerPageButtons = useMemo(
    () => buildExpenseLedgerPageList(expenseLedgerPageSafe, expenseLedgerPageCount),
    [expenseLedgerPageSafe, expenseLedgerPageCount],
  )

  useEffect(() => {
    setExpenseLedgerPage((p) => Math.min(Math.max(1, p), expenseLedgerPageCount))
  }, [expenseLedgerPageCount])

  const pointTotal = pointAccounts.reduce((acc, p) => acc + Number(p.balance || 0), 0)
  const bankProductWatchlist = (Array.isArray(productInterests) ? productInterests : []).filter((item) => {
    const cat = String(item?.category || '').toLowerCase()
    return cat.includes('saving') || cat.includes('bank')
  })
  const expiringPoints = pointAccounts
    .filter((p) => {
      if (!p.expiry) return false
      const diff = new Date(p.expiry).getTime() - Date.now()
      return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * POINT_EXPIRY_ALERT_DAYS
    })
    .reduce((acc, p) => acc + Number(p.balance || 0), 0)
  const pointRows = pointAccounts.map((p) => {
    const expiryAt = p.expiry ? new Date(p.expiry).getTime() : Number.NaN
    const daysLeft = Number.isFinite(expiryAt)
      ? Math.ceil((expiryAt - Date.now()) / (1000 * 60 * 60 * 24))
      : null
    const isExpiringSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= POINT_EXPIRY_ALERT_DAYS
    return { ...p, daysLeft, isExpiringSoon }
  })
  const predictivePurchaseRows = (() => {
    const dayMs = 1000 * 60 * 60 * 24
    const today = new Date()
    return TRACKED_PURCHASE_ITEMS.map((item) => {
      const purchases = expenses
        .filter((expense) => {
          const source = `${expense?.merchant || ''} ${expense?.category || ''}`.toLowerCase()
          return item.keywords.some((keyword) => source.includes(String(keyword).toLowerCase()))
        })
        .map((expense) => new Date(expense.spent_on))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())

      if (purchases.length < 2) {
        return {
          id: item.id,
          label: item.label,
          sampleCount: purchases.length,
          avgIntervalDays: null,
          daysUntilNext: null,
          nextDateLabel: 'データ不足',
          status: 'insufficient',
        }
      }

      const intervals = []
      for (let idx = 1; idx < purchases.length; idx += 1) {
        const diffDays = Math.max(1, Math.round((purchases[idx].getTime() - purchases[idx - 1].getTime()) / dayMs))
        intervals.push(diffDays)
      }
      const avgIntervalDays = Math.max(1, Math.round(intervals.reduce((acc, cur) => acc + cur, 0) / intervals.length))
      const tolerance = Math.max(1, Math.round(avgIntervalDays * 0.25))
      const lastPurchase = purchases[purchases.length - 1]
      const predictedNext = new Date(lastPurchase.getTime() + (avgIntervalDays * dayMs))
      const daysUntilNext = Math.ceil((predictedNext.getTime() - today.getTime()) / dayMs)
      const status = daysUntilNext <= 1
        ? 'due_soon'
        : daysUntilNext <= (tolerance + 3)
          ? 'upcoming'
          : 'normal'

      return {
        id: item.id,
        label: item.label,
        sampleCount: purchases.length,
        avgIntervalDays,
        daysUntilNext,
        nextDateLabel: predictedNext.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
        status,
      }
    }).sort((a, b) => {
      const aScore = a.daysUntilNext === null ? 9999 : a.daysUntilNext
      const bScore = b.daysUntilNext === null ? 9999 : b.daysUntilNext
      return aScore - bScore
    })
  })()
  const topPredictiveAlerts = predictivePurchaseRows.filter((row) => row.daysUntilNext !== null).slice(0, 3)
  const today = new Date()
  const spendingRunRateYen = projectMonthEndSpending(expenses, today)
  const projectedFreeCashYen = Math.max(0, Number(budgetTargetYen || 0) - spendingRunRateYen)
  const projectedDeficitYen = Math.max(0, spendingRunRateYen - Number(budgetTargetYen || 0))
  const freeCashProgressPct = Number(budgetTargetYen || 0) > 0
    ? Math.max(0, Math.min(100, (projectedFreeCashYen / Number(budgetTargetYen || 1)) * 100))
    : 0
  const topSpendingInsight = (() => {
    const amountByLabel = new Map()
    thisMonthExpenses.forEach((expense) => {
      const label = String(expense?.merchant || expense?.category || 'その他').trim() || 'その他'
      const amount = Number(expense?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) return
      amountByLabel.set(label, (amountByLabel.get(label) || 0) + amount)
    })
    if (amountByLabel.size === 0) {
      return {
        label: 'データ不足',
        amountYen: 0,
        sharePct: 0,
      }
    }
    const [label, amountYen] = [...amountByLabel.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      label,
      amountYen,
      sharePct: thisMonthTotal > 0 ? (amountYen / thisMonthTotal) * 100 : 0,
    }
  })()
  const topSpendingMockUnits = topSpendingInsight.amountYen / MOCK_SWAP_UNIT_YEN
  const projectedFreeCashMockUnits = projectedFreeCashYen / MOCK_SWAP_UNIT_YEN
  const overspendThresholdYen = Number(budgetTargetYen || 0) * 1.05
  const underspendThresholdYen = Number(budgetTargetYen || 0) * 0.95
  const spendForecastStatus = spendingRunRateYen > overspendThresholdYen
    ? 'overspend'
    : spendingRunRateYen < underspendThresholdYen
      ? 'underspend'
      : 'balanced'
  const shibaScenario = receiptOcrLoading
    ? 'scan'
    : (topPredictiveAlerts.some((row) => row.status === 'due_soon') || spendForecastStatus === 'overspend')
      ? 'warn'
      : spendForecastStatus === 'underspend'
        ? 'calm'
        : 'normal'
  const nextPredictiveAlert = topPredictiveAlerts[0] || null
  const spendForecastHeadline = spendForecastStatus === 'overspend'
    ? '今月は予算超過ペースです'
    : spendForecastStatus === 'underspend'
      ? '今月は予算内ペースです'
      : '今月は予算近辺で推移中です'

  const handleExpenseSubmit = async () => {
    if (!user?.id) return
    const amountNum = Number(expenseForm.amount || 0)
    if (!expenseForm.merchant.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      alert('支出名と金額を入力してください。')
      return
    }
    try {
      await onAddExpense?.({
        user_id: user.id,
        spent_on: expenseForm.spent_on,
        category: expenseForm.category,
        merchant: expenseForm.merchant.trim(),
        amount: amountNum,
        payment_method: expenseForm.payment_method.trim(),
        notes: '',
      })
      setExpenseForm((prev) => ({ ...prev, merchant: '', amount: '', payment_method: '' }))
      setShowExpenseForm(false)
    } catch {
      /* 失敗時は親が dataStatus を更新。フォームは開いたまま */
    }
  }

  const handleInsuranceSubmit = async () => {
    if (!user?.id) return
    const premium = Number(insuranceForm.monthly_premium || 0)
    if (!insuranceForm.product_name.trim()) {
      alert('保険名を入力してください。')
      return
    }
    try {
      await onAddInsurance?.({
        user_id: user.id,
        product_name: insuranceForm.product_name.trim(),
        provider: insuranceForm.provider.trim(),
        monthly_premium: Number.isFinite(premium) ? Math.max(0, premium) : 0,
        maturity_date: insuranceForm.maturity_date || null,
        coverage_summary: insuranceForm.coverage_summary.trim(),
      })
      setInsuranceForm({
        product_name: '',
        provider: '',
        monthly_premium: '',
        maturity_date: '',
        coverage_summary: '',
      })
      setShowInsuranceForm(false)
    } catch {
      /* 親が dataStatus */
    }
  }

  const handlePointSubmit = async () => {
    if (!user?.id) return
    const balanceNum = Number(pointForm.balance || 0)
    if (!pointForm.name.trim() || !Number.isFinite(balanceNum) || balanceNum < 0) {
      alert('ポイント名と残高を入力してください。')
      return
    }
    try {
      await onAddPointAccount?.({
        user_id: user.id,
        name: pointForm.name.trim(),
        balance: balanceNum,
        expiry: pointForm.expiry || null,
      })
      setPointForm({ name: '', balance: '', expiry: '' })
      setShowPointForm(false)
    } catch {
      /* 親が dataStatus */
    }
  }

  useEffect(() => {
    setBudgetInput(String(budgetTargetYen))
  }, [budgetTargetYen])
  useEffect(() => {
    if (!receiptImageFile) {
      setReceiptPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(receiptImageFile)
    setReceiptPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [receiptImageFile])
  useEffect(() => {
    if (!recentMonthKeys.includes(categoryMonthKey)) {
      const fallback = recentMonthKeys.length > 0 ? recentMonthKeys[recentMonthKeys.length - 1] : currentMonthKey
      setCategoryMonthKey(fallback)
    }
  }, [recentMonthKeys, categoryMonthKey, currentMonthKey])

  const handleReceiptFileChange = (event) => {
    const file = event.target.files?.[0] || null
    setReceiptOcrError('')
    setReceiptImageFile(file)
  }

  const handleReceiptOcr = async () => {
    if (!receiptImageFile) {
      setReceiptOcrError('先にレシート画像を選択してください。')
      return
    }
    setReceiptOcrLoading(true)
    setReceiptOcrError('')
    try {
      let extracted = null
      if (ENABLE_SERVER_RECEIPT_OCR) {
        extracted = await extractExpenseByServerOcr(receiptImageFile)
        // Keep server amount, but backfill missing merchant/date via local OCR.
        if (isFallbackMerchantValue(extracted?.merchant) || isLikelyInvalidOcrDate(extracted?.spent_on)) {
          try {
            const localExtracted = await extractExpenseByLocalOcr(receiptImageFile)
            const localMerchant = String(localExtracted?.merchant || '').trim()
            extracted = {
              ...localExtracted,
              ...extracted,
              merchant: isFallbackMerchantValue(extracted?.merchant)
                ? (!isFallbackMerchantValue(localMerchant) ? localMerchant : '')
                : extracted?.merchant,
              spent_on: isLikelyInvalidOcrDate(extracted?.spent_on)
                ? (isLikelyInvalidOcrDate(localExtracted?.spent_on) ? '' : localExtracted?.spent_on)
                : extracted?.spent_on,
              payment_method: extracted?.payment_method || localExtracted?.payment_method || '',
              category: extracted?.category || localExtracted?.category || 'その他',
            }
          } catch {
            // ignore local supplement failures; keep server result
          }
        }
      } else {
        extracted = await extractExpenseByLocalOcr(receiptImageFile)
      }
      setExpenseForm((prev) => ({
        ...prev,
        category: extracted.category || prev.category,
        merchant: extracted.merchant || prev.merchant,
        amount: extracted.amount || prev.amount,
        payment_method: extracted.payment_method || prev.payment_method,
        spent_on: extracted.spent_on || prev.spent_on,
      }))
      setShowExpenseForm(true)
      if (!extracted.amount || !extracted.merchant) {
        setReceiptOcrError('一部の項目を自動抽出できませんでした。金額・支出名を確認してください。')
      } else if (Number(extracted?.entitiesCount || 0) > 0) {
        setReceiptOcrError('')
      }
    } catch (err) {
      const message = String(err?.message || '')
      if (ENABLE_SERVER_RECEIPT_OCR) {
        try {
          const localExtracted = await extractExpenseByLocalOcr(receiptImageFile)
          setExpenseForm((prev) => ({
            ...prev,
            category: localExtracted.category || prev.category,
            merchant: localExtracted.merchant || prev.merchant,
            amount: localExtracted.amount || prev.amount,
            payment_method: localExtracted.payment_method || prev.payment_method,
            spent_on: localExtracted.spent_on || prev.spent_on,
          }))
          setShowExpenseForm(true)
          setReceiptOcrError('サーバーOCR未設定のため、端末OCRで読み取りました。')
        } catch {
          setReceiptOcrError(`サーバーOCRに失敗しました: ${message || 'UNKNOWN_ERROR'}`)
        }
      } else {
        setReceiptOcrError('読み取りに失敗しました。画像を変えるか、再撮影してお試しください。')
      }
    } finally {
      setReceiptOcrLoading(false)
    }
  }

  const showBankWatchlist = false

  return (
    <div className="grid md:grid-cols-2 gap-4 md:gap-8">
      {showBankWatchlist && (
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30">
          <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Wallet size={18} className="text-blue-500" /> 銀行商品ウォッチリスト
          </h3>
          {bankProductWatchlist.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">保存された銀行商品がありません。</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bankProductWatchlist.map((item) => (
                <button
                  key={`bank-watch-${item.id}`}
                  type="button"
                  onClick={() => window.location.assign(`/products/${item.id}`)}
                  className="text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.provider || '-'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 min-w-0">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet size={20} className="text-orange-500" /> 支出トラッカー
          </h3>
          <button
            onClick={() => setShowExpenseForm((prev) => !prev)}
            className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full"
          >
            + 支出を追加
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-900/20 p-3.5">
          <div className="mb-2">
            <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">手動入力で家計簿を記録</p>
          </div>
          <p className="text-[11px] text-indigo-700/90 dark:text-indigo-300/90 leading-relaxed">
            Please enter your expenses manually by clicking "+ Add Expenses" below.
          </p>
        </div>

        {Boolean(globalThis?.__MM_DEV__) && (
          <div className="hidden">
            <input type="file" accept="image/*" capture="environment" onChange={handleReceiptFileChange} />
            <button type="button" onClick={handleReceiptOcr} disabled={receiptOcrLoading}>
              {receiptOcrLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            </button>
            <span>{receiptImageFile?.name || ''}</span>
            <span>{receiptPreviewUrl || ''}</span>
            <span>{receiptOcrError || ''}</span>
          </div>
        )}

        {showExpenseForm && (
          <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-2 gap-2">
            <input value={expenseForm.merchant} onChange={(e) => setExpenseForm((p) => ({ ...p, merchant: e.target.value }))} placeholder="支出名" className="col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} placeholder="金額" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <select value={expenseForm.category} onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
              <option value="食費">食費</option>
              <option value="ショッピング">ショッピング</option>
              <option value="交通">交通</option>
              <option value="その他">その他</option>
            </select>
            <input type="date" value={expenseForm.spent_on} onChange={(e) => setExpenseForm((p) => ({ ...p, spent_on: e.target.value }))} className={`px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 ${myPageNativeDateInputTouchClass}`} />
            <input value={expenseForm.payment_method} onChange={(e) => setExpenseForm((p) => ({ ...p, payment_method: e.target.value }))} placeholder="支払い手段 (任意)" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
            <button onClick={handleExpenseSubmit} disabled={expenseSaving} className="col-span-2 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold disabled:opacity-60">
              {expenseSaving ? '保存中...' : '支出を追加'}
            </button>
          </div>
        )}

        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl border border-green-100 dark:border-green-900/50 mb-8">
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">今月の支出</p>
              <p className="text-3xl font-black text-green-700 dark:text-green-400">¥{thisMonthTotal.toLocaleString('ja-JP')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">予算目標</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-400">¥{budgetTargetYen.toLocaleString('ja-JP')}</p>
            </div>
          </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm"
            placeholder="予算目標(円)"
          />
          <button
            onClick={() => onSaveBudgetTarget?.(Number(budgetInput || 0))}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold"
          >
            予算保存
          </button>
        </div>
          <div className="w-full h-3 bg-green-200 dark:bg-green-900/50 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${usedPct}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-green-600 dark:text-green-400">
            <span>{usedPct.toFixed(1)}% 使用中</span>
            <span>残り ¥{Math.max(budgetTargetYen - thisMonthTotal, 0).toLocaleString('ja-JP')}</span>
          </div>
        </div>

        <div className="mb-8 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">月次支出トレンド (6ヶ月)</h4>
            <span className="text-[10px] font-bold text-slate-400">単位: 円</span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => `¥${Number(v).toLocaleString('ja-JP')}`} />
                <Bar dataKey="amount" fill="#f97316" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">カテゴリ支出</h4>
            <select
              value={categoryMonthKey}
              onChange={(e) => setCategoryMonthKey(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300"
            >
              {recentMonthKeys.map((k) => (
                <option key={k} value={k}>
                  {Number(k.split('-')[1])}月カテゴリ
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-40 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={pieData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" minAngle={MY_PAGE_PIE_MIN_ANGLE}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `¥${Number(v).toLocaleString('ja-JP')}`} />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="font-black text-slate-300 text-xs">カテゴリ</span>
              </div>
            </div>
            <div className="space-y-2 flex flex-col justify-center">
              {categorySeries.filter((d) => d.value > 0).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-500 dark:text-slate-400 font-bold">{d.name}</span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white">¥{d.value.toLocaleString('ja-JP')}</span>
                </div>
              ))}
              {categorySeries.length === 0 && (
                <p className="text-xs font-bold text-slate-400">
                  選択した月のカテゴリ支出データはまだありません。
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h5 className="font-bold text-slate-800 dark:text-slate-200 text-sm">最近の支出</h5>
              {expensesForCategoryMonth.length > 0 ? (
                <p className="text-[10px] font-bold text-slate-400">
                  {expensesForCategoryMonth.length}件中{' '}
                  {(expenseLedgerPageSafe - 1) * EXPENSE_LEDGER_PAGE_SIZE + 1}–
                  {Math.min(expenseLedgerPageSafe * EXPENSE_LEDGER_PAGE_SIZE, expensesForCategoryMonth.length)}
                  件を表示
                </p>
              ) : null}
            </div>
            <div className="space-y-2 pr-1">
              {expensesForCategoryMonth.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">支出データがまだありません。</p>
              )}
              {pagedRecentExpenses.map((tx) => (
                <div key={`merged-recent-${tx.id}`}>
                  {editingExpenseId === tx.id ? (
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 space-y-2">
                      <input value={expenseForm.merchant} onChange={(e) => setExpenseForm((p) => ({ ...p, merchant: e.target.value }))} placeholder="支出名" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm" />
                      <input type="date" value={expenseForm.spent_on} onChange={(e) => setExpenseForm((p) => ({ ...p, spent_on: e.target.value }))} className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 ${myPageNativeDateInputTouchClass}`} />
                      <select value={expenseForm.category} onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm">
                        {['食費', 'ショッピング', '交通', 'その他'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} placeholder="金額" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm" />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await onUpdateExpense?.(tx.id, { ...expenseForm, amount: Number(expenseForm.amount) || 0 })
                              setEditingExpenseId(null)
                            } catch {
                              /* 親が dataStatus */
                            }
                          }}
                          disabled={expenseSaving}
                          className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold disabled:opacity-60"
                        >
                          保存
                        </button>
                        <button type="button" onClick={() => setEditingExpenseId(null)} className="py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">キャンセル</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.category === '食費' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'}`}>
                          {tx.category === '食費' ? <Smartphone size={16} /> : <FileText size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">{householdMemoText(tx) || tx.category}</p>
                          <p className="text-[10px] text-slate-400 font-bold truncate">
                            {tx.spent_on} • {tx.category} {tx.payment_method ? `• ${tx.payment_method}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-black text-slate-900 dark:text-white text-xs">¥{Number(tx.amount || 0).toLocaleString('ja-JP')}</span>
                        <button onClick={() => { setExpenseForm({ category: tx.category || '食費', merchant: householdMemoText(tx), amount: String(tx.amount || ''), payment_method: tx.payment_method || '', spent_on: (tx.spent_on || '').slice(0, 10), notes: tx.notes || '' }); setEditingExpenseId(tx.id) }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500" title="編集"><Pencil size={13} /></button>
                        <button onClick={() => onDeleteExpense?.(tx.id)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {expenseLedgerPageCount > 1 ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setExpenseLedgerPage((p) => Math.max(1, p - 1))}
                  disabled={expenseLedgerPageSafe <= 1}
                  className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                >
                  前へ
                </button>
                {expenseLedgerPageButtons.map((item, idx) =>
                  item === '…' ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-[11px] font-bold text-slate-400"
                      aria-hidden
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={`exp-page-${item}`}
                      type="button"
                      onClick={() => setExpenseLedgerPage(item)}
                      className={`min-h-[36px] min-w-[36px] px-2 rounded-lg text-[11px] font-black transition ${
                        item === expenseLedgerPageSafe
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setExpenseLedgerPage((p) => Math.min(expenseLedgerPageCount, p + 1))}
                  disabled={expenseLedgerPageSafe >= expenseLedgerPageCount}
                  className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                >
                  次へ
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-3">
            <h5 className="text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1.5">家計メモ</h5>
            <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              <p>・ポイント/保険を登録すると、固定費の試算と期限アラートの材料が増えます。</p>
              <p>・今月の着地は「シバの家計先読みアラート」で確認できます。</p>
            </div>
          </div>
        </div>

      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-2xl border border-orange-100 dark:border-orange-900/50 bg-orange-50/70 dark:bg-orange-900/20 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h4 className="font-black text-orange-800 dark:text-orange-200 text-sm flex items-center gap-2">
              <Zap size={16} className="text-orange-500" /> シバの家計先読みアラート
            </h4>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/80 dark:bg-slate-900/40 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300">
              Predictive Beta
            </span>
          </div>

          <div className="relative">
            <div>
              <div className="rounded-xl border border-orange-200 dark:border-orange-900/50 bg-white dark:bg-slate-900 p-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-300 to-orange-500 text-white flex items-center justify-center text-xl shadow-md ${
                    shibaScenario === 'scan'
                      ? 'animate-pulse'
                      : shibaScenario === 'warn'
                        ? 'animate-bounce'
                        : ''
                  }`}>
                    <span>🐕</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-orange-500 tracking-wide">SHIBA LIVE REPORT</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-snug">{spendForecastHeadline}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">試算 ¥{spendingRunRateYen.toLocaleString('ja-JP')} / 予算 ¥{Number(budgetTargetYen || 0).toLocaleString('ja-JP')}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-900/20 p-3">
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-300">月末支出の試算</p>
                  <p className={`mt-1 text-sm font-black ${
                    spendForecastStatus === 'overspend'
                      ? 'text-rose-600 dark:text-rose-300'
                      : spendForecastStatus === 'underspend'
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    ¥{spendingRunRateYen.toLocaleString('ja-JP')}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-100 dark:border-orange-900/40 bg-white dark:bg-slate-900 p-3">
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-300">次の再購入タイミング</p>
                  {nextPredictiveAlert ? (
                    <>
                      <p className="mt-1 text-sm font-black text-slate-800 dark:text-slate-100">{nextPredictiveAlert.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {nextPredictiveAlert.daysUntilNext <= 0 ? '本日〜明日' : `${nextPredictiveAlert.daysUntilNext}日後`}（{nextPredictiveAlert.nextDateLabel}）
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">履歴不足（シャンプー/米/牛乳/コーヒー）</p>
                  )}
                </div>
              </div>

              <div className="mt-2">
                <button
                  onClick={() => setShowShibaDetails((prev) => !prev)}
                  className="w-full text-[11px] font-bold text-orange-700 dark:text-orange-300 bg-white/80 dark:bg-slate-900/40 border border-orange-200 dark:border-orange-900/50 rounded-lg py-2"
                >
                  {showShibaDetails ? '詳細を閉じる' : '詳細を見る'}
                </button>
              </div>

              {showShibaDetails && (
                <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-2">
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/30 dark:to-slate-900 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-black tracking-wide text-emerald-600 dark:text-emerald-300">FREE CASH SIGNAL</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300">予測</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {projectedDeficitYen > 0
                      ? `今月は ${projectedDeficitYen.toLocaleString('ja-JP')}円 の不足試算です。`
                      : `月末の余剰試算は ${projectedFreeCashYen.toLocaleString('ja-JP')}円 です。`}
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${freeCashProgressPct}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    余剰想定をモック口数換算: <span className="font-black text-emerald-600 dark:text-emerald-300">{projectedFreeCashMockUnits.toFixed(2)}口</span>
                  </p>
                </div>

                <div className="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-gradient-to-br from-violet-50 to-white dark:from-violet-900/30 dark:to-slate-900 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-black tracking-wide text-violet-600 dark:text-violet-300">RECEIPT-SHARE MOCK</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-300">体験</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                    {topSpendingInsight.amountYen > 0 ? (
                      <>
                        今月の最多支出は <span className="text-violet-600 dark:text-violet-300">{topSpendingInsight.label}</span>（¥{topSpendingInsight.amountYen.toLocaleString('ja-JP')} / {topSpendingInsight.sharePct.toFixed(1)}%）。
                        同額をモック換算すると <span className="text-violet-600 dark:text-violet-300">{topSpendingMockUnits.toFixed(2)}口</span> です。
                      </>
                    ) : (
                      <>
                        まだ十分な支出データがありません。レシート保存後に最多支出項目を自動分析します。
                      </>
                    )}
                  </p>
                  <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                    {topSpendingInsight.amountYen > 0
                      ? `「今日は${topSpendingInsight.label}を-10%で抑えると+${Math.max(0, topSpendingMockUnits * 0.1).toFixed(2)}口」など、習慣改善インパクトを可視化します。`
                      : 'データ蓄積後、削減インパクトを自動で表示します。'}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-violet-700/80 dark:text-violet-300/80">
                    ※ モック表示のみ。実際の投資執行・商品提案は行いません。
                  </p>
                </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 min-w-0 min-h-[330px] flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Coins size={20} className="text-yellow-500" /> ポイント管理
            </h3>
            <button
              onClick={() => setShowPointForm((prev) => !prev)}
              className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full"
            >
              + 追加
            </button>
          </div>
          {showPointForm && (
            <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-2 gap-2">
              <input value={pointForm.name} onChange={(e) => setPointForm((p) => ({ ...p, name: e.target.value }))} placeholder="ポイント名" className="col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <input type="number" value={pointForm.balance} onChange={(e) => setPointForm((p) => ({ ...p, balance: e.target.value }))} placeholder="残高" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">満期日（有効期限）</p>
                <input type="date" value={pointForm.expiry} onChange={(e) => setPointForm((p) => ({ ...p, expiry: e.target.value }))} className={`w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 ${myPageNativeDateInputTouchClass}`} />
              </div>
              <button onClick={handlePointSubmit} disabled={pointSaving} className="col-span-2 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold disabled:opacity-60">
                {pointSaving ? '保存中...' : 'ポイントを追加'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="relative p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-900/50">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-bold mb-1">総ポイント</p>
              <p className="text-3xl font-black text-orange-500">{pointTotal.toLocaleString('ja-JP')}</p>
              <Coins className="text-orange-200 dark:text-orange-800 absolute top-4 right-4" size={40} />
            </div>
            <div className="relative p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-500 font-bold mb-1">30日以内に失効</p>
              <p className={`text-3xl font-black ${expiringPoints > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>{expiringPoints.toLocaleString('ja-JP')}</p>
              <AlertTriangle className="text-slate-200 dark:text-slate-600 absolute top-4 right-4" size={40} />
            </div>
          </div>

          <div className="space-y-2 flex-1">
            {pointAccounts.length === 0 && (
              <div className="h-full min-h-[120px] rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 flex items-center justify-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">ポイントデータがまだありません。</p>
              </div>
            )}
            {pointRows.map((p) => (
              <div key={p.id} className={`flex justify-between items-center p-4 rounded-xl ${p.isExpiringSoon ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/60' : 'bg-slate-50 dark:bg-slate-800'}`}>
                {editingPointId === p.id ? (
                  <div className="w-full space-y-2">
                    <input value={pointForm.name} onChange={(e) => setPointForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="ポイント名" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm" />
                    <input type="number" value={pointForm.balance} onChange={(e) => setPointForm((prev) => ({ ...prev, balance: e.target.value }))} placeholder="残高" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm" />
                    <input type="date" value={(pointForm.expiry || '').slice(0, 10)} onChange={(e) => setPointForm((prev) => ({ ...prev, expiry: e.target.value }))} placeholder="有効期限" className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 ${myPageNativeDateInputTouchClass}`} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { const balanceNum = Number(pointForm.balance); onUpdatePointAccount?.(p.id, { name: pointForm.name.trim(), balance: Number.isFinite(balanceNum) ? balanceNum : 0, expiry: pointForm.expiry || null }); setEditingPointId(null) }} disabled={pointSaving} className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold disabled:opacity-60">保存</button>
                      <button type="button" onClick={() => setEditingPointId(null)} className="py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0 max-w-[60%]">
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-[10px] font-bold px-2 py-1 rounded-full truncate">{p.name}</span>
                      {p.isExpiringSoon && (
                        <span className="text-[10px] font-black px-2 py-1 rounded-full bg-red-500 text-white animate-pulse whitespace-nowrap">
                          まもなく失効 D-{p.daysLeft}
                        </span>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 dark:text-white">{Number(p.balance || 0).toLocaleString('ja-JP')} P</p>
                        <p className={`text-[10px] ${p.isExpiringSoon ? 'text-red-500 dark:text-red-300 font-bold' : 'text-slate-400'}`}>有効期限: {p.expiry || '-'}</p>
                      </div>
                      <button onClick={() => { setPointForm({ name: p.name || '', balance: String(p.balance ?? ''), expiry: (p.expiry || '').slice(0, 10) }); setEditingPointId(p.id) }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500" title="編集"><Pencil size={14} /></button>
                      <button onClick={() => onDeletePointAccount?.(p.id)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 min-w-0 min-h-[330px] flex flex-col">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-blue-500" /> My Insurance
            </h3>
            <button
              onClick={() => setShowInsuranceForm((prev) => !prev)}
              className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition"
            >
              + 追加
            </button>
          </div>

          {showInsuranceForm && (
            <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-2 gap-2">
              <input value={insuranceForm.product_name} onChange={(e) => setInsuranceForm((p) => ({ ...p, product_name: e.target.value }))} placeholder="保険名" className="col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <input value={insuranceForm.provider} onChange={(e) => setInsuranceForm((p) => ({ ...p, provider: e.target.value }))} placeholder="保険会社" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <input type="number" value={insuranceForm.monthly_premium} onChange={(e) => setInsuranceForm((p) => ({ ...p, monthly_premium: e.target.value }))} placeholder="月額保険料" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">満期日</p>
                <input type="date" value={insuranceForm.maturity_date} onChange={(e) => setInsuranceForm((p) => ({ ...p, maturity_date: e.target.value }))} className={`w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 ${myPageNativeDateInputTouchClass}`} />
              </div>
              <input value={insuranceForm.coverage_summary} onChange={(e) => setInsuranceForm((p) => ({ ...p, coverage_summary: e.target.value }))} placeholder="補償概要" className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm" />
              <button onClick={handleInsuranceSubmit} disabled={insuranceSaving} className="col-span-2 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold disabled:opacity-60">
                {insuranceSaving ? '保存中...' : '保険を追加'}
              </button>
            </div>
          )}

          <div className="space-y-2 flex-1">
            {insurances.length === 0 && (
              <div className="h-full min-h-[120px] rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 flex items-center justify-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">保険データがまだありません。</p>
              </div>
            )}
            {insurances.map((ins) => {
              const dayLeft = ins.maturity_date
                ? Math.max(0, Math.ceil((new Date(ins.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null
              const isMaturitySoon = dayLeft !== null && dayLeft <= POINT_EXPIRY_ALERT_DAYS
              const isEditing = editingInsuranceId === ins.id
              return (
                <div key={ins.id} className={`border rounded-xl p-4 relative overflow-hidden ${isMaturitySoon ? 'border-red-300 dark:border-red-700/70 bg-red-50/40 dark:bg-red-900/20' : 'border-orange-200 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-900/20'}`}>
                  <div className={`absolute top-0 left-0 w-1 h-full ${isMaturitySoon ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`} />
                  {isEditing ? (
                    <div className="space-y-2">
                      <input value={insuranceForm.product_name} onChange={(e) => setInsuranceForm((p) => ({ ...p, product_name: e.target.value }))} placeholder="保険名" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm" />
                      <input value={insuranceForm.provider} onChange={(e) => setInsuranceForm((p) => ({ ...p, provider: e.target.value }))} placeholder="保険会社" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm" />
                      <input type="number" value={insuranceForm.monthly_premium} onChange={(e) => setInsuranceForm((p) => ({ ...p, monthly_premium: e.target.value }))} placeholder="月額保険料" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm" />
                      <input type="date" value={(insuranceForm.maturity_date || '').slice(0, 10)} onChange={(e) => setInsuranceForm((p) => ({ ...p, maturity_date: e.target.value }))} className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 ${myPageNativeDateInputTouchClass}`} />
                      <input value={insuranceForm.coverage_summary} onChange={(e) => setInsuranceForm((p) => ({ ...p, coverage_summary: e.target.value }))} placeholder="補償概要" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { onUpdateInsurance?.(ins.id, { product_name: insuranceForm.product_name.trim(), provider: (insuranceForm.provider || '').trim(), monthly_premium: insuranceForm.monthly_premium ? Number(insuranceForm.monthly_premium) : null, maturity_date: insuranceForm.maturity_date || null, coverage_summary: (insuranceForm.coverage_summary || '').trim() || null }); setEditingInsuranceId(null) }} disabled={insuranceSaving} className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold disabled:opacity-60">保存</button>
                        <button type="button" onClick={() => setEditingInsuranceId(null)} className="py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">キャンセル</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{ins.product_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{ins.provider || '-'} • 保険料: ¥{Number(ins.monthly_premium || 0).toLocaleString('ja-JP')}/月</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {dayLeft !== null && (
                            <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${isMaturitySoon ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}>
                              あと {dayLeft}日
                            </span>
                          )}
                          <button onClick={() => { setInsuranceForm({ product_name: ins.product_name || '', provider: ins.provider || '', monthly_premium: String(ins.monthly_premium ?? ''), maturity_date: (ins.maturity_date || '').slice(0, 10), coverage_summary: ins.coverage_summary || '' }); setEditingInsuranceId(ins.id) }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500" title="編集"><Pencil size={14} /></button>
                          <button onClick={() => onDeleteInsurance?.(ins.id)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {ins.maturity_date ? `満期: ${ins.maturity_date}` : '満期: -'} • 補償: {ins.coverage_summary || '-'}
                      </p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            {LEGAL_NOTICE_TEMPLATES.insurance}
          </p>
        </div>

      </div>
    </div>
  )
}

const BudgetSectionV2 = ({
  user,
  isPaidMember = false,
  onUiMessage,
  expenses = [],
  insurances = [],
  pointAccounts = [],
  annualIncomeManwon = 0,
  onAnnualIncomeChange,
  onSaveAnnualIncome,
  profileSaving = false,
  budgetTargetYen = 0,
  onSaveBudgetTarget,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onAddInsurance,
  onDeleteInsurance,
  onUpdateInsurance,
  onAddPointAccount,
  onDeletePointAccount,
  onUpdatePointAccount,
  expenseSaving = false,
  insuranceSaving = false,
  pointSaving = false,
}) => {
  const navigate = useNavigate()
  const [monthlyBudget, setMonthlyBudget] = useState(Math.max(0, Number(budgetTargetYen || 0)))
  const [isEditingBudget, setIsEditingBudget] = useState(() => Math.max(0, Number(budgetTargetYen || 0)) <= 0)
  const [tempBudget, setTempBudget] = useState(String(Math.max(0, Number(budgetTargetYen || 0))))
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingTxId, setEditingTxId] = useState(null)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('food')
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('card')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [expenseName, setExpenseName] = useState('')
  const [expenseRecurringType, setExpenseRecurringType] = useState('none')
  const [expenseRecurringEndOn, setExpenseRecurringEndOn] = useState('')
  const [expenseRecurringEndDraft, setExpenseRecurringEndDraft] = useState('')
  const [editingRecurringLocked, setEditingRecurringLocked] = useState(false)
  const [editingRecurringParentId, setEditingRecurringParentId] = useState('')
  const [showExpiryForm, setShowExpiryForm] = useState(false)
  const [editingExpiryId, setEditingExpiryId] = useState(null)
  const [expiryType, setExpiryType] = useState('point')
  const [expiryName, setExpiryName] = useState('')
  const [expiryDateValue, setExpiryDateValue] = useState('')
  const [expiryAmount, setExpiryAmount] = useState('')
  const [expenseTrendMonths, setExpenseTrendMonths] = useState(6)
  const [householdMainTab, setHouseholdMainTab] = useState('flow')

  useEffect(() => {
    const next = Math.max(0, Number(budgetTargetYen || 0))
    setMonthlyBudget(next)
    setTempBudget(next > 0 ? String(next) : '')
    if (next <= 0) setIsEditingBudget(true)
  }, [budgetTargetYen])

  useEffect(() => {
    setExpenseRecurringEndDraft(expenseRecurringEndOn ? formatHouseholdDateSlash(expenseRecurringEndOn) : '')
  }, [expenseRecurringEndOn])

  useEffect(() => {
    if (expenseRecurringType === 'none') {
      setExpenseRecurringEndOn('')
      setExpenseRecurringEndDraft('')
    }
  }, [expenseRecurringType])

  const categories = {
    food: { label: '食費', icon: UtensilsCrossed, color: 'text-orange-500', bg: 'bg-orange-100', hex: '#f97316' },
    dining: { label: '外食・飲み会', icon: ForkKnifeCrossed, color: 'text-amber-600', bg: 'bg-amber-100', hex: '#d97706' },
    transport: { label: '交通費', icon: Bus, color: 'text-blue-500', bg: 'bg-blue-100', hex: '#3b82f6' },
    shopping: { label: '日用品・買い物', icon: ShoppingCart, color: 'text-purple-500', bg: 'bg-purple-100', hex: '#a855f7' },
    housing: { label: '住宅・固定費', icon: Home, color: 'text-teal-500', bg: 'bg-teal-100', hex: '#14b8a6' },
    entertainment: { label: '趣味・娯楽', icon: Gamepad2, color: 'text-pink-500', bg: 'bg-pink-100', hex: '#ec4899' },
    medical: { label: '医療・健康', icon: Stethoscope, color: 'text-rose-500', bg: 'bg-rose-100', hex: '#f43f5e' },
    education: { label: '教育・習い事', icon: GraduationCap, color: 'text-indigo-500', bg: 'bg-indigo-100', hex: '#6366f1' },
    travel: { label: '旅行・宿泊', icon: Plane, color: 'text-sky-500', bg: 'bg-sky-100', hex: '#0ea5e9' },
    fashion: { label: '衣服・美容', icon: Shirt, color: 'text-fuchsia-500', bg: 'bg-fuchsia-100', hex: '#d946ef' },
    pet: { label: 'ペット', icon: Dog, color: 'text-lime-600', bg: 'bg-lime-100', hex: '#65a30d' },
    misc: { label: 'その他', icon: MoreHorizontal, color: 'text-slate-500', bg: 'bg-slate-100', hex: '#64748b' },
  }
  const categoryToDbLabel = {
    food: '食費',
    dining: '外食・飲み会',
    transport: '交通',
    shopping: 'ショッピング',
    housing: '住宅・固定費',
    entertainment: '趣味・娯楽',
    medical: '医療・健康',
    education: '教育・習い事',
    travel: '旅行・宿泊',
    fashion: '衣服・美容',
    pet: 'ペット',
    misc: 'その他',
  }
  const dbLabelToCategory = (label = '', merchant = '') => {
    const raw = String(label || '')
    const hint = `${raw} ${String(merchant || '')}`
    if (raw.includes('その他')) return 'misc'
    if (raw.includes('外食') || raw.includes('飲み会')) return 'dining'
    if (/(医療|病院|クリニック|歯科|診療|薬局|処方|健診)/.test(hint)) return 'medical'
    if (raw.includes('趣味') || raw.includes('娯楽')) return 'entertainment'
    if (raw.includes('教育') || raw.includes('習い事')) return 'education'
    if (raw.includes('旅行') || raw.includes('宿泊')) return 'travel'
    if (raw.includes('衣服') || raw.includes('美容')) return 'fashion'
    if (raw.includes('ペット')) return 'pet'
    if (raw.includes('食費') || (raw.includes('食') && !raw.includes('外食'))) return 'food'
    if (raw.includes('交') || raw.includes('交通')) return 'transport'
    if (/(住宅|固定費|家賃|住居|光熱|水道|ガス|電気|通信|携帯|ネット|保険|ローン)/.test(hint)) return 'housing'
    if (raw.includes('ショッピング') || raw.includes('日用品')) return 'shopping'
    if (raw.includes('住') || raw.includes('光熱')) return 'housing'
    return 'misc'
  }
  const formatCurrency = (amount) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Math.max(0, Number(amount || 0)))
  const formatNumber = (num) => new Intl.NumberFormat('ja-JP').format(Math.max(0, Number(num || 0)))
  const formatSignedCurrency = (amount) => {
    const n = Number(amount || 0)
    const sign = n < 0 ? '-' : ''
    return `${sign}${new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Math.abs(n))}`
  }
  const toPaymentMethodKey = (value = '') => (/現金|cash/i.test(String(value || '')) ? 'cash' : 'card')
  const toPaymentMethodLabel = (key = 'card') => (key === 'cash' ? '現金' : 'カード')
  const recurringTypeLabel = (type) => {
    if (type === 'weekly') return '毎週'
    if (type === 'monthly') return '毎月'
    return 'なし'
  }

  const transactions = useMemo(() => {
    return (Array.isArray(expenses) ? expenses : [])
      .map((row) => ({
        id: row.id,
        date: String(row.spent_on || '').slice(0, 10),
        category: dbLabelToCategory(row.category, row.merchant),
        name: (() => {
          const baseName = householdMemoText(row) || String(row.category || '支出')
          const isRecurringRow = Boolean(row.recurring_type || row.recurring_parent_id)
          return isRecurringRow ? `${baseName} · 定期` : baseName
        })(),
        amount: Math.max(0, Number(row.amount || 0)),
        merchant: row.merchant || '',
        notes: row.notes || '',
        payment_method: row.payment_method || '',
        payment_method_key: toPaymentMethodKey(row.payment_method),
        recurring_type: row.recurring_type || null,
        recurring_end_on: row.recurring_end_on || null,
        recurring_parent_id: row.recurring_parent_id || null,
        type: 'expense',
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [expenses])
  const transactionById = useMemo(
    () => new Map(transactions.map((tx) => [String(tx.id), tx])),
    [transactions],
  )
  const resolveRecurringEditMeta = useCallback((tx) => {
    const ownType = tx?.recurring_type === 'weekly' || tx?.recurring_type === 'monthly'
      ? tx.recurring_type
      : null
    if (ownType) {
      return {
        recurringType: ownType,
        recurringEndOn: String(tx?.recurring_end_on || '').slice(0, 10),
        locked: false,
        parentId: '',
      }
    }
    const parentId = String(tx?.recurring_parent_id || '').trim()
    if (!parentId) {
      return { recurringType: 'none', recurringEndOn: '', locked: false, parentId: '' }
    }
    const parentTx = transactionById.get(parentId)
    const parentType = parentTx?.recurring_type === 'weekly' || parentTx?.recurring_type === 'monthly'
      ? parentTx.recurring_type
      : 'none'
    return {
      recurringType: parentType,
      recurringEndOn: String(parentTx?.recurring_end_on || '').slice(0, 10),
      locked: true,
      parentId,
    }
  }, [transactionById])
  const txMonthOptions = useMemo(() => {
    const set = new Set(
      transactions
        .map((t) => String(t?.date || '').slice(0, 7))
        .filter(Boolean)
    )
    return [...set].sort((a, b) => (a < b ? 1 : -1))
  }, [transactions])
  const [selectedTxMonth, setSelectedTxMonth] = useState('')
  const prevTxMonthOptionsRef = useRef([])
  useEffect(() => {
    if (txMonthOptions.length === 0) {
      setSelectedTxMonth('')
      prevTxMonthOptionsRef.current = []
      return
    }
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const preferred = txMonthOptions.includes(currentMonth) ? currentMonth : txMonthOptions[0]
    const prevHadCurrent = prevTxMonthOptionsRef.current.includes(currentMonth)
    const nowHasCurrent = txMonthOptions.includes(currentMonth)
    prevTxMonthOptionsRef.current = txMonthOptions

    if (!selectedTxMonth || !txMonthOptions.includes(selectedTxMonth)) {
      setSelectedTxMonth(preferred)
    } else if (!prevHadCurrent && nowHasCurrent) {
      // 該当月が新規に追加されたら自動で該当月を表示（過去月入力後に今月を入力した場合など）
      setSelectedTxMonth(currentMonth)
    }
  }, [txMonthOptions, selectedTxMonth])
  const filteredTransactions = useMemo(() => {
    if (!selectedTxMonth) return transactions
    return transactions.filter((t) => String(t?.date || '').startsWith(selectedTxMonth))
  }, [transactions, selectedTxMonth])

  const calendarCurrentMonthKey = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()
  /** プロフィールの予算は「暦の当月」の一覧・達成率のみに使う（過去月を見ているときは数値が書き換わって見えないようにする） */
  const budgetAppliesToSelectedMonth = Boolean(selectedTxMonth) && selectedTxMonth === calendarCurrentMonthKey

  useEffect(() => {
    if (!budgetAppliesToSelectedMonth) setIsEditingBudget(false)
  }, [budgetAppliesToSelectedMonth])

  const [txLedgerPage, setTxLedgerPage] = useState(1)
  useEffect(() => {
    setTxLedgerPage(1)
  }, [selectedTxMonth])
  const txLedgerPageCount = Math.max(
    1,
    Math.ceil(filteredTransactions.length / EXPENSE_LEDGER_PAGE_SIZE),
  )
  const txLedgerPageSafe = Math.min(Math.max(1, txLedgerPage), txLedgerPageCount)
  const pagedFilteredTransactions = useMemo(() => {
    const page = Math.min(Math.max(1, txLedgerPage), txLedgerPageCount)
    const start = (page - 1) * EXPENSE_LEDGER_PAGE_SIZE
    return filteredTransactions.slice(start, start + EXPENSE_LEDGER_PAGE_SIZE)
  }, [filteredTransactions, txLedgerPage, txLedgerPageCount])
  const txLedgerPageButtons = useMemo(
    () => buildExpenseLedgerPageList(txLedgerPageSafe, txLedgerPageCount),
    [txLedgerPageSafe, txLedgerPageCount],
  )
  useEffect(() => {
    setTxLedgerPage((p) => Math.min(Math.max(1, p), txLedgerPageCount))
  }, [txLedgerPageCount])
  const [expiryNowTs] = useState(() => Date.now())

  const processedExpiries = useMemo(() => {
    const pointRows = (Array.isArray(pointAccounts) ? pointAccounts : []).map((p) => ({
      id: `point-${p.id}`,
      sourceId: p.id,
      sourceType: 'point',
      type: 'point',
      name: p.name || 'ポイント',
      expiryDate: (p.expiry || '').slice(0, 10),
      amount: Math.max(0, Number(p.balance || 0)),
      createdAt: p.created_at || '',
    }))
    const insuranceRows = (Array.isArray(insurances) ? insurances : []).map((ins) => ({
      id: `insurance-${ins.id}`,
      sourceId: ins.id,
      sourceType: 'insurance',
      type: 'insurance',
      name: ins.product_name || '保険',
      expiryDate: (ins.maturity_date || '').slice(0, 10),
      amount: Math.max(0, Number(ins.monthly_premium || 0)),
      provider: ins.provider || '',
      coverageSummary: ins.coverage_summary || '',
    }))
    return [...pointRows, ...insuranceRows]
      .map((exp) => {
        if (!exp.expiryDate) return { ...exp, daysLeft: 9999, isAlert: false }
        const diffDays = Math.ceil((new Date(`${exp.expiryDate}T00:00:00`).getTime() - expiryNowTs) / (1000 * 60 * 60 * 24))
        return { ...exp, daysLeft: diffDays, isAlert: diffDays >= 0 && diffDays <= 30 }
      })
      .sort((a, b) => Number(a.daysLeft || 0) - Number(b.daysLeft || 0))
  }, [pointAccounts, insurances, expiryNowTs])

  const hasUrgentAlert = processedExpiries.some((e) => e.isAlert)

  const pointsInsuranceStrip = useMemo(() => {
    const pointRows = processedExpiries.filter((e) => e.type === 'point')
    const insRows = processedExpiries.filter((e) => e.type === 'insurance')
    const totalPt = pointRows.reduce((s, e) => s + Number(e.amount || 0), 0)
    const expiringSoonPt = pointRows.filter((e) => e.isAlert).reduce((s, e) => s + Number(e.amount || 0), 0)
    const insMonthly = insRows.reduce((s, e) => s + Number(e.amount || 0), 0)
    const upcoming = processedExpiries.filter((e) => e.daysLeft >= 0 && e.daysLeft < 9000)
    const nextDays = upcoming.length ? Math.min(...upcoming.map((e) => e.daysLeft)) : null
    return { totalPt, expiringSoonPt, insMonthly, nextDays }
  }, [processedExpiries])

  const summaryData = useMemo(() => {
    const scopedRows = Array.isArray(filteredTransactions) ? filteredTransactions : []
    const totalSpent = scopedRows.reduce((sum, t) => sum + t.amount, 0)
    const budgetForUsage = budgetAppliesToSelectedMonth ? monthlyBudget : 0
    const budgetUsagePercent = budgetForUsage > 0 ? Math.min(100, (totalSpent / budgetForUsage) * 100) : 0
    const categoryTotals = scopedRows.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {})
    const sortedCategories = Object.keys(categoryTotals)
      .map((key) => ({
        id: key,
        amount: categoryTotals[key],
        percent: totalSpent > 0 ? (categoryTotals[key] / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
    const gradientBuild = sortedCategories.reduce((acc, cat) => {
      const start = acc.cumulative
      const end = start + cat.percent
      return {
        cumulative: end,
        stops: [...acc.stops, `${categories[cat.id]?.hex || '#94a3b8'} ${start}% ${end}%`],
      }
    }, { cumulative: 0, stops: [] })
    const pieGradientStops = gradientBuild.stops.join(', ')
    return { totalSpent, budgetUsagePercent, sortedCategories, pieGradientStops: pieGradientStops || '#f3f4f6 0% 100%' }
  }, [filteredTransactions, monthlyBudget, categories, budgetAppliesToSelectedMonth])

  const currentMonthBudgetUsage = useMemo(
    () => getCurrentMonthBudgetUsage(expenses, monthlyBudget),
    [expenses, monthlyBudget],
  )

  const lastMonthTotalSamePeriod = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const day = now.getDate()
    const prevStart = new Date(y, m - 1, 1)
    const prevEnd = new Date(y, m - 1, day)
    return (Array.isArray(expenses) ? expenses : []).reduce((sum, row) => {
      const dt = new Date(row.spent_on)
      if (Number.isNaN(dt.getTime())) return sum
      if (dt >= prevStart && dt <= prevEnd) return sum + Math.max(0, Number(row.amount || 0))
      return sum
    }, 0)
  }, [expenses])

  /** 一覧の表示月と無関係に、暦「今月・本日まで」の支出（インサイト文言と整合） */
  const calendarMonthToDateSpentYen = useMemo(() => {
    const rows = Array.isArray(expenses) ? expenses : []
    const now = new Date()
    const y = now.getFullYear()
    const mo = now.getMonth()
    const day = now.getDate()
    const curStart = new Date(y, mo, 1)
    const todayEnd = new Date(y, mo, day, 23, 59, 59, 999)
    return rows.reduce((sum, row) => {
      const dt = new Date(row?.spent_on || '')
      if (Number.isNaN(dt.getTime())) return sum
      if (dt >= curStart && dt <= todayEnd) return sum + Math.max(0, Number(row?.amount || 0))
      return sum
    }, 0)
  }, [expenses])

  const insightData = useMemo(() => {
    const savedAmount = lastMonthTotalSamePeriod - calendarMonthToDateSpentYen
    const isSaving = savedAmount > 0
    const annualReturnRate = 0.05
    const years = 10
    const simulatedFutureValue = isSaving ? Math.floor(savedAmount * Math.pow(1 + annualReturnRate, years)) : 0
    return { savedAmount, isSaving, simulatedFutureValue, years, annualReturnRate }
  }, [lastMonthTotalSamePeriod, calendarMonthToDateSpentYen])

  /** 暦「今月」〜今日 vs 前月同日まで。カテゴリは取引一覧と同じ dbLabelToCategory ルール。 */
  const householdInsightMetrics = useMemo(() => {
    const rows = Array.isArray(expenses) ? expenses : []
    const { curStart, todayEnd, prevStart, prevEnd } = samePeriodExpenseBounds(new Date())

    const curByCat = {}
    const prevSamePeriodByCat = {}
    for (const row of rows) {
      const dt = new Date(row?.spent_on || '')
      if (Number.isNaN(dt.getTime())) continue
      const amt = Math.max(0, Number(row?.amount || 0))
      const catKey = dbLabelToCategory(row.category, row.merchant)
      if (spentOnInBounds(row?.spent_on, curStart, todayEnd)) {
        curByCat[catKey] = (curByCat[catKey] || 0) + amt
      }
      if (spentOnInBounds(row?.spent_on, prevStart, prevEnd)) {
        prevSamePeriodByCat[catKey] = (prevSamePeriodByCat[catKey] || 0) + amt
      }
    }

    const totalCur = Object.values(curByCat).reduce((s, v) => s + v, 0)
    const totalPrev = Object.values(prevSamePeriodByCat).reduce((s, v) => s + v, 0)
    const topCategories = Object.entries(curByCat)
      .map(([id, amount]) => ({
        id,
        amount,
        label: categories[id]?.label || 'その他',
        pct: totalCur > 0 ? (amount / totalCur) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)

    const catKeys = new Set([...Object.keys(curByCat), ...Object.keys(prevSamePeriodByCat)])
    const momIncreases = [...catKeys]
      .map((id) => {
        const cur = curByCat[id] || 0
        const prev = prevSamePeriodByCat[id] || 0
        return {
          id,
          cur,
          prev,
          delta: cur - prev,
          label: categories[id]?.label || 'その他',
        }
      })
      .filter((x) => x.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 2)

    return {
      hasAnySlice: totalCur > 0 || Object.keys(prevSamePeriodByCat).length > 0,
      totalCur,
      totalPrev,
      topCategories,
      momIncreases,
    }
  }, [expenses])

  const monthlyTrendData = useMemo(() => {
    const now = new Date()
    const n = expenseTrendMonths === 'all' ? 120 : Math.max(1, Number(expenseTrendMonths) || 6)
    let monthKeys = []
    if (n >= 120) {
      const fromExpenses = (Array.isArray(expenses) ? expenses : [])
        .map((row) => {
          const dt = new Date(row?.spent_on || '')
          if (Number.isNaN(dt.getTime())) return null
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
        })
        .filter(Boolean)
      monthKeys = [...new Set(fromExpenses)].sort()
      if (monthKeys.length === 0) {
        for (let i = 5; i >= 0; i -= 1) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        }
      }
    } else {
      for (let i = n - 1; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
    }
    const byMonth = new Map(monthKeys.map((k) => [k, 0]))
    ;(Array.isArray(expenses) ? expenses : []).forEach((row) => {
      const dt = new Date(row?.spent_on || '')
      if (Number.isNaN(dt.getTime())) return
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      if (!byMonth.has(key)) return
      byMonth.set(key, byMonth.get(key) + Math.max(0, Number(row?.amount || 0)))
    })
    const showYear = monthKeys.length > 12
    return monthKeys.map((k) => {
      const [y, m] = k.split('-')
      const monthLabel = showYear ? `${Number(y) % 100}/${Number(m)}` : `${Number(m)}月`
      return { month: monthLabel, amount: byMonth.get(k) || 0 }
    })
  }, [expenses, expenseTrendMonths])

  const momVsPrevMonthPct = useMemo(() => {
    const previous = householdInsightMetrics.totalPrev
    if (!(previous > 0)) return null
    return ((householdInsightMetrics.totalCur - previous) / previous) * 100
  }, [householdInsightMetrics])

  const monthEndProjectionYen = useMemo(
    () => displayedMonthEndSpending(expenses, selectedTxMonth, new Date()),
    [expenses, selectedTxMonth],
  )

  const estimatedNetMonthlyIncomeYen = useMemo(
    () => Math.max(0, Number(annualIncomeManwon || 0)) * 10000 / 12,
    [annualIncomeManwon],
  )

  const savingsRateVsIncome = useMemo(() => {
    if (estimatedNetMonthlyIncomeYen <= 0) return null
    const net = estimatedNetMonthlyIncomeYen - summaryData.totalSpent
    return Math.max(-999, Math.min(999, (net / estimatedNetMonthlyIncomeYen) * 100))
  }, [estimatedNetMonthlyIncomeYen, summaryData.totalSpent])

  const selectedMonthTitleJp = useMemo(() => {
    if (!selectedTxMonth) return '—'
    const [y, m] = selectedTxMonth.split('-').map(Number)
    return `${y}年${m}月`
  }, [selectedTxMonth])

  const shiftTxMonth = useCallback((deltaTowardOlder) => {
    if (txMonthOptions.length === 0 || !selectedTxMonth) return
    const i = txMonthOptions.indexOf(selectedTxMonth)
    if (i < 0) return
    const nextIdx = i + deltaTowardOlder
    if (nextIdx < 0 || nextIdx >= txMonthOptions.length) return
    setSelectedTxMonth(txMonthOptions[nextIdx])
  }, [txMonthOptions, selectedTxMonth])

  const trendBarCss = useMemo(() => {
    const rows = monthlyTrendData
    if (!rows.length) return []
    const max = Math.max(1, ...rows.map((r) => Number(r.amount || 0)))
    return rows.map((r, i) => ({
      label: r.month,
      pct: Math.max(4, Math.round((Number(r.amount || 0) / max) * 100)),
      isCurrent: i === rows.length - 1,
    }))
  }, [monthlyTrendData])

  const trendAvgYen = useMemo(() => {
    const rows = monthlyTrendData
    if (!rows.length) return 0
    const sum = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
    return Math.round(sum / rows.length)
  }, [monthlyTrendData])

  const categoryEmoji = {
    food: '🍚',
    dining: '🍽',
    transport: '🚃',
    shopping: '📦',
    housing: '🏠',
    entertainment: '🎮',
    medical: '💊',
    education: '📚',
    travel: '✈️',
    fashion: '👔',
    pet: '🐕',
    misc: '⋯',
  }

  const handleSaveBudget = async () => {
    if (!budgetAppliesToSelectedMonth) return
    const next = Math.max(0, Number(tempBudget || 0))
    try {
      await onSaveBudgetTarget?.(next)
      setMonthlyBudget(next)
      setIsEditingBudget(false)
    } catch {
      /* 親が dataStatus。失敗時は編集モードのまま */
    }
  }
  /** 記録成功後（または新規追加モーダルオープン時）に共有フォームを初期値へ戻す */
  const resetExpenseFormForNewEntry = () => {
    setEditingTxId(null)
    setExpenseAmount('')
    setExpenseCategory('food')
    setExpensePaymentMethod('card')
    setExpenseDate(new Date().toISOString().split('T')[0])
    setExpenseName('')
    setExpenseRecurringType('none')
    setExpenseRecurringEndOn('')
    setEditingRecurringLocked(false)
    setEditingRecurringParentId('')
  }
  const openNewTransaction = () => {
    resetExpenseFormForNewEntry()
    setShowExpenseForm(true)
  }
  const commitRecurringEndDraftOnBlur = () => {
    const raw = expenseRecurringEndDraft.trim()
    if (!raw) {
      setExpenseRecurringEndOn('')
      setExpenseRecurringEndDraft('')
      return
    }
    const iso = parseHouseholdDateSlash(raw)
    if (iso) {
      setExpenseRecurringEndOn(iso)
      setExpenseRecurringEndDraft(formatHouseholdDateSlash(iso))
    } else {
      setExpenseRecurringEndDraft(expenseRecurringEndOn ? formatHouseholdDateSlash(expenseRecurringEndOn) : '')
    }
  }
  const openEditTransaction = (tx) => {
    const recurringMeta = resolveRecurringEditMeta(tx)
    setEditingTxId(tx.id)
    setExpenseAmount(String(tx.amount || ''))
    setExpenseCategory(categories[tx.category] ? tx.category : 'misc')
    setExpensePaymentMethod(tx.payment_method_key || toPaymentMethodKey(tx.payment_method))
    setExpenseDate(tx.date || new Date().toISOString().split('T')[0])
    setExpenseName(householdMemoText(tx) || String(tx.name || '').replace(/\s·\s定期$/, ''))
    setExpenseRecurringType(recurringMeta.recurringType || 'none')
    setExpenseRecurringEndOn(recurringMeta.recurringEndOn || '')
    setEditingRecurringLocked(Boolean(recurringMeta.locked))
    setEditingRecurringParentId(String(recurringMeta.parentId || ''))
    setShowExpenseForm(true)
  }
  const handleSaveTransaction = async (e) => {
    e.preventDefault()
    const amountNum = Math.max(0, Number(expenseAmount || 0))
    if (!user?.id || amountNum <= 0) return
    const spentDateIso = String(expenseDate || '').slice(0, 10)
    if (!HOUSEHOLD_ISO_DATE_RE.test(spentDateIso)) {
      alert('日付を選択してください')
      return
    }
    let recurringEndIso = ''
    if (expenseRecurringType !== 'none' && !editingRecurringLocked) {
      const raw = expenseRecurringEndDraft.trim()
      if (raw) {
        recurringEndIso = parseHouseholdDateSlash(raw)
        if (!recurringEndIso) {
          alert('繰り返し終了日は YYYY/MM/DD 形式で入力するか、未入力のままにしてください。')
          return
        }
      }
    }
    const payload = {
      spent_on: spentDateIso,
      category: categoryToDbLabel[expenseCategory] || 'その他',
      merchant: (expenseName || categories[expenseCategory]?.label || '手動入力').trim(),
      amount: amountNum,
      payment_method: toPaymentMethodLabel(expensePaymentMethod),
      notes: '',
    }
    // Close modal first to avoid perceived UI lag while network save runs.
    setShowExpenseForm(false)
    try {
      if (editingTxId) {
        if (!editingRecurringLocked) {
          const recurringType = expenseRecurringType === 'weekly' || expenseRecurringType === 'monthly'
            ? expenseRecurringType
            : null
          if (recurringType) {
            if (recurringEndIso && recurringEndIso < spentDateIso) {
              alert('繰り返し終了日は開始日以降を選択してください。')
              setShowExpenseForm(true)
              return
            }
            payload.recurring_type = recurringType
            payload.recurring_start_on = spentDateIso
            payload.recurring_anchor_day = recurringType === 'monthly'
              ? Math.max(1, Math.min(31, Number(String(spentDateIso || '').slice(8, 10) || 1)))
              : null
            payload.recurring_end_on = recurringEndIso || null
          } else {
            payload.recurring_type = null
            payload.recurring_start_on = null
            payload.recurring_anchor_day = null
            payload.recurring_end_on = null
          }
        }
        await onUpdateExpense?.(editingTxId, payload)
      } else {
        const recurringType = expenseRecurringType === 'weekly' || expenseRecurringType === 'monthly'
          ? expenseRecurringType
          : null
        if (recurringType) {
          if (recurringEndIso && recurringEndIso < spentDateIso) {
            alert('繰り返し終了日は開始日以降を選択してください。')
            setShowExpenseForm(true)
            return
          }
          payload.recurring_type = recurringType
          payload.recurring_start_on = spentDateIso
          payload.recurring_anchor_day = recurringType === 'monthly'
            ? Math.max(1, Math.min(31, Number(String(spentDateIso || '').slice(8, 10) || 1)))
            : null
          payload.recurring_end_on = recurringEndIso || null
          payload.recurring_parent_id = null
        }
        await onAddExpense?.({ user_id: user.id, ...payload })
      }
      resetExpenseFormForNewEntry()
    } catch {
      setShowExpenseForm(true)
      /* 親が dataStatus */
    }
  }

  const handleQuickAddExpense = async (e) => {
    e.preventDefault()
    const amountNum = Math.max(0, Number(expenseAmount || 0))
    if (!user?.id || amountNum <= 0) return
    const spentDateIso = String(expenseDate || '').slice(0, 10)
    if (!HOUSEHOLD_ISO_DATE_RE.test(spentDateIso)) {
      alert('日付を選択してください')
      return
    }
    const payload = {
      spent_on: spentDateIso,
      category: categoryToDbLabel[expenseCategory] || 'その他',
      merchant: (expenseName || categories[expenseCategory]?.label || '手動入力').trim(),
      amount: amountNum,
      payment_method: toPaymentMethodLabel(expensePaymentMethod),
      notes: '',
      recurring_type: null,
      recurring_start_on: null,
      recurring_anchor_day: null,
      recurring_end_on: null,
      recurring_parent_id: null,
    }
    try {
      await onAddExpense?.({ user_id: user.id, ...payload })
      resetExpenseFormForNewEntry()
    } catch {
      /* 親が dataStatus */
    }
  }

  const handleDeleteTransaction = async () => {
    if (!editingTxId) return
    try {
      await onDeleteExpense?.(editingTxId)
      setShowExpenseForm(false)
      resetExpenseFormForNewEntry()
    } catch {
      /* 親が dataStatus */
    }
  }
  const editingRecurringParentTx = useMemo(() => {
    if (!editingRecurringParentId) return null
    return transactionById.get(String(editingRecurringParentId)) || null
  }, [editingRecurringParentId, transactionById])
  const openNewExpiry = (initialType = 'point') => {
    setEditingExpiryId(null)
    setExpiryName('')
    setExpiryType(initialType === 'insurance' ? 'insurance' : 'point')
    setExpiryDateValue('')
    setExpiryAmount('')
    setShowExpiryForm(true)
  }
  const openEditExpiry = (exp) => {
    setEditingExpiryId(exp.id)
    setExpiryName(exp.name || '')
    setExpiryType(exp.type || 'point')
    setExpiryDateValue(exp.expiryDate || '')
    setExpiryAmount(String(exp.amount || ''))
    setShowExpiryForm(true)
  }
  const handleSaveExpiry = async (e) => {
    e.preventDefault()
    if (!user?.id || !expiryName || !expiryDateValue) return
    const amountNum = Math.max(0, Number(expiryAmount || 0))
    try {
      if (expiryType === 'point') {
        const payload = { name: expiryName.trim(), balance: amountNum, expiry: expiryDateValue || null }
        if (editingExpiryId?.startsWith('point-')) await onUpdatePointAccount?.(editingExpiryId.replace('point-', ''), payload)
        else await onAddPointAccount?.({ user_id: user.id, ...payload })
      } else {
        const payload = { product_name: expiryName.trim(), provider: '', monthly_premium: amountNum, maturity_date: expiryDateValue || null, coverage_summary: '' }
        if (editingExpiryId?.startsWith('insurance-')) await onUpdateInsurance?.(editingExpiryId.replace('insurance-', ''), payload)
        else await onAddInsurance?.({ user_id: user.id, ...payload })
      }
      setShowExpiryForm(false)
    } catch {
      /* 親が dataStatus */
    }
  }
  const handleDeleteExpiry = async () => {
    if (!editingExpiryId) return
    if (editingExpiryId.startsWith('point-')) await onDeletePointAccount?.(editingExpiryId.replace('point-', ''))
    if (editingExpiryId.startsWith('insurance-')) await onDeleteInsurance?.(editingExpiryId.replace('insurance-', ''))
    setShowExpiryForm(false)
  }

  const txMonthNavIndex = txMonthOptions.indexOf(selectedTxMonth)
  const canShiftMonthOlder = txMonthNavIndex >= 0 && txMonthNavIndex < txMonthOptions.length - 1
  const canShiftMonthNewer = txMonthNavIndex > 0

  const formatTxLedgerDayLabel = (iso) => {
    const d = String(iso || '').slice(0, 10)
    if (!d) return ''
    const today = new Date().toISOString().slice(0, 10)
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const [yy, mm, dd] = d.split('-').map(Number)
    if (d === today) return `今日 · ${mm}月${dd}日`
    if (d === yest) return `昨日 · ${mm}月${dd}日`
    return `${mm}月${dd}日`
  }

  const actionButtons = (
    <div className="flex flex-wrap gap-2 shrink-0 justify-end">
      <button
        type="button"
        onClick={() => openNewExpiry('point')}
        className="rounded-[10px] border-[1.5px] border-[#E8E2DC] bg-white px-3.5 py-2 text-[14px] font-semibold text-[#4A4540] hover:border-[#D4722A] hover:text-[#D4722A] transition-colors"
      >
        ＋ 期限・資産
      </button>
      <button
        type="button"
        onClick={openNewTransaction}
        className="rounded-[10px] bg-[#D4722A] px-4 py-2 text-[14px] font-bold text-white hover:opacity-90 transition-opacity shadow-[0_4px_14px_rgba(212,114,42,0.35)]"
      >
        ＋ 支出記録
      </button>
    </div>
  )

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-950 py-3 md:py-4 pb-28 text-[#1A1714] dark:text-slate-100 font-sans">
      <div className="w-full space-y-4 md:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 md:gap-4">
          <div>
            <p className="text-[11px] font-black tracking-[0.18em] text-[#D4722A] uppercase mb-0.5">家計管理</p>
            <h1 className="text-[28px] sm:text-[32px] font-black tracking-tight text-[#1A1714] leading-none">家計簿</h1>
            <p className="text-sm text-[#8A8480] mt-1 max-w-xl leading-snug">収支・予算・ポイント・保険をまとめて管理。繰り返し支出は「支出記録」フォームから設定します。</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-[#E8E2DC] bg-white px-3 py-2">
              <button
                type="button"
                aria-label="前の月"
                disabled={!canShiftMonthOlder}
                onClick={() => shiftTxMonth(1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#8A8480] hover:bg-slate-200 hover:text-[#1A1714] disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[7.5rem] text-center text-base font-black tabular-nums">{selectedMonthTitleJp}</span>
              <button
                type="button"
                aria-label="次の月"
                disabled={!canShiftMonthNewer}
                onClick={() => shiftTxMonth(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#8A8480] hover:bg-slate-200 hover:text-[#1A1714] disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="hidden sm:block">{actionButtons}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-2xl border-[1.5px] border-[#1A1714] bg-[#1A1714] px-4 py-3.5 md:px-5 md:py-4 shadow-[0_4px_24px_rgba(0,0,0,0.1)] text-white">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1">月内支出</p>
            <p className="text-[22px] sm:text-[26px] font-black tabular-nums leading-none">{formatCurrency(summaryData.totalSpent)}</p>
            <p className="text-xs text-white/55 mt-2 tabular-nums">月末支出の試算 {formatCurrency(monthEndProjectionYen)}</p>
            <p className="text-xs text-white/40 mt-1.5">
              先月比{' '}
              {momVsPrevMonthPct == null ? (
                '—'
              ) : (
                <span className={momVsPrevMonthPct > 0 ? 'text-[#E89560] font-bold' : 'text-emerald-300 font-bold'}>
                  {momVsPrevMonthPct > 0 ? '▲' : '▼'} {momVsPrevMonthPct > 0 ? '+' : ''}
                  {momVsPrevMonthPct.toFixed(1)}%
                </span>
              )}
            </p>
          </div>
          <div className="rounded-2xl border-[1.5px] border-[#E8E2DC] bg-white dark:bg-slate-900 px-4 py-3.5 md:px-5 md:py-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8A8480] dark:text-slate-400 mb-1">月次予算</p>
            {budgetAppliesToSelectedMonth ? (
              <>
                {!isEditingBudget ? (
                  <button type="button" onClick={() => setIsEditingBudget(true)} className="text-left w-full">
                    <p className="text-[22px] sm:text-[26px] font-black text-[#1A1714] tabular-nums leading-none">
                      {monthlyBudget > 0 ? formatCurrency(monthlyBudget) : '未設定'}
                    </p>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tempBudget}
                      onChange={(e) => setTempBudget(sanitizeNumericInput(e.target.value))}
                      className="w-32 rounded-lg border border-[#E8E2DC] bg-white px-2 py-1.5 text-lg font-black tabular-nums"
                      placeholder="例: 200000"
                    />
                    <button type="button" onClick={handleSaveBudget} className="rounded-lg bg-[#D4722A] px-3 py-1.5 text-xs font-bold text-white">
                      保存
                    </button>
                  </div>
                )}
                <div className="mt-2">
                  <div className="h-1.5 w-full rounded-full bg-[#E8E2DC] overflow-hidden">
                    <div className="h-full rounded-full bg-[#D4722A] transition-all" style={{ width: `${Math.min(100, summaryData.budgetUsagePercent)}%` }} />
                  </div>
                  <div className="mt-0.5 flex justify-between text-xs font-semibold text-[#8A8480]">
                    <span>使用 {summaryData.budgetUsagePercent.toFixed(1)}%</span>
                    <span className="tabular-nums">残 {formatCurrency(Math.max(0, monthlyBudget - summaryData.totalSpent))}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-[22px] sm:text-[26px] font-black text-[#1A1714] dark:text-slate-100 tabular-nums leading-none">
                  {monthlyBudget > 0 ? formatCurrency(monthlyBudget) : '未設定'}
                </p>
                <p className="text-[11px] text-[#8A8480] dark:text-slate-400 mt-1.5 leading-snug">
                  設定している予算は「暦の当月」の達成率だけに使います。過去月・未来月を表示しているときは、左の「月内支出」との比率は出しません。
                </p>
                <div className="mt-2">
                  <div className="h-1.5 w-full rounded-full bg-[#E8E2DC] dark:bg-slate-700 overflow-hidden">
                    <div className="h-full w-0 rounded-full bg-[#D4722A]" aria-hidden />
                  </div>
                  <div className="mt-0.5 flex justify-between text-xs font-semibold text-[#8A8480] dark:text-slate-500">
                    <span>使用 —</span>
                    <span className="tabular-nums">残 —</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="rounded-2xl border-[1.5px] border-[#E8E2DC] bg-white dark:bg-slate-900 px-4 py-3.5 md:px-5 md:py-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8A8480] dark:text-slate-400 mb-1">貯蓄率（参考）</p>
            <p className={`text-[22px] sm:text-[26px] font-black tabular-nums leading-none ${savingsRateVsIncome != null ? 'text-[#D4722A]' : 'text-[#8A8480]'}`}>
              {savingsRateVsIncome != null ? `${savingsRateVsIncome.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-[#8A8480] mt-1.5 tabular-nums">
              {savingsRateVsIncome != null
                ? `${formatCurrency(Math.max(0, estimatedNetMonthlyIncomeYen - summaryData.totalSpent))} 相当`
                : '年収未設定'}
            </p>
          </div>
        </div>

        <div className="flex gap-8 md:gap-10 border-b border-slate-200/50 dark:border-slate-700 pt-0.5">
          <button
            type="button"
            onClick={() => setHouseholdMainTab('flow')}
            className={`pb-2.5 text-base font-black transition-colors border-b-[3px] -mb-px ${
              householdMainTab === 'flow' ? 'border-[#1A1714] text-[#1A1714]' : 'border-transparent text-[#8A8480] hover:text-[#1A1714]'
            }`}
          >
            収支・カテゴリ
          </button>
          <button
            type="button"
            onClick={() => setHouseholdMainTab('assets')}
            className={`pb-2.5 text-base font-black transition-colors border-b-[3px] -mb-px ${
              householdMainTab === 'assets' ? 'border-[#D4722A] text-[#1A1714]' : 'border-transparent text-[#8A8480] hover:text-[#1A1714]'
            }`}
          >
            ポイント・保険
          </button>
        </div>

        <div className="sm:hidden">{actionButtons}</div>

        <div className="md:hidden fixed bottom-20 left-0 right-0 z-40 px-5 sm:px-6 py-3 bg-white/95 backdrop-blur-sm border-t border-[#E8E2DC] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] safe-area-pb">
          <div className="w-full flex gap-3 justify-center">{actionButtons}</div>
        </div>

        {householdMainTab === 'flow' ? (
          <>
        {currentMonthBudgetUsage.hasTarget ? (
          <div
            className={`rounded-xl border-[1.5px] px-4 py-3 ${
              currentMonthBudgetUsage.over80
                ? 'border-red-200 bg-[#FEF2F2] shadow-sm'
                : 'border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_1px_8px_rgba(0,0,0,0.05)]'
            }`}
            role="status"
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className={`rounded-xl p-2 shrink-0 ${currentMonthBudgetUsage.over80 ? 'bg-red-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Wallet size={22} className={currentMonthBudgetUsage.over80 ? 'text-red-600' : 'text-[#D4722A]'} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-black ${currentMonthBudgetUsage.over80 ? 'text-red-800' : 'text-[#1A1714]'}`}>
                  暦「今月」の予算対比{' '}
                  <span className={currentMonthBudgetUsage.over80 ? 'text-red-600' : 'text-[#D4722A]'}>
                    {currentMonthBudgetUsage.pct != null ? `${currentMonthBudgetUsage.pct.toFixed(1)}%` : '—'}
                  </span>
                </p>
                <p className={`text-xs mt-1 ${currentMonthBudgetUsage.over80 ? 'text-red-800' : 'text-[#4A4540]'}`}>
                  支出 {formatCurrency(currentMonthBudgetUsage.spent)} / 目標 {formatCurrency(currentMonthBudgetUsage.target)}
                </p>
                {currentMonthBudgetUsage.over80 ? (
                  <p className="text-xs font-bold text-red-700 mt-2">予算の80%に達しました。内訳を確認してください。</p>
                ) : (
                  <p className="text-xs text-[#8A8480] mt-1.5">一覧の「表示月」とは別に、今日までの今月分のみを集計しています。</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-7">
          {isPaidMember ? (
            <>
              <div className={`col-span-1 rounded-[18px] border-[1.5px] p-5 sm:p-6 shadow-sm relative overflow-hidden ${insightData.isSaving ? 'border-blue-200 bg-blue-50' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
                <div className="absolute top-4 right-4 text-6xl opacity-20">🐕</div>
                <p className={`text-sm leading-relaxed font-bold ${insightData.isSaving ? 'text-blue-800' : 'text-[#4A4540]'}`}>
                  ワン！先月同時期と比べて <span className="font-black">{formatCurrency(Math.abs(insightData.savedAmount))}</span> の
                  {insightData.isSaving ? '支出減' : '支出増'} だワン。
                </p>
                {hasUrgentAlert && <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-100/50 px-3 py-1.5 rounded-lg"><AlertTriangle size={14} /> 30日以内に満期項目あり</div>}
              </div>
              <div className="col-span-1 lg:col-span-2 bg-[#1A1714] rounded-[18px] p-5 sm:p-7 text-white shadow-lg relative overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="text-[#E89560] shrink-0" size={18} aria-hidden />
                  <h3 className="text-sm font-bold text-white/50 tracking-wide">家計インサイト（暦・今月）</h3>
                </div>
                <p className="text-xs text-white/40 mb-4">今月の支出（暦・本日まで）をカテゴリ別に集計。前月は同日までの同時期と比較しています。</p>
                {householdInsightMetrics.totalCur > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                    {householdInsightMetrics.topCategories.map((c) => (
                      <div key={c.id} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                        <p className="text-xs font-bold text-white/40 truncate">{c.label}</p>
                        <p className="text-lg font-black text-white mt-1 tabular-nums">{formatCurrency(c.amount)}</p>
                        <p className="text-xs text-white/40 mt-0.5 tabular-nums">{c.pct.toFixed(1)}% / 今月合計</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/40 mb-5">
                    {householdInsightMetrics.hasAnySlice
                      ? '今月（暦）の支出記録がまだありません。'
                      : '支出データがまだありません。'}
                  </p>
                )}
                {householdInsightMetrics.momIncreases.length > 0 ? (
                  <div className="mb-5 rounded-2xl bg-[#D4722A]/15 border border-[#D4722A]/30 px-4 py-3">
                    <p className="text-xs font-bold text-[#E89560] mb-2">前月同時期より増加したカテゴリ</p>
                    <ul className="space-y-2">
                      {householdInsightMetrics.momIncreases.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="text-white/80 font-medium">{x.label}</span>
                          <span className="text-[#E89560] font-black tabular-nums">
                            +{formatCurrency(x.delta)}
                            <span className="text-xs font-normal text-white/40 ml-1">（前 {formatCurrency(x.prev)} → 今 {formatCurrency(x.cur)}）</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {insightData.isSaving ? (
                  <div className={householdInsightMetrics.totalCur > 0 || householdInsightMetrics.momIncreases.length > 0 ? 'pt-2 border-t border-white/10' : ''}>
                    <p className="text-sm text-white/50 mb-2">削減できた支出を投資に回した場合の参考シミュレーション</p>
                    <div className="flex items-end gap-3 mt-4">
                      <p className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-emerald-100 tracking-tight">{formatCurrency(insightData.simulatedFutureValue)}</p>
                      <p className="text-sm text-white/40 mb-2">/ {insightData.years}年後</p>
                    </div>
                    <p className="mt-2 text-xs text-white/40">※ 固定利回りを仮定した参考値であり、将来の結果を保証しません。</p>
                  </div>
                ) : (
                  <p className="text-sm text-white/40">
                    {householdInsightMetrics.totalCur > 0
                      ? '先月同時期より支出が増えています。上位カテゴリを確認してください。'
                      : '先月同時期より支出が増えています。'}
                  </p>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (typeof onUiMessage === 'function') onUiMessage('家計インサイト詳細はプレミアム限定です。', 'premium')
                navigate('/premium')
              }}
              className="col-span-1 lg:col-span-3 rounded-[18px] border-[1.5px] border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-7 text-left shadow-sm hover:border-[#D4722A] transition-colors"
            >
              <div className="flex items-center gap-2 text-[#D4722A]">
                <Sparkles size={16} />
                <p className="text-sm font-black tracking-wide uppercase">プレミアム・インサイト</p>
              </div>
              <p className="mt-3 text-lg font-black text-[#1A1714]">暦ベースの詳細インサイトはプレミアムでご利用いただけます。</p>
              <p className="mt-2 text-sm text-[#4A4540]">カテゴリ上位や前月同時期との差分などを表示します。</p>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(300px,28rem)] gap-4 md:gap-5 items-start">
          <div className="space-y-3 md:space-y-4 min-w-0">
            <div className="rounded-[18px] border-[1.5px] border-[#E8E2DC] bg-white dark:bg-slate-900 p-4 md:p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-base font-black text-[#1A1714]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[15px]">🗂</span>
                  カテゴリ別内訳
                </div>
                <span className="text-sm font-bold text-[#8A8480]">{selectedMonthTitleJp} 合計</span>
              </div>
              {summaryData.totalSpent > 0 ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 items-center sm:items-start mb-3">
                    <div className="w-36 h-36 shrink-0 rounded-full relative ring-4 ring-slate-100" style={{ background: `conic-gradient(${summaryData.pieGradientStops})` }}>
                      <div className="absolute inset-0 m-auto w-[5.5rem] h-[5.5rem] bg-white rounded-full flex flex-col items-center justify-center border border-[#E8E2DC] shadow-sm">
                        <span className="text-sm font-black text-[#1A1714] tabular-nums leading-tight text-center px-1">{formatCurrency(summaryData.totalSpent)}</span>
                        <span className="text-[11px] text-[#8A8480]">支出計</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2 w-full">
                      {summaryData.sortedCategories.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-2 text-sm">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: categories[cat.id]?.hex }} />
                          <span className="flex-1 truncate text-[#4A4540] font-semibold">{categories[cat.id]?.label}</span>
                          <span className="font-black tabular-nums text-[#1A1714]">{formatCurrency(cat.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {summaryData.sortedCategories.map((cat) => (
                      <div key={`bar-${cat.id}`} className="flex w-full items-center gap-3 rounded-xl border border-[#E8E2DC] bg-slate-50 p-2.5">
                        <span className="text-xl shrink-0">{categoryEmoji[cat.id] || '📦'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#1A1714]">{categories[cat.id]?.label}</p>
                          <div className="mt-1 h-1 rounded-full bg-[#E8E2DC] overflow-hidden">
                            <div className="h-full rounded-full bg-[#D4722A]" style={{ width: `${Math.min(100, cat.percent)}%` }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-black tabular-nums text-[#1A1714]">{formatCurrency(cat.amount)}</p>
                          <p className="text-xs font-semibold text-[#8A8480]">{cat.percent.toFixed(0)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center py-8 text-[#8A8480] text-sm border border-dashed border-[#E8E2DC] rounded-xl">データがありません</p>
              )}
            </div>

            <div className="rounded-[18px] border-[1.5px] border-[#E8E2DC] bg-white dark:bg-slate-900 p-4 md:p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-base font-black text-[#1A1714]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[15px]">📈</span>
                  月別支出トレンド
                </div>
                <select value={expenseTrendMonths} onChange={(e) => setExpenseTrendMonths(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="rounded-lg border border-[#E8E2DC] bg-white px-2 py-1.5 text-sm font-bold text-[#4A4540]">
                  <option value={3}>3ヶ月</option>
                  <option value={6}>6ヶ月</option>
                  <option value={12}>12ヶ月</option>
                  <option value={24}>24ヶ月</option>
                  <option value="all">全期間</option>
                </select>
              </div>
              <div className="flex items-end gap-2 h-[100px] px-1">
                {trendBarCss.map((b) => (
                  <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end min-w-0">
                    <div className="w-full flex flex-col justify-end h-[72px]">
                      <div className={`w-full rounded-t-md transition-all ${b.isCurrent ? 'bg-[#D4722A]' : 'bg-[#E8E2DC]'}`} style={{ height: `${b.pct}%` }} />
                    </div>
                    <span className={`text-[11px] font-bold truncate max-w-full text-center ${b.isCurrent ? 'text-[#D4722A]' : 'text-[#8A8480]'}`}>{b.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-right text-xs font-bold text-[#8A8480] mt-1.5 tabular-nums">平均 {formatCurrency(trendAvgYen)} / 期間</p>
            </div>
          </div>

          <div className="space-y-3 md:space-y-4 min-w-0">
            <form onSubmit={handleQuickAddExpense} className="rounded-[18px] bg-[#1A1714] p-4 md:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.12)] space-y-3">
              <p className="text-sm font-bold text-white/50 tracking-wide">支出を記録する</p>
              <div>
                <p className="text-xs font-bold text-white/40 uppercase mb-1">金額</p>
                <input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="w-full rounded-[10px] border border-white/15 bg-white/10 px-3 py-2.5 text-lg font-black text-white placeholder:text-white/25" placeholder="0" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs font-bold text-white/40 uppercase mb-1">カテゴリ</p>
                  <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} className="w-full rounded-[10px] border border-white/15 bg-white/10 px-2 py-2.5 text-sm font-bold text-white">
                    {Object.keys(categories).map((k) => (
                      <option key={k} value={k} className="bg-[#1A1714]">{categories[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-bold text-white/40 uppercase mb-1">日付</p>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className={`w-full rounded-[10px] border border-white/15 bg-white/10 px-2 py-2.5 text-sm text-white ${myPageNativeDateInputTouchClass}`}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-white/40 uppercase mb-1">メモ（任意）</p>
                <input type="text" value={expenseName} onChange={(e) => setExpenseName(e.target.value)} className="w-full rounded-[10px] border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/25" placeholder="店名・内容" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setExpensePaymentMethod('card')} className={`rounded-[10px] py-2 text-sm font-bold ${expensePaymentMethod === 'card' ? 'bg-[#D4722A] text-white' : 'bg-white/10 text-white/60 border border-white/10'}`}>カード</button>
                <button type="button" onClick={() => setExpensePaymentMethod('cash')} className={`rounded-[10px] py-2 text-sm font-bold ${expensePaymentMethod === 'cash' ? 'bg-[#D4722A] text-white' : 'bg-white/10 text-white/60 border border-white/10'}`}>現金</button>
              </div>
              <button type="submit" disabled={expenseSaving} className="w-full rounded-xl bg-[#D4722A] py-3 text-base font-black text-white disabled:opacity-50">＋ 記録する</button>
              <button type="button" onClick={openNewTransaction} className="w-full rounded-xl border border-white/15 py-2.5 text-sm font-bold text-white/70 hover:bg-white/5">繰り返し・編集は詳細フォームへ</button>
            </form>

            <div className="rounded-[18px] border-[1.5px] border-[#E8E2DC] bg-white dark:bg-slate-900 p-4 md:p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 text-base font-black text-[#1A1714]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[15px]">📋</span>
                  取引履歴
                </div>
                <select value={selectedTxMonth} onChange={(e) => setSelectedTxMonth(e.target.value)} className="rounded-lg border border-[#E8E2DC] bg-white px-2 py-1.5 text-sm font-bold text-[#4A4540] shrink-0">
                  {txMonthOptions.length === 0 ? <option value="">月</option> : txMonthOptions.map((m) => (
                    <option key={m} value={m}>{Number(String(m).split('-')[1])}月</option>
                  ))}
                </select>
              </div>
              {filteredTransactions.length > 0 ? (
                <p className="text-xs font-bold text-[#8A8480] mb-1.5">
                  {filteredTransactions.length}件中 {(txLedgerPageSafe - 1) * EXPENSE_LEDGER_PAGE_SIZE + 1}–{Math.min(txLedgerPageSafe * EXPENSE_LEDGER_PAGE_SIZE, filteredTransactions.length)} 件
                </p>
              ) : null}
              <div className="space-y-2 max-h-[min(520px,55vh)] overflow-y-auto pr-1">
                {filteredTransactions.length === 0 ? (
                  <p className="text-center text-sm text-[#8A8480] py-6 border border-dashed border-[#E8E2DC] rounded-xl">取引がありません</p>
                ) : (
                  pagedFilteredTransactions.map((t, idx) => {
                    const prev = idx > 0 ? pagedFilteredTransactions[idx - 1] : null
                    const showDate = !prev || prev.date !== t.date
                    return (
                      <Fragment key={t.id}>
                        {showDate ? (
                          <p className="text-xs font-bold text-[#8A8480] uppercase tracking-wide pl-0.5 pt-1">{formatTxLedgerDayLabel(t.date)}</p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEditTransaction(t)}
                          className="flex w-full items-center gap-2 rounded-xl border border-[#E8E2DC] bg-slate-50 p-2.5 text-left hover:bg-white hover:border-[#D4722A] transition-colors"
                        >
                          <span className="text-lg shrink-0">{categoryEmoji[t.category] || '📦'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-[#1A1714] truncate">{t.name}</p>
                            <p className="text-xs font-semibold text-[#8A8480]">{(categories[t.category] || categories.misc).label}</p>
                          </div>
                          <span className="text-base font-black text-[#991B1B] tabular-nums shrink-0">−{formatCurrency(t.amount)}</span>
                        </button>
                      </Fragment>
                    )
                  })
                )}
              </div>
              {txLedgerPageCount > 1 ? (
                <div className="mt-3 pt-2 flex flex-wrap items-center justify-center gap-1.5 border-t border-[#E8E2DC]">
                  <button type="button" onClick={() => setTxLedgerPage((p) => Math.max(1, p - 1))} disabled={txLedgerPageSafe <= 1} className="min-h-[32px] px-2 rounded-lg border border-[#E8E2DC] text-sm font-bold text-[#4A4540] disabled:opacity-40">前へ</button>
                  {txLedgerPageButtons.map((item, idx) =>
                    item === '…' ? (
                      <span key={`tx-el-${idx}`} className="text-sm text-[#8A8480]">…</span>
                    ) : (
                      <button
                        key={`tx-p-${item}`}
                        type="button"
                        onClick={() => setTxLedgerPage(item)}
                        className={`min-h-[32px] min-w-[32px] rounded-lg text-sm font-black ${item === txLedgerPageSafe ? 'bg-[#D4722A] text-white' : 'border border-[#E8E2DC] text-[#1A1714]'}`}
                      >
                        {item}
                      </button>
                    ),
                  )}
                  <button type="button" onClick={() => setTxLedgerPage((p) => Math.min(txLedgerPageCount, p + 1))} disabled={txLedgerPageSafe >= txLedgerPageCount} className="min-h-[32px] px-2 rounded-lg border border-[#E8E2DC] text-sm font-bold disabled:opacity-40">次へ</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
          </>
        ) : (
          <>
            <div className="rounded-[18px] bg-[#1A1714] px-4 py-4 text-white shadow-lg">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
                <div className="sm:border-r sm:border-white/10 sm:pr-3">
                  <p className="text-xs font-bold text-white/40 uppercase">ポイント合計</p>
                  <p className="text-lg font-black tabular-nums mt-1">{formatNumber(pointsInsuranceStrip.totalPt)} pt</p>
                </div>
                <div className="sm:border-r sm:border-white/10 sm:pr-3">
                  <p className="text-xs font-bold text-[#E89560] uppercase">30日以内注意</p>
                  <p className="text-lg font-black text-[#E89560] tabular-nums mt-1">{formatNumber(pointsInsuranceStrip.expiringSoonPt)} pt</p>
                </div>
                <div className="sm:border-r sm:border-white/10 sm:pr-3">
                  <p className="text-xs font-bold text-white/40 uppercase">保険 月額計</p>
                  <p className="text-lg font-black tabular-nums mt-1">{formatCurrency(pointsInsuranceStrip.insMonthly)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-white/40 uppercase">次の期限まで</p>
                  <p className="text-lg font-black text-[#E89560] tabular-nums mt-1">{pointsInsuranceStrip.nextDays != null ? `${pointsInsuranceStrip.nextDays}日` : '—'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              <div className="rounded-[18px] border-[1.5px] border-[#E8E2DC] bg-white dark:bg-slate-900 p-4 md:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 font-black text-[#1A1714] text-base">
                    <Gift size={18} className="text-[#D4722A]" />
                    ポイント管理
                  </div>
                  <button type="button" onClick={() => openNewExpiry('point')} className="text-sm font-black text-[#D4722A]">＋ 追加</button>
                </div>
                <div className="space-y-2">
                  {processedExpiries.filter((e) => e.type === 'point').length === 0 ? (
                    <p className="text-sm text-[#8A8480] py-6 text-center border border-dashed border-[#E8E2DC] rounded-xl">登録がありません</p>
                  ) : (
                    processedExpiries.filter((e) => e.type === 'point').map((exp) => (
                      <button key={exp.id} type="button" onClick={() => openEditExpiry(exp)} className="flex w-full items-center gap-3 rounded-xl border border-[#E8E2DC] bg-white p-3 text-left hover:border-[#D4722A] transition-colors">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600">
                          <CreditCard size={20} className="text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#1A1714] truncate">{exp.name}</p>
                          {exp.isAlert ? (
                            <p className="text-xs font-bold text-red-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={12} /> 期限が近いです</p>
                          ) : (
                            <p className="text-xs text-[#8A8480]">{exp.expiryDate || '期限未設定'}</p>
                          )}
                        </div>
                        <span className="text-sm font-black tabular-nums text-[#1A1714]">{formatNumber(exp.amount)} P</span>
                      </button>
                    ))
                  )}
                </div>
                <button type="button" onClick={() => openNewExpiry('point')} className="mt-3 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D4722A]/40 bg-slate-50 py-4 text-[#D4722A] hover:bg-slate-100 transition-colors">
                  <Plus size={24} className="mb-1" />
                  <span className="text-base font-black">ポイントを追加</span>
                </button>
              </div>

              <div className="rounded-[18px] border-[1.5px] border-[#E8E2DC] bg-white dark:bg-slate-900 p-4 md:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 font-black text-[#1A1714] text-base">
                    <ShieldCheck size={18} className="text-emerald-600" />
                    保険管理
                  </div>
                  <button type="button" onClick={() => openNewExpiry('insurance')} className="text-sm font-black text-[#D4722A]">＋ 追加</button>
                </div>
                <div className="space-y-3">
                  {processedExpiries.filter((e) => e.type === 'insurance').length === 0 ? (
                    <p className="text-sm text-[#8A8480] py-6 text-center border border-dashed border-[#E8E2DC] rounded-xl">登録がありません</p>
                  ) : (
                    processedExpiries.filter((e) => e.type === 'insurance').map((exp) => (
                      <button key={exp.id} type="button" onClick={() => openEditExpiry(exp)} className="w-full rounded-xl border border-[#E8E2DC] bg-white p-4 text-left hover:border-emerald-500/50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-bold text-[#8A8480]">保険</span>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">有効</span>
                        </div>
                        <p className="text-base font-black text-[#1A1714]">{exp.name}</p>
                        <div className="mt-3 space-y-2 border-t border-[#E8E2DC] pt-3 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="text-[#8A8480]">月額保険料</span>
                            <span className="font-black tabular-nums">{formatCurrency(exp.amount)}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-[#8A8480]">満期・更新</span>
                            <span className="font-bold tabular-nums">{exp.expiryDate || '—'}</span>
                          </div>
                          {exp.coverageSummary ? (
                            <div className="flex justify-between gap-2">
                              <span className="text-[#8A8480]">補償メモ</span>
                              <span className="font-medium text-right line-clamp-2">{exp.coverageSummary}</span>
                            </div>
                          ) : null}
                        </div>
                        {exp.daysLeft >= 0 && exp.daysLeft <= 365 ? (
                          <p className="mt-2 text-sm font-black text-red-600">残り{exp.daysLeft}日</p>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
                <button type="button" onClick={() => openNewExpiry('insurance')} className="mt-3 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E8E2DC] bg-slate-50 py-4 text-[#8A8480] hover:border-[#D4722A] hover:text-[#D4722A] transition-colors">
                  <Plus size={24} className="mb-1" />
                  <span className="text-base font-black">保険を追加</span>
                </button>
              </div>
            </div>
          </>
        )}

        {showExpenseForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-y-contain bg-gray-900/60 backdrop-blur-sm p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="my-auto flex w-full max-w-md min-h-0 max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                <h3 className="flex items-center gap-2 font-bold text-gray-900">
                  <PieChart size={18} className="text-[#3b66f5]" /> {editingTxId ? '支出を編集' : '支出を追加'}
                </h3>
                <button type="button" onClick={() => setShowExpenseForm(false)} className="rounded-full bg-white p-2 transition-colors hover:bg-gray-200">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSaveTransaction} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 pt-6">
                  <input type="number" required value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-2xl font-black rounded-xl px-4 py-3" placeholder="金額" />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className={`bg-gray-50 border border-gray-200 font-bold rounded-xl px-3 py-3 text-gray-900 ${myPageNativeDateInputTouchClass}`}
                    />
                    <input type="text" value={expenseName} onChange={(e) => setExpenseName(e.target.value)} className="bg-gray-50 border border-gray-200 font-bold rounded-xl px-3 py-3" placeholder="メモ・内容" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-2">支払い方法</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setExpensePaymentMethod('card')}
                        className={`py-3 rounded-xl border text-sm font-bold transition ${
                          expensePaymentMethod === 'card'
                            ? 'bg-white border-[#3b66f5] text-[#3b66f5]'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        カード
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpensePaymentMethod('cash')}
                        className={`py-3 rounded-xl border text-sm font-bold transition ${
                          expensePaymentMethod === 'cash'
                            ? 'bg-white border-[#3b66f5] text-[#3b66f5]'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        現金
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.keys(categories).map((key) => {
                    const cat = categories[key]
                    const Icon = cat.icon
                    return (
                      <button key={key} type="button" onClick={() => setExpenseCategory(key)} className={`flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-bold transition ${expenseCategory === key ? 'bg-white border-[#3b66f5] text-[#3b66f5]' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${expenseCategory === key ? 'bg-[#3b66f5]/10' : 'bg-gray-200/60'}`}><Icon size={18} className={expenseCategory === key ? 'text-[#3b66f5]' : 'text-gray-500'} /></span>
                        <span className="text-left leading-tight">{cat.label}</span>
                      </button>
                    )
                  })}</div>
                  <div className="space-y-2 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-gray-500">繰り返し設定</p>
                      {editingTxId && expenseRecurringType !== 'none' ? (
                        <span className="text-[10px] font-black rounded-full bg-blue-50 text-blue-700 px-2 py-0.5">
                          定期: {recurringTypeLabel(expenseRecurringType)}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'none', label: 'なし' },
                        { key: 'weekly', label: '毎週' },
                        { key: 'monthly', label: '毎月' },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          disabled={editingRecurringLocked}
                          onClick={() => setExpenseRecurringType(item.key)}
                          className={`py-2 rounded-xl border text-xs font-bold transition ${
                            expenseRecurringType === item.key
                              ? 'bg-white border-[#3b66f5] text-[#3b66f5]'
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                          } ${editingRecurringLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    {expenseRecurringType !== 'none' && (
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        disabled={editingRecurringLocked}
                        value={expenseRecurringEndDraft}
                        onChange={(e) => setExpenseRecurringEndDraft(e.target.value)}
                        onBlur={commitRecurringEndDraftOnBlur}
                        className={`w-full bg-gray-50 border border-gray-200 font-bold rounded-xl px-3 py-3 ${myPageNativeDateInputTouchClass} ${editingRecurringLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="終了日（任意）YYYY/MM/DD"
                      />
                    )}
                    {editingRecurringLocked ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[11px] font-bold text-amber-800">
                          この取引は定期支出から自動生成された明細です。繰り返し設定は原本で編集できます。
                        </p>
                        {editingRecurringParentTx ? (
                          <button
                            type="button"
                            onClick={() => openEditTransaction(editingRecurringParentTx)}
                            className="mt-2 text-[11px] font-black text-blue-700 underline"
                          >
                            原本（{String(editingRecurringParentTx?.date || '').replaceAll('-', '/')}）を編集
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400">
                        繰り返しを設定すると、同じ金額/カテゴリで今後の月・週に自動登録されます。
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-3 border-t border-gray-100 bg-white px-6 pb-6 pt-3 mt-0">
                  {editingTxId && <button type="button" onClick={handleDeleteTransaction} disabled={expenseSaving} className="px-4 bg-red-50 text-red-600 rounded-xl font-bold disabled:opacity-60"><Trash2 size={20} /></button>}
                  <button type="submit" disabled={expenseSaving} className="flex-1 bg-[#1e2330] text-white font-bold text-[15px] py-3.5 rounded-xl shadow-md disabled:opacity-60">{editingTxId ? '更新する' : '記録する'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showExpiryForm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"><h3 className="font-bold text-gray-900 flex items-center gap-2"><Bell size={18} className="text-[#3b66f5]" /> 期限・資産の設定</h3><button onClick={() => setShowExpiryForm(false)} className="p-2 bg-white hover:bg-gray-200 rounded-full transition-colors"><X size={18} className="text-gray-500" /></button></div>
              <form onSubmit={handleSaveExpiry} className="p-6 space-y-4">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setExpiryType('point')} className={`flex-1 py-3 rounded-xl border text-sm font-bold ${expiryType === 'point' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' : 'bg-gray-50 border-gray-200'}`}>ポイント</button>
                  <button type="button" onClick={() => setExpiryType('insurance')} className={`flex-1 py-3 rounded-xl border text-sm font-bold ${expiryType === 'insurance' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-200'}`}>保険</button>
                </div>
                <input type="text" required value={expiryName} onChange={(e) => setExpiryName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 font-bold rounded-xl px-4 py-3" placeholder="名称" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" required value={expiryDateValue} onChange={(e) => setExpiryDateValue(e.target.value)} className={`w-full bg-gray-50 border border-gray-200 font-bold rounded-xl px-3 py-3 ${myPageNativeDateInputTouchClass}`} />
                  <input type="number" required value={expiryAmount} onChange={(e) => setExpiryAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-200 font-bold rounded-xl px-3 py-3" placeholder={expiryType === 'point' ? 'ポイント残高' : '納入額'} />
                </div>
                <div className="pt-3 mt-2 border-t border-gray-100 flex gap-3">
                  {editingExpiryId && <button type="button" onClick={handleDeleteExpiry} disabled={insuranceSaving || pointSaving} className="px-4 bg-red-50 text-red-600 rounded-xl font-bold disabled:opacity-60"><Trash2 size={20} /></button>}
                  <button type="submit" disabled={insuranceSaving || pointSaving} className="flex-1 bg-[#3b66f5] text-white font-bold text-[15px] py-3.5 rounded-xl shadow-md disabled:opacity-60">保存する</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-4 shadow-sm shadow-slate-900/5">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-1.5 font-medium">
            <p>{MM_SIMULATION_PAST_PERFORMANCE_JA}</p>
            <p>※ 投資シミュレーションは過去平均に基づく参考値であり、将来利益を保証しません。</p>
            <p>※ マネマートは客観データを提供するプラットフォームであり、特定の金融商品の売買を勧誘するものではありません。</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const DebtSection = ({
  annualIncome = 0,
  debtRemainingYen = 0,
  onDebtRemainingChange,
  onSaveDebtRemaining,
  onAnnualIncomeChange,
  onSaveAnnualIncome,
  profileSaving,
  onOpenLoanDiagnosis,
}) => {
  const [extraMonthlyYen, setExtraMonthlyYen] = useState(0)
  const [incomeDropPct, setIncomeDropPct] = useState(20)
  const [annualIncomeInput, setAnnualIncomeInput] = useState(String(Math.max(0, Number(annualIncome || 0))))
  const [debtRemainingInput, setDebtRemainingInput] = useState(String(Math.round(Math.max(0, Number(debtRemainingYen || 0)) / 10000)))
  const principalYen = Math.max(0, Number(debtRemainingYen || 0))
  const remainingYears = 30
  const currentRate = 0.9

  const baseMonthlyYen = calcMonthlyPayment(principalYen, currentRate, remainingYears)
  const annualRepaymentManwon = (baseMonthlyYen * 12) / 10000

  const dtiBase = annualIncome > 0 ? (annualRepaymentManwon / annualIncome) * 100 : 0
  const reducedIncome = annualIncome * (1 - Math.max(0, Number(incomeDropPct || 0)) / 100)
  const dtiIncomeDown = reducedIncome > 0 ? (annualRepaymentManwon / reducedIncome) * 100 : 0
  const dti = dtiBase.toFixed(1)
  const dtiNumeric = Number(dti)
  const dtiMeta = getDtiMeta(dtiNumeric)
  const dtiPointerLeft = Math.max(0, Math.min(100, (dtiNumeric / DTI_VISUAL_MAX) * 100))
  const scenarioDti = Number(dtiIncomeDown.toFixed(1))
  const scenarioDtiMeta = getDtiMeta(scenarioDti)
  const scenarioDtiPointerLeft = Math.max(0, Math.min(100, (scenarioDti / DTI_VISUAL_MAX) * 100))
  const rateSteps = Array.from({ length: 7 }, (_, idx) => 1 + (idx * 0.5))
  const rateBarColors = ['#1d4ed8', '#2563eb', '#0ea5e9', '#22c55e', '#84cc16', '#facc15', '#f59e0b']
  const interestRateTrendData = rateSteps.map((rate, idx) => ({
    rate,
    rateLabel: `${rate}%`,
    monthlyYen: Math.round(calcMonthlyPayment(principalYen, rate, remainingYears)),
    fill: rateBarColors[idx],
  }))
  const monthlyAt1PctYen = Number(interestRateTrendData.find((row) => Number(row.rate) === 1)?.monthlyYen || 0)
  const monthlyAt2PctYen = Number(interestRateTrendData.find((row) => Number(row.rate) === 2)?.monthlyYen || 0)
  const onePctIncreaseYen = Math.max(0, monthlyAt2PctYen - monthlyAt1PctYen)

  useEffect(() => {
    setAnnualIncomeInput(String(Math.max(0, Number(annualIncome || 0))))
  }, [annualIncome])

  useEffect(() => {
    setDebtRemainingInput(String(Math.round(Math.max(0, Number(debtRemainingYen || 0)) / 10000)))
  }, [debtRemainingYen])

  const runRepaymentSimulation = (balance, annualRatePct, monthlyPayment) => {
    const monthlyRate = (annualRatePct / 100) / 12
    let remain = Math.max(0, Number(balance || 0))
    let month = 0
    let cumulativeInterestYen = 0
    const maxMonths = 1200
    const rows = [{ month: 0, remainYen: remain, cumulativeInterestYen: 0, principalPaidYen: 0, interestYen: 0 }]
    while (remain > 0 && month < maxMonths) {
      const interestYen = remain * monthlyRate
      const principalYen = monthlyPayment - interestYen
      if (principalYen <= 0) break
      const principalPaidYen = Math.min(remain, principalYen)
      remain -= principalPaidYen
      month += 1
      cumulativeInterestYen += interestYen
      rows.push({
        month,
        remainYen: Math.max(0, remain),
        cumulativeInterestYen,
        principalPaidYen,
        interestYen,
      })
    }
    return {
      monthsToPayoff: month,
      totalInterestYen: Math.max(0, Math.round(cumulativeInterestYen)),
      rows,
    }
  }
  const buildRemainingCompositionSeries = (simulation) => {
    const totalInterestYen = Math.max(0, Number(simulation?.totalInterestYen || 0))
    return (simulation?.rows || []).map((row) => ({
      month: row.month,
      remainPrincipalManwon: Math.round(Math.max(0, Number(row.remainYen || 0)) / 10000),
      remainInterestManwon: Math.round(Math.max(0, totalInterestYen - Number(row.cumulativeInterestYen || 0)) / 10000),
    }))
  }
  const buildYearlyAmortizationSeries = (baseSim, acceleratedSim) => {
    const baseRows = Array.isArray(baseSim?.rows) ? baseSim.rows : []
    const acceleratedRows = Array.isArray(acceleratedSim?.rows) ? acceleratedSim.rows : []
    const maxMonth = Math.max(
      Number(baseRows[baseRows.length - 1]?.month || 0),
      Number(acceleratedRows[acceleratedRows.length - 1]?.month || 0),
    )
    const maxYear = Math.max(1, Math.ceil(maxMonth / 12))
    const data = []
    for (let year = 1; year <= maxYear; year += 1) {
      const endMonth = year * 12
      const startMonth = endMonth - 11
      const yearRows = acceleratedRows.filter((r) => Number(r.month || 0) >= startMonth && Number(r.month || 0) <= endMonth)
      const principalYen = yearRows.reduce((s, r) => s + Math.max(0, Number(r.principalPaidYen || 0)), 0)
      const interestYen = yearRows.reduce((s, r) => s + Math.max(0, Number(r.interestYen || 0)), 0)
      const baseAtYearEnd = [...baseRows].reverse().find((r) => Number(r.month || 0) <= endMonth) || baseRows[baseRows.length - 1] || { remainYen: 0 }
      const acceleratedAtYearEnd = [...acceleratedRows].reverse().find((r) => Number(r.month || 0) <= endMonth) || acceleratedRows[acceleratedRows.length - 1] || { remainYen: 0 }
      data.push({
        yearLabel: `${year}年`,
        principalManwon: Math.round(principalYen / 10000),
        interestManwon: Math.round(interestYen / 10000),
        balanceBaseManwon: Math.round(Math.max(0, Number(baseAtYearEnd.remainYen || 0)) / 10000),
        balanceScenarioManwon: Math.round(Math.max(0, Number(acceleratedAtYearEnd.remainYen || 0)) / 10000),
      })
    }
    return data
  }

  const acceleratedPaymentYen = baseMonthlyYen + Math.max(0, Number(extraMonthlyYen || 0))
  const baseSimulation = runRepaymentSimulation(principalYen, currentRate, baseMonthlyYen)
  const acceleratedSimulation = runRepaymentSimulation(principalYen, currentRate, acceleratedPaymentYen)
  const baseMonthsToPayoff = baseSimulation.monthsToPayoff
  const acceleratedMonthsToPayoff = acceleratedSimulation.monthsToPayoff
  const reducedMonths = Math.max(0, baseMonthsToPayoff - acceleratedMonthsToPayoff)
  const baseTotalInterestYen = Math.max(0, Number(baseSimulation.totalInterestYen || 0))
  const accelTotalInterestYen = Math.max(0, Number(acceleratedSimulation.totalInterestYen || 0))
  const interestSavingYen = Math.max(0, baseTotalInterestYen - accelTotalInterestYen)
  const extraMonthlyMax = Math.max(100000, Math.ceil((baseMonthlyYen * 1.5) / 5000) * 5000)
  const handleExtraMonthlyYenChange = (rawValue) => {
    const next = Number(rawValue)
    if (!Number.isFinite(next)) return
    setExtraMonthlyYen(Math.max(0, Math.min(extraMonthlyMax, next)))
  }
  const acceleratedCompositionData = buildRemainingCompositionSeries(acceleratedSimulation)
  const amortizationYearlyData = buildYearlyAmortizationSeries(baseSimulation, acceleratedSimulation)
  const remainingTotalManwonSeries = acceleratedCompositionData.map((row) => (
    Number(row.remainPrincipalManwon || 0) + Number(row.remainInterestManwon || 0)
  ))
  const remainingMinManwon = remainingTotalManwonSeries.length > 0 ? Math.min(...remainingTotalManwonSeries) : 0
  const remainingMaxManwon = remainingTotalManwonSeries.length > 0 ? Math.max(...remainingTotalManwonSeries) : 100
  const compositionYAxisMin = remainingMinManwon > 0
    ? Math.max(0, Math.floor((remainingMinManwon * 0.93) / 50) * 50)
    : 0
  const compositionYAxisMax = Math.ceil((remainingMaxManwon * 1.01) / 50) * 50
  return (
    <div className="grid md:grid-cols-12 gap-8">
      <div className="md:col-span-4 space-y-6 md:sticky md:top-24 self-start">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-emerald-500" /> あなたの収入
          </h3>
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
            <label className="text-xs font-bold text-slate-400 block mb-2">昨年の年収 (税引前)</label>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 dark:text-white text-lg">¥</span>
              <input
                type="number"
                value={annualIncomeInput}
                onChange={(e) => {
                  const raw = String(e.target.value || '')
                  const digitsOnly = raw.replace(/[^\d]/g, '')
                  const normalized = digitsOnly.replace(/^0+(?=\d)/, '')
                  setAnnualIncomeInput(normalized)
                  onAnnualIncomeChange?.(normalized === '' ? 0 : Number(normalized))
                }}
                className="w-full bg-transparent font-black text-2xl text-slate-900 dark:text-white outline-none border-b-2 border-slate-200 dark:border-slate-600 focus:border-emerald-500 transition"
              />
              <span className="font-bold text-slate-400 text-sm whitespace-nowrap">万円</span>
            </div>
            <button
              onClick={onSaveAnnualIncome}
              disabled={profileSaving}
              className="mt-3 w-full py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold disabled:opacity-60"
            >
              {profileSaving ? '保存中...' : '年収を保存'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" /> 負債状況
          </h3>
          <div className="space-y-6">
            <div>
              <p className="text-xs text-slate-400 font-bold mb-1">残債総額</p>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3">
                <span className="text-3xl font-black text-slate-900 dark:text-white">¥</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={debtRemainingInput === '' ? '' : Number(debtRemainingInput).toLocaleString('ja-JP')}
                  onChange={(e) => {
                    const raw = String(e.target.value || '')
                    const halfWidth = raw.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
                    const digitsOnly = halfWidth.replace(/[^\d]/g, '')
                    const normalized = digitsOnly.replace(/^0+(?=\d)/, '')
                    setDebtRemainingInput(normalized)
                    onDebtRemainingChange?.(normalized === '' ? 0 : Number(normalized) * 10000)
                  }}
                  className="w-full bg-transparent text-3xl font-black text-slate-900 dark:text-white outline-none"
                  placeholder={Math.round(Number(principalYen || 0) / 10000).toLocaleString('ja-JP')}
                />
                <span className="font-bold text-slate-400 text-xl whitespace-nowrap">万円</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2">
                <div className="w-[90%] h-full bg-slate-900 dark:bg-slate-600 rounded-full" />
              </div>
              <div className="mt-3 flex items-center justify-end">
                <button
                  onClick={onSaveDebtRemaining}
                  className="px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold"
                >
                  保存
                </button>
              </div>
            </div>

            <div className={`p-4 rounded-xl transition-all duration-500 ${Number(dti) > DTI_THRESHOLD ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">返済負担率 (DTI)</span>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${dtiMeta.badgeClass}`}>
                  {dtiMeta.label}
                </span>
              </div>
              <p className={`text-3xl font-black mt-2 ${dtiMeta.textClass}`}>{dti}%</p>

              <div className="mt-3">
                <div className="relative">
                  <div className="h-2.5 rounded-full overflow-hidden flex border border-white/40 dark:border-slate-700">
                    <div className="w-[33.333%] bg-emerald-400" />
                    <div className="w-[25%] bg-amber-400" />
                    <div className="flex-1 bg-rose-400" />
                  </div>
                  <div className="absolute -top-1.5" style={{ left: `calc(${dtiPointerLeft}% - 5px)` }}>
                    <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-slate-700 dark:border-t-slate-200" />
                  </div>
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                  <span>健全 0-20%</span>
                  <span>注意 20-35%</span>
                  <span>警戒 35%+</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-3">
                {dtiNumeric > DTI_THRESHOLD
                  ? '返済負担率は登録した条件では高めです。数値は入力の整理であり、借り換えを勧めるものではありません。'
                  : '✅ 適正範囲内(35%以下)です。健全な家計状態です。'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell size={20} className="text-orange-500" /> ローンアラート
          </h3>
          <div className="space-y-3">
            {DEBT_INFO.alerts.map((alert) => (
              <div key={alert.id} className={`p-3 rounded-xl border text-xs font-bold leading-relaxed flex gap-2 ${alert.type === 'opportunity' ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/50 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-400'}`}>
                {alert.type === 'opportunity' ? <Zap size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
                {alert.msg}
              </div>
            ))}
          </div>
          <button
            onClick={onOpenLoanDiagnosis}
            className="w-full mt-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
          >
            <ShieldCheck size={14} /> ローン承認可能性診断
          </button>
        </div>

      </div>

      <div className="md:col-span-8 space-y-4">

        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-8 rounded-[2rem] border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 relative overflow-hidden">
          <div className="relative z-10">
            <div className="mb-8">
              <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-[10px] font-bold px-2 py-1 rounded border border-blue-100 dark:border-blue-800 mb-2 inline-block">シミュレーション</span>
              <h3 className="text-3xl font-black mb-2">将来シナリオ分析</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed max-w-lg">
                あなたの年収 <span className="text-slate-900 dark:text-white font-bold underline">¥{annualIncome}万円</span> をベースに、<br />
                金利上昇や収入減少が返済計画に与える影響をAIが予測します。
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 p-6 md:p-7">
              <div className="text-center mb-5">
                <h4 className="text-2xl md:text-3xl font-black text-blue-900 dark:text-blue-100">金利上昇による月返済額の変化</h4>
                <p className="mt-1 text-xs md:text-sm text-slate-600 dark:text-slate-300">
                  借入額 ¥{principalYen.toLocaleString('ja-JP')} ・ 返済期間 {remainingYears}年 ・ 元利均等返済
                </p>
              </div>

              <div className="mt-4 h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={interestRateTrendData} margin={{ top: 24, right: 10, left: 4, bottom: 0 }} barCategoryGap="24%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b822" />
                    <XAxis dataKey="rateLabel" tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, (dataMax) => Math.ceil((Number(dataMax || 0) * 1.12) / 1000) * 1000]}
                      tickFormatter={(v) => `${Math.round(Number(v || 0) / 10000)}万円`}
                    />
                    <Tooltip formatter={(v) => [`¥${Number(v || 0).toLocaleString('ja-JP')}`, '月返済額']} />
                    <Bar dataKey="monthlyYen" radius={[8, 8, 0, 0]} barSize={24}>
                      {interestRateTrendData.map((entry) => (
                        <Cell key={entry.rateLabel} fill={entry.fill} />
                      ))}
                      <LabelList
                        dataKey="monthlyYen"
                        position="top"
                        formatter={(v) => `¥${Number(v || 0).toLocaleString('ja-JP')}`}
                        style={{ fill: '#0f172a', fontSize: 11, fontWeight: 800 }}
                        offset={8}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-3">
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300 font-bold">1.0%上昇時の増加額</p>
                  <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-300">+¥{onePctIncreaseYen.toLocaleString('ja-JP')}</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300 font-bold">金利 1% → 2%</p>
                  <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                    月 ¥{Math.round(monthlyAt1PctYen).toLocaleString('ja-JP')} → ¥{Math.round(monthlyAt2PctYen).toLocaleString('ja-JP')}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-black text-lg">収入減少シナリオ（DTI）</h4>
                <span className="text-[11px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                  年収 -{Math.round(Math.max(0, Number(incomeDropPct || 0)))}%
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 h-full flex flex-col justify-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-300">収入減少率</p>
                    <p className="text-sm font-black text-blue-600 dark:text-blue-300">-{Math.round(Math.max(0, Number(incomeDropPct || 0)))}%</p>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={incomeDropPct}
                    onChange={(e) => setIncomeDropPct(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div className={`rounded-xl p-4 transition-all duration-500 ${scenarioDti > DTI_THRESHOLD ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">返済負担率 (DTI)</span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${scenarioDtiMeta.badgeClass}`}>
                      {scenarioDtiMeta.label}
                    </span>
                  </div>
                  <p className={`text-3xl font-black mt-2 ${scenarioDtiMeta.textClass}`}>{scenarioDti.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">現状 {dtiBase.toFixed(1)}% → シナリオ {scenarioDti.toFixed(1)}%</p>

                  <div className="mt-3">
                    <div className="relative">
                      <div className="h-2.5 rounded-full overflow-hidden flex border border-white/40 dark:border-slate-700">
                        <div className="w-[33.333%] bg-emerald-400" />
                        <div className="w-[25%] bg-amber-400" />
                        <div className="flex-1 bg-rose-400" />
                      </div>
                      <div className="absolute -top-1.5" style={{ left: `calc(${scenarioDtiPointerLeft}% - 5px)` }}>
                        <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-slate-700 dark:border-t-slate-200" />
                      </div>
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                      <span>健全 0-20%</span>
                      <span>注意 20-35%</span>
                      <span>警戒 35%+</span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={onOpenLoanDiagnosis}
                className="w-full mt-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
              >
                <ShieldCheck size={14} /> 詳細診断を実行
              </button>
            </div>

            <div className="mt-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
              <h4 className="font-black text-lg mb-3">繰上返済インパクト</h4>
              <p className="text-xs text-slate-500 dark:text-slate-300 mb-3">
                毎月の追加返済額を設定すると、完済時期と総利息の変化を試算します。
              </p>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-300 mb-1">月の追加返済額</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">¥</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(Math.round(Number(extraMonthlyYen || 0)))}
                      onChange={(e) => handleExtraMonthlyYenChange(String(e.target.value).replace(/[^\d]/g, ''))}
                      className="w-28 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-lg font-black tabular-nums"
                    />
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-300 mb-1">毎月返済（合計）</p>
                  <div className="text-lg font-black">¥{Math.round(acceleratedPaymentYen).toLocaleString('ja-JP')}</div>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={extraMonthlyMax}
                step={5000}
                value={extraMonthlyYen}
                onChange={(e) => handleExtraMonthlyYenChange(e.target.value)}
                onInput={(e) => handleExtraMonthlyYenChange(e.currentTarget.value)}
                className="w-full accent-orange-400"
              />
              <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-400">
                <span>¥0</span>
                <span>¥{extraMonthlyMax.toLocaleString('ja-JP')}</span>
              </div>
              <div className="mt-4 rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-300 mb-1">返済構成（年間）：元金・利息 + 残高推移</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">棒グラフ=元金/利息、ライン=残高（現状と繰上返済）</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={amortizationYearlyData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b822" />
                      <XAxis dataKey="yearLabel" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="万円" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="万円" />
                      <Tooltip formatter={(v) => `${Number(v || 0).toLocaleString('ja-JP')}万円`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="left" dataKey="principalManwon" name="元金（年）" stackId="pay" fill="#34d399" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="interestManwon" name="利息（年）" stackId="pay" fill="#fdba74" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="balanceBaseManwon" name="残高（現状）" stroke="#94a3b8" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="balanceScenarioManwon" name="残高（繰上返済）" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3 mt-4 text-sm">
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-300">完済期間短縮</p>
                  <p className="font-black text-emerald-600 dark:text-emerald-300">
                    -{Math.floor(reducedMonths / 12)}年 {reducedMonths % 12}ヶ月
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-300">総利息（現状）</p>
                  <p className="font-black">¥{baseTotalInterestYen.toLocaleString('ja-JP')}</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-300">利息差額の試算</p>
                  <p className="font-black text-emerald-600 dark:text-emerald-300">¥{interestSavingYen.toLocaleString('ja-JP')}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-96 h-96 bg-blue-100/80 dark:bg-orange-500/20 rounded-full blur-[100px]" />
        </div>

      </div>
    </div>
  )
}

const CoachSection = ({
  user = null,
  refinanceOffers = [],
  refinanceRunning = false,
  refinanceStatus = '',
  revolvingDebts = [],
  taxShieldProfile = DEFAULT_TAX_SHIELD_PROFILE,
  taxShieldRules = [],
  onRunRefinanceSimulation,
  onRunTaxShieldSimulation,
  onTaxShieldProfileChange,
  onSaveTaxShieldProfile,
  onAddRevolvingDebt,
  onUpdateRevolvingDebt,
  onDeleteRevolvingDebt,
  refinanceSaving = false,
  taxShieldSaving = false,
  mode = 'all',
}) => {
  const isDebtOnly = mode === 'debtOnly'
  const [activeCoachTab, setActiveCoachTab] = useState(isDebtOnly ? 'debt' : 'tax')
  const [employmentType, setEmploymentType] = useState('company_employee')
  const [taxCalcMode, setTaxCalcMode] = useState('db_priority')
  const [assumedReturnRate, setAssumedReturnRate] = useState(5)
  const [taxForm, setTaxForm] = useState({
    annualIncomeYen: '',
    idecoMonthlyYen: '',
    nisaMonthlyYen: '',
    furusatoYearlyYen: '0',
  })
  const [isAddDebtModalOpen, setIsAddDebtModalOpen] = useState(false)
  const [isEditDebtModalOpen, setIsEditDebtModalOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState(null)
  const [debtForm, setDebtForm] = useState({ provider: '', debt_type: 'card', balance_yen: '', interest_rate: '', monthly_payment_yen: '' })
  const [debtFormError, setDebtFormError] = useState('')

  const validateDebtFormForSimulation = () => {
    const rawBal = String(debtForm.balance_yen ?? '').trim()
    const rawRate = String(debtForm.interest_rate ?? '').trim()
    const rawMonthly = String(debtForm.monthly_payment_yen ?? '').trim()
    if (!rawBal || !rawRate || !rawMonthly) {
      return '残高・年利・月返済額は必須です（借り換え比較の計算に使います）。'
    }
    const bal = Number(rawBal)
    const rate = Number(rawRate)
    const monthly = Number(rawMonthly)
    if (!Number.isFinite(bal) || bal <= 0) return '残高は0より大きい数で入力してください。'
    if (!Number.isFinite(rate) || rate <= 0) return '年利は0より大きい数で入力してください。'
    if (!Number.isFinite(monthly) || monthly <= 0) return '月返済額は0より大きい数で入力してください。'
    return ''
  }

  useEffect(() => {
    if (taxShieldProfile) {
      setTaxForm({
        annualIncomeYen: String(Math.max(0, Number(taxShieldProfile.annual_income_manwon ?? 0) * 10000)),
        idecoMonthlyYen: String(Math.round(Math.max(0, Number(taxShieldProfile.ideco_paid_yen ?? 0)) / 12)),
        nisaMonthlyYen: String(Math.round(Math.max(0, Number(taxShieldProfile.nisa_paid_yen ?? 0)) / 12)),
        furusatoYearlyYen: '0',
      })
    }
  }, [taxShieldProfile?.annual_income_manwon, taxShieldProfile?.ideco_paid_yen, taxShieldProfile?.nisa_paid_yen])

  const annualIncomeYen = Math.max(0, Number(taxForm.annualIncomeYen || 0))
  const idecoMonthlyYen = Math.max(0, Number(taxForm.idecoMonthlyYen || 0))
  const nisaMonthlyYen = Math.max(0, Number(taxForm.nisaMonthlyYen || 0))
  const furusatoYearlyYen = Math.max(0, Number(taxForm.furusatoYearlyYen || 0))
  const idecoAnnualYen = idecoMonthlyYen * 12
  const nisaAnnualYen = nisaMonthlyYen * 12

  const calcIncomeTaxRate = (amount) => {
    if (amount <= 1950000) return { rate: 0.05, deduction: 0 }
    if (amount <= 3300000) return { rate: 0.10, deduction: 97500 }
    if (amount <= 6950000) return { rate: 0.20, deduction: 427500 }
    if (amount <= 9000000) return { rate: 0.23, deduction: 636000 }
    if (amount <= 18000000) return { rate: 0.33, deduction: 1536000 }
    if (amount <= 40000000) return { rate: 0.40, deduction: 2796000 }
    return { rate: 0.45, deduction: 4796000 }
  }
  const calcTax = (taxable) => {
    const { rate, deduction } = calcIncomeTaxRate(taxable)
    const incomeTax = Math.max(0, taxable * rate - deduction)
    const residenceTax = Math.max(0, taxable * 0.1)
    return incomeTax + residenceTax
  }
  const standardDeduction = employmentType === 'company_employee' ? 1030000 : 480000
  const furusatoDeductionYen = furusatoYearlyYen > 2000 ? furusatoYearlyYen - 2000 : 0
  const taxableWithoutShield = Math.max(0, annualIncomeYen - standardDeduction)
  const taxableWithShield = Math.max(0, annualIncomeYen - standardDeduction - idecoAnnualYen)
  const taxWithoutShield = calcTax(taxableWithoutShield)
  const taxWithShield = Math.max(0, calcTax(taxableWithShield) - furusatoDeductionYen)
  const manualTaxSavingYen = Math.max(0, taxWithoutShield - taxWithShield)

  const taxShieldResult = evaluateTaxShield({
    taxRules: taxShieldRules,
    taxProfile: {
      ...taxShieldProfile,
      annual_income_yen: annualIncomeYen,
      ideco_paid_yen: idecoAnnualYen,
      nisa_paid_yen: nisaAnnualYen,
    },
  })
  const dbEstimatedTaxSavingYen = Math.abs(Number(taxShieldResult?.expectedTaxSavingYen || 0))
  const hasActiveDbRule = Array.isArray(taxShieldResult?.lineItems)
    ? taxShieldResult.lineItems.some((item) => Boolean(item?.hasRule))
    : false
  const weightedTaxSavingYen = taxCalcMode === 'manual_priority'
    ? Math.round((manualTaxSavingYen * 0.75) + (dbEstimatedTaxSavingYen * 0.25))
    : taxCalcMode === 'balanced'
      ? Math.round((manualTaxSavingYen * 0.5) + (dbEstimatedTaxSavingYen * 0.5))
      : Math.round((manualTaxSavingYen * 0.25) + (dbEstimatedTaxSavingYen * 0.75))
  const expectedTaxSavingYen = hasActiveDbRule ? Math.max(0, weightedTaxSavingYen) : Math.max(0, manualTaxSavingYen)
  const estimatedProfitYen = nisaAnnualYen * (Math.max(0, Number(assumedReturnRate || 0)) / 100)
  const nisaTaxSavingYen = estimatedProfitYen * 0.20315
  const totalSavedAmountYen = Math.max(0, expectedTaxSavingYen + nisaTaxSavingYen)

  const formatCurrency = (amount) => `¥${Math.round(Math.max(0, Number(amount || 0))).toLocaleString('ja-JP')}`
  const topOffer = Array.isArray(refinanceOffers) && refinanceOffers.length > 0 ? refinanceOffers[0] : null
  const debtSavingPerMonth = Math.round(Number(topOffer?.savings24mYen || 0) / 24)
  const topOfferApplyUrl = (() => {
    const raw = String(topOffer?.applyUrl || '').trim()
    return /^https?:\/\//i.test(raw) ? raw : ''
  })()
  const topOfferRepresentativeApr = Number(topOffer?.representativeApr ?? topOffer?.aprMin ?? topOffer?.aprMax ?? 0)
  const topOfferTotalFeeYen = Math.max(0, Number(topOffer?.totalFeeYen || 0))
  const topOfferSavingsYen = Number(topOffer?.savings24mYen || 0)
  const topOfferCostGapYen = Math.abs(topOfferSavingsYen)

  const handleSaveTaxSettings = async () => {
    const incomeManwon = Math.round(annualIncomeYen / 10000)
    onTaxShieldProfileChange?.('annual_income_manwon', incomeManwon)
    onTaxShieldProfileChange?.('ideco_paid_yen', idecoAnnualYen)
    onTaxShieldProfileChange?.('nisa_paid_yen', nisaAnnualYen)
    await onSaveTaxShieldProfile?.({
      annualIncomeManwon: incomeManwon,
      idecoPaidYen: idecoAnnualYen,
      nisaPaidYen: nisaAnnualYen,
    })
    await onRunTaxShieldSimulation?.()
  }

  return (
    <div className="space-y-6">
      {!isDebtOnly && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">家計の試算</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                iDeCo・NISAの節税試算と、負債の試算を1画面で整理します。特定の金融商品の売買を勧誘するものではありません。
              </p>
            </div>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full md:w-auto">
              <button
                type="button"
                onClick={() => setActiveCoachTab('tax')}
                className={`flex-1 md:w-44 py-2.5 px-4 rounded-lg text-sm font-black transition-all flex items-center justify-center gap-2 ${
                  activeCoachTab === 'tax'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <ShieldCheck size={16} />
                節税・非課税
              </button>
              <button
                type="button"
                onClick={() => setActiveCoachTab('debt')}
                className={`flex-1 md:w-44 py-2.5 px-4 rounded-lg text-sm font-black transition-all flex items-center justify-center gap-2 ${
                  activeCoachTab === 'debt'
                    ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Wallet size={16} />
                負債の試算
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCoachTab === 'tax' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white pb-3 mb-4 border-b border-slate-200 dark:border-slate-700">1. 基本情報</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">働き方</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEmploymentType('company_employee')}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-bold ${
                        employmentType === 'company_employee'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      会社員
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmploymentType('freelance')}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-bold ${
                        employmentType === 'freelance'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      個人事業主
                    </button>
                  </div>
                </div>
                <label className="block">
                  <span className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">年収（額面）</span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={taxForm.annualIncomeYen}
                      onChange={(e) => {
                        const value = sanitizeNumericInput(e.target.value)
                        setTaxForm((prev) => ({ ...prev, annualIncomeYen: value }))
                      }}
                      className="w-full pl-4 pr-14 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-right text-lg font-black text-slate-900 dark:text-white"
                    />
                    <span className="absolute right-4 top-3.5 text-slate-500 dark:text-slate-400 text-sm font-bold">円</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white pb-3 mb-4 border-b border-slate-200 dark:border-slate-700">2. 制度利用状況</h3>
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/60">
                  <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-2">節税計算モード</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTaxCalcMode('db_priority')}
                      className={`px-2 py-2 rounded-lg text-xs font-bold border transition ${
                        taxCalcMode === 'db_priority'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      DB優先
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxCalcMode('balanced')}
                      className={`px-2 py-2 rounded-lg text-xs font-bold border transition ${
                        taxCalcMode === 'balanced'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      バランス
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxCalcMode('manual_priority')}
                      className={`px-2 py-2 rounded-lg text-xs font-bold border transition ${
                        taxCalcMode === 'manual_priority'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      手動優先
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {hasActiveDbRule
                      ? (taxCalcMode === 'manual_priority'
                        ? '手動75% + DB25% で節税額を算出中'
                        : taxCalcMode === 'balanced'
                          ? '手動50% + DB50% で節税額を算出中'
                          : '手動25% + DB75% で節税額を算出中')
                      : 'DBルールが未設定のため手動計算を使用中'}
                  </p>
                </div>

                <div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">iDeCo（月額）</span>
                    <span className="font-black text-slate-900 dark:text-white">{formatCurrency(idecoMonthlyYen)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="68000"
                    step="1000"
                    value={idecoMonthlyYen}
                    onChange={(e) => setTaxForm((prev) => ({ ...prev, idecoMonthlyYen: String(Number(e.target.value) || 0) }))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">ふるさと納税（年額）</span>
                    <span className="font-black text-slate-900 dark:text-white">{formatCurrency(furusatoYearlyYen)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="300000"
                    step="10000"
                    value={furusatoYearlyYen}
                    onChange={(e) => setTaxForm((prev) => ({ ...prev, furusatoYearlyYen: String(Number(e.target.value) || 0) }))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">NISA（月額）</span>
                    <span className="font-black text-slate-900 dark:text-white">{formatCurrency(nisaMonthlyYen)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="300000"
                    step="5000"
                    value={nisaMonthlyYen}
                    onChange={(e) => setTaxForm((prev) => ({ ...prev, nisaMonthlyYen: String(Number(e.target.value) || 0) }))}
                    className="w-full accent-emerald-600"
                  />
                  {nisaMonthlyYen > 0 && (
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-900/20 p-3">
                      <span className="text-sm text-slate-600 dark:text-slate-300 font-bold">想定利回り（年利）</span>
                      <select
                        value={assumedReturnRate}
                        onChange={(e) => setAssumedReturnRate(Number(e.target.value) || 5)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm font-black text-slate-800 dark:text-slate-200"
                      >
                        <option value="3">3%</option>
                        <option value="5">5%</option>
                        <option value="7">7%</option>
                        <option value="10">10%</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-3xl p-7 text-white shadow-lg relative overflow-hidden">
              <ShieldCheck size={110} className="absolute -top-4 -right-4 text-white/10" />
              <p className="text-sm text-blue-200 font-bold">シミュレーション結果（年間推定）</p>
              <div className="mt-6">
                <p className="text-sm text-blue-100">年間での経済的メリット合計</p>
                <p className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tight mt-1">{formatCurrency(totalSavedAmountYen)}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 mb-4">メリットの内訳</h4>
              <ul className="space-y-4">
                <li className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <span className="text-sm text-slate-600 dark:text-slate-300">iDeCo年間拠出額</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(idecoAnnualYen)}</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <span className="text-sm text-slate-600 dark:text-slate-300">ふるさと納税控除（概算）</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(furusatoDeductionYen)}</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <span className="text-sm text-emerald-700 dark:text-emerald-300 font-bold">税負担軽減（DBルール反映）</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(expectedTaxSavingYen)}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700 dark:text-emerald-300 font-bold">NISA運用益の非課税効果（想定）</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(nisaTaxSavingYen)}</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleSaveTaxSettings}
                disabled={taxShieldSaving}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 py-3.5 rounded-xl font-black text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {taxShieldSaving ? '保存中...' : '保存して確認する'}
              </button>
              <button
                type="button"
                onClick={onRunTaxShieldSimulation}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 transition"
              >
                詳細な内訳を更新
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCoachTab === 'debt' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">負債の試算</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">このページ内で負債の追加・修正・削除ができます。</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDebtForm({ provider: '', debt_type: 'card', balance_yen: '', interest_rate: '', monthly_payment_yen: '' })
                  setDebtFormError('')
                  setIsAddDebtModalOpen(true)
                }}
                className="bg-slate-900 dark:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2"
              >
                <Plus size={16} /> 負債追加
              </button>
            </div>

            <div className="space-y-3">
              {Array.isArray(revolvingDebts) && revolvingDebts.length > 0 ? revolvingDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{debt.provider || '未設定'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{DEBT_TYPE_LABELS[String(debt.debt_type || '').toLowerCase()] || 'Debt'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(debt.balance_yen)}</p>
                      <p className="text-xs text-rose-500 font-bold">利率 {Number(debt.interest_rate || 0).toFixed(1)}%</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDebt(debt)
                        setDebtForm({
                          provider: debt.provider || '',
                          debt_type: String(debt.debt_type || 'card').toLowerCase(),
                          balance_yen: String(debt.balance_yen ?? ''),
                          interest_rate: String(debt.interest_rate ?? ''),
                          monthly_payment_yen: String(debt.monthly_payment_yen ?? ''),
                        })
                        setDebtFormError('')
                        setIsEditDebtModalOpen(true)
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRevolvingDebt?.(debt.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4">まだ登録された負債がありません。上の「負債追加」から追加してください。</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-orange-600 p-2 rounded-full text-white">
                <Target size={18} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">借り換えシミュレーター</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">現在維持 vs 借り換え実行の24ヶ月総コストを比較します。</p>

            <div className="flex flex-wrap items-center gap-3 mb-5">
              <button
                type="button"
                onClick={onRunRefinanceSimulation}
                disabled={refinanceRunning}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-full font-black text-sm disabled:opacity-60 flex items-center gap-2"
              >
                {refinanceRunning ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
                {refinanceRunning ? '計算中...' : '今すぐ比較'}
              </button>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                金利上限で24ヶ月を仮試算。実際の適用金利・返済額・審査結果により変わります。
              </div>
            </div>

            {refinanceStatus ? <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{refinanceStatus}</p> : null}

            {topOffer ? (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">借入額範囲が合う候補（上限金利での試算順）</p>
                    <p className="font-black text-slate-900 dark:text-white mt-1">{topOffer.bankName} / {topOffer.productName}</p>
                    <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-2">年 {Number(topOffer.aprMin ?? 0).toFixed(2)}〜{Number(topOffer.aprMax ?? 0).toFixed(2)}%</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      試算に用いた金利（上限）: 年 {topOfferRepresentativeApr.toFixed(2)}% / 登録済み費用: {formatCurrency(topOfferTotalFeeYen)}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">24ヶ月の仮試算：{topOfferSavingsYen >= 0 ? 'コスト減' : 'コスト増'}</p>
                    <p className={`text-3xl font-black mt-1 ${topOfferSavingsYen >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(topOfferCostGapYen)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">月換算 約 {formatCurrency(Math.abs(debtSavingPerMonth))} / 審査・契約条件は未確認</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-3">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200">この候補の表示理由</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1">
                    借入希望額が掲載範囲内の商品を、各商品の金利上限で仮試算した24ヶ月総コスト（支払額 + 登録済み費用 + 残債）の順に表示しています。審査による適用金利や実際の返済方式は反映できません。金融機関の公式条件を確認してください。
                  </p>
                </div>
                {topOfferApplyUrl ? (
                  <div className="mt-3">
                    <a
                      href={topOfferApplyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black px-4 py-2"
                    >
                      公式ページで申込み条件を確認
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                    ※ この候補は申込みURLが未登録です。管理画面でリンクを追加すると、ここから直接遷移できます。
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">負債を入力して「今すぐ比較」を押すと、借り換え候補を表示します。</p>
            )}

            {Array.isArray(refinanceOffers) && refinanceOffers.length > 0 && (
              <div className="mt-5 bg-amber-950 rounded-2xl p-4 border border-amber-900 space-y-3">
                <p className="text-[11px] font-black text-amber-200 tracking-wider">借入額範囲が合う候補 / 上限金利での仮試算</p>
                {refinanceOffers.slice(0, 3).map((offer, index) => (
                  <div key={offer.offerId || `${offer.bankName}-${index}`} className={`rounded-xl p-4 border ${index === 0 ? 'bg-amber-700/40 border-amber-300/40' : 'bg-amber-900/40 border-amber-800/70'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-white font-black">{offer.bankName}</p>
                        <p className="text-amber-300 text-xs mt-1">{index === 0 ? '試算上の先頭候補' : '借入額範囲のみ確認'}</p>
                        <p className="text-amber-100/80 text-xs mt-1">
                          24ヶ月総コスト: {formatCurrency(Number(offer.refinanceTotalCost24mYen || 0))}
                        </p>
                        <p className={`${Number(offer.savings24mYen || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'} text-xs mt-1 font-bold`}>
                          24ヶ月の仮試算・{Number(offer.savings24mYen || 0) >= 0 ? 'コスト減' : 'コスト増'}: {formatCurrency(Math.abs(Number(offer.savings24mYen || 0)))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-200 text-2xl font-black">年 {Number(offer.aprMin ?? 0).toFixed(2)}〜{Number(offer.aprMax ?? 0).toFixed(2)}%</p>
                        {String(offer.applyUrl || '').trim().match(/^https?:\/\//i) ? (
                          <a
                            href={String(offer.applyUrl || '').trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center mt-2 rounded-lg bg-amber-200 text-amber-950 text-[11px] font-black px-2.5 py-1 hover:bg-amber-100"
                          >
                            申込み
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isAddDebtModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-black mb-4 text-slate-900 dark:text-white">負債を追加</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">カード・金融機関名</span>
                <input
                  type="text"
                  value={debtForm.provider}
                  onChange={(e) => setDebtForm((f) => ({ ...f, provider: e.target.value }))}
                  placeholder="例: Rakuten Card"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">負債タイプ</span>
                <select
                  value={debtForm.debt_type}
                  onChange={(e) => setDebtForm((f) => ({ ...f, debt_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value="mortgage">Mortgage</option>
                  <option value="card">Card</option>
                  <option value="revolving">Revolving</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  残高(円)
                  <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  required
                  value={debtForm.balance_yen}
                  onChange={(e) => { setDebtFormError(''); setDebtForm((f) => ({ ...f, balance_yen: e.target.value })) }}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  aria-required="true"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  年利(%)
                  <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={debtForm.interest_rate}
                  onChange={(e) => { setDebtFormError(''); setDebtForm((f) => ({ ...f, interest_rate: e.target.value })) }}
                  placeholder="15"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  aria-required="true"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  月返済額(円)
                  <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  required
                  value={debtForm.monthly_payment_yen}
                  onChange={(e) => { setDebtFormError(''); setDebtForm((f) => ({ ...f, monthly_payment_yen: e.target.value })) }}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  aria-required="true"
                />
              </label>
            </div>
            {debtFormError ? (
              <p className="mt-3 text-xs font-bold text-red-500" role="alert">{debtFormError}</p>
            ) : null}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setDebtFormError(''); setIsAddDebtModalOpen(false) }}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  const err = validateDebtFormForSimulation()
                  if (err) {
                    setDebtFormError(err)
                    return
                  }
                  setDebtFormError('')
                  await onAddRevolvingDebt?.({
                    provider: debtForm.provider,
                    debt_type: debtForm.debt_type,
                    balance_yen: Number(debtForm.balance_yen) || 0,
                    interest_rate: Number(debtForm.interest_rate) || 0,
                    monthly_payment_yen: Number(debtForm.monthly_payment_yen) || 0,
                  })
                  setIsAddDebtModalOpen(false)
                }}
                disabled={refinanceSaving}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold disabled:opacity-60"
              >
                {refinanceSaving ? '保存中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditDebtModalOpen && editingDebt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-black mb-4 text-slate-900 dark:text-white">負債を編集</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">カード・金融機関名</span>
                <input
                  type="text"
                  value={debtForm.provider}
                  onChange={(e) => setDebtForm((f) => ({ ...f, provider: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">負債タイプ</span>
                <select
                  value={debtForm.debt_type}
                  onChange={(e) => setDebtForm((f) => ({ ...f, debt_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value="mortgage">Mortgage</option>
                  <option value="card">Card</option>
                  <option value="revolving">Revolving</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  残高(円)
                  <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  required
                  value={debtForm.balance_yen}
                  onChange={(e) => { setDebtFormError(''); setDebtForm((f) => ({ ...f, balance_yen: e.target.value })) }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  aria-required="true"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  年利(%)
                  <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={debtForm.interest_rate}
                  onChange={(e) => { setDebtFormError(''); setDebtForm((f) => ({ ...f, interest_rate: e.target.value })) }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  aria-required="true"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  月返済額(円)
                  <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  required
                  value={debtForm.monthly_payment_yen}
                  onChange={(e) => { setDebtFormError(''); setDebtForm((f) => ({ ...f, monthly_payment_yen: e.target.value })) }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  aria-required="true"
                />
              </label>
            </div>
            {debtFormError ? (
              <p className="mt-3 text-xs font-bold text-red-500" role="alert">{debtFormError}</p>
            ) : null}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setDebtFormError(''); setIsEditDebtModalOpen(false); setEditingDebt(null) }}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  const err = validateDebtFormForSimulation()
                  if (err) {
                    setDebtFormError(err)
                    return
                  }
                  setDebtFormError('')
                  await onUpdateRevolvingDebt?.(editingDebt.id, {
                    provider: debtForm.provider,
                    debt_type: debtForm.debt_type,
                    balance_yen: Number(debtForm.balance_yen) || 0,
                    interest_rate: Number(debtForm.interest_rate) || 0,
                    monthly_payment_yen: Number(debtForm.monthly_payment_yen) || 0,
                  })
                  setIsEditDebtModalOpen(false)
                  setEditingDebt(null)
                }}
                disabled={refinanceSaving}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold disabled:opacity-60"
              >
                {refinanceSaving ? '保存中...' : '更新'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <div className="space-y-1 font-medium">
          <p>{activeCoachTab === 'debt' ? MM_DEBT_SIMULATION_DISCLAIMER_JA : MM_SIMULATION_PAST_PERFORMANCE_JA}</p>
          <p>※ 本シミュレーションは入力値に基づく概算であり、将来の税額・金利・返済額を保証するものではありません。</p>
          {activeCoachTab === 'debt' && <p>※ 実際の適用金利と借り換え可否は、各金融機関の審査結果によって異なる場合があります。</p>}
          {!isDebtOnly && activeCoachTab === 'tax' && <p>※ NISAの利回りは想定値であり、投資には元本割れリスクがあります。</p>}
        </div>
      </div>
    </div>
  )
}

export default function MyPage({
  productInterests = [],
  fundWatchlist = [],
  toggleFundWatchlist,
  updateFundWatchlistMeta,
  onUiMessage = null,
  user = null,
  userProfile = null,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const userId = user?.id || null
  const { profile: exposureProfile, loading: exposureLoading } = usePortfolioExposureProfile(userId)
  const [relatedNewsRows, setRelatedNewsRows] = useState([])
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const tabFromUrl = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('tab')
        : null
      const normalizedUrlTab = tabFromUrl ? normalizeMyPageTab(tabFromUrl) : null
      if (normalizedUrlTab && MYPAGE_ALLOWED_TABS.includes(normalizedUrlTab)) return normalizedUrlTab
      const saved = localStorage.getItem(MYPAGE_TAB_STORAGE_KEY)
      const normalizedSaved = saved ? normalizeMyPageTab(saved) : null
      return normalizedSaved && MYPAGE_ALLOWED_TABS.includes(normalizedSaved) ? normalizedSaved : 'wealth'
    } catch {
      return 'wealth'
    }
  })
  useEffect(() => {
    if (activeTab !== 'related') return undefined
    let cancelled = false
    ;(async () => {
      try {
        const { rows } = await fetchAiNewsData()
        if (!cancelled) setRelatedNewsRows(Array.isArray(rows) ? rows.slice(0, 40) : [])
      } catch {
        if (!cancelled) setRelatedNewsRows([])
      }
    })()
    return () => { cancelled = true }
  }, [activeTab])

  const handleTabChange = (nextTab) => {
    const normalizedTab = MYPAGE_ALLOWED_TABS.includes(nextTab) ? normalizeMyPageTab(nextTab) : 'wealth'
    setActiveTab(normalizedTab)
    recordUserActivityEvent(user?.id, 'mypage_tab_open', { tab: normalizedTab })
    try {
      const params = new URLSearchParams(location.search || '')
      params.set('tab', normalizedTab)
      const search = params.toString()
      navigate(
        {
          pathname: '/mypage',
          search: search ? `?${search}` : '',
        },
        { replace: true },
      )
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(MYPAGE_TAB_STORAGE_KEY, normalizedTab)
    } catch {
      // ignore storage failures
    }
  }

  /** 資産運用タブの空状態などから、株式／ファンドタブへ切り替えつつ入力欄へスクロール */
  const switchPortfolioTabAndScroll = (mode) => {
    if (mode !== 'stock' && mode !== 'fund') return
    handleTabChange(mode)
    const anchor = mode === 'stock' ? 'mypage-stock-holdings' : 'mypage-owned-fund-section'
    window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 160)
  }

  useEffect(() => {
    try {
      const tabFromUrl = new URLSearchParams(location.search).get('tab')
      const normalized = tabFromUrl ? normalizeMyPageTab(tabFromUrl) : null
      if (!normalized || !MYPAGE_ALLOWED_TABS.includes(normalized)) return
      setActiveTab((prev) => (prev === normalized ? prev : normalized))
      try {
        localStorage.setItem(MYPAGE_TAB_STORAGE_KEY, normalized)
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }, [location.search])

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '')
      if (params.get('verified') !== '1') return
      onUiMessage?.('メール確認が完了しました。', 'info')
      params.delete('verified')
      const search = params.toString()
      navigate({ pathname: '/mypage', search: search ? `?${search}` : '' }, { replace: true })
    } catch {
      // ignore
    }
  }, [location.search, navigate, onUiMessage])

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '')
      if (params.get('onboard') !== 'diagnosis') return
      onUiMessage?.('診断の回答を保存しました。保有を1件登録すると、より詳しい分析が可能です。', 'info')
      params.delete('onboard')
      const search = params.toString()
      navigate({ pathname: '/mypage', search: search ? `?${search}` : '' }, { replace: true })
      window.setTimeout(() => {
        document.getElementById('mypage-asset-diagnosis')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 400)
    } catch {
      // ignore
    }
  }, [location.search, navigate, onUiMessage])

  const [isLoanDiagnosisOpen, setIsLoanDiagnosisOpen] = useState(false)
  const [assetPositions, setAssetPositions] = useState([])
  const [localFundPositions, setLocalFundPositions] = useState([])
  const [stockWatchlistItems, setStockWatchlistItems] = useState([])
  const [ownedStocks, setOwnedStocks] = useState([])
  /** loadDividendWatchlist の非同期完了後も最新の保有を参照する（タブ切替タイミングのずれ対策） */
  const ownedStocksLatestRef = useRef(ownedStocks)
  ownedStocksLatestRef.current = ownedStocks
  const [ownedStockItems, setOwnedStockItems] = useState([])
  const ownedStockItemsClearTimerRef = useRef(null)
  const [fxRatesByDate, setFxRatesByDate] = useState({})
  const [valuationUsdJpy, setValuationUsdJpy] = useState(null)
  const [valuationFxDate, setValuationFxDate] = useState('')
  const [ownedFunds, setOwnedFunds] = useState([])
  const [ownedFundItems, setOwnedFundItems] = useState([])
  const ownedFundItemsClearTimerRef = useRef(null)
  const [fundOptimizerSets, setFundOptimizerSets] = useState(() => loadFundOptimizerWatchsets())
  /** ファンドタブの DB 同期が遅延中に削除すると古い一覧で上書きされるのを防ぐ */
  const fundOptimizerWatchsetsSyncGenRef = useRef(0)
  const [ownedAssetDbAvailable, setOwnedAssetDbAvailable] = useState(false)
  const [ownedAssetDbReady, setOwnedAssetDbReady] = useState(false)
  /** v_stock_latest など取得中（※定期リフレッシュには掛けない — 体感チラつき防止） */
  const [stockPortfolioQuotesHydrating, setStockPortfolioQuotesHydrating] = useState(false)
  const [fundPortfolioQuotesHydrating, setFundPortfolioQuotesHydrating] = useState(false)
  /** 株とファンドで分離 — 株だけ触った状態でファンドを空配列として replace すると DB のファンドが全消去されるため */
  const ownedStockCloudTouchedRef = useRef(false)
  const ownedFundCloudTouchedRef = useRef(false)
  /** 空配列を DB に反映してよいのは「UI で最後の 1 件を削除した」ときだけ（myPageApi の allowEmpty* と併用） */
  const userExplicitlyClearedAllStocksRef = useRef(false)
  const userExplicitlyClearedAllFundsRef = useRef(false)
  const [realizedStockTrades, setRealizedStockTrades] = useState([])
  const [realizedDbAvailable, setRealizedDbAvailable] = useState(false)
  const ownedRealizedCloudTouchedRef = useRef(false)
  const [realizedFundTrades, setRealizedFundTrades] = useState([])
  const [realizedFundDbAvailable, setRealizedFundDbAvailable] = useState(false)
  const ownedRealizedFundCloudTouchedRef = useRef(false)
  /** 定義位置が handleAddOwnedStock より下のため、配当↔保有同期の実体はここにぶら下げる */
  const syncDividendFromOwnedRef = useRef(null)
  /** アプリ等が user_owned_stocks のみ更新したとき Web で配当ウォッチへ反映するための差分追跡 */
  const prevOwnedPositiveQtySymbolsRef = useRef(new Set())
  const dividendOwnedReconcileUserIdRef = useRef(null)
  const lastOwnedSyncUserIdRef = useRef(null)
  const [pointAccounts, setPointAccounts] = useState([])
  const [expenses, setExpenses] = useState([])
  const [insurances, setInsurances] = useState([])
  const [financeProfile, setFinanceProfile] = useState({ annual_income_manwon: 0, budget_target_yen: 0 })
  const [dataStatus, setDataStatus] = useState('')
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [insuranceSaving, setInsuranceSaving] = useState(false)
  const [pointSaving, setPointSaving] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [myPageDbAvailable, setMyPageDbAvailable] = useState(false)
  const [loanRemainingYen, setLoanRemainingYen] = useState(0)
  const [revolvingProfile, setRevolvingProfile] = useState({ ...DEFAULT_REVOLVING_PROFILE })
  const [revolvingDebts, setRevolvingDebts] = useState([])
  const [refinanceProducts, setRefinanceProducts] = useState([])
  const [refinanceSaving, setRefinanceSaving] = useState(false)
  const [refinanceRunning, setRefinanceRunning] = useState(false)
  const [refinanceOffers, setRefinanceOffers] = useState([])
  const [taxShieldProfile, setTaxShieldProfile] = useState({ ...DEFAULT_TAX_SHIELD_PROFILE })
  const [taxShieldRules, setTaxShieldRules] = useState([])
  const [taxShieldSaving, setTaxShieldSaving] = useState(false)
  const [taxShieldStatus, setTaxShieldStatus] = useState('')
  const [cashFlowProfile, setCashFlowProfile] = useState({ ...DEFAULT_CASH_FLOW_PROFILE })
  const [cashFlowSaving, setCashFlowSaving] = useState(false)
  const [cashFlowStatus, setCashFlowStatus] = useState('')
  const [showAccountDanger, setShowAccountDanger] = useState(false)
  const [showDeleteFinal, setShowDeleteFinal] = useState(false)
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('')
  const [deleteIntentChecked, setDeleteIntentChecked] = useState(false)
  const [deleteRejoinDelayChecked, setDeleteRejoinDelayChecked] = useState(false)
  const [deleteLegalRetentionChecked, setDeleteLegalRetentionChecked] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [accountActionError, setAccountActionError] = useState('')
  const [referralInviteCode, setReferralInviteCode] = useState(null)
  const [referralCopied, setReferralCopied] = useState(false)
  const [referralShareHint, setReferralShareHint] = useState('')

  useEffect(() => {
    if (!user?.id) {
      setStockPortfolioQuotesHydrating(false)
      setFundPortfolioQuotesHydrating(false)
    }
  }, [user?.id])

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      if (q.get('subscription') !== 'success') return
      setDataStatus('お支払いありがとうございます。プレミアム反映まで数十秒かかる場合があります。反映されないときはページを再読み込みしてください。')
      q.delete('subscription')
      const next = q.toString()
      navigate(`${window.location.pathname}${next ? `?${next}` : ''}`, { replace: true })
    } catch {
      // ignore
    }
  }, [navigate])

  useEffect(() => {
    if (!REFERRAL_INVITE_UI_ENABLED || !user?.id) {
      setReferralInviteCode(null)
      return
    }
    let alive = true
    fetchMyReferralCode().then((c) => {
      if (alive) setReferralInviteCode(c || null)
    })
    return () => {
      alive = false
    }
  }, [user?.id])

  useEffect(() => {
    if (activeTab !== 'fund') return
    const userId = user?.id
    if (!userId) {
      setFundOptimizerSets(loadFundOptimizerWatchsets())
      return
    }
    let cancelled = false
    const syncBaselineGen = fundOptimizerWatchsetsSyncGenRef.current
    ;(async () => {
      try {
        // 1회 마이그레이션: localStorage → Supabase
        await migrateFundOptimizerSetsToDb(userId)
        const { data, available } = await loadFundOptimizerWatchsetsFromDb(userId)
        if (cancelled) return
        if (fundOptimizerWatchsetsSyncGenRef.current !== syncBaselineGen) return
        if (available && data) {
          setFundOptimizerSets(data)
          saveFundOptimizerWatchsets(data) // localStorage도 동기화
        } else {
          setFundOptimizerSets(loadFundOptimizerWatchsets())
        }
      } catch {
        if (!cancelled && fundOptimizerWatchsetsSyncGenRef.current === syncBaselineGen) {
          setFundOptimizerSets(loadFundOptimizerWatchsets())
        }
      }
    })()
    return () => { cancelled = true }
  }, [activeTab, user?.id])

  const handleRemoveFundOptimizerSet = (setId) => {
    const userId = user?.id
    fundOptimizerWatchsetsSyncGenRef.current += 1
    setFundOptimizerSets((prev) => {
      const next = prev.filter((row) => row.id !== setId)
      saveFundOptimizerWatchsets(next)
      if (userId) deleteFundOptimizerWatchsetFromDb(userId, setId).catch(() => {})
      return next
    })
  }
  const rawDisplayName = (
    userProfile?.displayName
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || (user?.email ? String(user.email).split('@')[0] : 'Member')
  )
  const displayName = String(rawDisplayName || '')
    .replace(/^\s*(Mr\.?|Miss|Mrs\.?|Ms\.?)\s+/i, '')
    .trim() || 'Member'
  const planTier = String(userProfile?.planTier || '').toLowerCase()
  const premiumTrialEndsAt = userProfile?.premiumTrialEndsAt ?? userProfile?.premium_trial_ends_at ?? null
  const isPaidMember = hasPremiumEntitlement({ planTier, premiumTrialEndsAt })
  const avatarInitial = String(displayName || 'M').trim().charAt(0).toUpperCase()
  const trackUserActivityEvent = async (eventName, eventMeta = {}) => {
    await recordUserActivityEvent(user?.id, eventName, eventMeta)
  }

  useEffect(() => {
    setLoanRemainingYen(0)
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      setLocalFundPositions([])
      return
    }
    const loaded = loadLocalList(getLocalFundPositionsStorageKey(null))
    setLocalFundPositions(Array.isArray(loaded) ? loaded : [])
  }, [user?.id])

  useEffect(() => {
    const stockUniverse = [...(MOCK_STOCKS.US || []), ...(MOCK_STOCKS.JP || [])]
    const stockById = new Map(stockUniverse.map((s) => [String(s.id), s]))
    let alive = true
    const syncLocalStockWatchlist = async () => {
      try {
        let normalizedIds = []
        if (user?.id) {
          const { symbols, available } = await loadStockWatchlistSymbolsFromDb(user.id)
          if (available) {
            if (symbols.length > 0) {
              normalizedIds = symbols
              clearLocalStockWatchlistKey(user.id)
            } else {
              const legacy = readLocalStockWatchlistSymbolIds(user.id)
              if (legacy.length > 0) {
                try {
                  await mergeStockWatchlistSymbolsInDb({ userId: user.id, symbols: legacy })
                  normalizedIds = legacy
                  clearLocalStockWatchlistKey(user.id)
                } catch {
                  normalizedIds = legacy
                }
              }
            }
          } else {
            normalizedIds = readLocalStockWatchlistSymbolIds(user.id)
          }
        } else {
          normalizedIds = readLocalStockWatchlistSymbolIds(null)
        }
        const fallbackRows = normalizedIds.map((id) => {
          const matched = stockById.get(id)
          return {
            id,
            code: matched?.code || id,
            name: matched?.name || matched?.company || id,
            rate: Number(matched?.rate || 0),
            price: Number(matched?.price || 0),
            tradeDate: null,
          }
        })
        if (alive) setStockWatchlistItems(fallbackRows)
        if (normalizedIds.length === 0) return

        const latestRows = []
        for (let i = 0; i < normalizedIds.length; i += 80) {
          const batch = normalizedIds.slice(i, i + 80)
          const { data, error } = await supabase
            .from('v_stock_latest')
            .select('symbol,trade_date,open,close')
            .in('symbol', batch)
          if (error) throw error
          latestRows.push(...(data || []))
        }
        const liveSymbols = [...new Set(latestRows.map((r) => r.symbol).filter(Boolean))]
        const nameLookupSymbols = normalizedIds.map((id) => String(id || '').trim().toUpperCase()).filter(Boolean)
        let symbolMap = new Map()
        let symbolProfileNameMap = new Map()
        if (nameLookupSymbols.length > 0) {
          const [{ data: symbolRows, error: symbolErr }, { data: profileRows, error: profileErr }] = await Promise.all([
            supabase
              .from('stock_symbols')
              .select('symbol,name')
              .in('symbol', nameLookupSymbols),
            supabase
              .from('stock_symbol_profiles')
              .select('symbol,name_jp,name_en')
              .in('symbol', nameLookupSymbols),
          ])
          if (symbolErr) throw symbolErr
          if (profileErr) throw profileErr
          symbolMap = new Map((symbolRows || []).map((row) => [String(row.symbol || '').trim().toUpperCase(), row.name]))
          symbolProfileNameMap = new Map(
            (profileRows || []).map((row) => [
              String(row.symbol || '').trim().toUpperCase(),
              { name_jp: row?.name_jp || '', name_en: row?.name_en || '' },
            ])
          )
        }
        const latestMap = new Map(latestRows.map((row) => [String(row.symbol || '').trim().toUpperCase(), row]))
        const mergedRows = fallbackRows.map((row) => {
          const symbol = String(row.id || '').trim().toUpperCase()
          const live = latestMap.get(symbol)
          if (!live) return row
          const open = Number(live.open || 0)
          const close = Number(live.close || 0)
          const rate = open > 0 ? ((close - open) / open) * 100 : row.rate
          return {
            ...row,
            name: resolveOwnedStockDisplayName(
              symbol,
              symbolMap.get(symbol),
              symbolProfileNameMap.get(symbol)?.name_jp,
              symbolProfileNameMap.get(symbol)?.name_en,
              row.name,
            ),
            price: Number.isFinite(close) && close > 0 ? close : row.price,
            tradeDate: live.trade_date || row.tradeDate,
            rate: Number.isFinite(rate) ? rate : row.rate,
          }
        })
        if (alive) setStockWatchlistItems(mergedRows)
      } catch {
        // Keep fallback rows if live fetch fails.
      }
    }
    syncLocalStockWatchlist()
    const intervalId = window.setInterval(syncLocalStockWatchlist, DAILY_REFRESH_MS)
    const onStorage = (e) => {
      if (e.storageArea !== window.localStorage) return
      if (!shouldReloadStockWatchlistFromStorageKey(e.key)) return
      syncLocalStockWatchlist()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      alive = false
      window.clearInterval(intervalId)
      window.removeEventListener('storage', onStorage)
    }
  }, [user?.id])
  useEffect(() => {
    if (user?.id) return
    try {
      localStorage.setItem(getLocalFundPositionsStorageKey(null), JSON.stringify(localFundPositions))
    } catch {
      // ignore storage failures
    }
  }, [user?.id, localFundPositions])
  useEffect(() => {
    try {
      localStorage.setItem(MYPAGE_TAB_STORAGE_KEY, activeTab)
    } catch {
      // ignore storage failures
    }
  }, [activeTab])

  useEffect(() => {
    let alive = true
    const uid = user?.id ?? null
    if (uid !== lastOwnedSyncUserIdRef.current) {
      lastOwnedSyncUserIdRef.current = uid
      ownedStockCloudTouchedRef.current = false
      ownedFundCloudTouchedRef.current = false
      ownedRealizedCloudTouchedRef.current = false
      ownedRealizedFundCloudTouchedRef.current = false
      userExplicitlyClearedAllStocksRef.current = false
      userExplicitlyClearedAllFundsRef.current = false
    }
    const syncFromDb = async () => {
      if (!user?.id) {
        if (!alive) return
        setOwnedAssetDbAvailable(false)
        setOwnedAssetDbReady(false)
        setOwnedStocks([])
        setOwnedFunds([])
        setOwnedStockItems([])
        setOwnedFundItems([])
        setRealizedStockTrades([])
        setRealizedDbAvailable(false)
        setRealizedFundTrades([])
        setRealizedFundDbAvailable(false)
        return
      }
      try {
        // Keep current snapshot while syncing to avoid value flicker.
        setOwnedAssetDbReady(false)
        const result = await Promise.race([
          loadOwnedAssetPositions(user.id),
          new Promise((_, reject) => {
            window.setTimeout(
              () => reject(new Error('保有データの同期がタイムアウトしました')),
              OWNED_ASSET_SYNC_TIMEOUT_MS,
            )
          }),
        ])
        if (!alive) return
        setOwnedAssetDbAvailable(Boolean(result?.available))
        setRealizedDbAvailable(Boolean(result?.realizedAvailable))
        setRealizedFundDbAvailable(Boolean(result?.realizedFundAvailable))
        if (result?.realizedAvailable) {
          setRealizedStockTrades(normalizeRealizedStockTrades(result?.realizedStockTrades || []))
        } else {
          setRealizedStockTrades(loadLocalRealizedStockTradesList(user.id))
        }
        if (result?.realizedFundAvailable) {
          setRealizedFundTrades(normalizeRealizedFundTrades(result?.realizedFundTrades || []))
        } else {
          setRealizedFundTrades(loadLocalRealizedFundTradesList(user.id))
        }
        const dbStocks = normalizeOwnedLots(result?.ownedStocks || [])
        const rawOwnedFunds = normalizeOwnedFundAmounts(result?.ownedFunds || [])
        const dbFunds = rawOwnedFunds.filter(
          (r) => !isMisclassifiedStockHeldAsFundSymbol(String(r.symbol || '')),
        )
        const strippedMisclassifiedOwnedFunds = rawOwnedFunds.length - dbFunds.length
        const hadAnyDbOwnedRows = dbStocks.length > 0 || rawOwnedFunds.length > 0
        if (hadAnyDbOwnedRows) {
          setOwnedStocks(dbStocks)
          setOwnedFunds(dbFunds)
          userExplicitlyClearedAllStocksRef.current = false
          userExplicitlyClearedAllFundsRef.current = false
          clearLegacyOwnedPortfolioLocalStorage(user.id)
          if (strippedMisclassifiedOwnedFunds > 0) {
            if (result?.available) {
              try {
                await replaceOwnedAssetPositions({
                  userId: user.id,
                  ownedStocks: dbStocks,
                  ownedFunds: dbFunds,
                  persistStocks: false,
                  persistFunds: true,
                  allowEmptyFundsReplace: dbFunds.length === 0,
                })
                setDataStatus(
                  '保有ファンドに誤って登録されていた個別株を除外し、クラウドの保有ファンドを更新しました。',
                )
              } catch (persistErr) {
                setDataStatus(
                  `保有ファンドの自動修正に失敗しました: ${persistErr?.message || 'unknown error'}`,
                )
              }
            } else {
              setDataStatus(
                '保有ファンドから個別株とみなせる銘柄を表示から除外しました（クラウド更新は利用できません）。',
              )
            }
          } else {
            setDataStatus('保有株式・ファンドをクラウドから同期しました。')
          }
        } else {
          const localStocks = normalizeOwnedLots(loadLocalList(getOwnedStocksStorageKey(user.id)))
          const localFundsRaw = normalizeOwnedFundAmounts(loadLocalList(getOwnedFundsStorageKey(user.id)))
          const localFundsForUi = localFundsRaw.filter(
            (r) => !isMisclassifiedStockHeldAsFundSymbol(String(r.symbol || '')),
          )
          if (result?.available && (localStocks.length > 0 || localFundsRaw.length > 0)) {
            await replaceOwnedAssetPositions({
              userId: user.id,
              ownedStocks: localStocks,
              ownedFunds: localFundsRaw,
              persistStocks: localStocks.length > 0,
              persistFunds: localFundsRaw.length > 0,
            })
            if (!alive) return
            setOwnedStocks(localStocks)
            setOwnedFunds(localFundsForUi)
            clearLegacyOwnedPortfolioLocalStorage(user.id)
            setDataStatus('ローカル保有データをクラウドへ初回同期しました。')
          }
        }
      } catch (err) {
        if (!alive) return
        setOwnedAssetDbAvailable(false)
        setRealizedDbAvailable(false)
        setRealizedFundDbAvailable(false)
        if (user?.id) {
          setRealizedStockTrades(loadLocalRealizedStockTradesList(user.id))
          setRealizedFundTrades(loadLocalRealizedFundTradesList(user.id))
        }
        setDataStatus(`保有データ同期失敗: ${err?.message || 'unknown error'}`)
      } finally {
        if (alive) {
          setOwnedAssetDbReady(true)
        }
      }
    }
    syncFromDb()
    return () => { alive = false }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !ownedAssetDbAvailable || !ownedAssetDbReady) return
    const stocksLen = Array.isArray(ownedStocks) ? ownedStocks.length : 0
    if (stocksLen === 0 && !ownedStockCloudTouchedRef.current) return
    if (stocksLen === 0 && !userExplicitlyClearedAllStocksRef.current) return
    let alive = true
    const timer = window.setTimeout(async () => {
      try {
        await replaceOwnedAssetPositions({
          userId: user.id,
          ownedStocks,
          ownedFunds,
          persistStocks: true,
          persistFunds: false,
          allowEmptyStocksReplace: stocksLen === 0,
        })
        if (alive) userExplicitlyClearedAllStocksRef.current = false
      } catch (err) {
        if (!alive) return
        setDataStatus(`保有株式の保存失敗: ${err?.message || 'unknown error'}`)
      }
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [user?.id, ownedAssetDbAvailable, ownedAssetDbReady, ownedStocks])

  useEffect(() => {
    if (!user?.id || !ownedAssetDbAvailable || !ownedAssetDbReady) return
    const fundsLen = Array.isArray(ownedFunds) ? ownedFunds.length : 0
    if (fundsLen === 0 && !ownedFundCloudTouchedRef.current) return
    if (fundsLen === 0 && !userExplicitlyClearedAllFundsRef.current) return
    let alive = true
    const timer = window.setTimeout(async () => {
      try {
        await replaceOwnedAssetPositions({
          userId: user.id,
          ownedStocks,
          ownedFunds,
          persistStocks: false,
          persistFunds: true,
          allowEmptyFundsReplace: fundsLen === 0,
        })
        if (alive) userExplicitlyClearedAllFundsRef.current = false
      } catch (err) {
        if (!alive) return
        setDataStatus(`保有ファンドの保存失敗: ${err?.message || 'unknown error'}`)
      }
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [user?.id, ownedAssetDbAvailable, ownedAssetDbReady, ownedFunds])

  useEffect(() => {
    if (!user?.id || !ownedAssetDbReady) return
    // 読み込みで state が入っただけでは書き戻さない。売却・修正・削除のときだけ置換する。
    if (!ownedRealizedCloudTouchedRef.current) return
    if (!realizedDbAvailable) {
      try {
        localStorage.setItem(
          getOwnedRealizedStockTradesStorageKey(user.id),
          JSON.stringify(normalizeRealizedStockTrades(realizedStockTrades)),
        )
      } catch {
        // ignore
      }
      ownedRealizedCloudTouchedRef.current = false
      return
    }
    if (!ownedAssetDbAvailable) return
    const n = Array.isArray(realizedStockTrades) ? realizedStockTrades.length : 0
    let alive = true
    const timer = window.setTimeout(async () => {
      ownedRealizedCloudTouchedRef.current = false
      try {
        await replaceOwnedAssetPositions({
          userId: user.id,
          ownedStocks,
          ownedFunds,
          realizedStockTrades: normalizeRealizedStockTrades(realizedStockTrades),
          persistStocks: false,
          persistFunds: false,
          persistRealized: true,
          allowEmptyRealizedReplace: n === 0,
        })
      } catch (err) {
        if (!alive) return
        setDataStatus(`実現損益ログの保存失敗: ${err?.message || 'unknown error'}`)
      }
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [user?.id, ownedAssetDbAvailable, ownedAssetDbReady, realizedDbAvailable, realizedStockTrades])

  useEffect(() => {
    if (!user?.id || !ownedAssetDbReady) return
    if (!ownedRealizedFundCloudTouchedRef.current) return
    if (!realizedFundDbAvailable) {
      try {
        localStorage.setItem(
          getOwnedRealizedFundTradesStorageKey(user.id),
          JSON.stringify(normalizeRealizedFundTrades(realizedFundTrades)),
        )
      } catch {
        // ignore
      }
      ownedRealizedFundCloudTouchedRef.current = false
      return
    }
    if (!ownedAssetDbAvailable) return
    const n = Array.isArray(realizedFundTrades) ? realizedFundTrades.length : 0
    let alive = true
    const timer = window.setTimeout(async () => {
      ownedRealizedFundCloudTouchedRef.current = false
      try {
        await replaceOwnedAssetPositions({
          userId: user.id,
          ownedStocks,
          ownedFunds,
          realizedFundTrades: normalizeRealizedFundTrades(realizedFundTrades),
          persistStocks: false,
          persistFunds: false,
          persistRealizedFunds: true,
          allowEmptyRealizedFundReplace: n === 0,
        })
      } catch (err) {
        if (!alive) return
        setDataStatus(`ファンド実現損益ログの保存失敗: ${err?.message || 'unknown error'}`)
      }
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [user?.id, ownedAssetDbAvailable, ownedAssetDbReady, realizedFundDbAvailable, realizedFundTrades])


  const fetchLatestCloseByDate = async (symbol, baseDate) => {
    const symbolCode = String(symbol || '').trim()
    const dateText = toIsoDate(baseDate)
    if (!symbolCode || !dateText) return null
    const { data, error } = await supabase
      .from('stock_daily_prices')
      .select('trade_date,close')
      .eq('symbol', symbolCode)
      .lte('trade_date', dateText)
      .order('trade_date', { ascending: false })
      .limit(1)
    if (error) throw error
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null
    const close = Number(row?.close || 0)
    if (!row || !Number.isFinite(close) || close <= 0) return null
    return { tradeDate: row.trade_date, close }
  }

  const searchStockSuggestions = async (inputValue) => {
    const raw = String(inputValue || '').trim()
    if (!raw) return []
    const q = raw.toLowerCase()
    const mergeSuggestionParts = (prev, next) => {
      const pick = (a, b) => String(b || '').trim() || String(a || '').trim() || ''
      return {
        symbol: String(next.symbol || prev.symbol || '').trim().toUpperCase(),
        stockSymbolName: pick(prev.stockSymbolName, next.stockSymbolName),
        profileJp: pick(prev.profileJp, next.profileJp),
        profileEn: pick(prev.profileEn, next.profileEn),
      }
    }
    const finalizeSuggestions = (mergedMap, order) => (
      order
        .map((key) => mergedMap.get(key))
        .filter(Boolean)
        .map((parts) => {
          const sym = String(parts.symbol || '').trim().toUpperCase()
          return {
            symbol: sym,
            name: resolveOwnedStockDisplayName(
              sym,
              parts.stockSymbolName,
              parts.profileJp,
              parts.profileEn,
              getStockNameFallback(sym) || '',
            ),
          }
        })
    )

    const localMatches = STOCK_LIST_400.filter((row) => {
      if (isRetiredStockSymbol(row?.symbol) || isUsListedEtfSymbol(row?.symbol, row?.name)) return false
      const symbol = String(row?.symbol || '').toLowerCase()
      const name = String(row?.name || '').toLowerCase()
      const fallbackName = String(getStockNameFallback(row?.symbol) || '').toLowerCase()
      return symbol.includes(q) || name.includes(q) || fallbackName.includes(q)
    }).slice(0, 12)

    const localMerged = new Map()
    const localOrder = []
    for (const row of localMatches) {
      const sym = String(row?.symbol || '').trim().toUpperCase()
      if (!sym || isRetiredStockSymbol(sym)) continue
      const parts = { symbol: sym, stockSymbolName: row.name, profileJp: '', profileEn: '' }
      if (!localMerged.has(sym)) {
        localOrder.push(sym)
        localMerged.set(sym, parts)
      } else {
        localMerged.set(sym, mergeSuggestionParts(localMerged.get(sym), parts))
      }
    }

    try {
      const safe = raw.replace(/[,%]/g, '').trim()
      if (!safe) return finalizeSuggestions(localMerged, localOrder).slice(0, 20)
      const [{ data, error }, { data: profileData, error: profileErr }] = await Promise.all([
        supabase
          .from('stock_symbols')
          .select('symbol,name')
          .or(`symbol.ilike.%${safe}%,name.ilike.%${safe}%`)
          .limit(20),
        supabase
          .from('stock_symbol_profiles')
          .select('symbol,name_jp,name_en')
          .or(`symbol.ilike.%${safe}%,name_jp.ilike.%${safe}%,name_en.ilike.%${safe}%`)
          .limit(20),
      ])
      if (error) throw error
      if (profileErr) throw profileErr
      const profileMap = new Map(
        (Array.isArray(profileData) ? profileData : []).map((row) => [
          String(row?.symbol || '').trim().toUpperCase(),
          row,
        ])
      )
      const merged = new Map(localMerged)
      const order = [...localOrder]

      const upsert = (parts) => {
        const key = String(parts.symbol || '').trim().toUpperCase()
        if (!key || isRetiredStockSymbol(key) || isUsListedEtfSymbol(key, parts.stockSymbolName || parts.profileEn || parts.profileJp)) return
        if (!merged.has(key)) {
          order.push(key)
          merged.set(key, parts)
          return
        }
        merged.set(key, mergeSuggestionParts(merged.get(key), parts))
      }

      for (const row of Array.isArray(data) ? data : []) {
        const symbol = String(row.symbol || '').trim().toUpperCase()
        if (!symbol) continue
        const profile = profileMap.get(symbol)
        upsert({
          symbol,
          stockSymbolName: row.name,
          profileJp: profile?.name_jp || '',
          profileEn: profile?.name_en || '',
        })
      }
      for (const row of Array.isArray(profileData) ? profileData : []) {
        const symbol = String(row?.symbol || '').trim().toUpperCase()
        if (!symbol) continue
        upsert({
          symbol,
          stockSymbolName: '',
          profileJp: row?.name_jp || '',
          profileEn: row?.name_en || '',
        })
      }

      return finalizeSuggestions(merged, order).slice(0, 20)
    } catch {
      return finalizeSuggestions(localMerged, localOrder).slice(0, 20)
    }
  }

  /** マイページ・ファンドタブ用: ETF/ファンドのみ検索（株銘柄は出さない） */
  const searchFundSuggestions = async (inputValue) => {
    const raw = String(inputValue || '').trim()
    if (!raw) return []
    const q = raw.toLowerCase()
    const list = Array.isArray(ETF_LIST_FROM_XLSX) ? ETF_LIST_FROM_XLSX : []
    return list
      .filter((row) => {
        const symbol = String(row?.symbol || '').toLowerCase()
        const symKey = String(row?.symbol || '').trim().toUpperCase()
        const resolved = resolveFundDisplayName(symKey, {}, row, null)
        const nameHay = String(resolved || '').toLowerCase()
        return symbol.includes(q) || nameHay.includes(q)
      })
      .slice(0, 20)
      .map((row) => {
        const symKey = String(row?.symbol || '').trim().toUpperCase()
        const name = resolveFundDisplayName(symKey, {}, row, null)
        return {
          symbol: row.symbol,
          name: name || symKey,
        }
      })
  }

  const resolveStockSymbol = async (inputValue) => {
    const raw = String(inputValue || '').trim()
    if (!raw) return null
    if (isRetiredStockSymbol(raw)) return null
    const upper = raw.toUpperCase()
    const lower = raw.toLowerCase()
    const localExact = (Array.isArray(stockWatchlistItems) ? stockWatchlistItems : []).find((row) => {
      const id = String(row?.id || '').toUpperCase()
      const code = String(row?.code || '').toUpperCase()
      const name = String(row?.name || '').toLowerCase()
      return id === upper || code === upper || name === lower
    })
    if (localExact?.id) {
      const wid = String(localExact.id || '').trim().toUpperCase()
      const wcode = String(localExact.code || '').trim().toUpperCase()
      if (!isRetiredStockSymbol(wid) && !isRetiredStockSymbol(wcode) && !isUsListedEtfSymbol(wid, localExact.name) && !isUsListedEtfSymbol(wcode, localExact.name)) {
        return {
          symbol: String(localExact.id),
          name: localExact.name || localExact.code || localExact.id,
        }
      }
    }

    try {
      const { data: exactRows, error: exactErr } = await supabase
        .from('stock_symbols')
        .select('symbol,name')
        .eq('symbol', upper)
        .limit(1)
      if (exactErr) throw exactErr
      if (Array.isArray(exactRows) && exactRows.length > 0) {
        const sym = String(exactRows[0].symbol || '').trim().toUpperCase()
        if (isRetiredStockSymbol(sym) || isUsListedEtfSymbol(sym, exactRows[0].name)) return null
        return {
          symbol: exactRows[0].symbol,
          name: exactRows[0].name || exactRows[0].symbol,
        }
      }
    } catch {
      // fallback to fuzzy search
    }

    try {
      const q = raw.replace(/[,%]/g, '').trim()
      if (!q) return null
      const [{ data: fuzzyRows, error: fuzzyErr }, { data: profileRows, error: profileErr }] = await Promise.all([
        supabase
          .from('stock_symbols')
          .select('symbol,name')
          .or(`symbol.ilike.%${q}%,name.ilike.%${q}%`)
          .limit(20),
        supabase
          .from('stock_symbol_profiles')
          .select('symbol,name_jp,name_en')
          .or(`symbol.ilike.%${q}%,name_jp.ilike.%${q}%,name_en.ilike.%${q}%`)
          .limit(20),
      ])
      if (fuzzyErr) throw fuzzyErr
      if (profileErr) throw profileErr
      const profileMap = new Map(
        (Array.isArray(profileRows) ? profileRows : []).map((row) => [
          String(row?.symbol || '').trim().toUpperCase(),
          row,
        ])
      )
      const rows = (Array.isArray(fuzzyRows) ? fuzzyRows : []).map((row) => {
        const symbol = String(row?.symbol || '').trim().toUpperCase()
        const profile = profileMap.get(symbol)
        return {
          symbol,
          name: profile?.name_jp || profile?.name_en || row?.name || getStockNameFallback(symbol) || symbol,
        }
      }).filter((row) => !isRetiredStockSymbol(row.symbol) && !isUsListedEtfSymbol(row.symbol, row.name))
      for (const row of (Array.isArray(profileRows) ? profileRows : [])) {
        const symbol = String(row?.symbol || '').trim().toUpperCase()
        if (!symbol || isRetiredStockSymbol(symbol) || isUsListedEtfSymbol(symbol, row?.name_en || row?.name_jp) || rows.some((x) => x.symbol === symbol)) continue
        rows.push({
          symbol,
          name: row?.name_jp || row?.name_en || getStockNameFallback(symbol) || symbol,
        })
      }
      if (rows.length === 0) return null
      const scored = rows
        .map((row) => {
          const symbol = String(row?.symbol || '')
          const name = String(row?.name || '')
          const sUpper = symbol.toUpperCase()
          const nLower = name.toLowerCase()
          let score = 0
          if (sUpper === upper) score += 100
          if (nLower === lower) score += 95
          if (sUpper.startsWith(upper)) score += 70
          if (nLower.startsWith(lower)) score += 60
          if (sUpper.includes(upper)) score += 40
          if (nLower.includes(lower)) score += 30
          return { symbol, name, score }
        })
        .sort((a, b) => b.score - a.score)
      const top = scored[0]
      if (!top?.symbol) return null
      return { symbol: top.symbol, name: top.name || top.symbol }
    } catch {
      const localMatch = STOCK_LIST_400.find((row) => {
        if (isRetiredStockSymbol(row?.symbol) || isUsListedEtfSymbol(row?.symbol, row?.name)) return false
        const symbol = String(row?.symbol || '').toUpperCase()
        const name = String(row?.name || '').toLowerCase()
        const fallbackName = String(getStockNameFallback(symbol) || '').toLowerCase()
        return symbol === upper || symbol.includes(upper) || name.includes(lower) || fallbackName.includes(lower)
      })
      if (localMatch?.symbol && !isRetiredStockSymbol(localMatch.symbol)) {
        return {
          symbol: localMatch.symbol,
          name: getStockNameFallback(localMatch.symbol) || localMatch.name || localMatch.symbol,
        }
      }
      return null
    }
  }

  const handleAddOwnedStock = async ({ symbol, buyDate, buyPrice, qty, currency }) => {
    const input = String(symbol || '').trim()
    if (!input) {
      setDataStatus('銘柄コードまたは会社名を入力してください。')
      return false
    }
    const resolved = await resolveStockSymbol(input)
    if (!resolved?.symbol) {
      setDataStatus(`"${input}" に一致する銘柄が見つかりませんでした。`)
      return false
    }
    const code = String(resolved.symbol).trim().toUpperCase()
    const pickedCurrency = String(currency || '').trim().toUpperCase()
    const lotCurrency = pickedCurrency === 'JPY' || pickedCurrency === 'USD'
      ? pickedCurrency
      : inferStockCurrency(code)
    const requestedIso = toIsoDate(buyDate || '')
    let resolvedDate = requestedIso || String(buyDate || '').trim()
    let resolvedBuyPrice = Number(buyPrice || 0)
    const resolvedQtyRaw = Math.max(0, Number(qty || 0))
    const resolvedQty = Number.isFinite(resolvedQtyRaw) ? roundStockShareQty(resolvedQtyRaw) : 0
    let priceFromFallbackDate = ''
    if (resolvedDate && !(resolvedBuyPrice > 0)) {
      try {
        const row = await fetchLatestCloseByDate(code, resolvedDate)
        if (row) {
          resolvedBuyPrice = Number(normalizeOwnedDisplayPrice(code, row.close).toFixed(4))
          if (requestedIso && row.tradeDate && row.tradeDate !== requestedIso) {
            priceFromFallbackDate = row.tradeDate
          }
        }
      } catch {
        // Keep manual input path when price lookup fails.
      }
    }
    userExplicitlyClearedAllStocksRef.current = false
    ownedStockCloudTouchedRef.current = true
    setOwnedStocks((prev) => {
      const next = [
        ...prev,
        {
          lotId: createOwnedLotId(),
          symbol: code,
          buyDate: resolvedDate || '',
          buyPrice: resolvedBuyPrice > 0 ? resolvedBuyPrice : '',
          qty: resolvedQty > 0 ? resolvedQty : '',
          currency: lotCurrency,
          buyFxRate: lotCurrency === 'JPY' ? 1 : '',
          buyFxDate: lotCurrency === 'JPY' ? (resolvedDate || '') : '',
        },
      ]
      if (user?.id) {
        queueMicrotask(() => {
          const fn = syncDividendFromOwnedRef.current
          if (fn) void fn(code, next, String(resolved?.name || '').trim() || null)
        })
      }
      return next
    })
    const fallbackNote = priceFromFallbackDate
      ? `（指定日に行が無く、${priceFromFallbackDate} 終値を価格に使用。DBの欠損要確認）`
      : ''
    setDataStatus(`保有銘柄 ${code} を追加しました。${fallbackNote}`)
    return true
  }

  const handleUpdateOwnedStock = (lotId, patch = {}) => {
    if (!lotId) return
    ownedStockCloudTouchedRef.current = true
    setOwnedStocks((prev) => {
      const next = prev.map((item) => (
        item.lotId === lotId
          ? { ...item, ...patch }
          : item
      ))
      const row = next.find((x) => x.lotId === lotId) || prev.find((x) => x.lotId === lotId)
      const sym = String(
        (patch && patch.symbol) || row?.symbol || '',
      )
        .trim()
        .toUpperCase()
      if (sym && user?.id) {
        queueMicrotask(() => {
          const fn = syncDividendFromOwnedRef.current
          if (fn) void fn(sym, next, null)
        })
      }
      return next
    })
  }

  const handleLoadOwnedStockPrice = async (lotId, symbol, buyDate) => {
    if (!lotId || !symbol || !buyDate) {
      setDataStatus('買付日を先に入力してください。')
      return
    }
    const requestedIso = toIsoDate(buyDate)
    try {
      const row = await fetchLatestCloseByDate(symbol, buyDate)
      if (!row) {
        setDataStatus('指定日の終値を取得できませんでした。')
        return
      }
      handleUpdateOwnedStock(lotId, {
        buyPrice: Number(normalizeOwnedDisplayPrice(symbol, row.close).toFixed(4)),
      })
      if (requestedIso && row.tradeDate !== requestedIso) {
        setDataStatus(
          `${symbol}: 買付日はそのままに、${row.tradeDate} 終値を価格に反映しました（指定日以前の最新行が ${row.tradeDate} のみ。DB欠損の可能性）`,
        )
      } else {
        setDataStatus(`${symbol} の買付価格を ${row.tradeDate} 終値で反映しました。`)
      }
    } catch {
      setDataStatus('買付価格取得に失敗しました。')
    }
  }
  const handleAddOwnedFund = async ({ symbol, investAmount, buyDate, buyPrice }) => {
    const input = String(symbol || '').trim()
    if (!input) {
      setDataStatus('ファンドコードまたは名称を入力してください。')
      return false
    }
    const resolved = await resolveStockSymbol(input)
    if (!resolved?.symbol) {
      setDataStatus(`"${input}" に一致するファンドが見つかりませんでした。`)
      return false
    }
    const code = String(resolved.symbol).trim().toUpperCase()
    if (isMisclassifiedStockHeldAsFundSymbol(code)) {
      setDataStatus(
        `「${code}」は個別株として管理されています。「株式」タブの保有銘柄から追加してください（この欄は日本上場の投信・ETF向けです）。`,
      )
      return false
    }
    const etfMetaRow = MY_PAGE_ETF_META_BY_SYMBOL.get(code) || null
    const fundDisplayName = resolveFundDisplayName(code, { name: resolved.name || '' }, etfMetaRow, null)
    const resolvedDate = toIsoDate(buyDate || '')
    let resolvedBuyPrice = Math.max(0, Number(buyPrice || 0))
    if (!resolvedBuyPrice && resolvedDate) {
      try {
        const row = await fetchLatestCloseByDate(code, resolvedDate)
        if (row?.close) resolvedBuyPrice = Number(normalizeOwnedDisplayPrice(code, row.close).toFixed(4))
      } catch {
        // keep manual path
      }
    }
    const normalizedInvest = Math.max(0, Number(investAmount || 0))
    if (normalizedInvest <= 0) {
      setDataStatus('投資元本を入力してください。')
      return false
    }
    if (resolvedBuyPrice <= 0) {
      setDataStatus('買付価格を入力するか、買付日を設定して終値を反映してください。')
      return false
    }
    userExplicitlyClearedAllFundsRef.current = false
    ownedFundCloudTouchedRef.current = true
    setOwnedFunds((prev) => [
      ...prev,
      {
        id: createOwnedLotId(),
        symbol: code,
        name: fundDisplayName || resolved.name || code,
        investAmount: normalizedInvest,
        buyDate: resolvedDate || '',
        buyPrice: resolvedBuyPrice,
      },
    ])
    setDataStatus(`保有ファンド ${code} を追加しました。`)
    return true
  }

  const handleUpdateOwnedFund = (id, patch = {}) => {
    if (!id) return
    ownedFundCloudTouchedRef.current = true
    setOwnedFunds((prev) => prev.map((item) => (
      item.id === id
        ? {
          ...item,
          ...patch,
          investAmount: patch.investAmount != null ? String(patch.investAmount) : item.investAmount,
          buyPrice: patch.buyPrice != null ? String(patch.buyPrice) : item.buyPrice,
          buyDate: patch.buyDate != null ? toIsoDate(patch.buyDate || '') : String(item.buyDate || ''),
        }
        : item
    )))
  }

  const handleRemoveOwnedFund = (id) => {
    if (!id) return
    ownedFundCloudTouchedRef.current = true
    setOwnedFunds((prev) => {
      const next = prev.filter((item) => item.id !== id)
      if (prev.length > 0 && next.length === 0) userExplicitlyClearedAllFundsRef.current = true
      return next
    })
    setDataStatus('保有ファンドの取引を削除しました（実現損益には計上されません）。')
  }

  const handleRemoveOwnedStock = (lotId) => {
    if (!lotId) return
    let didRemove = false
    let symForSync = ''
    let nextForSync = []
    setOwnedStocks((prev) => {
      const row = prev.find((x) => x.lotId === lotId)
      if (!row) return prev
      didRemove = true
      ownedStockCloudTouchedRef.current = true
      symForSync = String(row.symbol || '').trim().toUpperCase()
      nextForSync = prev.filter((item) => item.lotId !== lotId)
      if (prev.length > 0 && nextForSync.length === 0) userExplicitlyClearedAllStocksRef.current = true
      return nextForSync
    })
    if (!didRemove) return
    if (symForSync && user?.id) {
      queueMicrotask(() => {
        const fn = syncDividendFromOwnedRef.current
        if (fn) void fn(symForSync, nextForSync, null)
      })
    }
    setDataStatus('保有株式の取引を削除しました（実現損益には計上されません）。')
  }

  const handleLoadOwnedFundPrice = async (id, symbol, buyDate) => {
    if (!id || !symbol || !buyDate) {
      setDataStatus('買付日を先に入力してください。')
      return
    }
    const requestedIso = toIsoDate(buyDate)
    try {
      const row = await fetchLatestCloseByDate(symbol, buyDate)
      if (!row) {
        setDataStatus('指定日の終値を取得できませんでした。')
        return
      }
      handleUpdateOwnedFund(id, {
        buyPrice: Number(normalizeOwnedDisplayPrice(symbol, row.close).toFixed(4)),
      })
      if (requestedIso && row.tradeDate !== requestedIso) {
        setDataStatus(
          `${symbol}: 買付日はそのままに、${row.tradeDate} 終値を価格に反映しました（指定日以前の最新行が ${row.tradeDate} のみ。DB欠損の可能性）`,
        )
      } else {
        setDataStatus(`${symbol} の買付価格を ${row.tradeDate} 終値で反映しました。`)
      }
    } catch {
      setDataStatus('買付価格取得に失敗しました。')
    }
  }

  const handleRemoveStockWatchlist = (symbolId) => {
    const id = String(symbolId || '').trim()
    if (!id) return
    setStockWatchlistItems((prev) => {
      const next = Array.isArray(prev) ? prev.filter((row) => String(row?.id || '').trim() !== id) : []
      const nextIds = next.map((row) => String(row?.id || '').trim()).filter(Boolean)
      if (user?.id) {
        removeDbWatchlistItem({ userId: user.id, itemType: 'stock', itemId: id }).catch(() => {})
      } else {
        try {
          localStorage.setItem(getStockWatchlistStorageKey(null), JSON.stringify(nextIds))
        } catch {
          // ignore
        }
      }
      return next
    })
    setDataStatus('株式ウォッチリストから削除しました。')
  }

  useEffect(() => {
    let alive = true
    const loadOwnedLiveRows = async (silentRefresh = false) => {
      const list = Array.isArray(ownedStocks) ? ownedStocks : []
      if (list.length === 0) {
        if (!silentRefresh && alive) setStockPortfolioQuotesHydrating(false)
        // Keep previous rows for a short moment to avoid flicker during transient sync states.
        if (ownedStockItemsClearTimerRef.current) window.clearTimeout(ownedStockItemsClearTimerRef.current)
        ownedStockItemsClearTimerRef.current = window.setTimeout(() => {
          if (alive) setOwnedStockItems([])
        }, 260)
        return
      }
      if (ownedStockItemsClearTimerRef.current) {
        window.clearTimeout(ownedStockItemsClearTimerRef.current)
        ownedStockItemsClearTimerRef.current = null
      }
      if (!silentRefresh && alive) setStockPortfolioQuotesHydrating(true)
      const hydrateTimeoutId = (!silentRefresh && list.length > 0)
        ? window.setTimeout(() => {
          if (alive) setStockPortfolioQuotesHydrating(false)
        }, PORTFOLIO_QUOTES_HYDRATE_TIMEOUT_MS)
        : null
      /** DB フェッチより先にグルーピング用の最小行で埋める（上段レポートが空枠になりにくい） */
      if (alive) {
        setOwnedStockItems(
          list.map((item) => {
            const symbol = String(item.symbol || '').trim().toUpperCase()
            return {
              lotId: item.lotId || createOwnedLotId(),
              symbol,
              code: symbol,
              name: symbol,
              buyDate: item.buyDate || '',
              buyPrice: item.buyPrice ?? '',
              qty: item.qty ?? '',
              currency: item.currency || '',
              buyFxRate: item.buyFxRate || '',
              buyFxDate: item.buyFxDate || '',
              price: 0,
              tradeDate: '',
              profileSector: '',
              profileIndustry: '',
            }
          }),
        )
      }
      try {
        const ids = [...new Set(list.map((item) => String(item.symbol || '').trim().toUpperCase()).filter(Boolean))]
        const latestRows = []
        try {
          for (let i = 0; i < ids.length; i += 80) {
            const batch = ids.slice(i, i + 80)
            const { data, error } = await supabase
              .from('v_stock_latest')
              .select('symbol,trade_date,close')
              .in('symbol', batch)
            if (error) throw error
            latestRows.push(...(data || []))
          }
        } catch {
          // continue with fallback only
        }
        let symbolNameMap = new Map()
        let symbolProfileNameMap = new Map()
        try {
          const [{ data }, { data: profileRows }] = await Promise.all([
            supabase
              .from('stock_symbols')
              .select('symbol,name')
              .in('symbol', ids),
            supabase
              .from('stock_symbol_profiles')
              .select('symbol,name_jp,name_en')
              .in('symbol', ids),
          ])
          symbolNameMap = new Map((data || []).map((row) => [String(row.symbol || '').trim().toUpperCase(), row.name]))
          symbolProfileNameMap = new Map(
            (profileRows || []).map((row) => [
              String(row.symbol || '').trim().toUpperCase(),
              { name_jp: row?.name_jp || '', name_en: row?.name_en || '' },
            ])
          )
        } catch {
          // no-op
        }
        const symbolProfileSectorMap = new Map()
        const symbolProfileIndustryMap = new Map()
        try {
          for (let i = 0; i < ids.length; i += 80) {
            const batch = ids.slice(i, i + 80)
            const { data, error } = await supabase
              .from('stock_symbol_profiles')
              .select('symbol,sector,industry,name_jp,name_en')
              .in('symbol', batch)
            if (error) throw error
            ;(data || []).forEach((row) => {
              const sym = String(row?.symbol || '').trim().toUpperCase()
              if (!sym) return
              if (row.sector != null && String(row.sector).trim()) symbolProfileSectorMap.set(sym, String(row.sector).trim())
              if (row.industry != null && String(row.industry).trim()) symbolProfileIndustryMap.set(sym, String(row.industry).trim())
              if (row.name_jp != null || row.name_en != null) {
                symbolProfileNameMap.set(sym, { name_jp: row?.name_jp || '', name_en: row?.name_en || '' })
              }
            })
          }
        } catch {
          // profiles optional
        }
        const watchMap = new Map((Array.isArray(stockWatchlistItems) ? stockWatchlistItems : []).map((row) => [String(row.id || '').trim().toUpperCase(), row]))
        const latestMap = new Map(latestRows.map((row) => [String(row.symbol || '').trim().toUpperCase(), row]))
        const rows = list.map((item) => {
          const symbol = String(item.symbol || '').trim().toUpperCase()
          const watch = watchMap.get(symbol) || {}
          const live = latestMap.get(symbol) || {}
          const close = normalizeOwnedDisplayPrice(symbol, Number(live.close || watch.price || 0))
          return {
            lotId: item.lotId || createOwnedLotId(),
            symbol,
            code: symbol,
            name: resolveOwnedStockDisplayName(
              symbol,
              symbolNameMap.get(symbol),
              symbolProfileNameMap.get(symbol)?.name_jp,
              symbolProfileNameMap.get(symbol)?.name_en,
              watch.name,
            ),
            buyDate: item.buyDate || '',
            buyPrice: item.buyPrice || '',
            qty: item.qty || '',
            currency: item.currency || '',
            buyFxRate: item.buyFxRate || '',
            buyFxDate: item.buyFxDate || '',
            price: Number.isFinite(close) && close > 0 ? close : 0,
            tradeDate: live.trade_date || watch.tradeDate || '',
            profileSector: symbolProfileSectorMap.get(symbol) || '',
            profileIndustry: symbolProfileIndustryMap.get(symbol) || '',
          }
        })
        if (alive) setOwnedStockItems(rows)
      } finally {
        if (hydrateTimeoutId) window.clearTimeout(hydrateTimeoutId)
        if (alive && !silentRefresh) setStockPortfolioQuotesHydrating(false)
      }
    }
    loadOwnedLiveRows(false)
    const intervalId = window.setInterval(() => { void loadOwnedLiveRows(true) }, DAILY_REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(intervalId)
      if (ownedStockItemsClearTimerRef.current) {
        window.clearTimeout(ownedStockItemsClearTimerRef.current)
        ownedStockItemsClearTimerRef.current = null
      }
    }
  }, [ownedStocks, stockWatchlistItems])

  useEffect(() => {
    const items = Array.isArray(ownedStockItems) ? ownedStockItems : []
    const dates = new Set()
    items.forEach((row) => {
      const d1 = toIsoDate(row?.buyDate || '')
      if (d1) dates.add(d1)
    })
    if (dates.size === 0) {
      setFxRatesByDate({})
      return
    }
    const sorted = [...dates].sort()
    const start = sorted[0]
    const end = sorted[sorted.length - 1]
    let alive = true
    fetch(`/api/fx?start_date=${start}&end_date=${end}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return
        setFxRatesByDate(data?.ratesByDate || {})
      })
      .catch(() => { if (alive) setFxRatesByDate({}) })
    return () => { alive = false }
  }, [ownedStockItems])

  useEffect(() => {
    let alive = true

    const loadTodayFx = () => {
      const todayIso = new Date().toISOString().slice(0, 10)
      fetch(`/api/fx?date=${todayIso}`)
        .then((r) => r.json())
        .then((data) => {
          if (!alive) return
          const usd = Number(data?.rates?.USD)
          if (Number.isFinite(usd) && usd > 0) {
            setValuationUsdJpy(usd)
            setValuationFxDate(String(data?.fxAsOf || data?.date || todayIso))
          }
        })
        .catch(() => {
          if (!alive) return
        })
    }

    loadTodayFx()
    const intervalId = window.setInterval(loadTodayFx, DAILY_REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const loadOwnedFundLiveRows = async (silentRefresh = false) => {
      const list = Array.isArray(ownedFunds) ? ownedFunds : []
      if (list.length === 0) {
        if (!silentRefresh && alive) setFundPortfolioQuotesHydrating(false)
        // Keep previous rows for a short moment to avoid flicker during transient sync states.
        if (ownedFundItemsClearTimerRef.current) window.clearTimeout(ownedFundItemsClearTimerRef.current)
        ownedFundItemsClearTimerRef.current = window.setTimeout(() => {
          if (alive) setOwnedFundItems([])
        }, 260)
        return
      }
      if (ownedFundItemsClearTimerRef.current) {
        window.clearTimeout(ownedFundItemsClearTimerRef.current)
        ownedFundItemsClearTimerRef.current = null
      }
      if (!silentRefresh && alive) setFundPortfolioQuotesHydrating(true)
      const hydrateTimeoutId = (!silentRefresh && list.length > 0)
        ? window.setTimeout(() => {
          if (alive) setFundPortfolioQuotesHydrating(false)
        }, PORTFOLIO_QUOTES_HYDRATE_TIMEOUT_MS)
        : null
      if (alive) {
        setOwnedFundItems(
          list.map((item) => {
            const symbol = String(item.symbol || '').trim().toUpperCase()
            return {
              id: item.id || createOwnedLotId(),
              symbol,
              code: symbol,
              name: resolveOwnedFundDisplayName(symbol, undefined, item.name),
              investAmount: Math.max(0, Number(item.investAmount || 0)),
              buyDate: toIsoDate(item.buyDate || ''),
              buyPrice: Math.max(0, Number(item.buyPrice || 0)),
              latestPrice: 0,
              tradeDate: '',
            }
          }),
        )
      }
      try {
        const ids = [...new Set(list.map((item) => String(item.symbol || '').trim().toUpperCase()).filter(Boolean))]
        const latestRows = []
        try {
          for (let i = 0; i < ids.length; i += 80) {
            const batch = ids.slice(i, i + 80)
            const { data, error } = await supabase
              .from('v_stock_latest')
              .select('symbol,trade_date,close')
              .in('symbol', batch)
            if (error) throw error
            latestRows.push(...(data || []))
          }
        } catch {
          // continue with stored values only
        }
        let symbolNameMap = new Map()
        try {
          const { data } = await supabase
            .from('stock_symbols')
            .select('symbol,name')
            .in('symbol', ids)
          symbolNameMap = new Map(
            (data || []).map((row) => [String(row.symbol || '').trim().toUpperCase(), row.name])
          )
        } catch {
          // no-op
        }

        const latestMap = new Map(latestRows.map((row) => [String(row.symbol || '').trim().toUpperCase(), row]))
        const rows = list.map((item) => {
          const symbol = String(item.symbol || '').trim().toUpperCase()
          const live = latestMap.get(symbol) || {}
          const latestClose = normalizeOwnedDisplayPrice(symbol, Number(live.close || 0))
          const stockNm = symbolNameMap.get(symbol)
          return {
            id: item.id || createOwnedLotId(),
            symbol,
            code: symbol,
            name: resolveOwnedFundDisplayName(symbol, stockNm, item.name),
            investAmount: Math.max(0, Number(item.investAmount || 0)),
            buyDate: toIsoDate(item.buyDate || ''),
            buyPrice: Math.max(0, Number(item.buyPrice || 0)),
            latestPrice: Number.isFinite(latestClose) && latestClose > 0 ? latestClose : 0,
            tradeDate: live.trade_date || '',
          }
        })
        if (alive) setOwnedFundItems(rows)
      } finally {
        if (hydrateTimeoutId) window.clearTimeout(hydrateTimeoutId)
        if (alive && !silentRefresh) setFundPortfolioQuotesHydrating(false)
      }
    }
    loadOwnedFundLiveRows(false)
    const intervalId = window.setInterval(() => { void loadOwnedFundLiveRows(true) }, DAILY_REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(intervalId)
      if (ownedFundItemsClearTimerRef.current) {
        window.clearTimeout(ownedFundItemsClearTimerRef.current)
        ownedFundItemsClearTimerRef.current = null
      }
    }
  }, [ownedFunds])

  const dbPortfolio = assetPositions.map((a, i) => {
    const invest = Number(a.invest_value || 0)
    const value = Number(a.current_value || 0)
    const pnlRate = invest > 0 ? ((value - invest) / invest) * 100 : 0
    return {
      id: a.id || `asset-${i}`,
      name: decodeHtmlEntities(String(a.name || '')) || a.name,
      value,
      invest,
      return: Number(pnlRate.toFixed(1)),
      color: a.color || '#3b82f6',
      source: 'db',
    }
  })
  const effectivePortfolio = dbPortfolio.length > 0
    ? dbPortfolio
    : (user?.id
      ? []
      : (Array.isArray(localFundPositions) && localFundPositions.length > 0
        ? localFundPositions.map((p, idx) => ({ id: p.id || `local-fund-${idx}`, ...p, source: 'local' }))
        : PORTFOLIO.map((p) => ({ ...p, source: 'mock' }))))
  const effectiveExpenses = Array.isArray(expenses) ? expenses : []
  const effectiveInsurances = Array.isArray(insurances) ? insurances : []
  const effectivePointAccounts = Array.isArray(pointAccounts) ? pointAccounts : []
  const monthlyExpensesRecent3 = (() => {
    const rows = Array.isArray(effectiveExpenses) ? effectiveExpenses : []
    const bucket = new Map()
    rows.forEach((row) => {
      const amount = Math.max(0, Number(row?.amount || 0))
      const dRaw = String(row?.spent_on || row?.created_at || '')
      const d = dRaw ? new Date(dRaw) : null
      if (!d || Number.isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      bucket.set(key, (bucket.get(key) || 0) + amount)
    })
    const latest3 = Array.from(bucket.entries())
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
      .slice(0, 3)
      .map(([, total]) => Math.round(Number(total || 0)))
    while (latest3.length < 3) latest3.push(0)
    return latest3
  })()
  const effectiveStockWatchlistItems = Array.isArray(stockWatchlistItems) ? stockWatchlistItems : []
  const summaryBaseMonthlyYen = calcMonthlyPayment(Number(loanRemainingYen || 0), 0.9, 30)
  const summaryAnnualRepaymentManwon = (summaryBaseMonthlyYen * 12) / 10000
  const summaryDti = Number(financeProfile.annual_income_manwon || 0) > 0
    ? (summaryAnnualRepaymentManwon / Number(financeProfile.annual_income_manwon || 0)) * 100
    : 0
  const headerFundFromOwned = (Array.isArray(ownedFundItems) ? ownedFundItems : []).reduce((acc, row) => {
    const invest = Math.max(0, Number(row?.investAmount || 0))
    const buyPrice = Math.max(0, Number(row?.buyPrice || 0))
    const latestPrice = Math.max(0, Number(row?.latestPrice || 0))
    const effectiveLatestPrice = latestPrice > 0 ? latestPrice : buyPrice
    const units = buyPrice > 0 ? invest / buyPrice : 0
    const current = units > 0 && effectiveLatestPrice > 0 ? units * effectiveLatestPrice : 0
    const ccy = inferStockCurrency(row?.symbol || row?.code || '')
    if (ccy === 'USD') {
      const found = fxOnOrBefore(toIsoDate(row?.buyDate || ''), fxRatesByDate)
      const liveUsd = positiveUsdJpy(valuationUsdJpy)
      if (found?.rate > 0) acc.invest += invest * found.rate
      if (liveUsd != null) acc.value += current * liveUsd
    } else {
      acc.invest += toJpy(invest, ccy)
      acc.value += toJpy(current, ccy)
    }
    return acc
  }, { invest: 0, value: 0 })
  const headerFundFromPortfolio = effectivePortfolio.reduce((acc, item) => {
    const ccy = inferFundCurrency(item.name)
    acc.invest += toJpy(item.invest || 0, ccy)
    acc.value += toJpy(item.value || 0, ccy)
    return acc
  }, { invest: 0, value: 0 })
  const useOwnedFundBasis = (Array.isArray(ownedFundItems) ? ownedFundItems : []).length > 0
  const headerFundValueJpy = useOwnedFundBasis ? headerFundFromOwned.value : headerFundFromPortfolio.value
  const headerFundInvestJpy = useOwnedFundBasis ? headerFundFromOwned.invest : headerFundFromPortfolio.invest
  const headerStock = (Array.isArray(ownedStockItems) ? ownedStockItems : []).reduce((acc, row) => {
    const qty = Math.max(0, Number(row?.qty || 0))
    const price = Math.max(0, Number(row?.price || 0))
    const buy = Math.max(0, Number(row?.buyPrice || 0))
    const parts = lotYenParts(row, qty, buy, price, fxRatesByDate, valuationUsdJpy)
    if (parts.included) acc.value += parts.valueJpy
    if (parts.costKnown) {
      acc.invest += parts.costJpy
      if (parts.included) acc.pnlValue += parts.valueJpy
    }
    return acc
  }, { value: 0, invest: 0, pnlValue: 0 })
  const headerStockValueJpy = headerStock.value
  const headerStockInvestJpy = headerStock.invest
  const headerTotalValue = headerFundValueJpy + headerStockValueJpy
  const headerTotalInvest = headerFundInvestJpy + headerStockInvestJpy
  const headerPnL = (headerFundValueJpy - headerFundInvestJpy) + (headerStock.pnlValue - headerStockInvestJpy)
  const headerRate = headerTotalInvest > 0 ? (headerPnL / headerTotalInvest) * 100 : 0
  /** v_stock_latest 反映待ちは「--」ではなくスピナーへ（中間値のチラ見え回避） */
  const portfolioQuotesHydratingUi =
    Boolean(user?.id && (stockPortfolioQuotesHydrating || fundPortfolioQuotesHydrating))
  const myPageRawStockSlots = Array.isArray(ownedStocks) ? ownedStocks.length : 0
  const myPageRawFundSlots = Array.isArray(ownedFunds) ? ownedFunds.length : 0
  const myPageHasRawStockHoldings = myPageRawStockSlots > 0
  const myPageHasRawFundHoldings = myPageRawFundSlots > 0
  /** WealthSection 内と同条件。ヘッダーが live 行未構築の瞬間に総資産を出さないため。 */
  const ownedLiveRowsSynced = (
    (!myPageHasRawStockHoldings
      || (Array.isArray(ownedStockItems) && ownedStockItems.length === myPageRawStockSlots))
    && (!myPageHasRawFundHoldings
      || (Array.isArray(ownedFundItems) && ownedFundItems.length === myPageRawFundSlots))
  )
  const showHeaderAssetOnboardingHint = Boolean(
    user?.id
    && myPageDbAvailable
    && ownedAssetDbReady
    && ownedLiveRowsSynced
    && headerTotalValue < 1
    && headerTotalInvest < 1,
  )
  const insuranceSummary = {
    registered: effectiveInsurances.length,
    expiringSoon: effectiveInsurances.filter((ins) => {
      if (!ins.maturity_date) return false
      const diff = new Date(ins.maturity_date).getTime() - Date.now()
      return diff <= 1000 * 60 * 60 * 24 * 30
    }).length,
  }
  const calcStaleDaysFromIso = (iso) => {
    if (!iso) return null
    const base = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(base.getTime())) return null
    const now = new Date()
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const baseUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
    return Math.max(0, Math.floor((todayUtc - baseUtc) / (1000 * 60 * 60 * 24)))
  }
  const pointExpiringSoonCount = (effectivePointAccounts || []).filter((p) => {
    const iso = toIsoDate(p?.expiry || '')
    if (!iso) return false
    const daysLeft = Math.ceil((new Date(`${iso}T00:00:00Z`).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysLeft >= 0 && daysLeft <= POINT_EXPIRY_ALERT_DAYS
  }).length
  const allTradeDates = [
    ...(ownedStockItems || []).map((r) => toIsoDate(r?.tradeDate || r?.buyDate || '')),
    ...(ownedFundItems || []).map((r) => toIsoDate(r?.tradeDate || r?.buyDate || '')),
  ].filter(Boolean)
  const latestTradeIso = allTradeDates.sort()[allTradeDates.length - 1] || ''
  const assetStaleAlert = (ownedStockItems?.length > 0 || ownedFundItems?.length > 0) &&
    latestTradeIso &&
    (calcStaleDaysFromIso(latestTradeIso) ?? 0) >= PRICE_STALE_ALERT_DAYS
  const alertCount = (insuranceSummary.expiringSoon || 0) + (pointExpiringSoonCount || 0) + (assetStaleAlert ? 1 : 0)

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!user?.id) {
        if (alive) setDataStatus('ログイン後にMyデータを保存できます。')
        return
      }
      try {
        const taxYear = new Date().getFullYear()
        const [data, side] = await Promise.all([
          loadMyPageData(user.id),
          Promise.all([
            loadRefinanceProducts().catch(() => ({ rows: [] })),
            loadUserRevolvingDebts(user.id).catch(() => ({ rows: [] })),
            loadTaxShieldRules(taxYear).catch(() => ({ rows: [] })),
            loadUserTaxShieldProfile(user.id, taxYear).catch(() => ({ profile: {} })),
            loadUserCashFlowOptimizerProfile(user.id, taxYear).catch(() => ({ profile: {} })),
          ]),
        ])
        if (!alive) return
        const [
          refinanceProductRes,
          debtsRes,
          taxShieldRulesRes,
          taxShieldProfileRes,
          cashFlowProfileRes,
        ] = side
        setExpenses(data.expenses || [])
        setInsurances(data.insurances || [])
        setAssetPositions(data.assetPositions || [])
        setPointAccounts(data.pointAccounts || [])
        setMyPageDbAvailable(Boolean(data.available))
        const loadedRevolving = { ...DEFAULT_REVOLVING_PROFILE }
        setRevolvingProfile(loadedRevolving)
        setLoanRemainingYen(Math.max(0, Number(data.profile?.loan_remaining_yen ?? loadedRevolving.balance_yen ?? 0)))
        setFinanceProfile({
          annual_income_manwon: Number(data.profile?.annual_income_manwon ?? 0),
          budget_target_yen: Number(data.profile?.budget_target_yen ?? 0),
        })
        setDataStatus(data.available ? 'データを同期しました。' : 'MyPage DBテーブル未設定のため表示用データを使用中。')

        setRefinanceProducts(refinanceProductRes?.rows || [])
        setRevolvingDebts(debtsRes?.rows || [])
        setTaxShieldRules(taxShieldRulesRes?.rows || [])
        setTaxShieldProfile({
          ...DEFAULT_TAX_SHIELD_PROFILE,
          ...(taxShieldProfileRes?.profile || {}),
        })
        setCashFlowProfile({
          ...DEFAULT_CASH_FLOW_PROFILE,
          ...(cashFlowProfileRes?.profile || {}),
        })
      } catch (err) {
        if (!alive) return
        setDataStatus(`データ読み込み失敗: ${err?.message || 'unknown error'}`)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [user?.id])

  const handleAddExpense = async (payload) => {
    setExpenseSaving(true)
    trackUserActivityEvent('mypage_save_attempt', { section: 'expense_add' })
    try {
      const row = await addExpense(payload)
      setExpenses((prev) => [row, ...prev])
      setDataStatus('支出を保存しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'expense_add' })
      notifyBudgetAlertRefresh()
    } catch (err) {
      setDataStatus(`支出保存に失敗: ${err?.message || 'unknown error'}`)
      throw err
    } finally {
      setExpenseSaving(false)
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    if (!user?.id || !expenseId) return
    try {
      await deleteExpenseById(expenseId, user.id)
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId))
      setDataStatus('支出を削除しました。')
      notifyBudgetAlertRefresh()
    } catch (err) {
      setDataStatus(`支出削除に失敗: ${err?.message || 'unknown error'}`)
      throw err
    }
  }

  const handleUpdateExpense = async (expenseId, payload) => {
    if (!user?.id || !expenseId) return
    setExpenseSaving(true)
    trackUserActivityEvent('mypage_save_attempt', { section: 'expense_edit' })
    try {
      const row = await updateExpense(expenseId, user.id, payload)
      setExpenses((prev) => prev.map((e) => (e.id === expenseId ? row : e)))
      setDataStatus('支出を更新しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'expense_edit' })
      notifyBudgetAlertRefresh()
    } catch (err) {
      setDataStatus(`支出更新に失敗: ${err?.message || 'unknown error'}`)
      throw err
    } finally {
      setExpenseSaving(false)
    }
  }

  const handleAddInsurance = async (payload) => {
    setInsuranceSaving(true)
    trackUserActivityEvent('mypage_save_attempt', { section: 'insurance_add' })
    try {
      const row = await addInsurance(payload)
      setInsurances((prev) => [row, ...prev])
      setDataStatus('保険情報を保存しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'insurance_add' })
    } catch (err) {
      setDataStatus(`保険保存に失敗: ${err?.message || 'unknown error'}`)
      throw err
    } finally {
      setInsuranceSaving(false)
    }
  }

  const handleDeleteInsurance = async (insuranceId) => {
    if (!user?.id || !insuranceId) return
    try {
      await deleteInsuranceById(insuranceId, user.id)
      setInsurances((prev) => prev.filter((ins) => ins.id !== insuranceId))
      setDataStatus('保険情報を削除しました。')
    } catch (err) {
      setDataStatus(`保険削除に失敗: ${err?.message || 'unknown error'}`)
      throw err
    }
  }

  const handleUpdateInsurance = async (insuranceId, payload) => {
    if (!user?.id || !insuranceId) return
    setInsuranceSaving(true)
    trackUserActivityEvent('mypage_save_attempt', { section: 'insurance_edit' })
    try {
      const row = await updateInsurance(insuranceId, user.id, payload)
      setInsurances((prev) => prev.map((ins) => (ins.id === insuranceId ? row : ins)))
      setDataStatus('保険情報を更新しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'insurance_edit' })
    } catch (err) {
      setDataStatus(`保険更新に失敗: ${err?.message || 'unknown error'}`)
      throw err
    } finally {
      setInsuranceSaving(false)
    }
  }

  const handleSaveFinanceProfile = async (nextAnnualIncomeManwon) => {
    if (!user?.id) return
    setProfileSaving(true)
    trackUserActivityEvent('mypage_save_attempt', { section: 'finance_profile_save' })
    try {
      const resolvedAnnualIncomeManwon = Number.isFinite(Number(nextAnnualIncomeManwon))
        ? Math.max(0, Number(nextAnnualIncomeManwon))
        : Math.max(0, Number(financeProfile.annual_income_manwon || 0))
      const saved = await saveFinanceProfile({
        userId: user.id,
        annualIncomeManwon: resolvedAnnualIncomeManwon,
      })
      setFinanceProfile((prev) => ({
        ...prev,
        annual_income_manwon: Number(saved.annual_income_manwon ?? 0),
      }))
      setDataStatus('年収情報を保存しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'finance_profile_save' })
    } catch (err) {
      setDataStatus(`年収保存に失敗: ${err?.message || 'unknown error'}`)
      throw err
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAddPointAccount = async (payload) => {
    setPointSaving(true)
    trackUserActivityEvent('mypage_save_attempt', { section: 'point_add' })
    try {
      const row = await addPointAccount(payload)
      setPointAccounts((prev) => [row, ...prev])
      setDataStatus('ポイント情報を保存しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'point_add' })
    } catch (err) {
      setDataStatus(`ポイント保存に失敗: ${err?.message || 'unknown error'}`)
      throw err
    } finally {
      setPointSaving(false)
    }
  }

  const handleDeletePointAccount = async (pointId) => {
    if (!user?.id || !pointId) return
    try {
      await deletePointAccountById(pointId, user.id)
      setPointAccounts((prev) => prev.filter((p) => p.id !== pointId))
      setDataStatus('ポイント情報を削除しました。')
    } catch (err) {
      setDataStatus(`ポイント削除に失敗: ${err?.message || 'unknown error'}`)
      throw err
    }
  }

  const handleUpdatePointAccount = async (pointId, payload) => {
    if (!user?.id || !pointId) return
    setPointSaving(true)
    trackUserActivityEvent('mypage_save_attempt', { section: 'point_edit' })
    try {
      const row = await updatePointAccount(pointId, user.id, payload)
      setPointAccounts((prev) => prev.map((p) => (p.id === pointId ? row : p)))
      setDataStatus('ポイント情報を更新しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'point_edit' })
    } catch (err) {
      setDataStatus(`ポイント更新に失敗: ${err?.message || 'unknown error'}`)
      throw err
    } finally {
      setPointSaving(false)
    }
  }

  const handleAddAsset = async ({ name, current_value, invest_value, color }) => {
    if (!user?.id || !myPageDbAvailable) {
      const row = {
        id: `local-fund-${Date.now()}`,
        name: String(name || '').trim() || '新規ファンド',
        value: Math.max(0, Number(current_value || 0)),
        invest: Math.max(0, Number(invest_value || 0)),
        return: 0,
        color: color || '#3b82f6',
      }
      setLocalFundPositions((prev) => [row, ...(Array.isArray(prev) ? prev : [])])
      setDataStatus('ファンド資産をローカルに追加しました。')
      return
    }
    trackUserActivityEvent('mypage_save_attempt', { section: 'asset_add' })
    try {
      const row = await addAssetPosition({
        user_id: user.id,
        name,
        current_value: Math.max(0, Number(current_value || 0)),
        invest_value: Math.max(0, Number(invest_value || 0)),
        color: color || '#3b82f6',
      })
      setAssetPositions((prev) => [row, ...prev])
      setDataStatus('投資資産を追加しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'asset_add' })
    } catch (err) {
      setDataStatus(`資産追加に失敗: ${err?.message || 'unknown error'}`)
      throw err
    }
  }

  const handleUpdateAsset = async ({ id, name, current_value, invest_value, color }) => {
    if (!id) return
    if (!user?.id || !myPageDbAvailable) {
      setLocalFundPositions((prev) => (Array.isArray(prev) ? prev : []).map((a) => (
        a.id === id
          ? {
              ...a,
              name: String(name || '').trim() || a.name,
              value: Math.max(0, Number(current_value || 0)),
              invest: Math.max(0, Number(invest_value || 0)),
              color: color || a.color || '#3b82f6',
            }
          : a
      )))
      setDataStatus('ファンド資産をローカル更新しました。')
      return
    }
    trackUserActivityEvent('mypage_save_attempt', { section: 'asset_update' })
    try {
      const row = await updateAssetPosition({
        id,
        userId: user.id,
        name,
        current_value: Math.max(0, Number(current_value || 0)),
        invest_value: Math.max(0, Number(invest_value || 0)),
        color: color || '#3b82f6',
      })
      setAssetPositions((prev) => prev.map((a) => (a.id === id ? row : a)))
      setDataStatus('投資資産を更新しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'asset_update' })
    } catch (err) {
      setDataStatus(`資産更新に失敗: ${err?.message || 'unknown error'}`)
      throw err
    }
  }

  const handleDeleteAsset = async (assetId) => {
    if (!assetId) return
    if (!user?.id || !myPageDbAvailable) {
      setLocalFundPositions((prev) => (Array.isArray(prev) ? prev : []).filter((a) => a.id !== assetId))
      setDataStatus('ファンド資産をローカル削除しました。')
      return
    }
    try {
      await deleteAssetPositionById(assetId, user.id)
      setAssetPositions((prev) => prev.filter((a) => a.id !== assetId))
      setDataStatus('投資資産を削除しました。')
    } catch (err) {
      setDataStatus(`資産削除に失敗: ${err?.message || 'unknown error'}`)
      throw err
    }
  }

  const handleSaveBudgetTarget = async (nextBudgetYen) => {
    if (!user?.id) return
    setProfileSaving(true)
    trackUserActivityEvent('mypage_save_attempt', { section: 'budget_save' })
    try {
      const saved = await saveFinanceProfile({
        userId: user.id,
        budgetTargetYen: Math.max(0, Number(nextBudgetYen || 0)),
      })
      setFinanceProfile({
        annual_income_manwon: Number(financeProfile.annual_income_manwon ?? 0),
        budget_target_yen: Number(saved.budget_target_yen ?? 0),
      })
      setDataStatus('予算目標を保存しました。')
      trackUserActivityEvent('mypage_save_success', { section: 'budget_save' })
      notifyBudgetAlertRefresh()
    } catch (err) {
      setDataStatus(`予算保存に失敗: ${err?.message || 'unknown error'}`)
      throw err
    } finally {
      setProfileSaving(false)
    }
  }

  const handleSaveLoanRemaining = async () => {
    const balance = Math.max(0, Number(loanRemainingYen || 0))
    setRevolvingProfile((prev) => ({ ...prev, balance_yen: balance }))
    if (!user?.id) {
      setDataStatus('ログイン後に保存できます。')
      return
    }
    try {
      await saveFinanceProfile({
        userId: user.id,
        loanRemainingYen: balance,
      })
      setDataStatus('残債総額を保存しました。')
    } catch (err) {
      setDataStatus(`残債の保存に失敗: ${err?.message || 'unknown error'}`)
      throw err
    }
  }

  const handleRevolvingProfileChange = (field, value) => {
    if (!field) return
    if (field === 'balance_yen') {
      setLoanRemainingYen(Math.max(0, Number(value || 0)))
    }
    setRevolvingProfile((prev) => ({
      ...prev,
      [field]: Number.isFinite(Number(value)) ? Number(value) : value,
    }))
  }

  const handleSaveRevolvingProfile = async () => {
    setDataStatus('ローン情報は保存対象外です。')
  }

  const handleTaxShieldProfileChange = (field, value) => {
    setTaxShieldProfile((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSaveTaxShieldProfile = async (overrides = {}) => {
    if (!user?.id) {
      setTaxShieldStatus('ログイン後に保存できます。')
      return
    }
    setTaxShieldSaving(true)
    setTaxShieldStatus('')
    try {
      await saveUserTaxShieldProfile({
        userId: user.id,
        taxYear: taxShieldProfile.tax_year || new Date().getFullYear(),
        annualIncomeManwon: overrides.annualIncomeManwon ?? taxShieldProfile.annual_income_manwon,
        idecoPaidYen: overrides.idecoPaidYen ?? taxShieldProfile.ideco_paid_yen,
        nisaPaidYen: overrides.nisaPaidYen ?? taxShieldProfile.nisa_paid_yen,
        insurancePaidYen: overrides.insurancePaidYen ?? taxShieldProfile.insurance_paid_yen,
        deductionReflected: overrides.deductionReflected ?? taxShieldProfile.deduction_reflected,
      })
      setTaxShieldStatus('Tax-Shield入力を保存しました。')
    } catch (err) {
      setTaxShieldStatus(`Tax-Shield保存に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setTaxShieldSaving(false)
    }
  }

  const handleRunTaxShieldSimulation = async () => {
    if (!user?.id) return
    setTaxShieldStatus('')
    try {
      const result = evaluateTaxShield({
        taxRules: taxShieldRules,
        taxProfile: taxShieldProfile,
      })
      await saveTaxShieldSimulation({
        userId: user.id,
        taxYear: taxShieldProfile.tax_year || new Date().getFullYear(),
        estimatedDeductionYen: result.estimatedDeductionYen,
        potentialTaxSavingYen: result.potentialTaxSavingYen,
        status: result.status,
        resultJson: result,
      })
      setTaxShieldStatus(`節税シミュレーションを保存しました。試算額 ¥${Math.abs(Number(result.potentialTaxSavingYen || 0)).toLocaleString('ja-JP')}`)
    } catch (err) {
      setTaxShieldStatus(`シミュレーション保存に失敗: ${err?.message || 'unknown error'}`)
    }
  }

  const handleCashFlowProfileChange = (field, value) => {
    setCashFlowProfile((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSaveCashFlowProfile = async () => {
    if (!user?.id) {
      setCashFlowStatus('ログイン後に保存できます。')
      return
    }
    setCashFlowSaving(true)
    setCashFlowStatus('')
    try {
      const saved = await saveUserCashFlowOptimizerProfile({
        userId: user.id,
        taxYear: cashFlowProfile.tax_year || new Date().getFullYear(),
        cashBalanceYen: cashFlowProfile.cash_balance_yen,
        currentCashRate: cashFlowProfile.current_cash_rate,
        highYieldCashRate: cashFlowProfile.high_yield_cash_rate,
        reserveMonthMultiplier: cashFlowProfile.reserve_month_multiplier,
      })
      setCashFlowProfile((prev) => ({
        ...prev,
        ...saved,
      }))
      setCashFlowStatus('資金フローの入力を保存しました。')
    } catch (err) {
      setCashFlowStatus(`資金フローの保存に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setCashFlowSaving(false)
    }
  }

  const handleRunCashFlowOptimizer = async () => {
    if (!user?.id) return
    setCashFlowStatus('')
    try {
      const result = evaluateCashFlowOptimizer({
        monthlyExpensesYen: monthlyExpensesRecent3,
        cashFlowProfile,
      })
      await saveCashFlowOptimizerSimulation({
        userId: user.id,
        taxYear: cashFlowProfile.tax_year || new Date().getFullYear(),
        reserveTargetYen: result.reserveTargetYen,
        idleCashYen: result.idleCashYen,
        additionalInterestYen: result.additionalInterestYen,
        status: result.status,
        resultJson: {
          monthlyExpensesRecent3,
          ...result,
        },
      })
      setCashFlowStatus(`資金フロー試算を保存しました。追加利息の試算 ¥${Math.abs(Number(result.additionalInterestYen || 0)).toLocaleString('ja-JP')}`)
    } catch (err) {
      setCashFlowStatus(`資金フロー試算に失敗: ${err?.message || 'unknown error'}`)
    }
  }

  const handleRunRefinanceSimulation = async () => {
    let principal = 0
    let currentApr = 0
    let monthlyPayment = 0
    const refinanceFee = Math.max(0, Number(revolvingProfile.refinance_fee_yen || 0))
    if (Array.isArray(revolvingDebts) && revolvingDebts.length > 0) {
      principal = revolvingDebts.reduce((s, d) => s + Math.max(0, Number(d.balance_yen || 0)), 0)
      const totalWeighted = revolvingDebts.reduce((s, d) => {
        const bal = Math.max(0, Number(d.balance_yen || 0))
        return s + bal * Math.max(0, Number(d.interest_rate || 0))
      }, 0)
      currentApr = principal > 0 ? totalWeighted / principal : 0
      monthlyPayment = revolvingDebts.reduce((s, d) => s + Math.max(0, Number(d.monthly_payment_yen || 0)), 0)
    } else {
      principal = Math.max(0, Number(revolvingProfile.balance_yen || loanRemainingYen || 0))
      currentApr = Math.max(0, Number(revolvingProfile.apr || 0))
      monthlyPayment = Math.max(0, Number(revolvingProfile.monthly_payment_yen || 0))
    }
    if (principal <= 0 || currentApr <= 0 || monthlyPayment <= 0) {
      setDataStatus('負債を1件以上追加するか、残高/APR/月返済額を入力してください。')
      return
    }
    setRefinanceRunning(true)
    try {
      const ranked = rankRefinanceOffers({
        principalYen: principal,
        currentAprPct: currentApr,
        monthlyPaymentYen: monthlyPayment,
        refinanceFeeYen: refinanceFee,
        offers: refinanceProducts,
        topN: 3,
      })
      setRefinanceOffers(ranked)
      trackUserActivityEvent('refinance_simulated', {
        principal,
        currentApr,
        monthlyPayment,
        offers: ranked.length,
      })
      if (ranked.length > 0 && user?.id) {
        const best = ranked[0]
        await saveRefinanceSimulation({
          userId: user.id,
          bestProductId: best.offerId || null,
          currentTotalCost24mYen: best.currentTotalCost24mYen,
          bestOfferTotalCost24mYen: best.refinanceTotalCost24mYen,
          savings24mYen: best.savings24mYen,
          resultJson: {
            input: {
              principalYen: principal,
              currentAprPct: currentApr,
              monthlyPaymentYen: monthlyPayment,
              refinanceFeeYen: refinanceFee,
            },
            topOffers: ranked,
          },
        })
      }
      if (ranked.length === 0) {
        setDataStatus('比較可能な借り換え商品が見つかりません。金額レンジを確認してください。')
      } else {
        const best = ranked[0]
        setDataStatus(`借入額範囲が合う先頭候補: ${best.bankName} / ${best.productName}。上限金利での24ヶ月仮試算は${Number(best.savings24mYen || 0) >= 0 ? 'コスト減' : 'コスト増'} ¥${Math.abs(Number(best.savings24mYen || 0)).toLocaleString('ja-JP')}。適用金利・審査結果は未確認です。`)
      }
    } catch (err) {
      setDataStatus(`借り換え試算に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setRefinanceRunning(false)
    }
  }

  const handleRefinanceOfferClick = (offer) => {
    trackUserActivityEvent('refinance_offer_clicked', {
      offerId: offer?.offerId || null,
      bankName: offer?.bankName || '',
      productName: offer?.productName || '',
      savings24mYen: Number(offer?.savings24mYen || 0),
    })
  }

  const handleAddRevolvingDebt = async (payload) => {
    if (!user?.id) return
    setRefinanceSaving(true)
    try {
      const row = await addRevolvingDebt({
        userId: user.id,
        provider: payload.provider || '',
        debtType: payload.debt_type ?? payload.debtType ?? 'card',
        balanceYen: payload.balance_yen ?? payload.balanceYen ?? 0,
        interestRate: payload.interest_rate ?? payload.interestRate ?? 0,
        monthlyPaymentYen: payload.monthly_payment_yen ?? payload.monthlyPaymentYen ?? 0,
      })
      setRevolvingDebts((prev) => [row, ...prev])
      setDataStatus('負債を追加しました。')
    } catch (err) {
      setDataStatus(`負債の追加に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setRefinanceSaving(false)
    }
  }

  const handleUpdateRevolvingDebt = async (debtId, payload) => {
    if (!user?.id || !debtId) return
    setRefinanceSaving(true)
    try {
      const row = await updateRevolvingDebt({
        userId: user.id,
        debtId,
        provider: payload.provider,
        debtType: payload.debt_type ?? payload.debtType,
        balanceYen: payload.balance_yen ?? payload.balanceYen,
        interestRate: payload.interest_rate ?? payload.interestRate,
        monthlyPaymentYen: payload.monthly_payment_yen ?? payload.monthlyPaymentYen,
      })
      if (row) {
        setRevolvingDebts((prev) => prev.map((d) => (d.id === debtId ? row : d)))
        setDataStatus('負債を更新しました。')
      }
    } catch (err) {
      setDataStatus(`負債の更新に失敗: ${err?.message || 'unknown error'}`)
    } finally {
      setRefinanceSaving(false)
    }
  }

  const handleDeleteRevolvingDebt = async (debtId) => {
    if (!user?.id || !debtId) return
    try {
      await deleteRevolvingDebt(user.id, debtId)
      setRevolvingDebts((prev) => prev.filter((d) => d.id !== debtId))
      setDataStatus('負債を削除しました。')
    } catch (err) {
      setDataStatus(`負債の削除に失敗: ${err?.message || 'unknown error'}`)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    if (!deleteIntentChecked || !deleteRejoinDelayChecked || !deleteLegalRetentionChecked) {
      setAccountActionError('確認チェック3項目をすべてオンにしてください。')
      return
    }
    if (deleteConfirmText.trim() !== '退会する') {
      setAccountActionError('確認のため「退会する」と入力してください。')
      return
    }
    if (String(deleteEmailConfirm || '').trim().toLowerCase() !== String(user?.email || '').trim().toLowerCase()) {
      setAccountActionError('メールアドレスが一致しません。')
      return
    }
    if (!window.confirm('退会するとアカウントと関連データは削除され、元に戻せません。続行しますか？')) return
    setDeletingAccount(true)
    setAccountActionError('')
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr || !sessionData?.session?.access_token) {
        throw new Error('認証情報を確認できません。再ログイン後にお試しください。')
      }
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || '退会処理に失敗しました。')
      }
      await supabase.auth.signOut({ scope: 'local' })
      navigate('/')
    } catch (err) {
      setAccountActionError(err?.message || '退会処理に失敗しました。')
    } finally {
      setDeletingAccount(false)
    }
  }

  // ─── 配当カレンダー state & handlers ─────────────────────────
  const [dividendWatchlist, setDividendWatchlist] = useState([])
  const [dividendLoading, setDividendLoading] = useState(false)
  const [dividendSaving, setDividendSaving] = useState(false)
  const [dividendStatus, setDividendStatus] = useState('')
  const [dividendHighlightSignal, setDividendHighlightSignal] = useState(null)
  const [showAddDivStock, setShowAddDivStock] = useState(false)
  const [editingDivStockId, setEditingDivStockId] = useState(null)
  const [newDivStockId, setNewDivStockId] = useState('')
  const [newDivStockName, setNewDivStockName] = useState('')
  const [newDivStockFlag, setNewDivStockFlag] = useState('🇯🇵')
  const [newDivStockSector, setNewDivStockSector] = useState('')
  const [newDivStockPrice, setNewDivStockPrice] = useState(0)
  const [newDivStockQty, setNewDivStockQty] = useState(10)
  const [newDivStockNisa, setNewDivStockNisa] = useState(false)
  const [newDivStockBuyDate, setNewDivStockBuyDate] = useState('')
  const [newDivStockBuyPrice, setNewDivStockBuyPrice] = useState('')
  const [newDivDividends, setNewDivDividends] = useState([{ month: 6, amount: 0 }])
  const [divDetailSuggestions, setDivDetailSuggestions] = useState([])
  const [divStockLookupLoading, setDivStockLookupLoading] = useState(false)
  const divStockIdFetchRef = useRef(null)

  const normalizeAutofillDividendRows = useCallback((rows, detail) => {
    const normalized = [...new Map(
      (Array.isArray(rows) ? rows : [])
        .map((d) => ({
          month: Math.min(12, Math.max(1, Number(d?.month) || 1)),
          amount: Math.max(0, Number(d?.amount) || 0),
        }))
        .filter((d) => Number.isFinite(d.month))
        .sort((a, b) => a.month - b.month)
        .map((d) => [d.month, d]),
    ).values()]
    if (normalized.length === 0) return []

    // US quarterly names can drift by month boundary in source history (e.g. 1/2, 4/5, 7/8, 10/11).
    // For auto-fill only, collapse 6-8 month "double-month quarter" patterns to one month per quarter.
    const cat = String(detail?.category || '')
    const isUs = cat.includes('米国') || String(detail?.symbol || '').toUpperCase().match(/^[A-Z]/)
    if (!isUs || normalized.length < 6 || normalized.length > 8) return normalized

    const byQuarter = [[], [], [], []]
    normalized.forEach((row) => {
      const q = Math.floor((row.month - 1) / 3)
      if (q >= 0 && q <= 3) byQuarter[q].push(row)
    })
    const looksLikeQuarterDrift = byQuarter.every((qRows) => qRows.length >= 1 && qRows.length <= 2) && byQuarter.some((qRows) => qRows.length === 2)
    if (!looksLikeQuarterDrift) return normalized

    const quarterlyRows = byQuarter
      .map((qRows) => qRows.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0])
      .filter(Boolean)
      .sort((a, b) => a.month - b.month)
    if (quarterlyRows.length !== 4) return quarterlyRows

    // For quarter-boundary drift patterns, use current run-rate amount across quarters
    // so users don't get stale mixed values like 0.5875/0.675/0.745 in one schedule.
    const runRate = Math.max(...quarterlyRows.map((r) => Number(r.amount || 0)), 0)
    const normalizedRunRate = Math.round(runRate * 10000) / 10000
    return quarterlyRows.map((r) => ({ ...r, amount: normalizedRunRate }))
  }, [])

  const toCanonicalDividendRows = useCallback((rows) => (
    [...new Map(
      (Array.isArray(rows) ? rows : [])
        .map((d) => ({
          month: Math.min(12, Math.max(1, Number(d?.month) || 1)),
          amount: Math.round(Math.max(0, Number(d?.amount) || 0) * 10000) / 10000,
        }))
        .filter((d) => Number.isFinite(d.month))
        .sort((a, b) => a.month - b.month)
        .map((d) => [d.month, d]),
    ).values()]
  ), [])

  const withDividendMonths = (item, changed, storedMonths) => {
    const months = dividendMonthsFromDividends(item?.dividends)
    const stored = [...new Set(
      (Array.isArray(storedMonths) ? storedMonths : [])
        .map((m) => Number(m))
        .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
    )].sort((a, b) => a - b)
    if (stored.join(',') === months.join(',')) return { item, changed }
    return { item: { ...item, months }, changed: true }
  }

  const normalizePersistedDividendItem = useCallback((row) => {
    if (!row) return { item: row, changed: false }
    const stockId = normalizeListedSymbolId(row.stock_id)
    if (!stockId) return { item: row, changed: false }
    const storedId = String(row.stock_id || '').trim().toUpperCase()
    let item = { ...row, stock_id: stockId }
    let changed = storedId !== stockId
    const normFlag = normalizeDividendStockFlag(item.flag, item)
    if (normFlag !== item.flag) {
      item = { ...item, flag: normFlag }
      changed = true
    }
    const masterRec = getDividendCalendarDetailRecord(stockId)
    const detail = masterRec
      || lookupDividendStockBySymbol(stockId)
      || { symbol: stockId, category: item.sector || '' }
    /** マスタ（dividendCalendarDetail.generated）に行がある銘柄は、App 配布時点の月・1株額に同期。未掲載・手動のみの銘柄は従来どおりユーザー値を正規化 */
    const normalizedDividends = (masterRec && Array.isArray(masterRec.dividends) && masterRec.dividends.length > 0)
      ? normalizeAutofillDividendRows(masterRec.dividends, masterRec)
      : normalizeAutofillDividendRows(item.dividends, detail)
    if (normalizedDividends.length === 0) {
      return withDividendMonths(item, changed, row.months)
    }
    const before = JSON.stringify(toCanonicalDividendRows(item.dividends))
    const after = JSON.stringify(toCanonicalDividendRows(normalizedDividends))
    if (before !== after) {
      item = { ...item, dividends: normalizedDividends }
      changed = true
    }
    return withDividendMonths(item, changed, row.months)
  }, [normalizeAutofillDividendRows, toCanonicalDividendRows])

  syncDividendFromOwnedRef.current = async (stockId, nextOwned, nameHint) => {
    if (!user?.id) return
    const id = normalizeListedSymbolId(stockId)
    if (!id) return
    const rows = Array.isArray(nextOwned) ? nextOwned : []
    const totalQty = rows
      .filter((s) => ownedSymbolMatchesDividendStockId(id, s?.symbol))
      .reduce((sum, s) => {
        const q = Number(String(s?.qty ?? '').trim().replace(/,/g, ''))
        if (!Number.isFinite(q) || q < 0) return sum
        return sum + q
      }, 0)
    if (!(totalQty > 0)) {
      try {
        const list = await loadDividendWatchlist(user.id)
        const cur = Array.isArray(list) ? list : []
        const toRemove = [...new Set(
          cur
            .filter((r) => ownedSymbolMatchesDividendStockId(id, r.stock_id))
            .map((r) => String(r.stock_id || '').trim())
            .filter(Boolean),
        )]
        for (const sid of toRemove) {
          await deleteDividendWatchlistItem(user.id, sid)
        }
        const reloaded = await loadDividendWatchlist(user.id)
        setDividendWatchlist(Array.isArray(reloaded) ? reloaded : [])
        try {
          window.dispatchEvent(new CustomEvent('mm-dividend-bell-refresh'))
        } catch {
          // ignore
        }
      } catch (err) {
        const msg = `配当カレンダー同期失敗: ${err?.message || 'unknown error'}`
        setDataStatus((p) => {
          const t = String(p || '')
          if (!t) return msg
          if (t.includes('配当カレンダー同期失敗')) return t
          return `${t} ${msg}`
        })
      }
      return
    }
    if (isDividendWatchlistDismissed(user.id, id)) return
    try {
      const master = getDividendCalendarDetailRecord(id)
      const preset = lookupDividendStockBySymbol(id) || null
      const detail = master || preset || { symbol: id, name: nameHint || id, category: '' }
      const stockName = String(
        detail.name || nameHint || preset?.name || getStockNameFallback(id) || id,
      )
        .trim() || id
      const sector = String(
        (detail && detail.category) || preset?.sector || '',
      )
        .trim()
      const cat = String((detail && detail.category) || sector || '')
      let nextFlag = '🇯🇵'
      if (cat.includes('米国')) nextFlag = '🇺🇸'
      else if (cat.includes('日本')) nextFlag = '🇯🇵'
      else if (preset?.region === 'US' || (master && String(master.category || '').includes('米国'))) nextFlag = '🇺🇸'
      const flag = normalizeDividendStockFlag(nextFlag, { stock_id: id, sector })
      const price = Math.max(0, Number((detail && detail.price) || preset?.price || 0))
      const rawDivs = (master && Array.isArray(master.dividends) && master.dividends.length)
        ? master.dividends
        : (Array.isArray(preset?.dividends) && preset.dividends.length
          ? preset.dividends
          : [{ month: 6, amount: 0 }])
      const dividends = normalizeAutofillDividendRows(rawDivs, master || detail)
      const built = {
        stock_id: id,
        stock_name: stockName,
        flag,
        sector,
        color: '#f97316',
        price,
        qty: roundStockShareQty(totalQty),
        is_nisa: false,
        notes: '',
        dividends: dividends.length
          ? dividends
          : [{ month: 6, amount: 0 }],
      }
      const { item: normItem } = normalizePersistedDividendItem(built)
      const toSave = normItem && String(normItem.stock_id || '').trim() ? normItem : built
      await upsertDividendWatchlistItem(user.id, toSave)
      const reloaded = await loadDividendWatchlist(user.id)
      setDividendWatchlist(Array.isArray(reloaded) ? reloaded : [])
      try {
        window.dispatchEvent(new CustomEvent('mm-dividend-bell-refresh'))
      } catch {
        // ignore
      }
    } catch (err) {
      const msg = `配当カレンダー同期失敗: ${err?.message || 'unknown error'}`
      setDataStatus((p) => {
        const t = String(p || '')
        if (!t) return msg
        if (t.includes('配当カレンダー同期失敗')) return t
        return `${t} ${msg}`
      })
    }
  }

  // アプリから保有株だけ同期された場合でも、配当カレンダー用テーブルへ寄せる（Web で株を触ったときと同じ upsert / 売り尽くし時は削除）
  useEffect(() => {
    if (user?.id !== dividendOwnedReconcileUserIdRef.current) {
      dividendOwnedReconcileUserIdRef.current = user?.id ?? null
      prevOwnedPositiveQtySymbolsRef.current = new Set()
    }
    if (!user?.id || !ownedAssetDbReady) return
    const fn = syncDividendFromOwnedRef.current
    if (!fn) return
    const list = Array.isArray(ownedStocks) ? ownedStocks : []
    const totals = new Map()
    for (const row of list) {
      const sym = String(row?.symbol || '').trim().toUpperCase()
      if (!sym) continue
      const q = Number(String(row?.qty ?? '').trim().replace(/,/g, ''))
      const qn = Number.isFinite(q) && q >= 0 ? roundStockShareQty(q) : 0
      totals.set(sym, (totals.get(sym) || 0) + qn)
    }
    const positive = new Set(
      [...totals.entries()].filter(([, qty]) => qty > 0).map(([s]) => s),
    )
    const prev = prevOwnedPositiveQtySymbolsRef.current
    const toClear = [...prev].filter((s) => !positive.has(s))
    const toUpsert = [...positive]
    if (toClear.length === 0 && toUpsert.length === 0) return

    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        for (const sym of toClear) {
          if (cancelled) return
          await fn(sym, list, null)
        }
        for (const sym of toUpsert) {
          if (cancelled) return
          await fn(sym, list, null)
        }
        if (!cancelled) prevOwnedPositiveQtySymbolsRef.current = positive
      } catch {
        // fn 側が setDataStatus する。prev は成功時のみ進める。
      }
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [user?.id, ownedAssetDbReady, ownedStocks])

  const applyDividendMasterDetail = useCallback((detail) => {
    if (!detail) return
    if (detail.name) setNewDivStockName(detail.name)
    if (detail.category) setNewDivStockSector(detail.category)
    const cat = String(detail.category || '')
    if (cat.includes('米国')) setNewDivStockFlag('🇺🇸')
    else if (cat.includes('日本')) setNewDivStockFlag('🇯🇵')
    else setNewDivStockFlag(normalizeDividendStockFlag('🇯🇵', { stock_id: detail.symbol, sector: cat }))
    if (Number(detail.price) > 0) setNewDivStockPrice(Number(detail.price))
    const normalizedDividends = normalizeAutofillDividendRows(detail.dividends, detail)
    if (normalizedDividends.length > 0) {
      setNewDivDividends(normalizedDividends)
    }
  }, [normalizeAutofillDividendRows])

  const handlePickDividendDetailRecord = useCallback((detail) => {
    if (!detail?.symbol) return
    setNewDivStockId(String(detail.symbol).trim().toUpperCase())
    applyDividendMasterDetail(detail)
    setDivDetailSuggestions([])
  }, [applyDividendMasterDetail])

  useEffect(() => {
    if (!showAddDivStock || editingDivStockId) {
      setDivDetailSuggestions([])
      return
    }
    const nameQ = String(newDivStockName || '').trim()
    const idQ = String(newDivStockId || '').trim()
    if (nameQ.length < 1 && idQ.length < 1) {
      setDivDetailSuggestions([])
      return
    }
    const tid = window.setTimeout(() => {
      // 銘柄名が自動補完されたあとも、ティッカー欄の入力（例: AP）と併せて検索する。
      // 単一の q = name || id だと長い社名が常に優先され、社名欄で「apple」と打っても候補が効かないことがある。
      const norm = (s) => String(s || '').trim().toLowerCase()
      const chunks = []
      if (nameQ.length > 0) chunks.push(...searchDividendCalendarRecords(nameQ, 12))
      if (idQ.length > 0 && norm(idQ) !== norm(nameQ)) {
        chunks.push(...searchDividendCalendarRecords(idQ, 12))
      }
      const seen = new Set()
      const out = []
      for (const r of chunks) {
        const sym = String(r?.symbol || '').trim().toUpperCase()
        if (!sym || seen.has(sym)) continue
        seen.add(sym)
        out.push(r)
        if (out.length >= 12) break
      }
      setDivDetailSuggestions(out)
    }, 180)
    return () => window.clearTimeout(tid)
  }, [showAddDivStock, editingDivStockId, newDivStockId, newDivStockName])

  const handleDividendStockIdInput = (rawValue) => {
    const sanitized = String(rawValue || '').trim().toUpperCase()
    setNewDivStockId(sanitized)
    divStockIdFetchRef.current = sanitized
    if (isUsListedEtfSymbol(sanitized)) {
      setDivStockLookupLoading(false)
      return
    }

    const master = getDividendCalendarDetailRecord(sanitized)
    if (master) {
      setDivStockLookupLoading(false)
      applyDividendMasterDetail(master)
      if (Array.isArray(master.dividends) && master.dividends.length <= 1) {
        const preset = lookupDividendStockBySymbol(sanitized)
        if (Array.isArray(preset?.dividends) && preset.dividends.length > 1) {
          const presetRows = [...new Map(
            preset.dividends
              .map((d) => ({
                month: Math.min(12, Math.max(1, Number(d?.month) || 1)),
                amount: Math.max(0, Number(d?.amount) || 0),
              }))
              .filter((d) => Number.isFinite(d.month))
              .sort((a, b) => a.month - b.month)
              .map((d) => [d.month, d]),
          ).values()]
          if (presetRows.length > 0) setNewDivDividends(presetRows)
        }
      }
      return
    }

    const preset = lookupDividendStockBySymbol(sanitized)
    if (preset) {
      setDivStockLookupLoading(false)
      if (preset.name) setNewDivStockName(preset.name)
      if (preset.sector) setNewDivStockSector(preset.sector)
      if (preset.region === 'JP') setNewDivStockFlag('🇯🇵')
      else if (preset.region === 'US') setNewDivStockFlag('🇺🇸')
      else setNewDivStockFlag(normalizeDividendStockFlag('🇯🇵', { stock_id: sanitized, sector: preset.sector }))
      if (Array.isArray(preset.dividends) && preset.dividends.length > 0) {
        const presetRows = normalizeAutofillDividendRows(preset.dividends, preset)
        if (presetRows.length > 0) setNewDivDividends(presetRows)
      }
      return
    }

    setDivStockLookupLoading(true)
    fetchStockFromSupabase(sanitized).then((result) => {
      setDivStockLookupLoading(false)
      if (!result || divStockIdFetchRef.current !== sanitized) return
      if (result.name) setNewDivStockName(result.name)
      if (result.sector) setNewDivStockSector(result.sector)
      if (result.region === 'JP') setNewDivStockFlag('🇯🇵')
      else if (result.region === 'US') setNewDivStockFlag('🇺🇸')
      else setNewDivStockFlag(normalizeDividendStockFlag('🇯🇵', { stock_id: sanitized, sector: result.sector }))
    }).catch(() => {
      setDivStockLookupLoading(false)
    })
  }

  const handleDividendStockNameInput = useCallback((rawValue) => {
    const nextName = String(rawValue || '')
    setNewDivStockName(nextName)

    if (editingDivStockId) return
    const typed = nextName.trim()
    if (!typed) return

    const compact = (s) => String(s || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '')
    const q = compact(typed)
    const hits = searchDividendCalendarRecords(typed, 12)
    const exact = hits.filter((r) => {
      const sym = compact(r?.symbol)
      const code = sym.replace(/\.t$/, '')
      return compact(r?.name) === q || sym === q || code === q
    })
    if (exact.length === 1) {
      setNewDivStockId(String(exact[0].symbol).trim().toUpperCase())
      applyDividendMasterDetail(exact[0])
      return
    }

    if (!newDivStockId) return
    const current = getDividendCalendarDetailRecord(newDivStockId)
      || lookupDividendStockBySymbol(newDivStockId)
    const currentName = compact(current?.name)
    if (!currentName || currentName !== q) {
      setNewDivStockId('')
    }
  }, [applyDividendMasterDetail, editingDivStockId, newDivStockId])

  useEffect(() => {
    if (activeTab !== 'dividend' || !user?.id) return
    let cancelled = false
    setDividendLoading(true)
    loadDividendWatchlist(user.id)
      .then(async (rows) => {
        if (cancelled) return
        const loadedRows = Array.isArray(rows) ? rows : []
        const normalized = loadedRows.map((row) => normalizePersistedDividendItem(row))
        const normalizedRows = normalized.map((r) => r.item)
        const changedRows = normalized.filter((r) => r.changed).map((r) => r.item)
        setDividendWatchlist(normalizedRows)

        if (changedRows.length > 0) {
          try {
            await Promise.all(changedRows.map((item) => upsertDividendWatchlistItem(user.id, item)))
            if (!cancelled) {
              setDividendStatus(`既存データを自動補正しました（${changedRows.length}件）`)
              try {
                window.dispatchEvent(new CustomEvent('mm-dividend-bell-refresh'))
              } catch {
                // ignore
              }
              setTimeout(() => setDividendStatus(''), 2800)
            }
          } catch {
            // Keep UI responsive even if a subset of auto-fixes fail.
          }
        }

        // 「株式」タブで追加した保有が user_dividend_watchlist にまだ無い／同期が遅れた場合に合わせる
        const fn = syncDividendFromOwnedRef.current
        const list = Array.isArray(ownedStocksLatestRef.current) ? ownedStocksLatestRef.current : []
        if (!fn || list.length === 0 || cancelled) return
        const totals = new Map()
        for (const row of list) {
          const sym = String(row?.symbol || '').trim().toUpperCase()
          if (!sym) continue
          const q = Number(String(row?.qty ?? '').trim().replace(/,/g, ''))
          const qn = Number.isFinite(q) && q >= 0 ? roundStockShareQty(q) : 0
          totals.set(sym, (totals.get(sym) || 0) + qn)
        }
        const symbols = [...totals.entries()].filter(([, qty]) => qty > 0).map(([s]) => s)
        for (const sym of symbols) {
          if (cancelled) return
          await fn(sym, list, null)
        }
      })
      .catch(() => setDividendStatus('データの読み込みに失敗しました'))
      .finally(() => {
        if (!cancelled) setDividendLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, normalizePersistedDividendItem, user?.id])

  const handleDividendQtyChange = async (stockId, newQty) => {
    const q = roundStockShareQty(newQty)
    if (!Number.isFinite(q) || !(q > 0)) return
    setDividendWatchlist(prev => prev.map(r => r.stock_id === stockId ? { ...r, qty: q } : r))
    if (!user?.id) return
    try {
      await updateDividendWatchlistQty(user.id, stockId, q)
    } catch { /* ignore */ }
  }

  const handleDividendDelete = async (stockId) => {
    const id = normalizeListedSymbolId(stockId)
    if (!id) return
    if (user?.id) rememberDismissedDividendSymbol(user.id, id)
    setDividendWatchlist((prev) => prev.filter((r) => !ownedSymbolMatchesDividendStockId(id, r.stock_id)))
    if (!user?.id) return
    try {
      await deleteDividendWatchlistItem(user.id, id)
    } catch { /* ignore */ }
  }

  const resetDividendAddForm = () => {
    setEditingDivStockId(null)
    setNewDivStockId('')
    setNewDivStockName('')
    setNewDivStockFlag('🇯🇵')
    setNewDivStockSector('')
    setNewDivStockPrice(0)
    setNewDivStockQty(10)
    setNewDivStockNisa(false)
    setNewDivStockBuyDate('')
    setNewDivStockBuyPrice('')
    setNewDivDividends([{ month: 6, amount: 0 }])
    setDivStockLookupLoading(false)
    setDivDetailSuggestions([])
  }

  const handleDividendAddClose = () => {
    setShowAddDivStock(false)
    resetDividendAddForm()
  }

  const handleDividendEditStart = (item) => {
    if (!item) return
    setEditingDivStockId(item.stock_id || null)
    setNewDivStockId(String(item.stock_id || '').toUpperCase())
    setNewDivStockName(item.stock_name || '')
    setNewDivStockFlag(normalizeDividendStockFlag(item.flag || '🏳️', item))
    setNewDivStockSector(item.sector || '')
    setNewDivStockPrice(Math.max(0, Number(item.price || 0)))
    const rqEdit = Number(item.qty)
    const baseEdit = Number.isFinite(rqEdit) && rqEdit > 0 ? rqEdit : 10
    const rEdit = roundStockShareQty(baseEdit)
    setNewDivStockQty(rEdit > 0 ? rEdit : 10)
    setNewDivStockNisa(getDividendItemIsNisa(item))
    const normalizedDividends = Array.isArray(item.dividends) && item.dividends.length > 0
      ? item.dividends
        .map((d) => ({
          month: Math.min(12, Math.max(1, Number(d?.month || 6))),
          amount: Math.max(0, Number(d?.amount || 0)),
        }))
        .filter((d) => Number.isFinite(d.month))
      : [{ month: 6, amount: 0 }]
    setNewDivDividends(normalizedDividends)
    setShowAddDivStock(true)
  }

  const handleDividendAdd = async (submitOpts = {}) => {
    if (!newDivStockId.trim() || !newDivStockName.trim()) return
    const isEditing = Boolean(editingDivStockId)
    const symInputUpper = normalizeListedSymbolId(newDivStockId)
    if (!isEditing && isUsListedEtfSymbol(symInputUpper, newDivStockName)) return
    if (user?.id) forgetDismissedDividendSymbol(user.id, symInputUpper)
    const hadOwnedForSymbol = ownedStocks.some((s) => s.symbol === symInputUpper)
    const capOwnedBuyDateIso = toIsoDate(String(newDivStockBuyDate || ''))
    const capOwnedBuyPriceNum = (() => {
      const t = String(newDivStockBuyPrice ?? '')
        .trim()
        .replace(/,/g, '')
      if (!t) return 0
      const n = Number(t)
      return Number.isFinite(n) && n >= 0 ? n : 0
    })()
    const resolvedQtyInput = submitOpts?.qty != null ? submitOpts.qty : newDivStockQty
    const item = {
      stock_id:   symInputUpper,
      stock_name: newDivStockName.trim(),
      flag:       normalizeDividendStockFlag(newDivStockFlag, {
        stock_id: symInputUpper,
        sector: newDivStockSector,
      }),
      sector:     newDivStockSector,
      color:      '#f97316',
      price:      Math.max(0, Number(newDivStockPrice || 0)),
      qty:        (() => {
        const r = roundStockShareQty(resolvedQtyInput)
        return r > 0 ? r : 10
      })(),
      is_nisa:    Boolean(newDivStockNisa),
      notes:      '',
      dividends:  newDivDividends
        .map((d) => ({ month: Number(d.month), amount: Math.max(0, Number(d.amount || 0)) }))
        .filter((d) => Number.isFinite(d.month) && d.month >= 1 && d.month <= 12),
    }
    const firstMonth = getFirstDividendMonth(item.dividends)
    let masterMatch = false
    try {
      const rec = getDividendCalendarDetailRecord(item.stock_id)
      masterMatch = Boolean(rec && dividendDetailMatchesUserInput(rec, item.dividends))
    } catch {
      masterMatch = false
    }

    const optimistic = { ...item, id: `tmp-${Date.now()}` }
    setDividendWatchlist(prev => {
      const exists = prev.find(r => r.stock_id === item.stock_id)
      if (exists) return prev.map(r => r.stock_id === item.stock_id ? { ...r, ...item } : r)
      return [...prev, optimistic]
    })
    if (firstMonth) {
      setDividendHighlightSignal({ month: firstMonth, token: Date.now() })
    }
    setShowAddDivStock(false)
    resetDividendAddForm()

    const statusOk = (base, isGuest) => {
      if (!masterMatch) return base
      if (isGuest) return `${base} 配当マスターと一致。ログインするとクラウド保存・通知に連動します。`
      return `${base} 配当マスターと一致。今月が対象で各回の金額がマスターと揃えば通知に表示されます。`
    }

    if (!user?.id) {
      setDividendStatus(statusOk(isEditing ? '更新しました（端末のみ）' : '追加しました（端末のみ）', true))
      try {
        window.dispatchEvent(new CustomEvent('mm-dividend-bell-refresh'))
      } catch { /* ignore */ }
      setTimeout(() => setDividendStatus(''), 4000)
      return
    }

    setDividendSaving(true)
    try {
      await upsertDividendWatchlistItem(user.id, item)
      const rows = await loadDividendWatchlist(user.id)
      setDividendWatchlist(rows)
      if (!isEditing && !isMyPageEtfSymbol(item.stock_id) && !hadOwnedForSymbol) {
        userExplicitlyClearedAllStocksRef.current = false
        ownedStockCloudTouchedRef.current = true
        setOwnedStocks((prev) => {
          if (prev.some((s) => s.symbol === item.stock_id)) return prev
          const q = roundStockShareQty(item.qty)
          const qty = (Number.isFinite(q) && q > 0) ? q : 10
          return [
            ...prev,
            {
              lotId: createOwnedLotId(),
              symbol: item.stock_id,
              buyDate: capOwnedBuyDateIso || '',
              buyPrice: capOwnedBuyPriceNum > 0 ? capOwnedBuyPriceNum : '',
              qty,
            },
          ]
        })
      }
      recordUserActivityEvent(user.id, isEditing ? 'dividend_watch_update' : 'dividend_watch_add', {
        stock_id: item.stock_id,
        flag: item.flag,
      })
      const shouldMirrorOwned = !isEditing && !isMyPageEtfSymbol(item.stock_id) && !hadOwnedForSymbol
      const hasBothBuyFields = Boolean(capOwnedBuyDateIso) && capOwnedBuyPriceNum > 0
      const ownedMsg = (shouldMirrorOwned && !hasBothBuyFields)
        ? '未入力の買付価格・日付は「株式」タブで入力できます。'
        : ''
      setDividendStatus(
        `${statusOk(isEditing ? '更新しました' : '保存しました', false)}${ownedMsg ? ` ${ownedMsg}` : ''}`.trim(),
      )
      try {
        window.dispatchEvent(new CustomEvent('mm-dividend-bell-refresh'))
      } catch { /* ignore */ }
      const clearAfterMs = (masterMatch ? 4500 : 2000) + (ownedMsg ? 3500 : 0)
      setTimeout(() => setDividendStatus(''), clearAfterMs)
    } catch (err) {
      setDividendStatus(`保存失敗: ${err?.message}`)
    } finally {
      setDividendSaving(false)
    }
  }

  const handleRecordStockSale = useCallback(async ({ symbol, sellDate, sellQty, sellPrice }) => {
    const symU = String(symbol || '').trim().toUpperCase()
    const iso = toIsoDate(sellDate || '')
    const sq = Number(sanitizeDecimalManyInput(String(sellQty ?? ''), 8))
    const sp = Number(sanitizeDecimalInput(String(sellPrice ?? '')))
    if (!symU || !iso) {
      setDataStatus('売却日を入力してください。')
      return
    }
    if (!Number.isFinite(sq) || sq <= 0 || !Number.isFinite(sp) || sp <= 0) {
      setDataStatus('売却数量・売却単価を正しく入力してください。')
      return
    }
    const fifo = fifoStockSellFromLots({ symbol: symU, sellQty: sq, ownedLots: ownedStocks, fxByDate: fxRatesByDate })
    if (!fifo.ok) {
      setDataStatus(fifo.reason)
      return
    }
    let sellFxRate = null
    let sellFxDate = ''
    let proceedsJpy
    if (inferStockCurrency(symU) === 'USD') {
      const fx = await resolveUsdSellFx({
        sellDateIso: iso,
        currentRate: valuationUsdJpy,
        currentAsOf: valuationFxDate,
      })
      if (!fx) {
        setDataStatus('売却日の為替が取得できないため、実現損益を記録できません。')
        return
      }
      sellFxRate = fx.rate
      sellFxDate = fx.asOf
      proceedsJpy = sq * sp * fx.rate
    } else {
      proceedsJpy = stockSaleProceedsJpy(symU, sq, sp, iso, fxRatesByDate)
      if (proceedsJpy == null) {
        setDataStatus('売却日の為替が取得できないため、実現損益を記録できません。')
        return
      }
    }
    const realizedPnlJpy = proceedsJpy - fifo.costBasisJpy
    const trade = {
      tradeId: `sld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      symbol: symU,
      sellDate: iso,
      qty: sq,
      sellPrice: sp,
      costBasisJpy: fifo.costBasisJpy,
      proceedsJpy,
      realizedPnlJpy,
      sellFxRate,
      sellFxDate,
      buyLots: fifo.buyLots || [],
    }
    ownedStockCloudTouchedRef.current = true
    ownedRealizedCloudTouchedRef.current = true
    const nextStocks = fifo.updatedOwned
    if (!Array.isArray(nextStocks) || nextStocks.length === 0) {
      userExplicitlyClearedAllStocksRef.current = true
    } else {
      userExplicitlyClearedAllStocksRef.current = false
    }
    setOwnedStocks(nextStocks)
    setRealizedStockTrades((prev) => [...normalizeRealizedStockTrades(prev), trade])
    if (user?.id) {
      queueMicrotask(() => {
        const fn = syncDividendFromOwnedRef.current
        if (fn) void fn(symU, nextStocks, null)
      })
    }
    setDataStatus(
      `${symU} の売却を記録しました（実現損益 ${realizedPnlJpy >= 0 ? '+' : ''}¥${Math.round(realizedPnlJpy).toLocaleString('ja-JP')}）。`,
    )
  }, [ownedStocks, realizedStockTrades, fxRatesByDate, valuationUsdJpy, valuationFxDate, user?.id, ownedAssetDbAvailable])

  const handleRecordFundSale = useCallback(async ({ symbol, sellDate, sellUnits, sellPrice }) => {
    const symU = String(symbol || '').trim().toUpperCase()
    const iso = toIsoDate(sellDate || '')
    const su = Number(sanitizeDecimalManyInput(String(sellUnits ?? ''), 16))
    const sp = Number(sanitizeDecimalInput(String(sellPrice ?? '')))
    if (!symU || !iso) {
      setDataStatus('売却日を入力してください。')
      return
    }
    if (!Number.isFinite(su) || su <= 0 || !Number.isFinite(sp) || sp <= 0) {
      setDataStatus('売却口数・売却単価を正しく入力してください。')
      return
    }
    let fxMap = fxRatesByDate
    if (inferStockCurrency(symU) === 'USD' && iso && (fxMap[iso] == null || !Number.isFinite(Number(fxMap[iso])))) {
      try {
        const r = await fetch(`/api/fx?date=${iso}`)
        const j = await r.json()
        const u = Number(j?.rates?.USD)
        if (Number.isFinite(u) && u > 0) {
          fxMap = { ...fxMap, [iso]: u }
          setFxRatesByDate((prev) => ({ ...prev, [iso]: u }))
        }
      } catch {
        // fallback rate inside stockSaleProceedsJpy
      }
    }
    const fifo = fifoFundSellFromLots({ symbol: symU, sellUnits: su, ownedFundLots: ownedFunds, fxByDate: fxMap })
    if (!fifo.ok) {
      setDataStatus(fifo.reason)
      return
    }
    const proceedsJpy = stockSaleProceedsJpy(symU, su, sp, iso, fxMap)
    if (proceedsJpy == null) {
      setDataStatus('売却日の為替が取得できないため、実現損益を記録できません。')
      return
    }
    const realizedPnlJpy = proceedsJpy - fifo.costBasisJpy
    const trade = {
      tradeId: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      symbol: symU,
      sellDate: iso,
      qty: su,
      sellPrice: sp,
      costBasisJpy: fifo.costBasisJpy,
      proceedsJpy,
      realizedPnlJpy,
      buyLots: fifo.buyLots || [],
    }
    ownedFundCloudTouchedRef.current = true
    ownedRealizedFundCloudTouchedRef.current = true
    const nextFunds = fifo.updatedOwned
    if (!Array.isArray(nextFunds) || nextFunds.length === 0) {
      userExplicitlyClearedAllFundsRef.current = true
    } else {
      userExplicitlyClearedAllFundsRef.current = false
    }
    setOwnedFunds(nextFunds)
    setRealizedFundTrades((prev) => [...normalizeRealizedFundTrades(prev), trade])
    setDataStatus(
      `${symU} の売却を記録しました（実現損益 ${realizedPnlJpy >= 0 ? '+' : ''}¥${Math.round(realizedPnlJpy).toLocaleString('ja-JP')}）。`,
    )
  }, [ownedFunds, realizedFundTrades, fxRatesByDate])

  const handleUpdateStockRealizedTrade = useCallback((tradeId, patch) => {
    const tid = String(tradeId || '').trim()
    if (!tid || !patch || typeof patch !== 'object') return
    ownedRealizedCloudTouchedRef.current = true
    setRealizedStockTrades((prev) => {
      const norm = normalizeRealizedStockTrades(prev)
      let hit = false
      const next = norm.map((t) => {
        if (t.tradeId !== tid) return t
        hit = true
        const merged = { ...t, ...patch }
        const proceeds = Number(merged.proceedsJpy)
        const cost = Number(merged.costBasisJpy)
        merged.realizedPnlJpy = Number.isFinite(proceeds) && Number.isFinite(cost) ? proceeds - cost : Number(merged.realizedPnlJpy || 0)
        return merged
      })
      return hit ? next : prev
    })
    setDataStatus('株式の売却記録を更新しました。')
  }, [])

  const handleDeleteStockRealizedTrade = useCallback((tradeId) => {
    const tid = String(tradeId || '').trim()
    if (!tid) return
    ownedRealizedCloudTouchedRef.current = true
    setRealizedStockTrades((prev) => normalizeRealizedStockTrades(prev).filter((t) => t.tradeId !== tid))
    setDataStatus('株式の売却記録を削除しました。')
  }, [])

  const handleUpdateFundRealizedTrade = useCallback((tradeId, patch) => {
    const tid = String(tradeId || '').trim()
    if (!tid || !patch || typeof patch !== 'object') return
    ownedRealizedFundCloudTouchedRef.current = true
    setRealizedFundTrades((prev) => {
      const norm = normalizeRealizedFundTrades(prev)
      let hit = false
      const next = norm.map((t) => {
        if (t.tradeId !== tid) return t
        hit = true
        const merged = { ...t, ...patch }
        const proceeds = Number(merged.proceedsJpy)
        const cost = Number(merged.costBasisJpy)
        merged.realizedPnlJpy = Number.isFinite(proceeds) && Number.isFinite(cost) ? proceeds - cost : Number(merged.realizedPnlJpy || 0)
        return merged
      })
      return hit ? next : prev
    })
    setDataStatus('ファンドの売却記録を更新しました。')
  }, [])

  const handleDeleteFundRealizedTrade = useCallback((tradeId) => {
    const tid = String(tradeId || '').trim()
    if (!tid) return
    ownedRealizedFundCloudTouchedRef.current = true
    setRealizedFundTrades((prev) => normalizeRealizedFundTrades(prev).filter((t) => t.tradeId !== tid))
    setDataStatus('ファンドの売却記録を削除しました。')
  }, [])

  const computeSaleProceedsJpyForHistoryEdit = useCallback(
    (sym, qty, price, iso) => stockSaleProceedsJpy(sym, qty, price, iso, fxRatesByDate),
    [fxRatesByDate],
  )

  const resolveSellFx = useCallback(
    (iso) => resolveUsdSellFx({
      sellDateIso: iso,
      currentRate: valuationUsdJpy,
      currentAsOf: valuationFxDate,
    }),
    [valuationUsdJpy, valuationFxDate],
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'wealth':
        return (
          <WealthSection
            stockWatchlistItems={effectiveStockWatchlistItems}
            ownedStocks={ownedStocks}
            ownedFunds={ownedFunds}
            ownedStockItems={ownedStockItems}
            ownedFundItems={ownedFundItems}
            userId={user?.id || null}
            fxRatesByDate={fxRatesByDate}
            valuationUsdJpy={valuationUsdJpy}
            valuationFxDate={valuationFxDate}
            onAddOwnedStock={handleAddOwnedStock}
            searchStockSuggestions={searchStockSuggestions}
            searchFundSuggestions={searchFundSuggestions}
            onRemoveStockWatchlist={handleRemoveStockWatchlist}
            onUpdateOwnedStock={handleUpdateOwnedStock}
            onRemoveOwnedStock={handleRemoveOwnedStock}
            onLoadOwnedStockPrice={handleLoadOwnedStockPrice}
            onAddOwnedFund={handleAddOwnedFund}
            onRemoveOwnedFund={handleRemoveOwnedFund}
            onUpdateOwnedFund={handleUpdateOwnedFund}
            onLoadOwnedFundPrice={handleLoadOwnedFundPrice}
            fundWatchlist={fundWatchlist}
            fundOptimizerSets={fundOptimizerSets}
            onToggleFundWatchlist={toggleFundWatchlist}
            onUpdateFundWatchlistMeta={updateFundWatchlistMeta}
            onUiMessage={onUiMessage}
            onRemoveFundOptimizerSet={handleRemoveFundOptimizerSet}
            productInterests={productInterests}
            portfolio={effectivePortfolio}
            isMockMode={!myPageDbAvailable}
            canEditAssets={Boolean(user?.id)}
            onAddAsset={handleAddAsset}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAsset={handleDeleteAsset}
            pointAccounts={effectivePointAccounts}
            insurances={effectiveInsurances}
            tabMode="wealth"
            realizedStockTrades={realizedStockTrades}
            onRecordStockSale={handleRecordStockSale}
            realizedFundTrades={realizedFundTrades}
            onRecordFundSale={handleRecordFundSale}
            isPaidMember={isPaidMember}
            portfolioQuotesHydrating={stockPortfolioQuotesHydrating || fundPortfolioQuotesHydrating}
            onSwitchPortfolioTab={switchPortfolioTabAndScroll}
          />
        )
      case 'stock':
        return (
          <WealthSection
            stockWatchlistItems={effectiveStockWatchlistItems}
            ownedStocks={ownedStocks}
            ownedFunds={ownedFunds}
            ownedStockItems={ownedStockItems}
            ownedFundItems={ownedFundItems}
            userId={user?.id || null}
            fxRatesByDate={fxRatesByDate}
            valuationUsdJpy={valuationUsdJpy}
            valuationFxDate={valuationFxDate}
            onAddOwnedStock={handleAddOwnedStock}
            searchStockSuggestions={searchStockSuggestions}
            searchFundSuggestions={searchFundSuggestions}
            onRemoveStockWatchlist={handleRemoveStockWatchlist}
            onUpdateOwnedStock={handleUpdateOwnedStock}
            onRemoveOwnedStock={handleRemoveOwnedStock}
            onLoadOwnedStockPrice={handleLoadOwnedStockPrice}
            onAddOwnedFund={handleAddOwnedFund}
            onRemoveOwnedFund={handleRemoveOwnedFund}
            onUpdateOwnedFund={handleUpdateOwnedFund}
            onLoadOwnedFundPrice={handleLoadOwnedFundPrice}
            fundWatchlist={fundWatchlist}
            fundOptimizerSets={fundOptimizerSets}
            onToggleFundWatchlist={toggleFundWatchlist}
            onUpdateFundWatchlistMeta={updateFundWatchlistMeta}
            onUiMessage={onUiMessage}
            onRemoveFundOptimizerSet={handleRemoveFundOptimizerSet}
            productInterests={productInterests}
            portfolio={effectivePortfolio}
            isMockMode={!myPageDbAvailable}
            canEditAssets={Boolean(user?.id)}
            onAddAsset={handleAddAsset}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAsset={handleDeleteAsset}
            pointAccounts={effectivePointAccounts}
            insurances={effectiveInsurances}
            tabMode="stock"
            realizedStockTrades={realizedStockTrades}
            onRecordStockSale={handleRecordStockSale}
            realizedFundTrades={realizedFundTrades}
            onRecordFundSale={handleRecordFundSale}
            isPaidMember={isPaidMember}
            portfolioQuotesHydrating={stockPortfolioQuotesHydrating || fundPortfolioQuotesHydrating}
            onSwitchPortfolioTab={switchPortfolioTabAndScroll}
          />
        )
      case 'fund':
        return (
          <WealthSection
            stockWatchlistItems={effectiveStockWatchlistItems}
            ownedStocks={ownedStocks}
            ownedFunds={ownedFunds}
            ownedStockItems={ownedStockItems}
            ownedFundItems={ownedFundItems}
            userId={user?.id || null}
            fxRatesByDate={fxRatesByDate}
            valuationUsdJpy={valuationUsdJpy}
            valuationFxDate={valuationFxDate}
            onAddOwnedStock={handleAddOwnedStock}
            searchStockSuggestions={searchStockSuggestions}
            searchFundSuggestions={searchFundSuggestions}
            onRemoveStockWatchlist={handleRemoveStockWatchlist}
            onUpdateOwnedStock={handleUpdateOwnedStock}
            onRemoveOwnedStock={handleRemoveOwnedStock}
            onLoadOwnedStockPrice={handleLoadOwnedStockPrice}
            onAddOwnedFund={handleAddOwnedFund}
            onRemoveOwnedFund={handleRemoveOwnedFund}
            onUpdateOwnedFund={handleUpdateOwnedFund}
            onLoadOwnedFundPrice={handleLoadOwnedFundPrice}
            fundWatchlist={fundWatchlist}
            fundOptimizerSets={fundOptimizerSets}
            onToggleFundWatchlist={toggleFundWatchlist}
            onUpdateFundWatchlistMeta={updateFundWatchlistMeta}
            onUiMessage={onUiMessage}
            onRemoveFundOptimizerSet={handleRemoveFundOptimizerSet}
            productInterests={productInterests}
            portfolio={effectivePortfolio}
            isMockMode={!myPageDbAvailable}
            canEditAssets={Boolean(user?.id)}
            onAddAsset={handleAddAsset}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAsset={handleDeleteAsset}
            pointAccounts={effectivePointAccounts}
            insurances={effectiveInsurances}
            tabMode="fund"
            realizedStockTrades={realizedStockTrades}
            onRecordStockSale={handleRecordStockSale}
            realizedFundTrades={realizedFundTrades}
            onRecordFundSale={handleRecordFundSale}
            isPaidMember={isPaidMember}
            portfolioQuotesHydrating={stockPortfolioQuotesHydrating || fundPortfolioQuotesHydrating}
            onSwitchPortfolioTab={switchPortfolioTabAndScroll}
          />
        )
      case 'point':
        return (
          <BudgetSectionV2
            user={user}
            isPaidMember={isPaidMember}
            onUiMessage={onUiMessage}
            productInterests={productInterests}
            expenses={effectiveExpenses}
            insurances={effectiveInsurances}
            pointAccounts={effectivePointAccounts}
            annualIncomeManwon={financeProfile.annual_income_manwon}
            onAnnualIncomeChange={(v) => setFinanceProfile((prev) => ({ ...prev, annual_income_manwon: Math.max(0, Number(v || 0)) }))}
            onSaveAnnualIncome={handleSaveFinanceProfile}
            profileSaving={profileSaving}
            budgetTargetYen={financeProfile.budget_target_yen}
            onSaveBudgetTarget={handleSaveBudgetTarget}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onUpdateExpense={handleUpdateExpense}
            onAddInsurance={handleAddInsurance}
            onDeleteInsurance={handleDeleteInsurance}
            onUpdateInsurance={handleUpdateInsurance}
            onAddPointAccount={handleAddPointAccount}
            onDeletePointAccount={handleDeletePointAccount}
            onUpdatePointAccount={handleUpdatePointAccount}
            expenseSaving={expenseSaving}
            insuranceSaving={insuranceSaving}
            pointSaving={pointSaving}
          />
        )
      case 'debt':
        return (
          <div className="space-y-8">
            <DebtSection
              annualIncome={financeProfile.annual_income_manwon}
              debtRemainingYen={loanRemainingYen}
              onDebtRemainingChange={setLoanRemainingYen}
              onSaveDebtRemaining={handleSaveLoanRemaining}
              onAnnualIncomeChange={(v) => setFinanceProfile((prev) => ({ ...prev, annual_income_manwon: v }))}
              onSaveAnnualIncome={handleSaveFinanceProfile}
              profileSaving={profileSaving}
              onOpenLoanDiagnosis={() => setIsLoanDiagnosisOpen(true)}
              revolvingProfile={revolvingProfile}
              onRevolvingProfileChange={handleRevolvingProfileChange}
              onSaveRevolvingProfile={handleSaveRevolvingProfile}
              revolvingDebts={revolvingDebts}
              onAddRevolvingDebt={handleAddRevolvingDebt}
              onUpdateRevolvingDebt={handleUpdateRevolvingDebt}
              onDeleteRevolvingDebt={handleDeleteRevolvingDebt}
              onRunRefinanceSimulation={handleRunRefinanceSimulation}
              onRefinanceOfferClick={handleRefinanceOfferClick}
              refinanceSaving={refinanceSaving}
              refinanceRunning={refinanceRunning}
              refinanceOffers={refinanceOffers}
              refinanceStatus={dataStatus}
              taxShieldProfile={taxShieldProfile}
              taxShieldRules={taxShieldRules}
              onTaxShieldProfileChange={handleTaxShieldProfileChange}
              onSaveTaxShieldProfile={handleSaveTaxShieldProfile}
              onRunTaxShieldSimulation={handleRunTaxShieldSimulation}
              taxShieldSaving={taxShieldSaving}
              taxShieldStatus={taxShieldStatus}
              monthlyExpenses={monthlyExpensesRecent3}
            />
            <CoachSection
              user={user}
              refinanceOffers={refinanceOffers}
              refinanceRunning={refinanceRunning}
              refinanceStatus={dataStatus}
              revolvingDebts={revolvingDebts}
              taxShieldProfile={taxShieldProfile}
              taxShieldRules={taxShieldRules}
              onRunRefinanceSimulation={handleRunRefinanceSimulation}
              onRunTaxShieldSimulation={handleRunTaxShieldSimulation}
              onTaxShieldProfileChange={handleTaxShieldProfileChange}
              onSaveTaxShieldProfile={handleSaveTaxShieldProfile}
              onAddRevolvingDebt={handleAddRevolvingDebt}
              onUpdateRevolvingDebt={handleUpdateRevolvingDebt}
              onDeleteRevolvingDebt={handleDeleteRevolvingDebt}
              refinanceSaving={refinanceSaving}
              taxShieldSaving={taxShieldSaving}
              mode="debtOnly"
            />
          </div>
        )
      case 'dividend':
        return (
          <Suspense fallback={(
            <div className="py-16 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
              配当カレンダーを読み込み中...
            </div>
          )}
          >
            <DividendCalendarSection
              userId={user?.id}
              isPaidMember={isPaidMember}
              onUiMessage={onUiMessage}
              onOpenPremium={() => navigate('/premium')}
              valuationUsdJpy={valuationUsdJpy}
              valuationFxDate={valuationFxDate}
              watchlist={dividendWatchlist}
              loading={dividendLoading}
              saving={dividendSaving}
              status={dividendStatus}
              highlightSignal={dividendHighlightSignal}
              showAdd={showAddDivStock}
              onShowAdd={(open) => { if (!open) handleDividendAddClose(); else setShowAddDivStock(true); }}
              divStockLookupLoading={divStockLookupLoading}
              editingStockId={editingDivStockId}
              newStockId={newDivStockId}
              newStockName={newDivStockName}
              newStockFlag={newDivStockFlag}
              newStockSector={newDivStockSector}
              newStockPrice={newDivStockPrice}
              newStockQty={newDivStockQty}
              newStockNisa={newDivStockNisa}
              newStockBuyDate={newDivStockBuyDate}
              newStockBuyPrice={newDivStockBuyPrice}
              newDividends={newDivDividends}
              onNewStockId={handleDividendStockIdInput}
              onNewStockName={handleDividendStockNameInput}
              onNewStockFlag={setNewDivStockFlag}
              onNewStockSector={setNewDivStockSector}
              onNewStockPrice={setNewDivStockPrice}
              onNewStockQty={setNewDivStockQty}
              onNewStockNisa={setNewDivStockNisa}
              onNewStockBuyDate={setNewDivStockBuyDate}
              onNewStockBuyPrice={setNewDivStockBuyPrice}
              onNewDividends={setNewDivDividends}
              onQtyChange={handleDividendQtyChange}
              onDelete={handleDividendDelete}
              onEdit={handleDividendEditStart}
              onAdd={handleDividendAdd}
              detailSuggestions={divDetailSuggestions}
              onPickDetailSuggestion={handlePickDividendDetailRecord}
            />
          </Suspense>
        )
      case 'related':
        return (
          <div className="space-y-4">
            <PortfolioRelatedPanel
              exposureProfile={exposureProfile}
              loading={exposureLoading}
              newsRows={relatedNewsRows}
            />
          </div>
        )
      case 'sellhistory':
        return (
          <Suspense
            fallback={(
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-10 flex justify-center items-center min-h-[180px]" aria-busy="true">
                <Loader2 className="animate-spin text-slate-400" size={28} aria-hidden />
              </div>
            )}
          >
            <SellHistorySection
              stockTrades={realizedStockTrades}
              fundTrades={realizedFundTrades}
              ownedFunds={ownedFunds}
              isLoggedIn={Boolean(user?.id)}
              assetsReady={ownedAssetDbReady}
              stockRealizedDbReady={realizedDbAvailable}
              fundRealizedDbReady={realizedFundDbAvailable}
              onGoStockTab={() => handleTabChange('stock')}
              onGoFundTab={() => handleTabChange('fund')}
              onUpdateStockTrade={handleUpdateStockRealizedTrade}
              onDeleteStockTrade={handleDeleteStockRealizedTrade}
              onUpdateFundTrade={handleUpdateFundRealizedTrade}
              onDeleteFundTrade={handleDeleteFundRealizedTrade}
              computeSaleProceedsJpy={computeSaleProceedsJpyForHistoryEdit}
              resolveSellFx={resolveSellFx}
            />
          </Suspense>
        )
      default:
        return (
          <WealthSection
            stockWatchlistItems={effectiveStockWatchlistItems}
            ownedStocks={ownedStocks}
            ownedFunds={ownedFunds}
            ownedStockItems={ownedStockItems}
            ownedFundItems={ownedFundItems}
            userId={user?.id || null}
            fxRatesByDate={fxRatesByDate}
            valuationUsdJpy={valuationUsdJpy}
            valuationFxDate={valuationFxDate}
            onAddOwnedStock={handleAddOwnedStock}
            searchStockSuggestions={searchStockSuggestions}
            searchFundSuggestions={searchFundSuggestions}
            onRemoveStockWatchlist={handleRemoveStockWatchlist}
            onUpdateOwnedStock={handleUpdateOwnedStock}
            onRemoveOwnedStock={handleRemoveOwnedStock}
            onLoadOwnedStockPrice={handleLoadOwnedStockPrice}
            onAddOwnedFund={handleAddOwnedFund}
            onRemoveOwnedFund={handleRemoveOwnedFund}
            onUpdateOwnedFund={handleUpdateOwnedFund}
            onLoadOwnedFundPrice={handleLoadOwnedFundPrice}
            fundWatchlist={fundWatchlist}
            fundOptimizerSets={fundOptimizerSets}
            onToggleFundWatchlist={toggleFundWatchlist}
            onRemoveFundOptimizerSet={handleRemoveFundOptimizerSet}
            productInterests={productInterests}
            portfolio={effectivePortfolio}
            isMockMode={!myPageDbAvailable}
            canEditAssets={Boolean(user?.id)}
            onAddAsset={handleAddAsset}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAsset={handleDeleteAsset}
            pointAccounts={effectivePointAccounts}
            insurances={effectiveInsurances}
            tabMode="wealth"
            realizedStockTrades={realizedStockTrades}
            onRecordStockSale={handleRecordStockSale}
            realizedFundTrades={realizedFundTrades}
            onRecordFundSale={handleRecordFundSale}
            isPaidMember={isPaidMember}
            onUiMessage={onUiMessage}
            portfolioQuotesHydrating={stockPortfolioQuotesHydrating || fundPortfolioQuotesHydrating}
            onSwitchPortfolioTab={switchPortfolioTabAndScroll}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 font-sans pb-44 md:pb-36">
      <main className="max-w-[1400px] mx-auto p-4 lg:p-8">
        <header className="relative flex flex-col md:flex-row md:items-start justify-between gap-4 mb-3">
          <div className="relative z-20 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between flex-1 min-w-0">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-full bg-slate-900 dark:bg-orange-500 text-white flex items-center justify-center text-2xl font-black shadow-lg shrink-0">
                {avatarInitial}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  こんにちは、{displayName}
                </h1>
                <p className="mt-1.5 md:mt-2 text-slate-400 font-bold text-sm leading-tight">MoneyMartへようこそ</p>
              </div>
            </div>
            {showHeaderAssetOnboardingHint ? (
              <div className="rounded-2xl border border-orange-200/90 dark:border-orange-800/80 bg-orange-50/95 dark:bg-orange-950/35 px-4 py-3 max-w-full lg:max-w-[min(100%,22rem)] xl:max-w-md shrink-0 shadow-sm shadow-orange-500/10">
                <p className="text-xs font-black text-orange-800 dark:text-orange-200 mb-1.5">
                  まずは保有資産の登録から
                </p>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-700 dark:text-slate-300 mb-3">
                  株式や投資信託を登録すると、総資産や評価損益がまとめて確認できます。画面下の
                  <span className="font-bold text-slate-900 dark:text-white">「株式」</span>
                  または
                  <span className="font-bold text-slate-900 dark:text-white">「ファンド」</span>
                  タブを開き、銘柄・数量・取得単価などを入力してください。
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleTabChange('stock')}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-orange-500 px-3 py-2 text-[11px] font-black text-white hover:opacity-95 transition"
                  >
                    株式タブへ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('fund')}
                    className="inline-flex items-center justify-center rounded-xl border-2 border-orange-400 dark:border-orange-600 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-black text-orange-800 dark:text-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/50 transition"
                  >
                    ファンドタブへ
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative z-10 w-full md:w-auto shrink-0 flex flex-col items-start md:items-end gap-3">
            <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md shadow-slate-900/10 dark:shadow-black/30 min-w-[180px]">
              <p className="text-xs text-slate-400 font-bold mb-1">総資産</p>
              {user?.id && (!ownedAssetDbReady || portfolioQuotesHydratingUi) ? (
                <div className="flex flex-col items-start gap-1.5 pt-1" aria-busy="true">
                  <Loader2 className="animate-spin text-orange-500 shrink-0" size={26} aria-hidden />
                  <p className="text-[11px] font-bold text-slate-400">評価額・損益を同期中…</p>
                </div>
              ) : (
                <>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">¥{Math.round(headerTotalValue).toLocaleString('ja-JP')}</p>
                  <p className={`text-xs font-bold flex items-center gap-1 ${signedReturnTextClassStrong(headerPnL)}`}>
                    <TrendingUp size={12} /> {headerPnL >= 0 ? '+' : ''}¥{Math.round(headerPnL).toLocaleString('ja-JP')} ({headerRate.toFixed(1)}%)
                  </p>
                </>
              )}
            </div>
          </div>
          </div>
        </header>

        <div className="sticky top-16 z-30 -mx-4 lg:-mx-8 px-4 lg:px-8 pt-1 pb-2 mb-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          {dataStatus ? <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{dataStatus}</p> : null}
          <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 mb-1.5">
            ※ 株式・ファンドのUSD建て評価額は、最新価格に本日基準の為替（USD/JPY {Number(valuationUsdJpy || 0).toFixed(2)}、適用日: {valuationFxDate || '--'}）で円換算しています。取得原価は各買付日の為替を使用します。
          </p>

          <div className="flex overflow-x-auto gap-2 pb-0.5 scrollbar-hide pointer-events-auto">
            {[
              { id: 'wealth', label: '資産運用' },
              { id: 'stock', label: '株式' },
              { id: 'fund', label: 'ファンド' },
              { id: 'related', label: '保有との関連' },
              { id: 'sellhistory', label: '売却履歴' },
              { id: 'dividend', label: '配当カレンダー' },
              { id: 'point', label: '家計簿' },
              { id: 'debt', label: 'ローン・負債管理' },
            ].map((tab) => (
              <button
                key={`primary-tab-${tab.id}`}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`pointer-events-auto inline-flex items-center px-4 py-2.5 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-slate-900 dark:bg-orange-500 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="animate-fadeIn mb-6 md:mb-8">
          {renderContent()}
        </div>

        <MyPagePromotionsSection
          user={user}
          referralInviteCode={referralInviteCode}
          referralCopied={referralCopied}
          onReferralCopied={setReferralCopied}
          referralShareHint={referralShareHint}
          onReferralShareHint={setReferralShareHint}
        />

        {activeTab === 'wealth' && (
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 mb-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-800 dark:text-slate-100">アカウント詳細</p>
              <button
                type="button"
                onClick={() => {
                  setShowAccountDanger((v) => !v)
                  setShowDeleteFinal(false)
                  setDeleteIntentChecked(false)
                  setDeleteRejoinDelayChecked(false)
                  setDeleteLegalRetentionChecked(false)
                  setDeleteConfirmText('')
                  setDeleteEmailConfirm('')
                  setAccountActionError('')
                }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {showAccountDanger ? '閉じる' : '詳細を開く'}
              </button>
            </div>
            {showAccountDanger && (
              <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-3">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  退会オプションは安全のため段階的に表示されます。
                </p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteFinal((v) => !v)
                      setAccountActionError('')
                    }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700"
                  >
                    {showDeleteFinal ? '退会フォームを隠す' : '退会オプションを表示'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {showDeleteFinal && (
        <div className="fixed inset-0 z-[120]">
          <button
            type="button"
            aria-label="退会モーダルを閉じる"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={() => {
              if (deletingAccount) return
              setShowDeleteFinal(false)
              setAccountActionError('')
            }}
          />
          <div className="relative z-10 h-full w-full flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-slate-900 p-4 md:p-5 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-12 h-1.5 rounded-full bg-rose-300/80 dark:bg-rose-700/70" />
                    <span className="w-12 h-1.5 rounded-full bg-rose-300/80 dark:bg-rose-700/70" />
                    <span className="w-12 h-1.5 rounded-full bg-rose-300/80 dark:bg-rose-700/70" />
                  </div>
                  <p className="text-xl font-black text-rose-800 dark:text-rose-200">
                    アカウントを削除すると、以下のデータがすべて失われます
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-800 px-2 py-1 text-rose-700 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/30"
                  onClick={() => {
                    if (deletingAccount) return
                    setShowDeleteFinal(false)
                    setAccountActionError('')
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3 mb-4">
                <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={deleteIntentChecked}
                    onChange={(e) => setDeleteIntentChecked(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300"
                  />
                  <span>保存済みのファンド比較・お気に入りリストが削除されます</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={deleteRejoinDelayChecked}
                    onChange={(e) => setDeleteRejoinDelayChecked(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300"
                  />
                  <span>同じメールアドレスでの再登録には24時間かかる場合があります</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={deleteLegalRetentionChecked}
                    onChange={(e) => setDeleteLegalRetentionChecked(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300"
                  />
                  <span>法令に基づく取引記録は、退会後も所定期間保持されます</span>
                </label>
              </div>
              <div className="border-t border-rose-200 dark:border-rose-900/50 pt-4">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">確認のため、登録済みメールアドレスを入力してください</p>
                <input
                  type="text"
                  value={deleteEmailConfirm}
                  onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                  placeholder="example@email.com"
                  className="h-11 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 text-sm w-full"
                />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-3 mb-2">「退会する」と入力してください</p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="退会する"
                  className="h-11 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 text-sm w-full"
                />
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                ※ 個人情報は削除されますが、金融関連法令に基づく記録は所定の期間保持されます。詳しくは
                {' '}<Link to="/legal/privacy" className="text-primary-blue hover:underline">プライバシーポリシー</Link>{' '}をご確認ください。
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                ご不明な点は{' '}<Link to="/faq" className="text-primary-blue hover:underline font-bold">サポートへお問い合わせ</Link>{' '}ください
              </p>
              <div className="mt-4 flex justify-start">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={
                    deletingAccount
                    || !deleteIntentChecked
                    || !deleteRejoinDelayChecked
                    || !deleteLegalRetentionChecked
                    || String(deleteEmailConfirm || '').trim().length === 0
                    || String(deleteConfirmText || '').trim().length === 0
                  }
                  className="h-10 px-5 rounded-xl bg-rose-300 hover:bg-rose-400 disabled:opacity-50 text-white text-lg font-black"
                >
                  {deletingAccount ? '処理中...' : 'アカウントを削除する'}
                </button>
              </div>
              {accountActionError && (
                <p className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-300">{accountActionError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <LoanApprovalDiagnosisModal isOpen={isLoanDiagnosisOpen} onClose={() => setIsLoanDiagnosisOpen(false)} />
    </div>
  )
}
