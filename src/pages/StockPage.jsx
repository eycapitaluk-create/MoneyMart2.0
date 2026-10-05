import { useState, useEffect, useMemo, useRef, useTransition, useDeferredValue } from 'react'
import {
  Search, Star, Plus,
  TrendingUp, TrendingDown, Info,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, LogIn, Sparkles, X,
} from 'lucide-react'
import StockPriceChart from '../components/stocks/StockPriceChart'
import { supabase } from '../lib/supabase'
import { addDbWatchlistItem, loadStockWatchlistSymbolsFromDb, mergeStockWatchlistSymbolsInDb, removeDbWatchlistItem } from '../lib/myPageApi'
import { bumpStockWatchlistSyncVersion } from '../lib/watchlistSyncEvents'
import { trackAnalyticsEvent } from '../lib/analytics'
import { REGION_BY_SYMBOL } from '../data/mockStocks'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import LazyStockCompanyNewsBelowA8Ad from '../components/LazyStockCompanyNewsBelowA8Ad'
import StockDailyAiBrief from '../components/stocks/StockDailyAiBrief'
import StockDividendAnnouncementBanner from '../components/stocks/StockDividendAnnouncementBanner'
import StockLatestSessionOhlcvTable from '../components/stocks/StockLatestSessionOhlcvTable'
import LazyStockLeftSidebarA8Ad from '../components/LazyStockLeftSidebarA8Ad'
import MarketDataEodFreshnessNote from '../components/MarketDataEodFreshnessNote'
import {
  MARKET_DOWN_HEX,
  MARKET_UP_HEX,
  signedReturnTextClassOnDarkPanel,
  signedReturnTextClassStrong,
  signedReturnTextClassTri,
} from '../lib/marketDirectionColors'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import MembersBlurGate from '../components/auth/MembersBlurGate'
import { ETF_SYMBOLS_FROM_XLSX, MARKETSTACK_BLOCKLIST_EXPORT } from '../data/etfListFromXlsx'
import { isUsListedEtfSymbol, US_LISTED_ETF_SYMBOLS } from '../data/usListedEtfUniverse'
import { STOCK_LIST_400 } from '../data/stockList400'
import { getStockMarketPageExtraSymbolList } from '../data/stockMarketPageExtras'
import { isRetiredStockSymbol } from '../lib/retiredStockSymbols'
import { canonicalStockSymbolKeys, normalizeStockSymbolForDb } from '../lib/stockSymbolNormalize'
import {
  getStockNameFallback, getDisplayNameOverride, resolveStockDisplayNameJaEn, formatStockJaEnListLabel,
  formatStockHeatmapLabel, abbreviateHeatmapJaLabel,
} from '../data/stockNameFallback'
import { getStockPageNameJa } from '../data/stockPageDisplayNameJa.js'
import { lookupDividendStockBySymbol } from '../data/dividendStockUniverse'
import { dedupeStockDailyPricesByTradeDate, fetchStockDailyHistoryBySymbolMap, returnPctFromIndex, tradingSessionReturnPct } from '../lib/stockDailyHistory'
import { scheduleIdleTask } from '../lib/scheduleIdle'
import {
  STOCK_SECTOR_OVERRIDE_BY_SYMBOL,
  normalizeSectorName,
} from '../lib/stockSectorNormalize'
import { COMPANY_NEWS_BY_REGION, mergeCompanyNewsWithAiBriefs } from '../data/companyNewsUpcoming'
import {
  findRowTradingSessionsBeforeLatest,
  findYtdBaseRowFromSeries,
  TRADING_SESSION_OFFSETS,
} from '../lib/calendarDateUtils'

const STOCK_WATCHLIST_STORAGE_KEY_PREFIX = 'mm_stock_watchlist_v1'
const getStockWatchlistStorageKey = (userId) =>
  (userId ? `${STOCK_WATCHLIST_STORAGE_KEY_PREFIX}_${userId}` : `${STOCK_WATCHLIST_STORAGE_KEY_PREFIX}_guest`)
const ETF_SYMBOL_SET = new Set([...ETF_SYMBOLS_FROM_XLSX, ...US_LISTED_ETF_SYMBOLS])
/** STOCK_LIST_400 に無いが stockMarketPageExtras で明示した銘柄を続けて並べる基準 priority */
const MARKET_PAGE_EXTRA_PRIORITY_BASE = 50_000
const MAX_REASONABLE_LIVE_PRICE = 10_000_000
const REGION_INDEX_TAGS = {
  US: new Set(['SP500', 'NASDAQ100']),
  JP: new Set(['NIKKEI225']),
  UK: new Set(['FTSE100']),
  EU: new Set(['EUROSTOXX']),
}

const TIMEFRAMES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y']
/** EOD履歴の品質が安定する以前の日付はチャートに含めない（1Y の初期日付欠落を避けるため 2025-01-01 に緩和） */
const STOCK_CHART_TRUSTED_SINCE = '2025-01-01'
// 1Y(252営業日)表示でも MA200 を冒頭から計算できるよう、十分なプリロールを確保する。
const CHART_HISTORY_LIMIT = 520
/** MA200（長期線・ツールチップ・実績サマリー）を画面に出す。履歴が十分に載るまで false のままにできます（計算は継続）。 */
const STOCK_CHART_UI_SHOW_MA200 = false
const TIMEFRAME_ROW_LIMITS = {
  '1D': 2,
  '5D': 5,
  '1M': 22,
  '3M': 66,
  '6M': 132,
  '1Y': 252,
}

const DEFAULT_MARKET_TICKER = [
  { name: '米国代表', value: 0, change: 0 },
  { name: '日本代表', value: 0, change: 0 },
  { name: '英国代表', value: 0, change: 0 },
  { name: '欧州代表', value: 0, change: 0 },
]

