import { useState, useEffect, useMemo, useRef, useTransition } from 'react'
import {
  Search, Star, Plus,
  TrendingUp, TrendingDown, Clock, Info,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Wallet, ExternalLink,
} from 'lucide-react'
import {
  ComposedChart, BarChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { loadStockWatchlistSymbolsFromDb, replaceStockWatchlistInDb } from '../lib/myPageApi'
import { bumpStockWatchlistSyncVersion } from '../lib/watchlistSyncEvents'
import { trackAnalyticsEvent } from '../lib/analytics'
import { REGION_BY_SYMBOL } from '../data/mockStocks'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import { fetchNewsManualData, getFallbackNewsData, formatManualNewsUpdatedAtJa } from '../lib/newsManualClient'
import AdBanner from '../components/AdBanner'
import AdSidebar from '../components/AdSidebar'
import MarketDataEodFreshnessNote from '../components/MarketDataEodFreshnessNote'
import {
  MARKET_DOWN_HEX,
  MARKET_UP_HEX,
  signedReturnTextClassOnDarkPanel,
  signedReturnTextClassStrong,
  signedReturnTextClassTri,
} from '../lib/marketDirectionColors'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ETF_SYMBOLS_FROM_XLSX, MARKETSTACK_BLOCKLIST_EXPORT } from '../data/etfListFromXlsx'
import { STOCK_LIST_400, STOCK_LIST_400_SYMBOLS, STOCK_LIST_400_BY_SYMBOL } from '../data/stockList400'
import { getStockNameFallback, getDisplayNameOverride } from '../data/stockNameFallback'
import { lookupDividendStockBySymbol } from '../data/dividendStockUniverse'
import { dedupeStockDailyPricesByTradeDate, fetchStockDailyHistoryBySymbolMap } from '../lib/stockDailyHistory'
import { COMPANY_NEWS_BY_REGION, mergeCompanyNewsWithAiBriefs } from '../data/companyNewsUpcoming'
import {
  findRowTradingSessionsBeforeLatest,
  findYtdBaseRowFromSeries,
  TRADING_SESSION_OFFSETS,
} from '../lib/calendarDateUtils'
const isJapaneseNewsItem = (item) => String(item?.language || '').toLowerCase() === 'ja'
const STOCK_NEWS_FALLBACK = [
  {
    source: 'MoneyMart News Desk',
    title: '日本語ニュースを取得中です。',
    time: '--:--',
    topic: 'News',
    url: '',
    imageUrl: '',
    language: 'ja',
  },
]

const STOCK_WATCHLIST_STORAGE_KEY_PREFIX = 'mm_stock_watchlist_v1'
const getStockWatchlistStorageKey = (userId) =>
  (userId ? `${STOCK_WATCHLIST_STORAGE_KEY_PREFIX}_${userId}` : `${STOCK_WATCHLIST_STORAGE_KEY_PREFIX}_guest`)
const ETF_SYMBOL_SET = new Set(ETF_SYMBOLS_FROM_XLSX)
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

const PLATFORM_PARTNERS = [
  { id: 'sbi', name: 'SBI証券', fee: '無料', points: 'Tポイント', note: 'NISA対応・国内外商品が豊富', url: 'https://www.sbisec.co.jp' },
  { id: 'rakuten', name: '楽天証券', fee: '無料', points: '楽天ポイント', note: '楽天経済圏との連携が強い', url: 'https://www.rakuten-sec.co.jp' },
  { id: 'monex', name: 'マネックス証券', fee: '55円~', points: 'マネックスP', note: '米国株・分析ツールが強み', url: 'https://www.monex.co.jp' },
]

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
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyByRegion(region),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalizeDisplayPrice(value || 0, region))

const formatPriceDelta = (value, region) => {
  const normalized = normalizeDisplayPrice(value, region)
  const sign = normalized > 0 ? '+' : ''
  return `${sign}${normalized.toFixed(2)}`
}

const formatCompact = (value) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return `${Math.round(value)}`
}

const formatDailyPrice = (value, region) => (
  Number.isFinite(Number(value)) ? formatCurrency(Number(value), region) : '--'
)

const formatDailyVolume = (value) => (
  Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '--'
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
  if (opts.jpSourceMerge) {
    return dedupeStockDailyPricesByTradeDate(rows).map((row) => ({
      tradeDate: String(row.trade_date),
      close: Number(row.close),
      volume: Number.isFinite(Number(row.volume)) ? Number(row.volume) : null,
    }))
  }
  const sorted = [...rows]
    .filter((row) => Number.isFinite(Number(row?.close)) && Number(row.close) > 0 && row?.trade_date)
    .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
  const byDate = new Map()
  for (const row of sorted) {
    byDate.set(String(row.trade_date), row)
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, row]) => ({
      tradeDate: String(row.trade_date),
      close: Number(row.close),
      volume: Number.isFinite(Number(row.volume)) ? Number(row.volume) : null,
    }))
}

