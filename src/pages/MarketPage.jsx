import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  ArrowRight, Crown,
  Zap, Map as MapIcon, ArrowUpRight, ArrowDownRight,
  Newspaper,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import AdBanner from '../components/AdBanner'
import AdSidebar from '../components/AdSidebar'
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../data/etfListFromXlsx'
import { fetchNewsManualData, getFallbackNewsData } from '../lib/newsManualClient'
import FearGreedIndex from '../components/market/FearGreedIndex'

const REGION_TICKER_LIST = [
  { symbol: 'ACWI', exposure: 'All World' },
  { symbol: 'MCHI', exposure: 'CHINA' },
  { symbol: '1329.T', exposure: 'NIKKEI (JAPAN)' },
  { symbol: '1475.T', exposure: 'JAPAN (Broad)' },
  { symbol: 'EUNK.DE', exposure: 'EUROPE' },
  { symbol: 'AAXJ', exposure: 'ASIA ex JAPAN' },
  { symbol: 'EEM', exposure: 'EM' },
  { symbol: 'IVV', exposure: 'US/LARGE CAP' },
  { symbol: 'IJH', exposure: 'US/Mid cap' },
  { symbol: 'IJR', exposure: 'US/SMALL CAP' },
]
const US_SECTOR_TICKER_LIST = [
  // Column G mapping source, shown in Japanese labels for UI.
  { symbol: 'IYE', sectorLabelJa: 'エネルギー' },
  { symbol: 'IYM', sectorLabelJa: '素材' },
  { symbol: 'IYJ', sectorLabelJa: '資本財・産業' },
  { symbol: 'IYC', sectorLabelJa: '一般消費財' },
  { symbol: 'IYK', sectorLabelJa: '生活必需品' },
  { symbol: 'IYH', sectorLabelJa: 'ヘルスケア' },
  { symbol: 'IYF', sectorLabelJa: '金融' },
  { symbol: 'IYW', sectorLabelJa: '情報技術' },
  { symbol: 'IYZ', sectorLabelJa: '通信サービス' },
  { symbol: 'IDU', sectorLabelJa: '公益事業' },
  { symbol: 'IYR', sectorLabelJa: '不動産' },
]

const uniqueBySymbol = (rows = []) => {
  const seen = new Set()
  return rows.filter((row) => {
    const symbol = String(row?.symbol || '').toUpperCase()
    if (!symbol || seen.has(symbol)) return false
    seen.add(symbol)
    return true
  })
}

