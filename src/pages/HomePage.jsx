import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart2, Sparkles,
  Landmark, Home, Wallet, Layers3,
  TrendingUp, Calculator, X,
  PiggyBank, Newspaper,
  Plus, Bell, Shield, CalendarDays, LayoutGrid, RefreshCw, Percent, User,
  LineChart as LucideLineChart,
  Check,
  PieChart,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import AdBanner from '../components/AdBanner'
import { supabase } from '../lib/supabase'
import { normalizeFundDisplayName } from '../lib/fundDisplayUtils'
import { ETF_LIST_FROM_XLSX } from '../data/etfListFromXlsx'
import {
  AI_THEME_SYMBOL_SET,
  HIGH_DIVIDEND_SYMBOL_SET,
  AI_THEME_ISIN_SET,
  HIGH_DIVIDEND_ISIN_SET,
} from '../data/etfThemeFlags'
import { looksLikeHighDividendFromText } from '../lib/fundSubcategoryHeuristics'
import { findBaseCloseByCalendarOffset } from '../lib/calendarDateUtils'
import { buildSplitAdjustedCloses, resolveSpotCloseAndSessionChange, skipEodSplitHeuristicForSymbol } from '../lib/fundAdjustedCloses'
import { dedupeStockDailyPricesByTradeDate } from '../lib/stockDailyHistory'
import { trackAnalyticsEvent } from '../lib/analytics'
import { MM_SIMULATION_PAST_PERFORMANCE_JA } from '../lib/moneymartSimulationDisclaimer'
import { fetchMyReferralCode } from '../lib/referralApi'
import { ReferralShareMenu } from '../components/ReferralShareMenu'
import HomeOptimizer3DShowcase from '../components/funds/HomeOptimizer3DShowcase'
import { REFERRAL_INVITE_UI_ENABLED } from '../lib/referralUiFlags'
import { signedReturnTextClassStrong } from '../lib/marketDirectionColors'
/** FundPage の MAX_SYMBOLS_FOR_HISTORY と揃える。小さいと低流動性銘柄が 1Y 未算出のままになり Top5 から欠落する */
const HOME_FUND_HISTORY_FETCH_LIMIT = 999

const HOME_MARKET_FLASH = [
  { symbol: '1306.T', headline: '国内株（TOPIX）', sub: '連動型ETF', country: 'JP' },
  { symbol: '1321.T', headline: '国内株（代表指数）', sub: '連動型ETF', country: 'JP' },
  { symbol: '1545.T', headline: '米国株（NASDAQ-100）', sub: '連動型ETF', country: 'US' },
]

/** ホーム「マイページ見た目の例」資産カードのみ。実ユーザーデータではありません。 */
const HOME_MYPAGE_PREVIEW_DEMO_TOTAL_YEN = 12_450_000
const HOME_MYPAGE_PREVIEW_DEMO_DELTA_YEN = 128_000

const formatFlashPrice = (p) => {
  if (p == null || !Number.isFinite(Number(p))) return '—'
  const n = Number(p)
  if (n >= 1000) return n.toLocaleString('ja-JP', { maximumFractionDigits: 0 })
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
}

const ETF_META_MAP = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))
const HOME_ETF_SYMBOLS = ETF_LIST_FROM_XLSX.map((item) => item.symbol).filter(Boolean)

const normalizeClassifierText = (value = '') => String(value || '').normalize('NFKC').toUpperCase()

const isAiThemeFundName = (name = '') => /AI|BIGDATA|ROBOT|CLOUD|FINTECH|半導体|テック|TECH|INNOVATION|DEFENSE|EV|BATTERY|DIGITAL/.test(normalizeClassifierText(name))
const isHighDividendFundName = (name = '') => looksLikeHighDividendFromText(name, '')

const detectCategory = (name = '') => {
  const n = normalizeClassifierText(name)
  if (n.includes('全世界') || n.includes('GLOBAL') || n.includes('ACWI')) return '全世界株式'
  if (n.includes('米国') || n.includes('S&P') || n.includes('NASDAQ') || n.includes('US ')) return '米国株式'
  if (n.includes('先進国') || n.includes('KOKUSAI') || n.includes('EUROPE')) return '先進国株式'
  if (n.includes('新興国') || n.includes('EMERGING') || n.includes('INDIA') || n.includes('中国')) return '新興国株式'
  if (n.includes('日本') || n.includes('TOPIX') || n.includes('日経')) return '国内株式'
  if (n.includes('債券') || n.includes('BOND')) return '債券'
  if (n.includes('REIT') || n.includes('リート')) return 'REIT'
  return 'その他'
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

const RANK_BADGE_CLASSES = [
  'bg-orange-500 text-white',
  'bg-amber-500 text-white',
  'bg-lime-500 text-white',
  'bg-sky-500 text-white',
  'bg-violet-500 text-white',
]

const RiskModal = ({ isOpen, onClose, onNavigate, loginRedirectTo = '/tools' }) => {
  if (!isOpen) return null
  const handleLogin = () => {
    onClose()
    onNavigate('/login', { state: { from: loginRedirectTo } })
  }
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={24} /></button>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Sparkles className="text-orange-500" /> 無料AI診断
        </h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
          リスク許容度に基づいたポートフォリオ診断をご提供します。ログインして診断を開始してください。
        </p>
        <button
          onClick={handleLogin}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg transition"
        >
          ログインして診断
        </button>
      </div>
    </div>
  )
}

