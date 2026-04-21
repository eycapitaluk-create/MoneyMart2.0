import { useEffect, useMemo, useState, useRef, lazy, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, TrendingUp, Shield, X, Heart } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import MarketDataEodFreshnessNote from '../components/MarketDataEodFreshnessNote'
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../data/etfListFromXlsx'
import {
  loadFundOptimizerWatchsets,
  saveFundOptimizerWatchsets,
  normalizeFundOptimizerWatchset,
  upsertFundOptimizerWatchsetToDb,
  deleteFundOptimizerWatchsetFromDb,
  loadFundOptimizerWatchsetsFromDb,
} from '../lib/fundOptimizerWatchsets'
import { isPaidPlanTier } from '../lib/membership'
import { normalizeFundDisplayName } from '../lib/fundDisplayUtils'
import { normalizeNisaCategoryField } from '../lib/textEncodingUtils'
import { findBaseCloseByCalendarOffset } from '../lib/calendarDateUtils'
import {
  buildSplitAdjustedCloses,
  chartDownsampleIndices,
  resolveSpotCloseAndSessionChange,
  skipEodSplitHeuristicForSymbol,
} from '../lib/fundAdjustedCloses'
import { dedupeStockDailyPricesByTradeDate } from '../lib/stockDailyHistory'
import { signedReturnTextClassStrong } from '../lib/marketDirectionColors'
const PortfolioOptimizer3D = lazy(() => import('../components/funds/PortfolioOptimizer3D'))

function Optimizer3DLoadingCard() {
  return (
    <div className="h-[400px] md:h-[520px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-100 via-[#e6edf9] to-slate-100 dark:from-slate-900 dark:via-[#1c2740] dark:to-slate-900 p-1.5">
      <div className="w-full h-full rounded-lg border border-white/30 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/40 flex items-center justify-center">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">3D optimizer を読み込み中...</p>
      </div>
    </div>
  )
}