const ETF_META_MAP = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))
const isJapaneseNewsItem = (item) => String(item?.language || '').toLowerCase() === 'ja'
const FALLBACK_WEEKLY_ECONOMIC_EVENTS = [
  { id: 'fallback-us-cpi', dateLabel: '3/10 (火)', country: 'US', event: '米国 消費者物価指数（CPI）', importance: 5 },
  { id: 'fallback-fomc', dateLabel: '3/17-18 (火-水)', country: 'US', event: 'FOMC 金利発表・経済見通し・ドットチャート', importance: 5 },
]
const CURATED_ECONOMIC_EVENTS = [
  { id: '2026-03-10-us-cpi', dateLabel: '3/10 (火)', country: 'US', category: '物価', event: '米国 消費者物価指数（CPI）発表', impact: '', importance: 5 },
  { id: '2026-03-17-fomc', dateLabel: '3/17-18 (火-水)', country: 'US', category: '金利', event: 'FOMC 金利発表（経済見通し・ドットチャート公表）', impact: '', importance: 5 },
  { id: '2026-03-18-ecb', dateLabel: '3/18-19 (水-木)', country: 'EU', category: '金利', event: 'ECB 金利発表', impact: '', importance: 5 },
  { id: '2026-03-19-boj', dateLabel: '3/19-20 (木-金)', country: 'JP', category: '金利', event: '日銀 金融政策決定会合', impact: '', importance: 5 },
  { id: '2026-03-23-jp-cpi', dateLabel: '3/23 (月)', country: 'JP', category: '物価', event: '日本 全国消費者物価指数（CPI）発表', impact: '', importance: 5 },
  { id: '2026-03-19-boe', dateLabel: '3/19 (木)', country: 'UK', category: '金利', event: '英中銀（BoE）金利発表', impact: '', importance: 5 },
  { id: '2026-04-27-boj', dateLabel: '4/27-28 (月-火)', country: 'JP', category: '金利', event: '日銀 金融政策決定会合・経済見通しレポート', impact: '', importance: 5 },
  { id: '2026-04-28-fomc', dateLabel: '4/28-29 (火-水)', country: 'US', category: '金利', event: 'FOMC 金利発表', impact: '', importance: 5 },
  { id: '2026-04-29-ecb', dateLabel: '4/29-30 (水-木)', country: 'EU', category: '金利', event: 'ECB 金利発表', impact: '', importance: 5 },
  { id: '2026-04-30-boe', dateLabel: '4/30 (木)', country: 'UK', category: '金利', event: '英中銀（BoE）金利発表', impact: '', importance: 5 },
  { id: '2026-05-12-msci', dateLabel: '5/12 (火)', country: 'GLOBAL', category: '資金フロー', event: 'MSCI 半期レビュー（グローバル資金フローの基準日）', impact: '', importance: 4 },
  { id: '2026-05-jp-gdp', dateLabel: '5月末', country: 'JP', category: '成長', event: '日本 1-3月期 GDP 速報値', impact: '', importance: 4 },
  { id: '2026-05-28-bok', dateLabel: '5/28 (木)', country: 'KR', category: '金利', event: '韓国銀行 金融通貨委員会（修正経済見通し公表）', impact: '', importance: 4 },
  { id: '2026-05-us-treasury-plan', dateLabel: '5月中', country: 'US', category: '国債', event: '米財務省 国債発行計画の公表（市場流動性の確認ポイント）', impact: '', importance: 3 },
]
const JP_THEME_TILES = [
  { symbol: '1478.T', name: '日本高配当株式' },
  { symbol: '2854.T', name: 'トップ20テック株式' },
]
const MARKET_THEME_DEFINITIONS = [
  {
    id: 'ai',
    label: 'AI',
    keywords: ['ai', '人工知能', '生成ai', 'nvidia', 'エヌビディア', 'microsoft', 'マイクロソフト', 'openai'],
    fundKeywords: ['NASDAQ', 'FANG', 'AI', '米国株式', 'S&P500'],
    sectorHints: ['情報技術', '通信サービス'],
    tileHints: ['トップ20テック株式'],
    stockCandidates: [
      { symbol: 'NVDA', patterns: ['nvidia', 'エヌビディア'] },
      { symbol: 'MSFT', patterns: ['microsoft', 'マイクロソフト'] },
      { symbol: '6758.T', patterns: ['ソニー', 'sony'] },
      { symbol: '9984.T', patterns: ['ソフトバンク', 'softbank'] },
    ],
  },
  {
    id: 'semiconductor',
    label: '半導体',
    keywords: ['半導体', 'semiconductor', 'chip', 'tsmc', 'asml', '東京エレクトロン', 'アドバンテスト'],
    fundKeywords: ['半導体', 'NASDAQ', 'FANG', 'テック'],
    sectorHints: ['情報技術'],
    tileHints: ['トップ20テック株式'],
    stockCandidates: [
      { symbol: '8035.T', patterns: ['東京エレクトロン', 'tokyo electron'] },
      { symbol: '6857.T', patterns: ['アドバンテスト', 'advantest'] },
      { symbol: 'ASML', patterns: ['asml'] },
      { symbol: 'NVDA', patterns: ['nvidia', 'エヌビディア'] },
    ],
  },
  {
    id: 'dividend',
    label: '配当',
    keywords: ['配当', '高配当', 'dividend', '利回り', 'インカム'],
    fundKeywords: ['高配当', 'REIT', '配当'],
    sectorHints: ['金融', '公益事業', '不動産'],
    tileHints: ['日本高配当株式'],
    stockCandidates: [
      { symbol: '8306.T', patterns: ['mufg', '三菱ufj', '三菱ufjフィナンシャル'] },
      { symbol: '9432.T', patterns: ['ntt', '日本電信電話'] },
      { symbol: '9433.T', patterns: ['kddi'] },
      { symbol: 'KO', patterns: ['coca-cola', 'coca cola', 'コカ・コーラ'] },
    ],
  },
  {
    id: 'fx',
    label: '為替',
    keywords: ['為替', '円安', '円高', 'usd/jpy', 'ドル円', 'fx', 'yen', 'dollar'],
    fundKeywords: ['全世界', '先進国', '米国株式', 'S&P500'],
    sectorHints: ['一般消費財', '資本財・産業'],
    tileHints: [],
    stockCandidates: [
      { symbol: '7203.T', patterns: ['トヨタ', 'toyota'] },
      { symbol: '7974.T', patterns: ['任天堂', 'nintendo'] },
      { symbol: 'AAPL', patterns: ['apple', 'アップル'] },
      { symbol: '6758.T', patterns: ['ソニー', 'sony'] },
    ],
  },
]
const normalizeThemeText = (value = '') => String(value || '').toLowerCase()
const includeThemeKeyword = (text, keyword) => normalizeThemeText(text).includes(normalizeThemeText(keyword))
const formatSignedPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
const COUNTRY_EVENT_META = {
  US: { label: '米国', flag: '🇺🇸', dotClass: 'bg-blue-500' },
  JP: { label: '日本', flag: '🇯🇵', dotClass: 'bg-red-500' },
  EU: { label: '欧州', flag: '🇪🇺', dotClass: 'bg-indigo-500' },
  UK: { label: '英国', flag: '🇬🇧', dotClass: 'bg-cyan-500' },
  KR: { label: '韓国', flag: '🇰🇷', dotClass: 'bg-rose-500' },
  GLOBAL: { label: 'グローバル', flag: '🌏', dotClass: 'bg-slate-500' },
}
const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土']
const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000

/** id から日付をパースし、今日以降のイベントのみ返す */
const filterUpcomingEconomicEvents = (events) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return events.filter((item) => {
    const match = String(item.id || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, y, m, d] = match
      const eventDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10))
      eventDate.setHours(0, 0, 0, 0)
      return eventDate >= today
    }
    const monthMatch = String(item.id || '').match(/^(\d{4})-(\d{2})-/)
    if (monthMatch) {
      const [, y, m] = monthMatch
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0)
      lastDay.setHours(0, 0, 0, 0)
      return lastDay >= today
    }
    return true
  })
}

const toTokyoDateLabel = (value) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--/--'
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = WEEKDAY_JA[date.getDay()] || ''
  return `${month}/${day} (${weekday})`
}