const filterTrustedStockChartRows = (rows = []) =>
  rows.filter((r) => String(r.tradeDate || '') >= STOCK_CHART_TRUSTED_SINCE)

const chartHistoryCacheKey = (symbol, region) => {
  const s = String(symbol || '').trim()
  if (!s) return ''
  return region === 'JP' ? `${s}\0jp_ms_yf_v3` : s
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

const normalizeSectorName = (value) => {
  const sector = String(value || '').trim()
  if (!sector || /market/i.test(sector)) return '未分類'
  const lower = sector.toLowerCase()
  const exactMap = {
    technology: 'テクノロジー',
    tech: 'テクノロジー',
    financial: '金融',
    financials: '金融',
    finance: '金融',
    healthcare: 'ヘルスケア',
    'health care': 'ヘルスケア',
    industrial: '資本財・産業',
    industrials: '資本財・産業',
    consumer: '一般消費財',
    'consumer discretionary': '一般消費財',
    'consumer staples': '生活必需品',
    communication: 'コミュニケーション',
    'communication services': 'コミュニケーション',
    energy: 'エネルギー',
    materials: '素材',
    utilities: '公益',
    'real estate': '不動産',
    'sector etf': 'セクターETF',
    'index etf': '指数ETF',
    'thematic etf': 'テーマETF',
    'dividend etf': '高配当ETF',
    'fixed income etf': '債券ETF',
    'international equity etf': '海外株式ETF',
    'global equity etf': 'グローバル株式ETF',
    'commodity etf': 'コモディティETF',
  }
  if (exactMap[lower]) return exactMap[lower]
  if (lower.includes('tech')) return 'テクノロジー'
  if (lower.includes('financ')) return '金融'
  if (lower.includes('health')) return 'ヘルスケア'
  if (lower.includes('consumer')) return '一般消費財'
  if (lower.includes('industrial')) return '資本財・産業'
  if (lower.includes('energy')) return 'エネルギー'
  if (lower.includes('material')) return '素材'
  if (lower.includes('utilit')) return '公益'
  if (lower.includes('communicat')) return 'コミュニケーション'
  if (lower.includes('real estate')) return '不動産'
  if (lower.includes('etf')) return 'ETF'
  return sector
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

const InfoRow = ({ label, val }) => (
  <div className="flex justify-between border-b border-slate-200 dark:border-white/5 pb-2 last:border-0">
    <span className="text-slate-500">{label}</span>
    <span className="font-bold text-slate-900 dark:text-white">{val}</span>
  </div>
)

export default function StockPage({ user = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [selectedRegion, setSelectedRegion] = useState('US')
  const [selectedSector, setSelectedSector] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [timeframe, setTimeframe] = useState('1Y')
  const [selectedStock, setSelectedStock] = useState(null)
  const lastTrackedSearchRef = useRef('')
  const chartHistoryCacheRef = useRef(new Map())
  const [chartData, setChartData] = useState([])
  const [chartHistoryLoading, setChartHistoryLoading] = useState(false)
  const [chartHistoryError, setChartHistoryError] = useState('')
  const [watchlistHistoryBySymbol, setWatchlistHistoryBySymbol] = useState({})
  const [watchlist, setWatchlist] = useState([])
  const isLoggedIn = Boolean(user?.id)
  const promptLogin = () => {
    navigate('/login', {
      state: { from: `${location.pathname}${location.search}` },
    })
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
  const [xWindowSize, setXWindowSize] = useState(0)
  const [xWindowStart, setXWindowStart] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [threeMonthRateBySymbol, setThreeMonthRateBySymbol] = useState({})
  const [fiveDayRateBySymbol, setFiveDayRateBySymbol] = useState({})
  const [newsState, setNewsState] = useState(() => getFallbackNewsData())
  /** Supabase stock_page_company_news_briefs: display_cards 優先、無ければ brief_points で静的とマージ */
  const [aiCompanyBriefByRegion, setAiCompanyBriefByRegion] = useState(null)
  const [aiCompanyDisplayByRegion, setAiCompanyDisplayByRegion] = useState(null)
  const [expandedSectors, setExpandedSectors] = useState({})
  const [showStockSelectorSheet, setShowStockSelectorSheet] = useState(false)
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

  useEffect(() => {
    if (!['US', 'JP'].includes(selectedRegion)) {
      setSelectedRegion('US')
      setSelectedSector('')
    }
  }, [selectedRegion])

  useEffect(() => {
    let cancelled = false
    const loadNews = async () => {
      try {
        const payload = await fetchNewsManualData()
        if (!cancelled) setNewsState(payload)
      } catch {
        // keep fallback data
      }
    }
    loadNews()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
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
    loadBriefs()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadLatestStocks = async () => {
      setMarketLoading(true)
      setMarketHydrating(true)
      setMarketError('')
      if (!cancelled) {
        setFetchedDateLabel(new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
      }
      try {
        // StockPage は株式のみ表示。ETF/ファンドは除外し、US・JPのみを母集団にする。
        const targetSymbols = [...new Set(
          STOCK_LIST_400
            .filter((item) => (item?.region === 'US' || item?.region === 'JP') && !ETF_SYMBOL_SET.has(item?.symbol) && !MARKETSTACK_BLOCKLIST_EXPORT.has(item?.symbol))
            .map((item) => item.symbol)
        )]
        if (targetSymbols.length === 0) {
          setUsingMockData(false)
          setLiveStocks({ US: [] })
          setSelectedStock(null)
          setMarketError('株式リストが空です。')
          setMarketLoading(false)
          return
        }

        const baseList = STOCK_LIST_400
          .filter((item) => item?.symbol && (item.region === 'US' || item.region === 'JP') && !ETF_SYMBOL_SET.has(item.symbol) && !MARKETSTACK_BLOCKLIST_EXPORT.has(item.symbol))
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
        if (!cancelled) {
          setLiveStocks({ US: baseList })
          setSelectedStock(baseList[0] || null)
          // First paint fast: show base universe immediately,
          // then hydrate prices/profiles in background.
          setMarketLoading(false)
        }

        // profile: 100件ずつバッチで取得（タイムアウト防止）
        const PROFILE_BATCH = 100
        const profileRows = []
        for (let i = 0; i < targetSymbols.length; i += PROFILE_BATCH) {
          const batch = targetSymbols.slice(i, i + PROFILE_BATCH)
          const { data, error } = await supabase
            .from('stock_symbol_profiles')
            .select('symbol,sector,industry,name_jp,name_en,asset_type')
            .in('symbol', batch)
          if (error) throw error
          profileRows.push(...(data || []))
        }

        // latest: 50件ずつ、同時4バッチまで（DB負荷軽減）
        const LATEST_BATCH = 50
        const LATEST_PARALLEL = 4
        const latestRows = []
        for (let i = 0; i < targetSymbols.length; i += LATEST_BATCH * LATEST_PARALLEL) {
          const batchPromises = []
          for (let b = 0; b < LATEST_PARALLEL; b++) {
            const start = i + b * LATEST_BATCH
            if (start >= targetSymbols.length) break
            const batch = targetSymbols.slice(start, start + LATEST_BATCH)
            batchPromises.push(
              supabase.from('v_stock_latest').select('symbol,trade_date,open,high,low,close,volume').in('symbol', batch)
            )
          }
          const results = await Promise.all(batchPromises)
          for (const r of results) {
            if (r.error) throw r.error
            latestRows.push(...(r.data || []))
          }
        }
        const profileBySymbol = new Map(profileRows.map((r) => [r.symbol, r]))
        for (const [code, base] of baseMap) {
          const profile = profileBySymbol.get(code)
          if (profile) {
            const at = String(profile.asset_type || 'stock').trim().toLowerCase()
            baseMap.set(code, {
              ...base,
              ...(profile.sector && { sector: normalizeSectorName(profile.sector) }),
              ...(profile.industry && { industry: profile.industry }),
              ...(profile.name_jp && { name_jp: profile.name_jp }),
              ...(profile.name_en && { name_en: profile.name_en }),
              assetType: at === 'etf' ? 'etf' : 'stock',
            })
          }
        }

        if (latestRows.length > 0) {
          const liveSymbols = [...new Set(latestRows.map((r) => r.symbol).filter(Boolean))]
          const symbolRows = []
          for (let i = 0; i < liveSymbols.length; i += 100) {
            const batch = liveSymbols.slice(i, i + 100)
            const { data } = await supabase
              .from('stock_symbols')
              .select('symbol,name,exchange')
              .in('symbol', batch)
            symbolRows.push(...(data || []))
          }
          const symbolMap = new Map(symbolRows.map((s) => [s.symbol, s]))

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
            const displayName = displayOverride
              ? displayOverride
              : (base.name_jp || base.name_en)
                ? [base.name_jp, base.name_en].filter(Boolean).join(' / ')
                : (meta.name && meta.name !== r.symbol)
                ? meta.name
                : (base.name && base.name !== r.symbol)
                  ? base.name
                  : (fallbackName && fallbackName !== r.symbol)
                    ? fallbackName
                    : r.symbol
            baseMap.set(r.symbol, {
              ...base,
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
        const randomPick = (rows) => {
          if (!Array.isArray(rows) || rows.length === 0) return null
          const idx = Math.floor(Math.random() * rows.length)
          return rows[idx] || null
        }
        const candidatesLive = mergedStocksOnly.filter((s) => s.region === selectedRegion && s.hasLiveData)
        const candidatesRegion = mergedStocksOnly.filter((s) => s.region === selectedRegion)
        setSelectedStock(
          randomPick(candidatesLive)
          || randomPick(candidatesRegion)
          || randomPick(mergedStocksOnly)
        )

        // Load 3M change in background so initial paint is faster.
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
              parallelChunks: 10,
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
                return [symbol, ((latestClose - firstClose) / firstClose) * 100]
              })
            )
            const oneDayMap = Object.fromEntries(
              symbolList.map((symbol) => {
                const rows = [...(historyBySymbol.get(symbol) || [])]
                  .filter((row) => Number.isFinite(Number(row?.close)) && Number(row.close) > 0)
                  .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
                const latestClose = Number(latestBySymbol.get(symbol))
                const prevClose = rows.length >= 2 ? Number(rows[rows.length - 2]?.close) : null
                if (!Number.isFinite(prevClose) || !Number.isFinite(latestClose) || prevClose <= 0) {
                  return [symbol, null]
                }
                return [symbol, {
                  previousClose: prevClose,
                  change: latestClose - prevClose,
                  rate: ((latestClose - prevClose) / prevClose) * 100,
                }]
              })
            )
            const fiveDayMap = Object.fromEntries(
              symbolList.map((symbol) => {
                const rows = [...(historyBySymbol.get(symbol) || [])]
                  .filter((row) => Number.isFinite(Number(row?.close)) && Number(row.close) > 0)
                  .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
                const latestClose = Number(latestBySymbol.get(symbol))
                const fiveDayAgoRow = rows.length >= 6 ? rows[rows.length - 6] : null
                const baseClose = Number(fiveDayAgoRow?.close)
                if (!Number.isFinite(baseClose) || !Number.isFinite(latestClose) || baseClose <= 0) {
                  return [symbol, null]
                }
                return [symbol, ((latestClose - baseClose) / baseClose) * 100]
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
      } catch (err) {
        setUsingMockData(true)
        setMarketError(err.message || 'データの読み込みに失敗しました')
        // DB 실패 시 STOCK_LIST_400 기반 목록만 표시（가격 없음）
        const fallbackList = STOCK_LIST_400
          .filter((item) => item?.symbol && (item.region === 'US' || item.region === 'JP') && !ETF_SYMBOL_SET.has(item.symbol))
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
        setSelectedStock(sorted[0] || null)
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
    }
  }, [])

  const filteredStocks = (liveStocks.US || []).filter((s) => {
    const regionOK = s.region === selectedRegion
    const sectorOK = !selectedSector || s.sector === selectedSector
    const query = searchQuery.trim().toLowerCase()
    if (!query) return regionOK && sectorOK
    const searchStr = `${s.code || ''} ${s.name || ''} ${s.name_jp || ''} ${s.name_en || ''}`.toLowerCase()
    return regionOK && sectorOK && searchStr.includes(query)
  })
  useEffect(() => {
    const symbolParam = String(searchParams.get('symbol') || '').trim().toUpperCase()
    const allStocks = liveStocks.US || []
    if (!symbolParam || allStocks.length === 0) return
    const target = allStocks.find((row) => String(row.code || row.id || '').toUpperCase() === symbolParam)
    if (!target) return
    if (selectedRegion !== target.region) setSelectedRegion(target.region)
    if (selectedStock?.id !== target.id) setSelectedStock(target)
    if (searchQuery !== symbolParam) setSearchQuery(symbolParam)
  }, [searchParams, liveStocks, selectedRegion, selectedStock?.id, searchQuery])
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
    const groups = new Map()
    filteredStocks.forEach((stock) => {
      const sector = normalizeSectorName(stock.sector)
      if (!groups.has(sector)) groups.set(sector, [])
      groups.get(sector).push(stock)
    })
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
      .map(([sector, stocks]) => ({
        sector,
        stocks: [...stocks].sort((a, b) => {
          const pa = Number(a.priority ?? 9999)
          const pb = Number(b.priority ?? 9999)
          if (pa !== pb) return pa - pb
          return String(a.code).localeCompare(String(b.code))
        }),
      }))
  }, [filteredStocks])
  const allSectorsExpanded = useMemo(
    () => groupedFilteredStocks.every((group) => expandedSectors[group.sector] ?? false),
    [groupedFilteredStocks, expandedSectors]
  )
  useEffect(() => {
    setExpandedSectors((prev) => {
      const next = { ...prev }
      let changed = false
      groupedFilteredStocks.forEach((group) => {
        if (next[group.sector] == null) {
          next[group.sector] = false
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [groupedFilteredStocks])

  useEffect(() => {
    if (marketLoading) return
    if (!selectedStock || selectedStock.region !== selectedRegion) {
      setSelectedStock(filteredStocks[0] || null)
      return
    }
    // While searching, keep the user's explicit selection even if it is outside the filtered list.
    const hasActiveSearch = String(searchQuery || '').trim().length > 0
    if (!hasActiveSearch && !filteredStocks.some((s) => s.id === selectedStock.id)) {
      setSelectedStock(filteredStocks[0] || null)
    }
  }, [selectedRegion, selectedSector, searchQuery, filteredStocks, selectedStock, marketLoading])

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
        const chartSelect =
          region === 'JP' ? 'trade_date,close,volume,source,fetched_at' : 'trade_date,close,volume'
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

  const displayedStock = selectedStock || filteredStocks[0] || null
  const isUp = (displayedStock?.rate || 0) >= 0
  const chartColor = isUp ? MARKET_UP_HEX : MARKET_DOWN_HEX
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
  const stockNewsItems = useMemo(() => {
    const dbList = Array.isArray(newsState.stockDisclosures)
      ? newsState.stockDisclosures.filter(isJapaneseNewsItem)
      : []
    const finalList = dbList
    if (finalList.length === 0) return STOCK_NEWS_FALLBACK
    if (!displayedStock) return finalList.slice(0, 3)
    const key = String(displayedStock.code || '').toUpperCase()
    const name = String(displayedStock.name || '').toLowerCase()
    const matched = finalList.filter((item) => {
      const text = `${item.title || ''} ${item.description || ''}`.toLowerCase()
      if (key && text.includes(key.toLowerCase())) return true
      if (name && name.length >= 3 && text.includes(name.slice(0, 12))) return true
      return false
    })
    return (matched.length > 0 ? matched : finalList).slice(0, 3)
  }, [displayedStock, newsState.stockDisclosures])
  const manualNewsUpdatedLabelJa = useMemo(
    () => formatManualNewsUpdatedAtJa(newsState.updatedAt),
    [newsState.updatedAt],
  )
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
    return chartData.map((row, idx) => {
      const close = Number(row.close || 0)
      const prevClose = idx > 0
        ? Number(chartData[idx - 1]?.close || close)
        : close
      const rawMaShort = maShort[idx]
      const rawMaLong = maLong[idx]
      const maShortValue = rawMaShort != null && Number.isFinite(rawMaShort) ? rawMaShort : lastFiniteMaShort
      const maLongValue = rawMaLong != null && Number.isFinite(rawMaLong) ? rawMaLong : lastFiniteMaLong
      if (Number.isFinite(maShortValue)) lastFiniteMaShort = maShortValue
      if (Number.isFinite(maLongValue)) lastFiniteMaLong = maLongValue
      return {
        ...row,
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
      const close = Number(row.close)
      if (!Number.isFinite(close)) return
      low = Math.min(low, close)
      high = Math.max(high, close)
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
            symRegion === 'JP' ? 'trade_date,close,volume,source,fetched_at' : 'trade_date,close,volume'
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
  }, [watchlistSymbols, watchlistHistoryBySymbol])
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
    const dayChange = Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(latestClose)
      ? latestClose - prevClose
      : 0
    const dayRate = Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(latestClose)
      ? ((latestClose - prevClose) / prevClose) * 100
      : 0
    const base1m = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.ONE_MONTH)
    const base3m = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.THREE_MONTH)
    const base6m = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.SIX_MONTH)
    const base1y = findRowTradingSessionsBeforeLatest(chartSeries, TRADING_SESSION_OFFSETS.ONE_YEAR)
    const return1m = base1m ? calcReturnPct(base1m.close, latestClose) : null
    const return3m = base3m ? calcReturnPct(base3m.close, latestClose) : null
    const return6m = base6m ? calcReturnPct(base6m.close, latestClose) : null
    const return1y = base1y ? calcReturnPct(base1y.close, latestClose) : null
    const ytdBaseRow = findYtdBaseRowFromSeries(chartSeries)
    const returnYtd = ytdBaseRow ? calcReturnPct(ytdBaseRow.close, latestClose) : null
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
      dayRate,
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
      return {
        label,
        baseClose,
        change: latestClose - baseClose,
        rate: ((latestClose - baseClose) / baseClose) * 100,
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
        replaceStockWatchlistInDb({ userId: uid, symbols: next })
          .then(() => bumpStockWatchlistSyncVersion())
          .catch(() => {})
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
    setExpandedSectors((prev) => ({ ...prev, [sector]: !(prev[sector] ?? false) }))
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
              await replaceStockWatchlistInDb({ userId: uid, symbols: legacy })
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

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload
      return (
        <div className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-white p-3 rounded-xl text-xs shadow-xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
          <p className="font-bold text-slate-500 dark:text-slate-400 mb-1">{d.time}</p>
          <p className="font-mono">終値: <span className="font-bold">{formatCurrency(d.close, displayedStock?.region || 'US')}</span></p>
          <p className="font-mono">MA{maWindows.shortWindow}: <span className="font-bold">{d.maShort != null && Number.isFinite(d.maShort) ? formatCurrency(d.maShort, displayedStock?.region || 'US') : '--'}</span></p>
          <p className="font-mono">MA{maWindows.longWindow}: <span className="font-bold">{d.maLong != null && Number.isFinite(d.maLong) ? formatCurrency(d.maLong, displayedStock?.region || 'US') : '--'}</span></p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white font-sans pb-20">
      <div className="max-w-[1400px] mx-auto px-4 pt-4">
        <div className="bg-slate-900 dark:bg-black text-white rounded-2xl border border-slate-700 shadow-md overflow-hidden relative">
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
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] md:text-xs font-bold bg-slate-800/90 border border-slate-700 rounded-full px-2.5 py-1">
            ソース: <span className={usingMockData ? 'text-amber-300' : 'text-emerald-300'}>中間データ事業者</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 pt-3">
        <MarketDataEodFreshnessNote variant="stock" />
      </div>

      <div className="max-w-[1400px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-2 space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {[
              { id: 'US', label: '🇺🇸 米国' },
              { id: 'JP', label: '🇯🇵 日本' },
            ].map((r) => {
              const count = (liveStocks.US || []).filter((s) => s.region === r.id).length
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRegion(r.id)}
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
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-2.5 text-[11px] font-bold text-slate-900 dark:text-white focus:border-orange-500 outline-none"
            >
              <option value="">全て</option>
              {[...new Set((liveStocks.US || []).filter((s) => s.region === selectedRegion).map((s) => s.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')).map((sec) => (
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
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap shrink-0">銘柄一覧（セクター別）</span>
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
                    <span>{group.sector} ({group.stocks.length})</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${(expandedSectors[group.sector] ?? false) ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {(expandedSectors[group.sector] ?? false) && group.stocks.map((stock) => (
                    <div
                      key={stock.id}
                      onClick={() => handleSelectStock(stock)}
                      className={`p-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition flex justify-between items-center ${displayedStock?.id === stock.id ? 'bg-orange-50 dark:bg-white/10 border-l-4 border-orange-500' : ''}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-orange-500 shrink-0">{stock.code}</span>
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{stock.name}</span>
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
                  この地域の銘柄データはまだありません
                </div>
              )}
            </div>
          </div>
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
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{stock.name || stock.code}</span>
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
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{stock.name || stock.code}</span>
                    <span className="text-[11px] font-black text-blue-500 shrink-0">{Number(stock.fiveDayRate || 0).toFixed(2)}%</span>
                  </button>
                ))}
                {topDecliners.length === 0 && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">5営業日基準で下落銘柄がありません</p>
                )}
              </div>
            </div>
            <AdBanner variant="compact" />
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
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">MA200</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {selectedHistorySummary.ma200 != null ? formatCurrency(selectedHistorySummary.ma200, displayedStock?.region || 'US') : '--'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">終値 vs MA50</span>
                      <span className={`font-black ${selectedHistorySummary.aboveMa50 == null ? 'text-slate-400' : selectedHistorySummary.aboveMa50 ? 'text-red-500' : 'text-blue-500'}`}>
                        {selectedHistorySummary.aboveMa50 == null ? '--' : selectedHistorySummary.aboveMa50 ? '上回る' : '下回る'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">終値 vs MA200</span>
                      <span className={`font-black ${selectedHistorySummary.aboveMa200 == null ? 'text-slate-400' : selectedHistorySummary.aboveMa200 ? 'text-red-500' : 'text-blue-500'}`}>
                        {selectedHistorySummary.aboveMa200 == null ? '--' : selectedHistorySummary.aboveMa200 ? '上回る' : '下回る'}
                      </span>
                    </div>
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
          <div className="lg:hidden">
            <AdBanner variant="horizontal" />
          </div>
        </div>

        <div ref={chartSectionRef} className="lg:col-span-7 space-y-4 lg:sticky lg:top-24 lg:self-start">
          {/* モバイル: チャート上部に固定の銘柄変更バー */}
          <div className="lg:hidden sticky top-0 z-20 -mx-4 px-4 py-2 -mt-2 mb-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              type="button"
              onClick={() => setShowStockSelectorSheet(true)}
              className="w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-orange-500 shrink-0">{displayedStock?.code || '--'}</span>
                <span className="text-sm font-black text-slate-900 dark:text-white truncate">{displayedStock?.name || '銘柄を選択'}</span>
              </div>
              <ChevronDown size={18} className="text-slate-500 shrink-0" />
            </button>
          </div>

          {/* 銘柄選択ボトムシート (モバイル) */}
          {showStockSelectorSheet && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowStockSelectorSheet(false)} />
              <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">銘柄を選択</h3>
                  <button onClick={() => setShowStockSelectorSheet(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">×</button>
                </div>
                <div className="overflow-y-auto flex-1 p-2">
                  {groupedFilteredStocks.map((group) => (
                    <div key={group.sector} className="mb-4">
                      <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-2 py-1">{group.sector} ({group.stocks.length})</p>
                      <div className="space-y-1">
                        {group.stocks.map((stock) => (
                          <button
                            key={stock.id}
                            type="button"
                            onClick={() => { handleSelectStock(stock); setShowStockSelectorSheet(false); }}
                            className={`w-full p-4 rounded-xl text-left flex justify-between items-center transition ${displayedStock?.id === stock.id ? 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-2 border-transparent'}`}
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-orange-500 block">{stock.code}</span>
                              <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">{stock.name}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-sm font-bold block">{stock.price != null ? formatCurrency(stock.price, stock.region) : '--'}</span>
                              <span className={`text-xs font-bold block ${signedReturnTextClassTri(stock.rate, 'text-slate-400')}`}>
                                {stock.price != null ? `${stock.rate > 0 ? '+' : ''}${stock.rate.toFixed(2)}%` : ''}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {marketLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
              <div className="h-[420px] bg-slate-200 dark:bg-slate-800 rounded-3xl" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-14 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                <div className="h-14 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
              </div>
            </div>
          ) : displayedStock ? (
            <>
              <div className="flex justify-between items-end gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-sm font-black text-orange-500 dark:text-orange-400 font-mono">{displayedStock.code}</span>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{displayedStock.name}</h1>
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
                    {(Math.abs(Number(activePerformanceSummary?.rate ?? selectedHistorySummary?.dayRate ?? displayedStock.rate)) > 200) && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded">
                        データ異常の可能性（{displayedStock.code}）
                      </span>
                    )}
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

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden relative">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full transition ${
                          timeframe === tf
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-500 text-white">
                      終値ライン+移動平均
                    </span>
                    <button
                      onClick={() => setChartExpanded((v) => !v)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                    >
                      {chartExpanded ? '標準表示' : 'チャート拡大'}
                    </button>
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-orange-500">{displayedStock?.code}</span>
                      <div className={`w-1 h-1 rounded-full ${usingMockData ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      中間データ事業者
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono bg-slate-50/70 dark:bg-slate-900/40">
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700"><span className="text-[10px] text-slate-500 block">前日終値</span><span className="text-slate-900 dark:text-white font-bold">{formatDailyPrice(selectedHistorySummary?.prevClose, displayedStock?.region)}</span></div>
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700"><span className="text-[10px] text-slate-500 block">最新終値</span><span className="text-slate-900 dark:text-white font-bold">{formatDailyPrice(selectedHistorySummary?.latestClose ?? displayedStock?.price, displayedStock?.region)}</span></div>
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700"><span className="text-[10px] text-slate-500 block">{timeframe}高値終値</span><span className="text-slate-900 dark:text-white font-bold">{formatDailyPrice(chartHighLow.high, displayedStock?.region)}</span></div>
                  <div className="rounded-lg bg-white dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700"><span className="text-[10px] text-slate-500 block">{timeframe}安値終値</span><span className="text-slate-900 dark:text-white font-bold">{formatDailyPrice(chartHighLow.low, displayedStock?.region)}</span></div>
                </div>
                <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {chartHistoryLoading
                      ? '実際の終値履歴を読み込み中...'
                      : chartData.length > 0
                        ? `日次終値ベース (${displayedStock?.tradeDate || updatedDateLabel})`
                        : '表示できる終値履歴がありません。'}
                  </p>
                  {chartHistoryError ? (
                    <p className="mt-1 text-[10px] font-bold text-amber-500 dark:text-amber-400">{chartHistoryError}</p>
                  ) : null}
                </div>

                <div className={`${chartExpanded ? 'h-[720px]' : 'h-[540px]'} w-full bg-gradient-to-b from-white to-slate-50 dark:from-[#0B1221] dark:to-[#0F172A] relative transition-all duration-300`}>
                  <div
                    ref={chartInteractionRef}
                    onMouseDown={handlePanStart}
                    className={`h-full w-full ${(xWindowSize > 0 && xWindowSize < timeframeChartSeries.length) ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'} select-none`}
                  >
                  <div className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart syncId="stock-main" data={visibleChartSeries} margin={{ top: 16, right: 8, left: 8, bottom: 28 }}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" vertical stroke="#e2e8f0" />
                      <XAxis
                        dataKey="xKey"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(_, idx) => visibleChartSeries[idx]?.time || ''}
                      />
                      <YAxis
                        yAxisId="left"
                        orientation="right"
                        domain={chartPriceDomain}
                        allowDataOverflow
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(v) => Math.round(v)}
                        width={54}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area yAxisId="left" type="monotone" dataKey="close" stroke={chartColor} strokeWidth={2.4} fill="url(#colorPrice)" activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }} />
                      <Line yAxisId="left" type="monotone" dataKey="maShort" stroke="#f59e0b" strokeWidth={1.8} dot={false} connectNulls />
                      <Line yAxisId="left" type="monotone" dataKey="maLong" stroke="#a855f7" strokeWidth={1.8} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                  </div>
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        チャートは日次の終値ベースで可視化した参考表示です。1D / 5D も分足ではなく直近営業日の終値推移です。ヘッダーの期間リターンは営業日ベース（例: 1D=前営業日、1M≈22営業日、1Y≈252営業日）です。
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        拡大縮小・表示範囲の移動は下のボタンで操作できます
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
                  <div className="mt-1 flex items-center gap-3 text-[10px] font-bold">
                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"><span className="w-2 h-[2px] bg-red-500" /> 終値</span>
                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"><span className="w-2 h-[2px] bg-amber-500" /> MA{maWindows.shortWindow}</span>
                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"><span className="w-2 h-[2px] bg-violet-500" /> MA{maWindows.longWindow}</span>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                  <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4 flex items-center gap-2"><Info size={16} /> 企業情報</h3>
                  <div className="space-y-3 text-sm">
                    <InfoRow label="銘柄コード" val={displayedStock?.code || '--'} />
                    <InfoRow label="セクター" val={displayedStock?.sector || '--'} />
                    <InfoRow label="取引市場" val={displayedStock?.market || '--'} />
                    <InfoRow label="最新取引日" val={displayedStock?.tradeDate || updatedDateLabel || '--'} />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                  <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4 flex items-center gap-2"><Clock size={16} /> 適時開示・ニュース</h3>
                  <div className="space-y-4">
                    {stockNewsItems.map((item, i) => (
                      <button
                        key={`${item.title}-${i}`}
                        type="button"
                        onClick={() => {
                          if (item.url && isJapaneseNewsItem(item)) {
                            window.open(item.url, '_blank', 'noopener,noreferrer')
                          }
                        }}
                        disabled={!(item.url && isJapaneseNewsItem(item))}
                        className="block w-full text-left group cursor-pointer"
                      >
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition leading-snug">{item.title}</p>
                      </button>
                    ))}
                  </div>
                  {manualNewsUpdatedLabelJa ? (
                    <p className="mt-3 text-[10px] text-slate-400">
                      ニュースデータ更新: {manualNewsUpdatedLabelJa}
                    </p>
                  ) : (
                    <p className="mt-3 text-[10px] text-slate-400">ニュースデータ更新: 取得中または未設定</p>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                <h3 className="text-base font-black text-slate-700 dark:text-slate-200 mb-4">ウォッチリスト・ヘルスモニター</h3>
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
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{row.stock.name || row.stock.code}</span>
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

              <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                  <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <Wallet size={16} /> 執行先比較（取引は外部）
                  </h3>
                  <div className="space-y-3">
                    {PLATFORM_PARTNERS.map((p) => (
                      <a
                        key={p.name}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-orange-300 dark:hover:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{p.name}</p>
                          <ExternalLink size={14} className="text-slate-400" />
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">手数料 {p.fee}</span>
                          <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">{p.points}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{p.note}</p>
                      </a>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                    MoneyMartは比較・情報提供を行うプラットフォームです。実際の注文・口座開設は各社サイトで行います。
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    {LEGAL_NOTICE_TEMPLATES.investment}
                  </p>
              </div>

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
        <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-24 lg:self-start">
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
              ※ 当社（MoneyLab Ltd.）は金融商品取引業者ではありません。本ページの情報は参考情報の提供を目的としており、投資助言・売買の勧誘ではありません。投資の最終判断はご自身の責任でお願いします。
            </p>
          </div>
          <div className="hidden lg:block">
            <AdSidebar />
          </div>
          <div className="hidden lg:block">
            <AdBanner variant="vertical" />
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">プラットフォーム活用ヒント</p>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <li>・銘柄比較は価格と出来高をセットで確認</li>
              <li>・同一セクターで上位/下位を並べて判断</li>
              <li>・執行先比較で手数料・ポイント差をチェック</li>
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
    </div>
  )
}
