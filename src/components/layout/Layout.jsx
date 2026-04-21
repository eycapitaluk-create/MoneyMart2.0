import { useState, useEffect, useRef, useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from './Navbar'
import Footer from './Footer'
import CustomerChatbot from '../CustomerChatbot'
import { getSeoForRoute, webApplicationJsonLd, SITE_ORIGIN } from '../../lib/seoConfig'
import {
  bootstrapAnalytics,
  getCurrentAnalyticsPath,
  getCurrentAnalyticsQuery,
  getCurrentPathEnteredAt,
  setCurrentAnalyticsPath,
  trackPageExit,
  trackPageView,
} from '../../lib/analytics'

const THEME_STORAGE_KEY = 'mm_theme'

export default function Layout({
  session = null,
  authReady = false,
  userProfile = null,
  alertSummary = { insuranceExpiringSoon: 0, pointExpiringSoonCount: 0, budgetOver80Pct: false },
}) {
  const location = useLocation()
  const mountedRef = useRef(false)
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
    const warmup = () => {
      // Keep prefetch conservative so it does not compete with current route work.
      import('../../pages/NewsPage')
      import('../../pages/MyPage')
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
    const enteredAt = getCurrentPathEnteredAt()
    const now = Date.now()

    if (mountedRef.current && prevPath && prevPath !== nextPath) {
      trackPageExit({
        path: prevPath,
        query: prevQuery,
        dwellMs: enteredAt > 0 ? now - enteredAt : 0,
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
    mountedRef.current = true
  }, [location.pathname, location.search])

  const toggleDarkMode = () => setDarkMode((prev) => !prev)

  const seo = useMemo(
    () => getSeoForRoute(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const ogImage = `${SITE_ORIGIN}/icon.png`
  const shouldNoIndex = useMemo(() => {
    const p = location.pathname || '/'
    return (
      p === '/login'
      || p === '/signup'
      || p === '/reset-password'
      || p === '/forgot-password'
      || p === '/complete-profile'
      || p.startsWith('/mypage')
      || p.startsWith('/admin')
    )
  }, [location.pathname])
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 font-sans">
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
        <meta property="og:locale" content="ja_JP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        <meta name="twitter:image" content={ogImage} />
        {shouldNoIndex ? <meta name="robots" content="noindex,nofollow" /> : null}
        {seo.isTool && seo.toolName ? (
          <script type="application/ld+json">{JSON.stringify(webApplicationJsonLd(seo.toolName, seo.canonical))}</script>
        ) : null}
      </Helmet>
      <Navbar darkMode={darkMode} onToggleDarkMode={toggleDarkMode} session={session} authReady={authReady} userProfile={userProfile} alertSummary={alertSummary} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CustomerChatbot />
    </div>
  )
}