const toIsoDateDaysAgo = (days = 7) => {
  const d = new Date(Date.now() - Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

const normalizeImportance = (importance) => {
  const n = Number(importance || 0)
  if (!Number.isFinite(n) || n <= 0) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
}

const toEconomicEventItem = (row, idx) => {
  const rawCountry = String(row?.country || row?.Country || '').toUpperCase()
  const country = rawCountry.includes('US') || rawCountry.includes('UNITED') ? 'US' : 'JP'
  return {
    id: String(row?.id || row?.CalendarId || `${country}-${idx}`),
    dateLabel: toTokyoDateLabel(row?.date || row?.Date),
    country,
    event: String(row?.event || row?.Event || '').trim() || '経済指標',
    importance: normalizeImportance(row?.importance || row?.Importance),
  }
}

const shortenCategory = (name) => {
  if (!name) return 'その他'
  if (name.includes('米国')) return '米国株'
  if (name.includes('国内') || name.includes('日本')) return '日本株'
  if (name.includes('先進国')) return '先進国'
  if (name.includes('新興国')) return '新興国'
  if (name.includes('全世界')) return '全世界'
  if (name.includes('債券')) return '債券'
  if (name.includes('REIT')) return 'REIT'
  return 'その他'
}

const inferEtfRegion = (symbol = '') => {
  if (symbol.endsWith('.T')) return 'JP'
  if (symbol.endsWith('.L')) return 'UK'
  if (/\.(PA|AS|DE|MI|MC|SW|BR|LS|ST|HE)$/i.test(symbol)) return 'EU'
  return 'US'
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
  return inferEtfRegion(symbol)
}

const COUNTRY_LABEL_MAP = {
  JP: '日本',
  US: '米国',
  UK: '英国',
  EU: '欧州',
  CN: '中国',
  IN: 'インド',
  EM: '新興国',
  GLOBAL: '全世界',
}

const pickTileWeight = (volume, maxVolume) => {
  if (!Number.isFinite(volume) || volume <= 0) return 1
  const ratio = maxVolume > 0 ? volume / maxVolume : 0
  if (ratio >= 0.55) return 3
  if (ratio >= 0.2) return 2
  return 1
}

const getMarketLabelFromExposure = (exposure = '', symbol = '') => {
  const e = String(exposure || '').toUpperCase()
  if (e.includes('NIKKEI') || symbol === '1329.T') return '日本株式市場(日経225)'
  if (symbol.endsWith('.T')) return '日本株式市場'
  if (e.includes('US/LARGE')) return '米国大型株市場'
  if (e.includes('US/MID')) return '米国中型株市場'
  if (e.includes('US/SMALL')) return '米国小型株市場'
  if (e.includes('ALL WORLD') || e.includes('GLOBAL') || e.includes('ACWI')) return '全世界株式市場'
  if (e.includes('CHINA')) return '中国株式市場'
  if (e.includes('EUROPE')) return '欧州株式市場'
  if (e.includes('ASIA EX JAPAN')) return 'アジア(除く日本)株式市場'
  if (e.includes('EM')) return '新興国株式市場'
  return '株式市場'
}

const resolveHeatmapColorClass = (change) => {
  if (change >= 2) return 'bg-emerald-600'
  if (change >= 1) return 'bg-emerald-500'
  if (change >= 0) return 'bg-emerald-400'
  if (change >= -1) return 'bg-red-400'
  if (change >= -2) return 'bg-red-700'
  return 'bg-red-800'
}

export default function MarketPage({ session = null }) {
  const navigate = useNavigate()
  const [topFunds, setTopFunds] = useState([])
  const [inflowFunds, setInflowFunds] = useState([])
  const [liveFundSignals, setLiveFundSignals] = useState([])
  const [heatmapData, setHeatmapData] = useState([])
  const [heatmapDataDate, setHeatmapDataDate] = useState(null)
  const [regionPerformanceRows, setRegionPerformanceRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [marketDataStatus, setMarketDataStatus] = useState('')
  const [newsState, setNewsState] = useState(() => getFallbackNewsData())
  const [weeklyEconomicEvents] = useState(CURATED_ECONOMIC_EVENTS)
  const upcomingEconomicEvents = useMemo(() => filterUpcomingEconomicEvents(weeklyEconomicEvents), [weeklyEconomicEvents])
  const [jpThemeTiles, setJpThemeTiles] = useState([])
  const [showEconModal, setShowEconModal] = useState(false)
  const [selectedThemeId, setSelectedThemeId] = useState(MARKET_THEME_DEFINITIONS[0].id)

  const isLoggedIn = Boolean(session?.user)

  const tickerNews = (newsState.marketTicker || []).filter(isJapaneseNewsItem)
  const pickupNews = (newsState.marketPickup || []).filter(isJapaneseNewsItem)
  const fundNews = (newsState.fundPickup || []).filter(isJapaneseNewsItem)
  const disclosureNews = (newsState.stockDisclosures || []).filter(isJapaneseNewsItem)
  const effectiveTickerNews = tickerNews
  const effectivePickupNews = pickupNews
  const effectiveFundNews = fundNews
  const effectiveDisclosureNews = disclosureNews

  useEffect(() => {
    let cancelled = false
    const loadNews = async () => {
      try {
        const payload = await fetchNewsManualData()
        if (!cancelled) setNewsState(payload)
      } catch {
        if (!cancelled) setNewsState(getFallbackNewsData())
      }
    }
    loadNews()
    return () => { cancelled = true }
  }, [])
  // Keep a curated macro calendar list for mock/demo consistency.
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setMarketDataStatus('')
        let processed = []

        // Build heatmap from live ETF prices (v_stock_latest).
        const etfLatestRows = []
        for (let i = 0; i < ETF_SYMBOLS_FROM_XLSX.length; i += 80) {
          const batch = ETF_SYMBOLS_FROM_XLSX.slice(i, i + 80)
          const { data: latestBatch, error: latestErr } = await supabase
            .from('v_stock_latest')
            .select('symbol,trade_date,close,volume')
            .in('symbol', batch)
          if (latestErr) throw latestErr
          etfLatestRows.push(...(latestBatch || []))
        }
        const historyFromDate = toIsoDateDaysAgo(10)
        const etfRecentRows = []
        for (let i = 0; i < ETF_SYMBOLS_FROM_XLSX.length; i += 80) {
          const batch = ETF_SYMBOLS_FROM_XLSX.slice(i, i + 80)
          const { data: recentBatch, error: recentErr } = await supabase
            .from('stock_daily_prices')
            .select('symbol,trade_date,close')
            .in('symbol', batch)
            .gte('trade_date', historyFromDate)
            .order('trade_date', { ascending: false })
          if (recentErr) throw recentErr
          etfRecentRows.push(...(recentBatch || []))
        }
        const customHeatmapSymbols = [
          ...new Set([
            ...REGION_TICKER_LIST.map((row) => row.symbol),
            ...US_SECTOR_TICKER_LIST.map((row) => row.symbol),
          ]),
        ]
        const customLatestRows = []
        for (let i = 0; i < customHeatmapSymbols.length; i += 80) {
          const batch = customHeatmapSymbols.slice(i, i + 80)
          const { data: latestBatch, error: latestErr } = await supabase
            .from('v_stock_latest')
            .select('symbol,trade_date,close,volume')
            .in('symbol', batch)
          if (latestErr) throw latestErr
          customLatestRows.push(...(latestBatch || []))
        }
        const customRecentRows = []
        for (let i = 0; i < customHeatmapSymbols.length; i += 80) {
          const batch = customHeatmapSymbols.slice(i, i + 80)
          const { data: recentBatch, error: recentErr } = await supabase
            .from('stock_daily_prices')
            .select('symbol,trade_date,close')
            .in('symbol', batch)
            .gte('trade_date', historyFromDate)
            .order('trade_date', { ascending: false })
          if (recentErr) throw recentErr
          customRecentRows.push(...(recentBatch || []))
        }

        const buildPreviousCloseMap = (latestRows, historyRows) => {
          const bySymbol = new Map()
          for (const row of historyRows || []) {
            const symbol = String(row?.symbol || '').toUpperCase()
            if (!symbol) continue
            if (!bySymbol.has(symbol)) bySymbol.set(symbol, [])
            bySymbol.get(symbol).push(row)
          }
          const prevMap = new Map()
          for (const latest of latestRows || []) {
            const symbol = String(latest?.symbol || '').toUpperCase()
            const latestTradeDate = String(latest?.trade_date || '')
            const rows = bySymbol.get(symbol) || []
            const prev = rows.find((row) => String(row?.trade_date || '') < latestTradeDate)
            const prevClose = Number(prev?.close)
            if (Number.isFinite(prevClose) && prevClose > 0) {
              prevMap.set(symbol, prevClose)
            }
          }
          return prevMap
        }

        const etfPrevCloseMap = buildPreviousCloseMap(etfLatestRows, etfRecentRows)
        const customPrevCloseMap = buildPreviousCloseMap(customLatestRows, customRecentRows)
        const customLatestMap = new Map(
          customLatestRows
            .map((row) => [String(row.symbol || '').toUpperCase(), row])
        )

        const etfRows = etfLatestRows
          .map((row) => {
            const symbol = String(row?.symbol || '').toUpperCase()
            const close = Number(row?.close)
            const prevClose = Number(etfPrevCloseMap.get(symbol))
            if (!symbol || !Number.isFinite(close) || !Number.isFinite(prevClose) || prevClose <= 0) return null
            const change = ((close - prevClose) / prevClose) * 100
            const meta = ETF_META_MAP.get(symbol)
            const name = meta?.jpName || symbol
            return {
              symbol,
              name,
              category: shortenCategory(name),
              country: inferExposureCountry(symbol, name),
              change,
              volume: Math.max(0, Number(row.volume || 0)),
            }
          })
          .filter(Boolean)

        const jpThemeRows = JP_THEME_TILES.map((tile) => {
          const match = etfRows.find((row) => row.symbol === tile.symbol)
          if (!match || !Number.isFinite(Number(match.change))) return null
          return {
            symbol: tile.symbol,
            name: tile.name,
            change: Number(Number(match.change).toFixed(1)),
          }
        }).filter(Boolean)
        setJpThemeTiles(jpThemeRows)

        if (etfRows.length > 0) {
          processed = etfRows.map((row) => ({
            id: row.symbol,
            name: row.name,
            category: row.category,
            shortCat: row.category,
            // QUICK/funds fallback removed: use live ETF move as ranking signal.
            return1y: Number(row.change || 0),
            dayChange: Number(row.change || 0),
            // Proxy inflow from traded volume; normalize to human-readable unit.
            inflow: Number((Number(row.volume || 0) / 10000).toFixed(2)),
            country: row.country,
            price: 0,
          }))

          const sectorRows = uniqueBySymbol(US_SECTOR_TICKER_LIST).map((meta) => {
            const symbol = String(meta.symbol || '').toUpperCase()
            const live = customLatestMap.get(symbol)
            const close = Number(live?.close)
            const prevClose = Number(customPrevCloseMap.get(symbol))
            const validMove = Number.isFinite(prevClose) && Number.isFinite(close) && prevClose > 0
            if (!validMove) return null
            return {
              name: meta.sectorLabelJa || meta.symbol,
              change: Number((((close - prevClose) / prevClose) * 100).toFixed(1)),
              volume: Math.max(0, Number(live?.volume || 0)),
            }
          }).filter(Boolean)
          setHeatmapData(
            sectorRows
              .map((row) => ({
                name: row.name,
                change: row.change,
              }))
          )
          const latestHeatmapDate = customLatestRows.map((row) => String(row?.trade_date || '')).filter(Boolean).sort().at(-1) || null
          setHeatmapDataDate(latestHeatmapDate)

          const regionRows = REGION_TICKER_LIST
            .map((meta) => {
              const symbol = String(meta.symbol || '').toUpperCase()
              const live = customLatestMap.get(symbol)
              const close = Number(live?.close || 0)
              const prevClose = Number(customPrevCloseMap.get(symbol))
              if (!Number.isFinite(prevClose) || !Number.isFinite(close) || prevClose <= 0) return null
              const ret1m = Number((((close - prevClose) / prevClose) * 100).toFixed(1))
              const marketLabel = getMarketLabelFromExposure(meta.exposure, symbol)
              return {
                id: symbol,
                name: marketLabel,
                country: inferExposureCountry(symbol, meta.exposure),
                ret1m,
                volume: Math.max(0, Number(live?.volume || 0)),
              }
            })
            .filter(Boolean)
            .sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0))
          setRegionPerformanceRows(regionRows.map(({ volume, ...row }) => row))
        } else {
          setHeatmapData([])
          setHeatmapDataDate(null)
          setRegionPerformanceRows([])
          setJpThemeTiles([])
          setMarketDataStatus((prev) => prev || 'ヒートマップ用ETFデータがまだありません。')
        }

        setLiveFundSignals(processed)
        setTopFunds([...processed].sort((a, b) => b.return1y - a.return1y).slice(0, 5))
        setInflowFunds([...processed].sort((a, b) => b.inflow - a.inflow).slice(0, 5))
        if (!processed.length) {
          setLiveFundSignals([])
          setTopFunds([])
          setInflowFunds([])
          setMarketDataStatus('ETFランキングデータがまだありません。')
        }
      } catch (err) {
        console.error('Data Fetch Error:', err)
        setTopFunds([])
        setInflowFunds([])
        setLiveFundSignals([])
        setHeatmapData([])
        setHeatmapDataDate(null)
        setRegionPerformanceRows([])
        setJpThemeTiles([])
        setMarketDataStatus('ランキングデータの取得に失敗しました。')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
    const intervalId = window.setInterval(fetchData, DAILY_REFRESH_MS)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const market3LineSummary = useMemo(() => {
    const jp = regionPerformanceRows.find((row) => row.country === 'JP')
    const us = regionPerformanceRows.find((row) => row.country === 'US')
    const avgTop = topFunds.reduce((acc, cur) => acc + Number((cur.dayChange ?? cur.return1y) || 0), 0) / Math.max(topFunds.length, 1)
    const jpRet = Number(jp?.ret1m || 0)
    const usRet = Number(us?.ret1m || 0)
    const topHeadline = String(newsState?.dailyBrief?.headline || effectiveTickerNews[0]?.title || '').trim()
    const topHeadlineShort = topHeadline ? `${topHeadline.slice(0, 34)}${topHeadline.length > 34 ? '...' : ''}` : '主要ニュースは未取得'
    return [
      `指数: 日本 ${jpRet >= 0 ? '+' : ''}${jpRet.toFixed(1)}% / 米国 ${usRet >= 0 ? '+' : ''}${usRet.toFixed(1)}%`,
      `ニュース: ${topHeadlineShort}`,
      `ETF: 上位ファンド平均 ${avgTop >= 0 ? '+' : ''}${avgTop.toFixed(1)}% (当日)`,
    ]
  }, [effectiveTickerNews, newsState?.dailyBrief?.headline, regionPerformanceRows, topFunds])

  const autoThemes = useMemo(() => {
    const newsItems = [
      ...effectiveTickerNews,
      ...effectivePickupNews,
      ...effectiveFundNews,
      ...effectiveDisclosureNews,
    ]
    const newsText = newsItems
      .map((item) => `${item.title || ''} ${item.description || ''}`)
      .join(' ')

    const themes = MARKET_THEME_DEFINITIONS.map((theme) => {
      const newsHits = theme.keywords.reduce((sum, keyword) => (
        includeThemeKeyword(newsText, keyword) ? sum + 1 : sum
      ), 0)

      const sectorRows = heatmapData.filter((row) => theme.sectorHints.some((hint) => includeThemeKeyword(row.name, hint)))
      const sectorAvg = sectorRows.length > 0
        ? sectorRows.reduce((sum, row) => sum + Number(row.change || 0), 0) / sectorRows.length
        : 0

      const tileRows = jpThemeTiles.filter((row) => theme.tileHints.some((hint) => includeThemeKeyword(row.name, hint)))
      const tileAvg = tileRows.length > 0
        ? tileRows.reduce((sum, row) => sum + Number(row.change || 0), 0) / tileRows.length
        : 0

      const relatedFunds = liveFundSignals
        .filter((fund) => {
          const text = `${fund.name || ''} ${fund.shortCat || ''} ${fund.country || ''}`
          return theme.fundKeywords.some((keyword) => includeThemeKeyword(text, keyword))
        })
        .sort((a, b) => Number((b.dayChange ?? b.return1y) || 0) - Number((a.dayChange ?? a.return1y) || 0))
        .slice(0, 2)

      const mentionedStocks = theme.stockCandidates
        .filter((candidate) => candidate.patterns.some((pattern) => includeThemeKeyword(newsText, pattern)))
        .map((candidate) => candidate.symbol)

      const dominantSignal = [
        newsHits > 0 ? `関連ニュース ${newsHits}件` : null,
        Number.isFinite(sectorAvg) && sectorRows.length > 0 ? `関連セクター ${formatSignedPct(sectorAvg)}` : null,
        Number.isFinite(tileAvg) && tileRows.length > 0 ? `国内テーマ ${formatSignedPct(tileAvg)}` : null,
        relatedFunds[0] ? `関連ETF ${formatSignedPct(Number((relatedFunds[0].dayChange ?? relatedFunds[0].return1y) || 0))}` : null,
      ].filter(Boolean)

      if (dominantSignal.length === 0) return null

      const fallbackStocks = theme.stockCandidates
        .map((candidate) => candidate.symbol)
        .filter(Boolean)

      const relatedStocks = [...new Set([
        ...mentionedStocks,
        ...(mentionedStocks.length === 0 ? fallbackStocks : []),
      ])].slice(0, 3)

      const summary = `${dominantSignal.join(' / ')} を確認中。`

      const score = (newsHits * 3) + Math.max(sectorAvg, 0) + Math.max(tileAvg, 0) + Math.max(Number((relatedFunds[0]?.dayChange ?? relatedFunds[0]?.return1y) || 0), 0)

      return {
        id: theme.id,
        label: theme.label,
        summary,
        stocks: relatedStocks,
        funds: relatedFunds.map((fund) => fund.name),
        score,
      }
    })

    return themes
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
  }, [effectiveDisclosureNews, effectiveFundNews, effectivePickupNews, effectiveTickerNews, heatmapData, jpThemeTiles, liveFundSignals])

  useEffect(() => {
    if (!autoThemes.length) return
    if (!autoThemes.some((theme) => theme.id === selectedThemeId)) {
      setSelectedThemeId(autoThemes[0].id)
    }
  }, [autoThemes, selectedThemeId])

  const activeTheme = useMemo(
    () => autoThemes.find((theme) => theme.id === selectedThemeId) || autoThemes[0] || {
      id: 'fallback',
      label: 'テーマ',
      summary: '関連データはまだありません。',
      stocks: [],
      funds: [],
    },
    [autoThemes, selectedThemeId]
  )
  const newsUpdatedLabel = useMemo(() => {
    if (!newsState?.updatedAt) return 'ニュース基準: 取得中'
    const d = new Date(newsState.updatedAt)
    if (!Number.isFinite(d.getTime())) return 'ニュース基準: 取得中'
    return `ニュース基準: ${d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
  }, [newsState?.updatedAt])
  const marketDataBasisLabel = isLoading ? '市場データ基準: 更新中' : '市場データ基準: 最新保存値'

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 animate-fadeIn pb-24 min-h-screen bg-gray-50 dark:bg-slate-900 font-sans transition-colors duration-300">
      {/* 1. Scrolling News Ticker */}
      <div className="bg-slate-900 dark:bg-black text-white rounded-2xl shadow-md mb-6 border border-slate-700 overflow-hidden">
        <div className="py-3 overflow-hidden whitespace-nowrap">
          {effectiveTickerNews.length > 0 ? (
            <div className="inline-flex animate-ticker-market items-center gap-10 pl-4 pr-16 min-w-max">
              {[...effectiveTickerNews, ...effectiveTickerNews, ...effectiveTickerNews].map((item, i) => (
                <span key={`${item.source}-${i}`} className="flex items-center gap-2 text-xs md:text-sm shrink-0">
                  <span className="text-orange-400 font-black">{item.source}</span>
                  <span className="text-slate-200 font-bold">{item.title}</span>
                  <span className="text-slate-500 font-mono">{item.time}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="px-4 text-xs md:text-sm font-bold text-slate-400">
              日本語ニュースはまだありません
            </div>
          )}
        </div>
      </div>
      {marketDataStatus ? (
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-900/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300">
          {marketDataStatus}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-4">
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white">今日のマーケット3行要約</h3>
                <button
                  type="button"
                  onClick={() => navigate('/funds')}
                  className="text-xs font-black text-blue-600 dark:text-blue-300 inline-flex items-center gap-1"
                >
                  無料シミュレーターを試す <ArrowRight size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {marketDataBasisLabel}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {newsUpdatedLabel}
                </span>
              </div>
              <div className="space-y-2.5">
                {market3LineSummary.map((line) => (
                  <div key={line} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{line}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => navigate('/funds')}
                  className="px-3 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black"
                >
                  無料シミュレーターを試す
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/mypage')}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  マイページで家計診断
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/news')}
                  className="px-3 py-2 rounded-xl border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-300 text-xs font-black hover:bg-orange-50 dark:hover:bg-orange-950/20 inline-flex items-center justify-center gap-1"
                >
                  <Newspaper size={14} />
                  AIニュースを見る
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">最近の関連テーマ</h3>
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  自動集計
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  基準: 最近ニュース
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  基準: 当日ETF/セクター騰落率
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {autoThemes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedThemeId(theme.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-black border transition ${
                      activeTheme.id === theme.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-3">{activeTheme.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => navigate(activeTheme.stocks[0] ? `/stocks?symbol=${encodeURIComponent(activeTheme.stocks[0])}` : '/stocks')}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <p className="text-[10px] font-black text-slate-500 mb-1">関連株式</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {activeTheme.stocks.length > 0 ? activeTheme.stocks.join(' / ') : '該当データなし'}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(activeTheme.funds[0] ? `/funds?search=${encodeURIComponent(activeTheme.funds[0])}` : '/funds')}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <p className="text-[10px] font-black text-slate-500 mb-1">関連ファンド</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2">
                    {activeTheme.funds.length > 0 ? activeTheme.funds.join(' / ') : '該当データなし'}
                  </p>
                </button>
              </div>
              <div className="rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/80 dark:bg-orange-900/20 px-3 py-2.5">
                <p className="text-xs font-black text-orange-700 dark:text-orange-300">
                  {isLoggedIn ? 'テーマ関連の参考銘柄・ファンド' : '関連テーマの保存・確認は無料登録で'}
                </p>
              </div>
            </div>
          </section>

          {/* 2. Heatmap + Region Heatmap */}
          <div className="relative">
            <div className={`${!isLoggedIn ? 'blur-[6px] pointer-events-none select-none' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapIcon className="text-blue-600 dark:text-blue-400" size={20} /> セクターヒートマップ
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    本日の業種別騰落率 (サイズは時価総額)
                    {heatmapDataDate && (
                      <span className="ml-1.5 font-semibold text-slate-600 dark:text-slate-300">データ日: {heatmapDataDate}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 grid-rows-3 gap-2 h-[320px]">
                {isLoading ? (
                  <div className="col-span-4 row-span-3 flex items-center justify-center text-sm font-bold text-slate-400">
                    ヒートマップを読み込み中...
                  </div>
                ) : heatmapData.length === 0 ? (
                  <div className="col-span-4 row-span-3 flex items-center justify-center text-sm font-bold text-slate-400">
                    ヒートマップ用の実データがまだありません
                  </div>
                ) : heatmapData.map((item, idx) => {
                  const bgClass = resolveHeatmapColorClass(Number(item.change || 0))
                  return (
                    <div
                      key={idx}
                      className={`col-span-1 row-span-1 ${bgClass} rounded-xl p-4 flex flex-col items-center justify-center text-white transition hover:scale-[1.02] cursor-pointer shadow-sm relative overflow-hidden group`}
                    >
                      <span className="font-bold text-sm md:text-base z-10">{item.name}</span>
                      <span className="font-black text-lg md:text-xl z-10 flex items-center">
                        {item.change > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        {Math.abs(item.change)}%
                      </span>
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition" />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="md:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapIcon className="text-blue-600 dark:text-blue-400" size={20} /> 国家別ヒートマップ
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    本日の国家別騰落率 (ETF実データ)
                    {heatmapDataDate && (
                      <span className="ml-1.5 font-semibold text-slate-600 dark:text-slate-300">データ日: {heatmapDataDate}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 min-h-[320px]">
                {isLoading ? (
                  <div className="col-span-3 flex items-center justify-center text-sm font-bold text-slate-400 min-h-[320px]">
                    国家別データを読み込み中...
                  </div>
                ) : regionPerformanceRows.length === 0 ? (
                  <div className="col-span-3 flex items-center justify-center text-sm font-bold text-slate-400 min-h-[320px]">
                    国家別の実データがまだありません
                  </div>
                ) : regionPerformanceRows.map((row) => {
                  const bgClass = resolveHeatmapColorClass(Number(row.ret1m || 0))
                  return (
                    <div
                      key={row.id || `${row.country}-${row.name}`}
                      className={`col-span-1 ${bgClass} rounded-xl p-3 text-white shadow-sm relative overflow-hidden group cursor-pointer transition hover:scale-[1.02] flex flex-col justify-center`}
                    >
                      <p className="text-xs md:text-sm font-bold opacity-90">
                        {row.name}
                      </p>
                      <p className="text-xl font-black mt-2 inline-flex items-center gap-1">
                        {row.ret1m >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {row.ret1m >= 0 ? '+' : ''}{row.ret1m.toFixed(1)}%
                      </p>
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition" />
                    </div>
                  )
                })}
              </div>
                </div>
              </div>
            </div>
            {!isLoggedIn && (
              <div className="absolute inset-0 z-20 rounded-3xl border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-4">
                <div className="max-w-md w-full rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-4 text-center">
                  <p className="text-sm font-black text-amber-700 dark:text-amber-300">ヒートマップの詳細表示はログイン/会員登録後に利用できます。</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/login', { state: { from: '/market' } })}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-black"
                    >
                      ログイン
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/signup')}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs font-black hover:bg-amber-100 dark:hover:bg-amber-900/20"
                    >
                      会員登録
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">日本テーマヒートマップ</h3>
              <span className="text-[10px] font-bold text-slate-400">最新保存値</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {jpThemeTiles.length === 0 ? (
                <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm font-bold text-slate-400">
                  日本テーマの実データがまだありません
                </div>
              ) : jpThemeTiles.map((item) => (
                <div
                  key={item.symbol}
                  className={`${resolveHeatmapColorClass(Number(item.change || 0))} rounded-2xl p-4 text-white shadow-sm relative overflow-hidden group cursor-pointer transition hover:scale-[1.02]`}
                >
                  <p className="text-lg md:text-xl font-bold opacity-95">{item.name}</p>
                  <p className="text-lg md:text-xl font-black mt-2 inline-flex items-center gap-1">
                    {Number(item.change || 0) >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    {Number(item.change || 0) >= 0 ? '+' : ''}{Number(item.change || 0).toFixed(1)}%
                  </p>
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition" />
                </div>
              ))}
            </div>
          </div>

          {/* MoneyMart promo */}
          <div className="bg-gradient-to-r from-orange-50 via-white to-sky-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-2xl p-6 text-slate-900 dark:text-white shadow-sm relative overflow-hidden border border-orange-100 dark:border-slate-700">
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 border border-slate-900 text-xs font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] dark:bg-white dark:border-white dark:text-slate-900">
                  <Crown className="text-white dark:text-slate-900" size={14} fill="currentColor" />
                  MoneyMart
                </span>
                <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1.5 border border-orange-200 text-[11px] font-black text-orange-700 dark:bg-orange-500/20 dark:border-orange-300/30 dark:text-orange-100">
                  無料で使える
                </span>
                <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1.5 border border-sky-200 text-[11px] font-black text-sky-700 dark:bg-sky-500/15 dark:border-sky-300/25 dark:text-sky-100">
                  データ比較サポート
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1.5 border border-emerald-200 text-[11px] font-black text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-300/25 dark:text-emerald-100">
                  AIニュース要約
                </span>
              </div>
              <div className="max-w-3xl">
                <h3 className="text-2xl md:text-[28px] font-black leading-tight mb-2">
                  MoneyMartで、市場データとニュースを
                  <span className="text-orange-500 dark:text-orange-300">まとめて比較。</span>
                </h3>
                <p className="text-sm md:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  株式・ファンド・マーケット・AIニュースを一つの流れで確認できる、MoneyMartの情報ハブです。
                  判断材料を整理するための比較・把握支援にフォーカスしています。
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-3xl">
                <div className="rounded-xl border border-slate-200 bg-white/85 px-3 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em]">Market</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">ヒートマップとセンチメント</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/85 px-3 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em]">Funds</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">ETF・指数ファンド比較</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/85 px-3 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em]">News</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">日本語ニュースとAI要約</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-20 w-48 h-48 bg-orange-300/20 rounded-full blur-3xl dark:bg-orange-400/10" />
            <div className="absolute right-10 top-6 w-32 h-32 bg-sky-300/20 rounded-full blur-3xl dark:bg-sky-400/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">ニュース・ピックアップ</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {effectivePickupNews.length === 0 ? (
                  <div className="sm:col-span-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm font-bold text-slate-400">
                    ピックアップニュースはまだありません
                  </div>
                ) : effectivePickupNews.map((item, i) => (
                  <button
                    key={`${item.source}-${i}`}
                    type="button"
                    onClick={() => {
                      if (item.url && isJapaneseNewsItem(item)) {
                        window.open(item.url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    disabled={!(item.url && isJapaneseNewsItem(item))}
                    className="text-left rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-orange-300 dark:hover:border-orange-500/50 transition"
                  >
                    <div className="h-20 p-3 text-white relative overflow-hidden">
                      {item.imageUrl ? (
                        <>
                          <img src={item.imageUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-slate-900/55" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800" />
                      )}
                      <div className="relative z-10">
                        <p className="text-[10px] font-black opacity-90">{item.topic}</p>
                        <p className="text-xs font-bold mt-1 line-clamp-2">{item.title}</p>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold">{item.source}</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {newsState.updatedAt ? (
                <p className="mt-3 text-[10px] text-slate-400">
                  News update: {new Date(newsState.updatedAt).toLocaleString('ja-JP')}
                </p>
              ) : null}
            </div>
            <AdBanner variant="horizontal" />
          </div>

        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="relative">
            <div className={`${!isLoggedIn ? 'blur-[6px] pointer-events-none select-none' : ''}`}>
              <FearGreedIndex />
            </div>
            {!isLoggedIn && (
              <div className="absolute inset-0 z-20 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-3">
                <div className="text-center">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-300">Fear & Greedはログイン後に表示されます</p>
                  <button
                    type="button"
                    onClick={() => navigate('/login', { state: { from: '/market' } })}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-black"
                  >
                    ログイン
                  </button>
                </div>
              </div>
            )}
          </div>
          <AdBanner variant="compact" />

          <div className="relative">
            <div className={`${!isLoggedIn ? 'blur-[6px] pointer-events-none select-none' : ''}`}>
              <button
                type="button"
                onClick={() => setShowEconModal(true)}
                className="w-full bg-white dark:bg-slate-800 px-4 py-3.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition group text-left"
              >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Calendar size={16} className="text-orange-500 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800 dark:text-white">今週の経済指標</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{upcomingEconomicEvents.length}件 · クリックで一覧表示</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 group-hover:gap-2 transition-all shrink-0">
                開く <span className="text-sm">→</span>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
              <div className="grid grid-cols-1 gap-2">
                {upcomingEconomicEvents.slice(0, 2).map((item) => {
                  const meta = COUNTRY_EVENT_META[item.country] || { flag: '🌐', label: item.country || 'Global', dotClass: 'bg-slate-400' }
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">{meta.flag}</span>
                          <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dotClass}`} />
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 line-clamp-1">
                            {item.event}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{item.dateLabel}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
              </button>
            </div>
            {!isLoggedIn && (
              <div className="absolute inset-0 z-20 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-3">
                <div className="text-center">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-300">今週の経済指標はログイン後に開けます</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/login', { state: { from: '/market' } })}
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

          {/* 経済指標モーダル */}
          {showEconModal && (
            <>
              <div
                className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
                onClick={() => setShowEconModal(false)}
              />
              <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[85vh] flex flex-col">
                  {/* モーダルヘッダー */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <Calendar size={18} className="text-orange-500" />
                      <div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-white">今週の経済指標</h2>
                        <p className="text-[10px] text-slate-400 mt-0.5">{upcomingEconomicEvents.length}件のイベント</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEconModal(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-lg font-bold transition"
                    >
                      ×
                    </button>
                  </div>
                  {/* イベントリスト */}
                  <div className="overflow-y-auto flex-1 px-5 py-4">
                    <div className="relative border-l-2 border-slate-100 dark:border-slate-700 ml-2 space-y-4 pl-5 py-1">
                      {upcomingEconomicEvents.map((item) => {
                        const meta = COUNTRY_EVENT_META[item.country] || { label: item.country, flag: '🌐', dotClass: 'bg-slate-400' }
                        return (
                          <div key={item.id} className="relative">
                            <div className={`absolute -left-[27px] top-1.5 w-3 h-3 ${meta.dotClass} rounded-full border-2 border-white dark:border-slate-900`} />
                            <div className="text-[10px] font-bold text-slate-400 mb-1">{item.dateLabel}</div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                              {meta.flag} {item.event}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.category && (
                                <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full">
                                  {item.category}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{meta.label}</span>
                              <span className="text-[10px] text-orange-500 font-black">{'★'.repeat(item.importance)}</span>
                            </div>
                            {item.impact && (
                              <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-2">
                                {item.impact}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {/* フッター */}
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowEconModal(false)}
                      className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black hover:opacity-90 transition"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-5 leading-relaxed">
        {LEGAL_NOTICE_TEMPLATES.investment}
      </p>
      <div className="mt-4 lg:hidden">
        <AdBanner variant="horizontal" />
      </div>
    </div>
  )
}