export default function HomePage({
  openRiskModal,
  session,
  userProfile = null,
  alertSummary = { insuranceExpiringSoon: 0, pointExpiringSoonCount: 0, budgetOver80Pct: false },
}) {
  const navigate = useNavigate()
  const hookSimulatorRef = useRef(null)
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false)
  const [fundRanking, setFundRanking] = useState([])
  const [activeTop5Group, setActiveTop5Group] = useState(0)
  const [investType, setInvestType] = useState('nisa')
  const [investMonthly, setInvestMonthly] = useState(3)
  const [investRate, setInvestRate] = useState(5.0)
  const [investYears, setInvestYears] = useState(20)
  const [marketFlash, setMarketFlash] = useState([])
  const [chartUiDark, setChartUiDark] = useState(false)
  const [referralCode, setReferralCode] = useState(null)
  const [referralCopied, setReferralCopied] = useState(false)
  const [referralShareHint, setReferralShareHint] = useState('')

  const homeAlertCount =
    Number(alertSummary?.insuranceExpiringSoon || 0)
    + Number(alertSummary?.pointExpiringSoonCount || 0)
    + (session?.user && alertSummary?.budgetOver80Pct ? 1 : 0)

  useEffect(() => {
    const el = document.documentElement
    const sync = () => setChartUiDark(el.classList.contains('dark'))
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])

  const greetingJa = useMemo(() => {
    const h = new Date().getHours()
    if (h < 11) return 'おはようございます'
    if (h < 17) return 'こんにちは'
    return 'こんばんは'
  }, [])

  const appHomeDisplayName = useMemo(() => {
    const rawDisplayName = (
      userProfile?.displayName
      || session?.user?.user_metadata?.full_name
      || session?.user?.user_metadata?.name
      || (session?.user?.email ? String(session.user.email).split('@')[0] : 'マネー 丸')
    )
    const normalizedDisplayName = String(rawDisplayName || '')
      .replace(/^\s*(Mr\.?|Miss|Mrs\.?|Ms\.?)\s+/i, '')
      .trim() || 'マネー 丸'
    return `${normalizedDisplayName}さん`
  }, [session, userProfile?.displayName])

  const trackAndNavigate = (to, meta = {}) => {
    trackAnalyticsEvent('home_navigation_click', {
      destination: to,
      ...meta,
    })
    navigate(to)
  }

  const referralInviteUrl = useMemo(() => {
    if (!referralCode || typeof window === 'undefined') return ''
    return `${window.location.origin}/?ref=${referralCode}`
  }, [referralCode])

  const copyReferralLink = async () => {
    if (!referralInviteUrl) return
    try {
      await navigator.clipboard.writeText(referralInviteUrl)
      setReferralCopied(true)
      setReferralShareHint('')
      window.setTimeout(() => setReferralCopied(false), 2000)
      trackAnalyticsEvent('home_referral_copy', {})
    } catch {
      setReferralShareHint('コピーできませんでした')
    }
  }

  const trackFundClick = (fund, source) => {
    trackAnalyticsEvent('home_fund_click', {
      source,
      product_type: 'fund',
      product_id: fund?.id || '',
      product_name: fund?.name || '',
    })
    navigate(`/funds/${fund.id}`)
  }

  useEffect(() => {
    let cancelled = false
    const loadFlash = async () => {
      const symbols = HOME_MARKET_FLASH.map((r) => r.symbol)
      const { data, error } = await supabase.from('v_stock_latest').select('symbol,open,close').in('symbol', symbols)
      if (cancelled || error || !Array.isArray(data)) return
      const bySym = new Map(data.map((r) => [r.symbol, r]))
      const rows = HOME_MARKET_FLASH.map((cfg) => {
        const row = bySym.get(cfg.symbol) || {}
        const open = Number(row.open || 0)
        const close = Number(row.close || 0)
        const pct = open > 0 ? ((close - open) / open) * 100 : null
        const price = close > 0 ? close : null
        return { ...cfg, price, pct }
      })
      setMarketFlash(rows)
    }
    loadFlash()
    const timer = window.setInterval(loadFlash, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!REFERRAL_INVITE_UI_ENABLED || !session?.user?.id) {
      setReferralCode(null)
      return
    }
    let alive = true
    fetchMyReferralCode().then((c) => {
      if (alive) setReferralCode(c || null)
    })
    return () => {
      alive = false
    }
  }, [session?.user?.id])

  useEffect(() => {
    let cancelled = false

    const fetchFundRanking = async () => {
      try {
        if (!HOME_ETF_SYMBOLS.length) {
          if (!cancelled) setFundRanking([])
          return
        }

        const latestRows = []
        for (let i = 0; i < HOME_ETF_SYMBOLS.length; i += 80) {
          const batch = HOME_ETF_SYMBOLS.slice(i, i + 80)
          const { data, error } = await supabase
            .from('v_stock_latest')
            .select('symbol,open,close,volume')
            .in('symbol', batch)

          if (error) throw error
          latestRows.push(...(data || []))
        }

        const { data: symbolRows, error: symbolError } = await supabase
          .from('stock_symbols')
          .select('symbol,name,trust_fee')
          .limit(5000)
        if (symbolError) throw symbolError

        const symbolMap = new Map((symbolRows || []).map((row) => [row.symbol, row]))
        const latestMap = new Map(
          (latestRows || [])
            .filter((row) => row?.symbol && ETF_META_MAP.has(row.symbol))
            .map((row) => [row.symbol, row])
        )

        const symbolsForHistory = [...latestMap.values()]
          .sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0))
          .slice(0, HOME_FUND_HISTORY_FETCH_LIMIT)
          .map((row) => row.symbol)

        const cutoff = new Date()
        cutoff.setFullYear(cutoff.getFullYear() - 1)
        const cutoffStr = cutoff.toISOString().slice(0, 10)
        const historyBySymbol = new Map()

        const fetchHistoryBySymbol = async (symbol) => {
          const { data, error } = await supabase
            .from('stock_daily_prices')
            .select('symbol,trade_date,close,volume,source,fetched_at')
            .eq('symbol', symbol)
            .gte('trade_date', cutoffStr)
            .order('trade_date', { ascending: true })
            .limit(800)

          if (error) throw error
          return dedupeStockDailyPricesByTradeDate(data || [])
        }

        for (let i = 0; i < symbolsForHistory.length; i += 10) {
          const batch = symbolsForHistory.slice(i, i + 10)
          const results = await Promise.all(batch.map((symbol) => fetchHistoryBySymbol(symbol)))
          results.forEach((rows, idx) => {
            historyBySymbol.set(batch[idx], rows)
          })
        }

        const rankingRows = [...latestMap.keys()].map((symbol) => {
          const latest = latestMap.get(symbol) || {}
          const meta = symbolMap.get(symbol) || {}
          const xlsxMeta = ETF_META_MAP.get(symbol)
          const history = historyBySymbol.get(symbol) || []
          const adjustedClosesRaw = buildSplitAdjustedCloses(history, {
            skipSplitHeuristic: skipEodSplitHeuristicForSymbol(symbol),
          })
          const closes = adjustedClosesRaw.filter((value) => Number.isFinite(value) && value > 0)
          const { close, sessionDod } = resolveSpotCloseAndSessionChange(history, adjustedClosesRaw, latest)
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
          const ret1y = hasReliableOneYearHistory && oneYearBaseClose != null && oneYearBaseClose > 0 && close > 0
            ? ((close - oneYearBaseClose) / oneYearBaseClose) * 100
            : null
          const avgVolume = volumes.length > 0
            ? volumes.slice(-30).reduce((sum, value) => sum + value, 0) / Math.min(30, volumes.length)
            : Math.max(0, Number(latest.volume || 0))
          const ret1d = Number.isFinite(sessionDod.changePct) ? sessionDod.changePct : 0
          const clickScore = Math.max(0, avgVolume * (1 + (Math.max(ret1d, 0) / 100)))
          const trustFeeValue = Number.isFinite(Number(meta.trust_fee)) ? Number(meta.trust_fee) : Number(xlsxMeta?.trustFee)
          const displayName = normalizeFundDisplayName(xlsxMeta?.jpName || meta.name || symbol)

          const isinCode = String(xlsxMeta?.isin || '').trim().toUpperCase()
          return {
            id: symbol,
            name: displayName,
            category: detectCategory(displayName),
            isAiTheme: AI_THEME_SYMBOL_SET.has(symbol) || AI_THEME_ISIN_SET.has(isinCode) || isAiThemeFundName(displayName),
            isHighDividend: HIGH_DIVIDEND_SYMBOL_SET.has(symbol) || HIGH_DIVIDEND_ISIN_SET.has(isinCode) || isHighDividendFundName(displayName),
            trustFee: Number.isFinite(trustFeeValue) ? trustFeeValue : null,
            ret1y,
            clickScore,
            avgVolume,
          }
        })

        if (!cancelled) {
          setFundRanking(rankingRows)
        }
      } catch (error) {
        console.error('Failed to load home fund ranking:', error)
        if (!cancelled) setFundRanking([])
      }
    }

    fetchFundRanking()

    return () => {
      cancelled = true
    }
  }, [])

  const investProjection = useMemo(() => {
    const monthlyMan = Math.max(0, Number(investMonthly) || 0)
    const annualRatePct = Math.max(0, Number(investRate) || 0)
    const years = Math.max(1, Number(investYears) || 1)
    const months = years * 12
    const monthlyYen = monthlyMan * 10000
    const principal = monthlyYen * months
    const monthlyRate = annualRatePct / 100 / 12
    const futureValue = monthlyRate > 0
      ? monthlyYen * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      : principal
    // Simple assumption for funnel preview: iDeCo adds annual tax deduction benefit.
    const assumedTaxRate = 0.2
    const annualContribution = monthlyYen * 12
    const taxBenefit = investType === 'ideco'
      ? Math.floor(annualContribution * assumedTaxRate * years)
      : 0
    const projectedTotal = Math.floor(futureValue + taxBenefit)
    return {
      principal: Math.floor(principal),
      futureValue: Math.floor(futureValue),
      gain: Math.max(0, Math.floor(futureValue - principal)),
      taxBenefit,
      projectedTotal,
    }
  }, [investMonthly, investRate, investYears, investType])

  const cashOnlyValue = investProjection.principal
  const potentialGap = Math.max(0, investProjection.projectedTotal - cashOnlyValue)
  const investReturnPct = cashOnlyValue > 0 ? (potentialGap / cashOnlyValue) * 100 : 0
  const cashVsInvestSeries = useMemo(() => {
    const years = Math.max(1, Number(investYears) || 1)
    const monthlyYen = Math.max(0, Number(investMonthly) || 0) * 10000
    const annualRate = Math.max(0, Number(investRate) || 0) / 100
    const monthlyRate = annualRate / 12
    const rows = [{ year: 0, cash: 0, invest: 0, gap: 0 }]
    let cash = 0
    let invest = 0
    for (let year = 1; year <= years; year += 1) {
      for (let month = 0; month < 12; month += 1) {
        cash += monthlyYen
        invest += monthlyYen
        if (monthlyRate > 0) invest *= (1 + monthlyRate)
      }
      rows.push({
        year,
        cash: Math.round(cash),
        invest: Math.round(invest),
        gap: Math.max(0, Math.round(invest - cash)),
      })
    }
    return rows
  }, [investYears, investMonthly, investRate])
  const finalGapPoint = cashVsInvestSeries[cashVsInvestSeries.length - 1] || { gap: potentialGap }
  const refinanceExample = useMemo(() => {
    const principalYen = 35000000
    const years = 25
    const months = years * 12
    const currentApr = 1.35
    const refiApr = 0.85
    const calcMonthly = (aprPct) => {
      const r = aprPct / 100 / 12
      if (r <= 0) return principalYen / months
      const factor = Math.pow(1 + r, months)
      return (principalYen * r * factor) / (factor - 1)
    }
    const monthlyCurrent = Math.round(calcMonthly(currentApr))
    const monthlyRefi = Math.round(calcMonthly(refiApr))
    const totalInterestCurrent = Math.max(0, monthlyCurrent * months - principalYen)
    const totalInterestRefi = Math.max(0, monthlyRefi * months - principalYen)
    return {
      principalYen,
      years,
      currentApr,
      refiApr,
      monthlyCurrent,
      monthlyRefi,
      monthlyDiff: Math.max(0, monthlyCurrent - monthlyRefi),
      totalInterestSaving: Math.max(0, totalInterestCurrent - totalInterestRefi),
    }
  }, [])
  const refinanceMonthlyReductionPct = refinanceExample.monthlyCurrent > 0
    ? (refinanceExample.monthlyDiff / refinanceExample.monthlyCurrent) * 100
    : 0

  /** /funds 一覧と同じく「1年リターンが算出できる銘柄」のみ Top5 に出す */
  const fundRankingOnFundPage = useMemo(
    () => fundRanking.filter((f) => f?.ret1y != null && Number.isFinite(Number(f.ret1y))),
    [fundRanking]
  )

  const mostClickedTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .sort((a, b) => Number(b.clickScore || 0) - Number(a.clickScore || 0))
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const bestPerformingTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .sort((a, b) => Number(b.ret1y || -999) - Number(a.ret1y || -999))
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const lowFeeTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .filter((fund) => Number.isFinite(Number(fund.trustFee)))
      .sort((a, b) => Number(a.trustFee) - Number(b.trustFee))
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const volumeTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .filter((fund) => Number(fund.avgVolume || 0) > 0)
      .sort((a, b) => Number(b.avgVolume || 0) - Number(a.avgVolume || 0))
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const aiThemeTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .filter((fund) => fund.isAiTheme)
      .sort((a, b) => {
        const aRet = Number.isFinite(Number(a.ret1y)) ? Number(a.ret1y) : -999
        const bRet = Number.isFinite(Number(b.ret1y)) ? Number(b.ret1y) : -999
        if (bRet !== aRet) return bRet - aRet
        return Number(b.clickScore || 0) - Number(a.clickScore || 0)
      })
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const highDividendTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .filter((fund) => fund.isHighDividend)
      .sort((a, b) => {
        const aRet = Number.isFinite(Number(a.ret1y)) ? Number(a.ret1y) : -999
        const bRet = Number.isFinite(Number(b.ret1y)) ? Number(b.ret1y) : -999
        if (bRet !== aRet) return bRet - aRet
        return Number(b.clickScore || 0) - Number(a.clickScore || 0)
      })
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const top5SectionPages = useMemo(() => {
    const sections = [
      {
        id: 'interest',
        title: '注目度 Top 5',
        tone: 'slate',
        accent: 'hover:border-blue-300',
        source: 'home_top_interest',
        list: mostClickedTop5,
        empty: 'データがありません',
        metric: (fund) => `関心指標 ${Math.round(Number(fund.clickScore || 0)).toLocaleString()}`,
        metricClass: 'text-slate-500 dark:text-slate-400',
      },
      {
        id: 'performance',
        title: '高パフォーマンス商品 Top 5',
        tone: 'emerald',
        accent: 'hover:border-emerald-300',
        source: 'home_top_performance',
        list: bestPerformingTop5,
        empty: 'データがありません',
        metric: (fund) => `1Y ${Number(fund.ret1y) > 0 ? '+' : ''}${Number(fund.ret1y).toFixed(1)}%`,
        metricClass: (fund) => {
          const r = Number(fund.ret1y)
          if (!Number.isFinite(r)) return 'text-slate-500 dark:text-slate-400'
          return signedReturnTextClassStrong(r)
        },
      },
      {
        id: 'low-fee',
        title: '低コストファンド Top 5',
        tone: 'indigo',
        accent: 'hover:border-indigo-300',
        source: 'home_top_low_fee',
        list: lowFeeTop5,
        empty: '手数料データがありません',
        metric: (fund) => `信託報酬 ${Number(fund.trustFee).toFixed(2)}%`,
        metricClass: 'text-indigo-600 dark:text-indigo-300',
      },
      {
        id: 'volume',
        title: '出来高ランキング Top 5',
        tone: 'orange',
        accent: 'hover:border-orange-300',
        source: 'home_top_volume',
        list: volumeTop5,
        empty: '出来高データがありません',
        metric: (fund) => `平均出来高 ${Math.round(Number(fund.avgVolume || 0) / 1000).toLocaleString()}K`,
        metricClass: 'text-orange-600 dark:text-orange-300',
      },
      {
        id: 'ai-theme',
        title: 'AIテーマ Top 5',
        tone: 'orange',
        accent: 'hover:border-orange-300',
        source: 'home_top_ai_theme',
        list: aiThemeTop5,
        empty: 'AIテーマデータがありません',
        metric: (fund) => Number.isFinite(Number(fund.ret1y))
          ? `1Y ${Number(fund.ret1y) > 0 ? '+' : ''}${Number(fund.ret1y).toFixed(1)}%`
          : `関心指標 ${Math.round(Number(fund.clickScore || 0)).toLocaleString()}`,
        metricClass: (fund) => (
          Number.isFinite(Number(fund.ret1y))
            ? signedReturnTextClassStrong(Number(fund.ret1y))
            : 'text-orange-600 dark:text-orange-300'
        ),
      },
      {
        id: 'high-dividend',
        title: '高配当 Top 5',
        tone: 'emerald',
        accent: 'hover:border-emerald-300',
        source: 'home_top_high_dividend',
        list: highDividendTop5,
        empty: '高配当データがありません',
        metric: (fund) => Number.isFinite(Number(fund.ret1y))
          ? `1Y ${Number(fund.ret1y) > 0 ? '+' : ''}${Number(fund.ret1y).toFixed(1)}%`
          : `関心指標 ${Math.round(Number(fund.clickScore || 0)).toLocaleString()}`,
        metricClass: (fund) => {
          const r = Number(fund.ret1y)
          if (!Number.isFinite(r)) return 'text-slate-500 dark:text-slate-400'
          return signedReturnTextClassStrong(r)
        },
      },
    ]
    const pages = []
    for (let i = 0; i < sections.length; i += 2) pages.push(sections.slice(i, i + 2))
    return pages
  }, [aiThemeTop5, bestPerformingTop5, highDividendTop5, lowFeeTop5, mostClickedTop5, volumeTop5])

  useEffect(() => {
    if (top5SectionPages.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setActiveTop5Group((current) => (current + 1) % top5SectionPages.length)
    }, 7000)
    return () => window.clearInterval(timer)
  }, [top5SectionPages.length])

  const handleRiskClick = () => {
    if (session?.user) {
      trackAndNavigate('/tools', { source: 'home_step_diagnose' })
      return
    }
    if (typeof openRiskModal === 'function') {
      openRiskModal()
    } else {
      setIsRiskModalOpen(true)
    }
  }

  const moneySupportFeatures = [
    {
      id: 'feature-1',
      icon: Wallet,
      accent: 'from-rose-100 to-rose-50 dark:from-rose-900/40 dark:to-rose-900/10 text-rose-600 dark:text-rose-300',
      title: '会員登録後すぐに、無料で使いはじめられます',
      desc: '会員登録後、すぐに家計・資産の見える化を開始できます。毎日の確認もワンタップで完結。',
      cta: 'まずは家計管理を始める',
      link: '/mypage?tab=wealth',
    },
    {
      id: 'feature-2',
      icon: Layers3,
      accent: 'from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/10 text-amber-700 dark:text-amber-300',
      title: '資産全体を、ひとつの画面で把握する',
      desc: '投資・家計・ローンをひとつの画面に集約。バラバラになりがちな情報を、整理して確認できます。',
      cta: '資産運用タブを見る',
      link: '/mypage?tab=wealth',
    },
    {
      id: 'feature-3',
      icon: Sparkles,
      accent: 'from-sky-100 to-sky-50 dark:from-sky-900/40 dark:to-sky-900/10 text-sky-600 dark:text-sky-300',
      title: '1分で、今月の状況を確認できます',
      desc: '推移チャートとインサイトで、今月の資産変化とチェックポイントをすばやく把握できます。',
      cta: '分析レポートを確認',
      link: '/mypage?tab=wealth',
    },
  ]

  return (
    <div className="pb-24 animate-fadeIn font-sans bg-[#F8FAFC] dark:bg-slate-950">
      <style>{`
        @keyframes mmPhoneFloat {
          0% { transform: translateY(0px) rotate(9deg); }
          50% { transform: translateY(-8px) rotate(9deg); }
          100% { transform: translateY(0px) rotate(9deg); }
        }
        @keyframes mmTop5FadeSlide {
          0% { opacity: 0; transform: translateY(10px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mmPhoneGlowPulse {
          0% { opacity: 0.62; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 0.62; transform: scale(0.96); }
        }
      `}</style>
      {/* 1. Hero Section */}
      <section className="relative bg-gradient-to-br from-white via-[#FFF8F2] to-[#FFF3E8] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-10 md:pt-12 pb-10 md:pb-12 px-4 sm:px-5 rounded-b-[2.5rem] shadow-xl dark:shadow-black/50 border-b border-transparent dark:border-slate-800/80">
        {/* overflow は背景ブロブ用ラッパーのみ。ヒーロー全体にかけると共有メニューがクリップされる */}
        <div
          className="absolute inset-0 overflow-hidden rounded-b-[2.5rem] pointer-events-none z-0"
          aria-hidden
        >
          <div className="absolute inset-0 opacity-18 dark:opacity-[0.07] bg-[linear-gradient(128deg,transparent_0%,rgba(249,115,22,0.06)_43%,transparent_55%,rgba(251,146,60,0.08)_72%,transparent_82%)] dark:bg-[linear-gradient(128deg,transparent_0%,rgba(249,115,22,0.12)_45%,transparent_60%,rgba(251,146,60,0.1)_75%,transparent_85%)]" />
          <div className="absolute top-[-35%] right-[-15%] w-[65%] h-[150%] bg-orange-200/30 dark:bg-orange-900/20 blur-[96px] rounded-full" />
          <div className="absolute bottom-[-25%] left-[-10%] w-[55%] h-[120%] bg-amber-100/40 dark:bg-amber-900/15 blur-[88px] rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(95%,48rem)] h-[75%] bg-orange-100/35 dark:bg-orange-950/25 blur-[74px] rounded-full" />
        </div>

        <div
          className={`max-w-7xl mx-auto relative z-10 grid grid-cols-1 gap-8 md:gap-10 lg:grid-cols-[1.12fr_1fr] lg:gap-x-5 lg:gap-y-10 lg:items-start ${
            REFERRAL_INVITE_UI_ENABLED && session?.user && referralCode
              ? "[grid-template-areas:'hero-text'_'hero-refer'_'hero-phone'] lg:[grid-template-areas:'hero-text_hero-phone'_'hero-refer_hero-refer']"
              : "[grid-template-areas:'hero-text'_'hero-phone'] lg:[grid-template-areas:'hero-text_hero-phone']"
          }`}
        >
          <div className="[grid-area:hero-text] text-left flex flex-col items-start min-w-0 w-full px-3 sm:px-4 md:px-5 lg:pl-6 lg:pr-2 xl:pl-8">
            <div className="mb-4 md:mb-6">
              <p className="inline-flex items-center rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 text-white font-black text-base md:text-lg shadow-[0_8px_18px_rgba(249,115,22,0.35)]">
                金融の始まりは、ここから。
              </p>
            </div>

            <h1 className="font-black tracking-tight mb-3 md:mb-4 max-w-xl lg:max-w-2xl min-w-0">
              {/* bg-clip-text は WebKit で字形の上が欠けることがあるため、グラデに近いソリッド色で分割 */}
              <div className="w-full min-w-0">
                <span className="inline-block max-w-full whitespace-nowrap text-[clamp(1.02rem,calc(2.2vw_+_0.78rem),2.9rem)] sm:text-[2.2rem] md:text-[2.55rem] lg:text-[2.9rem] leading-normal sm:leading-snug py-0.5">
                  <span className="text-orange-600 dark:text-orange-400">金融の選択を、</span>
                  <span className="text-orange-500 dark:text-orange-300">もっと</span>
                  <span className="text-red-600 dark:text-red-400">スマートに。</span>
                </span>
              </div>
              <span className="block mt-1 sm:mt-1.5 text-slate-900 dark:text-slate-100 text-[1.62rem] min-[400px]:text-[1.75rem] sm:text-[2.2rem] md:text-[2.55rem] lg:text-[2.9rem] leading-[1.12] sm:leading-[1.08] text-balance">
                必要なものは、ここに<span className="text-red-500 dark:text-red-400">揃う</span>。
              </span>
            </h1>

            <div
              className="w-full max-w-lg h-px mb-4 md:mb-5 rounded-full bg-gradient-to-r from-orange-300 via-orange-200/70 to-transparent dark:from-orange-600 dark:via-orange-500/50 dark:to-transparent"
              aria-hidden
            />

            <ul className="space-y-2.5 md:space-y-3 mb-6 md:mb-8 w-full max-w-lg text-left">
              <li className="flex items-start gap-3 text-base md:text-lg text-slate-800 dark:text-slate-200 font-bold leading-snug">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300/80 dark:ring-orange-700/60">
                  <Check size={14} strokeWidth={3} className="text-orange-600 dark:text-orange-400" />
                </span>
                <span>中立な比較（<span className="text-orange-600 dark:text-orange-400">提携なし</span>）</span>
              </li>
              <li className="flex items-start gap-3 text-base md:text-lg text-slate-800 dark:text-slate-200 font-bold leading-snug">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300/80 dark:ring-orange-700/60">
                  <Check size={14} strokeWidth={3} className="text-orange-600 dark:text-orange-400" />
                </span>
                <span>登録するだけで、<span className="text-orange-600 dark:text-orange-400">すぐ使える</span></span>
              </li>
              <li className="flex items-start gap-3 text-base md:text-lg text-slate-800 dark:text-slate-200 font-bold leading-snug">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300/80 dark:ring-orange-700/60">
                  <Check size={14} strokeWidth={3} className="text-orange-600 dark:text-orange-400" />
                </span>
                <span>主要サービスをまとめて<span className="text-orange-600 dark:text-orange-400">比較</span></span>
              </li>
            </ul>

            <div className="flex flex-col w-full sm:w-auto justify-start gap-3">
              <button
                type="button"
                onClick={() => (session?.user ? trackAndNavigate('/mypage?tab=wealth', { source: 'home_hero_mypage' }) : trackAndNavigate('/signup', { source: 'home_hero_signup' }))}
                className="px-7 py-3.5 sm:py-4 bg-orange-500 text-white hover:bg-orange-600 rounded-full font-black text-base md:text-lg transition shadow-[0_12px_26px_rgba(249,115,22,0.35)] inline-flex items-center justify-center gap-1.5 min-h-[48px] w-full sm:w-auto"
              >
                {session?.user ? 'マイページへ' : '無料登録'}
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => (
                  session?.user
                    ? trackAndNavigate('/mypage?tab=wealth', { source: 'home_hero_today_finance_data' })
                    : trackAndNavigate('/signup', { source: 'home_hero_today_finance_data_signup' })
                )}
                className="text-left text-sm font-bold text-slate-600 dark:text-slate-400 underline-offset-4 hover:underline py-0.5"
              >
                今日の金融データを見る ↓
              </button>
              {REFERRAL_INVITE_UI_ENABLED && !session?.user ? (
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
                  無料登録後は、友だち招待リンクでシェアできます。
                </p>
              ) : null}
            </div>
          </div>

          {REFERRAL_INVITE_UI_ENABLED && session?.user && referralCode ? (
            <div
              id="home-invite-friends"
              className="[grid-area:hero-refer] w-full max-w-lg lg:max-w-none mx-auto lg:mx-0 rounded-2xl border-2 border-orange-300 dark:border-orange-700 bg-white/90 dark:bg-slate-900/80 px-4 py-3 shadow-md shadow-orange-500/10"
            >
              <p className="text-xs font-black text-orange-600 dark:text-orange-400 mb-1">トップのヒーロー内 · 友だち招待</p>
              <p className="text-sm font-black text-slate-900 dark:text-white mb-1">招待リンクをコピー・共有</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
                友だちがこのURLから<span className="font-bold text-orange-600 dark:text-orange-400">無料登録</span>すると、あなたの紹介として記録されます。
              </p>
              <div className="flex flex-col lg:flex-row lg:items-stretch lg:gap-4">
                <code className="block flex-1 min-w-0 text-[11px] font-mono break-all text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 mb-2 lg:mb-0 border border-slate-200 dark:border-slate-700 lg:self-center">
                  {referralInviteUrl}
                </code>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0 lg:w-[min(100%,380px)]">
                  <button
                    type="button"
                    onClick={() => void copyReferralLink()}
                    className="flex-1 min-h-10 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black"
                  >
                    {referralCopied ? 'コピーしました' : 'リンクをコピー'}
                  </button>
                  <ReferralShareMenu
                    inviteUrl={referralInviteUrl}
                    onShareMethod={(method) => trackAnalyticsEvent('home_referral_share', { method })}
                    onNotify={(msg) => {
                      setReferralShareHint(msg)
                      window.setTimeout(() => setReferralShareHint(''), 2500)
                    }}
                  />
                </div>
              </div>
              {referralShareHint ? (
                <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">{referralShareHint}</p>
              ) : null}
            </div>
          ) : null}

          <div className="[grid-area:hero-phone] relative flex justify-center lg:justify-center lg:pl-0 lg:pr-2 xl:pl-1 xl:pr-4">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-60 md:w-72 md:h-64 bg-orange-200/45 dark:bg-orange-900/35 blur-3xl rounded-full" style={{ animation: 'mmPhoneGlowPulse 3.8s ease-in-out infinite' }} />
              <div className="absolute w-80 h-80 md:w-[22rem] md:h-[22rem] rounded-full bg-orange-300/30 dark:bg-orange-800/25 blur-[78px]" style={{ animation: 'mmPhoneGlowPulse 4.6s ease-in-out infinite 120ms' }} />
              <div className="absolute w-[320px] h-[320px] md:w-[370px] md:h-[370px] rounded-full border border-white/45 dark:border-orange-400/20 shadow-[0_0_95px_rgba(255,255,255,0.45),0_0_120px_rgba(251,146,60,0.28)] dark:shadow-[0_0_80px_rgba(251,146,60,0.15),0_0_100px_rgba(15,23,42,0.5)]" style={{ animation: 'mmPhoneGlowPulse 5.2s ease-in-out infinite 240ms' }} />
            </div>
            {/* コンパクト「アプリ」シェル：中身はスクロールで全機能へジャンプ可能 */}
            <div
              className="relative z-[1] w-[min(100%,312px)] sm:w-[min(100%,334px)] h-[min(500px,76vh)] max-h-[min(500px,76vh)] flex flex-col rounded-[1.65rem] overflow-hidden shadow-[0_26px_60px_rgba(0,0,0,0.35),0_0_60px_rgba(251,146,60,0.36)] dark:shadow-[0_26px_60px_rgba(0,0,0,0.65),0_0_48px_rgba(251,146,60,0.22)] border border-white/35 dark:border-slate-600/40 ring-2 ring-orange-200/45 dark:ring-orange-900/50 bg-[#0f0a08] lg:-translate-x-1 xl:-translate-x-2"
              style={{ animation: 'mmPhoneFloat 5.2s ease-in-out infinite' }}
            >
              <div className="shrink-0 h-3 flex items-end justify-center pb-0.5 bg-[#0f0a08]">
                <div className="w-11 h-[3px] rounded-full bg-slate-600" />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]">
                <div className="bg-[#14100d] px-2.5 pt-2 pb-2.5">
                  <div className="flex items-center justify-between gap-1 mb-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 shadow-md shadow-orange-500/25">
                        <span className="text-white font-black text-[10px]">M</span>
                      </div>
                      <span className="text-white font-black text-sm truncate">MoneyMart</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                        新NISA
                      </span>
                      <button
                        type="button"
                        aria-label={homeAlertCount > 0 ? `通知（未読${homeAlertCount}件）` : '通知'}
                        className="relative p-1 rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
                        onClick={() => trackAndNavigate('/mypage', { source: 'home_app_bell' })}
                      >
                        <Bell size={14} />
                        {session?.user && homeAlertCount > 0 ? (
                          <>
                            <span
                              className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-[8px] font-black text-white flex items-center justify-center ring-2 ring-[#14100d]"
                              aria-hidden
                            >
                              {homeAlertCount > 9 ? '9+' : homeAlertCount}
                            </span>
                          </>
                        ) : null}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div
                      className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center text-lg shrink-0 border border-white/15"
                      aria-hidden
                    >
                      🐕
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-[11px] leading-tight">
                        {greetingJa}、{appHomeDisplayName}
                      </p>
                      <p className="text-slate-500 text-[9px] mt-0.5 leading-snug">今日も投資を楽しみましょう！</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => trackAndNavigate(session?.user ? '/mypage' : '/funds', { source: 'home_app_portfolio_banner' })}
                    className="mt-2 w-full text-left text-[9px] font-bold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 transition"
                  >
                    ファンドを追加してポートフォリオを始めよう
                  </button>
                </div>

                <div className="bg-[#e8edf4] dark:bg-slate-900 px-2 pt-2 pb-2">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200/90 dark:border-slate-700 p-2.5 mb-2">
                    <div className="flex gap-2">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/30 flex items-center justify-center text-xl shrink-0 border border-orange-200/40">
                        🐕
                      </div>
                      <p className="text-[10px] font-bold text-slate-800 dark:text-slate-100 leading-snug">
                        ファンドを追加すると、資産の推移や配当の見込みがひと目でわかります。
                      </p>
                    </div>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => trackAndNavigate('/funds', { source: 'home_app_add_fund' })}
                        className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Plus size={14} strokeWidth={2.5} /> ファンドを追加
                      </button>
                      <button
                        type="button"
                        onClick={() => trackAndNavigate('/tools', { source: 'home_app_simulation' })}
                        className="w-full py-2 rounded-lg bg-white dark:bg-slate-900 border border-orange-400 text-orange-600 dark:text-orange-400 text-[10px] font-black flex items-center justify-center gap-1"
                      >
                        <LucideLineChart size={14} strokeWidth={2.2} /> シミュレーション
                      </button>
                    </div>
                  </div>

                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 mb-1 px-0.5">クイックアクション</p>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {[
                      { label: 'ファンド', Icon: BarChart2, bg: 'bg-orange-100 dark:bg-orange-950/60', fg: 'text-orange-600 dark:text-orange-400', to: '/funds', sid: 'home_qa_fund' },
                      { label: 'ニュース', Icon: Newspaper, bg: 'bg-emerald-100 dark:bg-emerald-950/50', fg: 'text-emerald-600 dark:text-emerald-400', to: '/news', sid: 'home_qa_news' },
                      { label: 'NISA', Icon: Shield, bg: 'bg-sky-100 dark:bg-sky-950/50', fg: 'text-sky-600 dark:text-sky-400', to: '/tools', sid: 'home_qa_nisa' },
                      { label: '配当', Icon: CalendarDays, bg: 'bg-rose-100 dark:bg-rose-950/50', fg: 'text-rose-600 dark:text-rose-400', to: '/dividend-calendar', sid: 'home_qa_div' },
                      { label: 'ヒート', Icon: LayoutGrid, bg: 'bg-lime-100 dark:bg-lime-950/40', fg: 'text-lime-700 dark:text-lime-400', to: '/market', sid: 'home_qa_heat' },
                      { label: '比較', Icon: RefreshCw, bg: 'bg-amber-100 dark:bg-amber-950/40', fg: 'text-amber-700 dark:text-amber-400', to: '/funds/compare', sid: 'home_qa_compare' },
                      { label: '税金', Icon: Percent, bg: 'bg-violet-100 dark:bg-violet-950/50', fg: 'text-violet-600 dark:text-violet-400', to: '/tools', sid: 'home_qa_tax' },
                      { label: 'マイ', Icon: User, bg: 'bg-cyan-100 dark:bg-cyan-950/50', fg: 'text-cyan-600 dark:text-cyan-400', to: '/mypage', sid: 'home_qa_mypage' },
                    ].map((item) => {
                      const QaIcon = item.Icon
                      return (
                        <button
                          key={item.sid}
                          type="button"
                          onClick={() => trackAndNavigate(item.to, { source: item.sid })}
                          className={`flex flex-col items-center justify-center gap-0.5 rounded-xl ${item.bg} ${item.fg} py-2 px-0.5 border border-black/[0.04] dark:border-white/5 hover:opacity-90 active:scale-[0.97] transition`}
                        >
                          <QaIcon size={16} strokeWidth={2.2} />
                          <span className="text-[7px] font-black leading-none text-center text-slate-700 dark:text-slate-200">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 mb-1 px-0.5">マーケット速報</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 [scrollbar-width:thin]">
                    {marketFlash.length === 0
                      ? HOME_MARKET_FLASH.map((cfg) => (
                        <div
                          key={cfg.symbol}
                          className="min-w-[108px] shrink-0 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 shadow-sm"
                        >
                          <p className="text-[8px] font-black text-slate-400">{cfg.country}</p>
                          <p className="text-[9px] font-bold text-slate-800 dark:text-slate-100 leading-tight mt-0.5 line-clamp-2">{cfg.headline}</p>
                          <p className="text-sm font-black text-slate-300 dark:text-slate-600 mt-0.5">…</p>
                        </div>
                      ))
                      : marketFlash.map((row) => (
                        <button
                          key={row.symbol}
                          type="button"
                          onClick={() => trackAndNavigate(`/funds/${encodeURIComponent(row.symbol)}`, { source: 'home_market_flash', symbol: row.symbol })}
                          className="min-w-[112px] shrink-0 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 shadow-sm text-left hover:border-orange-400 transition"
                        >
                          <p className="text-[8px] font-black text-slate-400 dark:text-slate-500">{row.country}</p>
                          <p className="text-[9px] font-bold text-slate-800 dark:text-slate-100 leading-tight mt-0.5 line-clamp-2">{row.headline}</p>
                          <p className="text-[13px] font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">{formatFlashPrice(row.price)}</p>
                          <p
                            className={`text-[9px] font-black tabular-nums ${
                              row.pct == null ? 'text-slate-400' : signedReturnTextClassStrong(row.pct)
                            }`}
                          >
                            {row.pct == null ? '—' : `${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(2)}%`}
                          </p>
                        </button>
                      ))}
                  </div>
                  <p className="text-[7px] text-slate-400 dark:text-slate-500 mt-1.5 leading-snug px-0.5">
                    ETF参考値。指数ではありません。勧誘・保証ではありません。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 登録前の離脱防止：マイページ相当機能のイメージ（資産カードのみ見本金額あり・実データではない） */}
      <section className="max-w-7xl mx-auto px-4 mt-8 mb-8" aria-labelledby="home-mypage-preview-heading">
        <div className="rounded-[1.75rem] border border-orange-200/80 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/90 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-orange-950/30 p-5 md:p-7 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black tracking-[0.2em] text-orange-600 dark:text-orange-400">登録前にイメージ</p>
              <h2 id="home-mypage-preview-heading" className="mt-2 text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-snug">
                無料登録すると、資産・配当の整理とファンド配分の検討をこのアプリひとつで始められます
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                読み込み中ではなく、<strong className="text-slate-800 dark:text-slate-200">完成した画面の見た目の例</strong>です。下の金額は<strong className="text-slate-800 dark:text-slate-200">デモ用の見本</strong>で、登録後は保有・口座から<strong className="text-slate-800 dark:text-slate-200">あなたの実数</strong>が集計されます。
              </p>
            </div>
            <button
              type="button"
              onClick={() => trackAndNavigate(session?.user ? '/mypage?tab=wealth' : '/signup', { source: 'home_mypage_preview_cta' })}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-black px-6 py-3 shadow-md shadow-orange-500/25"
            >
              {session?.user ? 'マイページを開く' : '無料登録で試す'}
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 sm:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] gap-4 items-stretch">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 sm:p-5 shadow-sm min-w-0 w-full h-full flex flex-col">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <div className="h-9 w-9 rounded-xl bg-slate-900 dark:bg-orange-500 flex items-center justify-center">
                  <Wallet size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black text-orange-600 dark:text-orange-400">マイページ</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">資産のダッシュボード</p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-700 px-3.5 py-3 sm:px-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">総資産</p>
                  <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/80 border border-orange-200/80 dark:border-orange-800 rounded-md px-2 py-0.5 shrink-0">デモ</span>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums tracking-tight">
                  ¥{HOME_MYPAGE_PREVIEW_DEMO_TOTAL_YEN.toLocaleString('ja-JP')}
                </p>
                <p className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  先月比 +¥{HOME_MYPAGE_PREVIEW_DEMO_DELTA_YEN.toLocaleString('ja-JP')} (+1.0%) ※例示
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-400 leading-snug">登録後は、保有銘柄・口座から実数で集計されます</p>
                <div className="mt-3 flex items-end justify-between gap-1 h-12 px-0.5">
                  {[12, 18, 14, 22, 16, 20, 15].map((h, i) => (
                    <div
                      key={`demo-bar-${i}`}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-orange-200 to-orange-400/90 dark:from-orange-900/60 dark:to-orange-600/50"
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[9px] font-bold text-slate-400 text-center">直近の推移（デモ・棒は比率のみ・実数ではありません）</p>
                <div className="flex-1 min-h-2" aria-hidden />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 sm:p-5 shadow-sm min-w-0 w-full h-full flex flex-col">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center">
                  <CalendarDays size={18} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-xs font-black text-rose-600 dark:text-rose-400">配当カレンダー</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">受取予定リスト</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-950">
                <div className="divide-y divide-slate-100 dark:divide-slate-800 shrink-0">
                  {[
                    { mo: '3月', t: '登録した銘柄', s: '予定日・金額は自動表示' },
                    { mo: '5月', t: '国内株式・ETF など', s: '年次・四半期で整理' },
                    { mo: '—', t: 'ウォッチ銘柄も一覧化', s: '見落としにくい構成' },
                  ].map((row) => (
                    <div key={row.t} className="flex items-stretch gap-2 px-3 py-2 bg-white dark:bg-slate-950">
                      <div className="w-9 shrink-0 rounded-lg bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
                        <span className="text-[10px] font-black text-rose-700 dark:text-rose-300">{row.mo}</span>
                      </div>
                      <div className="min-w-0 py-0.5">
                        <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 leading-tight">{row.t}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{row.s}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-h-0 bg-white dark:bg-slate-950" aria-hidden />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 sm:p-5 shadow-sm min-w-0 w-full h-full flex flex-col">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <div className="h-9 w-9 rounded-xl bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center">
                  <BarChart2 size={18} className="text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-xs font-black text-sky-600 dark:text-sky-400">ファンドオプティマイザー</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">配分を変えてリスク・リターンを試す</p>
                </div>
              </div>
              <div className="flex flex-col flex-1 min-h-0 gap-2">
                <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 min-w-0">ファンド一覧の3D最適化UI（見本）</span>
                  <span className="text-[9px] font-black text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/80 border border-sky-200/80 dark:border-sky-800 rounded-md px-2 py-0.5 shrink-0">
                    デモ
                  </span>
                </div>
                <div className="flex-1 min-h-0 w-full flex flex-col">
                  <HomeOptimizer3DShowcase />
                </div>
                <p className="text-[9px] font-bold text-slate-400 px-0.5 shrink-0">勧誘・保証ではありません。見本の数値は実データではありません。</p>
                <button
                  type="button"
                  onClick={() => trackAndNavigate('/funds', { source: 'home_mypage_preview_optimizer' })}
                  className="w-full min-h-9 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-black py-2 transition shrink-0"
                >
                  ファンド一覧でオプティマイザーを試す
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 sm:p-5 shadow-sm min-w-0 w-full h-full flex flex-col">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
                  <PieChart size={18} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs font-black text-violet-600 dark:text-violet-400">ローン・負債</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">返済の見える化</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-violet-50/40 dark:bg-violet-950/15 px-3.5 py-3 sm:px-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between text-[10px] font-black text-slate-500 dark:text-slate-400 mb-2 shrink-0">
                  <span>借入の内訳（見た目の例）</span>
                  <span className="text-violet-700 dark:text-violet-400">デモ</span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-snug mb-3 shrink-0">
                  住宅・カードなどを分けて整理し、返済日や残高メモを一覧できます（実数は登録後）。
                </p>
                <div className="flex-1 flex flex-col justify-center min-h-0">
                  <div className="space-y-2.5">
                    {[
                      { lab: '住宅・ローン', tone: 'bg-violet-500 dark:bg-violet-500', w: 'w-[55%]' },
                      { lab: 'カード・リボ', tone: 'bg-amber-400 dark:bg-amber-500', w: 'w-[25%]' },
                      { lab: 'その他', tone: 'bg-rose-400 dark:bg-rose-500', w: 'w-[20%]' },
                    ].map((row) => (
                      <div key={row.lab}>
                        <div className="flex items-center justify-between text-[10px] font-black text-slate-600 dark:text-slate-300 mb-1">
                          <span>{row.lab}</span>
                          <span className="text-slate-400">比率は例示</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200/90 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full ${row.tone} ${row.w}`} aria-hidden />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2.5 text-[9px] font-bold text-slate-400 shrink-0">内訳バーはイメージです。情報は投資助言ではありません。</p>
                <button
                  type="button"
                  onClick={() => trackAndNavigate(session?.user ? '/mypage' : '/signup', { source: 'home_mypage_preview_debt' })}
                  className="mt-3 w-full min-h-9 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-black py-2 transition shrink-0"
                >
                  {session?.user ? 'マイページで借入を整理' : '無料登録して借入を記録'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. はじめての使い方 */}
      <section className="max-w-7xl mx-auto px-4 mt-6 mb-6">
        <div className="rounded-[1.75rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-orange-500">HOW TO USE MONEYMART</p>
              <h2 className="mt-1.5 text-xl md:text-2xl font-black text-slate-900 dark:text-white">投資が初めての方も、3ステップで使いこなせる設計です。</h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                比較・確認・管理を、ひとつの流れで。金融に慣れていない方でも、自分のペースで資産情報と向き合えます。
              </p>
            </div>
            <button
              type="button"
              onClick={() => trackAndNavigate('/tools', { source: 'home_how_to_use' })}
              className="inline-flex items-center gap-2 self-start md:self-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs md:text-sm font-black text-slate-700 dark:text-slate-200 hover:border-orange-300 hover:text-orange-500 transition"
            >
              ツールを確認する
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: 'compare',
                step: '01',
                title: '01 まず、比較する',
                desc: 'ファンド・株式・ローンの条件や違いを横断的に確認。情報収集の手間を、大幅に減らします。',
                cta: 'ファンドを比較する',
                action: () => trackAndNavigate('/funds', { source: 'home_step_compare' }),
                icon: Layers3,
                accent: 'from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20',
                iconColor: 'text-orange-500 dark:text-orange-400',
              },
              {
                id: 'diagnose',
                step: '02',
                title: '02 次に、数字で確認する',
                desc: 'AI診断やシミュレーターで、ご自身の状況に合わせた数字を確認。「なんとなく」の判断から、根拠ある確認へ。',
                cta: '会員登録して、AI診断をはじめる',
                action: handleRiskClick,
                icon: Sparkles,
                accent: 'from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20',
                iconColor: 'text-amber-500 dark:text-amber-400',
              },
              {
                id: 'manage',
                step: '03',
                title: '03 そして、継続して管理する',
                desc: 'マイページで資産・配当・負債を一元管理。「今の全体像」を把握することが、長期的な資産形成の第一歩です。',
                cta: 'マイページで管理をはじめる',
                action: () => trackAndNavigate('/mypage', { source: 'home_step_manage' }),
                icon: Wallet,
                accent: 'from-slate-100 to-orange-100 dark:from-slate-800 dark:to-orange-900/20',
                iconColor: 'text-slate-700 dark:text-orange-300',
              },
            ].map((item) => {
              const StepIcon = item.icon
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 p-4 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.accent} border border-white/60 dark:border-slate-700 flex items-center justify-center shadow-sm`}>
                      <StepIcon size={24} className={item.iconColor} />
                    </div>
                    <span className="text-xs font-black tracking-[0.18em] text-slate-300 dark:text-slate-600">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[56px]">
                    {item.desc}
                  </p>
                  <button
                    type="button"
                    onClick={item.action}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs md:text-sm font-black px-3.5 py-2.5 shadow-sm transition self-start"
                  >
                    {item.cta}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 3. サービスカテゴリ紹介 */}
      <section className="max-w-7xl mx-auto px-4 mt-8 mb-8">
        <div className="mb-4">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">MoneyMart</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">投資判断を、もっと簡単に。</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col">
            <div className="h-28 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border border-orange-200/70 dark:border-orange-800/50 flex items-center justify-center">
              <Landmark size={46} className="text-orange-500 dark:text-orange-400" />
            </div>
            <p className="mt-3 min-h-[64px] text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-wide">ETF・インデックスファンド</p>
            <p className="mt-2 mb-5 min-h-[48px] text-sm text-slate-500 dark:text-slate-400 leading-relaxed">信託報酬・リターン・リスクを一覧で確認。低コストで分散投資を検討したい方の情報収集をサポートします。</p>
            <button
              type="button"
              onClick={() => trackAndNavigate('/funds', { source: 'home_category_funds' })}
              className="mt-auto w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black py-2.5"
            >
              ETF・インデックスファンドを比較する
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col">
            <div className="h-28 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border border-orange-200/70 dark:border-orange-800/50 flex items-center justify-center">
              <TrendingUp size={46} className="text-orange-500 dark:text-orange-400" />
            </div>
            <p className="mt-3 min-h-[64px] text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-wide">個別株式</p>
            <p className="mt-2 mb-5 min-h-[48px] text-sm text-slate-500 dark:text-slate-400 leading-relaxed">国内外の主要銘柄を横断比較。株価推移・各種指標を一画面で確認できます。</p>
            <button
              type="button"
              onClick={() => trackAndNavigate('/stocks', { source: 'home_category_stocks' })}
              className="mt-auto w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black py-2.5"
            >
              個別株式を比較する
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col">
            <div className="h-28 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border border-orange-200/70 dark:border-orange-800/50 flex items-center justify-center">
              <BarChart2 size={46} className="text-orange-500 dark:text-orange-400" />
            </div>
            <p className="mt-3 min-h-[64px] text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-wide">マーケット概況</p>
            <p className="mt-2 mb-5 min-h-[48px] text-sm text-slate-500 dark:text-slate-400 leading-relaxed">日経・米国など主要指数の動向を、日次更新データで確認。市場全体の流れを把握するための情報を提供します。</p>
            <button
              type="button"
              onClick={() => trackAndNavigate('/market', { source: 'home_category_market' })}
              className="mt-auto w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black py-2.5"
            >
              マーケット概況を確認する
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col">
            <div className="h-28 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border border-orange-200/70 dark:border-orange-800/50 flex items-center justify-center">
              <Newspaper size={46} className="text-orange-500 dark:text-orange-400" />
            </div>
            <p className="mt-3 min-h-[64px] text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-wide">AIニュース</p>
            <p className="mt-2 mb-5 min-h-[48px] text-sm text-slate-500 dark:text-slate-400 leading-relaxed">AIが整理した市場関連ニュースを朝・夕にまとめて確認。多忙な方でも、相場の流れを見逃しにくくなります。</p>
            <button
              type="button"
              onClick={() => trackAndNavigate('/news', { source: 'home_category_news' })}
              className="mt-auto w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black py-2.5"
            >
              AIニュースを確認する
            </button>
          </div>
        </div>
      </section>

      {/* 3. ホームデータTop5 */}
      <section ref={hookSimulatorRef} className="max-w-7xl mx-auto px-4 mb-10">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl p-5 md:p-7 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-black text-blue-500">ホーム主要データ</p>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Top 5 インサイト</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">閲覧傾向・リターン・低コスト・AIテーマ・高配当など、複数の切り口でファンドデータを確認できます。</p>
            </div>
            <button
              type="button"
              onClick={() => trackAndNavigate('/funds', { source: 'home_top5_see_all' })}
              className="text-xs font-black text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400"
            >
              すべてのデータを確認する
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            {top5SectionPages.map((_, idx) => (
              <button
                key={`top5-group-${idx}`}
                type="button"
                onClick={() => setActiveTop5Group(idx)}
                className={`h-2.5 rounded-full transition-all ${activeTop5Group === idx ? 'w-8 bg-orange-500' : 'w-2.5 bg-slate-300 dark:bg-slate-700'}`}
                aria-label={`Top 5 グループ ${idx + 1}`}
              />
            ))}
          </div>
          <div
            key={`top5-panel-${activeTop5Group}`}
            className="grid grid-cols-1 xl:grid-cols-2 gap-4"
            style={{ animation: 'mmTop5FadeSlide 420ms ease-out' }}
          >
            {(top5SectionPages[activeTop5Group] || []).map((section) => {
              const toneClasses = section.tone === 'orange'
                ? 'border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/30'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
              const titleClasses = section.tone === 'orange'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-slate-500 dark:text-slate-300'

              return (
                <div key={section.id} className={`rounded-xl border p-4 md:p-5 h-full ${toneClasses}`}>
                  <p className={`text-xs md:text-[13px] font-black mb-3 ${titleClasses}`}>{section.title}</p>
                  {section.list.length > 0 ? (
                    <div className="space-y-3">
                      {section.list.map((fund, idx) => (
                        <button
                          key={`${section.id}-${fund.id}`}
                          type="button"
                          onClick={() => trackFundClick(fund, section.source)}
                          className={`w-full min-h-[84px] text-left rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-3 transition ${section.accent}`}
                        >
                          <div className="flex items-center gap-3.5">
                            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${RANK_BADGE_CLASSES[idx] || RANK_BADGE_CLASSES[RANK_BADGE_CLASSES.length - 1]}`}>
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] md:text-[14px] font-bold tracking-[-0.01em] text-slate-700 dark:text-slate-200 line-clamp-1">
                                {fund.name}
                              </p>
                              <p className={`mt-1 text-[12px] md:text-[13px] font-semibold ${typeof section.metricClass === 'function' ? section.metricClass(fund) : section.metricClass}`}>
                                {section.metric(fund)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{section.empty}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 広告バナー */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <AdBanner variant="horizontal" />
      </div>

      {/* 3. マネーサポートの特徴 */}
      <section className="max-w-7xl mx-auto px-4 mb-14">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">マネーサポートの3つの特徴</h2>
          <div className="w-20 h-1 bg-red-500 rounded-full mx-auto mt-3" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {moneySupportFeatures.map((feature) => {
            const FeatureIcon = feature.icon
            return (
            <div key={feature.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="h-28 flex items-center justify-center mb-3">
                <div className={`relative w-24 h-24 rounded-3xl bg-gradient-to-br ${feature.accent} flex items-center justify-center shadow-sm`}>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700" />
                  <FeatureIcon size={44} strokeWidth={2.2} />
                </div>
              </div>
              <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-center py-2 px-3 font-black text-sm mb-4">
                {feature.title}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4 min-h-[66px]">
                {feature.desc}
              </p>
            </div>
          )})}
        </div>
      </section>

      {/* 6. 롤링 광고 섹션 (Phase 1 비노출) */}

      {/* 7. 대출 & 금융 계산기 */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 p-8 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/50 relative overflow-hidden">
            <div className="relative z-10">
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded mb-3 inline-block">住宅ローン</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">金利の差が、長期では大きな差になります</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-4">
                例: 残高 ¥{refinanceExample.principalYen.toLocaleString()} / 返済期間 {refinanceExample.years}年
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] text-slate-400 font-bold">現在金利 {refinanceExample.currentApr}%</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">月 ¥{refinanceExample.monthlyCurrent.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  <p className="text-[10px] text-slate-400 font-bold">借り換え後 {refinanceExample.refiApr}%</p>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-300">月 ¥{refinanceExample.monthlyRefi.toLocaleString()}</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-black text-indigo-700 dark:text-indigo-300">
                月あたり -¥{refinanceExample.monthlyDiff.toLocaleString()} / 利息削減見込み ¥{refinanceExample.totalInterestSaving.toLocaleString()}
              </p>
              <div className="mt-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white/80 dark:bg-slate-800/60 p-3">
                <p className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 mb-2">月返済の比較（見える化）</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-1">
                      <span>現在</span>
                      <span>¥{refinanceExample.monthlyCurrent.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-slate-700 dark:bg-slate-400 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-indigo-600 dark:text-indigo-300 mb-1">
                      <span>借り換え後</span>
                      <span>¥{refinanceExample.monthlyRefi.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, (refinanceExample.monthlyRefi / Math.max(1, refinanceExample.monthlyCurrent)) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50 px-2.5 py-2">
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-300 font-bold">月返済 削減率</p>
                    <p className="text-sm font-black text-indigo-700 dark:text-indigo-200">-{refinanceMonthlyReductionPct.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/50 px-2.5 py-2">
                    <p className="text-[10px] text-emerald-500 dark:text-emerald-300 font-bold">年間削減額（目安）</p>
                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-200">¥{Math.round(refinanceExample.monthlyDiff * 12).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/mypage?tab=debt')}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black"
              >
                会員登録して、詳細シミュレーションを確認する
              </button>
              <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">{MM_SIMULATION_PAST_PERFORMANCE_JA}</p>
            </div>
            <Home size={120} className="absolute -right-4 -bottom-4 text-indigo-100 dark:text-indigo-900/30" />
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 p-8 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/50 relative overflow-hidden">
            <div className="relative z-10">
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded mb-3 inline-block">比較でわかる</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">預金で保有した場合と、運用した場合の差</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-5">
                毎月同じ金額を積み立てても、預金のみと運用では将来の金額に差が生じます。あくまでシミュレーションとしてご参照ください。
              </p>
              <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 px-3 py-2">
                <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                  想定条件: 年利 {Number(investRate) || 0}% / 期間 {Number(investYears) || 0}年
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-90 mt-0.5">
                  ※ 想定年利はシミュレーション目的の参考値です。実際の運用成果を保証・示唆するものではありません。
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-90 mt-1">{MM_SIMULATION_PAST_PERFORMANCE_JA}</p>
                <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                  リターン比較: 現金 +0.0% vs 資産運用 +{investReturnPct.toFixed(1)}%
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] text-slate-400 font-bold">現金(普通預金)で保有</p>
                  <p className="text-lg font-black text-slate-800 dark:text-slate-100">¥{cashOnlyValue.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">実質リターン +0.0%</p>
                </div>
                <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-[10px] text-slate-400 font-bold">運用した場合(想定)</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-300">¥{investProjection.projectedTotal.toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-1">想定リターン +{investReturnPct.toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white/80 dark:bg-slate-800/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">時間経過で広がる差</p>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {Number(investYears) || 0}年後 差額 +¥{Math.round(finalGapPoint.gap || 0).toLocaleString()}
                  </p>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cashVsInvestSeries} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartUiDark ? '#33415555' : '#94a3b822'} />
                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 10, fill: chartUiDark ? '#94a3b8' : '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        minTickGap={20}
                        tickFormatter={(v) => `${v}年`}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: chartUiDark ? '#94a3b8' : '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        width={56}
                        tickFormatter={(v) => `${Math.round(Number(v || 0) / 10000)}万`}
                      />
                      <Tooltip
                        labelFormatter={(label) => `${label}年目`}
                        formatter={(value, key) => {
                          const label = key === 'invest' ? '資産運用(想定)' : '現金保有'
                          return [`¥${Math.round(Number(value || 0)).toLocaleString()}`, label]
                        }}
                      />
                      <Line type="monotone" dataKey="cash" name="現金保有" stroke={chartUiDark ? '#e2e8f0' : '#0f172a'} strokeWidth={2.2} dot={false} />
                      <Line type="monotone" dataKey="invest" name="資産運用(想定)" stroke="#10b981" strokeWidth={2.8} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {investType === 'ideco' && (
                <p className="mt-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  iDeCo簡易反映: 所得控除メリット +¥{investProjection.taxBenefit.toLocaleString()}（税率20%仮定）
                </p>
              )}
              <p className="mt-4 text-sm font-black text-emerald-700 dark:text-emerald-300">
                差額見込み: +¥{potentialGap.toLocaleString()}
              </p>
              <button
                type="button"
                onClick={() => navigate('/funds')}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black"
              >
                ファンドの情報を比較・確認する
              </button>
            </div>
            <PiggyBank size={120} className="absolute -right-4 -bottom-4 text-emerald-100 dark:text-emerald-900/30" />
          </div>
        </div>
      </section>

      {/* 広告バナー */}
      <div className="max-w-7xl mx-auto px-4 mb-12">
        <AdBanner variant="horizontal" />
      </div>

      <RiskModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        onNavigate={(to, options) => navigate(to, options || {})}
        loginRedirectTo="/tools"
      />
    </div>
  )
}
