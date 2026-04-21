import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import { trackAnalyticsEvent } from './lib/analytics'
import { captureReferralFromUrl } from './lib/referralStorage'
import { backfillSignupAttributionIfEmpty } from './lib/analytics'
import { claimPendingReferralAttribution, fetchMyReferralCode } from './lib/referralApi'
import Layout from './components/layout/Layout'
import AdminIpGuard from './components/AdminIpGuard'
import { ETF_SYMBOLS_FROM_XLSX } from './data/etfUniverseLite'
import {
  loadDbWatchlists,
  addDbWatchlistItem,
  removeDbWatchlistItem,
  loadMyPageData,
  loadUnreadPortfolioDropAlertCount,
} from './lib/myPageApi'
import { getCurrentMonthBudgetUsage } from './lib/mypageBudgetAlerts'
import { sanitizeInternalRedirectPath } from './lib/navigationGuards'
import { isPaidPlanTier } from './lib/membership'

const ALERT_EXPIRY_DAYS = 30
const AUTH_IDLE_TIMEOUT_MINUTES = Number(import.meta.env.VITE_AUTH_IDLE_TIMEOUT_MINUTES || 30)
const AUTH_IDLE_TIMEOUT_MS = Number.isFinite(AUTH_IDLE_TIMEOUT_MINUTES) && AUTH_IDLE_TIMEOUT_MINUTES > 0
  ? Math.floor(AUTH_IDLE_TIMEOUT_MINUTES * 60 * 1000)
  : 0
const AUTH_IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']

/** 同じ内容なら setAlertSummary をスキップし、Navbar 以下の無駄な再レンダーを防ぐ */
function isSameAlertSummary(a, b) {
  if (!a || !b) return false
  return (
    Number(a.insuranceExpiringSoon) === Number(b.insuranceExpiringSoon)
    && Number(a.pointExpiringSoonCount) === Number(b.pointExpiringSoonCount)
    && Boolean(a.budgetOver80Pct) === Boolean(b.budgetOver80Pct)
    && Number(a.portfolioDropAlertCount) === Number(b.portfolioDropAlertCount)
  )
}

