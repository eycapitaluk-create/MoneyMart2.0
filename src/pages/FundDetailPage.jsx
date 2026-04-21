import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, Loader2 } from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, ReferenceArea,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../data/etfListFromXlsx'
import { FUND_DESCRIPTIONS_BY_ISIN } from '../data/fundDescriptionsByIsin'

const FUND_SYMBOL_SET = new Set(ETF_SYMBOLS_FROM_XLSX.map((s) => String(s || '').toUpperCase()))
import { trackAnalyticsEvent } from '../lib/analytics'
import { normalizeFundDisplayName } from '../lib/fundDisplayUtils'
import { findBaseCloseByCalendarOffset } from '../lib/calendarDateUtils'
import {
  buildSplitAdjustedCloses,
  chartDownsampleIndices,
  resolveSpotCloseAndSessionChange,
  skipEodSplitHeuristicForSymbol,
} from '../lib/fundAdjustedCloses'
import { dedupeStockDailyPricesByTradeDate } from '../lib/stockDailyHistory'
import { signedReturnTextClassStrong } from '../lib/marketDirectionColors'

const ETF_META_MAP = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))
const FUND_DETAIL_CACHE_TTL_MS = 1000 * 60 * 5
const fundDetailMemoryCache = new Map()
const getFundDetailCacheKey = (symbol) => `mm_fund_detail_cache:v6:${String(symbol || '').toUpperCase()}`
const readFundDetailCache = (symbol) => {
  const key = getFundDetailCacheKey(symbol)
  const now = Date.now()
  const inMemory = fundDetailMemoryCache.get(key)
  if (inMemory && (now - Number(inMemory.cachedAt || 0)) < FUND_DETAIL_CACHE_TTL_MS) {
    return inMemory.payload
  }
  try {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || (now - Number(parsed.cachedAt || 0)) >= FUND_DETAIL_CACHE_TTL_MS) return null
    fundDetailMemoryCache.set(key, parsed)
    return parsed.payload || null
  } catch {
    return null
  }
}
const writeFundDetailCache = (symbol, payload) => {
  const key = getFundDetailCacheKey(symbol)
  const record = { cachedAt: Date.now(), payload }
  fundDetailMemoryCache.set(key, record)
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(key, JSON.stringify(record))
    }
  } catch {
    // ignore storage errors
  }
}

