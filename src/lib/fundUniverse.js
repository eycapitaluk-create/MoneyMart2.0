import { supabase } from './supabase'
import { ETF_LIST_FROM_XLSX } from '../data/etfListFromXlsx'
import { getEtfJpName } from '../data/etfJpNameMap'
import { normalizeFundDisplayName } from './fundDisplayUtils'
import { normalizeNisaCategoryField } from './textEncodingUtils'
import { findBaseCloseByCalendarOffset } from './calendarDateUtils'
import { buildSplitAdjustedCloses, skipEodSplitHeuristicForSymbol } from './fundAdjustedCloses'
import { fetchStockDailyHistoryBySymbolMap } from './stockDailyHistory'

const FUND_UNIVERSE_CACHE_KEY = 'moneymart.fund.universe.snapshot.v1'
const FUND_UNIVERSE_CACHE_TTL_MS = 1000 * 60 * 5
let fundUniverseMemoryCache = null

const sanitizeUniverseNisa = (payload) =>
  Array.isArray(payload)
    ? payload.map((f) => ({ ...f, nisaCategory: normalizeNisaCategoryField(f?.nisaCategory) }))
    : payload

const ETF_META_MAP = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))
const ETF_SYMBOLS = ETF_LIST_FROM_XLSX.map((item) => item.symbol).filter(Boolean)

const readCache = () => {
  const now = Date.now()
  if (fundUniverseMemoryCache && (now - Number(fundUniverseMemoryCache.cachedAt || 0)) < FUND_UNIVERSE_CACHE_TTL_MS) {
    return sanitizeUniverseNisa(fundUniverseMemoryCache.payload)
  }
  try {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(FUND_UNIVERSE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || (now - Number(parsed.cachedAt || 0)) >= FUND_UNIVERSE_CACHE_TTL_MS) return null
    fundUniverseMemoryCache = parsed
    return sanitizeUniverseNisa(parsed.payload || null)
  } catch {
    return null
  }
}

const readStaleCache = () => {
  if (fundUniverseMemoryCache?.payload?.length) return sanitizeUniverseNisa(fundUniverseMemoryCache.payload)
  try {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(FUND_UNIVERSE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.payload) ? sanitizeUniverseNisa(parsed.payload) : null
  } catch {
    return null
  }
}

const writeCache = (payload) => {
  const record = { cachedAt: Date.now(), payload }
  fundUniverseMemoryCache = record
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(FUND_UNIVERSE_CACHE_KEY, JSON.stringify(record))
    }
  } catch {
    // ignore storage errors
  }
}

const detectCategory = (symbol, name) => {
  const n = String(name || '').toUpperCase()
  if (n.includes('全世界') || n.includes('GLOBAL') || n.includes('ACWI')) return '全世界株式'
  if (n.includes('米国') || n.includes('S&P') || n.includes('NASDAQ') || n.includes('US')) return '米国株式'
  if (n.includes('先進国') || n.includes('KOKUSAI') || n.includes('EUROPE')) return '先進国株式'
  if (n.includes('新興国') || n.includes('EMERGING') || n.includes('INDIA') || n.includes('中国')) return '新興国株式'
  if (n.includes('TOPIX') || n.includes('日経') || n.includes('日本') || symbol.endsWith('.T')) return '国内株式'
  if (n.includes('REIT') || n.includes('リート')) return 'REIT'
  if (n.includes('債券') || n.includes('BOND')) return '債券'
  if (n.includes('金') || n.includes('GOLD') || n.includes('銀') || n.includes('原油') || n.includes('COMMODITY')) return 'コモディティ'
  if (n.includes('高配当') || n.includes('DIVIDEND')) return '配当'
  if (n.includes('半導体') || n.includes('TECH')) return 'テクノロジー'
  if (n.includes('銀行') || n.includes('金融') || n.includes('BANK')) return '金融'
  return 'その他'
}

const fetchHistoryBySymbol = async (symbol, cutoffStr) => {
  const { data, error } = await supabase
    .from('stock_daily_prices')
    .select('symbol,trade_date,close,volume')
    .eq('symbol', symbol)
    .gte('trade_date', cutoffStr)
    .order('trade_date', { ascending: true })
    .limit(400)
  if (error) throw error
  return data || []
}

const buildLocalFallbackSnapshot = () => {
  return ETF_LIST_FROM_XLSX
    .map((item) => {
      const symbol = String(item?.symbol || '').trim()
      if (!symbol) return null
      const displayName = normalizeFundDisplayName(item?.jpName || getEtfJpName(symbol) || symbol)
      const trustFeeValue = Number(item?.trustFee)
      return {
        id: symbol,
        symbol,
        fundName: displayName,
        exchange: symbol.endsWith('.T') ? 'TSE' : 'US',
        category: detectCategory(symbol, displayName),
        trustFee: Number.isFinite(trustFeeValue) ? trustFeeValue : null,
        nisaCategory: String(item?.nisaCategory || '').trim() || '-',
        returnRate1Y: null,
        avgVolume: 0,
        basePrice: 0,
        dayChangePct: 0,
      }
    })
    .filter(Boolean)
}

