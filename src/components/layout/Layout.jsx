import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { lazyWithRetry } from '../../lib/lazyWithRetry'
import { Outlet, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from './Navbar'
import Footer from './Footer'
import ErrorBoundary from '../ErrorBoundary'
import EmailVerificationBanner from '../auth/EmailVerificationBanner'

const CustomerChatbot = lazyWithRetry(() => import('../CustomerChatbot'))
import { getSeoForRoute, webApplicationJsonLd, getSiteOgImageUrl, SITE_OG_IMAGE_SIZE, SITE_ORIGIN, organizationJsonLd, webSiteJsonLd, softwareApplicationJsonLd } from '../../lib/seoConfig'
import {
  bootstrapAnalytics,
  refreshSignupAttributionFromBrowser,
  getCurrentAnalyticsPath,
  getCurrentAnalyticsQuery,
  setCurrentAnalyticsPath,
  commitAnalyticsPageExit,
  trackPageView,
} from '../../lib/analytics'
import { syncClarityForRoute } from '../../lib/clarity'

const THEME_STORAGE_KEY = 'mm_theme'

export default function Layout({
  session = null,
  authReady = false,
  userProfile = null,
  alertSummary = { insuranceExpiringSoon: 0, pointExpiringSoonCount: 0, budgetOver80Pct: false },
}) {
  const location = useLocation()
  const mountedRef = useRef(false)
  const hideEmailBanner = useMemo(() => {
    const p = location.pathname
    return p === '/login' || p === '/signup' || p === '/signup-complete' || p === '/complete-profile'
      || p.startsWith('/reset-password') || p === '/forgot-password'
  }, [location.pathname])
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'dark') return true
      if (saved === 'light') return false
    }
    // Default to light mode unless user explicitly chose dark.
    return false
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    }
  }, [darkMode])

  useEffect(() => {
    bootstrapAnalytics()
  }, [])

  useEffect(() => {
    refreshSignupAttributionFromBrowser()
  }, [location.pathname, location.search])

  useEffect(() => {
    const warmup = () => {
      // Prefetch only light routes. MyPage (~340KB+) competes with first paint and LCP.
      import('../../pages/NewsPage')
    }
    if (typeof window === 'undefined') return
    const conn = window.navigator?.connection
    if (conn?.saveData) return
    if (typeof conn?.effectiveType === 'string' && /(^|-)2g$/.test(conn.effectiveType)) return
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => warmup(), { timeout: 2000 })
      return () => window.cancelIdleCallback(id)
    }
    const timer = window.setTimeout(warmup, 1200)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    const nextPath = location.pathname || '/'
    const nextQuery = location.search || ''
    const prevPath = getCurrentAnalyticsPath()
    const prevQuery = getCurrentAnalyticsQuery()

    if (mountedRef.current && prevPath && prevPath !== nextPath) {
      void commitAnalyticsPageExit({
        path: prevPath,
        query: prevQuery,
      })
    }

    trackPageView({
      path: nextPath,
      query: nextQuery,
      meta: {
        route_name: nextPath,
      },
    })

    setCurrentAnalyticsPath(nextPath, nextQuery)
    syncClarityForRoute(nextPath)
    mountedRef.current = true
  }, [location.pathname, location.search])

  const toggleDarkMode = () => setDarkMode((prev) => !prev)

  const seo = useMemo(
    () => getSeoForRoute(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const ogImage = getSiteOgImageUrl()
  const shouldNoIndex = useMemo(() => {
    const p = location.pathname || '/'
    return Boolean(seo.noindex)
      || p === '/login'
      || p === '/signup'
      || p === '/reset-password'
      || p === '/forgot-password'
      || p === '/signup-complete'
      || p === '/complete-profile'
      || p.startsWith('/mypage')
      || p.startsWith('/admin')
      || p === '/business/demo'
      || p.startsWith('/business/demo/')
      || p === '/community'
      || p === '/lounge'
  }, [location.pathname, seo.noindex])
  const homeLdBlocks = useMemo(() => {
    if ((location.pathname || '/') !== '/') return []
    return [
      softwareApplicationJsonLd({
        name: 'MoneyMart',
        url: '/',
        origin: SITE_ORIGIN,
        description: seo.description,
      }),
    ]
  }, [location.pathname, seo.description])
  const isAdminApp = (location.pathname || '').startsWith('/admin')
  const isAdvisorDemo = (location.pathname || '') === '/business/demo' || (location.pathname || '').startsWith('/business/demo/')
  const isChromeLess = isAdminApp || isAdvisorDemo

  return (
    <div className={`min-h-screen flex flex-col font-sans ${isChromeLess ? (isAdvisorDemo ? 'bg-[#faf8f2]' : 'bg-[#f7f8fa]') : 'bg-white dark:bg-gray-950'}`}>
      <Helmet htmlAttributes={{ lang: 'ja' }}>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={seo.canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="MoneyMart" />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={seo.canonical} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content={String(SITE_OG_IMAGE_SIZE.width)} />
        <meta property="og:image:height" content={String(SITE_OG_IMAGE_SIZE.height)} />
        <meta property="og:image:alt" content="MoneyMart" />
        <meta property="og:locale" content="ja_JP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content="MoneyMart" />
        {shouldNoIndex ? <meta name="robots" content="noindex,nofollow" /> : null}
        <script type="application/ld+json">{JSON.stringify(organizationJsonLd(SITE_ORIGIN))}</script>
        <script type="application/ld+json">{JSON.stringify(webSiteJsonLd(SITE_ORIGIN))}</script>
        {seo.isTool && seo.toolName ? (
          <script type="application/ld+json">{JSON.stringify(webApplicationJsonLd(seo.toolName, seo.canonical))}</script>
        ) : null}
        {homeLdBlocks.map((obj, i) => (
          <script key={`ld-home-${i}`} type="application/ld+json">{JSON.stringify(obj)}</script>
        ))}
      </Helmet>
      {isChromeLess ? null : (
        <Navbar darkMode={darkMode} onToggleDarkMode={toggleDarkMode} session={session} authReady={authReady} userProfile={userProfile} alertSummary={alertSummary} />
      )}
      {!isChromeLess && !hideEmailBanner && authReady && session ? <EmailVerificationBanner session={session} /> : null}
      <main className="flex-1">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      {isChromeLess ? null : <Footer />}
      {isChromeLess ? null : (
        <Suspense fallback={null}>
          <CustomerChatbot />
        </Suspense>
      )}
    </div>
  )
}
