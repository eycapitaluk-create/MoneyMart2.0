import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  ArrowRight, BarChart2, Sparkles, Briefcase,
  Landmark, Home, Wallet, Layers3,
  TrendingUp, Calculator, X,
  PiggyBank, Newspaper,
  Plus, Bell, Shield, CalendarDays, LayoutGrid, RefreshCw, Percent, User,
  LineChart as LucideLineChart,
  Check,
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
import LazyHomeBottomA8Ad from '../components/LazyHomeBottomA8Ad'
import { supabase } from '../lib/supabase'
import { resolveFundDisplayName } from '../lib/fundDisplayUtils'
import { formatTrustFeePercent, parseTrustFeePercent } from '../lib/trustFee'
import HomeHeroBrandFilm from '../components/home/HomeHeroBrandFilm'
import { ETF_LIST_FROM_XLSX } from '../data/etfListFromXlsx'
import {
  AI_THEME_SYMBOL_SET,
  HIGH_DIVIDEND_SYMBOL_SET,
  AI_THEME_ISIN_SET,
  HIGH_DIVIDEND_ISIN_SET,
} from '../data/etfThemeFlags'
import { looksLikeHighDividendFromText } from '../lib/fundSubcategoryHeuristics'
import { findBaseCloseByCalendarOffset, computeOneYearPriceReturnPct, hasOneYearPriceReturn, oneYearPriceHistoryCutoffIso } from '../lib/calendarDateUtils'
import { buildSplitAdjustedCloses, resolveSpotCloseAndSessionChange, skipEodSplitHeuristicForSymbol } from '../lib/fundAdjustedCloses'
import { dedupeStockDailyPricesByTradeDate } from '../lib/stockDailyHistory'
import { trackAnalyticsEvent } from '../lib/analytics'
import { fetchMyReferralCode } from '../lib/referralApi'
import { ReferralShareMenu } from '../components/ReferralShareMenu'
import { getReferralCopyUrl } from '../lib/referralShare'
import MyPageDemoShowcase from '../components/mypage/MyPageDemoShowcase'
import GuestAssetDiagnosisModal from '../components/home/GuestAssetDiagnosisModal'
import HomeMobileSignupCta from '../components/home/HomeMobileSignupCta'
import PortfolioRelatedPanel from '../components/news/PortfolioRelatedPanel'
import { usePortfolioExposureProfile } from '../hooks/usePortfolioExposureProfile'
import { fetchAiNewsData } from '../lib/aiNewsClient'
import CampaignHomeBanner from '../components/campaign/CampaignHomeBanner'
import CampaignCp2026HomePopup from '../components/campaign/CampaignCp2026HomePopup'
import { REFERRAL_INVITE_UI_ENABLED } from '../lib/referralUiFlags'
import { hasPremiumEntitlement, isPaidFromUserProfileRow } from '../lib/membership'
import {
  formatCourtesyGiftUntilJa,
  PREMIUM_COURTESY_GIFT_BADGE,
} from '../lib/premiumCourtesyGrant'
import { signedReturnTextClassStrong } from '../lib/marketDirectionColors'
import { APP_STORE_BADGE_JA_PATH, APP_STORE_IOS_URL } from '../constants/appStore'
/** FundPage の MAX_SYMBOLS_FOR_HISTORY と揃える。小さいと低流動性銘柄が 1Y 未算出のままになり Top5 から欠落する */
const HOME_FUND_HISTORY_FETCH_LIMIT = 999
/** stock_symbols はホームに出る銘柄キーのみ取得（全件 limit スキャンを避ける） */
const HOME_SYMBOL_META_BATCH = 120
/** 日足は銘柄ごとクエリ（limit 挙動が明確）。同時実行数でレイテンシを抑える */
const HOME_HISTORY_FETCH_CONCURRENCY = 48
/** ホーム Top5 各ランキングから除外（歴史が浅い・テーマ先行などで順位が不安定な銘柄） */
const HOME_TOP5_EXCLUDED_SYMBOLS = new Set(['413A.T'])

const HOME_MARKET_FLASH = [
  { symbol: '1306.T', headline: '国内株（TOPIX）', sub: '連動型ETF', country: 'JP' },
  { symbol: '1321.T', headline: '国内株（代表指数）', sub: '連動型ETF', country: 'JP' },
  { symbol: '1545.T', headline: '米国株（NASDAQ-100）', sub: '連動型ETF', country: 'US' },
]

/** ホーム「マイページ見た目の例」資産カードのみ。実ユーザーデータではありません。 */
const formatFlashPrice = (p) => {
  if (p == null || !Number.isFinite(Number(p))) return '—'
  const n = Number(p)
  if (n >= 1000) return n.toLocaleString('ja-JP', { maximumFractionDigits: 0 })
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
}

/** DB の `aum`（円）を億円に換算した値を FundDetail と同様に兆／億で表示 */
const formatHomeAumFromOku = (aumOkuYen) => {
  const v = Number(aumOkuYen)
  if (!Number.isFinite(v) || v <= 0) return null
  if (v >= 10000) return `${(v / 10000).toFixed(2)}兆円`
  return `${v.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}億円`
}

const ETF_META_MAP = new Map(
  ETF_LIST_FROM_XLSX.map((item) => [String(item.symbol || '').trim().toUpperCase(), item]),
)
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