export const fetchFundUniverseSnapshot = async () => {
  const cached = readCache()
  if (Array.isArray(cached) && cached.length > 0) return cached

  try {
    const latestRows = []
    for (let i = 0; i < ETF_SYMBOLS.length; i += 80) {
      const batch = ETF_SYMBOLS.slice(i, i + 80)
      const { data, error } = await supabase
        .from('v_stock_latest')
        .select('symbol,trade_date,open,close,volume')
        .in('symbol', batch)
      if (error) throw error
      latestRows.push(...(data || []))
    }

    const { data: symbolRows, error: symbolErr } = await supabase
      .from('stock_symbols')
      .select('symbol,name,exchange,trust_fee,nisa_category')
      .limit(5000)
    if (symbolErr) throw symbolErr

    const symbolMap = new Map((symbolRows || []).map((row) => [row.symbol, row]))
    const latestMap = new Map(
      (latestRows || [])
        .filter((row) => row?.symbol && ETF_META_MAP.has(row.symbol))
        .map((row) => [row.symbol, row])
    )

    const sortedSymbols = [...latestMap.values()]
      .sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0))
      .map((row) => row.symbol)

    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const historyBySymbol = await fetchStockDailyHistoryBySymbolMap(supabase, sortedSymbols, cutoffStr, {
      select: 'symbol,trade_date,close,volume,source,fetched_at',
      jpDedupe: true,
      jpSourceFilter: null,
      jpChunkSize: 20,
      nonJpChunkSize: 28,
      parallelChunks: 8,
    })

    const funds = [...latestMap.keys()].map((symbol) => {
      const latest = latestMap.get(symbol) || {}
      const meta = symbolMap.get(symbol) || {}
      const xlsxMeta = ETF_META_MAP.get(symbol)
      const history = historyBySymbol.get(symbol) || []
      const rawClose = Number(latest.close || 0)
      const open = Number(latest.open || 0)
      const adjustedClosesRaw = buildSplitAdjustedCloses(history, {
        skipSplitHeuristic: skipEodSplitHeuristicForSymbol(symbol),
      })
      const closes = adjustedClosesRaw.filter((value) => Number.isFinite(value) && value > 0)
      const close = Number(adjustedClosesRaw[adjustedClosesRaw.length - 1] || rawClose || 0)
      const volumes = history.map((row) => Number(row.volume)).filter((value) => Number.isFinite(value) && value >= 0)
      const historyCount = closes.length
      const oneYearBaseClose = findBaseCloseByCalendarOffset(history, { years: 1 }, adjustedClosesRaw)
      const firstTradeDateRaw = history[0]?.trade_date
      const latestTradeDateRaw = history[Math.max(0, history.length - 1)]?.trade_date
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
      const return1y = hasReliableOneYearHistory && oneYearBaseClose != null && oneYearBaseClose > 0 && close > 0
        ? ((close - oneYearBaseClose) / oneYearBaseClose) * 100
        : null
      const trustFeeValue = Number.isFinite(Number(meta.trust_fee)) ? Number(meta.trust_fee) : Number(xlsxMeta?.trustFee)
      const avgVolume = volumes.length > 0
        ? volumes.slice(-30).reduce((sum, value) => sum + value, 0) / Math.min(30, volumes.length)
        : Math.max(0, Number(latest.volume || 0))
      const displayName = normalizeFundDisplayName(xlsxMeta?.jpName || getEtfJpName(symbol) || meta.name || symbol)

      return {
        id: symbol,
        symbol,
        fundName: displayName,
        exchange: String(meta.exchange || (symbol.endsWith('.T') ? 'TSE' : 'US')).trim(),
        category: detectCategory(symbol, displayName),
        trustFee: Number.isFinite(trustFeeValue) ? trustFeeValue : null,
        nisaCategory: normalizeNisaCategoryField(meta.nisa_category || xlsxMeta?.nisaCategory),
        returnRate1Y: Number.isFinite(return1y) ? Number(return1y) : null,
        avgVolume,
        basePrice: close,
        dayChangePct: open > 0 && close > 0 ? ((close - open) / open) * 100 : 0,
      }
    })

    writeCache(funds)
    return funds
  } catch {
    const stale = readStaleCache()
    if (Array.isArray(stale) && stale.length > 0) return stale
    const localFallback = buildLocalFallbackSnapshot()
    writeCache(localFallback)
    return localFallback
  }
}