function buildMyPageAlertSummary(data) {
  const insurances = data?.insurances || []
  const pointAccounts = data?.pointAccounts || []
  const insuranceExpiringSoon = insurances.filter((ins) => {
    const d = ins?.maturity_date
    if (!d) return false
    const t = new Date(d).getTime()
    const diff = (t - Date.now()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= ALERT_EXPIRY_DAYS
  }).length
  const pointExpiringSoonCount = pointAccounts.filter((p) => {
    const raw = p?.expiry
    if (!raw) return false
    const iso = typeof raw === 'string' ? raw.slice(0, 10) : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
    const t = new Date(iso).getTime()
    const diff = (t - Date.now()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= ALERT_EXPIRY_DAYS
  }).length
  const bud = getCurrentMonthBudgetUsage(data?.expenses, data?.profile?.budget_target_yen)
  return {
    insuranceExpiringSoon,
    pointExpiringSoonCount,
    budgetOver80Pct: Boolean(bud.hasTarget && bud.over80),
    portfolioDropAlertCount: 0,
  }
}

const HomePage = lazy(() => import('./pages/HomePage'))
const NewsPage = lazy(() => import('./pages/NewsPage'))
const MarketPage = lazy(() => import('./pages/MarketPage'))
const FundPage = lazy(() => import('./pages/FundPage'))
const FundDetailPage = lazy(() => import('./pages/FundDetailPage'))
const FundComparePage = lazy(() => import('./pages/FundComparePage'))
const StockPage = lazy(() => import('./pages/StockPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const LoungePage = lazy(() => import('./pages/LoungePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage'))
const MyPage = lazy(() => import('./pages/MyPage'))
const BriefArchivePage = lazy(() => import('./pages/BriefArchivePage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ToolsHubPage = lazy(() => import('./pages/ToolsHubPage'))
const ToolLandingPage = lazy(() => import('./pages/ToolLandingPage'))
const InsightPage = lazy(() => import('./pages/InsightPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const PremiumPage = lazy(() => import('./pages/PremiumPage'))

const RouteSkeleton = ({ title = 'ページを読み込み中...' }) => (
  <div className="min-h-[50vh] max-w-5xl mx-auto px-4 py-8">
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
      <div className="h-9 w-64 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{title}</p>
    </div>
  </div>
)

const FUND_ID_ALLOWLIST = new Set(ETF_SYMBOLS_FROM_XLSX)
const ADMIN_EMAIL_ALLOWLIST = new Set([
  'justin.nam@moneymart.co.jp',
  'kelly.nam@moneymart.co.jp',
])
const PREMIUM_EMAIL_ALLOWLIST = new Set([
  'justin.nam@moneymart.co.jp',
  'kelly.nam@moneymart.co.jp',
])
const FREE_FUND_WATCHLIST_LIMIT = 3

/** /funds/compare?ids=… は /etf-compare へ統合するが、クエリ（ids/weights）を落とさない */
function FundsCompareRedirect() {
  const { search, hash } = useLocation()
  const to = `/etf-compare${search || ''}${hash || ''}`
  return <Navigate to={to} replace />
}

const normalizeFundWatchlist = (items = []) => {
  const seen = new Set()
  const normalized = []
  ;(Array.isArray(items) ? items : []).forEach((item) => {
    const id = String(item?.id || '').trim()
    if (!id) return
    if (FUND_ID_ALLOWLIST.size > 0 && !FUND_ID_ALLOWLIST.has(id)) return
    if (seen.has(id)) return
    seen.add(id)
    normalized.push({
      id,
      name: item?.name || id,
      change: Number(item?.change || 0),
      trend: Number(item?.change || 0) >= 0 ? 'up' : 'down',
      watchGroup: String(item?.watchGroup || item?.watch_group || '').trim(),
    })
  })
  return normalized
}

const App = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [currentUserProfile, setCurrentUserProfile] = useState(undefined)
  const [role, setRole] = useState('viewer')
  const [roleReady, setRoleReady] = useState(false)
  const safeRouteReturnPath = sanitizeInternalRedirectPath(location.state?.from, '/')
  const userEmailLower = String(session?.user?.email || '').trim().toLowerCase()
  const isPaidMember = Boolean(
    PREMIUM_EMAIL_ALLOWLIST.has(userEmailLower)
    || isPaidPlanTier(String(currentUserProfile?.planTier || '').toLowerCase())
  )

  const applyFundWatchlistPlanLimit = (items = []) => {
    const normalized = normalizeFundWatchlist(items)
    return isPaidMember ? normalized : normalized.slice(0, FREE_FUND_WATCHLIST_LIMIT)
  }

  const [fundWatchlist, setFundWatchlist] = useState(() => {
    try {
      const raw = localStorage.getItem('mm_fund_watchlist')
      const parsed = raw ? JSON.parse(raw) : []
      return normalizeFundWatchlist(parsed)
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('mm_fund_watchlist', JSON.stringify(fundWatchlist))
  }, [fundWatchlist])

  // パスワードリセットリンク: ハッシュ付きで / や /login に来た場合、/reset-password へ誘導（新パスワード入力必須）
  useEffect(() => {
    const hash = window.location.hash || ''
    const hasRecovery = hash.includes('type=recovery') || (hash.includes('access_token') && hash.includes('recovery'))
    if (hasRecovery && !location.pathname.startsWith('/reset-password')) {
      navigate(`/reset-password${hash}`, { replace: true })
    }
  }, [location.pathname, navigate])

  const [productInterests, setProductInterests] = useState(() => {
    try {
      const raw = localStorage.getItem('mm_product_interests')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  const [alertSummary, setAlertSummary] = useState({
    insuranceExpiringSoon: 0,
    pointExpiringSoonCount: 0,
    budgetOver80Pct: false,
    portfolioDropAlertCount: 0,
  })
  const [uiMessage, setUiMessage] = useState(null)
  const freeUserLockNudgeShownRef = useRef(false)

  useEffect(() => {
    localStorage.setItem('mm_product_interests', JSON.stringify(productInterests))
  }, [productInterests])

  useEffect(() => {
    if (!uiMessage?.text) return undefined
    const timer = window.setTimeout(() => setUiMessage(null), 2600)
    return () => window.clearTimeout(timer)
  }, [uiMessage])

  const showUiMessage = (text, tone = 'info') => {
    const safeText = String(text || '').trim()
    if (!safeText) return
    setUiMessage({ text: safeText, tone })
  }

  useEffect(() => {
    if (!authReady || !session?.user?.id || isPaidMember || freeUserLockNudgeShownRef.current) return
    freeUserLockNudgeShownRef.current = true
    showUiMessage('税引後配当の表示と追加買いの詳細計算はプレミアム限定です。', 'premium')
  }, [authReady, isPaidMember, session?.user?.id])

  useEffect(() => {
    captureReferralFromUrl(location.search || '')
  }, [location.search])

  useEffect(() => {
    if (!session?.user?.id) return
    claimPendingReferralAttribution().catch(() => {})
    // 기존 가입자는 auth 트리거 이전이라 referral_codes가 없음 → RPC로 1회 발급
    fetchMyReferralCode().catch(() => {})
    backfillSignupAttributionIfEmpty(supabase, session.user.id).catch(() => {})
  }, [session?.user?.id])

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!session?.user?.id) {
        if (alive) {
          setAlertSummary({
            insuranceExpiringSoon: 0,
            pointExpiringSoonCount: 0,
            budgetOver80Pct: false,
            portfolioDropAlertCount: 0,
          })
        }
        return
      }
      try {
        const [data, portfolioDropCountRes] = await Promise.all([
          loadMyPageData(session.user.id),
          loadUnreadPortfolioDropAlertCount(session.user.id).catch(() => ({ count: 0 })),
        ])
        if (!alive) return
        const next = {
          ...buildMyPageAlertSummary(data),
          portfolioDropAlertCount: Math.max(0, Number(portfolioDropCountRes?.count || 0)),
        }
        setAlertSummary((prev) => (isSameAlertSummary(prev, next) ? prev : next))
      } catch {
        if (alive) {
          setAlertSummary({
            insuranceExpiringSoon: 0,
            pointExpiringSoonCount: 0,
            budgetOver80Pct: false,
            portfolioDropAlertCount: 0,
          })
        }
      }
    }
    load()
    return () => { alive = false }
  }, [session?.user?.id])

  /** 家計の支出・予算保存後のみ MyPage から発火。保有資産・タブ遷移とは無関係。 */
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    const onBudgetRefresh = () => {
      Promise.all([
        loadMyPageData(userId),
        loadUnreadPortfolioDropAlertCount(userId).catch(() => ({ count: 0 })),
      ])
        .then(([data, portfolioDropCountRes]) => {
          const next = {
            ...buildMyPageAlertSummary(data),
            portfolioDropAlertCount: Math.max(0, Number(portfolioDropCountRes?.count || 0)),
          }
          setAlertSummary((prev) => (isSameAlertSummary(prev, next) ? prev : next))
        })
        .catch(() => {})
    }
    window.addEventListener('mm-budget-alert-refresh', onBudgetRefresh)
    return () => window.removeEventListener('mm-budget-alert-refresh', onBudgetRefresh)
  }, [session?.user?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    const onPortfolioAlertRefresh = () => {
      loadUnreadPortfolioDropAlertCount(userId)
        .then((res) => {
          const nextCount = Math.max(0, Number(res?.count || 0))
          setAlertSummary((prev) => {
            if (Number(prev.portfolioDropAlertCount) === nextCount) return prev
            return { ...prev, portfolioDropAlertCount: nextCount }
          })
        })
        .catch(() => {})
    }
    window.addEventListener('mm-portfolio-alert-refresh', onPortfolioAlertRefresh)
    return () => window.removeEventListener('mm-portfolio-alert-refresh', onPortfolioAlertRefresh)
  }, [session?.user?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    const syncWatchlists = async () => {
      try {
        const { fund, product, available } = await loadDbWatchlists(userId)
        if (!available) return

        // DB is source of truth to prevent legacy local items from reappearing.
        setFundWatchlist(applyFundWatchlistPlanLimit(fund))
        setProductInterests(Array.isArray(product) ? product : [])
      } catch (err) {
        console.warn('watchlist sync failed:', err?.message || err)
      }
    }

    syncWatchlists()
  }, [session?.user?.id])

  // 別タブで mm_fund_watchlist / ファンドウォッチが更新されたら DB から再同期（同一タブでは storage が飛ばない）
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return undefined
    const onStorage = (e) => {
      if (e.storageArea !== window.localStorage) return
      if (e.key !== 'mm_fund_watchlist') return
      loadDbWatchlists(uid)
        .then(({ fund, product, available }) => {
          if (!available) return
          setFundWatchlist(applyFundWatchlistPlanLimit(fund))
          setProductInterests(Array.isArray(product) ? product : [])
        })
        .catch((err) => console.warn('watchlist cross-tab sync failed:', err?.message || err))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [session?.user?.id])

  useEffect(() => {
    let mounted = true

    const loadDisplayProfile = async (nextSession) => {
      if (!nextSession?.user?.id) {
        if (mounted) setCurrentUserProfile(null)
        return
      }

      const cacheKey = `mm_user_profile:${nextSession.user.id}`
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached && mounted) {
          const parsed = JSON.parse(cached)
          if (parsed?.id === nextSession.user.id && parsed?.displayName) {
            setCurrentUserProfile(parsed)
          }
        }
      } catch {
        // ignore cache parse errors
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', nextSession.user.id)
        .maybeSingle()

      // Email-confirm flow may return no session at sign-up time, so user_profiles
      // can be missing even when onboarding was already collected in auth metadata.
      // Backfill once on first authenticated load to avoid duplicate profile prompts.
      let effectiveProfile = profile || null
      if (!effectiveProfile) {
        try {
          const meta = nextSession.user?.user_metadata || {}
          const oAsset = String(meta?.onboarding_asset_mix || '').trim()
          const oRisk = String(meta?.onboarding_risk_tolerance || '').trim()
          const oHorizon = String(meta?.onboarding_investment_horizon || '').trim()
          const onboardingComplete = Boolean(oAsset && oRisk && oHorizon)
          const nowIso = new Date().toISOString()
          const upsertPayload = {
            user_id: nextSession.user.id,
            full_name: String(meta?.full_name || '').trim() || null,
            nickname: String(meta?.nickname || '').trim() || null,
            phone: String(meta?.phone || '').trim() || null,
            marketing_opt_in: Boolean(meta?.marketing_opt_in),
            event_coupon_opt_in: Boolean(meta?.event_coupon_opt_in),
            consent_acknowledged_at: nowIso,
            onboarding_asset_mix: oAsset || null,
            onboarding_risk_tolerance: oRisk || null,
            onboarding_investment_horizon: oHorizon || null,
            onboarding_answers_at: onboardingComplete ? nowIso : null,
          }
          const { data: backfilled, error: backfillErr } = await supabase
            .from('user_profiles')
            .upsert(upsertPayload, { onConflict: 'user_id' })
            .select('*')
            .single()
          if (!backfillErr && backfilled) effectiveProfile = backfilled
        } catch {
          // ignore backfill failures and continue with auth metadata only
        }
      }

      // Some users already have a profile row from earlier flows but without consent timestamp.
      // Since signup step enforces legal agreement, backfill consent once to avoid duplicate prompt.
      if (effectiveProfile && !effectiveProfile?.consent_acknowledged_at) {
        try {
          const nowIso = new Date().toISOString()
          const { data: patched, error: patchErr } = await supabase
            .from('user_profiles')
            .upsert({
              user_id: nextSession.user.id,
              consent_acknowledged_at: nowIso,
            }, { onConflict: 'user_id' })
            .select('*')
            .single()
          if (!patchErr && patched) effectiveProfile = patched
        } catch {
          // ignore and continue; user may still be routed to complete-profile if patch fails
        }
      }

      const metadataPlan = String(
        nextSession.user?.app_metadata?.plan_tier
        || nextSession.user?.user_metadata?.plan_tier
        || nextSession.user?.app_metadata?.membership_tier
        || nextSession.user?.user_metadata?.membership_tier
        || ''
      ).toLowerCase()
      const profilePlan = String(
        effectiveProfile?.plan_tier
        || effectiveProfile?.membership_tier
        || effectiveProfile?.subscription_tier
        || effectiveProfile?.plan
        || ''
      ).toLowerCase()
      const isProfilePrime = Boolean(
        effectiveProfile?.is_prime
        || effectiveProfile?.is_premium
        || effectiveProfile?.prime_member
      )
      const planTier = profilePlan || metadataPlan || (isProfilePrime ? 'prime' : 'free')
      const emailLower = String(nextSession.user?.email || '').trim().toLowerCase()
      const forcedPremiumPlanTier = PREMIUM_EMAIL_ALLOWLIST.has(emailLower) ? 'prime' : planTier

      const displayName = effectiveProfile?.nickname
        || effectiveProfile?.full_name
        || nextSession.user?.user_metadata?.nickname
        || nextSession.user?.user_metadata?.full_name
        || (nextSession.user.email ? nextSession.user.email.split('@')[0] : 'Member')

      const normalized = {
        id: nextSession.user.id,
        email: nextSession.user.email || '',
        displayName,
        planTier: forcedPremiumPlanTier,
        consentAcknowledgedAt: effectiveProfile?.consent_acknowledged_at ?? null,
      }

      if (mounted) setCurrentUserProfile(normalized)
      localStorage.setItem(cacheKey, JSON.stringify(normalized))
    }

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      const nextSession = data?.session ?? null
      setSession(nextSession)
      await loadDisplayProfile(nextSession)
      setAuthReady(true)
    }
    init()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      setCurrentUserProfile(undefined)
      loadDisplayProfile(nextSession ?? null)
    })

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let alive = true
    const loadRole = async () => {
      const sessionEmail = String(session?.user?.email || '').trim().toLowerCase()
      const isAdminEmail = ADMIN_EMAIL_ALLOWLIST.has(sessionEmail)
      if (!session?.user?.id) {
        if (!alive) return
        setRole('viewer')
        setRoleReady(true)
        return
      }

      setRole('viewer')
      setRoleReady(false)

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (error) throw error
        if (!alive) return
        setRole(data?.role === 'admin' || isAdminEmail ? 'admin' : 'viewer')
      } catch (err) {
        console.warn('role load failed, fallback to viewer:', err?.message || err)
        if (!alive) return
        setRole(isAdminEmail ? 'admin' : 'viewer')
      } finally {
        if (alive) setRoleReady(true)
      }
    }
    loadRole()
    return () => {
      alive = false
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!authReady || !session?.user?.id || !currentUserProfile) return
    if (currentUserProfile.consentAcknowledgedAt) return
    const path = location.pathname
    if (path === '/complete-profile' || path === '/login' || path === '/signup' || path === '/forgot-password' || path.startsWith('/reset-password') || path.startsWith('/legal')) return
    navigate('/complete-profile', { replace: true })
  }, [authReady, session?.user?.id, currentUserProfile?.consentAcknowledgedAt, location.pathname, navigate])

  useEffect(() => {
    if (!authReady || !session?.user?.id || AUTH_IDLE_TIMEOUT_MS <= 0) return undefined
    let timerId = null
    let alive = true

    const armTimer = () => {
      if (timerId) window.clearTimeout(timerId)
      timerId = window.setTimeout(async () => {
        if (!alive) return
        try {
          await supabase.auth.signOut()
          showUiMessage('一定時間操作がなかったため、自動でログアウトしました。', 'info')
        } catch {
          // ignore transient auth errors
        }
      }, AUTH_IDLE_TIMEOUT_MS)
    }

    const onActivity = () => armTimer()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') armTimer()
    }

    armTimer()
    AUTH_IDLE_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      alive = false
      if (timerId) window.clearTimeout(timerId)
      AUTH_IDLE_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity)
      })
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [authReady, session?.user?.id])

  const redirectToLoginForWatchAction = () => {
    navigate('/login', {
      state: { from: `${location.pathname}${location.search}` },
    })
  }

  const toggleFundWatchlist = (id, meta = {}) => {
    if (!id) return
    if (!session?.user?.id) {
      redirectToLoginForWatchAction()
      return
    }
    if (!fundWatchlist.some((item) => item.id === id) && FUND_ID_ALLOWLIST.size > 0 && !FUND_ID_ALLOWLIST.has(id)) return
    const exists = fundWatchlist.some((item) => item.id === id)
    const sym = String(id || '')
    const label = meta.name || sym
    if (exists) {
      trackAnalyticsEvent('fund_watchlist_remove', {
        symbol: sym,
        item_id: sym,
        product_id: sym,
        product_name: label,
        product_type: 'fund',
      })
    } else {
      trackAnalyticsEvent('fund_watchlist_add', {
        symbol: sym,
        item_id: sym,
        product_id: sym,
        product_name: label,
        product_type: 'fund',
      })
    }
    if (!exists && !isPaidMember && fundWatchlist.length >= FREE_FUND_WATCHLIST_LIMIT) {
      showUiMessage('無料プランのウォッチリストは3件までです。4件目以降はプレミアムで利用できます。', 'premium')
      navigate('/premium')
      return
    }
    const next = exists
      ? fundWatchlist.filter((item) => item.id !== id)
      : [
        ...fundWatchlist,
        {
          id,
          name: label,
          change: Number(meta.change || 0),
          trend: Number(meta.change || 0) >= 0 ? 'up' : 'down',
          watchGroup: String(meta.watchGroup || '').trim(),
        },
      ]
    setFundWatchlist(applyFundWatchlistPlanLimit(next))

    const userId = session?.user?.id
    if (!userId) return
    const dbOp = exists
      ? removeDbWatchlistItem({ userId, itemType: 'fund', itemId: id })
      : addDbWatchlistItem({
        userId,
        itemType: 'fund',
        itemId: id,
        itemName: meta.name || String(id),
        metadata: {
          change: Number(meta.change || 0),
          watchGroup: String(meta.watchGroup || '').trim(),
        },
      })
    dbOp.catch((err) => console.warn('fund watchlist sync failed:', err?.message || err))
  }

  const updateFundWatchlistMeta = (id, meta = {}) => {
    const itemId = String(id || '').trim()
    if (!itemId || !session?.user?.id) return
    const nextGroup = String(meta.watchGroup || '').trim()
    const existing = fundWatchlist.find((item) => item.id === itemId)
    if (!existing) return
    const next = fundWatchlist.map((item) => (item.id === itemId ? { ...item, watchGroup: nextGroup } : item))
    setFundWatchlist(applyFundWatchlistPlanLimit(next))
    addDbWatchlistItem({
      userId: session.user.id,
      itemType: 'fund',
      itemId,
      itemName: existing.name || itemId,
      metadata: {
        change: Number(existing.change || 0),
        watchGroup: nextGroup,
      },
    }).catch((err) => console.warn('fund watchlist metadata sync failed:', err?.message || err))
  }

  const toggleProductInterest = (id, meta = {}) => {
    if (!id) return
    if (!session?.user?.id) {
      redirectToLoginForWatchAction()
      return
    }
    const exists = productInterests.some((item) => item.id === id)
    const next = exists
      ? productInterests.filter((item) => item.id !== id)
      : [
        ...productInterests,
        {
          id,
          name: meta.name || String(id),
          provider: meta.provider || '',
          category: meta.category || '',
        },
      ]
    setProductInterests(next)

    const userId = session?.user?.id
    if (!userId) return
    const dbOp = exists
      ? removeDbWatchlistItem({ userId, itemType: 'product', itemId: id })
      : addDbWatchlistItem({
        userId,
        itemType: 'product',
        itemId: id,
        itemName: meta.name || String(id),
        metadata: { provider: meta.provider || '', category: meta.category || '' },
      })
    dbOp.catch((err) => console.warn('product interest sync failed:', err?.message || err))
  }

  const RequireAuth = ({ children }) => {
    const location = useLocation()
    if (!authReady) {
      return <RouteSkeleton title="認証情報を確認中..." />
    }
    if (!session) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    return children
  }

  const RequireAdmin = ({ children }) => {
    const location = useLocation()
    if (!authReady || !roleReady) {
      return <RouteSkeleton title="管理者権限を確認中..." />
    }
    if (!session) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    if (role !== 'admin') return <Navigate to="/" replace />
    return children
  }

  return (
    <Suspense
      fallback={<RouteSkeleton title="ページを読み込み中..." />}
    >
      <Routes>
        <Route
          element={(
            <Layout
              session={session}
              authReady={authReady}
              alertSummary={alertSummary}
              userProfile={currentUserProfile || null}
            />
          )}
        >
          <Route
            path="/"
            element={<HomePage session={session} userProfile={currentUserProfile || null} alertSummary={alertSummary} />}
          />
          <Route path="/news" element={<NewsPage session={session} />} />
          <Route path="/login" element={session ? <Navigate to={safeRouteReturnPath} replace /> : <Login />} />
          <Route path="/signup" element={session ? <Navigate to={safeRouteReturnPath} replace /> : <Signup />} />
          <Route path="/complete-profile" element={session ? <CompleteProfilePage /> : <Navigate to="/login" state={{ from: '/complete-profile' }} replace />} />
          <Route path="/forgot-password" element={session ? <Navigate to="/" replace /> : <ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/market" element={<MarketPage session={session} />} />
          <Route
            path="/funds"
            element={
              <FundPage
                user={session?.user || null}
                myWatchlist={fundWatchlist.map((item) => item.id)}
                toggleWatchlist={toggleFundWatchlist}
                onUiMessage={showUiMessage}
              />
            }
          />
          <Route path="/funds/compare" element={<FundsCompareRedirect />} />
          <Route
            path="/etf-compare"
            element={
              <FundComparePage
                user={session?.user || null}
                myWatchlist={fundWatchlist.map((item) => item.id)}
                toggleWatchlist={toggleFundWatchlist}
                onUiMessage={showUiMessage}
              />
            }
          />
          <Route
            path="/funds/:id"
            element={
              <RequireAuth>
                <FundDetailPage
                  myWatchlist={fundWatchlist.map((item) => item.id)}
                  toggleWatchlist={toggleFundWatchlist}
                />
              </RequireAuth>
            }
          />
          <Route path="/stocks" element={<StockPage user={session?.user || null} />} />
          <Route
            path="/products"
            element={<ProductsPage />}
          />
          <Route
            path="/products/:id"
            element={<Navigate to="/products" replace />}
          />
          <Route path="/market-indicator" element={<MarketPage session={session} />} />
          <Route path="/insights" element={<InsightPage />} />
          <Route path="/insights/:slug" element={<InsightPage />} />
          <Route path="/lounge" element={<LoungePage bootUser={currentUserProfile} authReady={authReady} />} />
          <Route path="/academy" element={<NotFoundPage />} />
          <Route path="/prime" element={<Navigate to="/" replace />} />
          <Route
            path="/premium"
            element={(
              <PremiumPage
                session={session}
                userProfile={currentUserProfile || null}
              />
            )}
          />
          <Route
            path="/mypage"
            element={
              <RequireAuth>
                <MyPage
                  fundWatchlist={fundWatchlist}
                  productInterests={productInterests}
                  toggleFundWatchlist={toggleFundWatchlist}
                  updateFundWatchlistMeta={updateFundWatchlistMeta}
                  onUiMessage={showUiMessage}
                  user={session?.user || null}
                  userProfile={currentUserProfile || null}
                />
              </RequireAuth>
            }
          />
          <Route
            path="/mypage/briefs"
            element={(
              <RequireAuth>
                <BriefArchivePage />
              </RequireAuth>
            )}
          />
          <Route
            path="/dividend-calendar"
            element={session ? (
              <Navigate to="/mypage?tab=dividend" replace />
            ) : (
              <ToolLandingPage
                subtitle="MONEYMART TOOLS"
                title="配当カレンダー"
                description="配当月・銘柄・保有数量を整理して、入金見込みを見える化するツールです。ログインするとマイページで配当カレンダーをそのまま利用できます。"
                ctaLabel="ログインして開く"
                ctaTo="/login"
                secondaryLabel="マーケットを見る"
                secondaryTo="/market-indicator"
              />
            )}
          />
          <Route
            path="/budget-tracker"
            element={session ? (
              <Navigate to="/mypage?tab=point" replace />
            ) : (
              <ToolLandingPage
                subtitle="MONEYMART TOOLS"
                title="家計トラッカー"
                description="支出・ポイント・予算をまとめて確認し、月次のキャッシュフローを整えるツールです。ログイン後はマイページで家計管理機能を利用できます。"
                ctaLabel="ログインして開く"
                ctaTo="/login"
                secondaryLabel="ホームへ"
                secondaryTo="/"
              />
            )}
          />
          <Route path="/legal/faq" element={<Navigate to="/faq" replace />} />
          <Route path="/legal/:type" element={<LegalPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/tools" element={<ToolsHubPage session={session} />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminIpGuard>
                  <AdminPage />
                </AdminIpGuard>
              </RequireAdmin>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      {uiMessage?.text ? (
        <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[220] flex justify-center px-4">
          <div
            className={`pointer-events-auto max-w-xl rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${
              uiMessage.tone === 'premium'
                ? 'border-amber-300 bg-amber-50/95 text-amber-800 dark:border-amber-700 dark:bg-amber-950/95 dark:text-amber-100'
                : 'border-slate-300 bg-white/95 text-slate-800 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100'
            }`}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-bold">{uiMessage.text}</p>
          </div>
        </div>
      ) : null}
    </Suspense>
  )
}

export default App