/** 上場コード先頭の数値（例: 1475.T → 1475）。低コストで信託報酬が同率のとき、アプリの並びに合わせて降順タイブレークする */
const homeFundLeadingNumericCode = (symbol) => {
  const m = String(symbol || '').trim().match(/^(\d+)/)
  return m ? Number(m[1]) : null
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

export default function HomePage({
  openRiskModal: openRiskModalProp,
  session,
  authReady = true,
  userProfile = null,
  alertSummary = { insuranceExpiringSoon: 0, pointExpiringSoonCount: 0, budgetOver80Pct: false },
  showUiMessage = null,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const hookSimulatorRef = useRef(null)
  const [isGuestDiagOpen, setIsGuestDiagOpen] = useState(false)
  const [showMobileStickyCta, setShowMobileStickyCta] = useState(false)
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
  const { profile: homeExposureProfile, loading: homeExposureLoading } = usePortfolioExposureProfile(session?.user?.id)
  const [homeRelatedNews, setHomeRelatedNews] = useState([])

  useEffect(() => {
    if (!session?.user?.id) {
      setHomeRelatedNews([])
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const { rows } = await fetchAiNewsData()
        if (!cancelled) setHomeRelatedNews(Array.isArray(rows) ? rows.slice(0, 30) : [])
      } catch {
        if (!cancelled) setHomeRelatedNews([])
      }
    })()
    return () => { cancelled = true }
  }, [session?.user?.id])

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

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '')
      if (params.get('verified') !== '1') return
      showUiMessage?.('メール確認が完了しました。', 'info')
      params.delete('verified')
      const search = params.toString()
      navigate({ pathname: '/', search: search ? `?${search}` : '' }, { replace: true })
    } catch {
      // ignore
    }
  }, [location.search, navigate, showUiMessage])

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

  /** 課金／無料お試し中は LP 型ヒーロー・デモを抑え、ダッシュボード寄りのホームにする */
  const prefersPremiumHomeLayout = useMemo(() => {
    if (!session?.user || !userProfile) return false
    if (isPaidFromUserProfileRow(userProfile)) return true
    return hasPremiumEntitlement({
      planTier:
        userProfile.plan_tier
        || userProfile.membership_tier
        || userProfile.subscription_tier
        || userProfile.plan,
      premiumTrialEndsAt: userProfile.premium_trial_ends_at,
    })
  }, [session?.user, userProfile])

  const trackAndNavigate = (to, meta = {}) => {
    trackAnalyticsEvent('home_navigation_click', {
      destination: to,
      ...meta,
    })
    navigate(to)
  }

  const diagnosisSignupPath = '/mypage?tab=wealth&onboard=diagnosis'

  const openGuestDiagnosis = (source = 'home') => {
    if (session?.user) {
      trackAndNavigate('/mypage?tab=wealth', { source: `${source}_logged_in` })
      return
    }
    trackAnalyticsEvent('guest_diag_open_request', { source })
    setIsGuestDiagOpen(true)
  }

  const goDiagnosisSignup = () => {
    setIsGuestDiagOpen(false)
    trackAnalyticsEvent('home_navigation_click', {
      destination: '/signup',
      source: 'guest_diag_signup',
    })
    navigate('/signup', { state: { from: diagnosisSignupPath, intent: 'diagnosis' } })
  }

  useEffect(() => {
    if (session?.user || prefersPremiumHomeLayout) {
      setShowMobileStickyCta(false)
      return undefined
    }
    const onScroll = () => {
      setShowMobileStickyCta(window.scrollY > 300)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [session?.user, prefersPremiumHomeLayout])

  const referralInviteUrl = useMemo(() => {
    if (!referralCode || typeof window === 'undefined') return ''
    return `${window.location.origin}/?ref=${referralCode}`
  }, [referralCode])

  const copyReferralLink = async () => {
    if (!referralInviteUrl) return
    try {
      await navigator.clipboard.writeText(getReferralCopyUrl(referralInviteUrl))
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

        const latestChunks = []
        for (let i = 0; i < HOME_ETF_SYMBOLS.length; i += 80) {
          latestChunks.push(HOME_ETF_SYMBOLS.slice(i, i + 80))
        }
        const latestResults = await Promise.all(
          latestChunks.map((batch) =>
            supabase.from('v_stock_latest').select('symbol,open,close,volume').in('symbol', batch)),
        )
        const latestRows = []
        for (const res of latestResults) {
          if (res.error) throw res.error
          latestRows.push(...(res.data || []))
        }

        const latestMap = new Map(
          (latestRows || [])
            .map((row) => {
              const sym = String(row?.symbol || '').trim().toUpperCase()
              if (!sym || !ETF_META_MAP.has(sym)) return null
              return [sym, { ...row, symbol: sym }]
            })
            .filter(Boolean),
        )

        const symbolKeyList = [...latestMap.keys()]
        const symbolChunks = []
        for (let i = 0; i < symbolKeyList.length; i += HOME_SYMBOL_META_BATCH) {
          symbolChunks.push(symbolKeyList.slice(i, i + HOME_SYMBOL_META_BATCH))
        }
        const symbolResults = await Promise.all(
          symbolChunks.map((chunk) =>
            supabase.from('stock_symbols').select('symbol,name,trust_fee,aum').in('symbol', chunk)),
        )
        const symbolRowsAcc = []
        for (const res of symbolResults) {
          if (res.error) throw res.error
          symbolRowsAcc.push(...(res.data || []))
        }
        const symbolMap = new Map(
          symbolRowsAcc.map((row) => [String(row.symbol || '').trim().toUpperCase(), row]),
        )

        const symbolsForHistory = [...latestMap.values()]
          .sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0))
          .slice(0, HOME_FUND_HISTORY_FETCH_LIMIT)
          .map((row) => row.symbol)

        const cutoffStr = oneYearPriceHistoryCutoffIso()
        const historyBySymbol = new Map()

        const fetchHistoryBySymbol = async (symbol) => {
          const symKey = String(symbol || '').trim().toUpperCase()
          const { data, error } = await supabase
            .from('stock_daily_prices')
            .select('symbol,trade_date,close,volume,source,fetched_at')
            .eq('symbol', symKey)
            .gte('trade_date', cutoffStr)
            .order('trade_date', { ascending: true })
            .limit(800)
          if (error) throw error
          return [symKey, dedupeStockDailyPricesByTradeDate(data || [], { mode: 'continuity' })]
        }

        const hc = HOME_HISTORY_FETCH_CONCURRENCY
        for (let i = 0; i < symbolsForHistory.length; i += hc) {
          if (cancelled) return
          const batch = symbolsForHistory.slice(i, i + hc)
          const pairs = await Promise.all(batch.map((sym) => fetchHistoryBySymbol(sym)))
          pairs.forEach(([symKey, rows]) => {
            historyBySymbol.set(symKey, rows)
          })
        }
        if (cancelled) return

        const rankingRows = [...latestMap.keys()].map((symbol) => {
          const symKey = String(symbol || '').trim().toUpperCase()
          const latest = latestMap.get(symKey) || {}
          const meta = symbolMap.get(symKey) || {}
          const xlsxMeta = ETF_META_MAP.get(symKey)
          const history = historyBySymbol.get(symKey) || []
          const adjustedClosesRaw = buildSplitAdjustedCloses(history, {
            skipSplitHeuristic: skipEodSplitHeuristicForSymbol(symKey),
          })
          const closes = adjustedClosesRaw.filter((value) => Number.isFinite(value) && value > 0)
          const { close } = resolveSpotCloseAndSessionChange(history, adjustedClosesRaw, latest)
          const volumes = history.map((row) => Number(row.volume)).filter((value) => Number.isFinite(value) && value >= 0)
          const historyCount = closes.length
          const oneMonthBaseClose = findBaseCloseByCalendarOffset(history, { months: 1 }, adjustedClosesRaw)
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
          const hasReliableOneMonthHistory = historyCount >= 2 && historySpanDays >= 14
          const ret1y = computeOneYearPriceReturnPct(history, adjustedClosesRaw, close)
          const ret1m = hasReliableOneMonthHistory && oneMonthBaseClose != null && oneMonthBaseClose > 0 && close > 0
            ? ((close - oneMonthBaseClose) / oneMonthBaseClose) * 100
            : null
          const avgVolume = volumes.length > 0
            ? volumes.slice(-30).reduce((sum, value) => sum + value, 0) / Math.min(30, volumes.length)
            : Math.max(0, Number(latest.volume || 0))
          const trustFeeValue = parseTrustFeePercent(meta.trust_fee) ?? parseTrustFeePercent(xlsxMeta?.trustFee)
          const displayName = resolveFundDisplayName(symKey, meta, xlsxMeta, null)
          const dbAumYen = Number(meta?.aum)
          const aumOkuYen = Number.isFinite(dbAumYen) && dbAumYen > 0 ? dbAumYen / 1e8 : null

          const isinCode = String(xlsxMeta?.isin || '').trim().toUpperCase()
          return {
            id: symKey,
            name: displayName,
            category: detectCategory(displayName),
            isAiTheme: AI_THEME_SYMBOL_SET.has(symKey) || AI_THEME_ISIN_SET.has(isinCode) || isAiThemeFundName(displayName),
            isHighDividend: HIGH_DIVIDEND_SYMBOL_SET.has(symKey) || HIGH_DIVIDEND_ISIN_SET.has(isinCode) || isHighDividendFundName(displayName),
            trustFee: Number.isFinite(trustFeeValue) ? trustFeeValue : null,
            ret1y,
            ret1m,
            avgVolume,
            aumOkuYen,
          }
        })

        if (!cancelled) {
          setFundRanking(rankingRows.filter((row) => !HOME_TOP5_EXCLUDED_SYMBOLS.has(String(row?.id || '').trim().toUpperCase())))
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

  const cashVsInvestSeries = useMemo(() => {
    const years = Math.max(1, Number(investYears) || 1)
    const monthlyYen = Math.max(0, Number(investMonthly) || 0) * 10000
    const annualRatePct = Math.max(0, Number(investRate) || 0)
    const monthlyRate = annualRatePct / 100 / 12
    const assumedTaxRate = 0.2
    const annualContribution = monthlyYen * 12
    const rows = [{ year: 0, cash: 0, invest: 0, gap: 0 }]
    for (let y = 1; y <= years; y += 1) {
      const months = y * 12
      const cash = Math.round(monthlyYen * months)
      let invest = monthlyRate > 0
        ? monthlyYen * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
        : cash
      invest = Math.floor(invest)
      if (investType === 'ideco') {
        invest += Math.floor(annualContribution * assumedTaxRate * y)
      }
      const gap = Math.max(0, invest - cash)
      rows.push({ year: y, cash, invest, gap })
    }
    return rows
  }, [investYears, investMonthly, investRate, investType])

  const cashOnlyValue = investProjection.principal
  const investDisplayedTotal = investProjection.projectedTotal
  const displayGap = Math.max(0, investDisplayedTotal - cashOnlyValue)
  const investReturnPct = cashOnlyValue > 0 ? (displayGap / cashOnlyValue) * 100 : 0
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

  /** Top5 の共通プール：1Y または 1M のどちらかでリターンを算出できる銘柄 */
  const fundRankingOnFundPage = useMemo(
    () => fundRanking.filter((f) => (
      (f?.ret1y != null && Number.isFinite(Number(f.ret1y)))
      || (f?.ret1m != null && Number.isFinite(Number(f.ret1m)))
    )),
    [fundRanking],
  )

  /** 「注目度」に見えるが実質出来高×日上昇だったため、純資産（aum）順とし「出来高 Top5」と差別化 */
  const largestAumTop5 = useMemo(() => {
    const withAum = fundRanking.filter((f) => Number.isFinite(Number(f.aumOkuYen)) && Number(f.aumOkuYen) > 0)
    const pool = withAum.length >= 3 ? withAum : fundRanking
    return [...pool]
      .sort((a, b) => {
        const aa = Number(a.aumOkuYen)
        const bb = Number(b.aumOkuYen)
        const aOk = Number.isFinite(aa) && aa > 0
        const bOk = Number.isFinite(bb) && bb > 0
        if (aOk && bOk && bb !== aa) return bb - aa
        return Number(b.avgVolume || 0) - Number(a.avgVolume || 0)
      })
      .slice(0, 5)
  }, [fundRanking])
  const bestPerformingTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .sort((a, b) => {
        const am = Number(a.ret1m)
        const bm = Number(b.ret1m)
        const aM = Number.isFinite(am)
        const bM = Number.isFinite(bm)
        if (aM && bM && bm !== am) return bm - am
        if (aM !== bM) return (bM ? 1 : 0) - (aM ? 1 : 0)
        const aRet = hasOneYearPriceReturn(a.ret1y) ? Number(a.ret1y) : -999
        const bRet = hasOneYearPriceReturn(b.ret1y) ? Number(b.ret1y) : -999
        return bRet - aRet
      })
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const lowFeeTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .filter((fund) => parseTrustFeePercent(fund.trustFee) != null)
      .sort((a, b) => {
        const df = Number(a.trustFee) - Number(b.trustFee)
        if (df !== 0) return df
        const ca = homeFundLeadingNumericCode(a.id)
        const cb = homeFundLeadingNumericCode(b.id)
        if (ca != null && cb != null && cb !== ca) return cb - ca
        if (ca != null && cb == null) return -1
        if (ca == null && cb != null) return 1
        return String(a.id || '').localeCompare(String(b.id || ''), 'ja')
      })
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const volumeTop5 = useMemo(() => (
    [...fundRanking]
      .filter((fund) => Number(fund.avgVolume || 0) > 0)
      .sort((a, b) => Number(b.avgVolume || 0) - Number(a.avgVolume || 0))
      .slice(0, 5)
  ), [fundRanking])
  const aiThemeTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .filter((fund) => fund.isAiTheme)
      .sort((a, b) => {
        const am = Number(a.ret1m)
        const bm = Number(b.ret1m)
        const aM = Number.isFinite(am)
        const bM = Number.isFinite(bm)
        if (aM && bM && bm !== am) return bm - am
        if (aM !== bM) return (bM ? 1 : 0) - (aM ? 1 : 0)
        const aRet = hasOneYearPriceReturn(a.ret1y) ? Number(a.ret1y) : -999
        const bRet = hasOneYearPriceReturn(b.ret1y) ? Number(b.ret1y) : -999
        if (bRet !== aRet) return bRet - aRet
        return Number(b.avgVolume || 0) - Number(a.avgVolume || 0)
      })
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const highDividendTop5 = useMemo(() => (
    [...fundRankingOnFundPage]
      .filter((fund) => fund.isHighDividend)
      .sort((a, b) => {
        const am = Number(a.ret1m)
        const bm = Number(b.ret1m)
        const aM = Number.isFinite(am)
        const bM = Number.isFinite(bm)
        if (aM && bM && bm !== am) return bm - am
        if (aM !== bM) return (bM ? 1 : 0) - (aM ? 1 : 0)
        const aRet = hasOneYearPriceReturn(a.ret1y) ? Number(a.ret1y) : -999
        const bRet = hasOneYearPriceReturn(b.ret1y) ? Number(b.ret1y) : -999
        if (bRet !== aRet) return bRet - aRet
        return Number(b.avgVolume || 0) - Number(a.avgVolume || 0)
      })
      .slice(0, 5)
  ), [fundRankingOnFundPage])
  const top5SectionPages = useMemo(() => {
    const sections = [
      {
        id: 'interest',
        title: '規模（純資産）Top 5',
        tone: 'slate',
        accent: 'hover:border-blue-300',
        source: 'home_top_interest',
        list: largestAumTop5,
        empty: 'データがありません',
        metric: (fund) => {
          const label = formatHomeAumFromOku(fund.aumOkuYen)
          if (label) return `純資産 ${label}`
          return `平均出来高 ${Math.round(Number(fund.avgVolume || 0) / 1000).toLocaleString('ja-JP')}K（純資産未取得）`
        },
        metricClass: 'text-slate-500 dark:text-slate-400',
      },
      {
        id: 'performance',
        title: 'モメンタム Top 5（直近1か月）',
        tone: 'emerald',
        accent: 'hover:border-emerald-300',
        source: 'home_top_performance',
        list: bestPerformingTop5,
        empty: 'データがありません',
        metric: (fund) => {
          const m = Number(fund.ret1m)
          if (Number.isFinite(m)) return `1M ${m >= 0 ? '+' : ''}${m.toFixed(1)}%`
          if (!hasOneYearPriceReturn(fund.ret1y)) return '--'
          const y = Number(fund.ret1y)
          return `1Y ${y > 0 ? '+' : ''}${y.toFixed(1)}%`
        },
        metricClass: (fund) => {
          const r = Number.isFinite(Number(fund.ret1m)) ? Number(fund.ret1m) : Number(fund.ret1y)
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
        metric: (fund) => `信託報酬 ${formatTrustFeePercent(fund.trustFee)}`,
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
        metric: (fund) => `平均出来高 ${Math.round(Number(fund.avgVolume || 0) / 1000).toLocaleString('ja-JP')}K（株・約30日）`,
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
        metric: (fund) => {
          const m = Number(fund.ret1m)
          if (Number.isFinite(m)) return `1M ${m >= 0 ? '+' : ''}${m.toFixed(1)}%`
          if (hasOneYearPriceReturn(fund.ret1y)) return `1Y ${Number(fund.ret1y) > 0 ? '+' : ''}${Number(fund.ret1y).toFixed(1)}%`
          return '--'
        },
        metricClass: (fund) => {
          const r = Number.isFinite(Number(fund.ret1m)) ? Number(fund.ret1m) : Number(fund.ret1y)
          return Number.isFinite(r)
            ? signedReturnTextClassStrong(r)
            : 'text-orange-600 dark:text-orange-300'
        },
      },
      {
        id: 'high-dividend',
        title: '高配当 Top 5',
        tone: 'emerald',
        accent: 'hover:border-emerald-300',
        source: 'home_top_high_dividend',
        list: highDividendTop5,
        empty: '高配当データがありません',
        metric: (fund) => {
          const m = Number(fund.ret1m)
          if (Number.isFinite(m)) return `1M ${m >= 0 ? '+' : ''}${m.toFixed(1)}%`
          if (hasOneYearPriceReturn(fund.ret1y)) return `1Y ${Number(fund.ret1y) > 0 ? '+' : ''}${Number(fund.ret1y).toFixed(1)}%`
          return '--'
        },
        metricClass: (fund) => {
          const r = Number.isFinite(Number(fund.ret1m)) ? Number(fund.ret1m) : Number(fund.ret1y)
          if (!Number.isFinite(r)) return 'text-slate-500 dark:text-slate-400'
          return signedReturnTextClassStrong(r)
        },
      },
    ]
    const pages = []
    for (let i = 0; i < sections.length; i += 2) pages.push(sections.slice(i, i + 2))
    return pages
  }, [aiThemeTop5, bestPerformingTop5, highDividendTop5, largestAumTop5, lowFeeTop5, volumeTop5])

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
    if (typeof openRiskModalProp === 'function') {
      openRiskModalProp()
      return
    }
    openGuestDiagnosis('home_step_diagnose')
  }

  const moneySupportFeatures = [
    {
      id: 'feature-1',
      icon: Wallet,
      accent: 'from-rose-100 to-rose-50 dark:from-rose-900/40 dark:to-rose-900/10 text-rose-600 dark:text-rose-300',
      title: '登録すればすぐ、無料で使いはじめられます',
      desc: '登録後すぐ、家計・資産の見える化がスタート。毎日の確認もワンタップで完結します。',
      cta: 'まずは家計管理を始める',
      link: '/mypage?tab=wealth',
    },
    {
      id: 'feature-2',
      icon: Layers3,
      accent: 'from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/10 text-amber-700 dark:text-amber-300',
      title: '資産全体を、ひとつの画面で把握できます',
      desc: '投資・家計・ローンをひとつの画面に集約。散らばりがちな情報を、すっきり整理できます。',
      cta: '資産運用タブを見る',
      link: '/mypage?tab=wealth',
    },
    {
      id: 'feature-3',
      icon: Sparkles,
      accent: 'from-sky-100 to-sky-50 dark:from-sky-900/40 dark:to-sky-900/10 text-sky-600 dark:text-sky-300',
      title: '1分で、今月の状況を確認できます',
      desc: '推移チャートとインサイトで、今月の資産変化をすばやく把握。チェックポイントも一目でわかります。',
      cta: '分析レポートを確認',
      link: '/mypage?tab=wealth',
    },
  ]

  return (
    <div className={`animate-fadeIn font-sans bg-[#F8FAFC] dark:bg-slate-950 ${!session?.user && showMobileStickyCta ? 'pb-32' : 'pb-24'} md:pb-24`}>
      <style>{`
        @keyframes mmPhoneFloat {
          0% { transform: translateY(0px) rotate(9deg); }
          50% { transform: translateY(-8px) rotate(9deg); }
          100% { transform: translateY(0px) rotate(9deg); }
        }
        @keyframes mmPhoneFloatLg {
          0% { transform: translate(12px, 56px) rotate(8deg); }
          50% { transform: translate(12px, 48px) rotate(8deg); }
          100% { transform: translate(12px, 56px) rotate(8deg); }
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

        <div className="max-w-7xl mx-auto relative z-10">
          <CampaignHomeBanner userEmail={session?.user?.email} />
          {prefersPremiumHomeLayout ? (
            <div className="px-3 sm:px-4 md:px-5 lg:px-8 pt-1 pb-4 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div className="min-w-0 flex-1 max-w-3xl">
                  {userProfile?.courtesyPremiumGiftActive ? (
                    <div className="rounded-2xl border-2 border-amber-300/90 dark:border-amber-600 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/40 px-4 py-3 shadow-md shadow-amber-500/10">
                      <p className="text-sm sm:text-base font-black text-amber-900 dark:text-amber-100">
                        {PREMIUM_COURTESY_GIFT_BADGE}
                      </p>
                      <p className="mt-1 text-xs sm:text-sm text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
                        ご利用ありがとうございます。
                        {formatCourtesyGiftUntilJa(userProfile?.premiumUntil) ? (
                          <>
                            {' '}
                            <span className="font-bold">
                              {formatCourtesyGiftUntilJa(userProfile?.premiumUntil)}
                            </span>
                            まで Premium 機能をお使いいただけます。
                          </>
                        ) : (
                          ' Premium 機能をお使いいただけます。'
                        )}
                      </p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-white font-black text-xs shadow-md">
                      プレミアム会員
                    </span>
                  )}
                  <h1 className="mt-4 font-black tracking-tight text-slate-900 dark:text-white text-[1.65rem] sm:text-3xl md:text-[2.05rem] leading-snug">
                    {greetingJa}、{appHomeDisplayName}
                  </h1>
                  <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                    いつもご利用ありがとうございます。マーケットやランキングはこのまま下へ。資産・保有の入力と詳細はマイページで確認できます。
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => trackAndNavigate('/mypage?tab=wealth', { source: 'home_premium_hero_mypage' })}
                      className="px-6 py-3 bg-orange-500 text-white hover:bg-orange-600 rounded-full font-black text-sm md:text-base shadow-[0_12px_26px_rgba(249,115,22,0.35)] inline-flex items-center gap-1.5 min-h-[46px]"
                    >
                      マイページへ
                      <ArrowRight size={17} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => trackAndNavigate('/market', { source: 'home_premium_hero_market' })}
                      className="px-5 py-3 rounded-full font-black text-sm border-2 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-slate-800/80 min-h-[46px]"
                    >
                      マーケット
                    </button>
                    <button
                      type="button"
                      onClick={() => trackAndNavigate('/funds', { source: 'home_premium_hero_funds' })}
                      className="px-5 py-3 rounded-full font-black text-sm border-2 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-slate-800/80 min-h-[46px]"
                    >
                      ファンド一覧
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a
                      href={APP_STORE_IOS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                    >
                      <img
                        src={APP_STORE_BADGE_JA_PATH}
                        alt="App Storeからダウンロード"
                        width={140}
                        height={42}
                        className="h-[38px] w-auto sm:h-11"
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  </div>
                </div>
              </div>
              {REFERRAL_INVITE_UI_ENABLED && session?.user && referralCode ? (
                <div
                  id="home-invite-friends"
                  className="w-full max-w-lg lg:max-w-none mx-auto lg:mx-0 rounded-2xl border-2 border-orange-300 dark:border-orange-700 bg-white/90 dark:bg-slate-900/80 px-4 py-3 shadow-md shadow-orange-500/10"
                >
                  <p className="text-xs font-black text-orange-600 dark:text-orange-400 mb-1">友だち招待</p>
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
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-8 md:gap-10 lg:grid-cols-[1.12fr_1fr] lg:gap-x-10 xl:gap-x-12 lg:gap-y-10 lg:items-start ${
            REFERRAL_INVITE_UI_ENABLED && session?.user && referralCode
              ? "[grid-template-areas:'hero-text'_'hero-film'_'hero-refer'_'hero-phone'] lg:[grid-template-areas:'hero-text_hero-phone'_'hero-refer_hero-refer'_'hero-film_hero-film']"
              : "[grid-template-areas:'hero-text'_'hero-film'_'hero-phone'] lg:[grid-template-areas:'hero-text_hero-phone'_'hero-film_hero-film']"
          }`}
            >
          <div className="[grid-area:hero-text] text-left flex flex-col items-start min-w-0 w-full px-3 sm:px-4 md:px-5 lg:pl-6 lg:pr-2 xl:pl-8">
            <div className="mb-4 md:mb-6">
              <p className="inline-flex items-center rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 text-white font-black text-base md:text-lg shadow-[0_8px_18px_rgba(249,115,22,0.35)]">
                金融の第一歩は、ここから。
              </p>
            </div>

            <h1 className="font-black tracking-tight mb-3 md:mb-4 max-w-xl lg:max-w-2xl min-w-0">
              <div className="w-full min-w-0">
                <span className="inline-block max-w-full whitespace-nowrap text-[clamp(1.02rem,calc(2.2vw_+_0.78rem),2.9rem)] sm:text-[2.2rem] md:text-[2.55rem] lg:text-[2.9rem] leading-normal sm:leading-snug py-0.5">
                  <span className="text-orange-600 dark:text-orange-400">ポートフォリオの</span>
                  <span className="text-orange-500 dark:text-orange-300">偏りを、</span>
                  <span className="text-red-600 dark:text-red-400">見える化する。</span>
                </span>
              </div>
              <span className="block mt-1 sm:mt-1.5 text-slate-900 dark:text-slate-100 text-[1.62rem] min-[400px]:text-[1.75rem] sm:text-[2.2rem] md:text-[2.55rem] lg:text-[2.9rem] leading-[1.22] sm:leading-[1.18] break-keep">
                <span className="block">まずはETFを2本、並べて比べる</span>
                <span className="block">
                  新NISA・配当を<span className="text-red-500 dark:text-red-400">ひとつの画面で</span>。
                </span>
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
                <span>同じ指数のETFを<span className="text-orange-600 dark:text-orange-400">2本比較</span>（例: TOPIXの1306と1475）</span>
              </li>
              <li className="flex items-start gap-3 text-base md:text-lg text-slate-800 dark:text-slate-200 font-bold leading-snug">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300/80 dark:ring-orange-700/60">
                  <Check size={14} strokeWidth={3} className="text-orange-600 dark:text-orange-400" />
                </span>
                <span>口座・銀行<span className="text-orange-600 dark:text-orange-400">連携不要</span>・無料マイページ</span>
              </li>
              <li className="flex items-start gap-3 text-base md:text-lg text-slate-800 dark:text-slate-200 font-bold leading-snug">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300/80 dark:ring-orange-700/60">
                  <Check size={14} strokeWidth={3} className="text-orange-600 dark:text-orange-400" />
                </span>
                <span><span className="text-orange-600 dark:text-orange-400">3つの質問</span>で資産の中心・リスク・期間を整理</span>
              </li>
              <li className="flex items-start gap-3 text-base md:text-lg text-slate-800 dark:text-slate-200 font-bold leading-snug">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300/80 dark:ring-orange-700/60">
                  <Check size={14} strokeWidth={3} className="text-orange-600 dark:text-orange-400" />
                </span>
                <span>新NISA枠と<span className="text-orange-600 dark:text-orange-400">配当の記録</span>を同じ流れで整理</span>
              </li>
              <li className="flex items-start gap-3 text-base md:text-lg text-slate-800 dark:text-slate-200 font-bold leading-snug">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300/80 dark:ring-orange-700/60">
                  <Check size={14} strokeWidth={3} className="text-orange-600 dark:text-orange-400" />
                </span>
                <span><span className="text-orange-600 dark:text-orange-400">提携なし</span>の中立比較・市場分析</span>
              </li>
            </ul>
            <p className="mb-5 max-w-lg text-xs md:text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              将来の運用成果を保証するものではありません。
              <Link to="/legal/methodology" className="ml-1 font-bold text-orange-600 dark:text-orange-400 underline underline-offset-2">編集・データ方針</Link>
            </p>

            <div className="flex flex-col w-full sm:w-auto justify-start gap-3">
              <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() => (
                    session?.user
                      ? trackAndNavigate('/mypage?tab=wealth', { source: 'home_hero_mypage' })
                      : openGuestDiagnosis('home_hero')
                  )}
                  className="px-7 py-3.5 sm:py-4 bg-orange-500 text-white hover:bg-orange-600 rounded-full font-black text-base md:text-lg transition shadow-[0_12px_26px_rgba(249,115,22,0.35)] inline-flex items-center justify-center gap-1.5 min-h-[48px] shrink-0"
                >
                  {session?.user ? 'マイページを開く' : '30秒で資産診断をはじめる'}
                  <ArrowRight size={18} strokeWidth={2.5} />
                </button>
                <a
                  href={APP_STORE_IOS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                >
                  <img
                    src={APP_STORE_BADGE_JA_PATH}
                    alt="App Storeからダウンロード"
                    width={140}
                    height={42}
                    className="h-[38px] w-auto sm:h-11"
                    loading="eager"
                    decoding="async"
                  />
                </a>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (session?.user) {
                    trackAndNavigate('/mypage?tab=wealth', { source: 'home_hero_today_finance_data' })
                    return
                  }
                  trackAnalyticsEvent('home_navigation_click', {
                    destination: '/signup',
                    source: 'home_hero_signup_secondary',
                  })
                  navigate('/signup', { state: { from: diagnosisSignupPath, intent: 'diagnosis' } })
                }}
                className="text-left text-sm font-bold text-slate-600 dark:text-slate-400 underline-offset-4 hover:underline py-0.5"
              >
                {session?.user ? '資産タブを開く' : '登録だけ先に進む（無料）'}
              </button>
              {!session?.user ? (
                <button
                  type="button"
                  onClick={() => {
                    trackAnalyticsEvent('home_hero_scroll_mypage_demo', { source: 'home_hero' })
                    document.getElementById('home-mypage-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="text-left text-sm font-bold text-slate-500 dark:text-slate-500 underline-offset-4 hover:underline py-0.5"
                >
                  マイページの使い方を見る ↓
                </button>
              ) : null}
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

          <section className="[grid-area:hero-film] min-w-0 w-full px-3 sm:px-4 md:px-5 lg:px-6 lg:col-span-2" aria-label="ブランドフィルム">
            <div className="mx-auto w-full max-w-4xl min-w-0">
              <HomeHeroBrandFilm />
            </div>
          </section>

          <div className="[grid-area:hero-phone] relative flex justify-center lg:justify-end lg:items-start lg:pl-4 lg:pr-2 xl:pl-6 xl:pr-4 pt-2 lg:pt-16 xl:pt-20">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none lg:translate-y-14">
              <div className="w-64 h-60 md:w-72 md:h-64 bg-orange-200/45 dark:bg-orange-900/35 blur-3xl rounded-full" style={{ animation: 'mmPhoneGlowPulse 3.8s ease-in-out infinite' }} />
              <div className="absolute w-80 h-80 md:w-[22rem] md:h-[22rem] rounded-full bg-orange-300/30 dark:bg-orange-800/25 blur-[78px]" style={{ animation: 'mmPhoneGlowPulse 4.6s ease-in-out infinite 120ms' }} />
              <div className="absolute w-[320px] h-[320px] md:w-[370px] md:h-[370px] rounded-full border border-white/45 dark:border-orange-400/20 shadow-[0_0_95px_rgba(255,255,255,0.45),0_0_120px_rgba(251,146,60,0.28)] dark:shadow-[0_0_80px_rgba(251,146,60,0.15),0_0_100px_rgba(15,23,42,0.5)]" style={{ animation: 'mmPhoneGlowPulse 5.2s ease-in-out infinite 240ms' }} />
            </div>
            {/* コンパクト「アプリ」シェル：中身はスクロールで全機能へジャンプ可能 */}
            <div
              className="relative z-[1] w-[min(100%,312px)] sm:w-[min(100%,334px)] h-[min(500px,76vh)] max-h-[min(500px,76vh)] flex flex-col rounded-[1.65rem] overflow-hidden shadow-[0_26px_60px_rgba(0,0,0,0.35),0_0_60px_rgba(251,146,60,0.36)] dark:shadow-[0_26px_60px_rgba(0,0,0,0.65),0_0_48px_rgba(251,146,60,0.22)] border border-white/35 dark:border-slate-600/40 ring-2 ring-orange-200/45 dark:ring-orange-900/50 bg-[#0f0a08] max-lg:[animation:mmPhoneFloat_5.2s_ease-in-out_infinite] lg:[animation:mmPhoneFloatLg_5.2s_ease-in-out_infinite]"
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
                        ファンドを追加すると、資産の推移や配当の記録がひと目でわかります。
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
          )}
        </div>
      </section>

      {session?.user ? (
        <section className="max-w-7xl mx-auto px-4 mt-6">
          <PortfolioRelatedPanel
            exposureProfile={homeExposureProfile}
            loading={homeExposureLoading}
            newsRows={homeRelatedNews}
            compact
          />
          <div className="mt-2 flex justify-end">
            <Link
              to="/mypage?tab=related"
              className="text-xs font-black text-orange-600 dark:text-orange-400 underline underline-offset-2"
            >
              マイページで詳しく見る →
            </Link>
          </div>
        </section>
      ) : null}

      <section className="max-w-7xl mx-auto px-4 mt-6" aria-label="MoneyMartについて">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-5 md:px-8 md:py-6 shadow-sm">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-snug">
            独立した立場から、金融の力をすべての人へ。
          </h2>
          <p className="mt-2 max-w-3xl text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            MoneyMartは、資本提携に左右されない独立系の金融プラットフォームです。英国の投資業界で18年以上の実務経験を持つ創業チームの専門性を生かし、誰もが公平に比較し、自分で判断するための情報とツールを届けます。
          </p>
          <Link
            to="/about#founding-team"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-orange-600 dark:text-orange-400 underline-offset-4 hover:underline"
          >
            MoneyMartについて
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 mt-6">
        <button
          type="button"
          onClick={() => trackAndNavigate('/careers', { source: 'home_careers_banner' })}
          className="group w-full text-left rounded-3xl border-2 border-slate-900 dark:border-orange-400/70 bg-slate-900 dark:bg-slate-900 px-5 py-4 md:px-7 md:py-5 shadow-lg shadow-slate-900/15 hover:border-orange-400 transition flex flex-col md:flex-row md:items-center gap-4"
        >
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-orange-500 px-3 py-1 text-[11px] font-black text-white shrink-0">
            <Briefcase size={13} aria-hidden />
            採用中
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base md:text-lg font-black text-white leading-snug">
              法人営業・事業開発メンバーを募集しています
            </span>
            <span className="mt-1 block text-xs md:text-sm font-medium text-slate-300">
              銀行・証券・IFA向け。日本国内（リモート可）・募集期間 2026年9月27日〜10月27日
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 self-start md:self-center rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-black shrink-0 group-hover:bg-orange-500 group-hover:text-white transition">
            募集要項を見る
            <ArrowRight size={16} aria-hidden />
          </span>
        </button>
      </section>

      {!prefersPremiumHomeLayout ? (
        <MyPageDemoShowcase
          session={session}
          variant="home"
          id="home-mypage-preview"
          className="max-w-7xl mx-auto px-4 mt-8 mb-8"
          onGuestPrimaryClick={() => openGuestDiagnosis('home_mypage_demo')}
        />
      ) : null}

      {/* 2. はじめての使い方 & サービスカテゴリ（プレミアム会員には非表示） */}
      {!prefersPremiumHomeLayout ? (
      <>
      <section className="max-w-7xl mx-auto px-4 mt-6 mb-6">
        <div className="rounded-[1.75rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-orange-500">HOW TO USE MONEYMART</p>
              <h2 className="mt-1.5 text-xl md:text-2xl font-black text-slate-900 dark:text-white">投資が初めての方でも、3ステップで使いはじめられます。</h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                金融が初めての方でも、自分のペースで資産と向き合えます。
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
                desc: 'ファンド・株式・ローンの条件を一覧で比較。情報収集の手間を、大幅に省きます。',
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
                desc: 'AIシミュレーターで、自分に合った数字を確認。「なんとなく」の判断から、根拠のある選択へ。',
                cta: '30秒で診断をはじめる',
                action: handleRiskClick,
                icon: Sparkles,
                accent: 'from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20',
                iconColor: 'text-amber-500 dark:text-amber-400',
              },
              {
                id: 'manage',
                step: '03',
                title: '03 そして、継続して管理する',
                desc: 'マイページで資産・配当・ローンをまとめて管理。全体像を把握することが、資産づくりの第一歩です。',
                cta: 'マイページを開く',
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
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">投資の判断を、もっとシンプルに。</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col">
            <div className="h-28 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border border-orange-200/70 dark:border-orange-800/50 flex items-center justify-center">
              <Landmark size={46} className="text-orange-500 dark:text-orange-400" />
            </div>
            <div className="mt-3 min-h-[64px] text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-wide">
              <span className="block">ETF /</span>
              <span className="block">インデックスファンド</span>
            </div>
            <p className="mt-2 mb-5 min-h-[48px] text-sm text-slate-500 dark:text-slate-400 leading-relaxed">信託報酬・リターン・リスクを一覧で比較。低コストで分散投資を始めたい方をサポートします。</p>
            <button
              type="button"
              onClick={() => trackAndNavigate('/funds', { source: 'home_category_funds' })}
              className="mt-auto w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black py-2.5"
            >
              ETF・インデックスファンドを比較
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col">
            <div className="h-28 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border border-orange-200/70 dark:border-orange-800/50 flex items-center justify-center">
              <TrendingUp size={46} className="text-orange-500 dark:text-orange-400" />
            </div>
            <p className="mt-3 min-h-[64px] text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-wide">個別株式</p>
            <p className="mt-2 mb-5 min-h-[48px] text-sm text-slate-500 dark:text-slate-400 leading-relaxed">国内・国外の主要銘柄を一画面で比較。株価の推移や指標を、まとめてチェックできます。</p>
            <button
              type="button"
              onClick={() => trackAndNavigate('/stocks', { source: 'home_category_stocks' })}
              className="mt-auto w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black py-2.5"
            >
              個別株式を比較
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col">
            <div className="h-28 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border border-orange-200/70 dark:border-orange-800/50 flex items-center justify-center">
              <BarChart2 size={46} className="text-orange-500 dark:text-orange-400" />
            </div>
            <p className="mt-3 min-h-[64px] text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-wide">マーケット概況</p>
            <p className="mt-2 mb-5 min-h-[48px] text-sm text-slate-500 dark:text-slate-400 leading-relaxed">日経・米国など主要指数の最新動向を毎日更新。市場の流れを、いつでも把握できます。</p>
            <button
              type="button"
              onClick={() => trackAndNavigate('/market', { source: 'home_category_market' })}
              className="mt-auto w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black py-2.5"
            >
              マーケット概況を確認
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col">
            <div className="h-28 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border border-orange-200/70 dark:border-orange-800/50 flex items-center justify-center">
              <Newspaper size={46} className="text-orange-500 dark:text-orange-400" />
            </div>
            <p className="mt-3 min-h-[64px] text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-wide">AIニュース</p>
            <p className="mt-2 mb-5 min-h-[48px] text-sm text-slate-500 dark:text-slate-400 leading-relaxed">AIが厳選した市場ニュースを朝・夕の2回お届け。忙しい方でも、相場の流れを見逃しません。</p>
            <button
              type="button"
              onClick={() => trackAndNavigate('/news', { source: 'home_category_news' })}
              className="mt-auto w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black py-2.5"
            >
              AIニュースをチェック
            </button>
          </div>
        </div>
      </section>
      </>
      ) : null}

      {/* 3. ホームデータTop5 */}
      <section ref={hookSimulatorRef} className="max-w-7xl mx-auto px-4 mb-10">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl p-5 md:p-7 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-black text-blue-500">ホーム主要データ</p>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Top 5 インサイト</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">純資産・直近1か月リターン・信託報酬・平均出来高など、切り口ごとに並べ替えています（オフライン時は前回取得データ）。</p>
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
                              <p className="text-[13px] md:text-[14px] font-bold tracking-[-0.01em] text-slate-700 dark:text-slate-200 line-clamp-2 md:line-clamp-1 [overflow-wrap:anywhere]">
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

      {/* A8 728×90（Top 5 インサイト直下・ビューポート付近で読込） */}
      <div className="max-w-7xl mx-auto px-4 mb-8">
        <LazyHomeBottomA8Ad />
      </div>

      {/* MoneyMartの3つの特徴 — プレミアム会員には非表示 */}
      {!prefersPremiumHomeLayout ? (
      <section className="max-w-7xl mx-auto px-4 mb-14">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">MoneyMartの3つの特徴</h2>
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
      ) : null}

      {/* 6. 롤링 광고 섹션 (Phase 1 비노출) */}

      {/* 7. 대출 & 금융 계산기 */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 p-8 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/50 relative overflow-hidden">
            <div className="relative z-10">
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded mb-3 inline-block">住宅ローン</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">金利のわずかな差が、長期では大きな差を生みます</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-4">
                例: 残高 ¥{refinanceExample.principalYen.toLocaleString('ja-JP')} / 返済期間 {refinanceExample.years}年
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] text-slate-400 font-bold">現在金利 {refinanceExample.currentApr}%</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">月 ¥{refinanceExample.monthlyCurrent.toLocaleString('ja-JP')}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  <p className="text-[10px] text-slate-400 font-bold">借り換え後 {refinanceExample.refiApr}%</p>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-300">月 ¥{refinanceExample.monthlyRefi.toLocaleString('ja-JP')}</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-black text-indigo-700 dark:text-indigo-300">
                月々 -¥{refinanceExample.monthlyDiff.toLocaleString('ja-JP')} / 利息差額の試算 ¥{refinanceExample.totalInterestSaving.toLocaleString('ja-JP')}
              </p>
              <div className="mt-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white/80 dark:bg-slate-800/60 p-3">
                <p className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 mb-2">月返済の比較</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-1">
                      <span>現在</span>
                      <span>¥{refinanceExample.monthlyCurrent.toLocaleString('ja-JP')}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-slate-700 dark:bg-slate-400 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-indigo-600 dark:text-indigo-300 mb-1">
                      <span>借り換え後</span>
                      <span>¥{refinanceExample.monthlyRefi.toLocaleString('ja-JP')}</span>
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
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-300 font-bold">月返済の削減率</p>
                    <p className="text-sm font-black text-indigo-700 dark:text-indigo-200">-{refinanceMonthlyReductionPct.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/50 px-2.5 py-2">
                    <p className="text-[10px] text-emerald-500 dark:text-emerald-300 font-bold">年間削減額（目安）</p>
                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-200">¥{Math.round(refinanceExample.monthlyDiff * 12).toLocaleString('ja-JP')}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/mypage?tab=debt')}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black"
              >
                無料登録で、詳細シミュレーションへ
              </button>
              <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">
                ※ 本ツールはシミュレーション目的であり、将来の運用成果を保証するものではありません。
              </p>
            </div>
            <Home size={120} className="absolute -right-4 -bottom-4 text-indigo-100 dark:text-indigo-900/30" />
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 p-8 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/50 relative overflow-hidden">
            <div className="relative z-10">
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded mb-3 inline-block">比較でわかる</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">預金のまま置いた場合と、運用した場合の差</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-5">
                毎月同じ金額を積み立てても、預金と運用では将来の差が広がります。シミュレーションとしてご活用ください。
              </p>
              <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 px-3 py-2">
                <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                  想定条件: 年利 {Number(investRate) || 0}% / 期間 {Number(investYears) || 0}年
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-90 mt-0.5">
                  ※ 想定年利および表示される計算結果はシミュレーション目的の参考値であり、実際の運用成果を保証・示唆するものではありません。
                </p>
                <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                  リターン比較: 預金 +0.0% vs 運用 +{investReturnPct.toFixed(1)}%
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] text-slate-400 font-bold">普通預金のまま保有</p>
                  <p className="text-lg font-black text-slate-800 dark:text-slate-100">¥{cashOnlyValue.toLocaleString('ja-JP')}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">預金 +0.0%</p>
                </div>
                <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-[10px] text-slate-400 font-bold">運用した場合(想定)</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-300">¥{investDisplayedTotal.toLocaleString('ja-JP')}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-1">想定リターン +{investReturnPct.toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white/80 dark:bg-slate-800/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">時間経過で広がる差</p>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {Number(investYears) || 0}年後 差額 +¥{displayGap.toLocaleString('ja-JP')}
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
                          const label = key === 'invest' ? '運用(想定)' : '預金'
                          return [`¥${Math.round(Number(value || 0)).toLocaleString('ja-JP')}`, label]
                        }}
                      />
                      <Line type="monotone" dataKey="cash" name="預金" stroke={chartUiDark ? '#e2e8f0' : '#0f172a'} strokeWidth={2.2} dot={false} />
                      <Line type="monotone" dataKey="invest" name="運用(想定)" stroke="#10b981" strokeWidth={2.8} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {investType === 'ideco' && (
                <p className="mt-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  iDeCo簡易反映: 所得控除メリット +¥{investProjection.taxBenefit.toLocaleString('ja-JP')}（税率20%仮定）
                </p>
              )}
              <p className="mt-4 text-sm font-black text-emerald-700 dark:text-emerald-300">
                差額の試算: +¥{displayGap.toLocaleString('ja-JP')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/funds')}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black"
              >
                ファンドを比較する
              </button>
            </div>
            <PiggyBank size={120} className="absolute -right-4 -bottom-4 text-emerald-100 dark:text-emerald-900/30" />
          </div>
        </div>
      </section>

      <GuestAssetDiagnosisModal
        isOpen={isGuestDiagOpen}
        onClose={() => setIsGuestDiagOpen(false)}
        onSignup={goDiagnosisSignup}
        source="home_guest_diag"
      />
      <CampaignCp2026HomePopup userEmail={session?.user?.email} authReady={authReady} />
      <HomeMobileSignupCta
        visible={showMobileStickyCta}
        isLoggedIn={Boolean(session?.user)}
        onStartDiagnosis={() => openGuestDiagnosis('home_mobile_sticky')}
      />
    </div>
  )
}