const loadStoredStockWatchlist = (userId) => {
  try {
    const key = getStockWatchlistStorageKey(userId)
    const raw = window.localStorage.getItem(key)
    if (raw == null) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const STOCK_FAQ_ITEMS = [
  { q: '表示価格はリアルタイムですか？', a: '取得可能な最新データを表示します。取得遅延や欠損時は補完データが表示される場合があります。' },
  { q: 'この画面で売買できますか？', a: 'このページは情報提供・比較支援が目的であり、実際の取引は外部サービスで行われます。' },
  { q: 'チャート値と約定値が違うことはありますか？', a: 'あります。表示値は可視化用データであり、実際の約定価格とは差が生じる場合があります。' },
]

const getPhaseBadgeClass = (phase = '') => {
  const p = String(phase || '')
  if (p.includes('実績')) return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
  if (p.includes('イベント')) return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300'
  if (p.includes('ビッグテック')) return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
  if (p.includes('日本金融') || p.includes('米国金融') || p.includes('金融')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (p.includes('中央銀行')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (p.includes('日本企業')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (p.includes('米国企業')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/35 dark:text-indigo-200'
  if (p.includes('カンファレンス')) return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
}

const currencyByRegion = (region) => {
  if (region === 'UK') return 'GBP'
  if (region === 'EU') return 'EUR'
  if (region === 'JP') return 'JPY'
  return 'USD'
}

// LSE prices are usually quoted in pence (GBX); convert to GBP for display.
const normalizeDisplayPrice = (value, region) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  if (region === 'UK') return n / 100
  return n
}

const formatCurrency = (value, region) =>
  new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: currencyByRegion(region),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalizeDisplayPrice(value || 0, region))

const formatEodDateLabelFromYmd = (ymd) => {
  const s = String(ymd || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—'
  const d = new Date(`${s}T00:00:00`)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const formatPriceDelta = (value, region) => {
  const normalized = normalizeDisplayPrice(value, region)
  const sign = normalized > 0 ? '+' : ''
  return `${sign}${normalized.toFixed(2)}`
}

const formatCompact = (value) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}M`
  if (value >= 1_000) return `${(value / 1_000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}K`
  return `${Math.round(value).toLocaleString('ja-JP')}`
}

const formatDailyPrice = (value, region) => (
  Number.isFinite(Number(value)) ? formatCurrency(Number(value), region) : '--'
)

const formatDailyVolume = (value) => (
  Number.isFinite(Number(value)) ? Number(value).toLocaleString('ja-JP') : '--'
)

const toSafeLivePrice = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0 || n > MAX_REASONABLE_LIVE_PRICE) return null
  return n
}

const medianOf = (values) => {
  if (!Array.isArray(values) || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

const randomPick = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const idx = Math.floor(Math.random() * rows.length)
  return rows[idx] || null
}

/** ?symbol= と銘柄マスタ（東証は 1234.T、旧ティッカー BK→BNY 等）の表記ゆれを吸収 */
const candidateKeysForStockSymbolParam = (raw) => {
  const keys = canonicalStockSymbolKeys(raw)
  if (keys.length === 0) return []
  const out = [...keys]
  for (const u of keys) {
    if (/^\d{4,5}$/.test(u)) out.push(`${u}.T`)
    if (u.endsWith('.T')) {
      const base = u.slice(0, -2)
      if (base) out.push(base)
    }
  }
  return [...new Set(out)]
}

const resolveStockRowFromSymbolParam = (symbolParam, allStocks) => {
  const rows = Array.isArray(allStocks) ? allStocks : []
  for (const k of candidateKeysForStockSymbolParam(symbolParam)) {
    const hit = rows.find((row) => String(row.code || row.id || '').trim().toUpperCase() === k)
    if (hit) return hit
  }
  return null
}

const hashSeed = (str) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 시드가 같으면 같은 순열（탭・キー・銘柄集合が同じなら安定） */
const shuffleInPlaceSeeded = (arr, seedStr) => {
  let a = hashSeed(seedStr)
  const rand = () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const averageOf = (values) => {
  if (!Array.isArray(values) || values.length === 0) return null
  const nums = values.filter((value) => Number.isFinite(Number(value))).map((value) => Number(value))
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

const stdDevOf = (values) => {
  const avg = averageOf(values)
  if (!Number.isFinite(avg)) return null
  const nums = values.filter((value) => Number.isFinite(Number(value))).map((value) => Number(value))
  if (nums.length < 2) return null
  const variance = nums.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / nums.length
  return Math.sqrt(variance)
}

const calcMovingAverage = (rows, windowSize) => {
  const result = new Array(rows.length).fill(null)
  let rolling = 0
  let validCount = 0
  for (let i = 0; i < rows.length; i += 1) {
    const close = Number(rows[i]?.close)
    const isValid = Number.isFinite(close) && close > 0
    if (isValid) { rolling += close; validCount++ }
    if (i >= windowSize) {
      const old = Number(rows[i - windowSize]?.close)
      const wasValid = Number.isFinite(old) && old > 0
      if (wasValid) { rolling -= old; validCount-- }
    }
    // windowSize 個すべてが有効値のときだけ MA を確定する
    if (i >= windowSize - 1 && validCount === windowSize) {
      result[i] = Number((rolling / windowSize).toFixed(2))
    }
  }
  return result
}

/** 일본 EOD: marketstack + yfinance 만 조회. 일자별 dedupe 는 stockDailyHistory と同じルール */
const JP_EOD_SOURCES = ['marketstack', 'yfinance']

const normalizeHistoryRows = (rows = [], opts = {}) => {
  const mapRow = (row) => ({
    tradeDate: String(row.trade_date),
    open: Number.isFinite(Number(row.open)) ? Number(row.open) : null,
    high: Number.isFinite(Number(row.high)) ? Number(row.high) : null,
    low: Number.isFinite(Number(row.low)) ? Number(row.low) : null,
    close: Number(row.close),
    volume: Number.isFinite(Number(row.volume)) ? Number(row.volume) : null,
  })
  // JP/US ともに continuity + manual_close 優先（同日に marketstack と manual があるとき CSV 補正が効く）
  if (opts.jpSourceMerge) {
    return dedupeStockDailyPricesByTradeDate(rows, { mode: 'continuity' }).map(mapRow)
  }
  return dedupeStockDailyPricesByTradeDate(rows, { mode: 'continuity' }).map(mapRow)
}

const filterTrustedStockChartRows = (rows = []) =>
  rows.filter((r) => String(r.tradeDate || '') >= STOCK_CHART_TRUSTED_SINCE)

const chartHistoryCacheKey = (symbol, region) => {
  const s = String(symbol || '').trim()
  if (!s) return ''
  return region === 'JP' ? `${s}\0jp_cont_v8` : `${s}\0us_cont_v7`
}

const chunkSymbolsForInQuery = (symbols, chunkSize) => {
  const out = []
  for (let i = 0; i < symbols.length; i += chunkSize) {
    out.push(symbols.slice(i, i + chunkSize))
  }
  return out
}

/** PostgREST / Postgres が混雑・コールドキャッシュ時に返すタイムアウト（ログイン有無で RLS は同じでも負荷差で再現しうる） */
const isDbStatementTimeoutError = (err) => {
  const m = String(err?.message || err?.code || '')
  return /statement timeout|57014|canceling statement due to statement timeout/i.test(m)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const runSupabaseSelectWithRetry = async (run, { attempts = 2 } = {}) => {
  let last = null
  for (let i = 0; i < attempts; i += 1) {
    last = await run()
    if (!last?.error) return last
    if (i < attempts - 1 && isDbStatementTimeoutError(last.error)) {
      await sleep(500 * (i + 1))
      continue
    }
    break
  }
  return last
}

/** Profiles: was 100×N sequential round-trips; now up to PROFILE_PARALLEL requests at once. */
const fetchStockSymbolProfilesBatched = async (supabaseClient, symbols) => {
  const PROFILE_BATCH = 100
  /** v_stock_latest と並列実行時はピーク負荷を抑える */
  const PROFILE_PARALLEL = 3
  const batches = chunkSymbolsForInQuery(symbols, PROFILE_BATCH)
  const profileRows = []
  for (let i = 0; i < batches.length; i += PROFILE_PARALLEL) {
    const wave = batches.slice(i, i + PROFILE_PARALLEL)
    const results = await Promise.all(
      wave.map((batch) => runSupabaseSelectWithRetry(
        () => supabaseClient
          .from('stock_symbol_profiles')
          .select('symbol,sector,industry,name_jp,name_en,asset_type')
          .in('symbol', batch),
      )),
    )
    for (const r of results) {
      if (r.error) throw r.error
      profileRows.push(...(r.data || []))
    }
  }
  return profileRows
}

/** v_stock_latest: parallel waves (slightly more concurrency than before). */
const fetchStockLatestBatched = async (supabaseClient, symbols) => {
  const LATEST_BATCH = 60
  /** 母集団×重い view の同時スキャンを抑え、未ログイン時のタイムアウトを減らす */
  const LATEST_PARALLEL = 2
  const batches = chunkSymbolsForInQuery(symbols, LATEST_BATCH)
  const latestRows = []
  for (let i = 0; i < batches.length; i += LATEST_PARALLEL) {
    const wave = batches.slice(i, i + LATEST_PARALLEL)
    const results = await Promise.all(
      wave.map((batch) => runSupabaseSelectWithRetry(
        () => supabaseClient
          .from('v_stock_latest')
          .select('symbol,trade_date,open,high,low,close,volume')
          .in('symbol', batch),
      )),
    )
    for (const r of results) {
      if (r.error) throw r.error
      latestRows.push(...(r.data || []))
    }
  }
  return latestRows
}

const fetchStockSymbolsMetaBatched = async (supabaseClient, liveSymbols) => {
  const META_BATCH = 100
  const META_PARALLEL = 4
  const batches = chunkSymbolsForInQuery(liveSymbols, META_BATCH)
  const symbolRows = []
  for (let i = 0; i < batches.length; i += META_PARALLEL) {
    const wave = batches.slice(i, i + META_PARALLEL)
    const results = await Promise.all(
      wave.map((batch) => runSupabaseSelectWithRetry(
        () => supabaseClient
          .from('stock_symbols')
          .select('symbol,name,exchange')
          .in('symbol', batch),
      )),
    )
    for (const r of results) {
      if (r.error) throw r.error
      symbolRows.push(...(r.data || []))
    }
  }
  return symbolRows
}

const formatChartDateLabel = (tradeDate, timeframe) => {
  if (!tradeDate) return ''
  const date = new Date(`${tradeDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return tradeDate
  if (timeframe === '1D' || timeframe === '5D') {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  if (timeframe === 'YTD') {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  // 1Y は前年同日が混在しうるため、M/D だと重複してツールチップが別年を拾うことがある。
  // 年を含めてカテゴリを一意化する。
  if (timeframe === '1Y') {
    return `${String(date.getFullYear()).slice(-2)}/${date.getMonth() + 1}/${date.getDate()}`
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const calcReturnPct = (startClose, endClose) => {
  const start = Number(startClose)
  const end = Number(endClose)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null
  return ((end - start) / start) * 100
}

const formatSignedPct = (value) => {
  if (value == null || value === '') return '--'
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

const inferLiveRegion = (code, exchange) => {
  if (REGION_BY_SYMBOL[code]) return REGION_BY_SYMBOL[code]
  if (/^\d{4}$/.test(code || '')) return 'JP'
  if (/\.(XTKS|XJPX|TSE|JP)$/i.test(code || '')) return 'JP'
  if (/\.(L|LN)$/i.test(code)) return 'UK'
  if (/\.(PA|AS|DE|MI|MC|SW|BR|LS|ST|HE)$/i.test(code)) return 'EU'
  if (/tokyo|jpx|xtks|xjpx|tse|japan/i.test(exchange || '')) return 'JP'
  if (/london|lse/i.test(exchange || '')) return 'UK'
  if (/euronext|xetra|frankfurt|paris|amsterdam|milan|madrid|europe/i.test(exchange || '')) return 'EU'
  return 'US'
}

/**
 * stockMarketPageExtras（配列または VITE_STOCK_MARKET_PAGE_EXTRA_SYMBOLS）で明示した銘柄のうち、
 * 静的リストに無く v_stock_latest で有効終値がある US/JP のものだけ。
 */
const fetchMarketPageStockSymbolExtras = async (supabaseClient, staticSymbolSet, extraAllowlist) => {
  const rawSyms = [...new Set(
    (extraAllowlist || [])
      .map((s) => String(s || '').trim().toUpperCase())
      .filter(Boolean),
  )].filter(
    (sym) =>
      !staticSymbolSet.has(sym)
      && !ETF_SYMBOL_SET.has(sym)
      && !MARKETSTACK_BLOCKLIST_EXPORT.has(sym)
      && !isRetiredStockSymbol(sym),
  )
  if (rawSyms.length === 0) return []

  const metaRows = []
  const META_BATCH = 100
  for (let i = 0; i < rawSyms.length; i += META_BATCH) {
    const batch = rawSyms.slice(i, i + META_BATCH)
    const { data, error } = await runSupabaseSelectWithRetry(() =>
      supabaseClient.from('stock_symbols').select('symbol,name,exchange').in('symbol', batch),
    )
    if (error) throw error
    metaRows.push(...(data || []))
  }
  const metaBySym = new Map(metaRows.map((r) => [String(r.symbol || '').trim().toUpperCase(), r]))

  const candidates = []
  for (const sym of rawSyms) {
    const row = metaBySym.get(sym)
    const exchange = row?.exchange
    const region = inferLiveRegion(sym, exchange)
    if (region !== 'US' && region !== 'JP') continue
    candidates.push({
      symbol: sym,
      name: String(row?.name || '').trim() || sym,
      exchange,
      sector: '',
      region,
    })
  }
  if (candidates.length === 0) return []

  const syms = candidates.map((c) => c.symbol)
  const latestRows = await fetchStockLatestBatched(supabaseClient, syms)
  const ok = new Set(
    latestRows
      .filter((r) => {
        const c = Number(r.close)
        return Number.isFinite(c) && c > 0
      })
      .map((r) => String(r.symbol || '').trim().toUpperCase()),
  )
  return candidates.filter((c) => ok.has(c.symbol))
}

function applyStockProfilesToBaseMap(baseMap, profileRows) {
  const profileBySymbol = new Map(profileRows.map((r) => [r.symbol, r]))
  for (const [code, base] of baseMap) {
    const profile = profileBySymbol.get(code)
    if (profile) {
      const at = String(profile.asset_type || 'stock').trim().toLowerCase()
      const nameJp = String(profile.name_jp || getStockPageNameJa(code) || '').trim()
      const profileEn = String(profile.name_en || '').trim()
      const industryEn = String(profile.industry || '').trim()
      const nameEn = profileEn || (/[A-Za-z]/.test(industryEn) ? industryEn : '')
      baseMap.set(code, {
        ...base,
        ...(profile.sector && { sector: normalizeSectorName(profile.sector) }),
        ...(profile.industry && { industry: profile.industry }),
        ...(nameJp && { name_jp: nameJp }),
        ...(nameEn && { name_en: nameEn }),
        assetType: at === 'etf' ? 'etf' : 'stock',
      })
    } else {
      const nameJp = getStockPageNameJa(code)
      if (nameJp) baseMap.set(code, { ...base, name_jp: nameJp })
    }
  }
  for (const [code, base] of baseMap) {
    const ov = STOCK_SECTOR_OVERRIDE_BY_SYMBOL.get(code)
    if (ov) baseMap.set(code, { ...base, sector: ov })
  }
}

const normalizeIndexTag = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  if (['S&P500', 'SP500', 'SNP500'].includes(raw)) return 'SP500'
  if (['NASDAQ100', 'NASDAQ-100', 'NDX'].includes(raw)) return 'NASDAQ100'
  if (['NIKKEI225', 'NIKKEI-225', 'N225'].includes(raw)) return 'NIKKEI225'
  if (['FTSE100', 'FTSE-100'].includes(raw)) return 'FTSE100'
  if (['EUROSTOXX', 'EUROSTOXX50', 'STOXX50', 'SX5E'].includes(raw)) return 'EUROSTOXX'
  return raw
}

const normalizeAssetType = (value, symbol, sector) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'stock') return 'stock'
  if (raw === 'etf') return 'etf'
  if (ETF_SYMBOL_SET.has(symbol)) return 'etf'
  if (String(sector || '').toLowerCase().includes('etf')) return 'etf'
  return 'stock'
}

const formatHeatmapSizeValue = (value, currency = 'USD') => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '--'
  const unit = currency === 'JPY' ? '¥' : currency === 'USD' ? '$' : `${currency} `
  if (n >= 1_000_000_000_000) return `${unit}${(n / 1_000_000_000_000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}T`
  if (n >= 1_000_000_000) return `${unit}${(n / 1_000_000_000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}B`
  if (n >= 1_000_000) return `${unit}${(n / 1_000_000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}M`
  return `${unit}${Math.round(n).toLocaleString('ja-JP')}`
}

const toHeatmapNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Finviz風: 上昇=緑 / 下落=赤。|%|が大きいほど明るく、ほぼ0は暗いチャコール */
const getStockHeatmapTileColor = (changePct) => {
  const change = Number(changePct)
  if (!Number.isFinite(change) || Math.abs(change) < 0.12) {
    return 'rgb(31 41 55)'
  }
  const capped = Math.min(5.5, Math.abs(change))
  // 0%付近=暗い → ±4.5%以上でほぼ最大の明るさ
  const intensity = Math.min(1, capped / 4.5)
  const dark = change > 0
    ? { r: 6, g: 46, b: 22 }
    : { r: 69, g: 10, b: 10 }
  const bright = change > 0
    ? { r: 34, g: 197, b: 94 }
    : { r: 239, g: 68, b: 68 }
  const mix = {
    r: Math.round(dark.r + (bright.r - dark.r) * intensity),
    g: Math.round(dark.g + (bright.g - dark.g) * intensity),
    b: Math.round(dark.b + (bright.b - dark.b) * intensity),
  }
  return `rgb(${mix.r} ${mix.g} ${mix.b})`
}

const splitTreemapRects = (items, x = 0, y = 0, width = 100, height = 100) => {
  const validItems = Array.isArray(items)
    ? items.filter((item) => Number(item.weight) > 0)
    : []
  if (validItems.length === 0 || width <= 0 || height <= 0) return []
  if (validItems.length === 1) {
    return [{ ...validItems[0], x, y, width, height }]
  }

  const total = validItems.reduce((sum, item) => sum + Number(item.weight || 0), 0)
  const half = total / 2
  let running = 0
  let splitIndex = 1
  for (let i = 0; i < validItems.length - 1; i += 1) {
    const next = running + Number(validItems[i].weight || 0)
    if (Math.abs(half - next) <= Math.abs(half - running)) {
      running = next
      splitIndex = i + 1
    } else {
      break
    }
  }

  const first = validItems.slice(0, splitIndex)
  const second = validItems.slice(splitIndex)
  const firstWeight = first.reduce((sum, item) => sum + Number(item.weight || 0), 0)
  const ratio = total > 0 ? firstWeight / total : 0.5

  if (width >= height) {
    const firstWidth = width * ratio
    return [
      ...splitTreemapRects(first, x, y, firstWidth, height),
      ...splitTreemapRects(second, x + firstWidth, y, width - firstWidth, height),
    ]
  }

  const firstHeight = height * ratio
  return [
    ...splitTreemapRects(first, x, y, width, firstHeight),
    ...splitTreemapRects(second, x, y + firstHeight, width, height - firstHeight),
  ]
}

const pickBenchmarkByRegion = (rows, region) => {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const prefs = {
    US: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'],
    JP: ['1306.T', '7203.T', '6758.T', '8035.T', '9984.T'],
    UK: ['ISF.L', 'HSBA.L', 'HSBC', 'AZN.L', 'BP.L'],
    EU: ['VGK', 'ASML', 'SAP', 'SHEL', 'NVO'],
  }
  const ordered = prefs[region] || []
  for (const code of ordered) {
    const found = rows.find((r) => String(r.code || '').toUpperCase() === code.toUpperCase())
    if (found) return found
  }
  return rows[0] || null
}

const ActionButton = ({ icon: Icon, active, onClick, ariaLabel = 'action' }) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={onClick}
    className={`p-3 rounded-xl border transition ${
      active
        ? 'bg-orange-500 border-orange-500 text-white'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
    }`}
  >
    <Icon size={20} fill={active ? 'currentColor' : 'none'} />
  </button>
)

const SettingsBtn = () => (
  <button className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded">
    <ChevronDown size={14} className="text-slate-500" />
  </button>
)


export default function StockPage({ user = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [selectedRegion, setSelectedRegion] = useState('US')
  /** 米国/日本タブを押すたびに増やし、銘柄リストのシャッフル順を更新 */
  const [regionShuffleKey, setRegionShuffleKey] = useState(0)
  const [selectedSector, setSelectedSector] = useState('')
  const [heatmapSector, setHeatmapSector] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [timeframe, setTimeframe] = useState('1Y')
  const [selectedStock, setSelectedStock] = useState(null)
  const lastTrackedSearchRef = useRef('')
  /** ?symbol= から検索欄へ流し込んだ値（同じ param で入力を上書きし続けない） */
  const appliedSymbolParamRef = useRef('')
  const chartHistoryCacheRef = useRef(new Map())
  const [chartData, setChartData] = useState([])
  const [chartHistoryLoading, setChartHistoryLoading] = useState(false)
  const [chartHistoryError, setChartHistoryError] = useState('')
  const [watchlistHistoryBySymbol, setWatchlistHistoryBySymbol] = useState({})
  const [watchlist, setWatchlist] = useState([])
  const isLoggedIn = Boolean(user?.id)
  const authReturnPath = `${location.pathname}${location.search}`
  const promptLogin = () => {
    navigate('/login', {
      state: { from: authReturnPath },
    })
  }
  const openStockChangeAuthGate = () => {
    trackAnalyticsEvent('stock_change_auth_gate_open', { source: 'stock_page' })
    setStockChangeAuthGateOpen(true)
  }
  const requireLoginForStockChange = () => {
    if (isLoggedIn) return false
    openStockChangeAuthGate()
    return true
  }
  const handleRegionChange = (regionId) => {
    if (regionId === selectedRegion) return
    if (requireLoginForStockChange()) return
    heatmapAutoSectorRef.current = false
    setSelectedRegion(regionId)
    setSelectedSector('')
    setHeatmapSector('')
    setRegionShuffleKey((k) => k + 1)
  }
  const handleSectorChange = (sector) => {
    const next = String(sector || '')
    if (next === selectedSector) return
    if (requireLoginForStockChange()) return
    setSelectedSector(next)
  }
  const [liveStocks, setLiveStocks] = useState({ US: [] })
  const [fetchedDateLabel, setFetchedDateLabel] = useState(
    () => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  )
  const [marketLoading, setMarketLoading] = useState(true)
  const [marketHydrating, setMarketHydrating] = useState(false)
  const [marketError, setMarketError] = useState('')
  const [usingMockData, setUsingMockData] = useState(true)
  const [chartExpanded, setChartExpanded] = useState(false)
  const [chartDisplayMode, setChartDisplayMode] = useState('candle')
  const [xWindowSize, setXWindowSize] = useState(0)
  const [xWindowStart, setXWindowStart] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [threeMonthRateBySymbol, setThreeMonthRateBySymbol] = useState({})
  const [fiveDayRateBySymbol, setFiveDayRateBySymbol] = useState({})
  /** Supabase stock_page_company_news_briefs: display_cards 優先、無ければ brief_points で静的とマージ */
  const [aiCompanyBriefByRegion, setAiCompanyBriefByRegion] = useState(null)
  const [aiCompanyDisplayByRegion, setAiCompanyDisplayByRegion] = useState(null)
  const [stockHeatmapRows, setStockHeatmapRows] = useState([])
  const [stockHeatmapLoading, setStockHeatmapLoading] = useState(true)
  const [stockHeatmapError, setStockHeatmapError] = useState('')
  const [expandedSectors, setExpandedSectors] = useState({})
  const [showStockSelectorSheet, setShowStockSelectorSheet] = useState(false)
  const [showHeatmapFullscreen, setShowHeatmapFullscreen] = useState(false)
  const [stockChangeAuthGateOpen, setStockChangeAuthGateOpen] = useState(false)
  const [mobileHealthExpanded, setMobileHealthExpanded] = useState(false)
  const [isStockPending, startStockTransition] = useTransition()
  const chartInteractionRef = useRef(null)
  const chartSectionRef = useRef(null)
  const watchlistHydratedRef = useRef(false)
  const panRef = useRef({
    active: false,
    startClientX: 0,
    startWindowStart: 0,
    lastClientX: 0,
    lastTs: 0,
    velocityPointsPerMs: 0,
  })
  const inertiaRafRef = useRef(0)
  const heatmapAutoSectorRef = useRef(false)

  useEffect(() => {
    if (isLoggedIn) setStockChangeAuthGateOpen(false)
  }, [isLoggedIn])

  useEffect(() => {
    if (!['US', 'JP'].includes(selectedRegion)) {
      heatmapAutoSectorRef.current = false
      setSelectedRegion('US')
      setSelectedSector('')
      setHeatmapSector('')
    }
  }, [selectedRegion])

  useEffect(() => {
    if (!showHeatmapFullscreen || typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showHeatmapFullscreen])

  useEffect(() => {
    let cancelled = false
    const cancelSchedule = scheduleIdleTask(() => {
      if (cancelled) return
      const loadHeatmap = async () => {
        setStockHeatmapLoading(true)
        setStockHeatmapError('')
        try {
          const { data, error } = await supabase
            .from('v_stock_heatmap_latest')
            .select('symbol,name,region,sector,industry,asset_type,heatmap_priority,trade_date,close,market_cap_local,market_cap_local_currency,heatmap_size_value,heatmap_size_currency,intraday_change_pct')
            .eq('asset_type', 'STOCK')
            .limit(900)
          if (error) throw error
          if (cancelled) return
          const rows = (data || [])
            .map((row) => ({
              symbol: String(row.symbol || '').trim(),
              name: String(row.name || row.symbol || '').trim(),
              region: String(row.region || '').trim().toUpperCase(),
              sector: normalizeSectorName(row.sector || ''),
              industry: String(row.industry || '').trim(),
              heatmapPriority: Number(row.heatmap_priority ?? 9999),
              tradeDate: row.trade_date || null,
              close: toHeatmapNumber(row.close),
              marketCap: toHeatmapNumber(row.heatmap_size_value ?? row.market_cap_local),
              marketCapCurrency: String(row.heatmap_size_currency || row.market_cap_local_currency || '').trim().toUpperCase(),
              changePct: toHeatmapNumber(row.intraday_change_pct),
            }))
            .filter((row) => row.symbol && (row.region === 'US' || row.region === 'JP') && row.marketCap && row.marketCap > 0)
          setStockHeatmapRows(rows)
        } catch (err) {
          if (!cancelled) {
            setStockHeatmapRows([])
            setStockHeatmapError(err?.message || 'ヒートマップデータの取得に失敗しました。')
          }
        } finally {
          if (!cancelled) setStockHeatmapLoading(false)
        }
      }
      void loadHeatmap()
    }, { timeoutMs: 1200 })
    return () => {
      cancelled = true
      cancelSchedule()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const cancelSchedule = scheduleIdleTask(() => {
      if (cancelled) return
      const loadBriefs = async () => {
        try {
          const { data, error } = await supabase
            .from('stock_page_company_news_briefs')
            .select('region,brief_points,display_cards,updated_at')
          if (error || cancelled) return
          const briefMap = { US: [], JP: [] }
          const displayMap = { US: [], JP: [] }
          for (const row of data || []) {
            const r = String(row.region || '').toUpperCase()
            if (r === 'US' || r === 'JP') {
              briefMap[r] = Array.isArray(row.brief_points) ? row.brief_points : []
              displayMap[r] = Array.isArray(row.display_cards) ? row.display_cards : []
            }
          }
          if (!cancelled) {
            setAiCompanyBriefByRegion(briefMap)
            setAiCompanyDisplayByRegion(displayMap)
          }
        } catch {
          if (!cancelled) {
            setAiCompanyBriefByRegion(null)
            setAiCompanyDisplayByRegion(null)
          }
        }
      }
      void loadBriefs()
    }, { timeoutMs: 2800 })
    return () => {
      cancelled = true
      cancelSchedule()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let bulkHistoryTimer = null
    const loadLatestStocks = async () => {
      setMarketLoading(true)
      setMarketHydrating(true)
      setMarketError('')
      try {
        // StockPage は株式のみ表示。ETF/ファンドは除外し、US・JPのみを母集団にする。
        const staticTargetSymbols = [...new Set(
          STOCK_LIST_400
            .filter((item) => (item?.region === 'US' || item?.region === 'JP') && !ETF_SYMBOL_SET.has(item?.symbol) && !isUsListedEtfSymbol(item?.symbol, item?.name) && !MARKETSTACK_BLOCKLIST_EXPORT.has(item?.symbol) && !isRetiredStockSymbol(item?.symbol))
            .map((item) => item.symbol),
        )]
        if (staticTargetSymbols.length === 0) {
          setUsingMockData(false)
          setLiveStocks({ US: [] })
          setSelectedStock(null)
          setMarketError('株式リストが空です。')
          setMarketLoading(false)
          return
        }

        const baseList = STOCK_LIST_400
          .filter((item) => item?.symbol && (item.region === 'US' || item.region === 'JP') && !ETF_SYMBOL_SET.has(item.symbol) && !isUsListedEtfSymbol(item.symbol, item.name) && !MARKETSTACK_BLOCKLIST_EXPORT.has(item.symbol) && !isRetiredStockSymbol(item.symbol))
          .map((item, idx) => ({
            id: item.symbol,
            code: item.symbol,
            name: (item.name && item.name !== item.symbol) ? item.name : item.symbol,
            price: null,
            open: null,
            high: null,
            low: null,
            volume: null,
            tradeDate: null,
            change: 0,
            rate: 0,
            market: item.region || 'Market',
            sector: normalizeSectorName(item.sector),
            industry: '',
            priority: idx,
            region: item.region || 'US',
            indexTag: normalizeIndexTag(item.index_tag || ''),
            assetType: 'stock',
            news: null,
            hasLiveData: false,
          }))
        const baseMap = new Map(baseList.map((s) => [s.code, s]))

        const staticSymbolSet = new Set(staticTargetSymbols)
        const dbExtraRows = await fetchMarketPageStockSymbolExtras(
          supabase,
          staticSymbolSet,
          getStockMarketPageExtraSymbolList(),
        )
        let extraPi = 0
        for (const row of dbExtraRows) {
          if (baseMap.has(row.symbol)) continue
          baseMap.set(row.symbol, {
            id: row.symbol,
            code: row.symbol,
            name: row.name || row.symbol,
            price: null,
            open: null,
            high: null,
            low: null,
            volume: null,
            tradeDate: null,
            change: 0,
            rate: 0,
            market: row.region || 'Market',
            sector: normalizeSectorName(row.sector || ''),
            industry: '',
            priority: MARKET_PAGE_EXTRA_PRIORITY_BASE + extraPi,
            region: row.region || 'US',
            indexTag: '',
            assetType: 'stock',
            news: null,
            hasLiveData: false,
          })
          extraPi += 1
        }

        const targetSymbols = [...new Set([...staticTargetSymbols, ...dbExtraRows.map((r) => r.symbol)])]

        if (!cancelled) {
          const sortedBootstrap = [...baseMap.values()].sort(
            (a, b) => Number(a.priority ?? 9999) - Number(b.priority ?? 9999),
          )
          setLiveStocks({ US: sortedBootstrap })
          // Keep marketLoading true until prices merge; avoid showing $0 / wrong % on the hero.
        }

        // プロフィール・v_stock_latest・stock_symbols メタは別クエリのためワンショットで並列化。
        // （以前は latest 完了後にメタを await しており、サイドバーの価格表示が1段遅れた）
        const [profileRows, latestRows, symbolRows] = await Promise.all([
          fetchStockSymbolProfilesBatched(supabase, targetSymbols),
          fetchStockLatestBatched(supabase, targetSymbols),
          fetchStockSymbolsMetaBatched(supabase, targetSymbols),
        ])
        const symbolMap = new Map((symbolRows || []).map((s) => [s.symbol, s]))
        if (!cancelled) {
          applyStockProfilesToBaseMap(baseMap, profileRows)
          const sorted = [...baseMap.values()].sort(
            (a, b) => Number(a.priority ?? 9999) - Number(b.priority ?? 9999),
          )
          setLiveStocks({ US: sorted })
        }

        if (latestRows.length > 0) {

          for (const r of latestRows) {
            const base = baseMap.get(r.symbol)
            if (!base) continue
            const meta = symbolMap.get(r.symbol) || {}
            const open = toSafeLivePrice(r.open)
            const close = toSafeLivePrice(r.close)
            if (!close) continue
            const priceBase = open || close
            const change = close - priceBase
            const rate = priceBase > 0 ? (change / priceBase) * 100 : 0
            const highCandidate = toSafeLivePrice(r.high)
            const lowCandidate = toSafeLivePrice(r.low)
            const high = highCandidate != null ? Math.max(highCandidate, priceBase, close) : null
            const low = lowCandidate != null ? Math.min(lowCandidate, priceBase, close) : null
            const displayOverride = getDisplayNameOverride(r.symbol)
            const fallbackName = getStockNameFallback(r.symbol) || lookupDividendStockBySymbol(r.symbol)?.name
            const nameJp = String(base.name_jp || getStockPageNameJa(r.symbol) || '').trim()
            const nameEn = String(base.name_en || base.industry || '').trim()
            const jpEnJoined = (nameJp || nameEn)
              ? [nameJp, nameEn].filter(Boolean).join(' / ')
              : ''
            const displayName = displayOverride
              ? displayOverride
              : jpEnJoined
                ? resolveStockDisplayNameJaEn(r.symbol, jpEnJoined)
                : (meta.name && meta.name !== r.symbol)
                  ? resolveStockDisplayNameJaEn(r.symbol, meta.name)
                  : (base.name && base.name !== r.symbol)
                    ? resolveStockDisplayNameJaEn(r.symbol, base.name)
                    : (fallbackName && fallbackName !== r.symbol)
                      ? fallbackName
                      : r.symbol
            baseMap.set(r.symbol, {
              ...base,
              ...(nameJp && !base.name_jp ? { name_jp: nameJp } : {}),
              ...(nameEn && !base.name_en ? { name_en: nameEn } : {}),
              name: displayName,
              price: close,
              open: priceBase,
              high,
              low,
              volume: Number.isFinite(Number(r.volume)) ? Number(r.volume) : null,
              tradeDate: r.trade_date || null,
              change,
              rate,
              market: meta.exchange || base.market,
              news: `${r.symbol} の最新終値データ (${r.trade_date})`,
              hasLiveData: true,
            })
          }
          const maxTradeDate = latestRows.reduce((max, r) => {
            const d = String(r.trade_date || '').slice(0, 10)
            return d > max ? d : max
          }, '')
          if (maxTradeDate && !cancelled) {
            setFetchedDateLabel(formatEodDateLabelFromYmd(maxTradeDate))
          }
          setUsingMockData(false)
        } else {
          setMarketError('価格データがありません。')
          setUsingMockData(false)
          setLiveStocks({ US: [] })
          setSelectedStock(null)
          return
        }

        const merged = [...baseMap.values()].sort((a, b) => {
          // ライブデータがある銘柄を上に
          if (a.hasLiveData !== b.hasLiveData) return a.hasLiveData ? -1 : 1
          return Number(a.priority ?? 9999) - Number(b.priority ?? 9999)
        })
        /** リスト外ETFやDB上 etf の銘柄を株式一覧から除外（ファンドページ側で扱う） */
        const mergedStocksOnly = merged.filter((row) => String(row.assetType || 'stock').toLowerCase() !== 'etf')
        const latestBySymbol = new Map(mergedStocksOnly.map((row) => [row.code, Number(row.price || 0)]))
        const symbolRegionByCode = new Map(
          mergedStocksOnly.map((row) => [String(row.code || '').trim(), String(row.region || '')])
        )
        const symbolList = mergedStocksOnly
          .filter((row) => row.hasLiveData && ['US', 'JP'].includes(String(row.region || '')))
          .map((row) => row.code)
        setLiveStocks({ US: mergedStocksOnly })
        const candidatesLive = mergedStocksOnly.filter((s) => s.region === selectedRegion && s.hasLiveData)
        const candidatesRegion = mergedStocksOnly.filter((s) => s.region === selectedRegion)
        const urlSymbolRaw = typeof window !== 'undefined'
          ? String(new URLSearchParams(window.location.search).get('symbol') || '').trim()
          : ''
        const urlSymbolKey = normalizeStockSymbolForDb(urlSymbolRaw)
        let urlPick = null
        if (urlSymbolRaw && !isRetiredStockSymbol(urlSymbolKey)) {
          urlPick = resolveStockRowFromSymbolParam(urlSymbolKey, mergedStocksOnly)
        }
        const nextPick = urlPick
          || randomPick(candidatesLive)
          || randomPick(candidatesRegion)
          || randomPick(mergedStocksOnly)
        setSelectedStock(nextPick)
        if (urlPick?.region && ['US', 'JP'].includes(String(urlPick.region)) && String(urlPick.region) !== selectedRegion) {
          setSelectedRegion(String(urlPick.region))
        }

        // 遅延バッチ（3M/5D・前日比の再計算）より先に UI を開放。メインのスケルトンとセクター同期ロックが長く残ると体感的に壊れて見える。
        if (!cancelled) {
          setMarketLoading(false)
          setMarketHydrating(false)
        }

        // 全銘柄の 3M/5D 履歴はチャート・メイン価格取得と競合しやすいため、少し遅らせて実行
        bulkHistoryTimer = window.setTimeout(() => {
          if (cancelled) return
          ;(async () => {
          try {
            const cutoff = new Date()
            cutoff.setDate(cutoff.getDate() - 100)
            const cutoffStr = cutoff.toISOString().slice(0, 10)
            const historyBySymbol = await fetchStockDailyHistoryBySymbolMap(supabase, symbolList, cutoffStr, {
              select: 'symbol,trade_date,close,source,fetched_at',
              jpDedupe: true,
              jpSourceFilter: JP_EOD_SOURCES,
              jpChunkSize: 18,
              nonJpChunkSize: 42,
              parallelChunks: 8,
            })
            for (const sym of symbolList) {
              const rows = historyBySymbol.get(sym) || []
              if (rows.length > 160) historyBySymbol.set(sym, rows.slice(-160))
            }
            const threeMonthMap = Object.fromEntries(
              symbolList.map((symbol) => {
                const rows = [...(historyBySymbol.get(symbol) || [])]
                  .filter((row) => Number.isFinite(Number(row?.close)) && Number(row.close) > 0)
                  .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
                const firstRow = rows[0]
                const lastRow = rows[rows.length - 1]
                const firstClose = Number(firstRow?.close)
                const latestClose = Number(latestBySymbol.get(symbol))
                const firstDate = firstRow?.trade_date ? new Date(firstRow.trade_date) : null
                const lastDate = lastRow?.trade_date ? new Date(lastRow.trade_date) : null
                const spanDays = (firstDate && lastDate && Number.isFinite(firstDate.getTime()) && Number.isFinite(lastDate.getTime()))
                  ? Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
                  : 0
                const hasEnoughHistory = rows.length >= 20 && spanDays >= 45
                if (!hasEnoughHistory || !Number.isFinite(firstClose) || !Number.isFinite(latestClose) || firstClose <= 0) {
                  return [symbol, null]
                }
                return [symbol, returnPctFromIndex(rows, 0, latestClose)]
              })
            )
            const oneDayMap = Object.fromEntries(
              symbolList.map((symbol) => {
                const rows = [...(historyBySymbol.get(symbol) || [])]
                  .filter((row) => Number.isFinite(Number(row?.close)) && Number(row.close) > 0)
                  .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
                const latestClose = Number(latestBySymbol.get(symbol))
                const prevClose = rows.length >= 2 ? Number(rows[rows.length - 2]?.close) : null
                const rate = rows.length >= 2 ? returnPctFromIndex(rows, rows.length - 2, latestClose) : null
                if (!Number.isFinite(prevClose) || !Number.isFinite(latestClose) || prevClose <= 0 || rate == null) {
                  return [symbol, null]
                }
                const adjustedPrev = latestClose / (1 + rate / 100)
                return [symbol, {
                  previousClose: adjustedPrev,
                  change: latestClose - adjustedPrev,
                  rate,
                }]
              })
            )
            const fiveDayMap = Object.fromEntries(
              symbolList.map((symbol) => {
                const rows = historyBySymbol.get(symbol) || []
                const rate = tradingSessionReturnPct(rows, 5)
                return [symbol, rate]
              })
            )
            if (!cancelled) setThreeMonthRateBySymbol(threeMonthMap)
            if (!cancelled) setFiveDayRateBySymbol(fiveDayMap)
            if (!cancelled) {
              setLiveStocks((prev) => ({
                ...prev,
                US: (prev.US || []).map((stock) => {
                  const oneDay = oneDayMap[String(stock.code || stock.id || '')]
                  if (!oneDay) return stock
                  return {
                    ...stock,
                    change: Number(oneDay.change || 0),
                    rate: Number(oneDay.rate || 0),
                    previousClose: Number(oneDay.previousClose || 0),
                  }
                }),
              }))
              setSelectedStock((prev) => {
                if (!prev) return prev
                const oneDay = oneDayMap[String(prev.code || prev.id || '')]
                if (!oneDay) return prev
                return {
                  ...prev,
                  change: Number(oneDay.change || 0),
                  rate: Number(oneDay.rate || 0),
                  previousClose: Number(oneDay.previousClose || 0),
                }
              })
            }
          } catch {
            if (!cancelled) setThreeMonthRateBySymbol({})
            if (!cancelled) setFiveDayRateBySymbol({})
          }
          })()
        }, 1200)
      } catch (err) {
        setUsingMockData(true)
        const raw = String(err?.message || '')
        const friendly = /statement timeout|57014|canceling statement due to statement timeout/i.test(raw)
          ? 'データの取得がタイムアウトしました。通信状況を確認のうえ、しばらくしてから再読み込みしてください。'
          : (raw || 'データの読み込みに失敗しました')
        setMarketError(friendly)
        // DB 실패 시 STOCK_LIST_400 기반 목록만 표시（가격 없음）
        const fallbackList = STOCK_LIST_400
          .filter((item) => item?.symbol && (item.region === 'US' || item.region === 'JP') && !ETF_SYMBOL_SET.has(item.symbol) && !isUsListedEtfSymbol(item.symbol, item.name) && !isRetiredStockSymbol(item.symbol))
          .map((item, idx) => ({
            id: item.symbol,
            code: item.symbol,
            name: (item.name && item.name !== item.symbol) ? item.name : item.symbol,
            price: null,
            open: null,
            high: null,
            low: null,
            volume: null,
            tradeDate: null,
            change: 0,
            rate: 0,
            market: item.region || 'Market',
            sector: normalizeSectorName(item.sector),
            industry: '',
            priority: idx,
            region: item.region || 'US',
            indexTag: normalizeIndexTag(item.index_tag || ''),
            assetType: 'stock',
            news: null,
            hasLiveData: false,
          }))
        const sorted = fallbackList.sort((a, b) => Number(a.priority ?? 9999) - Number(b.priority ?? 9999))
        setLiveStocks({ US: sorted })
        const usFb = sorted.filter((s) => s.region === 'US')
        setSelectedStock(randomPick(usFb) || randomPick(sorted) || null)
        setThreeMonthRateBySymbol({})
        setFiveDayRateBySymbol({})
      } finally {
        setMarketLoading(false)
        setMarketHydrating(false)
      }
    }

    loadLatestStocks()
    return () => {
      cancelled = true
      if (bulkHistoryTimer != null) {
        window.clearTimeout(bulkHistoryTimer)
        bulkHistoryTimer = null
      }
    }
  }, [])

  const filteredStocks = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase().normalize('NFKC')
    const rows = (liveStocks.US || []).filter((s) => {
      if (isRetiredStockSymbol(s.code || s.id)) return false
      // 検索中はセクター絞り込みを外し、社名・ティッカー一致を優先
      const sectorOK = query || !selectedSector || s.sector === selectedSector
      if (!query) return s.region === selectedRegion && sectorOK
      const code = String(s.code || s.id || '')
      const fallback = getStockNameFallback(code) || ''
      const nameJa = getStockPageNameJa(code) || ''
      const searchStr = `${code} ${s.name || ''} ${s.name_jp || ''} ${s.name_en || ''} ${fallback} ${nameJa}`
        .toLowerCase()
        .normalize('NFKC')
      return sectorOK && searchStr.includes(query)
    })
    if (!query) return rows
    // 検索中は地域を跨いでヒットさせる（米国タブでも日本銘柄コードが拾える）
    const inRegion = rows.filter((s) => s.region === selectedRegion)
    return inRegion.length > 0 ? inRegion : rows
  }, [liveStocks, selectedRegion, selectedSector, deferredSearchQuery])

  const displayOrderedFilteredStocks = useMemo(() => {
    const arr = [...filteredStocks]
    if (arr.length <= 1) return arr
    const idKey = arr.map((s) => String(s.id || s.code || '')).sort().join('|')
    const seed = `${selectedRegion}|${regionShuffleKey}|${idKey}`
    return shuffleInPlaceSeeded(arr, seed)
  }, [filteredStocks, selectedRegion, regionShuffleKey])
  useEffect(() => {
    const symbolParamRaw = String(searchParams.get('symbol') || '').trim().toUpperCase()
    const symbolParam = normalizeStockSymbolForDb(symbolParamRaw)
    if (symbolParamRaw && symbolParam && symbolParam !== symbolParamRaw) {
      const next = new URLSearchParams(searchParams)
      next.set('symbol', symbolParam)
      const qs = next.toString()
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true })
      return
    }
    if (symbolParam && isRetiredStockSymbol(symbolParam)) {
      const next = new URLSearchParams(searchParams)
      next.delete('symbol')
      const qs = next.toString()
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true })
      return
    }
    const allStocks = liveStocks.US || []
    if (!symbolParam) {
      appliedSymbolParamRef.current = ''
      return
    }
    if (allStocks.length === 0) return
    const target = resolveStockRowFromSymbolParam(symbolParam, allStocks)
    if (!target) return
    if (selectedRegion !== target.region) setSelectedRegion(target.region)
    if (selectedStock?.id !== target.id) setSelectedStock(target)
    // 同じ ?symbol= では初回だけ検索欄へ反映。以後の入力をティッカーへ戻さない。
    if (appliedSymbolParamRef.current !== symbolParam) {
      appliedSymbolParamRef.current = symbolParam
      setSearchQuery(symbolParam)
    }
  }, [searchParams, liveStocks, selectedRegion, selectedStock?.id, navigate, location.pathname])
  const rankingUniverse = useMemo(
    () => (liveStocks.US || [])
      .filter((s) => s.region === selectedRegion && (!selectedSector || s.sector === selectedSector))
      .map((stock) => ({
        ...stock,
        fiveDayRate: fiveDayRateBySymbol[String(stock.code || stock.id || '')] ?? null,
      })),
    [liveStocks, selectedRegion, selectedSector, fiveDayRateBySymbol]
  )
  const groupedFilteredStocks = useMemo(() => {
    // 初回は静的リストの sector（米国は多くが「未分類」）で即表示し、DBの profiles 取得後に本番セクターへ差し替える。
    // その間だけセクター別にまとめると「未分類に500件」など誤解を招くので、同期中は1グループに畳む。
    if (marketHydrating) {
      const stocks = [...displayOrderedFilteredStocks].sort((a, b) => {
        const pa = Number(a.priority ?? 9999)
        const pb = Number(b.priority ?? 9999)
        if (pa !== pb) return pa - pb
        return String(a.code).localeCompare(String(b.code))
      })
      return [{
        sector: '__hydrating__',
        sectorLabel: '銘柄一覧（セクター同期中…）',
        stocks,
      }]
    }
    const groups = new Map()
    displayOrderedFilteredStocks.forEach((stock) => {
      const sector = normalizeSectorName(stock.sector)
      if (!groups.has(sector)) groups.set(sector, [])
      groups.get(sector).push(stock)
    })
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
      .map(([sector, stocks]) => ({
        sector,
        sectorLabel: sector,
        stocks,
      }))
  }, [displayOrderedFilteredStocks, marketHydrating])
  const allSectorsExpanded = useMemo(
    () => groupedFilteredStocks.every((group) => (
      expandedSectors[group.sector] ?? (group.sector === '__hydrating__')
    )),
    [groupedFilteredStocks, expandedSectors]
  )
  useEffect(() => {
    const searching = String(deferredSearchQuery || '').trim().length > 0
    setExpandedSectors((prev) => {
      const next = { ...prev }
      let changed = false
      groupedFilteredStocks.forEach((group) => {
        if (searching) {
          // 検索ヒットが折りたたみの中に隠れて「見つからない」ように見えるのを防ぐ
          if (next[group.sector] !== true) {
            next[group.sector] = true
            changed = true
          }
          return
        }
        if (next[group.sector] == null) {
          next[group.sector] = group.sector === '__hydrating__'
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [groupedFilteredStocks, deferredSearchQuery])

  useEffect(() => {
    if (marketLoading) return
    if (!selectedStock || selectedStock.region !== selectedRegion) {
      setSelectedStock(displayOrderedFilteredStocks[0] || null)
      return
    }
    // While searching, keep the user's explicit selection even if it is outside the filtered list.
    const hasActiveSearch = String(searchQuery || '').trim().length > 0
    if (!hasActiveSearch && !filteredStocks.some((s) => s.id === selectedStock.id)) {
      setSelectedStock(displayOrderedFilteredStocks[0] || null)
    }
  }, [selectedRegion, selectedSector, searchQuery, filteredStocks, displayOrderedFilteredStocks, selectedStock, marketLoading])

  useEffect(() => {
    let cancelled = false
    const symbol = String(selectedStock?.code || '').trim()
    const region = String(selectedStock?.region || '')
    const cacheKey = chartHistoryCacheKey(symbol, region)
    if (!symbol) {
      setChartData([])
      setChartHistoryError('')
      setChartHistoryLoading(false)
      return () => {
        cancelled = true
      }
    }

    const cached = chartHistoryCacheRef.current
    if (cached.has(cacheKey)) {
      const rows = Array.isArray(cached.get(cacheKey)) ? cached.get(cacheKey) : []
      const trustedRows = filterTrustedStockChartRows(rows)
      setChartData(rows)
      setChartHistoryError(trustedRows.length === 0 ? 'チャート履歴がありません。' : '')
      setChartHistoryLoading(false)
      return () => {
        cancelled = true
      }
    }

    const loadChartHistory = async () => {
      setChartHistoryLoading(true)
      setChartHistoryError('')
      try {
        const chartSelect = 'trade_date,open,high,low,close,volume,source,fetched_at'
        let q = supabase
          .from('stock_daily_prices')
          .select(chartSelect)
          .eq('symbol', symbol)
          .order('trade_date', { ascending: false })
          .limit(region === 'JP' ? CHART_HISTORY_LIMIT * 2 : CHART_HISTORY_LIMIT)
        if (region === 'JP') q = q.in('source', JP_EOD_SOURCES)
        const { data, error } = await q
        if (error) throw error
        const normalized = normalizeHistoryRows(data || [], { jpSourceMerge: region === 'JP' })
        const trusted = filterTrustedStockChartRows(normalized)
        cached.set(cacheKey, normalized)
        if (!cancelled) {
          setChartData(normalized)
          setChartHistoryError(trusted.length === 0 ? 'チャート履歴がありません。' : '')
        }
      } catch (err) {
        if (!cancelled) {
          setChartData([])
          setChartHistoryError(err?.message || 'チャート履歴の取得に失敗しました。')
        }
      } finally {
        if (!cancelled) setChartHistoryLoading(false)
      }
    }

    loadChartHistory()
    return () => {
      cancelled = true
    }
  }, [selectedStock?.code, selectedStock?.region])

  const displayedStock = selectedStock || displayOrderedFilteredStocks[0] || null
  const companyNewsRows = useMemo(() => {
    const dynamic = aiCompanyDisplayByRegion?.[selectedRegion]
    const isFullCard = (row) =>
      row
      && String(row.id || '').trim()
      && String(row.symbol || '').trim()
      && String(row.company || '').trim()
      && String(row.when || '').trim()
      && String(row.phase || '').trim()
    if (Array.isArray(dynamic) && dynamic.length > 0) {
      const seen = new Set()
      return dynamic.filter((row) => {
        if (!isFullCard(row)) return false
        const key = String(row.id)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    const withBriefs = mergeCompanyNewsWithAiBriefs(COMPANY_NEWS_BY_REGION, aiCompanyBriefByRegion)
    const merged = withBriefs[selectedRegion] || []
    const seen = new Set()
    return merged.filter((row) => {
      const key = `${row.symbol || ''}|${row.company || ''}|${row.when || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [selectedRegion, aiCompanyBriefByRegion, aiCompanyDisplayByRegion])

  const stockViewingTips = useMemo(() => {
    const code = String(displayedStock?.code || '').trim()
    const region = String(displayedStock?.region || selectedRegion || '')
    const sector = String(displayedStock?.sector || '').trim()
    const tradeRaw = displayedStock?.tradeDate
    const tradeDate = tradeRaw ? String(tradeRaw).slice(0, 10) : ''
    const hasLive = Boolean(displayedStock?.hasLiveData)
    const bullets = []
    if (hasLive && tradeDate) {
      bullets.push(`表示中の終値の営業日は ${tradeDate} です（参照用。公式の最新株価や約定値と一致しない場合があります）。`)
    } else if (code) {
      bullets.push('価格が「--」や更新が遅いときはデータ未取得の可能性があります。時間をおいて再読み込みするか、別銘柄で確認してください。')
    }
    if (region === 'JP') {
      bullets.push('日本株は円建て・国内取引時間の公式情報を優先してください。本ページは主に終値ベースの可視化であり、投資助言ではありません。')
    } else if (region === 'US') {
      bullets.push('米国株は米ドル建てです。政策・決算・時間外のニュースで翌営業日にギャップが出やすい点は、チャートと併せて意識すると整理しやすくなります。')
    }
    if (sector && sector !== '未分類') {
      bullets.push(`セクター「${sector}」: 左のセクターフィルタで同業比較すると、相対的な強弱を見つけやすくなります。`)
    }
    if (bullets.length === 0) {
      bullets.push('銘柄を選ぶと、その銘柄の市場（日本/米国）に合わせた読み方のヒントを表示します。')
    }
    bullets.push('開示・決算の内容確認は、各社IR・適時開示・証券会社の画面を最優先にしてください。')
    return { code, bullets }
  }, [displayedStock, selectedRegion])

  const maWindows = useMemo(() => ({
    shortWindow: 50,
    longWindow: 200,
  }), [])
  const chartSeries = useMemo(() => {
    if (!Array.isArray(chartData) || chartData.length === 0) return []
    const maShort = calcMovingAverage(chartData, maWindows.shortWindow)
    const maLong = calcMovingAverage(chartData, maWindows.longWindow)
    let lastFiniteMaShort = null
    let lastFiniteMaLong = null
    const isCloseOnlyOhlc = (o, h, l, c) => {
      if (!Number.isFinite(c) || c <= 0) return true
      // us_prices_1year.csv 等: close のみで open/high/low が 0 のプレースホルダ
      if (![o, h, l].every((v) => Number.isFinite(v) && v > 0)) return true
      const eps = Math.max(1e-6, Math.abs(c) * 1e-8)
      return Math.abs(h - l) <= eps && Math.abs(o - c) <= eps
    }
    return chartData.map((row, idx) => {
      const close = Number(row.close || 0)
      const prevClose = idx > 0
        ? Number(chartData[idx - 1]?.close || close)
        : close
      let open = Number(row.open)
      let high = Number(row.high)
      let low = Number(row.low)
      if (!Number.isFinite(open) || isCloseOnlyOhlc(open, high, low, close)) {
        open = prevClose
        high = Math.max(open, close)
        low = Math.min(open, close)
      } else {
        if (!Number.isFinite(high)) high = Math.max(open, close)
        if (!Number.isFinite(low)) low = Math.min(open, close)
      }
      const rawMaShort = maShort[idx]
      const rawMaLong = maLong[idx]
      const maShortValue = rawMaShort != null && Number.isFinite(rawMaShort) ? rawMaShort : lastFiniteMaShort
      const maLongValue = rawMaLong != null && Number.isFinite(rawMaLong) ? rawMaLong : lastFiniteMaLong
      if (Number.isFinite(maShortValue)) lastFiniteMaShort = maShortValue
      if (Number.isFinite(maLongValue)) lastFiniteMaLong = maLongValue
      return {
        ...row,
        open,
        high,
        low,
        close,
        trendUp: close >= prevClose,
        maShort: maShortValue,
        maLong: maLongValue,
      }
    })
  }, [chartData, maWindows])
  const timeframeChartSeries = useMemo(() => {
    if (!Array.isArray(chartSeries) || chartSeries.length === 0) return []
    const trustedRows = filterTrustedStockChartRows(chartSeries)
    let rows = trustedRows.length > 0 ? trustedRows : chartSeries
    if (timeframe === 'YTD') {
      const latestStr = rows[rows.length - 1]?.tradeDate
      const y =
        latestStr && String(latestStr).length >= 4
          ? String(latestStr).slice(0, 4)
          : String(new Date().getFullYear())
      const yearStartStr = `${y}-01-01`
      rows = rows.filter((row) => String(row.tradeDate || '') >= yearStartStr)
      if (rows.length === 0) rows = trustedRows.length > 0 ? trustedRows : chartSeries
    } else {
      const limit = TIMEFRAME_ROW_LIMITS[timeframe]
      if (limit) rows = rows.slice(-limit)
    }
    return rows.map((row) => ({
      ...row,
      xKey: row.tradeDate,
      time: formatChartDateLabel(row.tradeDate, timeframe),
    }))
  }, [chartSeries, timeframe])
  const visibleChartSeries = useMemo(() => {
    if (!Array.isArray(timeframeChartSeries) || timeframeChartSeries.length === 0) return []
    if (!Number.isFinite(xWindowSize) || xWindowSize <= 0 || xWindowSize >= timeframeChartSeries.length) {
      return timeframeChartSeries
    }
    const safeStart = Math.max(0, Math.min(xWindowStart, timeframeChartSeries.length - xWindowSize))
    return timeframeChartSeries.slice(safeStart, safeStart + xWindowSize)
  }, [timeframeChartSeries, xWindowSize, xWindowStart])
  const xWindowMaxStart = useMemo(() => {
    if (!Array.isArray(timeframeChartSeries) || timeframeChartSeries.length === 0) return 0
    const currentSize = xWindowSize > 0 ? xWindowSize : timeframeChartSeries.length
    return Math.max(0, timeframeChartSeries.length - currentSize)
  }, [timeframeChartSeries, xWindowSize])
  useEffect(() => {
    // Period tab should always start with full-range view.
    setXWindowSize(0)
    setXWindowStart(0)
  }, [timeframe, selectedStock?.id, timeframeChartSeries.length])
  const handleZoomIn = () => {
    const total = timeframeChartSeries.length
    if (total <= 0) return
    const currentSize = xWindowSize > 0 ? xWindowSize : total
    const minWindow = Math.min(total, 14)
    const nextSize = Math.max(minWindow, Math.floor(currentSize * 0.85))
    if (nextSize === currentSize) return
    const ratio = 0.5
    const currentStart = xWindowSize > 0 ? xWindowStart : 0
    const anchorIndex = currentStart + Math.round(currentSize * ratio)
    const maxStart = Math.max(0, total - nextSize)
    const nextStart = Math.max(0, Math.min(maxStart, Math.round(anchorIndex - (nextSize * ratio))))
    setXWindowSize(nextSize)
    setXWindowStart(nextStart)
  }
  const handleZoomOut = () => {
    const total = timeframeChartSeries.length
    if (total <= 0) return
    const currentSize = xWindowSize > 0 ? xWindowSize : total
    const nextSize = Math.min(total, Math.ceil(currentSize * 1.15))
    if (nextSize === currentSize) return
    if (nextSize >= total) {
      setXWindowSize(0)
      setXWindowStart(0)
      return
    }
    const ratio = 0.5
    const currentStart = xWindowSize > 0 ? xWindowStart : 0
    const anchorIndex = currentStart + Math.round(currentSize * ratio)
    const maxStart = Math.max(0, total - nextSize)
    const nextStart = Math.max(0, Math.min(maxStart, Math.round(anchorIndex - (nextSize * ratio))))
    setXWindowSize(nextSize)
    setXWindowStart(nextStart)
  }
  const handlePanLeft = () => {
    if (xWindowSize <= 0 || xWindowSize >= timeframeChartSeries.length) return
    const step = Math.max(1, Math.floor(xWindowSize * 0.15))
    setXWindowStart((prev) => Math.min(xWindowMaxStart, prev + step))
  }
  const handlePanRight = () => {
    if (xWindowSize <= 0 || xWindowSize >= timeframeChartSeries.length) return
    const step = Math.max(1, Math.floor(xWindowSize * 0.15))
    setXWindowStart((prev) => Math.max(0, prev - step))
  }
  const handlePanStart = (e) => {
    if (xWindowSize <= 0 || xWindowSize >= timeframeChartSeries.length) return
    if (inertiaRafRef.current) {
      cancelAnimationFrame(inertiaRafRef.current)
      inertiaRafRef.current = 0
    }
    const now = performance.now()
    panRef.current = {
      active: true,
      startClientX: e.clientX,
      startWindowStart: xWindowStart,
      lastClientX: e.clientX,
      lastTs: now,
      velocityPointsPerMs: 0,
    }
    setIsPanning(true)
  }
  const handlePanMove = (e) => {
    if (!panRef.current.active) return
    const container = chartInteractionRef.current
    if (!container) return
    const width = Math.max(1, container.clientWidth)
    const currentSize = Math.max(1, xWindowSize)
    const deltaX = e.clientX - panRef.current.startClientX
    const deltaPoints = Math.round((deltaX / width) * currentSize)
    const nextStart = Math.max(0, Math.min(xWindowMaxStart, panRef.current.startWindowStart - deltaPoints))
    setXWindowStart(nextStart)

    const now = performance.now()
    const dt = Math.max(1, now - panRef.current.lastTs)
    const moveDeltaX = e.clientX - panRef.current.lastClientX
    const moveDeltaPoints = -((moveDeltaX / width) * currentSize)
    panRef.current.velocityPointsPerMs = moveDeltaPoints / dt
    panRef.current.lastClientX = e.clientX
    panRef.current.lastTs = now
  }
  const handlePanEnd = () => {
    if (!panRef.current.active) return
    panRef.current.active = false
    setIsPanning(false)

    if (xWindowSize <= 0 || xWindowSize >= timeframeChartSeries.length) return
    let velocity = panRef.current.velocityPointsPerMs
    if (!Number.isFinite(velocity) || Math.abs(velocity) < 0.001) return

    let lastTs = performance.now()
    const step = (ts) => {
      const dt = Math.max(1, ts - lastTs)
      lastTs = ts
      velocity *= 0.93
      if (Math.abs(velocity) < 0.001) {
        inertiaRafRef.current = 0
        return
      }
      setXWindowStart((prev) => {
        const next = Math.max(0, Math.min(xWindowMaxStart, prev + velocity * dt))
        if (next === 0 || next === xWindowMaxStart) {
          velocity = 0
        }
        return next
      })
      inertiaRafRef.current = requestAnimationFrame(step)
    }
    inertiaRafRef.current = requestAnimationFrame(step)
  }
  useEffect(() => {
    window.addEventListener('mousemove', handlePanMove)
    window.addEventListener('mouseup', handlePanEnd)
    return () => {
      window.removeEventListener('mousemove', handlePanMove)
      window.removeEventListener('mouseup', handlePanEnd)
    }
  })
  useEffect(() => () => {
    if (inertiaRafRef.current) {
      cancelAnimationFrame(inertiaRafRef.current)
      inertiaRafRef.current = 0
    }
  }, [])
  const chartPriceDomain = useMemo(() => {
    if (!visibleChartSeries.length) return ['auto', 'auto']
    let low = Number.POSITIVE_INFINITY
    let high = Number.NEGATIVE_INFINITY
    visibleChartSeries.forEach((row) => {
      for (const key of ['open', 'high', 'low', 'close']) {
        const n = Number(row[key])
        if (!Number.isFinite(n) || n <= 0) continue
        low = Math.min(low, n)
        high = Math.max(high, n)
      }
    })
    if (!Number.isFinite(low) || !Number.isFinite(high)) return ['auto', 'auto']
    const range = Math.max(1, high - low)
    const pad = Math.max(0.5, range * 0.05)
    return [Number((low - pad).toFixed(2)), Number((high + pad).toFixed(2))]
  }, [visibleChartSeries])
  const chartHighLow = useMemo(() => {
    if (!visibleChartSeries.length) return { high: null, low: null }
    let high = Number.NEGATIVE_INFINITY
    let low = Number.POSITIVE_INFINITY
    visibleChartSeries.forEach((row) => {
      const close = Number(row.close)
      if (!Number.isFinite(close)) return
      high = Math.max(high, close)
      low = Math.min(low, close)
    })
    return {
      high: Number.isFinite(high) ? high : null,
      low: Number.isFinite(low) ? low : null,
    }
  }, [visibleChartSeries])
  const marketBreadth = useMemo(() => {
    const rising = filteredStocks.filter((s) => Number(s.rate) > 0).length
    const falling = filteredStocks.filter((s) => Number(s.rate) < 0).length
    const avgMove = filteredStocks.length
      ? filteredStocks.reduce((sum, s) => sum + Number(s.rate || 0), 0) / filteredStocks.length
      : 0
    return { rising, falling, avgMove }
  }, [filteredStocks])
  const marketTickerItems = useMemo(() => {
    const allRows = liveStocks.US || []
    if (!allRows.length) return DEFAULT_MARKET_TICKER
    const byRegion = {
      US: allRows.filter((s) => s.region === 'US'),
      JP: allRows.filter((s) => s.region === 'JP'),
    }
    const specs = [
      { id: 'US', label: '米国代表' },
      { id: 'JP', label: '日本代表' },
    ]
    return specs.map((spec) => {
      const target = pickBenchmarkByRegion(byRegion[spec.id], spec.id)
      if (!target) return { name: spec.label, value: 0, change: 0, region: spec.id }
      return {
        name: `${spec.label} ${target.code}`,
        company: target.name || target.code,
        value: Number(target.price || 0),
        change: Number(target.rate || 0),
        region: spec.id,
      }
    })
  }, [liveStocks])
  const stockByCode = useMemo(() => new Map(
    (liveStocks.US || []).map((stock) => [String(stock.code || stock.id || '').trim().toUpperCase(), stock])
  ), [liveStocks])
  const sectorOptions = useMemo(() => (
    [...new Set((liveStocks.US || [])
      .filter((s) => s.region === selectedRegion)
      .map((s) => s.sector)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'ja'))
  ), [liveStocks, selectedRegion])
  useEffect(() => {
    if (sectorOptions.length === 0) return
    if (heatmapSector && !sectorOptions.includes(heatmapSector)) {
      heatmapAutoSectorRef.current = false
      setHeatmapSector('')
      return
    }
    if (!heatmapSector && !heatmapAutoSectorRef.current) {
      const randomIndex = Math.floor(Math.random() * sectorOptions.length)
      heatmapAutoSectorRef.current = true
      setHeatmapSector(sectorOptions[randomIndex])
    }
  }, [sectorOptions, heatmapSector])
  const heatmapSectorGroups = useMemo(() => {
    const rows = stockHeatmapRows
      .filter((row) => row.region === selectedRegion)
      .filter((row) => !heatmapSector || normalizeSectorName(row.sector) === heatmapSector)
      .map((row) => {
        const stock = stockByCode.get(String(row.symbol || '').toUpperCase())
        const liveRate = toHeatmapNumber(stock?.rate)
        const changePct = liveRate ?? row.changePct ?? 0
        const name = stock?.name || row.name || row.symbol
        return {
          ...row,
          sector: normalizeSectorName(stock?.sector || row.sector || '未分類'),
          name,
          displayName: formatStockHeatmapLabel({
            symbol: row.symbol,
            stock,
            rowName: name,
            region: row.region,
          }),
          changePct,
          liveStock: stock || null,
        }
      })
      .filter((row) => row.marketCap > 0)
    const groups = new Map()
    rows.forEach((row) => {
      const sector = normalizeSectorName(row.sector || '未分類')
      if (!groups.has(sector)) groups.set(sector, [])
      groups.get(sector).push(row)
    })
    return [...groups.entries()]
      .map(([sector, items]) => {
        const sortedItems = items
          .sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0))
          .map((item) => ({ ...item }))
        return {
          sector,
          items: sortedItems,
          totalMarketCap: sortedItems.reduce((sum, item) => sum + Number(item.marketCap || 0), 0),
          avgChange: sortedItems.length
            ? sortedItems.reduce((sum, item) => sum + Number(item.changePct || 0), 0) / sortedItems.length
            : 0,
        }
      })
      .sort((a, b) => Number(b.totalMarketCap || 0) - Number(a.totalMarketCap || 0))
  }, [stockHeatmapRows, selectedRegion, heatmapSector, stockByCode])
  const heatmapSummary = useMemo(() => {
    const items = heatmapSectorGroups.flatMap((group) => group.items)
    return {
      count: items.length,
      rising: items.filter((item) => Number(item.changePct) > 0).length,
      falling: items.filter((item) => Number(item.changePct) < 0).length,
      totalMarketCap: items.reduce((sum, item) => sum + Number(item.marketCap || 0), 0),
      tradeDate: items
        .map((item) => String(item.tradeDate || ''))
        .filter(Boolean)
        .sort()
        .pop() || '',
      currency: items[0]?.marketCapCurrency || (selectedRegion === 'JP' ? 'JPY' : 'USD'),
    }
  }, [heatmapSectorGroups, selectedRegion])
  const heatmapTreemapGroups = useMemo(() => {
    const sectorRects = splitTreemapRects(
      heatmapSectorGroups.map((group) => ({
        key: group.sector,
        weight: Math.max(1, Number(group.totalMarketCap || 0)),
        group,
      }))
    )
    return sectorRects.map((sectorRect) => {
      const itemRects = splitTreemapRects(
        sectorRect.group.items.map((item) => ({
          key: item.symbol,
          weight: Math.max(1, Number(item.marketCap || 0)),
          item,
        })),
        0,
        0,
        100,
        100
      )
      return {
        ...sectorRect,
        itemRects,
      }
    })
  }, [heatmapSectorGroups])
  const topPerformers = useMemo(
    () => [...rankingUniverse]
      .filter((s) => Number.isFinite(Number(s.fiveDayRate)) && Number(s.fiveDayRate) > 0)
      .sort((a, b) => Number(b.fiveDayRate || 0) - Number(a.fiveDayRate || 0))
      .slice(0, 5),
    [rankingUniverse]
  )
  const topDecliners = useMemo(
    () => [...rankingUniverse]
      .filter((s) => Number.isFinite(Number(s.fiveDayRate)) && Number(s.fiveDayRate) < 0)
      .sort((a, b) => Number(a.fiveDayRate || 0) - Number(b.fiveDayRate || 0))
      .slice(0, 5),
    [rankingUniverse]
  )
  const watchlistRows = useMemo(
    () => (liveStocks.US || []).filter((s) => watchlist.includes(s.id)),
    [liveStocks, watchlist]
  )
  const watchlistSymbols = useMemo(
    () => [...new Set(watchlistRows.map((row) => String(row.code || '').trim()).filter(Boolean))],
    [watchlistRows]
  )
  useEffect(() => {
    if (marketLoading) return undefined
    let cancelled = false
    const missingSymbols = watchlistSymbols.filter((symbol) => watchlistHistoryBySymbol[symbol] == null)
    if (missingSymbols.length === 0) return () => {
      cancelled = true
    }

    const loadWatchlistHistories = async () => {
      try {
        const fetchedEntries = await Promise.all(missingSymbols.map(async (symbol) => {
          const row = watchlistRows.find((r) => String(r.code || '').trim() === symbol)
          const symRegion = String(row?.region || '')
          const cacheKey = chartHistoryCacheKey(symbol, symRegion)
          if (chartHistoryCacheRef.current.has(cacheKey)) {
            return [symbol, filterTrustedStockChartRows(chartHistoryCacheRef.current.get(cacheKey) || [])]
          }
          const wlSelect =
            symRegion === 'JP'
              ? 'trade_date,close,volume,source,fetched_at'
              : 'trade_date,close,volume,source,fetched_at'
          const wlLimit = symRegion === 'JP' ? CHART_HISTORY_LIMIT * 2 : CHART_HISTORY_LIMIT
          let q = supabase
            .from('stock_daily_prices')
            .select(wlSelect)
            .eq('symbol', symbol)
            .order('trade_date', { ascending: false })
            .limit(wlLimit)
          if (symRegion === 'JP') q = q.in('source', JP_EOD_SOURCES)
          const { data, error } = await q
          if (error) throw error
          const normalized = normalizeHistoryRows(data || [], { jpSourceMerge: symRegion === 'JP' })
          const trusted = filterTrustedStockChartRows(normalized)
          chartHistoryCacheRef.current.set(cacheKey, trusted)
          return [symbol, trusted]
        }))
        if (!cancelled) {
          setWatchlistHistoryBySymbol((prev) => ({
            ...prev,
            ...Object.fromEntries(fetchedEntries),
          }))
        }
      } catch {
        if (!cancelled) {
          setWatchlistHistoryBySymbol((prev) => {
            const next = { ...prev }
            missingSymbols.forEach((symbol) => {
              if (next[symbol] == null) next[symbol] = []
            })
            return next
          })
        }
      }
    }

    loadWatchlistHistories()
    return () => {
      cancelled = true
    }
  }, [marketLoading, watchlistSymbols, watchlistHistoryBySymbol])
  const watchlistHealthRows = useMemo(() => {
    const now = new Date()
    return watchlistRows.map((stock) => {
      const flags = []
      const symbol = String(stock.code || '')
      const historyRows = Array.isArray(watchlistHistoryBySymbol[symbol]) ? watchlistHistoryBySymbol[symbol] : []
      const absRate = Math.abs(Number(stock.rate || 0))
      const latestClose = Number(stock.price)
      const ma20Series = calcMovingAverage(historyRows, 20)
      const ma50Series = calcMovingAverage(historyRows, 50)
      const ma20 = ma20Series[ma20Series.length - 1]
      const ma50 = ma50Series[ma50Series.length - 1]
      const recentReturns = historyRows
        .slice(-21)
        .map((row, idx, arr) => {
          if (idx === 0) return null
          const prev = Number(arr[idx - 1]?.close)
          const cur = Number(row?.close)
          if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0) return null
          return ((cur - prev) / prev) * 100
        })
        .filter((value) => Number.isFinite(value))
      const dailyVolatility = stdDevOf(recentReturns)
      const recentVolumes = historyRows
        .slice(-20)
        .map((row) => Number(row?.volume))
        .filter((value) => Number.isFinite(value) && value > 0)
      const avg20Volume = averageOf(recentVolumes)
      const latestVolume = Number(stock.volume)
      const volumeRatio20d = Number.isFinite(avg20Volume) && avg20Volume > 0 && Number.isFinite(latestVolume) && latestVolume > 0
        ? latestVolume / avg20Volume
        : null
      if (stock.price == null) flags.push({ id: 'nodata', label: '価格未取得', tone: 'neutral' })
      if (historyRows.length < 20) flags.push({ id: 'history', label: '履歴不足', tone: 'neutral' })
      if (Number.isFinite(dailyVolatility) && absRate >= Math.max(2.5, dailyVolatility * 2)) {
        flags.push({ id: 'move', label: `通常比変動拡大 ${formatSignedPct(stock.rate)}`, tone: 'warn' })
      }
      if (Number.isFinite(volumeRatio20d) && volumeRatio20d >= 1.8) {
        flags.push({ id: 'volume', label: `出来高 ${volumeRatio20d.toFixed(1)}x`, tone: 'warn' })
      }
      if (Number.isFinite(latestClose) && Number.isFinite(ma20) && latestClose < ma20) {
        flags.push({ id: 'ma20', label: '終値がMA20下', tone: 'neutral' })
      }
      if (Number.isFinite(latestClose) && Number.isFinite(ma50) && latestClose < ma50) {
        flags.push({ id: 'ma50', label: '終値がMA50下', tone: 'neutral' })
      }
      if (Number.isFinite(latestClose) && Number.isFinite(ma20) && Number.isFinite(ma50) && latestClose < ma20 && ma20 < ma50) {
        flags.push({ id: 'trend', label: '短中期トレンド弱含み', tone: 'warn' })
      }
      if (stock.tradeDate) {
        const tradeDate = new Date(stock.tradeDate)
        if (!Number.isNaN(tradeDate.getTime())) {
          const staleDays = Math.floor((now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60 * 24))
          if (staleDays >= 3) flags.push({ id: 'stale', label: `更新遅延 ${staleDays}日`, tone: 'neutral' })
        }
      }
      const alertCount = flags.filter((f) => f.tone === 'warn').length
      return {
        stock,
        flags,
        alertCount,
        meta: {
          dailyVolatility,
          volumeRatio20d,
          ma20,
          ma50,
        },
      }
    }).sort((a, b) => b.alertCount - a.alertCount)
  }, [watchlistRows, watchlistHistoryBySymbol])
  const watchlistHealthSummary = useMemo(() => {
    const warn = watchlistHealthRows.filter((r) => r.alertCount >= 2).length
    const caution = watchlistHealthRows.filter((r) => r.alertCount === 1).length
    const stable = watchlistHealthRows.filter((r) => r.alertCount === 0).length
    return { warn, caution, stable, total: watchlistHealthRows.length }
  }, [watchlistHealthRows])

  const todayInsightText = useMemo(() => {
    if (!displayedStock) return '銘柄データを確認中です。'
    const moveLabel = displayedStock.rate >= 0 ? '上昇' : '下落'
    const strongest = [...filteredStocks]
      .sort((a, b) => Number(b.rate || 0) - Number(a.rate || 0))[0]
    const weakest = [...filteredStocks]
      .sort((a, b) => Number(a.rate || 0) - Number(b.rate || 0))[0]
    const breadthTone = marketBreadth.rising >= marketBreadth.falling ? '買い優勢' : '売り優勢'
    const strongestTxt = strongest
      ? `上位は ${strongest.name || strongest.code} ${strongest.code} (${Number(strongest.rate || 0).toFixed(2)}%)`
      : '上位銘柄データなし'
    const weakestTxt = weakest
      ? `下位は ${weakest.name || weakest.code} ${weakest.code} (${Number(weakest.rate || 0).toFixed(2)}%)`
      : '下位銘柄データなし'
    return `${displayedStock.name || displayedStock.code} ${displayedStock.code} は ${Math.abs(displayedStock.rate).toFixed(2)}% ${moveLabel}。${breadthTone}（上昇${marketBreadth.rising}/下落${marketBreadth.falling}）、${strongestTxt}、${weakestTxt}。`
  }, [displayedStock, filteredStocks, marketBreadth])
  const updatedDateLabel = fetchedDateLabel
  const selectedHistorySummary = useMemo(() => {
    if (!Array.isArray(chartSeries) || chartSeries.length === 0) return null
    const latestRow = chartSeries[chartSeries.length - 1]
    const prevRow = chartSeries.length > 1 ? chartSeries[chartSeries.length - 2] : null
    const latestClose = Number(latestRow?.close)
    const prevClose = Number(prevRow?.close)
    const dayRate = tradingSessionReturnPct(chartSeries, TRADING_SESSION_OFFSETS.DAY)
    const adjustedPrev = dayRate != null && Number.isFinite(latestClose)
      ? latestClose / (1 + dayRate / 100)
      : prevClose
    const dayChange = Number.isFinite(adjustedPrev) && Number.isFinite(latestClose)
      ? latestClose - adjustedPrev
      : 0
    const return1m = tradingSessionReturnPct(chartSeries, TRADING_SESSION_OFFSETS.ONE_MONTH)
    const return3m = tradingSessionReturnPct(chartSeries, TRADING_SESSION_OFFSETS.THREE_MONTH)
    const return6m = tradingSessionReturnPct(chartSeries, TRADING_SESSION_OFFSETS.SIX_MONTH)
    const return1y = tradingSessionReturnPct(chartSeries, TRADING_SESSION_OFFSETS.ONE_YEAR)
    const ytdBaseRow = findYtdBaseRowFromSeries(chartSeries)
    const ytdIndex = ytdBaseRow ? chartSeries.lastIndexOf(ytdBaseRow) : -1
    const returnYtd = ytdIndex >= 0 ? returnPctFromIndex(chartSeries, ytdIndex, latestClose) : null
    const recentVolumes = chartSeries
      .slice(-20)
      .map((row) => Number(row.volume))
      .filter((value) => Number.isFinite(value) && value > 0)
    const avg20Volume = recentVolumes.length > 0
      ? recentVolumes.reduce((sum, value) => sum + value, 0) / recentVolumes.length
      : null
    const latestVolume = Number(displayedStock?.volume ?? latestRow?.volume)
    const volumeRatio20d = Number.isFinite(avg20Volume) && avg20Volume > 0 && Number.isFinite(latestVolume) && latestVolume > 0
      ? latestVolume / avg20Volume
      : null
    const rawMa50 = latestRow?.maShort
    const rawMa200 = latestRow?.maLong
    const ma50 = rawMa50 != null && Number.isFinite(rawMa50) ? rawMa50 : null
    const ma200 = rawMa200 != null && Number.isFinite(rawMa200) ? rawMa200 : null
    return {
      historyPoints: chartSeries.length,
      latestClose: Number.isFinite(latestClose) ? latestClose : null,
      prevClose: Number.isFinite(prevClose) ? prevClose : null,
      dayChange,
      dayRate: dayRate ?? 0,
      return1m,
      return3m,
      return6m,
      returnYtd,
      return1y,
      avg20Volume,
      volumeRatio20d,
      ma50,
      ma200,
      aboveMa50: Number.isFinite(ma50) ? latestClose >= ma50 : null,
      aboveMa200: Number.isFinite(ma200) ? latestClose >= ma200 : null,
    }
  }, [chartSeries, displayedStock?.volume])
  const activePerformanceSummary = useMemo(() => {
    if (!Array.isArray(chartSeries) || chartSeries.length === 0) return null
    const latestRow = chartSeries[chartSeries.length - 1]
    const latestClose = Number(latestRow?.close)
    if (!Number.isFinite(latestClose) || latestClose <= 0) return null

    const buildMetric = (baseRow, label) => {
      const baseClose = Number(baseRow?.close)
      if (!Number.isFinite(baseClose) || baseClose <= 0) return null
      const baseIdx = chartSeries.lastIndexOf(baseRow)
      const rate = baseIdx >= 0
        ? returnPctFromIndex(chartSeries, baseIdx, latestClose)
        : calcReturnPct(baseClose, latestClose)
      if (rate == null) return null
      const adjustedBase = latestClose / (1 + rate / 100)
      return {
        label,
        baseClose: adjustedBase,
        change: latestClose - adjustedBase,
        rate,
        baseTradeDate: baseRow?.tradeDate || null,
        latestClose,
      }
    }

    if (timeframe === '1D') {
      const base = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.DAY)
      return buildMetric(base?.row ?? (chartSeries.length > 1 ? chartSeries[chartSeries.length - 2] : latestRow), '前営業日比')
    }
    if (timeframe === '5D') {
      const base = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.FIVE_D)
      return buildMetric(base?.row ?? chartSeries[0], '5営業日基準')
    }
    if (timeframe === '1M') {
      const base = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.ONE_MONTH)
      return buildMetric(base?.row ?? chartSeries[0], '1カ月基準')
    }
    if (timeframe === '3M') {
      const base = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.THREE_MONTH)
      return buildMetric(base?.row ?? chartSeries[0], '3カ月基準')
    }
    if (timeframe === '6M') {
      const base = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.SIX_MONTH)
      return buildMetric(base?.row ?? chartSeries[0], '6カ月基準')
    }
    if (timeframe === 'YTD') {
      const baseRow = findYtdBaseRowFromSeries(chartSeries)
      return buildMetric(baseRow || chartSeries[0], '年初来基準')
    }
    if (timeframe === '1Y') {
      const base = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.ONE_YEAR)
      return buildMetric(base?.row ?? chartSeries[0], '1年基準')
    }
    const base = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.DAY)
    return buildMetric(base?.row ?? (chartSeries.length > 1 ? chartSeries[chartSeries.length - 2] : latestRow), '前営業日比')
  }, [chartSeries, timeframe])
  const chartColor = useMemo(() => {
    const rate = Number(activePerformanceSummary?.rate ?? displayedStock?.rate ?? 0)
    return rate >= 0 ? MARKET_UP_HEX : MARKET_DOWN_HEX
  }, [activePerformanceSummary?.rate, displayedStock?.rate])
  const chartVolumeReady = useMemo(() => (
    Array.isArray(visibleChartSeries)
    && visibleChartSeries.some((row) => Number.isFinite(Number(row.volume)) && Number(row.volume) > 0)
  ), [visibleChartSeries])
  const chartVolumeMeta = useMemo(() => {
    if (!Array.isArray(visibleChartSeries) || visibleChartSeries.length === 0) return null
    const withVol = visibleChartSeries.filter((row) => Number.isFinite(Number(row.volume)) && Number(row.volume) > 0)
    if (withVol.length === 0) return null
    const firstDate = withVol[0]?.tradeDate || null
    const pct = Math.round((withVol.length / visibleChartSeries.length) * 1000) / 10
    return { firstDate, pct, count: withVol.length, total: visibleChartSeries.length }
  }, [visibleChartSeries])

  const toggleWatch = (id, meta = {}) => {
    if (!id) return
    if (!isLoggedIn) {
      promptLogin()
      return
    }
    setWatchlist((prev) => {
      const wasOn = prev.includes(id)
      const sym = String(meta.symbol || meta.code || id)
      const label = String(meta.product_name || meta.name || sym)
      if (wasOn) {
        trackAnalyticsEvent('stock_watchlist_remove', {
          symbol: sym,
          item_id: id,
          product_id: sym,
          product_name: label,
          product_type: 'stock',
        })
      } else {
        trackAnalyticsEvent('stock_watchlist_add', {
          symbol: sym,
          item_id: id,
          product_id: sym,
          product_name: label,
          product_type: 'stock',
        })
      }
      const next = wasOn ? prev.filter((x) => x !== id) : [...prev, id]
      const uid = user?.id ?? null
      if (uid) {
        const op = wasOn
          ? removeDbWatchlistItem({ userId: uid, itemType: 'stock', itemId: id })
          : addDbWatchlistItem({
            userId: uid,
            itemType: 'stock',
            itemId: id,
            itemName: label,
          })
        op.then(() => bumpStockWatchlistSyncVersion()).catch(() => {})
      } else {
        try {
          window.localStorage.setItem(getStockWatchlistStorageKey(null), JSON.stringify(next))
          bumpStockWatchlistSyncVersion()
        } catch {
          // ignore storage failures
        }
      }
      return next
    })
  }
  const toggleSectorExpanded = (sector) => {
    setExpandedSectors((prev) => {
      const cur = prev[sector] ?? (sector === '__hydrating__')
      return { ...prev, [sector]: !cur }
    })
  }
  const toggleAllSectorsExpanded = () => {
    setExpandedSectors((prev) => {
      const next = { ...prev }
      groupedFilteredStocks.forEach((group) => {
        next[group.sector] = !allSectorsExpanded
      })
      return next
    })
  }
  const handleSelectStock = (stock) => {
    if (!stock?.id) return
    if (selectedStock?.id === stock.id) return
    if (requireLoginForStockChange()) return
    trackAnalyticsEvent('stock_select', {
      product_type: 'stock',
      product_id: stock.id,
      product_name: stock.name || stock.company || stock.id,
      region: stock.region || selectedRegion,
      source: 'stock_page',
    })
    startStockTransition(() => {
      setSelectedStock(stock)
    })
  }

  useEffect(() => {
    const query = String(searchQuery || '').trim()
    if (query.length < 2) return undefined

    const timer = window.setTimeout(() => {
      const signature = `${selectedRegion}::${selectedSector}::${query.toLowerCase()}::${filteredStocks.length}`
      if (lastTrackedSearchRef.current === signature) return
      lastTrackedSearchRef.current = signature
      trackAnalyticsEvent('search', {
        surface: 'stock_page',
        query,
        result_count: filteredStocks.length,
        region: selectedRegion,
        sector: selectedSector || '',
      })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [searchQuery, filteredStocks.length, selectedRegion, selectedSector])
  useEffect(() => {
    watchlistHydratedRef.current = false
    let cancelled = false
    const uid = user?.id ?? null
    const run = async () => {
      if (!uid) {
        const loaded = loadStoredStockWatchlist(null)
        if (!cancelled) {
          setWatchlist(loaded)
          watchlistHydratedRef.current = true
        }
        return
      }
      try {
        const { symbols, available } = await loadStockWatchlistSymbolsFromDb(uid)
        if (cancelled) return
        if (available) {
          if (symbols.length > 0) {
            setWatchlist(symbols)
            try {
              window.localStorage.removeItem(getStockWatchlistStorageKey(uid))
            } catch {
              // ignore
            }
            watchlistHydratedRef.current = true
            return
          }
          const legacy = loadStoredStockWatchlist(uid)
          if (legacy.length > 0) {
            try {
              await mergeStockWatchlistSymbolsInDb({ userId: uid, symbols: legacy })
              if (!cancelled) {
                setWatchlist(legacy)
                try {
                  window.localStorage.removeItem(getStockWatchlistStorageKey(uid))
                } catch {
                  // ignore
                }
              }
            } catch {
              if (!cancelled) setWatchlist(legacy)
            }
            watchlistHydratedRef.current = true
            return
          }
          if (!cancelled) setWatchlist([])
          watchlistHydratedRef.current = true
          return
        }
      } catch {
        // fall through to local
      }
      const loaded = loadStoredStockWatchlist(uid)
      if (!cancelled) {
        setWatchlist(loaded)
        watchlistHydratedRef.current = true
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white font-sans pb-20">
      <div className="max-w-[1400px] mx-auto px-4 pt-4">
        <div className="bg-slate-900 dark:bg-black text-white rounded-2xl border border-slate-700 shadow-md overflow-hidden">
          <div className="py-3 overflow-hidden whitespace-nowrap">
            <div className="inline-flex animate-ticker-stock items-center gap-10 pl-4 pr-16 min-w-max">
              {[...marketTickerItems, ...marketTickerItems, ...marketTickerItems].map((idx, i) => {
                const hasPrice = Number(idx.value) > 0
                return (
                  <span key={`${idx.name}-${i}`} className="flex items-center gap-2 text-xs md:text-sm shrink-0">
                    <span className="text-slate-300 font-black">{idx.name}</span>
                    {idx.company && <span className="text-slate-400 font-bold">{idx.company}</span>}
                    <span className={`font-bold ${hasPrice ? signedReturnTextClassOnDarkPanel(idx.change) : 'text-slate-500'}`}>
                      {hasPrice
                        ? `${formatCurrency(idx.value, idx.region || 'US')} ${idx.change >= 0 ? '▲' : '▼'} ${Math.abs(Number(idx.change || 0)).toFixed(2)}%`
                        : '価格データなし'}
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 pt-3">
        <MarketDataEodFreshnessNote variant="stock" />
      </div>

      <div className="max-w-[1400px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="hidden lg:order-1 lg:col-span-2 lg:block space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {[
              { id: 'US', label: '🇺🇸 米国' },
              { id: 'JP', label: '🇯🇵 日本' },
            ].map((r) => {
              const count = (liveStocks.US || []).filter((s) => s.region === r.id).length
              return (
                <button
                  key={r.id}
                  onClick={() => handleRegionChange(r.id)}
                  className={`flex-1 px-2 py-1 text-[11px] font-bold rounded-lg transition ${
                    selectedRegion === r.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {r.label} ({count})
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            合計 {(liveStocks.US || []).length} 銘柄（米国 {(liveStocks.US || []).filter((s) => s.region === 'US').length} / 日本 {(liveStocks.US || []).filter((s) => s.region === 'JP').length}）
          </p>

          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">セクター</label>
            <select
              value={selectedSector}
              onChange={(e) => handleSectorChange(e.target.value)}
              disabled={marketHydrating}
              title={marketHydrating ? 'セクターはプロフィール同期後に有効になります' : undefined}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-2.5 text-[11px] font-bold text-slate-900 dark:text-white focus:border-orange-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">全て</option>
              {sectorOptions.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="銘柄コード・社名検索"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-3 text-[11px] font-bold focus:border-orange-500 outline-none transition"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          </div>

              {marketHydrating && <p className="text-xs text-slate-500 dark:text-slate-400">最新データを読み込み中...</p>}
          {marketError && (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-amber-400">{marketError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-[10px] font-bold px-2 py-1 rounded border border-amber-400 text-amber-400 hover:bg-amber-400/10 transition"
              >
                再読み込み
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="p-2.5 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex justify-between items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap shrink-0">
                {marketHydrating ? '銘柄一覧（同期後にセクター別）' : '銘柄一覧（セクター別）'}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={toggleAllSectorsExpanded}
                  className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap leading-tight"
                >
                  {allSectorsExpanded ? '全て折りたたむ' : '全て展開'}
                </button>
                <SettingsBtn />
              </div>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {groupedFilteredStocks.map((group) => (
                <div key={group.sector} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                  <button
                    type="button"
                    onClick={() => toggleSectorExpanded(group.sector)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black tracking-wide text-slate-500 dark:text-slate-300 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  >
                    <span>{group.sectorLabel} ({group.stocks.length})</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${(expandedSectors[group.sector] ?? (group.sector === '__hydrating__')) ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {(expandedSectors[group.sector] ?? (group.sector === '__hydrating__')) && group.stocks.map((stock) => (
                    <div
                      key={stock.id}
                      onClick={() => handleSelectStock(stock)}
                      className={`p-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition flex justify-between items-center ${displayedStock?.id === stock.id ? 'bg-orange-50 dark:bg-white/10 border-l-4 border-orange-500' : ''}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-orange-500 shrink-0">{stock.code}</span>
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{formatStockJaEnListLabel(stock)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{stock.industry || stock.market || 'Market'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-[11px]">
                          {stock.price != null ? formatCurrency(stock.price, stock.region) : <span className="text-slate-400 dark:text-slate-600 text-xs">--</span>}
                        </div>
                        <div className={`text-[10px] font-bold ${signedReturnTextClassTri(stock.rate, 'text-slate-400 dark:text-slate-500')}`}>
                          {stock.price != null ? `${stock.rate > 0 ? '+' : ''}${stock.rate.toFixed(2)}%` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {filteredStocks.length === 0 && (
                <div className="p-4 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {String(searchQuery || '').trim()
                    ? '検索に一致する銘柄がありません'
                    : 'この地域の銘柄データはまだありません'}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <MembersBlurGate
              isLoggedIn={isLoggedIn}
              returnPath={authReturnPath}
              label="騰落率ランキングはログイン後に表示されます"
              hint="無料登録で上昇・下落 Top 5 をご覧いただけます。"
              overlayRoundedClass="rounded-xl"
            >
              <div className="grid grid-cols-1 gap-2">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
              <div className="flex items-center justify-between mb-1.5 gap-1.5">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">上昇率 Top 5</p>
                <span className="rounded-full border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-black text-slate-500 dark:text-slate-400">
                  5営業日基準
                </span>
              </div>
              <div className="space-y-1">
                {topPerformers.map((stock) => (
                  <button
                    key={`top-${stock.id}`}
                    onClick={() => handleSelectStock(stock)}
                    className="w-full flex items-center justify-between rounded-lg px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                  >
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{formatStockJaEnListLabel(stock)}</span>
                    <span className="text-[11px] font-black text-red-500 shrink-0">+{Math.max(0, Number(stock.fiveDayRate || 0)).toFixed(2)}%</span>
                  </button>
                ))}
                {topPerformers.length === 0 && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">5営業日基準で上昇銘柄がありません</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
              <div className="flex items-center justify-between mb-1.5 gap-1.5">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">下落率 Top 5</p>
                <span className="rounded-full border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-black text-slate-500 dark:text-slate-400">
                  5営業日基準
                </span>
              </div>
              <div className="space-y-1">
                {topDecliners.map((stock) => (
                  <button
                    key={`down-${stock.id}`}
                    onClick={() => handleSelectStock(stock)}
                    className="w-full flex items-center justify-between rounded-lg px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                  >
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{formatStockJaEnListLabel(stock)}</span>
                    <span className="text-[11px] font-black text-blue-500 shrink-0">{Number(stock.fiveDayRate || 0).toFixed(2)}%</span>
                  </button>
                ))}
                {topDecliners.length === 0 && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">5営業日基準で下落銘柄がありません</p>
                )}
              </div>
            </div>
              </div>
            </MembersBlurGate>
            <div className="hidden lg:block">
              <LazyStockLeftSidebarA8Ad />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
              <div className="mb-1.5">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">実績サマリー</p>
              </div>
              {chartHistoryLoading ? (
                <p className="text-[10px] text-slate-500 dark:text-slate-400">実際の終値履歴を読み込み中...</p>
              ) : selectedHistorySummary ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {[
                      { label: '1M', value: selectedHistorySummary.return1m },
                      { label: '3M', value: selectedHistorySummary.return3m },
                      { label: '6M', value: selectedHistorySummary.return6m },
                      { label: 'YTD', value: selectedHistorySummary.returnYtd },
                      { label: '1Y', value: selectedHistorySummary.return1y },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5">
                        <p className="text-[10px] font-bold text-slate-500">{item.label}騰落率</p>
                        <p className={`mt-0.5 text-[11px] font-black ${signedReturnTextClassTri(item.value)}`}>
                          {formatSignedPct(item.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">MA50</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {selectedHistorySummary.ma50 != null ? formatCurrency(selectedHistorySummary.ma50, displayedStock?.region || 'US') : '--'}
                      </span>
                    </div>
                    {STOCK_CHART_UI_SHOW_MA200 ? (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-500">MA200</span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {selectedHistorySummary.ma200 != null ? formatCurrency(selectedHistorySummary.ma200, displayedStock?.region || 'US') : '--'}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">終値 vs MA50</span>
                      <span className={`font-black ${selectedHistorySummary.aboveMa50 == null ? 'text-slate-400' : selectedHistorySummary.aboveMa50 ? 'text-red-500' : 'text-blue-500'}`}>
                        {selectedHistorySummary.aboveMa50 == null ? '--' : selectedHistorySummary.aboveMa50 ? '上回る' : '下回る'}
                      </span>
                    </div>
                    {STOCK_CHART_UI_SHOW_MA200 ? (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-500">終値 vs MA200</span>
                        <span className={`font-black ${selectedHistorySummary.aboveMa200 == null ? 'text-slate-400' : selectedHistorySummary.aboveMa200 ? 'text-red-500' : 'text-blue-500'}`}>
                          {selectedHistorySummary.aboveMa200 == null ? '--' : selectedHistorySummary.aboveMa200 ? '上回る' : '下回る'}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">前日終値</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {selectedHistorySummary.prevClose != null ? formatCurrency(selectedHistorySummary.prevClose, displayedStock?.region || 'US') : '--'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">前日終値比</span>
                      <span className={`font-black ${signedReturnTextClassTri(selectedHistorySummary.dayRate)}`}>
                        {formatSignedPct(selectedHistorySummary.dayRate)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 dark:text-slate-400">表示できる実績履歴がまだありません。</p>
              )}
              <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                ※ すべて実際の終値履歴をもとに集計しています。
              </p>
            </div>
          </div>
        </div>

        <div ref={chartSectionRef} className="order-1 lg:order-2 lg:col-span-7 space-y-4 lg:self-start">
          {/* モバイル: チャート上部に固定の銘柄変更バー */}
          <div className="lg:hidden sticky top-16 z-20 -mx-4 px-4 py-2 -mt-2 mb-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              type="button"
              onClick={() => setShowStockSelectorSheet(true)}
              className="w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-orange-500 shrink-0">{displayedStock?.code || '--'}</span>
                <span className="text-sm font-black text-slate-900 dark:text-white truncate">{formatStockJaEnListLabel(displayedStock) || displayedStock?.name || '銘柄を選択'}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500 shrink-0">
                検索
                <Search size={14} />
              </span>
            </button>
          </div>

          {/* 銘柄選択ボトムシート (モバイル) */}
          {showStockSelectorSheet && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowStockSelectorSheet(false)} />
              <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">銘柄を検索</h3>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{filteredStocks.length}銘柄を表示中</p>
                    </div>
                  <button onClick={() => setShowStockSelectorSheet(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">×</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
                    {[
                      { id: 'US', label: '米国' },
                      { id: 'JP', label: '日本' },
                    ].map((r) => (
                      <button
                        key={`mobile-region-${r.id}`}
                        type="button"
                        onClick={() => handleRegionChange(r.id)}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                          selectedRegion === r.id
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ティッカー・社名で検索"
                      autoFocus
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-3 pl-10 pr-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => handleSectorChange('')}
                      className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black ${
                        !selectedSector
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      全て
                    </button>
                    {sectorOptions.map((sec) => (
                      <button
                        key={`mobile-sector-${sec}`}
                        type="button"
                        onClick={() => handleSectorChange(sec)}
                        className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black ${
                          selectedSector === sec
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-3 space-y-2">
                  {displayOrderedFilteredStocks.map((stock) => (
                    <button
                      key={stock.id}
                      type="button"
                      onClick={() => { handleSelectStock(stock); setShowStockSelectorSheet(false); }}
                      className={`w-full p-3.5 rounded-2xl text-left flex justify-between items-center transition ${displayedStock?.id === stock.id ? 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-2 border-transparent'}`}
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-black text-orange-500 block">{stock.code}</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">{formatStockJaEnListLabel(stock)}</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate block">{stock.sector || stock.industry || 'Market'}</span>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        <span className="font-mono text-sm font-bold block">{stock.price != null ? formatCurrency(stock.price, stock.region) : '--'}</span>
                        <span className={`text-xs font-black block ${signedReturnTextClassTri(stock.rate, 'text-slate-400')}`}>
                          {stock.price != null ? `${stock.rate > 0 ? '+' : ''}${stock.rate.toFixed(2)}%` : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                  {displayOrderedFilteredStocks.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-5 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                      条件に合う銘柄がありません。
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {marketLoading ? (
            <div className="space-y-4" aria-busy="true" aria-label="株価データを読み込み中">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">最新の終値・チャート用データを読み込んでいます…</p>
              <div className="space-y-4 animate-pulse">
                <div className="h-14 bg-slate-200/90 dark:bg-slate-800 rounded-2xl" />
                <div className="h-[min(52vh,420px)] bg-slate-200/90 dark:bg-slate-800 rounded-3xl" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-12 bg-slate-200/90 dark:bg-slate-800 rounded-2xl" />
                  <div className="h-12 bg-slate-200/90 dark:bg-slate-800 rounded-2xl" />
                </div>
              </div>
            </div>
          ) : displayedStock ? (
            <>
              <div className="flex justify-between items-end gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-sm font-black text-orange-500 dark:text-orange-400 font-mono">{displayedStock.code}</span>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatStockJaEnListLabel(displayedStock) || displayedStock.name}</h1>
                    <span className="text-[11px] font-bold text-slate-900 bg-orange-400 px-2 py-1 rounded-md">{displayedStock.sector}</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className={`text-4xl md:text-5xl font-black tracking-tight ${signedReturnTextClassStrong(Number(activePerformanceSummary?.rate ?? selectedHistorySummary?.dayRate ?? displayedStock.rate))}`}>
                      {formatCurrency(activePerformanceSummary?.latestClose ?? selectedHistorySummary?.latestClose ?? displayedStock.price, displayedStock.region)}
                    </span>
                    <span className={`text-base md:text-lg font-bold flex items-center ${signedReturnTextClassStrong(Number(activePerformanceSummary?.rate ?? selectedHistorySummary?.dayRate ?? displayedStock.rate))}`}>
                      {Number(activePerformanceSummary?.rate ?? selectedHistorySummary?.dayRate ?? displayedStock.rate) >= 0 ? <TrendingUp size={20} className="mr-1.5" /> : <TrendingDown size={20} className="mr-1.5" />}
                      {formatPriceDelta(activePerformanceSummary?.change ?? selectedHistorySummary?.dayChange ?? displayedStock.change, displayedStock.region)} ({Number(activePerformanceSummary?.rate ?? selectedHistorySummary?.dayRate ?? displayedStock.rate).toFixed(2)}%)
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {activePerformanceSummary?.label || '前日終値比'}: {displayedStock?.tradeDate || updatedDateLabel}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    icon={Star}
                    active={watchlist.includes(displayedStock.id)}
                    onClick={() => toggleWatch(displayedStock.id, {
                      symbol: displayedStock.code || displayedStock.id,
                      product_name: displayedStock.name || displayedStock.company || '',
                    })}
                    ariaLabel="watch"
                  />
                </div>
              </div>

              <StockDividendAnnouncementBanner symbol={displayedStock?.code || displayedStock?.id} />
              <StockLatestSessionOhlcvTable stock={displayedStock} />

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-700/80 shadow-xl shadow-slate-200/40 dark:shadow-black/30 overflow-hidden relative ring-1 ring-slate-900/[0.03] dark:ring-white/[0.04]">
                <div className="px-3 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70">
                      {TIMEFRAMES.map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setTimeframe(tf)}
                          className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                            timeframe === tf
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-600'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                    <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-500/20">
                      {STOCK_CHART_UI_SHOW_MA200 ? '終値 + MA50/200' : '終値 + MA50'}
                    </span>
                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70">
                      {[
                        { id: 'area', label: 'ライン' },
                        { id: 'candle', label: 'ローソク足' },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setChartDisplayMode(mode.id)}
                          className={`px-2 py-1 text-[10px] font-black rounded-md transition-all ${
                            chartDisplayMode === mode.id
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setChartExpanded((v) => !v)}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                    >
                      {chartExpanded ? '標準表示' : 'チャート拡大'}
                    </button>
                    <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: chartColor }} />
                      <span className="font-mono text-orange-500">{displayedStock?.code}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-3 py-2.5 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-mono bg-slate-50/50 dark:bg-slate-900/30">
                  {[
                    { label: '前日終値', value: formatDailyPrice(selectedHistorySummary?.prevClose, displayedStock?.region) },
                    { label: '最新終値', value: formatDailyPrice(selectedHistorySummary?.latestClose ?? displayedStock?.price, displayedStock?.region), accent: true },
                    { label: `${timeframe}高値終値`, value: formatDailyPrice(chartHighLow.high, displayedStock?.region) },
                    { label: `${timeframe}安値終値`, value: formatDailyPrice(chartHighLow.low, displayedStock?.region) },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-xl px-2.5 py-2 border ${
                        item.accent
                          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                          : 'bg-white/70 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/70'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{item.label}</span>
                      <span className={`mt-0.5 block font-black tabular-nums ${item.accent ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100'}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-1.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {chartHistoryLoading
                      ? '実際の終値履歴を読み込み中...'
                      : chartData.length > 0
                        ? `日次終値ベース · ${activePerformanceSummary?.label || '前日終値比'} (${displayedStock?.tradeDate || updatedDateLabel})`
                        : '表示できる終値履歴がありません。'}
                  </p>
                  {chartHistoryError ? (
                    <p className="mt-1 text-[10px] font-bold text-amber-500 dark:text-amber-400">{chartHistoryError}</p>
                  ) : null}
                </div>

                <div className={`${chartExpanded ? 'h-[min(56vh,480px)] md:h-[min(62vh,560px)]' : 'h-[min(40vh,300px)] sm:h-[min(42vh,340px)] md:h-[min(44vh,400px)]'} w-full relative transition-all duration-300 bg-gradient-to-b from-slate-50/80 via-white to-white dark:from-[#0a101d] dark:via-[#0B1221] dark:to-[#0F172A]`}>
                  <div
                    ref={chartInteractionRef}
                    onMouseDown={handlePanStart}
                    className={`h-full w-full ${(xWindowSize > 0 && xWindowSize < timeframeChartSeries.length) ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'} select-none`}
                  >
                    <StockPriceChart
                      data={visibleChartSeries}
                      timeframe={timeframe}
                      chartColor={chartColor}
                      priceDomain={chartPriceDomain}
                      region={displayedStock?.region || 'US'}
                      maShortWindow={maWindows.shortWindow}
                      maLongWindow={maWindows.longWindow}
                      showMaLong={STOCK_CHART_UI_SHOW_MA200}
                      displayMode={chartDisplayMode}
                      showVolume={chartVolumeReady}
                      volumeMeta={chartVolumeMeta}
                      gradientKey={displayedStock?.code || displayedStock?.id || 'stock'}
                      formatCurrency={formatCurrency}
                      className="h-full w-full"
                    />
                  </div>
                </div>
                <div className="px-4 py-2.5 border-t border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 dark:from-slate-900/50 dark:via-slate-900 dark:to-slate-900/50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        チャートは日次の終値ベースで可視化した参考表示です。1D / 5D も分足ではなく直近営業日の終値推移です。ヘッダーの期間リターンは営業日ベース（例: 1D=前営業日、1M≈22営業日、1Y≈252営業日）です。
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        拡大縮小・表示範囲の移動は下のボタンで操作できます
                        {chartVolumeMeta && chartVolumeMeta.pct < 95
                          ? ` · 出来高は過去インポート分に未登録の日があり、${chartVolumeMeta.firstDate}以降のみ棒グラフ表示`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden">
                      {(xWindowSize > 0 && xWindowSize < timeframeChartSeries.length) ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePanLeft(); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition border-r border-slate-200 dark:border-slate-600"
                            title="過去へ"
                          >
                            <ChevronLeft size={14} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePanRight(); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition border-r border-slate-200 dark:border-slate-600"
                            title="直近へ"
                          >
                            <ChevronRight size={14} strokeWidth={2.5} />
                          </button>
                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 self-center" />
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition border-r border-slate-200 dark:border-slate-600"
                        title="拡大"
                      >
                        <ChevronUp size={14} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                        title="縮小"
                      >
                        <ChevronDown size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-[10px] font-bold">
                    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: chartColor }} />
                      終値
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <span className="w-4 h-0.5 rounded-full bg-amber-500 border border-dashed border-amber-600/30" />
                      MA{maWindows.shortWindow}
                    </span>
                    {STOCK_CHART_UI_SHOW_MA200 ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="w-4 h-0.5 rounded-full bg-violet-500" />
                        MA{maWindows.longWindow}
                      </span>
                    ) : null}
                    {chartVolumeReady ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500/50" />
                        出来高
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => toggleWatch(displayedStock.id, {
                    symbol: displayedStock.code || displayedStock.id,
                    product_name: displayedStock.name || displayedStock.company || '',
                  })}
                  className="py-3.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-bold rounded-2xl transition flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 group"
                >
                  <Plus size={20} className="text-orange-500 group-hover:scale-110 transition" />
                  {watchlist.includes(displayedStock.id) ? 'ウォッチ解除' : 'ウォッチリスト登録'}
                </button>
                <button
                  onClick={() => (isLoggedIn ? navigate('/mypage?tab=stock') : promptLogin())}
                  className="py-3.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 group"
                >
                  <Plus size={20} className="group-hover:scale-110 transition" />
                  マイページへ
                </button>
              </div>

              <StockDailyAiBrief
                symbol={displayedStock?.code}
                region={displayedStock?.region || selectedRegion}
                isLoggedIn={isLoggedIn}
                onLogin={promptLogin}
                dayChangePct={Number(selectedHistorySummary?.dayRate ?? displayedStock?.rate)}
              />

              <div className="bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                <div className="mb-0 md:mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-700 dark:text-slate-200">ウォッチリスト・ヘルスモニター</h3>
                    <p className="md:hidden text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      監視 {watchlistHealthSummary.total} / 要注意 {watchlistHealthSummary.warn}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileHealthExpanded((v) => !v)}
                    className="md:hidden rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[11px] font-black text-slate-600 dark:text-slate-300"
                  >
                    {mobileHealthExpanded ? '閉じる' : '開く'}
                  </button>
                </div>
                <div className={`${mobileHealthExpanded ? 'mt-4 block' : 'hidden'} md:mt-0 md:block`}>
                {!isLoggedIn ? (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-4">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">ウォッチリスト連動のヘルス分析はログイン後に利用できます。</p>
                    <button
                      type="button"
                      onClick={promptLogin}
                      className="mt-3 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-black"
                    >
                      ログインして続ける
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 font-bold text-slate-600 dark:text-slate-300">監視銘柄 {watchlistHealthSummary.total}</div>
                      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 font-bold text-red-600">要注意 {watchlistHealthSummary.warn}</div>
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 font-bold text-amber-600">注意 {watchlistHealthSummary.caution}</div>
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 font-bold text-emerald-600">安定 {watchlistHealthSummary.stable}</div>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {watchlistHealthRows.slice(0, 12).map((row) => (
                        <button
                          key={`health-main-${row.stock.id}`}
                          onClick={() => handleSelectStock(row.stock)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formatStockJaEnListLabel(row.stock) || row.stock.code}</span>
                            <span className="text-[11px] font-bold text-slate-500">フラグ {row.flags.length}件</span>
                          </div>
                          <p className="mt-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            20日変動性 {row.meta?.dailyVolatility != null ? `${row.meta.dailyVolatility.toFixed(2)}%` : '--'} ·
                            出来高 {row.meta?.volumeRatio20d != null ? `${row.meta.volumeRatio20d.toFixed(2)}x` : '--'}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {row.flags.length > 0 ? row.flags.map((flag) => (
                              <span
                                key={`${row.stock.id}-main-${flag.id}`}
                                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                  flag.tone === 'warn'
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {flag.label}
                              </span>
                            )) : (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">特記事項なし</span>
                            )}
                          </div>
                        </button>
                      ))}
                      {watchlistHealthRows.length === 0 && (
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">ウォッチリスト銘柄がありません。</p>
                      )}
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                      ※ ヘルスモニターの評価は当社独自の参考指標であり、投資助言ではありません。実際の売買判断はご自身でお願いします。
                    </p>
                  </>
                )}
                </div>
              </div>

              <MembersBlurGate
                isLoggedIn={isLoggedIn}
                returnPath={authReturnPath}
                label="ヒートマップはログイン後に表示されます"
                hint="無料登録でセクター別の時価総額・騰落ヒートマップをご覧いただけます。"
                overlayRoundedClass="rounded-3xl"
              >
              <div className="-mx-4 md:mx-0 bg-white dark:bg-slate-800/50 p-2 md:p-5 rounded-none md:rounded-3xl border-y md:border border-slate-200 dark:border-white/5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2 md:mb-3 px-2 md:px-0">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.18em] text-slate-400 dark:text-slate-500 uppercase">Market Heatmap</p>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                      {selectedRegion === 'JP' ? '日本株' : '米国株'} ヒートマップ
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      タイルサイズは時価総額（発行株式数 × 最新終値）、色は日次騰落率です。
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 text-[10px] font-black">
                    <span className="rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 px-2 py-1">
                      上昇 {heatmapSummary.rising}
                    </span>
                    <span className="rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300 px-2 py-1">
                      下落 {heatmapSummary.falling}
                    </span>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1">
                      {heatmapSummary.count}銘柄
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHeatmapFullscreen(true)}
                      className="md:hidden rounded-full bg-slate-900 dark:bg-white px-3 py-1 text-white dark:text-slate-900"
                    >
                      大きく見る
                    </button>
                  </div>
                </div>

                <div className="mb-2 md:mb-3 flex flex-wrap items-center gap-2 px-2 md:px-0 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>時価総額合計: {formatHeatmapSizeValue(heatmapSummary.totalMarketCap, heatmapSummary.currency)}</span>
                  {heatmapSummary.tradeDate ? <span>データ日付: {heatmapSummary.tradeDate}</span> : null}
                  {heatmapSector ? <span>ヒートマップ: {heatmapSector}</span> : null}
                </div>
                <div className="mb-2 md:mb-3 hidden md:flex flex-wrap items-center gap-2 px-2 md:px-0">
                  <select
                    value={heatmapSector}
                    onChange={(e) => {
                      heatmapAutoSectorRef.current = true
                      setHeatmapSector(e.target.value)
                    }}
                    className="min-w-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-black text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500"
                    aria-label="ヒートマップセクター"
                  >
                    <option value="">全セクター</option>
                    {sectorOptions.map((sec) => (
                      <option key={`heatmap-sector-option-${sec}`} value={sec}>{sec}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (sectorOptions.length === 0) return
                      const randomIndex = Math.floor(Math.random() * sectorOptions.length)
                      heatmapAutoSectorRef.current = true
                      setHeatmapSector(sectorOptions[randomIndex])
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300 hover:border-orange-400 hover:text-orange-500"
                  >
                    ランダム表示
                  </button>
                </div>
                <div className="mb-2 flex items-center gap-2 overflow-x-auto px-2 pb-1 md:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      if (sectorOptions.length === 0) return
                      const randomIndex = Math.floor(Math.random() * sectorOptions.length)
                      heatmapAutoSectorRef.current = true
                      setHeatmapSector(sectorOptions[randomIndex])
                    }}
                    className="shrink-0 rounded-full bg-slate-900 px-3 py-2 text-[11px] font-black text-white dark:bg-white dark:text-slate-900"
                  >
                    ランダム
                  </button>
                  <span className="shrink-0 rounded-full bg-orange-50 dark:bg-orange-950/30 px-3 py-2 text-[11px] font-black text-orange-600 dark:text-orange-300">
                    {heatmapSector || '全セクター'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHeatmapFullscreen(true)}
                    className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-900 px-3 py-2 text-[11px] font-black text-slate-600 dark:text-slate-300"
                  >
                    セクター変更
                  </button>
                </div>
                <div className="mb-2 md:mb-3 flex items-center gap-2 px-2 md:px-0 text-[10px] font-black text-slate-500 dark:text-slate-400">
                  <span className="h-2 w-12 rounded-full bg-blue-900" aria-hidden />
                  <span>下落</span>
                  <span className="h-2 w-8 rounded-full bg-slate-700" aria-hidden />
                  <span>中立</span>
                  <span>上昇</span>
                  <span className="h-2 w-12 rounded-full bg-red-800" aria-hidden />
                </div>

                {stockHeatmapLoading ? (
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-1 animate-pulse">
                    {Array.from({ length: 28 }).map((_, idx) => (
                      <div key={`heatmap-skel-${idx}`} className="h-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
                    ))}
                  </div>
                ) : stockHeatmapError ? (
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-4">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{stockHeatmapError}</p>
                  </div>
                ) : heatmapSectorGroups.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">この条件で表示できるヒートマップデータがありません。</p>
                  </div>
                ) : (
                  <div className="relative h-[430px] md:h-[560px] xl:h-[620px] overflow-hidden rounded-2xl bg-slate-950 p-1">
                    {heatmapTreemapGroups.map((sectorRect) => {
                      const group = sectorRect.group
                      const sectorArea = sectorRect.width * sectorRect.height
                      return (
                        <section
                          key={`heatmap-sector-${group.sector}`}
                          className="absolute overflow-hidden border border-slate-950 bg-slate-900/70"
                          style={{
                            left: `${sectorRect.x}%`,
                            top: `${sectorRect.y}%`,
                            width: `${sectorRect.width}%`,
                            height: `${sectorRect.height}%`,
                          }}
                        >
                          {sectorArea > 80 ? (
                            <div className="absolute left-1 top-1 z-10 max-w-[calc(100%-0.5rem)] rounded bg-black/35 px-1.5 py-0.5 text-[8px] md:text-[10px] font-black uppercase tracking-tight text-white/90 backdrop-blur-sm pointer-events-none">
                              <span className="truncate block">{group.sector}</span>
                            </div>
                          ) : null}
                          {sectorRect.itemRects.map((rect) => {
                            const item = rect.item
                            const stock = item.liveStock
                            const area = rect.width * rect.height
                            const showCompactLabel = area >= 28 && rect.width >= 4.8 && rect.height >= 4.6
                            const showPctLabel = area >= 70 && rect.width >= 6.5 && rect.height >= 8
                            const showMarketCapLabel = area >= 150 && rect.width >= 9 && rect.height >= 12
                            const useLargeLabel = area >= 180 && rect.width >= 13 && rect.height >= 14
                            return (
                              <button
                                key={`heatmap-${item.symbol}`}
                                type="button"
                                onClick={() => {
                                  if (stock) handleSelectStock(stock)
                                  else if (requireLoginForStockChange()) return
                                  else {
                                    setSearchQuery(item.symbol)
                                    setSelectedRegion(item.region)
                                  }
                                }}
                                title={`${item.displayName} (${item.symbol}) ${formatSignedPct(item.changePct)} / ${formatHeatmapSizeValue(item.marketCap, item.marketCapCurrency)}`}
                                className="absolute overflow-hidden border border-slate-950/80 p-1 text-left text-white shadow-sm transition hover:z-20 hover:ring-2 hover:ring-white/80 hover:brightness-125"
                                style={{
                                  left: `${rect.x}%`,
                                  top: `${rect.y}%`,
                                  width: `${rect.width}%`,
                                  height: `${rect.height}%`,
                                  backgroundColor: getStockHeatmapTileColor(item.changePct),
                                }}
                              >
                                {showCompactLabel ? (
                                  <span className="flex h-full min-h-0 flex-col justify-center overflow-hidden leading-none">
                                    <span className={`${useLargeLabel ? 'text-[13px] md:text-lg' : 'text-[10px] md:text-xs'} block truncate font-black drop-shadow`}>
                                      {abbreviateHeatmapJaLabel(item.displayName, useLargeLabel ? 14 : 8)}
                                    </span>
                                    {showPctLabel ? (
                                      <span className={`${useLargeLabel ? 'text-[11px] md:text-sm' : 'text-[9px]'} mt-0.5 block truncate font-black drop-shadow`}>
                                        {formatSignedPct(item.changePct)}
                                      </span>
                                    ) : null}
                                    {showMarketCapLabel ? (
                                      <span className="mt-1 hidden truncate text-[10px] font-bold opacity-90 drop-shadow md:block">
                                        {formatHeatmapSizeValue(item.marketCap, item.marketCapCurrency)}
                                      </span>
                                    ) : null}
                                  </span>
                                ) : null}
                              </button>
                            )
                          })}
                        </section>
                      )
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-slate-50 dark:bg-slate-900 px-3 py-2">
                  <Info size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {LEGAL_NOTICE_TEMPLATES.investment}
                  </p>
                </div>
              </div>
              </MembersBlurGate>

            </>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                この地域に表示できる銘柄がありません。
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                地域タブを切り替えるか、検索条件をリセットしてください。
              </p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedRegion('US')
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold"
              >
                米国銘柄を表示
              </button>
            </div>
          )}
        </div>
        <div className="order-3 lg:col-span-3 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="hidden lg:block">
          <MembersBlurGate
            isLoggedIn={isLoggedIn}
            returnPath={authReturnPath}
            label="企業ニュースはログイン後に表示されます"
            hint="無料登録でAI要約付きの企業ニュースをご覧いただけます。"
            overlayRoundedClass="rounded-2xl"
          >
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">企業ニュース</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 mb-2 leading-snug">
              開示ニュースをもとに日次で銘柄を選び AI が要約します（データがない場合は決算・イベント予定を表示。各社公式で要確認）
            </p>
            <div className="space-y-2">
              {companyNewsRows.length === 0 && (
                <p className="text-xs text-slate-400">この地域の予定データは準備中です。</p>
              )}
              {companyNewsRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">{row.symbol}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPhaseBadgeClass(row.phase)}`}>
                      {row.phase}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{row.company}</p>
                  <p className="text-[10px] text-slate-400">{row.when}</p>
                  {row.point ? (
                    <p className="text-[10px] mt-1 text-slate-500 dark:text-slate-400 leading-relaxed">{row.point}</p>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              ※ 当社（マネーラボ株式会社／MoneyLab Inc.）は金融商品取引業者ではありません。本ページの情報は参考情報の提供を目的としており、投資助言・売買の勧誘ではありません。投資の最終判断はご自身の責任でお願いします。
            </p>
          </div>
          </MembersBlurGate>
          </div>
          <div className="hidden lg:block">
            <LazyStockCompanyNewsBelowA8Ad />
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">プラットフォーム活用ヒント</p>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <li>・銘柄比較は価格と出来高をセットで確認</li>
              <li>・同一セクターで上位/下位を並べて判断</li>
              <li>・ファンド比較やマーケットページで、ポートフォリオ全体のバランスも確認してみてください</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">比較FAQ</p>
            <div className="space-y-2">
              {STOCK_FAQ_ITEMS.map((item) => (
                <div key={item.q} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                  <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">Q. {item.q}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">A. {item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showHeatmapFullscreen && isLoggedIn ? (
        <div className="fixed inset-0 z-[120] bg-slate-950 text-white md:hidden">
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-white/10 bg-slate-950/95 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Market Heatmap</p>
                  <h3 className="truncate text-base font-black">
                    {selectedRegion === 'JP' ? '日本株' : '米国株'} {heatmapSector || '全セクター'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHeatmapFullscreen(false)}
                  className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black"
                >
                  閉じる
                </button>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => {
                    if (sectorOptions.length === 0) return
                    const randomIndex = Math.floor(Math.random() * sectorOptions.length)
                    heatmapAutoSectorRef.current = true
                    setHeatmapSector(sectorOptions[randomIndex])
                  }}
                  className="shrink-0 rounded-full bg-white px-3 py-2 text-[11px] font-black text-slate-950"
                >
                  ランダム
                </button>
                <button
                  type="button"
                  onClick={() => {
                    heatmapAutoSectorRef.current = true
                    setHeatmapSector('')
                  }}
                  className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black ${
                    !heatmapSector ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-200'
                  }`}
                >
                  全て
                </button>
                {sectorOptions.map((sec) => (
                  <button
                    key={`heatmap-fullscreen-sector-${sec}`}
                    type="button"
                    onClick={() => {
                      heatmapAutoSectorRef.current = true
                      setHeatmapSector(sec)
                    }}
                    className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black ${
                      heatmapSector === sec ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-200'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 p-2">
              {stockHeatmapLoading ? (
                <div className="grid h-full grid-cols-4 gap-1 animate-pulse">
                  {Array.from({ length: 32 }).map((_, idx) => (
                    <div key={`heatmap-full-skel-${idx}`} className="rounded-lg bg-slate-800" />
                  ))}
                </div>
              ) : stockHeatmapError ? (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-900/20 p-4 text-xs font-bold text-amber-200">
                  {stockHeatmapError}
                </div>
              ) : heatmapSectorGroups.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs font-bold text-slate-300">
                  この条件で表示できるヒートマップデータがありません。
                </div>
              ) : (
                <div className="relative h-full overflow-hidden rounded-2xl bg-slate-950 p-1">
                  {heatmapTreemapGroups.map((sectorRect) => {
                    const group = sectorRect.group
                    const sectorArea = sectorRect.width * sectorRect.height
                    return (
                      <section
                        key={`heatmap-full-sector-${group.sector}`}
                        className="absolute overflow-hidden border border-slate-950 bg-slate-900/70"
                        style={{
                          left: `${sectorRect.x}%`,
                          top: `${sectorRect.y}%`,
                          width: `${sectorRect.width}%`,
                          height: `${sectorRect.height}%`,
                        }}
                      >
                        {sectorArea > 80 ? (
                          <div className="absolute left-1 top-1 z-10 max-w-[calc(100%-0.5rem)] rounded bg-black/35 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tight text-white/90 backdrop-blur-sm pointer-events-none">
                            <span className="truncate block">{group.sector}</span>
                          </div>
                        ) : null}
                        {sectorRect.itemRects.map((rect) => {
                          const item = rect.item
                          const stock = item.liveStock
                          const area = rect.width * rect.height
                          const showCompactLabel = area >= 26 && rect.width >= 4.6 && rect.height >= 4.4
                          const showPctLabel = area >= 64 && rect.width >= 6.2 && rect.height >= 7.5
                          const showMarketCapLabel = area >= 155 && rect.width >= 9 && rect.height >= 12
                          const useLargeLabel = area >= 175 && rect.width >= 13 && rect.height >= 14
                          return (
                            <button
                              key={`heatmap-full-${item.symbol}`}
                              type="button"
                              onClick={() => {
                                if (stock) handleSelectStock(stock)
                                else if (requireLoginForStockChange()) return
                                else {
                                  setSearchQuery(item.symbol)
                                  setSelectedRegion(item.region)
                                }
                              }}
                              title={`${item.displayName} (${item.symbol}) ${formatSignedPct(item.changePct)} / ${formatHeatmapSizeValue(item.marketCap, item.marketCapCurrency)}`}
                              className="absolute overflow-hidden border border-slate-950/80 p-1 text-left text-white"
                              style={{
                                left: `${rect.x}%`,
                                top: `${rect.y}%`,
                                width: `${rect.width}%`,
                                height: `${rect.height}%`,
                                backgroundColor: getStockHeatmapTileColor(item.changePct),
                              }}
                            >
                              {showCompactLabel ? (
                                <span className="flex h-full min-h-0 flex-col justify-center overflow-hidden leading-none">
                                  <span className={`${useLargeLabel ? 'text-base' : 'text-[10px]'} block truncate font-black drop-shadow`}>
                                    {abbreviateHeatmapJaLabel(item.displayName, useLargeLabel ? 16 : 10)}
                                  </span>
                                  {showPctLabel ? (
                                    <span className={`${useLargeLabel ? 'text-xs' : 'text-[9px]'} mt-0.5 block truncate font-black drop-shadow`}>
                                      {formatSignedPct(item.changePct)}
                                    </span>
                                  ) : null}
                                  {showMarketCapLabel ? (
                                    <span className="mt-1 block truncate text-[10px] font-bold opacity-90 drop-shadow">
                                      {formatHeatmapSizeValue(item.marketCap, item.marketCapCurrency)}
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </section>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {stockChangeAuthGateOpen && !isLoggedIn ? (
        <div
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-change-auth-gate-title"
          onClick={() => setStockChangeAuthGateOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-200/90 dark:border-amber-900/50 bg-white dark:bg-slate-900 shadow-2xl p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black tracking-[0.14em] text-amber-700 dark:text-amber-400">無料会員で銘柄切替</p>
                <h2 id="stock-change-auth-gate-title" className="mt-2 text-lg font-black text-slate-900 dark:text-white leading-snug">
                  他の銘柄を見るには登録が必要です
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setStockChangeAuthGateOpen(false)}
                className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="閉じる"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              表示中の銘柄はそのまま閲覧できます。銘柄一覧・ヒートマップ・地域切替は無料登録後にご利用いただけます（約1分）。
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
              <Link
                to="/signup"
                state={{ from: authReturnPath }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-3 text-sm font-black text-white transition"
              >
                <Sparkles size={16} aria-hidden />
                無料で登録する
              </Link>
              <Link
                to="/login"
                state={{ from: authReturnPath }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm font-black text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <LogIn size={16} aria-hidden />
                ログイン
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-[1400px] mx-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
        <p className="text-center text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
          株価・チャート等の表示データのソース:
          <span className={`ml-1 ${usingMockData ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            情報提供元
          </span>
          {usingMockData ? <span className="text-slate-400 dark:text-slate-500 font-semibold">（デモ／代替データ）</span> : null}
        </p>
      </div>
    </div>
  )
}