const ETF_META_MAP = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))
const SERIES_COLORS = ['#2563eb', '#f97316', '#8b5cf6']

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
const toProjectionAnnualRatePct = (rawPct) => {
  const raw = Number(rawPct)
  if (!Number.isFinite(raw)) return null
  // 1Y return-like metric to projection rate mapping:
  // keep variation by allocation, but avoid unrealistic explosion.
  return Math.max(-20, Math.min(80, raw * 0.35))
}
const formatTrustFee = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(2)}%`
}
const formatMonthDay = (isoDate) => {
  const [year, month, day] = String(isoDate || '').split('-')
  if (!year || !month || !day) return String(isoDate || '')
  return `${Number(month)}/${Number(day)}`
}

const calculateRealizedVolatility = (closes = []) => {
  const normalized = closes.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)
  if (normalized.length < 3) return null
  const dailyReturns = []
  for (let i = 1; i < normalized.length; i += 1) dailyReturns.push((normalized[i] - normalized[i - 1]) / normalized[i - 1])
  if (dailyReturns.length < 2) return null
  const mean = dailyReturns.reduce((acc, cur) => acc + cur, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((acc, cur) => acc + ((cur - mean) ** 2), 0) / (dailyReturns.length - 1)
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

const firstPositiveAdjustedBase = (adjustedAsc = []) => {
  const arr = Array.isArray(adjustedAsc) ? adjustedAsc : []
  for (let i = 0; i < arr.length; i += 1) {
    const v = Number(arr[i])
    if (Number.isFinite(v) && v > 0) return v
  }
  return 0
}

const shortenFundLabel = (name = '', max = 18) => {
  const text = String(name || '')
  return text.length > max ? `${text.slice(0, max)}...` : text
}
const SAFE_DIVISOR = 1e-9
const MIN_WEIGHT_FOR_3FUND_OPTIMIZATION = 10
const OPTIMIZER_COLORS = ['#38bdf8', '#34d399', '#fb923c']
const PREMIUM_EMAIL_ALLOWLIST = new Set([
  'justin.nam@moneymart.co.jp',
  'kelly.nam@moneymart.co.jp',
])

const normalizeWeightVector = (weights = []) => {
  const sanitized = weights.map((w) => Math.max(0, Number(w) || 0))
  const sum = sanitized.reduce((acc, cur) => acc + cur, 0)
  if (sum <= 0) {
    const equal = sanitized.length > 0 ? 100 / sanitized.length : 0
    return sanitized.map(() => equal)
  }
  return sanitized.map((w) => (w / sum) * 100)
}

const normalizeRange = (value, min, max) => {
  if (!Number.isFinite(value)) return 0
  const span = Math.max(SAFE_DIVISOR, Number(max) - Number(min))
  return Math.max(0, Math.min(1, (Number(value) - Number(min)) / span))
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

const estimateCorrelation = (a, b) => {
  if (!a || !b) return 0.4
  if (a.symbol === b.symbol) return 1
  return 0.62
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
  const netReturnAfterFee = ret - (fee * 3.2)
  const efficiency = netReturnAfterFee / Math.max(SAFE_DIVISOR, risk)
  return {
    risk,
    ret,
    fee,
    netReturnAfterFee,
    efficiency,
    weightsPct: weights.map((w) => w * 100),
  }
}

export default function FundComparePage({
  user = null,
  myWatchlist = [],
  toggleWatchlist = null,
  onUiMessage = null,
  embeddedMode = false,
  initialSymbols = [],
  onClose = null,
}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [funds, setFunds] = useState([])
  const [chartData, setChartData] = useState([])
  const [performanceTimeline, setPerformanceTimeline] = useState('YTD')
  const [optimizerWeightsBySymbol, setOptimizerWeightsBySymbol] = useState({})
  const [compareAddSymbol, setCompareAddSymbol] = useState('')
  const [compareSearchTerm, setCompareSearchTerm] = useState('')
  const [watchSetName, setWatchSetName] = useState('')
  const [savedWatchSets, setSavedWatchSets] = useState(() => {
    return loadFundOptimizerWatchsets()
  })

  // Supabase에서 세트 로드 (iOS 포함 크로스 디바이스 동기화)
  useEffect(() => {
    const userId = user?.id
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
  }, [user?.id])
  const [embeddedSymbols, setEmbeddedSymbols] = useState(() => (
    [...new Set((initialSymbols || []).map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))].slice(0, 3)
  ))
  const pendingWatchSetWeightsRef = useRef(null)
  const planTier = String(
    user?.app_metadata?.plan_tier
    || user?.user_metadata?.plan_tier
    || user?.app_metadata?.membership_tier
    || user?.user_metadata?.membership_tier
    || '',
  ).toLowerCase()
  const userEmailLower = String(user?.email || '').trim().toLowerCase()
  const isPaidMember = isPaidPlanTier(planTier) || PREMIUM_EMAIL_ALLOWLIST.has(userEmailLower)

  useEffect(() => {
    if (!embeddedMode) return
    setEmbeddedSymbols(
      [...new Set((initialSymbols || []).map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))].slice(0, 3)
    )
  }, [embeddedMode, initialSymbols])

  const idsParam = embeddedMode ? embeddedSymbols.join(',') : searchParams.get('ids')
  const weightsParam = embeddedMode ? null : searchParams.get('weights')
  const syncFundsToMyWatchlist = (fundRows = []) => {
    if (typeof toggleWatchlist !== 'function') return
    const currentIds = new Set(Array.isArray(myWatchlist) ? myWatchlist : [])
    fundRows.forEach((fund) => {
      const id = String(fund?.symbol || '').trim().toUpperCase()
      if (!id || currentIds.has(id)) return
      toggleWatchlist(id, {
        name: fund?.name || fund?.fundName || id,
        change: Number(fund?.expectedReturn || fund?.return1y || 0),
      })
      currentIds.add(id)
    })
  }
  const requestedSymbols = useMemo(() => {
    const raw = idsParam ? idsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : []
    return [...new Set(raw)].slice(0, 3)
  }, [idsParam])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError('')
      setNotice('')
      try {
        const fetchLatestBySymbols = async (symbolList) => {
          const allRows = []
          const batches = []
          for (let i = 0; i < symbolList.length; i += 80) batches.push(symbolList.slice(i, i + 80))
          for (const batch of batches) {
            const { data, error: latestErr } = await supabase
              .from('v_stock_latest')
              .select('symbol,trade_date,open,close,volume')
              .in('symbol', batch)
            if (latestErr) throw latestErr
            allRows.push(...(data || []))
          }
          return allRows
        }

        const compareSymbols = requestedSymbols
        if (compareSymbols.length < 2) {
          setFunds([])
          setChartData([])
          setNotice('')
          return
        }

        const cutoff = new Date()
        cutoff.setFullYear(cutoff.getFullYear() - 1)
        const cutoffStr = cutoff.toISOString().slice(0, 10)

        const [latestRows, symbolRowsResult] = await Promise.all([
          fetchLatestBySymbols(compareSymbols),
          supabase.from('stock_symbols').select('symbol,name,exchange,trust_fee,nisa_category').limit(5000),
        ])
        if (symbolRowsResult.error) throw symbolRowsResult.error

        const symbolMap = new Map((symbolRowsResult.data || []).map((r) => [r.symbol, r]))
        const latestMap = new Map((latestRows || []).map((r) => [r.symbol, r]))

        const historyBySymbol = new Map()
        for (const s of compareSymbols) {
          const { data, error: historyErr } = await supabase
            .from('stock_daily_prices')
            .select('symbol,trade_date,close,volume,source,fetched_at')
            .eq('symbol', s)
            .gte('trade_date', cutoffStr)
            .order('trade_date', { ascending: true })
            .limit(800)
          if (historyErr) throw historyErr
          historyBySymbol.set(s, dedupeStockDailyPricesByTradeDate(data || []))
        }

        const rows = compareSymbols.map((symbol) => {
          const latest = latestMap.get(symbol) || {}
          const meta = symbolMap.get(symbol) || {}
          const xlsx = ETF_META_MAP.get(symbol)
          const history = historyBySymbol.get(symbol) || []
          const volumes = history.map((r) => Number(r.volume)).filter((v) => Number.isFinite(v) && v >= 0)
          const adjustedSeries = buildSplitAdjustedCloses(history, {
            skipSplitHeuristic: skipEodSplitHeuristicForSymbol(symbol),
          })
          const oneYearBaseClose = findBaseCloseByCalendarOffset(history, { years: 1 }, adjustedSeries)
          const { close, sessionDod } = resolveSpotCloseAndSessionChange(history, adjustedSeries, latest)
          const adjPositiveCount = adjustedSeries.filter((v) => Number.isFinite(Number(v)) && Number(v) > 0).length
          const return1y = (adjPositiveCount >= 20 && oneYearBaseClose != null && oneYearBaseClose > 0)
            ? ((close - oneYearBaseClose) / oneYearBaseClose) * 100
            : null
          const vol = calculateRealizedVolatility(adjustedSeries)
          const sharpe = (Number.isFinite(return1y) && Number.isFinite(vol) && vol > 0) ? (return1y / vol) : null
          const avgVol30 = volumes.length > 0
            ? volumes.slice(-30).reduce((acc, cur) => acc + cur, 0) / Math.min(30, volumes.length)
            : Number(latest.volume || 0)
          const change1d = Number.isFinite(sessionDod.changePct) ? sessionDod.changePct : null
          const trustFeeValue = Number.isFinite(Number(meta.trust_fee)) ? Number(meta.trust_fee) : Number(xlsx?.trustFee)
          const normalizedNisaCategory = normalizeNisaCategoryField(meta.nisa_category || xlsx?.nisaCategory)
          return {
            symbol,
            isin: xlsx?.isin || '-',
            name: normalizeFundDisplayName(xlsx?.jpName || meta.name || symbol),
            exchange: meta.exchange || '-',
            trustFee: Number.isFinite(trustFeeValue) ? trustFeeValue : null,
            nisaCategory: normalizedNisaCategory,
            price: close,
            return1y,
            volatility: vol,
            sharpe,
            avgVol30,
            change1d,
            history,
            adjustedClosesAsc: adjustedSeries,
          }
        }).filter((r) => Number.isFinite(r.price) && r.price > 0)

        const chartDateSet = new Set()
        rows.forEach((f) => {
          const indices = chartDownsampleIndices(f.history.length, 30)
          indices.forEach((idx) => {
            const h = f.history[idx]
            if (h?.trade_date) chartDateSet.add(h.trade_date)
          })
        })
        const chartDates = [...chartDateSet].sort()
        const series = chartDates.map((date) => {
          const point = { date: formatMonthDay(date), isoDate: String(date) }
          rows.forEach((f, idx) => {
            const hist = f.history || []
            const adj = f.adjustedClosesAsc || []
            const base = firstPositiveAdjustedBase(adj)
            if (!(base > 0)) {
              point[`f${idx + 1}`] = null
              return
            }
            const sameDay = hist.find((h) => h.trade_date === date)
            const onOrBefore = sameDay || [...hist]
              .reverse()
              .find((h) => String(h.trade_date) <= String(date))
            if (!onOrBefore) {
              point[`f${idx + 1}`] = null
              return
            }
            const ii = hist.indexOf(onOrBefore)
            const v = ii >= 0 && ii < adj.length ? Number(adj[ii]) : NaN
            point[`f${idx + 1}`] = Number.isFinite(v) && v > 0 ? (v / base) * 100 : null
          })
          return point
        })

        if (cancelled) return
        setFunds(rows)
        setChartData(series)
      } catch (e) {
        if (!cancelled) {
          setError(e.message || '比較データの取得に失敗しました。')
          setFunds([])
          setChartData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [requestedSymbols])

  const scatterData = useMemo(() => (
    funds
      .filter((f) => Number.isFinite(Number(f.return1y)) && Number.isFinite(Number(f.volatility)))
      .map((f, idx) => ({
        ...f,
        x: Number(f.volatility),
        y: Number(f.return1y),
        z: Math.max(180, Math.min(1400, Math.sqrt(Number(f.avgVol30 || 1)) * 0.9)),
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
      }))
  ), [funds])

  const scatterVolatilityDomainMax = useMemo(() => {
    const xs = scatterData.map((d) => Number(d.x)).filter((v) => Number.isFinite(v) && v > 0)
    if (xs.length === 0) return 80
    const rawMax = Math.max(...xs)
    const padded = rawMax * 1.08
    return Math.min(150, Math.max(12, padded))
  }, [scatterData])

  const optimizerSelectedFunds = useMemo(() => (
    funds.slice(0, 3).map((f, idx) => ({
      ...f,
      color: OPTIMIZER_COLORS[idx] || '#94a3b8',
      expectedReturn: Number.isFinite(Number(f.return1y)) ? Number(f.return1y) : 0,
      riskStd: Number.isFinite(Number(f.volatility)) ? Number(f.volatility) : 0,
      trustFee: Number.isFinite(Number(f.trustFee)) ? Number(f.trustFee) : 0.8,
    }))
  ), [funds])

  // オプティマイザの最適配分を算出（イコールではなくスコアベース）
  const optimizerOptimalWeightsMap = useMemo(() => {
    if (optimizerSelectedFunds.length < 2) return null
    const rawCombos = generateWeightCombos(optimizerSelectedFunds.length, optimizerSelectedFunds.length === 3 ? 5 : 2)
    const constrainedCombos = optimizerSelectedFunds.length === 3
      ? rawCombos.filter((weights) => Math.min(...weights) >= MIN_WEIGHT_FOR_3FUND_OPTIMIZATION)
      : rawCombos
    const combos = constrainedCombos.length > 0 ? constrainedCombos : rawCombos
    const points = combos.map((weights) => ({ ...calcPortfolioMetrics(optimizerSelectedFunds, weights) }))
    const riskValues = points.map((p) => p.risk)
    const feeValues = points.map((p) => p.fee)
    const netReturnValues = points.map((p) => p.netReturnAfterFee ?? p.ret ?? 0)
    const efficiencyValues = points.map((p) => p.efficiency ?? 0)
    const ranges = {
      riskMin: Math.min(...riskValues),
      riskMax: Math.max(...riskValues),
      feeMin: Math.min(...feeValues),
      feeMax: Math.max(...feeValues),
    }
    const netReturnRange = { min: Math.min(...netReturnValues), max: Math.max(...netReturnValues) }
    const efficiencyRange = { min: Math.min(...efficiencyValues), max: Math.max(...efficiencyValues) }
    const scored = points.map((p) => {
      const riskNorm = normalizeRange(p.risk, ranges.riskMin, ranges.riskMax)
      const feeNorm = normalizeRange(p.fee, ranges.feeMin, ranges.feeMax)
      const netRetNorm = normalizeRange(p.netReturnAfterFee, netReturnRange.min, netReturnRange.max)
      const efficiencyNorm = normalizeRange(p.efficiency, efficiencyRange.min, efficiencyRange.max)
      const score = (netRetNorm * 0.42) + (efficiencyNorm * 0.28) + ((1 - riskNorm) * 0.2) + ((1 - feeNorm) * 0.1)
      return { ...p, score }
    })
    const best = [...scored].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0]
    if (!best?.weightsPct) return null
    const ids = optimizerSelectedFunds.map((f) => f.symbol)
    const next = {}
    ids.forEach((id, idx) => { next[id] = Number((best.weightsPct[idx] || 0).toFixed(1)) })
    return next
  }, [optimizerSelectedFunds])

  useEffect(() => {
    if (optimizerSelectedFunds.length === 0) {
      setOptimizerWeightsBySymbol({})
      pendingWatchSetWeightsRef.current = null
      return
    }
    const fromWatchSet = pendingWatchSetWeightsRef.current
    if (fromWatchSet && Object.keys(fromWatchSet).length > 0) {
      const ids = optimizerSelectedFunds.map((f) => f.symbol)
      const keysMatch = ids.every((id) => id in fromWatchSet) && Object.keys(fromWatchSet).every((k) => ids.includes(k))
      if (keysMatch) {
        setOptimizerWeightsBySymbol(fromWatchSet)
        pendingWatchSetWeightsRef.current = null
        return
      }
    }
    const optimal = optimizerOptimalWeightsMap
    if (optimal && Object.keys(optimal).length > 0) {
      setOptimizerWeightsBySymbol(optimal)
      return
    }
    const ids = optimizerSelectedFunds.map((f) => f.symbol)
    const equalPct = ids.length > 0 ? Number((100 / ids.length).toFixed(1)) : 0
    const next = {}
    ids.forEach((id, idx) => {
      next[id] = idx === ids.length - 1 ? Number((100 - equalPct * (ids.length - 1)).toFixed(1)) : equalPct
    })
    setOptimizerWeightsBySymbol(next)
  }, [optimizerSelectedFunds, optimizerOptimalWeightsMap])

  const optimizerCurrentWeights = useMemo(() => {
    if (optimizerSelectedFunds.length === 0) return []
    const raw = optimizerSelectedFunds.map((f) => Number(optimizerWeightsBySymbol[f.symbol] || 0))
    return normalizeWeightVector(raw)
  }, [optimizerSelectedFunds, optimizerWeightsBySymbol])

  const optimizerFrontier = useMemo(() => {
    if (optimizerSelectedFunds.length < 2) {
      return { points: [], pathPoints: [], currentPoint: null, optimalPoint: null, ranges: null }
    }
    const rawCombos = generateWeightCombos(optimizerSelectedFunds.length, optimizerSelectedFunds.length === 3 ? 5 : 2)
    const constrainedCombos = optimizerSelectedFunds.length === 3
      ? rawCombos.filter((weights) => Math.min(...weights) >= MIN_WEIGHT_FOR_3FUND_OPTIMIZATION)
      : rawCombos
    const combos = constrainedCombos.length > 0 ? constrainedCombos : rawCombos
    const points = combos.map((weights, idx) => ({ id: `combo-${idx}`, ...calcPortfolioMetrics(optimizerSelectedFunds, weights) }))
    const riskValues = points.map((p) => p.risk)
    const retValues = points.map((p) => p.ret)
    const feeValues = points.map((p) => p.fee)
    const ranges = {
      riskMin: Math.min(...riskValues),
      riskMax: Math.max(...riskValues),
      retMin: Math.min(...retValues),
      retMax: Math.max(...retValues),
      feeMin: Math.min(...feeValues),
      feeMax: Math.max(...feeValues),
    }
    const efficiencyValues = points.map((p) => Number(p.efficiency || 0))
    const netReturnValues = points.map((p) => Number(p.netReturnAfterFee || 0))
    const efficiencyRange = { min: Math.min(...efficiencyValues), max: Math.max(...efficiencyValues) }
    const netReturnRange = { min: Math.min(...netReturnValues), max: Math.max(...netReturnValues) }
    const scored = points.map((p) => {
      const riskNorm = normalizeRange(p.risk, ranges.riskMin, ranges.riskMax)
      const feeNorm = normalizeRange(p.fee, ranges.feeMin, ranges.feeMax)
      const netRetNorm = normalizeRange(p.netReturnAfterFee, netReturnRange.min, netReturnRange.max)
      const efficiencyNorm = normalizeRange(p.efficiency, efficiencyRange.min, efficiencyRange.max)
      const score = (netRetNorm * 0.42) + (efficiencyNorm * 0.28) + ((1 - riskNorm) * 0.2) + ((1 - feeNorm) * 0.1)
      return { ...p, score }
    })
    const optimalPoint = [...scored].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || null
    const currentPoint = calcPortfolioMetrics(optimizerSelectedFunds, optimizerCurrentWeights)
    const pathPoints = [...scored].sort((a, b) => Number(a.risk || 0) - Number(b.risk || 0))
    return { points: scored, pathPoints, currentPoint, optimalPoint, ranges }
  }, [optimizerSelectedFunds, optimizerCurrentWeights])
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

  const applyOptimizerWeight = (targetSymbol, nextValue) => {
    setOptimizerWeightsBySymbol((prev) => {
      const ids = optimizerSelectedFunds.map((f) => f.symbol)
      if (!ids.includes(targetSymbol)) return prev
      const target = Math.max(0, Math.min(100, Number(nextValue) || 0))
      const others = ids.filter((id) => id !== targetSymbol)
      const next = { ...prev, [targetSymbol]: target }
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

  const applyOptimalAllocationToSlider = () => {
    if (!optimizerFrontier.optimalPoint) return
    const ids = optimizerSelectedFunds.map((f) => f.symbol)
    const next = {}
    ids.forEach((id, idx) => {
      next[id] = Number((optimizerFrontier.optimalPoint.weightsPct[idx] || 0).toFixed(1))
    })
    setOptimizerWeightsBySymbol(next)
  }

  const updateCompareSymbols = (nextSymbols) => {
    const sanitized = [...new Set((nextSymbols || []).map((s) => String(s || '').toUpperCase()).filter(Boolean))].slice(0, 3)
    if (sanitized.length === 0) return
    if (embeddedMode) {
      setEmbeddedSymbols(sanitized)
      return
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const prevIds = (prev.get('ids') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      next.set('ids', sanitized.join(','))
      const sameOrder = sanitized.length === prevIds.length && sanitized.every((id, i) => id === prevIds[i])
      if (!sameOrder) next.delete('weights')
      return next
    })
  }

  const removeComparedSymbol = (symbol) => {
    const next = requestedSymbols.filter((s) => s !== symbol)
    if (next.length < 2) {
      if (typeof onUiMessage === 'function') onUiMessage('比較は2件以上必要です。', 'info')
      else alert('比較は2件以上必要です。')
      return
    }
    updateCompareSymbols(next)
  }

  const addComparedSymbol = () => {
    if (!compareAddSymbol) return
    if (requestedSymbols.includes(compareAddSymbol)) return
    if (requestedSymbols.length >= 3) {
      if (typeof onUiMessage === 'function') onUiMessage('比較は最大3件までです。', 'info')
      else alert('比較は最大3件までです。')
      return
    }
    updateCompareSymbols([...requestedSymbols, compareAddSymbol])
    setCompareAddSymbol('')
  }

  const compareAddCandidates = useMemo(() => {
    const query = String(compareSearchTerm || '').trim().toLowerCase()
    const base = ETF_SYMBOLS_FROM_XLSX.filter((s) => !requestedSymbols.includes(s))
    if (!query) return base
    return base.filter((symbol) => {
      const name = String(ETF_META_MAP.get(symbol)?.jpName || '').toLowerCase()
      return symbol.toLowerCase().includes(query) || name.includes(query)
    })
  }, [requestedSymbols, compareSearchTerm])

  const saveCurrentAllocationAsWatchSet = () => {
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
      id: `compare-set-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      source: 'fund_compare',
      funds: optimizerSelectedFunds.map((fund, idx) => ({
        id: fund.symbol,
        name: fund.name,
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
        if (user?.id) upsertFundOptimizerWatchsetToDb(user.id, payload).catch(() => {})
      } catch {
        // ignore local storage errors
      }
      return next
    })
    syncFundsToMyWatchlist(optimizerSelectedFunds)
    setWatchSetName('')
  }

  const applyWatchSet = (setId) => {
    const target = savedWatchSets.find((row) => row.id === setId)
    if (!target || !Array.isArray(target.funds) || target.funds.length < 2) return
    const symbols = target.funds.map((f) => String(f.id || f.symbol || '').toUpperCase()).filter(Boolean).slice(0, 3)
    const next = {}
    target.funds.forEach((f) => {
      const symbol = String(f.id || f.symbol || '').toUpperCase()
      if (!symbol) return
      next[symbol] = Number(f.weightPct || 0)
    })
    pendingWatchSetWeightsRef.current = next
    updateCompareSymbols(symbols)
    setOptimizerWeightsBySymbol(next)
    syncFundsToMyWatchlist(
      symbols
        .map((symbol) => optimizerSelectedFunds.find((fund) => fund.symbol === symbol) || funds.find((fund) => fund.symbol === symbol))
        .filter(Boolean)
    )
  }

  const removeWatchSet = (setId) => {
    setSavedWatchSets((prev) => {
      const next = prev.filter((row) => row.id !== setId)
      try {
        saveFundOptimizerWatchsets(next)
        if (user?.id) deleteFundOptimizerWatchsetFromDb(user.id, setId).catch(() => {})
      } catch {
        // ignore local storage errors
      }
      return next
    })
  }
  useEffect(() => {
    const weights = String(weightsParam || '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0)
    if (weights.length !== optimizerSelectedFunds.length || weights.length < 2) return
    const next = {}
    optimizerSelectedFunds.forEach((fund, idx) => {
      next[fund.symbol] = Number(weights[idx].toFixed(1))
    })
    setOptimizerWeightsBySymbol(next)
  }, [weightsParam, optimizerSelectedFunds])
  const visiblePerformanceSeries = useMemo(() => {
    if (!Array.isArray(chartData) || chartData.length === 0) return []
    if (performanceTimeline === '1Y') return chartData
    const lastIso = chartData[chartData.length - 1]?.isoDate
    const lastDate = lastIso ? new Date(lastIso) : null
    if (!lastDate || Number.isNaN(lastDate.getTime())) return chartData
    if (performanceTimeline === 'YTD') {
      const yearStart = new Date(lastDate.getFullYear(), 0, 1)
      return chartData.filter((row) => {
        const d = row?.isoDate ? new Date(row.isoDate) : null
        return d && !Number.isNaN(d.getTime()) ? d >= yearStart : true
      })
    }
    const days = performanceTimeline === '3M' ? 92 : 31
    const cutoff = new Date(lastDate)
    cutoff.setDate(cutoff.getDate() - days)
    return chartData.filter((row) => {
      const d = row?.isoDate ? new Date(row.isoDate) : null
      return d && !Number.isNaN(d.getTime()) ? d >= cutoff : true
    })
  }, [chartData, performanceTimeline])
  const rebasedPerformanceSeries = useMemo(() => {
    if (!Array.isArray(visiblePerformanceSeries) || visiblePerformanceSeries.length === 0 || funds.length === 0) {
      return []
    }
    const keys = funds.map((_, idx) => `f${idx + 1}`)
    const baseByKey = {}
    keys.forEach((key) => {
      const first = visiblePerformanceSeries.find((row) => Number.isFinite(Number(row?.[key])))
      const base = Number(first?.[key] || 0)
      baseByKey[key] = base > 0 ? base : null
    })
    return visiblePerformanceSeries.map((row) => {
      const next = { ...row }
      keys.forEach((key) => {
        const rawValue = row?.[key]
        const raw = rawValue === null || rawValue === undefined ? NaN : Number(rawValue)
        const base = baseByKey[key]
        if (!Number.isFinite(raw) || !(base > 0)) {
          next[key] = null
          return
        }
        next[key] = (raw / base) * 100
      })
      return next
    })
  }, [visiblePerformanceSeries, funds.length])
  const performanceYAxisDomain = useMemo(() => {
    if (!Array.isArray(rebasedPerformanceSeries) || rebasedPerformanceSeries.length === 0 || funds.length === 0) return ['auto', 'auto']
    const keys = funds.map((_, idx) => `f${idx + 1}`)
    let minVal = Number.POSITIVE_INFINITY
    let maxVal = Number.NEGATIVE_INFINITY

    rebasedPerformanceSeries.forEach((row) => {
      keys.forEach((key) => {
        const v = Number(row?.[key])
        if (!Number.isFinite(v)) return
        if (v < minVal) minVal = v
        if (v > maxVal) maxVal = v
      })
    })

    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) return ['auto', 'auto']
    const rawRange = maxVal - minVal
    const mid = (maxVal + minVal) / 2
    const minVisibleRange = Math.max(2, Math.abs(mid) * 0.015)
    const effectiveRange = Math.max(rawRange, minVisibleRange)
    const pad = Math.max(0.8, effectiveRange * 0.12)
    return [
      Number((minVal - pad).toFixed(2)),
      Number((maxVal + pad).toFixed(2)),
    ]
  }, [rebasedPerformanceSeries, funds.length])

  if (loading) {
    if (embeddedMode) {
      return (
        <div className="min-h-[420px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      )
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className={`${embeddedMode ? 'flex min-h-0 flex-1 flex-col bg-transparent' : 'min-h-screen bg-slate-50 dark:bg-slate-950 pb-20'} font-sans`}>
      <div
        className={`${
          embeddedMode
            ? 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-2xl bg-slate-50 px-3 py-4 dark:bg-slate-950 sm:px-4 sm:py-5'
            : 'max-w-7xl mx-auto px-4 py-6'
        }`}
      >
        <div
          className={`mb-4 flex items-start justify-between gap-3 sm:mb-5 ${
            embeddedMode
              ? 'sticky top-0 z-20 -mx-3 border-b border-slate-200/80 bg-slate-50/95 px-3 py-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-4 sm:px-4'
              : ''
          }`}
        >
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {!embeddedMode && (
              <button onClick={() => navigate('/funds')} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                <ArrowLeft size={16} /> 戻る
              </button>
            )}
            <h1 className="min-w-0 text-lg font-black text-slate-900 dark:text-white sm:text-xl">ファンド比較分析</h1>
          </div>
          {embeddedMode && typeof onClose === 'function' ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose()
              }}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose()
              }}
              style={{ touchAction: 'manipulation', cursor: 'pointer' }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="閉じる"
              title="閉じる"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>

        {notice && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 px-4 py-3 text-sm font-bold">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 px-4 py-3 text-sm font-bold">
            {error}
      </div>
        )}

        {!embeddedMode ? (
          <div className="mb-4">
            <MarketDataEodFreshnessNote variant="fund" />
          </div>
        ) : null}

        {requestedSymbols.length < 2 ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="leading-relaxed">
              このページは <span className="font-black">比較したい銘柄を指定してから</span>ご利用ください（自動での銘柄プリセットはしません）。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/funds')}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-500"
              >
                ファンド一覧で選ぶ
              </button>
              <button
                type="button"
                onClick={() => navigate('/etf-compare?ids=1306.T,1321.T,2559.T')}
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-black text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-900/40"
              >
                サンプル3銘柄で見る
              </button>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-amber-800/90 dark:text-amber-200/90">
              例: <span className="font-mono">/etf-compare?ids=1306.T,1321.T</span>
            </p>
          </div>
        ) : null}

        {funds.length >= 2 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 inline-flex items-center gap-2">
                  <Shield size={15} className="text-indigo-500" /> リスク・リターン比較（実値）
                </h2>
            <div className="h-[220px] sm:h-[280px] md:h-[300px]">
                  {scatterData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm font-bold text-slate-400">
                      比較対象のリスク/リターン計算データが不足しています
                    </div>
                  ) : (
              <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name="変動性"
                          unit="%"
                          tick={{ fontSize: 11 }}
                          domain={[0, scatterVolatilityDomainMax]}
                        />
                        <YAxis type="number" dataKey="y" name="1年リターン" unit="%" tick={{ fontSize: 11 }} />
                        <ZAxis type="number" dataKey="z" range={[120, 1100]} />
                        <Tooltip
                          formatter={(v, key) => {
                            if (key === 'x' || key === 'y') return `${Number(v).toFixed(1)}%`
                            return Math.round(Number(v)).toLocaleString()
                          }}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                        />
                        <Scatter data={scatterData}>
                          {scatterData.map((entry) => (
                            <Cell key={entry.symbol} fill={entry.color} fillOpacity={0.8} stroke={entry.color} />
                          ))}
                        </Scatter>
                      </ScatterChart>
              </ResponsiveContainer>
                  )}
            </div>
          </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-black text-slate-900 dark:text-white inline-flex items-center gap-2">
                    <TrendingUp size={15} className="text-red-500" /> 収益率推移比較 (起点=100)
                  </h2>
                  <select
                    value={performanceTimeline}
                    onChange={(e) => setPerformanceTimeline(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold px-2 py-1 text-slate-700 dark:text-slate-200"
                  >
                    <option value="1M">1M</option>
                    <option value="3M">3M</option>
                    <option value="YTD">YTD</option>
                    <option value="1Y">1Y</option>
                  </select>
                </div>
            <div className="h-[220px] sm:h-[280px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rebasedPerformanceSeries} margin={{ top: 8, right: 8, bottom: 56, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={performanceYAxisDomain} tickFormatter={(v) => `${Math.round(Number(v))}`} axisLine={false} tickLine={false} width={56} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, padding: '6px 10px' }}
                        itemStyle={{ fontSize: 11 }}
                        labelStyle={{ fontSize: 10 }}
                        formatter={(v, name) => [
                          Number(v).toFixed(2),
                          String(name).length > 14 ? `${String(name).slice(0, 14)}…` : name,
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ paddingTop: 6, fontSize: 10 }}
                        formatter={(value) => (String(value).length > 12 ? `${String(value).slice(0, 12)}…` : value)}
                        iconType="line"
                        iconSize={8}
                      />
                      {funds.map((f, idx) => (
                    <Line
                          key={f.symbol}
                      type="monotone"
                      dataKey={`f${idx + 1}`}
                          name={f.name}
                          stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                          strokeWidth={2.2}
                          dot={false}
                          connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

            {embeddedMode ? (
              <div className="mb-4 space-y-3 md:hidden">
                {funds.map((f, idx) => {
                  const isWatchlisted = Array.isArray(myWatchlist) && myWatchlist.includes(f.symbol)
                  return (
                    <div
                      key={`m-compare-${f.symbol}`}
                      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => navigate(`/funds/${f.symbol}`)}
                              className="text-left text-sm font-black text-slate-900 hover:text-orange-500 dark:text-white"
                            >
                              {f.name}
                            </button>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{f.symbol}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof toggleWatchlist === 'function') {
                              toggleWatchlist(f.symbol, {
                                name: f.name || f.symbol,
                                change: Number(f.return1y || 0),
                              })
                            }
                          }}
                          className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={isWatchlisted ? 'ウォッチ解除' : 'ウォッチ追加'}
                          aria-label={isWatchlisted ? 'ウォッチ解除' : 'ウォッチ追加'}
                        >
                          <Heart size={18} fill={isWatchlisted ? '#ef4444' : 'none'} className={isWatchlisted ? 'text-red-500' : ''} />
                        </button>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2 text-[11px]">
                        <div className="col-span-2">
                          <dt className="font-bold text-slate-500 dark:text-slate-400">ISIN</dt>
                          <dd className="mt-0.5 break-all font-mono text-slate-800 dark:text-slate-200">{f.isin || '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500 dark:text-slate-400">1年リターン</dt>
                          <dd
                            className={`mt-0.5 font-black ${
                              Number.isFinite(Number(f.return1y)) ? signedReturnTextClassStrong(Number(f.return1y)) : 'text-slate-400'
                            }`}
                          >
                            {fmtPct(f.return1y)}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500 dark:text-slate-400">変動性</dt>
                          <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                            {Number.isFinite(f.volatility) ? `${f.volatility.toFixed(1)}%` : '-'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500 dark:text-slate-400">シャープ</dt>
                          <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{Number.isFinite(f.sharpe) ? f.sharpe.toFixed(2) : '-'}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500 dark:text-slate-400">信託報酬</dt>
                          <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{formatTrustFee(f.trustFee)}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="font-bold text-slate-500 dark:text-slate-400">NISA</dt>
                          <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                            {f.nisaCategory && f.nisaCategory !== '-' ? f.nisaCategory : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500 dark:text-slate-400">出来高(30日)</dt>
                          <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                            {Number(f.avgVol30) > 0 ? `${Math.round(Number(f.avgVol30)).toLocaleString()}株` : '-'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500 dark:text-slate-400">終値</dt>
                          <dd className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">¥{Math.round(Number(f.price || 0)).toLocaleString()}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="font-bold text-slate-500 dark:text-slate-400">前日比</dt>
                          <dd
                            className={`mt-0.5 font-black ${
                              Number.isFinite(Number(f.change1d)) ? signedReturnTextClassStrong(Number(f.change1d)) : 'text-slate-400'
                            }`}
                          >
                            {fmtPct(f.change1d)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )
                })}
              </div>
            ) : null}

            <div
              className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
                embeddedMode ? 'hidden overflow-x-auto md:block' : 'overflow-x-auto'
              }`}
            >
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-300 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">銘柄</th>
                    <th className="px-4 py-3 text-center">ウォッチ</th>
                    <th className="px-4 py-3 text-left">ISIN</th>
                    <th className="px-4 py-3 text-right">1年リターン</th>
                    <th className="px-4 py-3 text-right">変動性</th>
                    <th className="px-4 py-3 text-right">シャープレシオ</th>
                    <th className="px-4 py-3 text-right">信託報酬</th>
                    <th className="px-4 py-3 text-left">NISA区分</th>
                    <th className="px-4 py-3 text-right">平均出来高(30日)</th>
                    <th className="px-4 py-3 text-right">終値</th>
                    <th className="px-4 py-3 text-right">前日比</th>
                </tr>
              </thead>
                <tbody>
                  {funds.map((f, idx) => {
                    const isWatchlisted = Array.isArray(myWatchlist) && myWatchlist.includes(f.symbol)
                    return (
                    <tr key={f.symbol} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }} />
                          <button onClick={() => navigate(`/funds/${f.symbol}`)} className="font-bold text-slate-900 dark:text-white hover:text-orange-500 text-left">
                            {f.name}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 ml-4">{f.symbol}</div>
                    </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof toggleWatchlist === 'function') {
                              toggleWatchlist(f.symbol, {
                                name: f.name || f.symbol,
                                change: Number(f.return1y || 0),
                              })
                            }
                          }}
                          className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={isWatchlisted ? 'ウォッチ解除' : 'ウォッチ追加'}
                          aria-label={isWatchlisted ? 'ウォッチ解除' : 'ウォッチ追加'}
                        >
                          <Heart
                            size={16}
                            fill={isWatchlisted ? '#ef4444' : 'none'}
                            className={isWatchlisted ? 'text-red-500' : ''}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{f.isin}</td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        Number.isFinite(Number(f.return1y))
                          ? signedReturnTextClassStrong(Number(f.return1y))
                          : 'text-slate-400'
                      }`}>{fmtPct(f.return1y)}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{Number.isFinite(f.volatility) ? `${f.volatility.toFixed(1)}%` : '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{Number.isFinite(f.sharpe) ? f.sharpe.toFixed(2) : '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatTrustFee(f.trustFee)}</td>
                      <td className="px-4 py-3 text-left">
                        {f.nisaCategory && f.nisaCategory !== '-' ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            f.nisaCategory.includes('つみたて')
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : (f.nisaCategory.includes('対象外')
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300')
                          }`}>
                            {f.nisaCategory}
                          </span>
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {Number(f.avgVol30) > 0 ? `${Math.round(Number(f.avgVol30)).toLocaleString()}株` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">¥{Math.round(Number(f.price || 0)).toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        Number.isFinite(Number(f.change1d))
                          ? signedReturnTextClassStrong(Number(f.change1d))
                          : 'text-slate-400'
                      }`}>{fmtPct(f.change1d)}</td>
                </tr>
                  )})}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