const fmtPct = (v) => {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}
const formatMonthDay = (isoDate) => {
  const [year, month, day] = String(isoDate || '').split('-')
  if (!year || !month || !day) return String(isoDate || '')
  return `${Number(month)}/${Number(day)}`
}
const fmtNum = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString() : '-')
const fmtPrice = (v) => (Number.isFinite(Number(v)) ? `¥${Number(v).toLocaleString()}` : '-')
const formatTrustFee = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(2)}%`
}

/** xlsx の aum_oku_yen（億円単位の数値）を表示用に整形。1兆円=1万億円換算で兆表記 */
const formatAumOkuYen = (oku) => {
  const v = Number(oku)
  if (!Number.isFinite(v) || v <= 0) return null
  if (v >= 10000) return `${(v / 10000).toFixed(2)}兆円`
  return `${v.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}億円`
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

const RSI_PERIOD = 14
const calculateRSI = (closes = [], period = RSI_PERIOD) => {
  const arr = (Array.isArray(closes) ? closes : []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)
  if (arr.length < period + 1) return []
  const rsi = []
  for (let i = 0; i < arr.length; i += 1) {
    if (i < period) {
      rsi.push(null)
      continue
    }
    let sumGain = 0
    let sumLoss = 0
    for (let j = i - period + 1; j <= i; j += 1) {
      const delta = arr[j] - arr[j - 1]
      if (delta > 0) sumGain += delta
      else if (delta < 0) sumLoss += Math.abs(delta)
    }
    const avgGain = sumGain / period
    const avgLoss = sumLoss / period
    if (avgLoss === 0) {
      rsi.push(100)
      continue
    }
    const rs = avgGain / avgLoss
    rsi.push(100 - 100 / (1 + rs))
  }
  return rsi
}

const classifyFundTheme = (name = '') => {
  const n = String(name || '').toUpperCase()
  if (n.includes('NASDAQ')) return '米国ハイテク株'
  if (n.includes('S&P 500') || n.includes('S&P500')) return '米国大型株'
  if (n.includes('ダウ') || n.includes('DOW')) return '米国主要株'
  if (n.includes('TOPIX')) return '日本株（TOPIX）'
  if (n.includes('日経２２５') || n.includes('日経225') || n.includes('NIKKEI')) return '日本株（日経平均）'
  if (n.includes('JPX日経') || n.includes('JPX')) return '日本株（JPX指数）'
  if (n.includes('Ｊリート') || n.includes('J-REIT') || n.includes('REIT')) return '不動産投資信託（REIT）'
  if (n.includes('米国債') || n.includes('国債') || n.includes('社債') || n.includes('BOND')) return '債券'
  if (n.includes('全世界') || n.includes('オール・カントリー') || n.includes('ACWI') || n.includes('KOKUSAI')) return '全世界株式'
  if (n.includes('新興国') || n.includes('EMERGING')) return '新興国株式'
  if (n.includes('金') || n.includes('GOLD')) return '金'
  if (n.includes('銀') || n.includes('SILVER')) return '銀'
  if (n.includes('プラチナ') || n.includes('PLATINUM')) return 'プラチナ'
  if (n.includes('原油') || n.includes('CRUDE') || n.includes('WTI')) return '原油'
  if (n.includes('半導体')) return '半導体関連株'
  if (n.includes('高配当') || n.includes('DIVIDEND')) return '高配当株'
  return '主要株価指数'
}

const buildGeneratedDescription = (symbol, fundName) => {
  const name = String(fundName || '')
  const upper = name.toUpperCase()
  const theme = classifyFundTheme(name)
  const isLeveraged = /レバレッジ|ブル2倍|ブル２倍|2倍|2X|LEVERAGED/.test(name) || /^(1570|1579|1568|2036)\.T$/.test(symbol)
  const isInverse = /インバース|ベア|ダブルインバース|INVERSE/.test(name)
  const isEtN = /ETN|NEXT NOTES/.test(upper)
  const isHedged = /ヘッジ|Ｈ有|\(H\)|\(Ｈ\)|Hあり|H有/.test(name)

  if (isLeveraged) {
    return `${theme}の値動きに対して概ね2倍程度の値動きを目指すレバレッジ型の${isEtN ? '上場投資商品（ETN）' : 'ETF'}です。短期的には上昇局面で効果が出やすい一方、下落局面やボラティリティ上昇時の値動きには注意が必要です。`
  }
  if (isInverse) {
    return `${theme}の逆方向の値動きを目指すインバース型ETFです。相場下落時のヘッジ用途で使われる一方、長期保有では乖離が生じる可能性があります。`
  }
  if (theme === '金' || theme === '銀' || theme === 'プラチナ' || theme === '原油') {
    return `${theme}価格への連動を目指す${isEtN ? 'ETN' : 'ETF'}です。株式とは異なる値動き特性を持つため、分散投資やインフレ局面の補完として活用されることがあります。`
  }
  if (theme === '債券') {
    return `${theme}指数に連動するETFです。${isHedged ? '為替ヘッジありの設計で、' : ''}株式ETFと比べて値動きが相対的に穏やかな傾向があり、ポートフォリオの安定化に用いられます。`
  }
  return `${theme}指数への連動を目指す${isEtN ? '上場投資商品（ETN）' : 'ETF'}です。${isHedged ? '為替ヘッジを活用し、為替変動の影響を抑える設計です。' : '市場全体の値動きを低コストで取り込みやすい設計です。'}`
}

const normalizeDescriptionTypography = (text = '') => {
  const halfWidth = String(text || '')
    // Convert full-width ASCII variants to half-width (e.g. ＴＯＰＩＸ -> TOPIX).
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ')
  return halfWidth
    // Normalize TOPIX sector index notation (TOPIXー17 -> TOPIX-17).
    .replace(/([A-Za-z])ー(?=\d)/g, '$1-')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const getFundDescription = (symbol, isin, fundName) => {
  const symbolKey = String(symbol || '').toUpperCase()
  const isinKey = String(isin || '').trim().toUpperCase()
  if (isinKey && FUND_DESCRIPTIONS_BY_ISIN[isinKey]) {
    return normalizeDescriptionTypography(FUND_DESCRIPTIONS_BY_ISIN[isinKey])
  }
  return normalizeDescriptionTypography(buildGeneratedDescription(symbolKey, fundName))
}

export default function FundDetailPage({ myWatchlist = [], toggleWatchlist }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [chartTimeline, setChartTimeline] = useState('YTD')

  const symbol = useMemo(() => String(id || '').trim().toUpperCase(), [id])
  const isWatchlisted = Array.isArray(myWatchlist) && myWatchlist.includes(symbol)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [symbol])

  useEffect(() => {
    if (!symbol) return
    trackAnalyticsEvent('fund_detail_view', {
      product_type: 'fund',
      product_id: symbol,
      source: 'fund_detail_page',
    })
  }, [symbol])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!symbol) return
      if (!FUND_SYMBOL_SET.has(symbol)) {
        navigate('/funds', { replace: true })
        return
      }
      const cached = readFundDetailCache(symbol)
      if (cached) {
        setDetail(cached)
        setLoading(false)
      } else {
        setDetail(null)
        setLoading(true)
      }
      setError('')
      try {
        const cutoff = new Date()
        cutoff.setFullYear(cutoff.getFullYear() - 1)
        const cutoffStr = cutoff.toISOString().slice(0, 10)

        const [
          { data: latestRows, error: latestErr },
          { data: symbolRows, error: symbolErr },
          { data: historyRows, error: historyErr },
          { data: jpAumRows, error: jpAumErr },
        ] = await Promise.all([
          supabase.from('v_stock_latest').select('symbol,trade_date,open,high,low,close,volume').eq('symbol', symbol).limit(1),
          supabase.from('stock_symbols').select('symbol,name,exchange,trust_fee,nisa_category').eq('symbol', symbol).limit(1),
          supabase
            .from('stock_daily_prices')
            .select('symbol,trade_date,open,high,low,close,volume,source,fetched_at')
            .eq('symbol', symbol)
            .gte('trade_date', cutoffStr)
            .order('trade_date', { ascending: true })
            .limit(800),
          supabase
            .from('stock_daily_prices')
            .select('trade_date, raw')
            .eq('symbol', symbol)
            .eq('source', 'jp_etf_csv')
            .order('trade_date', { ascending: false })
            .limit(1),
        ])
        if (latestErr) throw latestErr
        if (symbolErr) throw symbolErr
        if (historyErr) throw historyErr
        if (jpAumErr) throw jpAumErr

        const latest = (latestRows || [])[0]
        if (!latest) {
          setDetail(null)
          setError('この銘柄の最新データがありません。')
          return
        }
        const profile = (symbolRows || [])[0] || {}
        const xlsxMeta = ETF_META_MAP.get(symbol)
        const history = dedupeStockDailyPricesByTradeDate(historyRows || [])
        const trustFeeValue = Number.isFinite(Number(profile.trust_fee)) ? Number(profile.trust_fee) : Number(xlsxMeta?.trustFee)
        const normalizedNisaCategory = String(profile.nisa_category || xlsxMeta?.nisaCategory || '').trim() || '-'
        const adjustedClosesRaw = buildSplitAdjustedCloses(history, {
          skipSplitHeuristic: skipEodSplitHeuristicForSymbol(symbol),
        })
        const closes = adjustedClosesRaw.filter((v) => Number.isFinite(v) && v > 0)
        const volumes = history.map((r) => Number(r.volume)).filter((v) => Number.isFinite(v) && v >= 0)
        const {
          close,
          sessionDod,
          latestAhead: latestIsAheadOfHistory,
          latestDate,
          latestCloseNum,
        } = resolveSpotCloseAndSessionChange(history, adjustedClosesRaw, latest)
        const open = Number(latest.open || 0)
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
        const hasReliableOneYearHistory = closes.length >= 2 && historySpanDays >= 330
        const return1y = hasReliableOneYearHistory && oneYearBaseClose != null && oneYearBaseClose > 0 ? ((close - oneYearBaseClose) / oneYearBaseClose) * 100 : null
        const vol = calculateRealizedVolatility(closes)
        const sharpe = (Number.isFinite(return1y) && Number.isFinite(vol) && vol > 0) ? (return1y / vol) : null
        const avgVol30 = volumes.length > 0
          ? volumes.slice(-30).reduce((acc, cur) => acc + cur, 0) / Math.min(30, volumes.length)
          : Number(latest.volume || 0)
        const yearStartStr = `${new Date().getFullYear()}-01-01`
        const ytdFirstIdx = history.findIndex((r) => String(r?.trade_date || '') >= yearStartStr)
        const ytdBaseClose = ytdFirstIdx >= 0 ? Number(adjustedClosesRaw[ytdFirstIdx] ?? history[ytdFirstIdx]?.close ?? 0) : null
        const returnYTD = (ytdBaseClose != null && ytdBaseClose > 0 && close > 0)
          ? ((close - ytdBaseClose) / ytdBaseClose) * 100
          : null
        const change = Number.isFinite(sessionDod.change) ? sessionDod.change : null
        const changePct = Number.isFinite(sessionDod.changePct) ? sessionDod.changePct : null

        let aumOkuYen = null
        const jpAumRow = (jpAumRows || [])[0]
        const rawAum = jpAumRow?.raw
        if (rawAum && typeof rawAum === 'object' && Number.isFinite(Number(rawAum.aum_oku_yen)) && Number(rawAum.aum_oku_yen) > 0) {
          aumOkuYen = Number(rawAum.aum_oku_yen)
        } else if (typeof rawAum === 'string') {
          try {
            const parsed = JSON.parse(rawAum)
            if (parsed && Number.isFinite(Number(parsed.aum_oku_yen)) && Number(parsed.aum_oku_yen) > 0) {
              aumOkuYen = Number(parsed.aum_oku_yen)
            }
          } catch { /* ignore */ }
        }

        const rsiValues = calculateRSI(adjustedClosesRaw)
        const chartData = chartDownsampleIndices(history.length, 70)
          .map((idx) => {
            const row = history[idx]
            return {
              date: formatMonthDay(row.trade_date),
              isoDate: String(row.trade_date || ''),
              close: Number(adjustedClosesRaw[idx] || row.close || 0),
              volume: Number(row.volume || 0),
              rsi: Number.isFinite(rsiValues[idx]) ? Number(rsiValues[idx].toFixed(1)) : null,
            }
          })
        if (
          latestIsAheadOfHistory
          && Number.isFinite(latestCloseNum)
          && latestCloseNum > 0
          && latestDate
        ) {
          chartData.push({
            date: formatMonthDay(latestDate),
            isoDate: latestDate,
            close: latestCloseNum,
            volume: Number(latest.volume || 0),
            rsi: null,
          })
        }

        /** 出来高は「高出来高の日」が間引きで落ちると誤解を招くため、価格/RSI とは別に全日（取得範囲内）を保持 */
        const volumeChartData = history.map((row) => ({
          date: formatMonthDay(row.trade_date),
          isoDate: String(row.trade_date || ''),
          volume: Number(row.volume || 0),
        }))
        if (latestIsAheadOfHistory && latestDate) {
          volumeChartData.push({
            date: formatMonthDay(latestDate),
            isoDate: latestDate,
            volume: Number(latest.volume || 0),
          })
        }

        const nextDetail = {
          symbol,
          isin: xlsxMeta?.isin || '-',
          jpName: normalizeFundDisplayName(xlsxMeta?.jpName || profile.name || symbol),
          exchange: profile.exchange || '-',
          tradeDate: latest.trade_date || '',
          close,
          open,
          high: Number(latest.high || 0),
          low: Number(latest.low || 0),
          volume: Number(latest.volume || 0),
          change,
          changePct,
          return1y,
          volatility: vol,
          sharpe,
          trustFee: Number.isFinite(trustFeeValue) ? trustFeeValue : null,
          nisaCategory: normalizedNisaCategory,
          avgVol30,
          returnYTD: Number.isFinite(returnYTD) ? Number(returnYTD) : null,
          aumOkuYen,
          chartData,
          volumeChartData,
        }
        if (cancelled) return
        setDetail(nextDetail)
        writeFundDetailCache(symbol, nextDetail)
      } catch (e) {
        if (!cancelled) {
          setError(e.message || '読み込みに失敗しました。')
          setDetail(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [symbol])

  const visibleChartData = useMemo(() => {
    const rows = Array.isArray(detail?.chartData) ? detail.chartData : []
    if (rows.length === 0) return []
    if (chartTimeline === '1Y') return rows
    const lastIso = rows[rows.length - 1]?.isoDate
    const lastDate = lastIso ? new Date(lastIso) : null
    if (!lastDate || Number.isNaN(lastDate.getTime())) return rows
    if (chartTimeline === 'YTD') {
      const yearStart = new Date(lastDate.getFullYear(), 0, 1)
      return rows.filter((row) => {
        const d = row?.isoDate ? new Date(row.isoDate) : null
        return d && !Number.isNaN(d.getTime()) ? d >= yearStart : true
      })
    }
    const days = chartTimeline === '3M' ? 92 : 31
    const cutoff = new Date(lastDate)
    cutoff.setDate(cutoff.getDate() - days)
    return rows.filter((row) => {
      const d = row?.isoDate ? new Date(row.isoDate) : null
      return d && !Number.isNaN(d.getTime()) ? d >= cutoff : true
    })
  }, [detail?.chartData, chartTimeline])
  const visibleVolumeChartData = useMemo(() => {
    const full = Array.isArray(detail?.volumeChartData) ? detail.volumeChartData : []
    const fallback = Array.isArray(detail?.chartData) ? detail.chartData : []
    const baseRows = full.length > 0 ? full : fallback
    if (baseRows.length === 0) return []
    let rows = baseRows
    if (chartTimeline !== '1Y') {
      const lastIso = rows[rows.length - 1]?.isoDate
      const lastDate = lastIso ? new Date(lastIso) : null
      if (lastDate && !Number.isNaN(lastDate.getTime())) {
        if (chartTimeline === 'YTD') {
          const yearStart = new Date(lastDate.getFullYear(), 0, 1)
          rows = rows.filter((row) => {
            const d = row?.isoDate ? new Date(row.isoDate) : null
            return d && !Number.isNaN(d.getTime()) ? d >= yearStart : true
          })
        } else {
          const days = chartTimeline === '3M' ? 92 : 31
          const cutoff = new Date(lastDate)
          cutoff.setDate(cutoff.getDate() - days)
          rows = rows.filter((row) => {
            const d = row?.isoDate ? new Date(row.isoDate) : null
            return d && !Number.isNaN(d.getTime()) ? d >= cutoff : true
          })
        }
      }
    }
    const nonZero = rows.filter((row) => Number(row?.volume || 0) > 0)
    return nonZero.length > 0 ? nonZero : rows
  }, [detail?.volumeChartData, detail?.chartData, chartTimeline])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
          <ArrowLeft size={16} /> 戻る
        </button>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-rose-500">
          {error || 'データがありません。'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
            <ArrowLeft size={16} /> 戻る
          </button>
          <button
            onClick={() => toggleWatchlist?.(detail.symbol, { name: detail.jpName, change: Number(detail.return1y || 0) })}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border ${
              isWatchlisted
                ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/40'
                : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700'
            }`}
          >
            <Heart size={14} fill={isWatchlisted ? 'currentColor' : 'none'} />
            {isWatchlisted ? 'ウォッチ中' : 'ウォッチ追加'}
            </button>
      </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 mb-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(420px,45%)] gap-4 items-stretch">
            <div>
              <p className="text-xs font-bold text-slate-500">{detail.symbol} · {detail.isin}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">{detail.jpName}</h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">取引所: {detail.exchange} / 日次データ基準: {detail.tradeDate || '-'}</p>
              <div className="mt-4 flex items-end gap-3 flex-wrap">
                <p className="text-3xl font-black text-slate-900 dark:text-white">{fmtPrice(detail.close)}</p>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 mb-0.5">前営業日終値比（前日比）</p>
                  <p className={`text-sm font-bold ${signedReturnTextClassStrong(Number(detail.changePct || 0))}`}>
                    {Number.isFinite(detail.change) ? `${detail.change >= 0 ? '+' : ''}${detail.change.toFixed(2)}` : '-'} ({fmtPct(detail.changePct)})
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 h-full flex flex-col justify-center">
              <p className="text-xs font-bold text-slate-500 mb-1">ファンド説明</p>
              <p className="text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-200 break-words whitespace-pre-line">
                {getFundDescription(detail.symbol, detail.isin, detail.jpName)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 md:grid-cols-3 lg:grid-cols-7">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[11px] text-slate-500 font-bold">1年リターン</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">
              {Number.isFinite(Number(detail.return1y))
                ? fmtPct(detail.return1y)
                : (Number.isFinite(Number(detail.returnYTD))
                  ? `YTD ${detail.returnYTD >= 0 ? '+' : ''}${Number(detail.returnYTD).toFixed(1)}%`
                  : '-')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[11px] text-slate-500 font-bold">変動性</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">{Number.isFinite(detail.volatility) ? `${detail.volatility.toFixed(1)}%` : '-'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[11px] text-slate-500 font-bold">シャープレシオ</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">{Number.isFinite(detail.sharpe) ? detail.sharpe.toFixed(2) : '-'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[11px] text-slate-500 font-bold">信託報酬</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">{formatTrustFee(detail.trustFee)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[11px] text-slate-500 font-bold">NISA区分</p>
            <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">
              {detail.nisaCategory && detail.nisaCategory !== '-' ? (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  detail.nisaCategory.includes('つみたて')
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : (detail.nisaCategory.includes('対象外')
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300')
                }`}>
                  {detail.nisaCategory}
                </span>
              ) : '-'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[11px] text-slate-500 font-bold">平均出来高(30日)</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">
              {Number(detail.avgVol30) > 0 ? `${fmtNum(Math.round(detail.avgVol30))}株` : '-'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[11px] text-slate-500 font-bold">純資産総額</p>
            <p className="text-lg font-black leading-tight text-slate-900 dark:text-white" title="億円ベース。1兆円以上は兆表記。">
              {formatAumOkuYen(detail.aumOkuYen) ?? '-'}
            </p>
          </div>
            </div>

        <div className="mb-3 flex items-center gap-2">
          {['1M', '3M', 'YTD', '1Y'].map((range) => (
            <button
              key={range}
              onClick={() => setChartTimeline(range)}
              className={`px-2.5 py-1.5 rounded-full text-xs font-bold border ${
                chartTimeline === range
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-orange-500 dark:border-orange-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">価格推移 ({chartTimeline})</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visibleChartData}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={42} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload
                      const ymd = p?.isoDate || p?.date || ''
                      const c = p?.close
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-slate-600 dark:bg-slate-900">
                          <div className="font-bold text-slate-700 dark:text-slate-200">{ymd}</div>
                          <div className="text-slate-900 dark:text-slate-100">
                            close: {Number.isFinite(Number(c)) ? `¥${Number(c).toLocaleString()}` : '-'}
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Area type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2.2} fill="url(#priceGradient)" />
                </AreaChart>
                </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">出来高推移 ({chartTimeline})</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visibleVolumeChartData}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#64748b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#64748b" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} width={42} tickFormatter={(v) => v >= 10000 ? `${(v/10000).toFixed(0)}万` : v} />
                  <Tooltip formatter={(v) => `${Math.round(Number(v) || 0).toLocaleString()}株`} />
                  <Bar dataKey="volume" fill="url(#volumeGradient)" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">RSI (14日)</h3>
            <div className="flex flex-wrap gap-x-2 gap-y-1 mb-2 text-[10px]">
              <span className="text-rose-600 dark:text-rose-400 font-bold">70以上過買い:</span>
              <span className="text-slate-600 dark:text-slate-400">調整の可能性</span>
              <span className="text-slate-400 dark:text-slate-500">|</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">30以下過売り:</span>
              <span className="text-slate-600 dark:text-slate-400">反発の可能性</span>
            </div>
            <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visibleChartData}>
                <defs>
                  <linearGradient id="rsiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                <Tooltip formatter={(v) => (Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)}` : '-')} />
                <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.08} />
                <ReferenceArea y1={0} y2={30} fill="#22c55e" fillOpacity={0.08} />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="rsi" stroke="#8b5cf6" strokeWidth={2} fill="url(#rsiGradient)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
