import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import InsightRichEditor from '../components/insights/InsightRichEditor'
import {
  INSIGHT_BODY_DELIM_PLAIN,
  joinInsightMainCombined,
  splitInsightMainCombined,
  isEmptyInsightBodyHtml,
} from '../lib/insightHtml'
import { parseInsightKeywordsText } from '../lib/insightKeywords'
import { aggregateDwellStats, avgCappedDwellMs, capDwellMsForReport, medianDwellMs } from '../lib/analyticsDwellStats'
import { fetchAdminReports, updateCommentStatus, updatePostStatus, updateReportStatus } from '../lib/loungeApi'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Database,
  Download,
  Globe2,
  LayoutDashboard,
  MousePointerClick,
  Package,
  Search,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react'
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../data/etfListFromXlsx'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { publishedAtNoonTokyoFromDateOnly, publishedAtNowIso } from '../lib/newsPublishedAt'
import {
  fetchDividendMasterSchedule,
  insertDividendMasterRow,
  updateDividendMasterRow,
  deleteDividendMasterRow,
} from '../lib/dividendMasterScheduleApi'
import {
  crmUserSegment,
  hasPremiumIntent,
  isActivatedSignup,
  isCrmInternalEmail,
  isCrmInternalUser,
  isInternalReferrerDomain,
  buildInternalUserIdSet,
  filterStaffAnalyticsEvents,
  isSmartNewsSignup,
} from '../lib/crmInternalUsers'
import {
  aggregateSignupReferrerChannels,
  aggregateTrafficReferrerChannels,
  formatTrafficReferrerLabel,
  REFERRER_CHANNEL_NOTES,
} from '../lib/referrerBuckets'

import { MARKET_MAJOR_REGION_OPTIONS } from '../lib/marketMajorNewsBoard'
import { buildCrmExecutiveSummary } from '../lib/crmExecutiveSummary'
import { buildCrmAdvancedAnalysis } from '../lib/crmAdvancedAnalysis'
import { buildSiteAdvancedAnalysis } from '../lib/siteAdvancedAnalysis'
import CrmWorkbench from '../components/admin/crm/CrmWorkbench'
import AnalyticsWorkbench from '../components/admin/analytics/AnalyticsWorkbench'
import AdminExecutiveDashboard from '../components/admin/dashboard/AdminExecutiveDashboard'
import {
  aggregateAudienceFromEvents,
  buildOnboardingAudienceFromCrmRows,
  emptyCrmAudience,
  mapAudienceRpcPayload,
  mergeAudienceWithOnboarding,
} from '../lib/crmAudienceAggregate'

const formatAnalyticsDuration = (value) => {
  const ms = Number(value || 0)
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)} min`
  return `${Math.round(ms / 1000)} sec`
}

const analyticsDataSourceBadge = ({ loading, error, dataSource }) => {
  if (loading) {
    return { label: 'Loading', className: 'border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300' }
  }
  if (error) {
    const timeout = /timeout|タイムアウト|57014/i.test(String(error))
    return timeout
      ? { label: 'SQL required', className: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200' }
      : { label: 'Load error', className: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200' }
  }
  if (dataSource === 'client') {
    return { label: 'Browser summary', className: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100' }
  }
  return { label: 'RPC aggregate', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' }
}

const formatAnalyticsLoadError = (err) => {
  const message = String(err?.message || err || '')
  if (
    message.includes("Could not find the table 'public.site_analytics_events' in the schema cache")
    || message.includes("relation \"public.site_analytics_events\" does not exist")
    || message.includes("Could not find the table 'public.site_analytics_top_pages_30d' in the schema cache")
  ) {
    return 'Supabase analytics tables/views are missing. Run `SUPABASE_SETUP_SITE_ANALYTICS.sql` first, then reload.'
  }
  if (
    message.toLowerCase().includes('admin_site_analytics_dashboard')
    && (message.includes('does not exist') || message.includes('Could not find') || message.includes('schema cache'))
  ) {
    return 'Analytics RPC is missing. Run `SUPABASE_ADMIN_SITE_ANALYTICS_DASHBOARD_RPC.sql` in the Supabase SQL editor, then reload. (Without it, the browser summarizes up to 20k rows.)'
  }
  if (
    String(err?.code || '') === '57014'
    || message.toLowerCase().includes('statement timeout')
    || message.toLowerCase().includes('canceling statement due to statement timeout')
  ) {
    return 'Analytics RPC timed out. Run `SUPABASE_FIX_ANALYTICS_VIEW_PERF.sql` in Supabase, or use the browser summary fallback.'
  }
  return message || 'Failed to load analytics.'
}

const ANALYTICS_CLICK_EVENTS = new Set(['fund_select', 'stock_select', 'product_select', 'product_apply_click', 'home_fund_click'])

const isAnalyticsRpcMissingError = (err) => {
  const m = String(err?.message || err || '').toLowerCase()
  const c = String(err?.code || '')
  return (
    c === '42883'
    || c === 'PGRST202'
    || m.includes('admin_site_analytics_dashboard')
    || m.includes('could not find the function')
    || (m.includes('function') && m.includes('does not exist'))
  )
}

const isAnalyticsRpcFallbackError = (err) => {
  if (isAnalyticsRpcMissingError(err)) return true
  const m = String(err?.message || err || '').toLowerCase()
  const c = String(err?.code || '')
  return (
    c === '57014'
    || m.includes('statement timeout')
    || m.includes('canceling statement due to statement timeout')
    || m.includes('v_customer_site_analytics_events')
  )
}

const emptyAnalyticsActivity = () => ({
  dauDaily: [],
  rolling: { wauSessions: 0, mauSessionsWindow: 0 },
  cohortSessions: {
    loggedInSessions: 0,
    newUserSessions: 0,
    returningUserSessions: 0,
    anonymousSessions: 0,
  },
  watchlist: {
    fundAdds: 0,
    fundRemoves: 0,
    stockAdds: 0,
    stockRemoves: 0,
    topAddSymbols: [],
  },
  attributionSignups: {
    signupsInWindow: 0,
    signupsLandingFundsOrTools: 0,
    signupsLandingCompare: 0,
    premiumSessionsPageview: 0,
  },
})

const mapActivityFromRpc = (raw) => {
  if (!raw || typeof raw !== 'object') return emptyAnalyticsActivity()
  const n = (v) => Number(v || 0)
  const w = raw.watchlist || {}
  const r = raw.rolling || {}
  const c = raw.cohort_sessions || {}
  const a = raw.attribution_signups || {}
  return {
    dauDaily: Array.isArray(raw.dau_daily)
      ? raw.dau_daily.map((row) => {
          const day = String(row?.day || '')
          return {
            day,
            dayShort: day.length >= 10 ? day.slice(5, 10) : day,
            activeSessions: n(row?.active_sessions),
            activeUsers: n(row?.active_users),
          }
        })
      : [],
    rolling: {
      wauSessions: n(r.wau_sessions),
      mauSessionsWindow: n(r.mau_sessions_window),
    },
    cohortSessions: {
      loggedInSessions: n(c.logged_in_sessions),
      newUserSessions: n(c.new_user_sessions),
      returningUserSessions: n(c.returning_user_sessions),
      anonymousSessions: n(c.anonymous_sessions),
    },
    watchlist: {
      fundAdds: n(w.fund_watchlist_adds),
      fundRemoves: n(w.fund_watchlist_removes),
      stockAdds: n(w.stock_watchlist_adds),
      stockRemoves: n(w.stock_watchlist_removes),
      topAddSymbols: Array.isArray(w.top_add_symbols) ? w.top_add_symbols : [],
    },
    attributionSignups: {
      signupsInWindow: n(a.signups_in_window),
      signupsLandingFundsOrTools: n(a.signups_landing_funds_or_tools),
      signupsLandingCompare: n(a.signups_landing_compare),
      premiumSessionsPageview: n(a.premium_sessions_pageview),
    },
  }
}

const buildActivityClientFallback = (rows, pageViewEvents, rangeDays) => {
  const safeDays = Math.max(1, Math.min(366, Number(rangeDays) || 30))
  const sinceMs = Date.now() - safeDays * 86400000
  const sinceDay = new Date(sinceMs).toISOString().slice(0, 10)
  const todayDay = new Date().toISOString().slice(0, 10)

  const days = []
  for (let t = new Date(`${sinceDay}T12:00:00Z`).getTime(); t <= new Date(`${todayDay}T12:00:00Z`).getTime(); t += 86400000) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  const dauDaily = days.map((day) => {
    const pv = pageViewEvents.filter((e) => String(e.created_at || '').slice(0, 10) === day)
    const sess = new Set(pv.map((e) => e.session_id).filter(Boolean))
    const users = new Set(pv.map((e) => e.user_id).filter(Boolean))
    return {
      day,
      dayShort: day.slice(5, 10),
      activeSessions: sess.size,
      activeUsers: users.size,
    }
  })

  const wauCut = Date.now() - 7 * 86400000
  const wauSessions = new Set(
    pageViewEvents.filter((e) => new Date(e.created_at).getTime() >= wauCut).map((e) => e.session_id).filter(Boolean),
  )
  const mauSessions = new Set(pageViewEvents.map((e) => e.session_id).filter(Boolean))

  const windowPv = pageViewEvents.filter((e) => new Date(e.created_at).getTime() >= sinceMs)
  const sessLogged = new Map()
  windowPv.forEach((e) => {
    if (!e.session_id || !e.user_id) return
    if (!sessLogged.has(e.session_id)) sessLogged.set(e.session_id, e.user_id)
  })
  const userFirst = new Map()
  rows
    .filter((e) => e.event_name === 'page_view' && e.user_id)
    .forEach((e) => {
      const u = e.user_id
      const t = new Date(e.created_at).getTime()
      const prev = userFirst.get(u)
      if (prev == null || t < prev) userFirst.set(u, t)
    })
  let newS = 0
  let retS = 0
  sessLogged.forEach((uid) => {
    const first = userFirst.get(uid)
    if (first == null) return
    if (first >= sinceMs) newS += 1
    else retS += 1
  })
  const anonSessions = new Set(
    windowPv.filter((e) => e.user_id == null && e.session_id).map((e) => e.session_id),
  )

  const wlAddSyms = new Map()
  let fa = 0
  let fr = 0
  let sa = 0
  let sr = 0
  rows.forEach((e) => {
    if (new Date(e.created_at).getTime() < sinceMs) return
    const name = String(e.event_name || '')
    if (name === 'fund_watchlist_add') fa += 1
    if (name === 'fund_watchlist_remove') fr += 1
    if (name === 'stock_watchlist_add') sa += 1
    if (name === 'stock_watchlist_remove') sr += 1
    if (name === 'fund_watchlist_add' || name === 'stock_watchlist_add') {
      const meta = e.event_meta || {}
      const sym = String(meta.symbol || meta.product_id || meta.item_id || '').trim() || '(unknown)'
      wlAddSyms.set(sym, (wlAddSyms.get(sym) || 0) + 1)
    }
  })
  const topAddSymbols = [...wlAddSyms.entries()]
    .map(([symbol, adds]) => ({ symbol, adds }))
    .sort((a, b) => b.adds - a.adds)
    .slice(0, 15)

  return {
    dauDaily,
    rolling: { wauSessions: wauSessions.size, mauSessionsWindow: mauSessions.size },
    cohortSessions: {
      loggedInSessions: sessLogged.size,
      newUserSessions: newS,
      returningUserSessions: retS,
      anonymousSessions: anonSessions.size,
    },
    watchlist: {
      fundAdds: fa,
      fundRemoves: fr,
      stockAdds: sa,
      stockRemoves: sr,
      topAddSymbols,
    },
    attributionSignups: {
      signupsInWindow: 0,
      signupsLandingFundsOrTools: 0,
      signupsLandingCompare: 0,
      premiumSessionsPageview: 0,
    },
  }
}

const mapAnalyticsRpcPayload = (payload) => {
  const s = payload?.summary || {}
  const sp = payload?.summary_prev || {}
  const n = (v) => Number(v || 0)
  const dailyRaw = Array.isArray(payload?.daily_trend) ? payload.daily_trend : []
  const dailyTrend = dailyRaw.map((row) => ({
    day: String(row?.day || ''),
    pageViews: n(row?.page_views),
    searches: n(row?.searches),
    productClicks: n(row?.product_clicks),
    uniqueSessions: n(row?.unique_sessions),
  }))
  return {
    dataSource: 'rpc',
    pageViews: n(s.page_views),
    uniqueSessionsPageView: n(s.unique_sessions_page_view),
    searches: n(s.searches),
    uniqueSearchSessions: n(s.unique_search_sessions),
    productClicks: n(s.product_clicks),
    uniqueProductClickSessions: n(s.unique_product_click_sessions),
    landingViews: n(s.landing_view_events),
    uniqueLandingSessions: n(s.unique_landing_sessions),
    avgDwellMs: n(s.avg_dwell_ms),
    medianDwellMs: n(s.median_dwell_ms),
    summaryPrev: {
      pageViews: n(sp.page_views),
      uniqueSessionsPageView: n(sp.unique_sessions_page_view),
      searches: n(sp.searches),
      uniqueSearchSessions: n(sp.unique_search_sessions),
      productClicks: n(sp.product_clicks),
      uniqueProductClickSessions: n(sp.unique_product_click_sessions),
      landingViews: n(sp.landing_view_events),
      uniqueLandingSessions: n(sp.unique_landing_sessions),
      avgDwellMs: n(sp.avg_dwell_ms),
      medianDwellMs: n(sp.median_dwell_ms),
    },
    topPages: Array.isArray(payload?.top_pages) ? payload.top_pages : [],
    topProducts: Array.isArray(payload?.top_products) ? payload.top_products : [],
    topSearches: Array.isArray(payload?.top_searches) ? payload.top_searches : [],
    topReferrers: Array.isArray(payload?.top_referrers) ? payload.top_referrers : [],
    topCampaigns: Array.isArray(payload?.top_campaigns) ? payload.top_campaigns : [],
    funnel: Array.isArray(payload?.funnel) ? payload.funnel : [],
    dailyTrend,
    eventBreakdown: Array.isArray(payload?.event_breakdown) ? payload.event_breakdown : [],
    engagement: Array.isArray(payload?.engagement) ? payload.engagement : [],
    activity: mapActivityFromRpc(payload?.activity),
    rangeDays: Number(payload?.meta?.days) || null,
    metaSince: payload?.meta?.since || null,
  }
}

const downloadAnalyticsCsv = (filename, rows, columns) => {
  const esc = (v) => {
    const s = String(v ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = columns.map((c) => c.header).join(',')
  const lines = (rows || []).map((row) => (
    columns.map((col) => esc(col.get ? col.get(row) : row?.[col.key])).join(',')
  ))
  const blob = new Blob([`\uFEFF${header}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Raw page_path → coarse product bucket (SPA pathname only, strip query). */
const bucketPagePath = (pathRaw) => {
  const path = String(pathRaw || '').split('?')[0] || ''
  if (path === '/funds') return 'funds_list'
  if (path.startsWith('/funds/compare') || path.startsWith('/etf-compare')) return 'fund_compare'
  if (/^\/funds\/.+/.test(path)) return 'fund_detail'
  if (path.startsWith('/stocks')) return 'stocks'
  if (path.startsWith('/mypage')) return 'mypage'
  if (path.startsWith('/tools')) return 'tools'
  if (path.startsWith('/market')) return 'market'
  if (path.startsWith('/insights')) return 'insights'
  if (path.startsWith('/products')) return 'products'
  if (path.startsWith('/news')) return 'news'
  if (path.startsWith('/community') || path.startsWith('/lounge')) return 'community'
  if (path.startsWith('/premium')) return 'premium'
  if (path.startsWith('/dividend')) return 'dividend'
  if (path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/forgot-password') || path.startsWith('/reset-password')) return 'auth'
  if (path.startsWith('/legal') || path === '/faq' || path === '/about' || path === '/careers') return 'legal'
  if (path === '/' || path === '') return 'home'
  return 'other'
}

const PAGE_BUCKET_LABELS = {
  funds_list: 'Funds / ETF list',
  fund_detail: 'Fund detail',
  fund_compare: 'Fund compare',
  stocks: 'Stocks',
  mypage: 'My page',
  tools: 'Tools',
  market: 'Market',
  insights: 'Insights',
  products: 'Products',
  news: 'News',
  community: 'Community',
  premium: 'Premium',
  dividend: 'Dividend calendar',
  auth: 'Login / signup',
  legal: 'Legal / FAQ',
  home: 'Home',
  other: 'Other pages',
}

const buildProductDashboardRollups = (analytics) => {
  const topPages = Array.isArray(analytics?.topPages) ? analytics.topPages : []
  const buckets = new Map()
  for (const row of topPages) {
    const key = bucketPagePath(row.page_path)
    const cur = buckets.get(key) || { views: 0, uniqueSessionsSum: 0, dwellWeighted: 0, dwellWeight: 0, samplePaths: [] }
    const views = Number(row.views || 0)
    cur.views += views
    cur.uniqueSessionsSum += Number(row.unique_sessions || 0)
    const path = String(row.page_path || '').split('?')[0]
    if (key === 'other' && path && cur.samplePaths.length < 4 && !cur.samplePaths.includes(path)) {
      cur.samplePaths.push(path)
    }
    const d = Number(row.avg_dwell_ms || 0)
    if (d > 0 && views > 0) {
      cur.dwellWeighted += d * views
      cur.dwellWeight += views
    }
    buckets.set(key, cur)
  }
  const rollups = [...buckets.entries()].map(([id, v]) => ({
    id,
    label: PAGE_BUCKET_LABELS[id] || id,
    views: v.views,
    unique_sessions_sum: v.uniqueSessionsSum,
    avg_dwell_ms: v.dwellWeight > 0 ? Math.round(v.dwellWeighted / v.dwellWeight) : 0,
    samplePaths: v.samplePaths || [],
  }))
  rollups.sort((a, b) => b.views - a.views)

  const topProducts = Array.isArray(analytics?.topProducts) ? analytics.topProducts : []
  const fundClicks = topProducts.filter((r) => {
    const t = String(r.product_type || '').toLowerCase()
    const id = String(r.product_id || '')
    return t.includes('fund') || t.includes('etf') || /\.T$/i.test(id)
  })

  const events = Array.isArray(analytics?.eventBreakdown) ? analytics.eventBreakdown : []
  const watchHints = events.filter((e) => /watchlist|watch_list|ウォッチ/i.test(String(e.event_name || '')))

  const totalAreaViews = rollups.reduce((sum, row) => sum + Number(row.views || 0), 0)
  const fundClickTotal = fundClicks.reduce((sum, row) => sum + Number(row.clicks || 0), 0)

  return {
    rollups,
    fundClicks,
    watchHints,
    summary: {
      totalAreaViews,
      uniqueSessions: Number(analytics?.uniqueSessionsPageView || 0),
      avgDwellMs: Number(analytics?.avgDwellMs || 0),
      medianDwellMs: Number(analytics?.medianDwellMs || 0),
      productClicks: Number(analytics?.productClicks || 0),
      fundClickTotal,
    },
    maxAreaViews: rollups.reduce((max, row) => Math.max(max, Number(row.views || 0)), 0),
    maxFundClicks: fundClicks.reduce((max, row) => Math.max(max, Number(row.clicks || 0)), 0),
  }
}

const formatCrmLoadError = (err) => {
  const message = String(err?.message || err || '')
  if (
    message.includes('admin_crm_users')
    && (message.includes('does not exist') || message.includes('schema cache') || message.includes('Could not find'))
  ) {
    return 'CRM is not set up yet: the `admin_crm_users` RPC is missing. Run `SUPABASE_CRM_SIGNUP_ATTRIBUTION.sql` in the Supabase SQL editor, then reload.'
  }
  if (
    message.includes('admin_crm_traffic_dashboard')
    && (message.includes('does not exist') || message.includes('schema cache') || message.includes('Could not find'))
  ) {
    return 'Visitor traffic RPC is missing. Run `SUPABASE_ADMIN_CRM_ENHANCED.sql` in Supabase SQL editor, then reload.'
  }
  if (message.toLowerCase().includes('not allowed')) return 'Admin access required.'
  if (message.includes('signup_referrer_domain')) {
    return 'Signup attribution columns are missing on `user_profiles`. Run `SUPABASE_CRM_SIGNUP_ATTRIBUTION.sql` in Supabase.'
  }
  return message || 'Failed to load CRM data.'
}

const emptyCrmTraffic = () => ({
  dataSource: '',
  summary: {
    pageViews: 0,
    uniqueSessions: 0,
    anonymousSessions: 0,
    loggedInSessions: 0,
    attributedSessions: 0,
    directUnknownSessions: 0,
    signupsInWindow: 0,
    signupConversionPct: 0,
  },
  cohort: {
    anonymousSessions: 0,
    loggedInSessions: 0,
    newSessions: 0,
    returningSessions: 0,
  },
  topReferrers: [],
  topLandingPaths: [],
  topUtmSources: [],
  dailyTrend: [],
  recentSessions: [],
  meta: { days: 30 },
})

const isInternalTrafficSession = (session) => (
  isInternalReferrerDomain(session?.referrer_domain)
  || isCrmInternalEmail(session?.email)
)

const filterExternalCrmTraffic = (traffic) => {
  if (!traffic) return emptyCrmTraffic()
  const topReferrers = (traffic.topReferrers || []).filter(
    (row) => !isInternalReferrerDomain(row.referrer_domain),
  )
  const recentSessions = (traffic.recentSessions || []).filter(
    (row) => !isInternalTrafficSession(row),
  )
  return {
    ...traffic,
    topReferrers,
    recentSessions,
  }
}

const filterExternalAnalyticsReferrers = (rows) => (
  (Array.isArray(rows) ? rows : []).filter((row) => !isInternalReferrerDomain(row.referrer_domain))
)

const mapCrmTrafficPayload = (payload) => {
  const s = payload?.summary || {}
  const c = payload?.cohort || {}
  const n = (v) => Number(v || 0)
  const dailyRaw = Array.isArray(payload?.daily_trend) ? payload.daily_trend : []
  return {
    dataSource: 'rpc',
    summary: {
      pageViews: n(s.page_views),
      uniqueSessions: n(s.unique_sessions),
      anonymousSessions: n(s.anonymous_sessions),
      loggedInSessions: n(s.logged_in_sessions),
      attributedSessions: n(s.attributed_sessions),
      directUnknownSessions: n(s.direct_unknown_sessions),
      signupsInWindow: n(s.signups_in_window),
      signupConversionPct: n(s.signup_conversion_pct),
    },
    cohort: {
      anonymousSessions: n(c.anonymous_sessions),
      loggedInSessions: n(c.logged_in_sessions),
      newSessions: n(c.new_sessions),
      returningSessions: n(c.returning_sessions),
    },
    topReferrers: Array.isArray(payload?.top_referrers) ? payload.top_referrers : [],
    topLandingPaths: Array.isArray(payload?.top_landing_paths) ? payload.top_landing_paths : [],
    topUtmSources: Array.isArray(payload?.top_utm_sources) ? payload.top_utm_sources : [],
    dailyTrend: dailyRaw.map((row) => ({
      day: String(row?.day || ''),
      sessions: n(row?.sessions),
      anonymousSessions: n(row?.anonymous_sessions),
      loggedInSessions: n(row?.logged_in_sessions),
      pageViews: n(row?.page_views),
    })),
    recentSessions: Array.isArray(payload?.recent_sessions) ? payload.recent_sessions : [],
    meta: payload?.meta || { days: 30 },
  }
}


const crmHasAttribution = (row) => {
  if (row?.has_attribution != null) return Boolean(row.has_attribution)
  return Boolean(
    String(row?.signup_referrer_domain || '').trim()
    || String(row?.signup_utm_source || '').trim()
    || String(row?.signup_utm_medium || '').trim()
    || String(row?.signup_utm_campaign || '').trim()
    || String(row?.signup_ref || '').trim()
    || String(row?.signup_landing_path || '').trim(),
  )
}


const sortCountEntries = (map, limit) => (
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key: String(key).slice(0, 200), count: Number(count) || 0 }))
)

function buildCrmAcquisitionSummary(rows) {
  const list = Array.isArray(rows) ? rows : []
  const refCounts = new Map()
  const landingCounts = new Map()
  const utmCounts = new Map()
  const utmSourceOnly = new Map()

  for (const r of list) {
    const ref = String(r.signup_referrer_domain || '').trim() || '(direct / unknown)'
    if (!isInternalReferrerDomain(ref)) {
      refCounts.set(ref, (refCounts.get(ref) || 0) + 1)
    }

    const land = String(r.signup_landing_path || '').trim() || '(unknown)'
    landingCounts.set(land, (landingCounts.get(land) || 0) + 1)

    const utmParts = [r.signup_utm_source, r.signup_utm_medium, r.signup_utm_campaign].filter(Boolean)
    const utmKey = utmParts.length ? utmParts.join(' · ') : '(no UTM)'
    utmCounts.set(utmKey, (utmCounts.get(utmKey) || 0) + 1)

    const srcOnly = String(r.signup_utm_source || '').trim() || '(none)'
    utmSourceOnly.set(srcOnly, (utmSourceOnly.get(srcOnly) || 0) + 1)
  }

  const today = new Date()
  const signupsByDayLast14 = []
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    signupsByDayLast14.push({ day: d.toISOString().slice(0, 10), count: 0 })
  }
  const dayIndex = new Map(signupsByDayLast14.map((x) => [x.day, x]))
  for (const r of list) {
    const raw = r.user_created_at
    if (!raw) continue
    const day = String(raw).slice(0, 10)
    const slot = dayIndex.get(day)
    if (slot) slot.count += 1
  }

  const totalRows = list.length
  const topReferrersSorted = sortCountEntries(refCounts, 15)
  const topRef0 = topReferrersSorted[0]
  const directRaw = refCounts.get('(direct / unknown)') || 0
  const topReferrerSharePct = totalRows && topRef0
    ? Math.round(((topRef0.count / totalRows) * 1000)) / 10
    : 0
  const directUnknownSharePct = totalRows
    ? Math.round(((directRaw / totalRows) * 1000)) / 10
    : 0

  let signupPeakDay = null
  let signupPeakCount = 0
  for (const d of signupsByDayLast14) {
    if (d.count > signupPeakCount) {
      signupPeakCount = d.count
      signupPeakDay = d.day
    }
  }
  const sum14 = signupsByDayLast14.reduce((acc, d) => acc + Number(d.count || 0), 0)
  const avgDailySignupsLast14 = Math.round((sum14 / 14) * 100) / 100
  const sumLast7 = signupsByDayLast14.slice(-7).reduce((acc, d) => acc + Number(d.count || 0), 0)

  const withUtm = list.filter((r) =>
    Boolean(String(r.signup_utm_source || '').trim()
      || String(r.signup_utm_medium || '').trim()
      || String(r.signup_utm_campaign || '').trim()),
  ).length
  const utmTaggedSharePct = totalRows
    ? Math.round(((withUtm / totalRows) * 1000)) / 10
    : 0
  const missingAttributionCount = list.filter((r) => !crmHasAttribution(r)).length
  const missingAttributionSharePct = totalRows
    ? Math.round(((missingAttributionCount / totalRows) * 1000)) / 10
    : 0

  return {
    rowCount: list.length,
    uniqueReferrerDomains: refCounts.size,
    uniqueLandingPaths: landingCounts.size,
    uniqueUtmCombinations: utmCounts.size,
    topReferrers: topReferrersSorted,
    topLandings: sortCountEntries(landingCounts, 15),
    topUtms: sortCountEntries(utmCounts, 15),
    topUtmSources: sortCountEntries(utmSourceOnly, 12),
    signupsByDayLast14,
    topReferrerSharePct,
    directUnknownSharePct,
    utmTaggedSharePct,
    missingAttributionCount,
    missingAttributionSharePct,
    signupPeakDay,
    signupPeakCount,
    avgDailySignupsLast14,
    signupsLast7Days: sumLast7,
  }
}

function escapeCsvCell(value) {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCrmCsv(rows, filenameBase = 'crm-users') {
  const list = Array.isArray(rows) ? rows : []
  const headers = [
    'user_created_at',
    'email',
    'email_confirmed_at',
    'last_sign_in_at',
    'display_name',
    'is_premium',
    'plan_tier',
    'crm_segment',
    'is_internal',
    'has_attribution',
    'signup_referrer_domain',
    'signup_utm_source',
    'signup_utm_medium',
    'signup_utm_campaign',
    'signup_ref',
    'signup_landing_path',
    'logged_in_within_7d',
    'has_search_7d',
    'has_product_view_7d',
    'has_watchlist_add_7d',
    'visited_premium_page',
    'premium_checkout_click',
    'page_views_30d',
    'sessions_30d',
    'last_seen_at',
  ]
  const lines = [headers.join(',')]
  for (const r of list) {
    const display = String(r.nickname || r.full_name || '').trim()
    lines.push([
      escapeCsvCell(r.user_created_at ? new Date(r.user_created_at).toISOString() : ''),
      escapeCsvCell(r.email),
      escapeCsvCell(r.email_confirmed_at ? new Date(r.email_confirmed_at).toISOString() : ''),
      escapeCsvCell(r.last_sign_in_at ? new Date(r.last_sign_in_at).toISOString() : ''),
      escapeCsvCell(display),
      escapeCsvCell(r.is_premium ? 'yes' : 'no'),
      escapeCsvCell(r.plan_tier),
      escapeCsvCell(crmUserSegment(r)),
      escapeCsvCell(isCrmInternalUser(r) ? 'yes' : 'no'),
      escapeCsvCell(crmHasAttribution(r) ? 'yes' : 'no'),
      escapeCsvCell(r.signup_referrer_domain),
      escapeCsvCell(r.signup_utm_source),
      escapeCsvCell(r.signup_utm_medium),
      escapeCsvCell(r.signup_utm_campaign),
      escapeCsvCell(r.signup_ref),
      escapeCsvCell(r.signup_landing_path),
      escapeCsvCell(r.logged_in_within_7d ? 'yes' : 'no'),
      escapeCsvCell(r.has_search_7d ? 'yes' : 'no'),
      escapeCsvCell(r.has_product_view_7d ? 'yes' : 'no'),
      escapeCsvCell(r.has_watchlist_add_7d ? 'yes' : 'no'),
      escapeCsvCell(r.visited_premium_page ? 'yes' : 'no'),
      escapeCsvCell(r.premium_checkout_click ? 'yes' : 'no'),
      escapeCsvCell(r.page_views_30d),
      escapeCsvCell(r.sessions_30d),
      escapeCsvCell(r.last_seen_at ? new Date(r.last_seen_at).toISOString() : ''),
    ].join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function buildAdminGrowthSnapshot({ dashboard, analytics, analyticsRangeDays }) {
  return {
    analyticsRangeDays,
    business: {
      dauToday: Number(dashboard?.dauToday || 0),
      signupsToday: Number(dashboard?.signupsToday || 0),
      openReports: Number(dashboard?.openReports || 0),
      saveSuccessRate: Number(dashboard?.saveSuccessRate || 0),
      totalProducts: Number(dashboard?.totalProducts || 0),
      activeProducts: Number(dashboard?.activeProducts || 0),
    },
    analyticsSummary: {
      dataSource: analytics?.dataSource || '',
      pageViews: Number(analytics?.pageViews || 0),
      uniqueSessionsPageView: Number(analytics?.uniqueSessionsPageView || 0),
      searches: Number(analytics?.searches || 0),
      uniqueSearchSessions: Number(analytics?.uniqueSearchSessions || 0),
      productClicks: Number(analytics?.productClicks || 0),
      uniqueProductClickSessions: Number(analytics?.uniqueProductClickSessions || 0),
      avgDwellMs: Number(analytics?.avgDwellMs || 0),
      medianDwellMs: Number(analytics?.medianDwellMs || 0),
      landingViews: Number(analytics?.landingViews || 0),
      uniqueLandingSessions: Number(analytics?.uniqueLandingSessions || 0),
    },
    topPages: (Array.isArray(analytics?.topPages) ? analytics.topPages : []).slice(0, 12).map((r) => ({
      path: r.page_path,
      views: Number(r.views || 0),
      unique_sessions: Number(r.unique_sessions || 0),
      avg_dwell_ms: Number(r.avg_dwell_ms || 0),
    })),
    topReferrers: filterExternalAnalyticsReferrers(analytics?.topReferrers).slice(0, 12),
    topCampaigns: (Array.isArray(analytics?.topCampaigns) ? analytics.topCampaigns : []).slice(0, 12),
    topSearches: (Array.isArray(analytics?.topSearches) ? analytics.topSearches : []).slice(0, 12),
    funnel: (Array.isArray(analytics?.funnel) ? analytics.funnel : []).slice(0, 14),
    activity: {
      rolling: analytics?.activity?.rolling || {},
      cohortSessions: analytics?.activity?.cohortSessions || {},
      attributionSignups: analytics?.activity?.attributionSignups || {},
      watchlist: analytics?.activity?.watchlist || {},
    },
  }
}

const ADMIN_TAB_VALID = new Set(['dashboard', 'operations', 'analytics', 'crm'])
const ADMIN_TAB_LEGACY = new Set(['insights'])

function resolveAdminTab(raw) {
  const t = String(raw || '').trim()
  if (ADMIN_TAB_LEGACY.has(t)) return 'dashboard'
  return ADMIN_TAB_VALID.has(t) ? t : 'dashboard'
}
const ADMIN_TAB_STORAGE_KEY = 'mm_admin_active_tab'
const ADMIN_ANALYTICS_SECTION_KEY = 'mm_admin_analytics_section'
const NEWS_MANUAL_DRAFT_KEY = 'mm_admin_news_manual_draft'
const INSIGHT_DRAFT_KEY = 'mm_admin_insight_draft'
const INSIGHTS_DEFAULT_READ_TIME = '5分'
/** かんたん入力：本文内で「テーゼ」と「根拠」を分ける区切り（プレーンテキスト時・1行） */
const INSIGHT_BODY_DELIM = INSIGHT_BODY_DELIM_PLAIN
const INSIGHT_CATEGORY_OPTIONS = [
  { value: 'インサイト', label: 'Insight' },
  { value: 'マーケット', label: 'Market' },
  { value: 'ETF分析', label: 'ETF analysis' },
]
/** ニュース画像と同じ公開バケット（`SUPABASE_SETUP_NEWS_IMAGES_STORAGE.sql`） */
const INSIGHT_COVER_IMAGE_BUCKET = 'news-images'

const buildDefaultInsightSimpleForm = () => ({
  headline: '',
  /** 公開URL `/insights/{slug}` — 英小文字・数字・ハイフンのみ */
  urlSlug: '',
  category: 'インサイト',
  target: '',
  summary: '',
  /** 一覧・記事ヒーロー用の公開画像URL（空なら非表示） */
  coverImageUrl: '',
  /** テーゼ＋任意で --- 行のあと根拠 */
  mainCombined: '',
  risk: '',
  dataNote: '',
  keywordsText: '',
  tickerEnabled: false,
  tickerRaw: '',
  relatedToolsText: '',
  publishedAt: new Date().toISOString().slice(0, 10),
  readTime: INSIGHTS_DEFAULT_READ_TIME,
  sortOrder: 0,
  featured: false,
  isActive: true,
})

const parseInsightTickerRaw = (raw = '') => String(raw || '')
  .split(/\r?\n/g)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [label, value, change, direction] = line.split('|').map((v) => String(v || '').trim())
    if (!label || !value) return null
    const dir = String(direction || '').toLowerCase()
    return {
      label,
      value,
      change: change || '',
      direction: dir === 'down' || dir === 'up' ? dir : (String(change || '').startsWith('-') ? 'down' : 'up'),
    }
  })
  .filter(Boolean)

const simpleToInsightForm = (simple) => {
  const base = buildDefaultInsightForm()
  const parsedData = simple?.tickerEnabled ? parseInsightTickerRaw(simple?.tickerRaw || '') : []
  const mainSrc = String(simple?.mainCombined ?? simple?.body ?? '').trim()
    ? String(simple?.mainCombined ?? simple?.body ?? '')
    : [String(simple?.body || ''), String(simple?.rationale || '')].filter(Boolean).join(INSIGHT_BODY_DELIM)
  const { idea, rationale } = splitInsightMainCombined(mainSrc)
  return {
    ...base,
    headline: String(simple?.headline || '').trim(),
    urlSlug: String(simple?.urlSlug ?? simple?.slug ?? '').trim(),
    category: String(simple?.category || '').trim() || base.category,
    target: String(simple?.target || '').trim(),
    summary: String(simple?.summary || '').trim(),
    idea,
    rationale,
    risk: String(simple?.risk || '').trim(),
    dataJson: JSON.stringify(parsedData, null, 2),
    dataNote: String(simple?.dataNote || '').trim(),
    keywordsText: String(simple?.keywordsText || '').trim(),
    relatedToolsText: String(simple?.relatedToolsText || '').trim(),
    publishedAt: toIsoDate(simple?.publishedAt),
    readTime: String(simple?.readTime || INSIGHTS_DEFAULT_READ_TIME).trim(),
    sortOrder: Number(simple?.sortOrder || 0),
    featured: Boolean(simple?.featured),
    isActive: simple?.isActive == null ? true : Boolean(simple?.isActive),
    coverImageUrl: String(simple?.coverImageUrl || '').trim(),
  }
}

const insightFormToSimple = (form) => {
  let rows = []
  try {
    const parsed = JSON.parse(String(form?.dataJson || '[]'))
    rows = Array.isArray(parsed) ? parsed : []
  } catch {
    rows = []
  }
  const tickerRaw = rows
    .map((r) => {
      const label = String(r?.label || r?.name || '').trim()
      const value = String(r?.value || '').trim()
      const change = String(r?.change || '').trim()
      const dir = String(r?.direction || '').trim()
      if (!label || !value) return null
      return `${label}|${value}|${change}|${dir || (change.startsWith('-') ? 'down' : 'up')}`
    })
    .filter(Boolean)
    .join('\n')

  const idea = String(form?.idea || '').trim()
  const rationale = String(form?.rationale || '').trim()
  const mainCombined = joinInsightMainCombined(idea, rationale)

  return {
    ...buildDefaultInsightSimpleForm(),
    headline: String(form?.headline || '').trim(),
    urlSlug: String(form?.urlSlug ?? '').trim(),
    category: String(form?.category || '').trim() || 'インサイト',
    target: String(form?.target || '').trim(),
    summary: String(form?.summary || '').trim(),
    mainCombined,
    risk: String(form?.risk || '').trim(),
    dataNote: String(form?.dataNote || '').trim(),
    keywordsText: String(form?.keywordsText || '').trim(),
    tickerEnabled: rows.length > 0,
    tickerRaw,
    relatedToolsText: String(form?.relatedToolsText || '').trim(),
    publishedAt: toIsoDate(form?.publishedAt),
    readTime: String(form?.readTime || INSIGHTS_DEFAULT_READ_TIME),
    sortOrder: Number(form?.sortOrder || 0),
    featured: Boolean(form?.featured),
    isActive: form?.isActive == null ? true : Boolean(form?.isActive),
    coverImageUrl: String(form?.coverImageUrl || '').trim(),
  }
}

const buildDefaultInsightForm = () => ({
  featured: false,
  target: '',
  category: 'インサイト',
  headline: '',
  urlSlug: '',
  summary: '',
  coverImageUrl: '',
  idea: '',
  rationale: '',
  dataJson: '[]',
  dataNote: '',
  risk: '',
  keywordsText: '',
  relatedToolsText: '',
  publishedAt: new Date().toISOString().slice(0, 10),
  readTime: INSIGHTS_DEFAULT_READ_TIME,
  sortOrder: 0,
  isActive: true,
})

const toIsoDate = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

const parseRelatedToolsText = (value) => (
  String(value || '')
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean)
)

/** `/insights/...` 用。URL・SEO・共有のため ASCII のみに正規化する */
function normalizeInsightUrlSlug(raw) {
  const s = String(raw || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96)
  return s
}

/** 見出しに英字が含まれる場合だけスラッグ候補を作る（日本語のみなら空） */
function latinSlugFromHeadline(headline) {
  const stripped = String(headline || '')
    .normalize('NFKC')
    .replace(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
  return stripped
}

function suggestAsciiInsightSlug(headline) {
  const fromLatin = latinSlugFromHeadline(headline)
  if (fromLatin.length >= 6) return fromLatin
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return `insight-${rand}`
}

function resolveInsightSlugForSave({ editingId, editingRowSlug, headline, manualSlug }) {
  const normalizedManual = normalizeInsightUrlSlug(manualSlug)
  if (normalizedManual) return normalizedManual
  const legacy = String(editingRowSlug || '').trim()
  if (editingId && legacy) return legacy
  return suggestAsciiInsightSlug(headline)
}

const buildInsightDocumentFromForm = (form) => {
  let tickerRows = []
  try {
    const parsed = JSON.parse(String(form?.dataJson || '[]'))
    tickerRows = Array.isArray(parsed) ? parsed : []
  } catch {
    tickerRows = []
  }

  const headline = String(form?.headline || '').trim() || 'インサイト'
  const summary = String(form?.summary || '').trim()
  let idea = String(form?.idea || '').trim()
  let rationale = String(form?.rationale || '').trim()
  if (isEmptyInsightBodyHtml(idea)) idea = ''
  if (isEmptyInsightBodyHtml(rationale)) rationale = ''
  const risk = String(form?.risk || '').trim()
  const dataNote = String(form?.dataNote || '').trim()
  const category = String(form?.category || '').trim() || '市場インサイト'
  const target = String(form?.target || '').trim()
  const readTime = String(form?.readTime || INSIGHTS_DEFAULT_READ_TIME).trim()
  const publishedAt = toIsoDate(form?.publishedAt)
  const relatedTools = parseRelatedToolsText(form?.relatedToolsText)
  const keywords = parseInsightKeywordsText(form?.keywordsText)
  const coverImageUrl = String(form?.coverImageUrl || '').trim()
  const categoryKey = /マーケット|market/i.test(category)
    ? 'market'
    : /etf|投資信託/i.test(category)
      ? 'etf'
      : 'editorial'
  const proseKicker = categoryKey === 'market'
    ? '// MARKET BRIEF'
    : categoryKey === 'etf'
      ? '// ETF ANALYSIS'
      : '// MARKET INSIGHT'

  const sections = [
    {
      type: 'prose',
      kicker: proseKicker,
      title: headline,
      lead: summary,
      paragraphs: [idea, rationale].filter(Boolean),
    },
  ]

  if (dataNote) {
    sections.push({
      type: 'callout',
      variant: 'insight',
      title: 'データ注記',
      body: dataNote,
    })
  }

  if (risk) {
    sections.push({
      type: 'callout',
      variant: 'warn',
      title: 'リスク',
      body: risk,
    })
  }

  const hero = {
    badge: `${category}${target ? ` — ${target}` : ''}`,
    titleLines: [[{ text: headline }]],
    sub: summary || '市場インサイト',
    meta: ['By MoneyMart', publishedAt, readTime],
  }
  if (categoryKey === 'market') hero.bgFigure = 'MARKET'
  if (categoryKey === 'etf') hero.bgFigure = 'ETF'
  if (coverImageUrl) hero.coverImageUrl = coverImageUrl

  return {
    hero,
    ticker: tickerRows
      .map((item) => {
        const label = String(item?.label || item?.name || '').trim()
        const value = String(item?.value || '').trim()
        const change = String(item?.change || '').trim()
        const direction = String(item?.direction || '').toLowerCase()
        if (!label || !value) return null
        const up = direction === 'down' ? false : !change.startsWith('-')
        return { label, value, change, up }
      })
      .filter(Boolean),
    sections,
    admin: {
      category,
      target,
      relatedTools,
      keywords,
      featured: Boolean(form?.featured),
      sortOrder: Number(form?.sortOrder || 0),
      coverImageUrl,
    },
    footer: {
      disclaimer:
        '※本ページは情報提供を目的としたものであり、特定の金融商品の売買を勧誘するものではありません。投資判断はご自身の責任において行ってください。',
    },
  }
}

const mapInsightArticleRowForEditor = (row) => {
  const doc = row?.document && typeof row.document === 'object' ? row.document : {}
  const hero = doc?.hero || {}
  const admin = doc?.admin && typeof doc.admin === 'object' ? doc.admin : {}
  const kwArr = Array.isArray(admin?.keywords)
    ? admin.keywords.map((k) => String(k || '').trim()).filter(Boolean)
    : []
  const keywordsText = kwArr.length ? kwArr.join('、') : ''
  const prose = Array.isArray(doc?.sections) ? doc.sections.find((s) => s?.type === 'prose') : null
  const sections = Array.isArray(doc?.sections) ? doc.sections : []
  const calloutNote = sections.find((s) => s?.type === 'callout' && s?.title === 'データ注記')
  const calloutRisk = sections.find((s) => s?.type === 'callout' && s?.title === 'リスク')

  const heroMeta = Array.isArray(hero?.meta) ? hero.meta : []
  const readTimeFromMeta = String(heroMeta?.[2] || '').trim()
  const heroTitleFirstLine = Array.isArray(hero?.titleLines?.[0]) ? hero.titleLines[0] : []
  const heroTitleText = heroTitleFirstLine.map((item) => String(item?.text || '')).join('').trim()

  const tickerRows = Array.isArray(doc?.ticker)
    ? doc.ticker
      .map((t) => ({
        label: String(t?.label || '').trim(),
        value: String(t?.value || '').trim(),
        change: String(t?.change || '').trim(),
        direction: t?.up === false ? 'down' : 'up',
      }))
      .filter((t) => t.label && t.value)
    : []

  return {
    id: row.id,
    slug: String(row.slug || ''),
    featured: Boolean(admin?.featured),
    target: String(admin?.target || '').trim(),
    category: String(admin?.category || '').trim() || 'インサイト',
    headline: heroTitleText || String(row.page_title || '').trim(),
    summary: String(hero?.sub || prose?.lead || '').trim(),
    idea: Array.isArray(prose?.paragraphs) ? String(prose.paragraphs[0] || '').trim() : '',
    rationale: Array.isArray(prose?.paragraphs) ? String(prose.paragraphs[1] || '').trim() : '',
    data: tickerRows,
    data_note: String(calloutNote?.body || '').trim(),
    risk: String(calloutRisk?.body || '').trim(),
    related_tools: Array.isArray(admin?.relatedTools) ? admin.relatedTools : [],
    keywords_text: keywordsText,
    published_at: row.published_at || null,
    read_time: readTimeFromMeta || INSIGHTS_DEFAULT_READ_TIME,
    sort_order: Number(admin?.sortOrder || 0),
    is_active: Boolean(row.is_published),
    updated_at: row.updated_at || null,
    coverImageUrl: String(admin?.coverImageUrl || '').trim(),
  }
}

const loadNewsManualDraft = () => {
  try {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(NEWS_MANUAL_DRAFT_KEY) : null
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const today = new Date().toISOString().slice(0, 10)
    return {
      title: String(parsed.title || '').trim(),
      publishedAt: parsed.publishedAt || today,
      content: String(parsed.content || '').trim(),
      imageUrl: String(parsed.imageUrl || '').trim(),
      linkUrl: String(parsed.linkUrl || parsed.url || '').trim(),
    }
  } catch {
    return null
  }
}

const loadInsightDraft = () => {
  try {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(INSIGHT_DRAFT_KEY) : null
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const form = parsed?.form && typeof parsed.form === 'object' ? parsed.form : null
    if (!form) return null
    return {
      editingInsightId: parsed?.editingInsightId ?? null,
      form: {
        ...buildDefaultInsightForm(),
        ...form,
        featured: Boolean(form.featured),
        isActive: form.isActive == null ? true : Boolean(form.isActive),
        sortOrder: Number(form.sortOrder || 0),
        publishedAt: toIsoDate(form.publishedAt),
        readTime: String(form.readTime || INSIGHTS_DEFAULT_READ_TIME),
        dataJson: String(form.dataJson || '[]'),
      },
      insightEditorMode: parsed?.insightEditorMode === 'json' ? 'json' : 'simple',
      insightJsonDraft: typeof parsed?.insightJsonDraft === 'string' ? parsed.insightJsonDraft : null,
    }
  } catch {
    return null
  }
}

/** AdminPage マウント時のインサイト編集 state 初期値（下書き 1 回読み） */
const readInsightDraftInitial = () => {
  const draft = loadInsightDraft()
  if (!draft) {
    const form = buildDefaultInsightForm()
    return {
      editingInsightId: null,
      insightForm: form,
      insightEditorMode: 'simple',
      insightSimpleForm: insightFormToSimple(form),
      insightJsonDraft: JSON.stringify(form, null, 2),
    }
  }
  const { form } = draft
  const mode = draft.insightEditorMode === 'json' ? 'json' : 'simple'
  const jsonDraft =
    mode === 'json' && draft.insightJsonDraft != null
      ? draft.insightJsonDraft
      : JSON.stringify(form, null, 2)
  const id = draft.editingInsightId
  return {
    editingInsightId: id == null || id === '' ? null : String(id),
    insightForm: form,
    insightEditorMode: mode,
    insightSimpleForm: insightFormToSimple(form),
    insightJsonDraft: jsonDraft,
  }
}

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const tabFromStorage = (() => {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem(ADMIN_TAB_STORAGE_KEY) : null
    } catch { return null }
  })()
  const resolvedTab = tabFromUrl || tabFromStorage || 'dashboard'
  const initialTab = resolveAdminTab(resolvedTab)
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    let stored = null
    try {
      stored = sessionStorage.getItem(ADMIN_TAB_STORAGE_KEY)
    } catch { /* ignore */ }
    const rawTab = searchParams.get('tab')
    const t = rawTab || stored || 'dashboard'
    const validTab = resolveAdminTab(t)
    setActiveTab((prev) => (prev === validTab ? prev : validTab))
    if (rawTab && rawTab !== validTab) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', validTab)
        return next
      }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    try {
      sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, tab)
    } catch { /* ignore */ }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    })
  }
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [dashboard, setDashboard] = useState({
    totalProducts: 0,
    activeProducts: 0,
    academyCourses: 0,
    openReports: 0,
    dauToday: 0,
    dauHasRow: false,
    dauMetricDate: null,
    signupsToday: 0,
    saveSuccessRate: 0,
    latestStockDate: null,
    latestFundDate: null,
    daily: [],
  })
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState(30)
  const analyticsLoadGenRef = useRef(0)
  const [showAdvancedOperations, setShowAdvancedOperations] = useState(false)
  const [analyticsSection, setAnalyticsSectionState] = useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(ADMIN_ANALYTICS_SECTION_KEY) : null
      if (raw === 'product' || raw === 'users' || raw === 'traffic') return raw
    } catch { /* ignore */ }
    return 'traffic'
  })
  const setAnalyticsSection = (next) => {
    setAnalyticsSectionState(next)
    try {
      window.sessionStorage.setItem(ADMIN_ANALYTICS_SECTION_KEY, next)
    } catch { /* ignore */ }
  }
  const [analytics, setAnalytics] = useState({
    dataSource: 'rpc',
    pageViews: 0,
    uniqueSessionsPageView: 0,
    productClicks: 0,
    uniqueProductClickSessions: 0,
    searches: 0,
    uniqueSearchSessions: 0,
    landingViews: 0,
    uniqueLandingSessions: 0,
    avgDwellMs: 0,
    medianDwellMs: 0,
    summaryPrev: null,
    topPages: [],
    topProducts: [],
    topSearches: [],
    topReferrers: [],
    topCampaigns: [],
    funnel: [],
    dailyTrend: [],
    eventBreakdown: [],
    engagement: [],
    activity: emptyAnalyticsActivity(),
    rangeDays: null,
    metaSince: null,
  })
  const productDashboard = useMemo(() => buildProductDashboardRollups(analytics), [analytics])
  const analyticsSourceBadge = useMemo(
    () => analyticsDataSourceBadge({
      loading: analyticsLoading,
      error: analyticsError,
      dataSource: analytics.dataSource,
    }),
    [analyticsLoading, analyticsError, analytics.dataSource],
  )
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmError, setCrmError] = useState('')
  const [crmRows, setCrmRows] = useState([])
  const [crmRangeDays, setCrmRangeDays] = useState(30)
  const [crmTraffic, setCrmTraffic] = useState(emptyCrmTraffic())
  const [crmTrafficLoading, setCrmTrafficLoading] = useState(false)
  const [crmTrafficError, setCrmTrafficError] = useState('')
  const [crmAiLoading, setCrmAiLoading] = useState(false)
  const [crmAiError, setCrmAiError] = useState('')
  const [crmAiResult, setCrmAiResult] = useState(null)
  const [crmAiGeneratedAt, setCrmAiGeneratedAt] = useState(null)
  const [crmAudience, setCrmAudience] = useState(emptyCrmAudience())
  const [crmAudienceLoading, setCrmAudienceLoading] = useState(false)
  const [crmAudienceError, setCrmAudienceError] = useState('')
  const [formData, setFormData] = useState({
    category: 'cards',
    name: '',
    link: '',
    description: '',
    spec: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [reports, setReports] = useState([])
  const [reportStatusFilter, setReportStatusFilter] = useState('submitted')
  const [reportLoading, setReportLoading] = useState(false)
  const [academyForm, setAcademyForm] = useState({
    title: '',
    youtubeUrl: '',
    categoryKey: 'general',
    level: '初級',
    isFeatured: false,
  })
  const [academyLoading, setAcademyLoading] = useState(false)
  const [academyMessage, setAcademyMessage] = useState(null)
  const [products, setProducts] = useState([])
  const [productLoading, setProductLoading] = useState(false)
  const [productMessage, setProductMessage] = useState(null)
  const [editingProductId, setEditingProductId] = useState(null)
  const [editProductForm, setEditProductForm] = useState({
    category: 'cards',
    name: '',
    link: '',
    description: '',
    spec: '',
  })
  const [earningsRows, setEarningsRows] = useState([])
  const [earningsLoading, setEarningsLoading] = useState(false)
  const [earningsMessage, setEarningsMessage] = useState(null)
  const [digestRefreshLoading, setDigestRefreshLoading] = useState(false)
  const [digestRefreshMessage, setDigestRefreshMessage] = useState(null)
  const [dividendMasterRows, setDividendMasterRows] = useState([])
  const [dividendMasterLoading, setDividendMasterLoading] = useState(false)
  const [dividendMasterMessage, setDividendMasterMessage] = useState(null)
  const [dividendMasterForm, setDividendMasterForm] = useState({
    stock_id: '',
    asset_kind: 'us_stock',
    dividend_month: 3,
    calendar_year: '',
    name_hint: '',
    notes: '',
  })
  const [editingDividendMasterId, setEditingDividendMasterId] = useState(null)
  const [newsLastUpdatedAt, setNewsLastUpdatedAt] = useState('')
  const [newsPageManualRows, setNewsPageManualRows] = useState([])
  const [newsPageManualLoading, setNewsPageManualLoading] = useState(false)
  const [newsPageManualMessage, setNewsPageManualMessage] = useState(null)
  const [editingNewsPageManualId, setEditingNewsPageManualId] = useState(null)
  const [marketMajorNewsRows, setMarketMajorNewsRows] = useState([])
  const [marketMajorNewsLoading, setMarketMajorNewsLoading] = useState(false)
  const [marketMajorNewsMessage, setMarketMajorNewsMessage] = useState(null)
  const [editingMarketMajorNewsId, setEditingMarketMajorNewsId] = useState(null)
  const [insightsRows, setInsightsRows] = useState([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsMessage, setInsightsMessage] = useState(null)
  const [editingInsightId, setEditingInsightId] = useState(() => readInsightDraftInitial().editingInsightId)
  const [insightForm, setInsightForm] = useState(() => readInsightDraftInitial().insightForm)
  const [insightEditorMode, setInsightEditorMode] = useState(() => readInsightDraftInitial().insightEditorMode)
  const [insightSimpleForm, setInsightSimpleForm] = useState(() => readInsightDraftInitial().insightSimpleForm)
  const [insightJsonDraft, setInsightJsonDraft] = useState(() => readInsightDraftInitial().insightJsonDraft)
  const [insightCoverUploading, setInsightCoverUploading] = useState(false)
  const [newsPageManualForm, setNewsPageManualForm] = useState(() => {
    const draft = loadNewsManualDraft()
    if (draft && (draft.title || draft.content)) {
      return draft
    }
    return { title: '', publishedAt: new Date().toISOString().slice(0, 10), content: '', imageUrl: '', linkUrl: '' }
  })
  const [newsPageManualImageFile, setNewsPageManualImageFile] = useState(null)
  const [marketMajorNewsForm, setMarketMajorNewsForm] = useState({
    section: 'market_major_event',
    marketRegion: 'global',
    title: '',
    publishedAt: new Date().toISOString().slice(0, 10),
    content: '',
    sortOrder: 0,
    isActive: true,
  })
  const [editingEarningsId, setEditingEarningsId] = useState(null)
  const [earningsForm, setEarningsForm] = useState({
    region: 'US',
    symbol: '',
    company: '',
    whenText: '',
    phase: '',
    sortOrder: 0,
    isActive: true,
  })
  const [refinanceRows, setRefinanceRows] = useState([])
  const [refinanceLoading, setRefinanceLoading] = useState(false)
  const [refinanceMessage, setRefinanceMessage] = useState(null)
  const [editingRefinanceId, setEditingRefinanceId] = useState(null)
  const [missingDataList, setMissingDataList] = useState([])
  const [missingDataLoading, setMissingDataLoading] = useState(false)
  const [missingDataError, setMissingDataError] = useState('')
  const [missingDataLoaded, setMissingDataLoaded] = useState(false)
  const [refinanceForm, setRefinanceForm] = useState({
    bankName: '',
    productName: '',
    aprMin: '2.500',
    aprMax: '5.900',
    feesYen: '0',
    minAmountYen: '100000',
    maxAmountYen: '10000000',
    applyUrl: '',
    sourceType: 'manual',
    notes: '',
    sortOrder: 0,
    isActive: true,
  })

  useEffect(() => {
    if (editingNewsPageManualId) return
    const t = newsPageManualForm.title?.trim() || newsPageManualForm.content?.trim()
    if (!t) {
      try { sessionStorage.removeItem(NEWS_MANUAL_DRAFT_KEY) } catch { /* ignore */ }
      return
    }
    try {
      sessionStorage.setItem(NEWS_MANUAL_DRAFT_KEY, JSON.stringify(newsPageManualForm))
    } catch { /* ignore */ }
  }, [newsPageManualForm, editingNewsPageManualId])

  useEffect(() => {
    let persistForm = insightForm
    if (insightEditorMode === 'simple') {
      persistForm = simpleToInsightForm(insightSimpleForm)
    } else if (insightEditorMode === 'json') {
      try {
        persistForm = { ...buildDefaultInsightForm(), ...JSON.parse(String(insightJsonDraft || '{}')) }
      } catch {
        persistForm = insightForm
      }
    }
    const jsonLooksEdited = insightEditorMode === 'json' && String(insightJsonDraft || '').trim().length > 0
    const hasDraftContent = jsonLooksEdited || [
      persistForm.headline,
      persistForm.summary,
      persistForm.idea,
      persistForm.rationale,
      persistForm.dataNote,
      persistForm.risk,
      persistForm.keywordsText,
      persistForm.relatedToolsText,
      persistForm.target,
      persistForm.coverImageUrl,
    ].some((v) => String(v || '').trim().length > 0) || String(persistForm.dataJson || '').trim() !== '[]'
    if (!hasDraftContent && !editingInsightId) {
      try { sessionStorage.removeItem(INSIGHT_DRAFT_KEY) } catch { /* ignore */ }
      return
    }
    try {
      sessionStorage.setItem(
        INSIGHT_DRAFT_KEY,
        JSON.stringify({
          editingInsightId,
          form: persistForm,
          insightEditorMode,
          insightJsonDraft: insightEditorMode === 'json' ? insightJsonDraft : undefined,
          savedAt: Date.now(),
        })
      )
    } catch { /* ignore */ }
  }, [insightForm, insightSimpleForm, insightJsonDraft, insightEditorMode, editingInsightId])

  const loadProducts = async () => {
    setProductLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, category, name, link, description, spec, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      setProductMessage({ type: 'error', text: err.message || 'Failed to load products.' })
    } finally {
      setProductLoading(false)
    }
  }

  const loadEarnings = async () => {
    setEarningsLoading(true)
    try {
      const { data, error } = await supabase
        .from('earnings_calendar_manual')
        .select('id, region, symbol, company, when_text, phase, sort_order, is_active, updated_at')
        .order('region', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('symbol', { ascending: true })
      if (error) throw error
      setEarningsRows(data || [])
    } catch (err) {
      setEarningsMessage({ type: 'error', text: err.message || 'Failed to load earnings calendar.' })
    } finally {
      setEarningsLoading(false)
    }
  }

  const resetEarningsForm = () => {
    setEditingEarningsId(null)
    setEarningsForm({
      region: 'US',
      symbol: '',
      company: '',
      whenText: '',
      phase: '',
      sortOrder: 0,
      isActive: true,
    })
  }

  const handleEarningsFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setEarningsForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSaveEarnings = async (e) => {
    e.preventDefault()
    setEarningsMessage(null)
    const payload = {
      region: String(earningsForm.region || 'US').toUpperCase(),
      symbol: String(earningsForm.symbol || '').trim().toUpperCase(),
      company: String(earningsForm.company || '').trim(),
      when_text: String(earningsForm.whenText || '').trim(),
      phase: String(earningsForm.phase || '').trim() || null,
      sort_order: Number(earningsForm.sortOrder || 0),
      is_active: Boolean(earningsForm.isActive),
    }
    if (!payload.symbol || !payload.company || !payload.when_text) {
      setEarningsMessage({ type: 'error', text: 'Region, Symbol, Company, When are required.' })
      return
    }
    try {
      if (editingEarningsId) {
        const { error } = await supabase
          .from('earnings_calendar_manual')
          .update(payload)
          .eq('id', editingEarningsId)
        if (error) throw error
        setEarningsMessage({ type: 'success', text: 'Earnings row updated.' })
      } else {
        const { error } = await supabase
          .from('earnings_calendar_manual')
          .insert([payload])
        if (error) throw error
        setEarningsMessage({ type: 'success', text: 'Earnings row created.' })
      }
      resetEarningsForm()
      loadEarnings()
    } catch (err) {
      setEarningsMessage({ type: 'error', text: err.message || 'Failed to save earnings row.' })
    }
  }

  const handleStartEditEarnings = (row) => {
    setEditingEarningsId(row.id)
    setEarningsForm({
      region: row.region || 'US',
      symbol: row.symbol || '',
      company: row.company || '',
      whenText: row.when_text || '',
      phase: row.phase || '',
      sortOrder: Number(row.sort_order || 0),
      isActive: Boolean(row.is_active),
    })
  }

  const handleDeleteEarnings = async (id) => {
    setEarningsMessage(null)
    try {
      const { error } = await supabase
        .from('earnings_calendar_manual')
        .delete()
        .eq('id', id)
      if (error) throw error
      if (editingEarningsId === id) resetEarningsForm()
      setEarningsMessage({ type: 'success', text: 'Earnings row deleted.' })
      loadEarnings()
    } catch (err) {
      setEarningsMessage({ type: 'error', text: err.message || 'Failed to delete earnings row.' })
    }
  }

  const loadNewsUpdatedAt = async () => {
    try {
      const { data, error } = await supabase
        .from('news_manual')
        .select('updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
      if (error) throw error
      setNewsLastUpdatedAt(data?.[0]?.updated_at || '')
    } catch {
      setNewsLastUpdatedAt('')
    }
  }

  const handleRefreshDigest = async () => {
    setDigestRefreshLoading(true)
    setDigestRefreshMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const resp = await fetch('/api/cron/lounge-digest', {
        method: 'POST',
        headers,
      })
      const raw = await resp.text()
      let json = null
      try {
        json = raw ? JSON.parse(raw) : null
      } catch {
        json = null
      }
      if (!resp.ok) {
        if (resp.status === 404) {
          throw new Error('Digest API not found. Restart the dev server.')
        }
        throw new Error(json?.error || `Failed to refresh digest (HTTP ${resp.status})`)
      }
      if (!json?.ok) throw new Error(json?.error || 'Failed to refresh digest.')
      setDigestRefreshMessage({
        type: 'success',
        text: `Digest updated (${json.slot === 'pm' ? 'PM' : 'AM'} slot)`,
      })
    } catch (err) {
      setDigestRefreshMessage({ type: 'error', text: err.message || 'Failed to refresh digest.' })
    } finally {
      setDigestRefreshLoading(false)
    }
  }

  
  const loadNewsPageManual = async () => {
    setNewsPageManualLoading(true)
    try {
      const { data, error } = await supabase
        .from('news_manual')
        .select('id,title,description,published_at,source,sort_order,is_active,updated_at,image_url,url')
        .eq('bucket', 'news_page_manual')
        .order('published_at', { ascending: false })
        .order('sort_order', { ascending: true })
      if (error) throw error
      setNewsPageManualRows(data || [])
    } catch (err) {
      setNewsPageManualMessage({ type: 'error', text: err?.message || 'Failed to load manual news.' })
    } finally {
      setNewsPageManualLoading(false)
    }
  }

  const loadMarketMajorNewsManual = async () => {
    setMarketMajorNewsLoading(true)
    try {
      const { data, error } = await supabase
        .from('news_manual')
        .select('id,bucket,title,description,published_at,source,sort_order,is_active,updated_at,market_region')
        .in('bucket', ['market_major_event', 'market_weekly_summary'])
        .order('bucket', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false })
      if (error) throw error
      setMarketMajorNewsRows(data || [])
    } catch (err) {
      setMarketMajorNewsMessage({ type: 'error', text: err?.message || 'Failed to load market major news.' })
    } finally {
      setMarketMajorNewsLoading(false)
    }
  }

  const loadDividendMaster = async () => {
    setDividendMasterLoading(true)
    setDividendMasterMessage(null)
    try {
      const rows = await fetchDividendMasterSchedule()
      setDividendMasterRows(rows)
    } catch (err) {
      const msg = String(err?.message || err || '')
      setDividendMasterMessage({
        type: 'error',
        text: msg.includes('dividend_master_schedule') || msg.includes('schema cache')
          ? 'Table missing. Run `SUPABASE_SETUP_DIVIDEND_MASTER_SCHEDULE.sql` in Supabase.'
          : msg,
      })
      setDividendMasterRows([])
    } finally {
      setDividendMasterLoading(false)
    }
  }

  const resetInsightForm = () => {
    setEditingInsightId(null)
    const fresh = buildDefaultInsightForm()
    setInsightForm(fresh)
    setInsightSimpleForm(insightFormToSimple(fresh))
    setInsightJsonDraft(JSON.stringify(fresh, null, 2))
    setInsightEditorMode('simple')
    try { sessionStorage.removeItem(INSIGHT_DRAFT_KEY) } catch { /* ignore */ }
  }

  const handleInsightCoverFileChange = async (e) => {
    const input = e?.target
    const file = input?.files?.[0]
    if (input) input.value = ''
    if (!file?.type?.startsWith('image/')) {
      if (file) setInsightsMessage({ type: 'error', text: 'Choose an image file (JPEG, PNG, WebP, etc.).' })
      return
    }
    setInsightCoverUploading(true)
    setInsightsMessage(null)
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser()
      if (authErr || !auth?.user) {
        setInsightsMessage({ type: 'error', text: 'Login required to upload to Storage.' })
        return
      }
      const rawExt = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(rawExt) ? rawExt : 'jpg'
      const path = `insights/covers/${auth.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`
      const { data, error } = await supabase.storage.from(INSIGHT_COVER_IMAGE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw error
      const { data: urlData } = supabase.storage.from(INSIGHT_COVER_IMAGE_BUCKET).getPublicUrl(data.path)
      const url = String(urlData?.publicUrl || '').trim()
      if (!url) throw new Error('Could not get public URL')
      setInsightSimpleForm((p) => ({ ...p, coverImageUrl: url }))
      setInsightForm((p) => ({ ...p, coverImageUrl: url }))
      if (insightEditorMode === 'json') {
        try {
          const merged = { ...buildDefaultInsightForm(), ...JSON.parse(String(insightJsonDraft || '{}')) }
          merged.coverImageUrl = url
          setInsightJsonDraft(JSON.stringify(merged, null, 2))
        } catch {
          /* keep JSON draft as-is */
        }
      }
      setInsightsMessage({ type: 'success', text: 'Cover image uploaded. Click Create/Update to save.' })
    } catch (err) {
      setInsightsMessage({ type: 'error', text: err?.message || 'Upload failed.' })
    } finally {
      setInsightCoverUploading(false)
    }
  }

  const loadInsights = async () => {
    setInsightsLoading(true)
    try {
      const { data, error } = await supabase
        .from('insight_articles')
        .select('id,slug,page_title,document,is_published,published_at,updated_at,created_at')
        .order('published_at', { ascending: false })
        .order('updated_at', { ascending: false })
      if (error) throw error
      setInsightsRows((data || []).map(mapInsightArticleRowForEditor))
    } catch (err) {
      setInsightsMessage({ type: 'error', text: err?.message || 'Failed to load insights.' })
    } finally {
      setInsightsLoading(false)
    }
  }

  const saveInsight = async () => {
    setInsightsMessage(null)

    let workingForm = insightForm
    if (insightEditorMode === 'simple') {
      workingForm = simpleToInsightForm(insightSimpleForm)
      setInsightForm(workingForm)
      setInsightJsonDraft(JSON.stringify(workingForm, null, 2))
    } else {
      try {
        const parsed = JSON.parse(String(insightJsonDraft || '{}'))
        workingForm = {
          ...buildDefaultInsightForm(),
          ...parsed,
        }
        setInsightForm(workingForm)
      } catch {
        setInsightsMessage({ type: 'error', text: 'Invalid JSON. Check the JSON format.' })
        return
      }
    }

    const headline = String(workingForm.headline || '').trim()
    const summary = String(workingForm.summary || '').trim()
    if (!headline || !summary) {
      setInsightsMessage({ type: 'error', text: 'Headline and summary are required.' })
      return
    }

    const editingRow = insightsRows.find((row) => String(row?.id) === String(editingInsightId))
    const slug = resolveInsightSlugForSave({
      editingId: editingInsightId,
      editingRowSlug: editingRow?.slug,
      headline,
      manualSlug: workingForm.urlSlug,
    })
    const payload = {
      slug,
      page_title: headline,
      document: buildInsightDocumentFromForm(workingForm),
      is_published: Boolean(workingForm.isActive),
      published_at: workingForm.isActive ? publishedAtNoonTokyoFromDateOnly(toIsoDate(workingForm.publishedAt)) : null,
    }

    try {
      if (editingInsightId) {
        const { error } = await supabase.from('insight_articles').update(payload).eq('id', editingInsightId)
        if (error) throw error
        setInsightsMessage({ type: 'success', text: 'Insight updated.' })
      } else {
        const { error } = await supabase.from('insight_articles').insert([payload])
        if (error) throw error
        setInsightsMessage({ type: 'success', text: 'Insight created.' })
      }
      resetInsightForm()
      loadInsights()
    } catch (err) {
      const msg = String(err?.message || err || '')
      if (/duplicate key|unique constraint|23505/i.test(msg)) {
        setInsightsMessage({ type: 'error', text: 'This URL slug is already in use. Choose another ASCII slug.' })
        return
      }
      setInsightsMessage({ type: 'error', text: msg || 'Failed to save insight.' })
    }
  }

  const editInsight = (row) => {
    if (!row) return
    setEditingInsightId(String(row.id))
    const nextForm = {
      featured: Boolean(row.featured),
      target: String(row.target || ''),
      category: String(row.category || ''),
      headline: String(row.headline || ''),
      urlSlug: String(row.slug || ''),
      summary: String(row.summary || ''),
      idea: String(row.idea || ''),
      rationale: String(row.rationale || ''),
      dataJson: JSON.stringify(Array.isArray(row.data) ? row.data : [], null, 2),
      dataNote: String(row.data_note || ''),
      risk: String(row.risk || ''),
      keywordsText: String(row.keywords_text || ''),
      relatedToolsText: Array.isArray(row.related_tools) ? row.related_tools.join('\n') : '',
      publishedAt: toIsoDate(row.published_at),
      readTime: String(row.read_time || INSIGHTS_DEFAULT_READ_TIME),
      sortOrder: Number(row.sort_order || 0),
      isActive: Boolean(row.is_active),
      coverImageUrl: String(row.coverImageUrl || '').trim(),
    }
    setInsightForm(nextForm)
    setInsightSimpleForm(insightFormToSimple(nextForm))
    setInsightJsonDraft(JSON.stringify(nextForm, null, 2))
    setInsightEditorMode('simple')
  }

  const deleteInsight = async (id) => {
    setInsightsMessage(null)
    try {
      const { error } = await supabase.from('insight_articles').delete().eq('id', id)
      if (error) throw error
      if (String(editingInsightId) === String(id)) resetInsightForm()
      setInsightsMessage({ type: 'success', text: 'Insight deleted.' })
      loadInsights()
    } catch (err) {
      setInsightsMessage({ type: 'error', text: err?.message || 'Failed to delete insight.' })
    }
  }

  const loadRefinanceProducts = async () => {
    setRefinanceLoading(true)
    try {
      const { data, error } = await supabase
        .from('loan_refinance_products')
        .select('id,bank_name,product_name,apr_min,apr_max,fees_yen,min_amount_yen,max_amount_yen,apply_url,source_type,notes,sort_order,is_active,updated_at')
        .order('apr_min', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false })
      if (error) throw error
      setRefinanceRows(data || [])
    } catch (err) {
      setRefinanceMessage({ type: 'error', text: err.message || 'Failed to load refinance products.' })
    } finally {
      setRefinanceLoading(false)
    }
  }

  const resetRefinanceForm = () => {
    setEditingRefinanceId(null)
    setRefinanceForm({
      bankName: '',
      productName: '',
      aprMin: '2.500',
      aprMax: '5.900',
      feesYen: '0',
      minAmountYen: '100000',
      maxAmountYen: '10000000',
      applyUrl: '',
      sourceType: 'manual',
      notes: '',
      sortOrder: 0,
      isActive: true,
    })
  }

  const handleRefinanceFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setRefinanceForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSaveRefinance = async (e) => {
    e.preventDefault()
    setRefinanceMessage(null)
    const payload = {
      bank_name: String(refinanceForm.bankName || '').trim(),
      product_name: String(refinanceForm.productName || '').trim(),
      apr_min: Number(refinanceForm.aprMin || 0),
      apr_max: Number(refinanceForm.aprMax || 0),
      fees_yen: Math.max(0, Number(refinanceForm.feesYen || 0)),
      min_amount_yen: Math.max(0, Number(refinanceForm.minAmountYen || 0)),
      max_amount_yen: Math.max(0, Number(refinanceForm.maxAmountYen || 0)),
      apply_url: String(refinanceForm.applyUrl || '').trim(),
      source_type: String(refinanceForm.sourceType || 'manual').trim().toLowerCase() === 'scrape' ? 'scrape' : 'manual',
      notes: String(refinanceForm.notes || '').trim(),
      sort_order: Number(refinanceForm.sortOrder || 0),
      is_active: Boolean(refinanceForm.isActive),
      updated_at: new Date().toISOString(),
    }
    if (!payload.bank_name || !payload.product_name) {
      setRefinanceMessage({ type: 'error', text: 'Bank name and product name are required.' })
      return
    }
    if (!Number.isFinite(payload.apr_min) || !Number.isFinite(payload.apr_max) || payload.apr_min < 0 || payload.apr_max < payload.apr_min) {
      setRefinanceMessage({ type: 'error', text: 'APR min/max values are invalid.' })
      return
    }
    if (payload.apply_url && !/^https?:\/\//i.test(payload.apply_url)) {
      setRefinanceMessage({ type: 'error', text: 'Apply URL must start with http:// or https://.' })
      return
    }
    try {
      if (editingRefinanceId) {
        const { error } = await supabase
          .from('loan_refinance_products')
          .update(payload)
          .eq('id', editingRefinanceId)
        if (error) throw error
        setRefinanceMessage({ type: 'success', text: 'Refinance product updated.' })
      } else {
        const { error } = await supabase
          .from('loan_refinance_products')
          .insert([payload])
        if (error) throw error
        setRefinanceMessage({ type: 'success', text: 'Refinance product created.' })
      }
      resetRefinanceForm()
      await loadRefinanceProducts()
    } catch (err) {
      setRefinanceMessage({ type: 'error', text: err.message || 'Failed to save refinance product.' })
    }
  }

  const handleStartEditRefinance = (row) => {
    setEditingRefinanceId(row.id)
    setRefinanceForm({
      bankName: row.bank_name || '',
      productName: row.product_name || '',
      aprMin: String(Number(row.apr_min || 0).toFixed(3)),
      aprMax: String(Number(row.apr_max || 0).toFixed(3)),
      feesYen: String(Math.max(0, Number(row.fees_yen || 0))),
      minAmountYen: String(Math.max(0, Number(row.min_amount_yen || 0))),
      maxAmountYen: String(Math.max(0, Number(row.max_amount_yen || 0))),
      applyUrl: row.apply_url || '',
      sourceType: row.source_type === 'scrape' ? 'scrape' : 'manual',
      notes: row.notes || '',
      sortOrder: Number(row.sort_order || 0),
      isActive: Boolean(row.is_active),
    })
  }

  const handleDeleteRefinance = async (id) => {
    setRefinanceMessage(null)
    try {
      const { error } = await supabase
        .from('loan_refinance_products')
        .delete()
        .eq('id', id)
      if (error) throw error
      if (editingRefinanceId === id) resetRefinanceForm()
      setRefinanceMessage({ type: 'success', text: 'Refinance product deleted.' })
      await loadRefinanceProducts()
    } catch (err) {
      setRefinanceMessage({ type: 'error', text: err.message || 'Failed to delete refinance product.' })
    }
  }

  const loadReports = async (status = reportStatusFilter) => {
    setReportLoading(true)
    try {
      const data = await fetchAdminReports(status, 300)
      setReports(data)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load report data.' })
    } finally {
      setReportLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase.from('products').insert([{
        category: formData.category || null,
        name: formData.name,
        link: formData.link || null,
        description: formData.description || null,
        spec: formData.spec || null,
      }])
      if (error) throw error
      setMessage({ type: 'success', text: 'Product created successfully.' })
      setFormData({ category: 'cards', name: '', link: '', description: '', spec: '' })
      loadProducts()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to create product. Please check Supabase settings.' })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateReportStatus = async (id, status) => {
    try {
      await updateReportStatus(id, status)
      await loadReports(reportStatusFilter)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update report status.' })
    }
  }

  const handleModerateTarget = async (report) => {
    try {
      if (report.target_type === 'post' && report.target_post_id) {
        await updatePostStatus(report.target_post_id, 'hidden')
      } else if (report.target_type === 'comment' && report.target_comment_id) {
        await updateCommentStatus(report.target_comment_id, 'hidden')
      }
      await updateReportStatus(report.id, 'resolved')
      await loadReports(reportStatusFilter)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Moderation action failed.' })
    }
  }

  const handleRestoreTarget = async (report) => {
    try {
      if (report.target_type === 'post' && report.target_post_id) {
        await updatePostStatus(report.target_post_id, 'published')
      } else if (report.target_type === 'comment' && report.target_comment_id) {
        await updateCommentStatus(report.target_comment_id, 'published')
      }
      await updateReportStatus(report.id, 'rejected')
      await loadReports(reportStatusFilter)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Restore action failed.' })
    }
  }

  const handleAcademyChange = (e) => {
    const { name, value, type, checked } = e.target
    setAcademyForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleAcademySubmit = async (e) => {
    e.preventDefault()
    setAcademyLoading(true)
    setAcademyMessage(null)
    try {
      const { error } = await supabase
        .from('academy_courses')
        .insert([{
          title: academyForm.title.trim(),
          youtube_url: academyForm.youtubeUrl.trim(),
          category_key: academyForm.categoryKey,
          level: academyForm.level,
          is_featured: academyForm.isFeatured,
          is_published: true,
        }])
      if (error) throw error
      setAcademyMessage({ type: 'success', text: 'Academy course created successfully.' })
      setAcademyForm({
        title: '',
        youtubeUrl: '',
        categoryKey: 'general',
        level: '初級',
        isFeatured: false,
      })
    } catch (err) {
      setAcademyMessage({ type: 'error', text: err.message || 'Failed to create course. Please verify Academy schema.' })
    } finally {
      setAcademyLoading(false)
    }
  }

  const handleStartEditProduct = (product) => {
    setEditingProductId(product.id)
    setEditProductForm({
      category: product.category || 'cards',
      name: product.name || '',
      link: product.link || '',
      description: product.description || '',
      spec: product.spec || '',
    })
  }

  const handleCancelEditProduct = () => {
    setEditingProductId(null)
    setEditProductForm({ category: 'cards', name: '', link: '', description: '', spec: '' })
  }

  const handleEditProductChange = (e) => {
    const { name, value } = e.target
    setEditProductForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveProductEdit = async (id) => {
    setProductMessage(null)
    try {
      const { error } = await supabase
        .from('products')
        .update({
          category: editProductForm.category || null,
          name: editProductForm.name,
          link: editProductForm.link || null,
          description: editProductForm.description || null,
          spec: editProductForm.spec || null,
        })
        .eq('id', id)
      if (error) throw error
      setProductMessage({ type: 'success', text: 'Product updated successfully.' })
      setEditingProductId(null)
      loadProducts()
    } catch (err) {
      setProductMessage({ type: 'error', text: err.message || 'Failed to update product.' })
    }
  }

  const handleToggleProductActive = async (product) => {
    setProductMessage(null)
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id)
      if (error) throw error
      setProductMessage({ type: 'success', text: `Product visibility updated: ${product.is_active ? 'Hidden' : 'Published'}.` })
      loadProducts()
    } catch (err) {
      setProductMessage({ type: 'error', text: err.message || 'Failed to update visibility.' })
    }
  }

  const buildRecentDayLabels = (days = 7) => {
    const labels = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      labels.push(d.toISOString().slice(0, 10))
    }
    return labels
  }

  const countRowsByDay = (rows, key, dayKeys) => {
    const counter = new Map(dayKeys.map((d) => [d, 0]))
    ;(rows || []).forEach((row) => {
      const raw = row?.[key]
      if (!raw) return
      const day = String(raw).slice(0, 10)
      if (counter.has(day)) counter.set(day, counter.get(day) + 1)
    })
    return counter
  }

  const loadMissingDataList = async () => {
    setMissingDataLoading(true)
    setMissingDataError('')
    try {
      const symbols = [...ETF_SYMBOLS_FROM_XLSX].filter(Boolean)
      const metaMap = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))

      const { data: latestRows } = await supabase.from('v_stock_latest').select('symbol').in('symbol', symbols)
      const { data: symbolRows } = await supabase.from('stock_symbols').select('symbol,trust_fee,nisa_category').in('symbol', symbols)

      const hasLatest = new Set((latestRows || []).map((r) => r.symbol))
      const symbolMap = new Map((symbolRows || []).map((r) => [r.symbol, r]))

      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - 1)
      const cutoffStr = cutoff.toISOString().slice(0, 10)

      const historyBySymbol = new Map()
      for (let i = 0; i < symbols.length; i += 30) {
        const batch = symbols.slice(i, i + 30)
        const { data } = await supabase
          .from('stock_daily_prices')
          .select('symbol')
          .in('symbol', batch)
          .gte('trade_date', cutoffStr)
          .limit(10000)
        const bySymbol = {}
        ;(data || []).forEach((row) => {
          bySymbol[row.symbol] = (bySymbol[row.symbol] || 0) + 1
        })
        batch.forEach((sym) => {
          historyBySymbol.set(sym, bySymbol[sym] || 0)
        })
      }

      const missing = symbols
        .map((symbol) => {
          const meta = metaMap.get(symbol)
          const profile = symbolMap.get(symbol)
          const hasVLatest = hasLatest.has(symbol)
          const historyCount = historyBySymbol.get(symbol) || 0
          const hasTrustFee = Number.isFinite(Number(profile?.trust_fee)) || Number.isFinite(Number(meta?.trustFee))
          const hasNisa = Boolean((profile?.nisa_category || meta?.nisaCategory || '').trim())
          const issues = []
          if (!hasVLatest) issues.push('no v_stock_latest')
          if (historyCount < 100) issues.push(`history ${historyCount} rows`)
          if (!hasTrustFee) issues.push('no trust fee')
          if (!hasNisa) issues.push('no NISA category')
          if (issues.length === 0) return null
          return { symbol, name: meta?.jpName || symbol, issues }
        })
        .filter(Boolean)
      setMissingDataList(missing)
      setMissingDataLoaded(true)
    } catch (err) {
      setMissingDataError(err?.message || 'Failed to load.')
    } finally {
      setMissingDataLoading(false)
    }
  }

  const loadDashboard = async () => {
    setDashboardLoading(true)
    setDashboardError('')
    try {
      const dayKeys = buildRecentDayLabels(7)
      const dayStart = dayKeys[0]

      const [
        productsCountRes,
        productsActiveRes,
        academyCountRes,
        reportsOpenRes,
        productsRecentRes,
        academyRecentRes,
        reportsRecentRes,
        latestStockRes,
        latestFundRes,
      ] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('academy_courses').select('id', { count: 'exact', head: true }),
        supabase.from('lounge_reports').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'reviewing']),
        supabase.from('products').select('created_at').gte('created_at', `${dayStart}T00:00:00`),
        supabase.from('academy_courses').select('created_at').gte('created_at', `${dayStart}T00:00:00`),
        supabase.from('lounge_reports').select('created_at').gte('created_at', `${dayStart}T00:00:00`),
        supabase.from('stock_prices').select('trade_date').order('trade_date', { ascending: false }).limit(1),
        supabase.from('v_stock_latest').select('trade_date').order('trade_date', { ascending: false }).limit(1),
      ])

      const productByDay = countRowsByDay(productsRecentRes.data, 'created_at', dayKeys)
      const academyByDay = countRowsByDay(academyRecentRes.data, 'created_at', dayKeys)
      const reportsByDay = countRowsByDay(reportsRecentRes.data, 'created_at', dayKeys)
      const daily = dayKeys.map((day) => ({
        day: day.slice(5).replace('-', '/'),
        products: productByDay.get(day) || 0,
        academy: academyByDay.get(day) || 0,
        reports: reportsByDay.get(day) || 0,
      }))
      let dauToday = 0
      let dauMetricDate = null
      let dauHasRow = false
      let signupsToday = 0
      let saveSuccessRate = 0
      const { data: adminDailyMetrics, error: dailyMetricErr } = await supabase
        .from('admin_daily_metrics')
        .select('metric_date,dau,signup_count,mypage_save_success_rate')
        .order('metric_date', { ascending: false })
        .limit(7)
      if (!dailyMetricErr && Array.isArray(adminDailyMetrics) && adminDailyMetrics.length > 0) {
        const latest = adminDailyMetrics[0]
        dauHasRow = true
        dauMetricDate = latest.metric_date || null
        dauToday = Number(latest.dau || 0)
        signupsToday = Number(latest.signup_count || 0)
        saveSuccessRate = Number(latest.mypage_save_success_rate || 0)
      }

      setDashboard({
        totalProducts: productsCountRes.count || 0,
        activeProducts: productsActiveRes.count || 0,
        academyCourses: academyCountRes.count || 0,
        openReports: reportsOpenRes.count || 0,
        dauToday,
        dauHasRow,
        dauMetricDate,
        signupsToday,
        saveSuccessRate,
        latestStockDate: latestStockRes.data?.[0]?.trade_date || null,
        latestFundDate: latestFundRes.data?.[0]?.trade_date || null,
        daily,
      })
    } catch (err) {
      setDashboardError(err.message || 'Failed to load business dashboard.')
    } finally {
      setDashboardLoading(false)
    }
  }

  const fetchAdminAnalyticsEventRows = async (sinceIso, internalUserIds) => {
    const columns = 'event_name,page_path,session_id,user_id,referrer_domain,source,medium,campaign,dwell_ms,event_meta,created_at'
    const pageSize = 1000
    const maxRows = 60000
    const fromView = []
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const { data, error } = await supabase
        .from('v_customer_site_analytics_events')
        .select(columns)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)
      if (error) break
      if (!data?.length) break
      fromView.push(...data)
      if (data.length < pageSize) break
    }
    if (fromView.length > 0) return fromView

    const { data, error } = await supabase
      .from('site_analytics_events')
      .select(columns)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(20000)
    if (error) throw error
    return filterStaffAnalyticsEvents(Array.isArray(data) ? data : [], internalUserIds)
  }

  const loadAnalyticsClientFallback = async (safeRangeDays, requestId = null) => {
    const sinceIso = new Date(Date.now() - (safeRangeDays * 24 * 60 * 60 * 1000)).toISOString()
    const internalUserIds = buildInternalUserIdSet(crmRows)
    const rows = await fetchAdminAnalyticsEventRows(sinceIso, internalUserIds)
    const pageViewEvents = rows.filter((row) => row.event_name === 'page_view')
    const searchEvents = rows.filter((row) => row.event_name === 'search')
    const productEvents = rows.filter((row) => ANALYTICS_CLICK_EVENTS.has(row.event_name))
    const landingEvents = pageViewEvents.filter((row) => String(row.referrer_domain || row.source || row.medium || '').trim() !== '')
    const pageExitEvents = rows.filter((row) => row.event_name === 'page_exit' && Number(row.dwell_ms || 0) > 0)

    const topPagesMap = new Map()
    pageViewEvents.forEach((row) => {
      const key = row.page_path || '/'
      const entry = topPagesMap.get(key) || { page_path: key, views: 0, uniqueSessions: new Set(), dwellValues: [] }
      entry.views += 1
      if (row.session_id) entry.uniqueSessions.add(row.session_id)
      topPagesMap.set(key, entry)
    })
    pageExitEvents.forEach((row) => {
      const key = row.page_path || '/'
      const entry = topPagesMap.get(key) || { page_path: key, views: 0, uniqueSessions: new Set(), dwellValues: [] }
      const capped = capDwellMsForReport(row.dwell_ms)
      if (capped > 0) entry.dwellValues.push(capped)
      topPagesMap.set(key, entry)
    })
    const topPages = [...topPagesMap.values()]
      .map((entry) => ({
        page_path: entry.page_path,
        views: entry.views,
        unique_sessions: entry.uniqueSessions.size,
        avg_dwell_ms: avgCappedDwellMs(entry.dwellValues),
        median_dwell_ms: medianDwellMs(entry.dwellValues),
      }))
      .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
      .slice(0, 15)

    const topProductsMap = new Map()
    productEvents.forEach((row) => {
      const meta = row.event_meta || {}
      const productType = String(meta.product_type || meta.item_type || 'unknown')
      const productId = String(meta.product_id || meta.item_id || '')
      const productName = String(meta.product_name || meta.item_name || productId || 'unknown')
      if (!productId) return
      const key = `${productType}::${productId}`
      const entry = topProductsMap.get(key) || {
        product_type: productType,
        product_id: productId,
        product_name: productName,
        clicks: 0,
        uniqueSessions: new Set(),
      }
      entry.clicks += 1
      if (row.session_id) entry.uniqueSessions.add(row.session_id)
      topProductsMap.set(key, entry)
    })
    const topProducts = [...topProductsMap.values()]
      .map((entry) => ({
        product_type: entry.product_type,
        product_id: entry.product_id,
        product_name: entry.product_name,
        clicks: entry.clicks,
        unique_sessions: entry.uniqueSessions.size,
      }))
      .sort((a, b) => Number(b.clicks || 0) - Number(a.clicks || 0))
      .slice(0, 15)

    const topSearchesMap = new Map()
    searchEvents.forEach((row) => {
      const meta = row.event_meta || {}
      const query = String(meta.query || '').trim().toLowerCase()
      if (!query) return
      const pagePath = row.page_path || '/'
      const resultCount = Number(meta.result_count || 0)
      const key = `${pagePath}::${query}`
      const entry = topSearchesMap.get(key) || {
        page_path: pagePath,
        query,
        searches: 0,
        resultTotal: 0,
      }
      entry.searches += 1
      entry.resultTotal += resultCount
      topSearchesMap.set(key, entry)
    })
    const topSearches = [...topSearchesMap.values()]
      .map((entry) => ({
        page_path: entry.page_path,
        query: entry.query,
        searches: entry.searches,
        avg_result_count: entry.searches > 0 ? entry.resultTotal / entry.searches : 0,
      }))
      .sort((a, b) => Number(b.searches || 0) - Number(a.searches || 0))
      .slice(0, 15)

    const topReferrersMap = new Map()
    landingEvents.forEach((row) => {
      const domain = String(row.referrer_domain || '').trim()
      const utmSource = String(row.source || '').trim()
      const utmMedium = String(row.medium || '').trim()
      const key = `${domain}::${utmSource}::${utmMedium}`
      const entry = topReferrersMap.get(key) || {
        referrer_domain: domain,
        utm_source: utmSource,
        utm_medium: utmMedium,
        landing_views: 0,
        uniqueSessions: new Set(),
      }
      entry.landing_views += 1
      if (row.session_id) entry.uniqueSessions.add(row.session_id)
      topReferrersMap.set(key, entry)
    })
    const topReferrers = [...topReferrersMap.values()]
      .map((entry) => ({
        referrer_domain: entry.referrer_domain,
        utm_source: entry.utm_source,
        utm_medium: entry.utm_medium,
        landing_views: entry.landing_views,
        unique_sessions: entry.uniqueSessions.size,
      }))
      .sort((a, b) => Number(b.landing_views || 0) - Number(a.landing_views || 0))
      .slice(0, 15)

    const topCampaignsMap = new Map()
    pageViewEvents.forEach((row) => {
      const camp = String(row.campaign || '').trim()
      if (!camp) return
      const utmSource = String(row.source || '').trim()
      const utmMedium = String(row.medium || '').trim()
      const key = `${camp}::${utmSource}::${utmMedium}`
      const entry = topCampaignsMap.get(key) || {
        campaign: camp,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        page_views: 0,
        uniqueSessions: new Set(),
      }
      entry.page_views += 1
      if (row.session_id) entry.uniqueSessions.add(row.session_id)
      topCampaignsMap.set(key, entry)
    })
    const topCampaigns = [...topCampaignsMap.values()]
      .map((entry) => ({
        campaign: entry.campaign,
        utm_source: entry.utm_source,
        utm_medium: entry.utm_medium,
        page_views: entry.page_views,
        unique_sessions: entry.uniqueSessions.size,
      }))
      .sort((a, b) => Number(b.page_views || 0) - Number(a.page_views || 0))
      .slice(0, 15)

    const uniqueSessionsPageView = new Set(pageViewEvents.map((r) => r.session_id).filter(Boolean)).size
    const uniqueSearchSessions = new Set(searchEvents.map((r) => r.session_id).filter(Boolean)).size
    const uniqueProductClickSessions = new Set(productEvents.map((r) => r.session_id).filter(Boolean)).size
    const uniqueLandingSessions = new Set(landingEvents.map((r) => r.session_id).filter(Boolean)).size

    const uniqueDetailSessions = new Set(
      rows
        .filter((row) => ['fund_detail_view', 'product_detail_view'].includes(row.event_name))
        .map((row) => row.session_id)
        .filter(Boolean),
    )
    const uniqueClickSessions = new Set(productEvents.map((row) => row.session_id).filter(Boolean))
    const uniqueApplySessions = new Set(
      rows
        .filter((row) => row.event_name === 'product_apply_click')
        .map((row) => row.session_id)
        .filter(Boolean),
    )
    const funnel = [
      { step: 'Landing', sessions: uniqueSessionsPageView },
      { step: 'Search', sessions: uniqueSearchSessions },
      { step: 'Detail View', sessions: uniqueDetailSessions.size },
      { step: 'Item Click', sessions: uniqueClickSessions.size },
      { step: 'Apply Click', sessions: uniqueApplySessions.size },
    ]

    const eventAgg = new Map()
    rows.forEach((row) => {
      const name = String(row.event_name || 'unknown')
      const e = eventAgg.get(name) || { event_name: name, events: 0, uniqueSessions: new Set() }
      e.events += 1
      if (row.session_id) e.uniqueSessions.add(row.session_id)
      eventAgg.set(name, e)
    })
    const eventBreakdown = [...eventAgg.values()]
      .map((e) => ({ event_name: e.event_name, events: e.events, unique_sessions: e.uniqueSessions.size }))
      .sort((a, b) => Number(b.events) - Number(a.events))
      .slice(0, 50)

    const engagementNames = new Set([
      'home_navigation_click',
      'home_referral_copy',
      'home_referral_share',
      'fund_detail_view',
      'product_detail_view',
      'fund_watchlist_add',
      'fund_watchlist_remove',
      'stock_watchlist_add',
      'stock_watchlist_remove',
    ])
    const engagement = eventBreakdown.filter((e) => engagementNames.has(e.event_name))

    const activity = buildActivityClientFallback(rows, pageViewEvents, safeRangeDays)

    const dayMap = new Map()
    const daySessions = new Map()
    rows.forEach((row) => {
      const day = String(row.created_at || '').slice(0, 10)
      if (!day) return
      const entry = dayMap.get(day) || {
        day: day.slice(5),
        pageViews: 0,
        searches: 0,
        productClicks: 0,
        landings: 0,
      }
      if (row.event_name === 'page_view') {
        entry.pageViews += 1
        if (!daySessions.has(day)) daySessions.set(day, new Set())
        if (row.session_id) daySessions.get(day).add(row.session_id)
      }
      if (row.event_name === 'search') entry.searches += 1
      if (ANALYTICS_CLICK_EVENTS.has(row.event_name)) entry.productClicks += 1
      if (row.event_name === 'page_view' && String(row.referrer_domain || row.source || row.medium || '').trim() !== '') entry.landings += 1
      dayMap.set(day, entry)
    })
    const dailyTrend = [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dayKey, value]) => ({
        ...value,
        uniqueSessions: daySessions.get(dayKey)?.size || 0,
      }))

    const dwellValues = pageExitEvents
      .map((row) => capDwellMsForReport(row.dwell_ms))
      .filter((value) => value > 0)
    const dwellStats = aggregateDwellStats(dwellValues)
    const avgDwellMs = dwellStats.avg_dwell_ms
    const medianDwellMsValue = dwellStats.median_dwell_ms

    if (requestId != null && requestId !== analyticsLoadGenRef.current) return

    setAnalytics({
      dataSource: 'client',
      pageViews: pageViewEvents.length,
      uniqueSessionsPageView,
      productClicks: productEvents.length,
      uniqueProductClickSessions,
      searches: searchEvents.length,
      uniqueSearchSessions,
      landingViews: landingEvents.length,
      uniqueLandingSessions,
      avgDwellMs,
      medianDwellMs: medianDwellMsValue,
      summaryPrev: null,
      topPages,
      topProducts,
      topSearches,
      topReferrers,
      topCampaigns,
      funnel,
      dailyTrend,
      eventBreakdown,
      engagement,
      activity,
      rangeDays: safeRangeDays,
      metaSince: sinceIso,
    })
  }

  const loadAnalytics = async (rangeDays = analyticsRangeDays) => {
    const requestId = ++analyticsLoadGenRef.current
    setAnalyticsLoading(true)
    setAnalyticsError('')
    const clamped = Math.max(1, Math.min(366, Number(rangeDays || 30)))
    try {
      const { data, error } = await supabase.rpc('admin_site_analytics_dashboard', { p_days: clamped })
      if (requestId !== analyticsLoadGenRef.current) return
      if (error) throw error
      if (data == null || typeof data !== 'object') throw new Error('Empty analytics response')
      const mapped = mapAnalyticsRpcPayload(data)
      const rpcDays = Number(mapped.rangeDays)
      if (Number.isFinite(rpcDays) && rpcDays !== clamped) {
        console.warn(`admin_site_analytics_dashboard returned meta.days=${rpcDays} but requested p_days=${clamped}`)
      }
      setAnalytics(mapped)
    } catch (err) {
      if (requestId !== analyticsLoadGenRef.current) return
      if (isAnalyticsRpcFallbackError(err)) {
        try {
          await loadAnalyticsClientFallback(clamped, requestId)
          if (requestId === analyticsLoadGenRef.current && isAnalyticsRpcMissingError(err)) {
            setAnalyticsError(
              'Showing browser summary (up to 20k rows) because the aggregate RPC is not deployed. Apply `SUPABASE_ADMIN_SITE_ANALYTICS_DASHBOARD_RPC.sql` and reload.',
            )
          } else if (requestId === analyticsLoadGenRef.current && String(err?.code || '') === '57014') {
            setAnalyticsError(
              'RPC timed out — showing browser summary. Permanent fix: run `SUPABASE_FIX_ANALYTICS_VIEW_PERF.sql` in Supabase.',
            )
          }
        } catch (e2) {
          if (requestId !== analyticsLoadGenRef.current) return
          setAnalyticsError(formatAnalyticsLoadError(e2))
        }
      } else {
        setAnalyticsError(formatAnalyticsLoadError(err))
      }
    } finally {
      if (requestId === analyticsLoadGenRef.current) {
        setAnalyticsLoading(false)
      }
    }
  }

  const loadCrm = async () => {
    setCrmLoading(true)
    setCrmError('')
    try {
      const { data, error } = await supabase.rpc('admin_crm_users', { p_limit: 300 })
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      setCrmRows(rows)
      return rows
    } catch (err) {
      setCrmError(formatCrmLoadError(err))
      setCrmRows([])
      return []
    } finally {
      setCrmLoading(false)
    }
  }

  const loadCrmTraffic = async (rangeDays = crmRangeDays) => {
    setCrmTrafficLoading(true)
    setCrmTrafficError('')
    const clamped = Math.max(1, Math.min(366, Number(rangeDays || 30)))
    try {
      const { data, error } = await supabase.rpc('admin_crm_traffic_dashboard', { p_days: clamped })
      if (error) throw error
      if (data == null || typeof data !== 'object') throw new Error('Empty CRM traffic response')
      setCrmTraffic(mapCrmTrafficPayload(data))
    } catch (err) {
      setCrmTrafficError(formatCrmLoadError(err))
      setCrmTraffic(emptyCrmTraffic())
    } finally {
      setCrmTrafficLoading(false)
    }
  }

  const loadCrmAudience = async (rangeDays = crmRangeDays, crmRowsSnapshot = crmRows) => {
    setCrmAudienceLoading(true)
    setCrmAudienceError('')
    const clamped = Math.max(1, Math.min(366, Number(rangeDays || 28)))
    const internalUserIds = buildInternalUserIdSet(crmRowsSnapshot)
    try {
      const { data, error } = await supabase.rpc('admin_crm_audience_dashboard', { p_days: clamped })
      if (!error && data && typeof data === 'object') {
        setCrmAudience(mapAudienceRpcPayload(data))
        return
      }

      const since = new Date(Date.now() - clamped * 86400000).toISOString()
      const internalUserIds = buildInternalUserIdSet(crmRowsSnapshot)
      let events = []
      const pageSize = 1000
      for (let offset = 0; offset < 30000; offset += pageSize) {
        const { data, error } = await supabase
          .from('v_customer_site_analytics_events')
          .select('created_at,event_meta,event_name,referrer_domain,user_id,session_id,page_path')
          .gte('created_at', since)
          .eq('event_name', 'page_view')
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1)
        if (error) break
        if (!data?.length) break
        events.push(...data)
        if (data.length < pageSize) break
      }
      if (events.length === 0) {
        const { data: rawEvents, error: evErr } = await supabase
          .from('site_analytics_events')
          .select('created_at,event_meta,event_name,referrer_domain,user_id,session_id,page_path')
          .gte('created_at', since)
          .eq('event_name', 'page_view')
          .order('created_at', { ascending: false })
          .limit(12000)
        if (evErr) throw evErr
        events = filterStaffAnalyticsEvents(rawEvents || [], internalUserIds)
      }

      let audience = aggregateAudienceFromEvents(events, { internalUserIds })
      audience.meta = { ...audience.meta, days: clamped }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, onboarding_asset_mix, onboarding_risk_tolerance, onboarding_investment_horizon')

      const emailByUser = new Map(
        (Array.isArray(crmRowsSnapshot) ? crmRowsSnapshot : []).map((r) => [r.user_id, r.email]),
      )
      const profileRows = (profiles || []).map((p) => ({
        ...p,
        email: emailByUser.get(p.user_id) || '',
      }))
      audience = mergeAudienceWithOnboarding(
        audience,
        buildOnboardingAudienceFromCrmRows(profileRows),
      )
      setCrmAudience(audience)
      if (error) {
        setCrmAudienceError(
          'Audience RPC not deployed — using live query. Run SUPABASE_PATCH_CRM_AUDIENCE_ANALYTICS.sql in Supabase.',
        )
      }
    } catch (err) {
      setCrmAudienceError(formatCrmLoadError(err))
      setCrmAudience(emptyCrmAudience())
    } finally {
      setCrmAudienceLoading(false)
    }
  }

  const reloadCrmAll = async () => {
    const rows = await loadCrm()
    await Promise.all([
      loadCrmTraffic(crmRangeDays),
      loadCrmAudience(crmRangeDays, rows),
    ])
  }

  useEffect(() => {
    loadReports('submitted')
    loadProducts()
    loadEarnings()
    loadNewsUpdatedAt()
    loadNewsPageManual()
    loadMarketMajorNewsManual()
    loadInsights()
    loadRefinanceProducts()
    loadDashboard()
    loadAnalytics(analyticsRangeDays)
    loadDividendMaster()
  }, [])

  useEffect(() => {
    if (activeTab !== 'analytics' && activeTab !== 'dashboard') return
    loadAnalytics(analyticsRangeDays)
  }, [analyticsRangeDays, activeTab])

  useEffect(() => {
    if (activeTab !== 'crm' && activeTab !== 'dashboard') return
    let cancelled = false
    ;(async () => {
      const rows = await loadCrm()
      if (cancelled) return
      await Promise.all([
        loadCrmTraffic(crmRangeDays),
        loadCrmAudience(crmRangeDays, rows),
      ])
    })()
    return () => { cancelled = true }
  }, [activeTab, crmRangeDays])

  const crmTrafficExternal = useMemo(() => filterExternalCrmTraffic(crmTraffic), [crmTraffic])

  const crmCustomerSignupsInRange = useMemo(() => {
    const sinceMs = Date.now() - crmRangeDays * 86400000
    return crmRows.filter((r) => {
      if (isCrmInternalUser(r)) return false
      const createdMs = r.user_created_at ? new Date(r.user_created_at).getTime() : 0
      return createdMs >= sinceMs
    })
  }, [crmRows, crmRangeDays])

  const crmAcquisitionSummary = useMemo(
    () => buildCrmAcquisitionSummary(crmCustomerSignupsInRange),
    [crmCustomerSignupsInRange],
  )
  const crmTrafficChannelSummary = useMemo(
    () => aggregateTrafficReferrerChannels(
      (crmTrafficExternal.topReferrers || []).map((row) => ({
        ...row,
        sessions: Number(row.sessions || row.unique_sessions || row.landing_views || 0),
      })),
    ),
    [crmTrafficExternal.topReferrers],
  )
  const crmSignupChannelSummary = useMemo(
    () => aggregateSignupReferrerChannels(crmCustomerSignupsInRange),
    [crmCustomerSignupsInRange],
  )
  const crmGrowthKpis = useMemo(() => {
    const list = crmCustomerSignupsInRange
    const activated = list.filter((r) => isActivatedSignup(r)).length
    const premiumIntent = list.filter((r) => hasPremiumIntent(r)).length
    const smartnews = list.filter((r) => isSmartNewsSignup(r)).length
    return {
      activated,
      activatedPct: list.length ? Math.round((activated / list.length) * 1000) / 10 : 0,
      premiumIntent,
      smartnews,
    }
  }, [crmCustomerSignupsInRange])

  const crmSalesSummary = useMemo(() => {
    const list = crmCustomerSignupsInRange
    const withAttr = list.filter((r) => crmHasAttribution(r)).length
    const activated = list.filter((r) => isActivatedSignup(r)).length
    const withUtm = list.filter((r) =>
      Boolean(String(r.signup_utm_source || '').trim()
        || String(r.signup_utm_medium || '').trim()
        || String(r.signup_utm_campaign || '').trim()),
    ).length
    return {
      signups: list.length,
      withAttr,
      attributionPct: list.length ? Math.round((withAttr / list.length) * 1000) / 10 : 0,
      activated,
      activatedPct: list.length ? Math.round((activated / list.length) * 1000) / 10 : 0,
      withUtm,
      utmPct: list.length ? Math.round((withUtm / list.length) * 1000) / 10 : 0,
      missingAttribution: list.length - withAttr,
    }
  }, [crmCustomerSignupsInRange])

  const crmAdvancedAnalysis = useMemo(() => buildCrmAdvancedAnalysis({
    allRows: crmRows,
    rangeDays: crmRangeDays,
    trafficByChannel: crmTrafficChannelSummary,
    sessions: Number(crmTrafficExternal.summary.uniqueSessions || 0),
  }), [crmRows, crmRangeDays, crmTrafficChannelSummary, crmTrafficExternal.summary.uniqueSessions])

  const crmDecisionMetrics = useMemo(() => {
    const sessions = Number(crmTrafficExternal.summary.uniqueSessions || 0)
    const signups = crmSalesSummary.signups
    const activated = crmSalesSummary.activated
    const premiumIntent = crmGrowthKpis.premiumIntent
    const visitToSignupPct = sessions > 0 ? Math.round((signups / sessions) * 1000) / 10 : 0
    const signupToActivationPct = signups > 0 ? Math.round((activated / signups) * 1000) / 10 : 0
    const activationToIntentPct = activated > 0 ? Math.round((premiumIntent / activated) * 1000) / 10 : 0
    const dataQualityScore = Math.round(
      (crmSalesSummary.attributionPct * 0.5)
      + (crmSalesSummary.utmPct * 0.3)
      + (Math.min(100, signupToActivationPct) * 0.2),
    )
    const trafficById = new Map(crmTrafficChannelSummary.map((row) => [row.id || row.label, Number(row.count || 0)]))
    const channelPerformance = crmSignupChannelSummary.map((row) => {
      const traffic = trafficById.get(row.id || row.label) || 0
      const channelSignups = Number(row.count || 0)
      return {
        ...row,
        traffic,
        signups: channelSignups,
        conversionPct: traffic > 0 ? Math.round((channelSignups / traffic) * 1000) / 10 : null,
      }
    }).sort((a, b) => (b.signups - a.signups) || ((b.conversionPct || 0) - (a.conversionPct || 0)))
    return {
      sessions,
      signups,
      activated,
      premiumIntent,
      visitToSignupPct,
      signupToActivationPct,
      activationToIntentPct,
      visitToSignupDropoffPct: Math.max(0, Math.round((100 - visitToSignupPct) * 10) / 10),
      signupToActivationDropoffPct: Math.max(0, Math.round((100 - signupToActivationPct) * 10) / 10),
      dataQualityScore,
      channelPerformance: channelPerformance.slice(0, 12),
    }
  }, [crmTrafficExternal.summary.uniqueSessions, crmSalesSummary, crmGrowthKpis.premiumIntent, crmTrafficChannelSummary, crmSignupChannelSummary])

  const crmUserCreatedAtById = useMemo(() => {
    const map = new Map()
    for (const row of crmRows) {
      if (row?.user_id) map.set(row.user_id, row.user_created_at)
    }
    return map
  }, [crmRows])

  const crmExecutiveSummary = useMemo(() => buildCrmExecutiveSummary({
    rangeDays: crmRangeDays,
    sales: crmSalesSummary,
    signupChannels: crmSignupChannelSummary,
    trafficSummary: crmTrafficExternal.summary,
    analysis: crmAdvancedAnalysis,
  }), [
    crmRangeDays,
    crmSalesSummary,
    crmSignupChannelSummary,
    crmTrafficExternal.summary,
    crmAdvancedAnalysis,
  ])

  const siteAdvancedAnalysis = useMemo(
    () => buildSiteAdvancedAnalysis(analytics),
    [analytics],
  )

  const analyticsTopReferrersExternal = useMemo(
    () => filterExternalAnalyticsReferrers(analytics.topReferrers),
    [analytics.topReferrers],
  )
  const analyticsTrafficChannels = useMemo(
    () => aggregateTrafficReferrerChannels(
      analyticsTopReferrersExternal.map((row) => ({
        referrer_domain: row.referrer_domain,
        utm_source: row.utm_source,
        utm_medium: row.utm_medium,
        sessions: Number(row.unique_sessions || row.landing_views || 0),
      })),
    ),
    [analyticsTopReferrersExternal],
  )

  const runCrmAiInsights = async () => {
    setCrmAiLoading(true)
    setCrmAiError('')
    try {
      const cred = typeof window !== 'undefined' ? sessionStorage.getItem('mm_admin_auth') : null
      if (!cred) throw new Error('Admin session missing. Reload and sign in again.')
      const snapshot = {
        generatedAt: new Date().toISOString(),
        note: 'CRM aggregates: customer signups in range + filtered cohort. No raw emails sent to the model.',
        sales: crmSalesSummary,
        customerSignupsInRange: crmCustomerSignupsInRange.length,
        signupChannels: crmSignupChannelSummary.slice(0, 8),
        executive: crmExecutiveSummary,
        crm: crmAcquisitionSummary,
        traffic: {
          rangeDays: crmRangeDays,
          summary: crmTrafficExternal.summary,
          cohort: crmTrafficExternal.cohort,
          topReferrers: (crmTrafficExternal.topReferrers || []).slice(0, 10),
          topLandingPaths: (crmTrafficExternal.topLandingPaths || []).slice(0, 10),
        },
        growth: buildAdminGrowthSnapshot({ dashboard, analytics, analyticsRangeDays }),
      }
      const res = await fetch('/api/admin-crm-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${cred}`,
        },
        body: JSON.stringify({ snapshot }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Failed to fetch AI insights (${res.status})`)
      setCrmAiResult(data.insights || null)
      setCrmAiGeneratedAt(data.generatedAt || new Date().toISOString())
    } catch (e) {
      setCrmAiError(String(e?.message || e || 'failed'))
      setCrmAiResult(null)
      setCrmAiGeneratedAt(null)
    } finally {
      setCrmAiLoading(false)
    }
  }

  const tabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => handleTabChange(id)}
      className={`px-2.5 py-1 rounded-full text-[12px] transition ${
        activeTab === id
          ? 'bg-slate-900 text-white'
          : 'text-slate-400 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-sans">
      <div className="sticky top-0 z-[80] border-b border-slate-100 bg-[#f7f8fa]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-end gap-1.5 px-6 py-3">
          {tabBtn('dashboard', 'Dashboard')}
          {tabBtn('crm', 'CRM')}
          {tabBtn('analytics', 'Analytics')}
          {tabBtn('operations', 'Ops')}
        </div>
      </div>
      <div className={`${activeTab === 'dashboard' ? 'max-w-[1280px]' : 'max-w-7xl'} mx-auto px-6 py-6 space-y-4`}>

        {activeTab === 'dashboard' && (
          <AdminExecutiveDashboard
            rangeDays={crmRangeDays}
            onRangeDays={(days) => {
              setCrmRangeDays(days)
              setAnalyticsRangeDays(days)
              loadAnalytics(days)
            }}
            dashboard={dashboard}
            crmRows={crmRows}
            crmLoading={crmLoading}
            crmError={crmError}
            crmAcquisitionSummary={crmAcquisitionSummary}
            crmSalesSummary={crmSalesSummary}
            crmGrowthKpis={crmGrowthKpis}
            crmAdvancedAnalysis={crmAdvancedAnalysis}
            crmTrafficChannelSummary={crmTrafficChannelSummary}
            crmSignupChannelSummary={crmSignupChannelSummary}
            crmTrafficSummary={crmTrafficExternal.summary}
            crmCustomerSignups={crmCustomerSignupsInRange}
            analytics={analytics}
            analyticsLoading={analyticsLoading}
            analyticsError={analyticsError}
            productDashboard={productDashboard}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsWorkbench
            section={analyticsSection}
            onSectionChange={setAnalyticsSection}
            rangeDays={analyticsRangeDays}
            onRangeDaysChange={(days) => {
              setAnalyticsRangeDays(days)
              loadAnalytics(days)
            }}
            onRefresh={() => loadAnalytics(analyticsRangeDays)}
            loading={analyticsLoading}
            error={analyticsError}
            sourceBadge={analyticsSourceBadge}
            analytics={analytics}
            productDashboard={productDashboard}
            trafficChannels={analyticsTrafficChannels}
            topReferrers={analyticsTopReferrersExternal}
            onDownloadCsv={downloadAnalyticsCsv}
            onOpenCrm={() => handleTabChange('crm')}
            analysis={siteAdvancedAnalysis}
          />
        )}

        {activeTab === 'crm' && (
          <CrmWorkbench
            rangeDays={crmRangeDays}
            onRangeDaysChange={setCrmRangeDays}
            loading={crmLoading}
            error={crmError}
            trafficError={crmTrafficError}
            trafficLoading={crmTrafficLoading}
            audienceLoading={crmAudienceLoading}
            onRefresh={() => reloadCrmAll()}
            onDownloadCsv={() => downloadCrmCsv(crmCustomerSignupsInRange, 'crm-signups-range')}
            csvDisabled={crmLoading || crmCustomerSignupsInRange.length === 0}
            decisionMetrics={crmDecisionMetrics}
            salesSummary={crmSalesSummary}
            growthKpis={crmGrowthKpis}
            executiveSummary={crmExecutiveSummary}
            acquisitionSummary={crmAcquisitionSummary}
            analysis={crmAdvancedAnalysis}
            trafficChannels={crmTrafficChannelSummary}
            signupChannels={crmSignupChannelSummary}
            trafficSummary={crmTrafficExternal.summary}
            trafficSessions={crmTrafficExternal.recentSessions}
            userCreatedAtById={crmUserCreatedAtById}
            customerSignups={crmCustomerSignupsInRange}
            audience={crmAudience}
            audienceError={crmAudienceError}
            aiLoading={crmAiLoading}
            aiError={crmAiError}
            aiResult={crmAiResult}
            aiGeneratedAt={crmAiGeneratedAt}
            onRunAi={() => runCrmAiInsights()}
            aiDisabled={crmLoading || Boolean(crmError)}
          />
        )}

        {activeTab === 'operations' && (
          <div className="space-y-4 xl:space-y-0 xl:columns-2 xl:gap-x-6 [&>*]:break-inside-avoid [&>*]:mb-4">
        <Card className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-gray-500">Operations View</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                자주 쓰는 운영 항목만 기본으로 보여주고, 수동/고급 관리 메뉴는 아래 버튼으로 펼칠 수 있습니다.
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={() => setShowAdvancedOperations((prev) => !prev)}>
              {showAdvancedOperations ? 'Hide Advanced' : 'Show Advanced'}
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs font-bold text-gray-500 flex items-center gap-1"><Database size={14} /> Data freshness</p>
            <Button type="button" variant="ghost" size="sm" onClick={loadDashboard} disabled={dashboardLoading}>
              {dashboardLoading ? 'Updating…' : 'Refresh'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Latest stock trade date</p>
              <p className="text-sm font-black text-gray-900 dark:text-white">{dashboard.latestStockDate || '-'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Latest fund standard date</p>
              <p className="text-sm font-black text-gray-900 dark:text-white">{dashboard.latestFundDate || '-'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">DAU (today)</p>
              <p className="text-sm font-black text-gray-900 dark:text-white">{dashboard.dauToday.toLocaleString('en-US')}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Signups (today)</p>
              <p className="text-sm font-black text-gray-900 dark:text-white">{dashboard.signupsToday.toLocaleString('en-US')}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Market News (Auto)</h2>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              Cron Enabled
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Market page news is auto-updated via `TheNewsAPI → cron → news_manual`. Manual refresh/input UI was removed from admin.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {newsLastUpdatedAt ? new Date(newsLastUpdatedAt).toLocaleString('en-US') : '-'}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Missing data (funds / ETF)</h2>
            <Button type="button" variant="ghost" onClick={loadMissingDataList} disabled={missingDataLoading}>
              {missingDataLoading ? 'Loading...' : 'Check'}
            </Button>
          </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Lists ETF symbols missing v_stock_latest, history, trust fee, or NISA category.
          </p>
          {missingDataError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{missingDataError}</p>}
          {missingDataList.length > 0 ? (
            <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-gray-700 dark:text-gray-300">Symbol</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-700 dark:text-gray-300">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {missingDataList.map((row) => (
                    <tr key={row.symbol} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">{row.symbol}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{row.name}</td>
                      <td className="px-3 py-2 text-rose-600 dark:text-rose-400">{row.issues.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : missingDataLoading ? null : !missingDataLoaded ? (
            <p className="text-sm text-gray-500">Click Check to load the list.</p>
          ) : (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">All items have required data</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dividend master (by month)</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">stock_id</code> matches My Page / dividend calendar (e.g. <span className="font-mono">AAPL</span>, <span className="font-mono">8306</span>, <span className="font-mono">2558.T</span>).
                Register calendar <strong>months</strong> with dividends. Leave year empty for every-year recurrence.
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={loadDividendMaster} disabled={dividendMasterLoading}>
              {dividendMasterLoading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>
          {dividendMasterMessage && (
            <p className={`text-sm mb-3 ${dividendMasterMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {dividendMasterMessage.text}
            </p>
          )}
          <form
            className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setDividendMasterMessage(null)
              try {
                const payload = {
                  stock_id: dividendMasterForm.stock_id,
                  asset_kind: dividendMasterForm.asset_kind,
                  dividend_month: dividendMasterForm.dividend_month,
                  calendar_year: dividendMasterForm.calendar_year,
                  name_hint: dividendMasterForm.name_hint,
                  notes: dividendMasterForm.notes,
                }
                if (editingDividendMasterId) {
                  await updateDividendMasterRow(editingDividendMasterId, payload)
                  setDividendMasterMessage({ type: 'success', text: 'Updated.' })
                } else {
                  await insertDividendMasterRow(payload)
                  setDividendMasterMessage({ type: 'success', text: 'Added.' })
                }
                setEditingDividendMasterId(null)
                setDividendMasterForm({
                  stock_id: '',
                  asset_kind: 'us_stock',
                  dividend_month: 3,
                  calendar_year: '',
                  name_hint: '',
                  notes: '',
                })
                await loadDividendMaster()
              } catch (err) {
                setDividendMasterMessage({ type: 'error', text: err?.message || 'Save failed.' })
              }
            }}
          >
            <input
              value={dividendMasterForm.stock_id}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, stock_id: e.target.value }))}
              className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
              placeholder="stock_id (e.g. AAPL, 2558.T)"
              required
            />
            <select
              value={dividendMasterForm.asset_kind}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, asset_kind: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="us_stock">US stock</option>
              <option value="jp_stock">JP stock</option>
              <option value="jp_fund">JP fund / ETF</option>
            </select>
            <select
              value={dividendMasterForm.dividend_month}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, dividend_month: Number(e.target.value) }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Month {m}</option>
              ))}
            </select>
            <input
              type="number"
              min={2000}
              max={2100}
              value={dividendMasterForm.calendar_year}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, calendar_year: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Year (optional, blank = every year)"
            />
            <input
              value={dividendMasterForm.name_hint}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, name_hint: e.target.value }))}
              className="md:col-span-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Name note (optional)"
            />
            <input
              value={dividendMasterForm.notes}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, notes: e.target.value }))}
              className="md:col-span-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Notes (optional)"
            />
            <div className="md:col-span-6 flex flex-wrap gap-2">
              <Button type="submit" size="sm">{editingDividendMasterId ? 'Update' : 'Add'}</Button>
              {editingDividendMasterId && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingDividendMasterId(null)
                    setDividendMasterForm({
                      stock_id: '',
                      asset_kind: 'us_stock',
                      dividend_month: 3,
                      calendar_year: '',
                      name_hint: '',
                      notes: '',
                    })
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
          {dividendMasterLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : dividendMasterRows.length === 0 ? (
            <p className="text-sm text-gray-500">No rows yet. Add via the form above or bulk SQL import.</p>
          ) : (
            <div className="max-h-80 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-gray-700 dark:text-gray-300">stock_id</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-700 dark:text-gray-300">Type</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-700 dark:text-gray-300">Month</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-700 dark:text-gray-300">Year</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-700 dark:text-gray-300">Name note</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-700 dark:text-gray-300" />
                  </tr>
                </thead>
                <tbody>
                  {dividendMasterRows.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">{row.stock_id}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.asset_kind}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.dividend_month}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.calendar_year ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 truncate max-w-[180px]" title={row.name_hint || ''}>{row.name_hint || '—'}</td>
                      <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setEditingDividendMasterId(row.id)
                            setDividendMasterForm({
                              stock_id: row.stock_id || '',
                              asset_kind: row.asset_kind || 'us_stock',
                              dividend_month: Number(row.dividend_month) || 1,
                              calendar_year: row.calendar_year != null ? String(row.calendar_year) : '',
                              name_hint: row.name_hint || '',
                              notes: row.notes || '',
                            })
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            setDividendMasterMessage(null)
                            if (!window.confirm('Delete this row?')) return
                            try {
                              await deleteDividendMasterRow(row.id)
                              setDividendMasterMessage({ type: 'success', text: 'Deleted.' })
                              await loadDividendMaster()
                            } catch (err) {
                              setDividendMasterMessage({ type: 'error', text: err?.message || 'Delete failed.' })
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">News page — manual items</h2>
            <Button type="button" variant="ghost" onClick={loadNewsPageManual}>Refresh</Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Manual news shown at the top of the News page. Editor is fixed to MoneyMart. Paste a direct image URL in the image field (e.g. https://example.com/image.jpg).
            <span className="block mt-1 text-gray-500 dark:text-gray-400">Published timestamp is set when you click Create / Update.</span>
          </p>
          <form onSubmit={async (e) => {
            e.preventDefault()
            setNewsPageManualMessage(null)
            const title = String(newsPageManualForm.title || '').trim()
            const content = String(newsPageManualForm.content || '').trim()
            const linkUrl = String(newsPageManualForm.linkUrl || '').trim()
            if (!title || !content) {
              setNewsPageManualMessage({ type: 'error', text: 'Title and content are required.' })
              return
            }
            if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
              setNewsPageManualMessage({ type: 'error', text: 'Link URL must start with http:// or https://.' })
              return
            }
            try {
              const imageUrl = String(newsPageManualForm.imageUrl || '').trim()
              const payload = {
                bucket: 'news_page_manual',
                source: 'MoneyMart',
                title,
                description: content,
                published_at: publishedAtNowIso(),
                sort_order: 0,
                is_active: true,
                image_url: imageUrl || null,
                url: linkUrl || null,
              }
              if (editingNewsPageManualId) {
                const { error } = await supabase.from('news_manual').update(payload).eq('id', editingNewsPageManualId)
                if (error) throw error
                setNewsPageManualMessage({ type: 'success', text: 'Updated.' })
              } else {
                const { error } = await supabase.from('news_manual').insert([payload])
                if (error) throw error
                setNewsPageManualMessage({ type: 'success', text: 'Created.' })
              }
              setNewsPageManualForm({ title: '', publishedAt: new Date().toISOString().slice(0, 10), content: '', imageUrl: '', linkUrl: '' })
              setEditingNewsPageManualId(null)
              try { sessionStorage.removeItem(NEWS_MANUAL_DRAFT_KEY) } catch { /* ignore */ }
              loadNewsPageManual()
            } catch (err) {
              setNewsPageManualMessage({ type: 'error', text: err?.message || 'Failed to save.' })
            }
          }} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
            <input
              value={newsPageManualForm.title}
              onChange={(e) => setNewsPageManualForm((p) => ({ ...p, title: e.target.value }))}
              className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Title (JP copy for the public site)"
              required
            />
            <input
              type="date"
              value={newsPageManualForm.publishedAt}
              onChange={(e) => setNewsPageManualForm((p) => ({ ...p, publishedAt: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              title="Draft memo only — DB publish time is set on save"
            />
            <textarea
              value={newsPageManualForm.content}
              onChange={(e) => setNewsPageManualForm((p) => ({ ...p, content: e.target.value }))}
              rows={3}
              className="md:col-span-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Body (shown on site — Japanese OK)"
              required
            />
            <input
              value={newsPageManualForm.imageUrl}
              onChange={(e) => setNewsPageManualForm((p) => ({ ...p, imageUrl: e.target.value }))}
              className="md:col-span-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Image URL (optional) e.g. https://example.com/image.jpg"
            />
            <input
              type="url"
              value={newsPageManualForm.linkUrl}
              onChange={(e) => setNewsPageManualForm((p) => ({ ...p, linkUrl: e.target.value }))}
              className="md:col-span-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Article link URL (optional) e.g. https://example.com/news-article"
            />
            <div className="md:col-span-4 flex gap-2">
              <Button type="submit" size="sm">{editingNewsPageManualId ? 'Update' : 'Create'}</Button>
              {editingNewsPageManualId && (
                <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingNewsPageManualId(null); setNewsPageManualForm({ title: '', publishedAt: new Date().toISOString().slice(0, 10), content: '', imageUrl: '', linkUrl: '' }); try { sessionStorage.removeItem(NEWS_MANUAL_DRAFT_KEY) } catch { /* ignore */ } }}>Cancel</Button>
              )}
            </div>
          </form>
          {newsPageManualMessage && (
            <p className={`text-sm mb-3 ${newsPageManualMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {newsPageManualMessage.text}
            </p>
          )}
          {newsPageManualLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : newsPageManualRows.length === 0 ? (
            <p className="text-sm text-gray-500">No manual news yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {newsPageManualRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-xs min-w-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{row.title}</p>
                    <p className="text-gray-500">{row.published_at ? new Date(row.published_at).toLocaleString('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'} · {row.source || 'MoneyMart'}</p>
                    {row.url ? <p className="text-gray-500 truncate">Link: {row.url}</p> : null}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" size="sm" onClick={() => { setEditingNewsPageManualId(row.id); setNewsPageManualForm({ title: row.title || '', publishedAt: (row.published_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10), content: row.description || '', imageUrl: row.image_url || '', linkUrl: row.url || '' }); }}>Edit</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={async () => { setNewsPageManualMessage(null); try { const { error } = await supabase.from('news_manual').delete().eq('id', row.id); if (error) throw error; setNewsPageManualMessage({ type: 'success', text: 'Deleted.' }); loadNewsPageManual(); } catch (err) { setNewsPageManualMessage({ type: 'error', text: err?.message }); } }}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Market page — major news (manual)</h2>
            <Button type="button" variant="ghost" onClick={loadMarketMajorNewsManual}>Refresh</Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Edit the Market page ticker panels manually. Choose one panel (グローバル / 米国 / 日本) per row — each item appears only on that panel. Title and body are the headline text; do not use region labels as the title anymore.
            <span className="block mt-1 text-gray-500 dark:text-gray-400">Published timestamp is set when you click Create / Update.</span>
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setMarketMajorNewsMessage(null)
              const title = String(marketMajorNewsForm.title || '').trim()
              const content = String(marketMajorNewsForm.content || '').trim()
              const section = String(marketMajorNewsForm.section || 'market_major_event')
              const marketRegion = String(marketMajorNewsForm.marketRegion || '').trim()
              const sortOrder = Number(marketMajorNewsForm.sortOrder || 0)
              if (!title || !content) {
                setMarketMajorNewsMessage({ type: 'error', text: 'Title and content are required.' })
                return
              }
              if (!['global', 'us', 'jp'].includes(marketRegion)) {
                setMarketMajorNewsMessage({ type: 'error', text: 'Panel (region) is required.' })
                return
              }
              try {
                const payload = {
                  bucket: section,
                  source: 'MoneyMart',
                  title,
                  description: content,
                  market_region: marketRegion,
                  published_at: publishedAtNowIso(),
                  sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
                  is_active: Boolean(marketMajorNewsForm.isActive),
                }
                if (editingMarketMajorNewsId) {
                  const { error } = await supabase.from('news_manual').update(payload).eq('id', editingMarketMajorNewsId)
                  if (error) throw error
                  setMarketMajorNewsMessage({ type: 'success', text: 'Updated.' })
                } else {
                  const { error } = await supabase.from('news_manual').insert([payload])
                  if (error) throw error
                  setMarketMajorNewsMessage({ type: 'success', text: 'Created.' })
                }
                setEditingMarketMajorNewsId(null)
                setMarketMajorNewsForm({
                  section: 'market_major_event',
                  marketRegion: 'global',
                  title: '',
                  publishedAt: new Date().toISOString().slice(0, 10),
                  content: '',
                  sortOrder: 0,
                  isActive: true,
                })
                loadMarketMajorNewsManual()
              } catch (err) {
                setMarketMajorNewsMessage({ type: 'error', text: err?.message || 'Failed to save.' })
              }
            }}
            className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3"
          >
            <select
              value={marketMajorNewsForm.section}
              onChange={(e) => setMarketMajorNewsForm((p) => ({ ...p, section: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="market_major_event">Major corporate / events</option>
              <option value="market_weekly_summary">Weekly results summary</option>
            </select>
            <select
              value={marketMajorNewsForm.marketRegion}
              onChange={(e) => setMarketMajorNewsForm((p) => ({ ...p, marketRegion: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              required
            >
              {MARKET_MAJOR_REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              value={marketMajorNewsForm.title}
              onChange={(e) => setMarketMajorNewsForm((p) => ({ ...p, title: e.target.value }))}
              className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Title (headline)"
              required
            />
            <input
              type="date"
              value={marketMajorNewsForm.publishedAt}
              onChange={(e) => setMarketMajorNewsForm((p) => ({ ...p, publishedAt: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              title="Memo only — DB publish time is set on save"
            />
            <input
              type="number"
              value={marketMajorNewsForm.sortOrder}
              onChange={(e) => setMarketMajorNewsForm((p) => ({ ...p, sortOrder: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="sort"
            />
            <textarea
              value={marketMajorNewsForm.content}
              onChange={(e) => setMarketMajorNewsForm((p) => ({ ...p, content: e.target.value }))}
              rows={3}
              className="md:col-span-6 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Body (shown on site — Japanese OK)"
              required
            />
            <label className="md:col-span-2 inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={Boolean(marketMajorNewsForm.isActive)}
                onChange={(e) => setMarketMajorNewsForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              is_active
            </label>
            <div className="md:col-span-4 flex gap-2">
              <Button type="submit" size="sm">{editingMarketMajorNewsId ? 'Update' : 'Create'}</Button>
              {editingMarketMajorNewsId && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingMarketMajorNewsId(null)
                    setMarketMajorNewsForm({
                      section: 'market_major_event',
                      marketRegion: 'global',
                      title: '',
                      publishedAt: new Date().toISOString().slice(0, 10),
                      content: '',
                      sortOrder: 0,
                      isActive: true,
                    })
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
          {marketMajorNewsMessage && (
            <p className={`text-sm mb-3 ${marketMajorNewsMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {marketMajorNewsMessage.text}
            </p>
          )}
          {marketMajorNewsLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : marketMajorNewsRows.length === 0 ? (
            <p className="text-sm text-gray-500">No rows yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {marketMajorNewsRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-xs min-w-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{row.title}</p>
                    <p className="text-gray-500">
                      {(row.bucket === 'market_weekly_summary') ? 'Weekly results summary' : 'Major corporate / events'}
                      {' · '}
                      {MARKET_MAJOR_REGION_OPTIONS.find((o) => o.value === row.market_region)?.label || row.market_region || '—'}
                      {' · '}
                      {row.published_at ? new Date(row.published_at).toLocaleString('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                      {' · sort '}
                      {Number(row.sort_order || 0)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setEditingMarketMajorNewsId(row.id)
                        setMarketMajorNewsForm({
                          section: row.bucket || 'market_major_event',
                          marketRegion: row.market_region || 'global',
                          title: row.title || '',
                          publishedAt: (row.published_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
                          content: row.description || '',
                          sortOrder: Number(row.sort_order || 0),
                          isActive: Boolean(row.is_active),
                        })
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        setMarketMajorNewsMessage(null)
                        try {
                          const { error } = await supabase.from('news_manual').delete().eq('id', row.id)
                          if (error) throw error
                          setMarketMajorNewsMessage({ type: 'success', text: 'Deleted.' })
                          loadMarketMajorNewsManual()
                        } catch (err) {
                          setMarketMajorNewsMessage({ type: 'error', text: err?.message || 'Failed to delete.' })
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Insights editor</h2>
            <Button type="button" variant="ghost" onClick={loadInsights} disabled={insightsLoading}>
              {insightsLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Create and edit insight articles. Published rows (`is_published=true`) appear on `/insights`. Article body/category text can stay Japanese for the public site.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                if (insightEditorMode === 'json') {
                  try {
                    const parsed = JSON.parse(String(insightJsonDraft || '{}'))
                    const next = { ...buildDefaultInsightForm(), ...parsed }
                    setInsightForm(next)
                    setInsightSimpleForm(insightFormToSimple(next))
                  } catch {
                    setInsightsMessage({ type: 'error', text: 'Invalid JSON — cannot switch back to simple editor.' })
                    return
                  }
                }
                setInsightEditorMode('simple')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                insightEditorMode === 'simple'
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              Simple editor
            </button>
            <button
              type="button"
              onClick={() => {
                if (insightEditorMode === 'simple') {
                  const next = simpleToInsightForm(insightSimpleForm)
                  setInsightForm(next)
                  setInsightJsonDraft(JSON.stringify(next, null, 2))
                }
                setInsightEditorMode('json')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                insightEditorMode === 'json'
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              JSON mode
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              await saveInsight()
            }}
            className="space-y-3 mb-3"
          >
            {insightEditorMode === 'simple' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 dark:border-slate-600 bg-slate-900 text-white p-4 shadow-md">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <input
                      value={insightSimpleForm.headline}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, headline: e.target.value }))}
                      className="flex-1 min-w-0 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm font-bold text-white placeholder:text-slate-500"
                      placeholder="Title"
                      required
                    />
                    <select
                      value={insightSimpleForm.category}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, category: e.target.value }))}
                      className="shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm font-bold text-white sm:min-w-[11rem]"
                      aria-label="Category"
                    >
                      {[
                        ...INSIGHT_CATEGORY_OPTIONS,
                        ...(insightSimpleForm.category
                          && !INSIGHT_CATEGORY_OPTIONS.some((o) => o.value === insightSimpleForm.category)
                          ? [{ value: insightSimpleForm.category, label: insightSimpleForm.category }]
                          : []),
                      ].map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 space-y-1">
                    <label className="block text-[11px] font-bold tracking-wide text-slate-400" htmlFor="mm-insight-url-slug">
                      URL slug (public path — lowercase ASCII, digits, hyphens)
                    </label>
                    <input
                      id="mm-insight-url-slug"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={insightSimpleForm.urlSlug}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, urlSlug: e.target.value }))}
                      className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-mono text-slate-100 placeholder:text-slate-500"
                      placeholder="e.g. fragmented-world-investors-part-2"
                    />
                    <p className="text-[10px] leading-relaxed text-slate-500">
                      Public URL{' '}
                      <span className="text-amber-300/90">
                        /insights/
                        {normalizeInsightUrlSlug(insightSimpleForm.urlSlug)
                          || '(blank: auto on create, keep existing when editing)'}
                      </span>
                    </p>
                  </div>
                  <textarea
                    rows={3}
                    value={insightSimpleForm.summary}
                    onChange={(e) => setInsightSimpleForm((p) => ({ ...p, summary: e.target.value }))}
                    className="mt-3 w-full resize-y rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 leading-relaxed"
                    placeholder="Short summary for list / preview (required)"
                    required
                  />
                  <div className="mt-4 space-y-2">
                    <label className="block text-[11px] font-bold tracking-wide text-slate-400">
                      Cover image for list / article header (optional)
                    </label>
                    <p className="text-[10px] leading-relaxed text-slate-500">
                      Uploads to Storage bucket &quot;{INSIGHT_COVER_IMAGE_BUCKET}&quot; (shared with news images). You can also paste a public URL.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                        disabled={insightCoverUploading}
                        onChange={handleInsightCoverFileChange}
                      />
                      {insightCoverUploading ? <span className="text-xs text-amber-300">Uploading…</span> : null}
                    </div>
                    <input
                      value={insightSimpleForm.coverImageUrl}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, coverImageUrl: e.target.value }))}
                      className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500"
                      placeholder="https://… (public image URL)"
                    />
                    {insightSimpleForm.coverImageUrl ? (
                      <div className="overflow-hidden rounded-lg border border-slate-600 bg-slate-950/50">
                        <img
                          src={insightSimpleForm.coverImageUrl}
                          alt=""
                          className="max-h-32 w-full object-cover"
                          onError={(ev) => {
                            ev.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-slate-800 dark:border-slate-500 bg-white dark:bg-gray-900 overflow-hidden">
                  <div className="bg-slate-900 text-white px-4 py-2.5">
                    <div className="text-xs font-black tracking-wider">main · body (rich editor)</div>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      Use the <span className="text-amber-300 font-bold">orange toolbar</span> below for bold, lists, etc. If you only see a plain textarea, deploy the latest build.
                    </p>
                  </div>
                  <InsightRichEditor
                    value={insightSimpleForm.mainCombined}
                    onChange={(html) => setInsightSimpleForm((p) => ({ ...p, mainCombined: html }))}
                    placeholder="Article body (thesis / analysis). Use the thesis/evidence divider in the toolbar, or a lone --- line in plain text."
                  />
                </div>

                <div className="rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-4">
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 tracking-wide mb-1.5">Keywords</label>
                  <input
                    value={insightSimpleForm.keywordsText}
                    onChange={(e) => setInsightSimpleForm((p) => ({ ...p, keywordsText: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
                    placeholder="e.g. NISA, rates, FX — comma / space / newline separated (#tags OK)"
                  />
                </div>

                <div className="rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-4">
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 tracking-wide mb-1.5">Related MoneyMart links</label>
                  <textarea
                    rows={4}
                    value={insightSimpleForm.relatedToolsText}
                    onChange={(e) => setInsightSimpleForm((p) => ({ ...p, relatedToolsText: e.target.value }))}
                    className="w-full resize-y rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm leading-relaxed"
                    placeholder={'One internal link per line. e.g. /etf-compare, https://…\nOptional label: Display name | URL'}
                  />
                </div>

                <details className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-gray-700 dark:text-gray-300">Advanced (target, risk, data notes, publish)</summary>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={insightSimpleForm.target}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, target: e.target.value }))}
                      className="md:col-span-2 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      placeholder="Target badge (optional)"
                    />
                    <textarea
                      rows={4}
                      value={insightSimpleForm.risk}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, risk: e.target.value }))}
                      className="min-h-[100px] resize-y px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm leading-relaxed"
                      placeholder="Risk factors (JP for public site)"
                    />
                    <input
                      value={insightSimpleForm.dataNote}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, dataNote: e.target.value }))}
                      className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      placeholder="Data notes (JP for public site)"
                    />
                    <label className="md:col-span-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                      <input
                        type="checkbox"
                        checked={insightSimpleForm.tickerEnabled}
                        onChange={(e) => setInsightSimpleForm((p) => ({ ...p, tickerEnabled: e.target.checked }))}
                      />
                      Tickers (one line: label|value|change|up/down)
                    </label>
                    <textarea
                      rows={4}
                      value={insightSimpleForm.tickerRaw}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, tickerRaw: e.target.value }))}
                      className="md:col-span-2 min-h-[100px] resize-y px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-mono leading-relaxed disabled:opacity-50"
                      placeholder={'BRENT|$82.1|+0.4%|up\nGOLD|$2,650|-0.2%|down'}
                      disabled={!insightSimpleForm.tickerEnabled}
                    />
                    <input
                      type="date"
                      value={insightSimpleForm.publishedAt}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, publishedAt: e.target.value }))}
                      className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      required
                    />
                    <input
                      value={insightSimpleForm.readTime}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, readTime: e.target.value }))}
                      className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      placeholder="Read time e.g. 5 min (JP: 5分 on site)"
                    />
                    <input
                      type="number"
                      value={insightSimpleForm.sortOrder}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, sortOrder: Number(e.target.value || 0) }))}
                      className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      placeholder="Sort"
                    />
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                      <input
                        type="checkbox"
                        checked={insightSimpleForm.featured}
                        onChange={(e) => setInsightSimpleForm((p) => ({ ...p, featured: e.target.checked }))}
                      />
                      Featured
                    </label>
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                      <input
                        type="checkbox"
                        checked={insightSimpleForm.isActive}
                        onChange={(e) => setInsightSimpleForm((p) => ({ ...p, isActive: e.target.checked }))}
                      />
                      Published
                    </label>
                  </div>
                </details>
              </div>
            ) : (
              <div>
                <textarea
                  rows={24}
                  value={insightJsonDraft}
                  onChange={(e) => setInsightJsonDraft(e.target.value)}
                  className="w-full min-h-[420px] resize-y px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-mono leading-relaxed"
                />
              </div>
            )}

            <div className="md:col-span-6 flex gap-2">
              <Button type="submit" size="sm">{editingInsightId ? 'Update' : 'Create'}</Button>
              {editingInsightId ? (
                <Button type="button" size="sm" variant="ghost" onClick={resetInsightForm}>Cancel</Button>
              ) : null}
            </div>
          </form>
          {insightsMessage ? (
            <p className={`text-sm mb-3 ${insightsMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {insightsMessage.text}
            </p>
          ) : null}
          {insightsLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : insightsRows.length === 0 ? (
            <p className="text-sm text-gray-500">No insights yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {insightsRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-xs min-w-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{row.headline}</p>
                    <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate" title={row.slug}>
                      /insights/{row.slug || '—'}
                    </p>
                    <p className="text-gray-500">
                      {row.published_at ? new Date(row.published_at).toLocaleDateString('en-US') : '-'}
                      {' · '}
                      {row.category || '-'}
                      {row.featured ? ' · FEATURED' : ''}
                      {!row.is_active ? ' · UNPUBLISHED' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" size="sm" onClick={() => editInsight(row)}>Edit</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => deleteInsight(row.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

<Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Lounge — key digest</h2>
            <Button type="button" onClick={handleRefreshDigest} disabled={digestRefreshLoading}>
              {digestRefreshLoading ? 'Refreshing…' : 'Refresh digest'}
            </Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Regenerates the &quot;today&apos;s key digest&quot; card at the top of Lounge immediately.
          </p>
          {digestRefreshMessage ? (
            <p className={`text-sm mt-3 ${digestRefreshMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {digestRefreshMessage.text}
            </p>
          ) : null}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Refinance rate master</h2>
            <Button type="button" variant="ghost" onClick={loadRefinanceProducts}>Refresh</Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Manage bank refinance candidate rates for the AI refinance agent.
          </p>
          <form onSubmit={handleSaveRefinance} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
            <input
              name="bankName"
              value={refinanceForm.bankName}
              onChange={handleRefinanceFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Bank name"
              required
            />
            <input
              name="productName"
              value={refinanceForm.productName}
              onChange={handleRefinanceFormChange}
              className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Product name"
              required
            />
            <input
              name="aprMin"
              type="number"
              step="0.001"
              value={refinanceForm.aprMin}
              onChange={handleRefinanceFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="APR min"
              required
            />
            <input
              name="aprMax"
              type="number"
              step="0.001"
              value={refinanceForm.aprMax}
              onChange={handleRefinanceFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="APR max"
              required
            />
            <input
              name="feesYen"
              type="number"
              value={refinanceForm.feesYen}
              onChange={handleRefinanceFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Fee (JPY)"
            />
            <input
              name="minAmountYen"
              type="number"
              value={refinanceForm.minAmountYen}
              onChange={handleRefinanceFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Min amount"
            />
            <input
              name="maxAmountYen"
              type="number"
              value={refinanceForm.maxAmountYen}
              onChange={handleRefinanceFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Max amount"
            />
            <input
              name="applyUrl"
              type="url"
              value={refinanceForm.applyUrl}
              onChange={handleRefinanceFormChange}
              className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="https://..."
            />
            <select
              name="sourceType"
              value={refinanceForm.sourceType}
              onChange={handleRefinanceFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="manual">manual</option>
              <option value="scrape">scrape</option>
            </select>
            <input
              name="sortOrder"
              type="number"
              value={refinanceForm.sortOrder}
              onChange={handleRefinanceFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Sort order"
            />
            <input
              name="notes"
              value={refinanceForm.notes}
              onChange={handleRefinanceFormChange}
              className="md:col-span-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Notes"
            />
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                name="isActive"
                type="checkbox"
                checked={refinanceForm.isActive}
                onChange={handleRefinanceFormChange}
              />
              Active
            </label>
            <div className="md:col-span-6 flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                {editingRefinanceId ? 'Update' : 'Create'}
              </Button>
              {editingRefinanceId ? (
                <Button type="button" size="sm" variant="ghost" onClick={resetRefinanceForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
          {refinanceMessage ? (
            <p className={`text-sm mb-3 ${refinanceMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {refinanceMessage.text}
            </p>
          ) : null}
          {refinanceLoading ? (
            <p className="text-sm text-gray-500">Loading refinance products...</p>
          ) : refinanceRows.length === 0 ? (
            <p className="text-sm text-gray-500">No refinance products found.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {refinanceRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-bold text-gray-900 dark:text-gray-100">{row.bank_name}</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-300">{row.product_name}</span>
                    <span className="ml-2 text-blue-600 dark:text-blue-300">{Number(row.apr_min || 0).toFixed(3)}% - {Number(row.apr_max || 0).toFixed(3)}%</span>
                    <span className="ml-2 text-gray-500">fee ¥{Number(row.fees_yen || 0).toLocaleString('en-US')}</span>
                    <span className="ml-2 text-gray-500">range ¥{Number(row.min_amount_yen || 0).toLocaleString('en-US')} - ¥{Number(row.max_amount_yen || 0).toLocaleString('en-US')}</span>
                    <span className="ml-2 text-gray-400">order {row.sort_order}</span>
                    <span className={`ml-2 font-bold ${row.is_active ? 'text-emerald-600' : 'text-rose-600'}`}>{row.is_active ? 'active' : 'inactive'}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => handleStartEditRefinance(row)}>Edit</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleDeleteRefinance(row.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {showAdvancedOperations && (
          <>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Earnings Calendar (Manual)</h2>
            <Button type="button" variant="ghost" onClick={loadEarnings}>Refresh</Button>
          </div>
          <form onSubmit={handleSaveEarnings} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
            <select
              name="region"
              value={earningsForm.region}
              onChange={handleEarningsFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="US">US</option>
              <option value="JP">JP</option>
              <option value="UK">UK</option>
              <option value="EU">EU</option>
            </select>
            <input
              name="symbol"
              value={earningsForm.symbol}
              onChange={handleEarningsFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Symbol"
              required
            />
            <input
              name="company"
              value={earningsForm.company}
              onChange={handleEarningsFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Company"
              required
            />
            <input
              name="whenText"
              value={earningsForm.whenText}
              onChange={handleEarningsFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Wed 16:00 ET"
              required
            />
            <input
              name="phase"
              value={earningsForm.phase}
              onChange={handleEarningsFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="BMO / AMC"
            />
            <input
              name="sortOrder"
              type="number"
              value={earningsForm.sortOrder}
              onChange={handleEarningsFormChange}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="Order"
            />
            <label className="md:col-span-2 inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                name="isActive"
                type="checkbox"
                checked={earningsForm.isActive}
                onChange={handleEarningsFormChange}
              />
              Active
            </label>
            <div className="md:col-span-4 flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                {editingEarningsId ? 'Update' : 'Create'}
              </Button>
              {editingEarningsId ? (
                <Button type="button" size="sm" variant="ghost" onClick={resetEarningsForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
          {earningsMessage ? (
            <p className={`text-sm mb-3 ${earningsMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {earningsMessage.text}
            </p>
          ) : null}
          {earningsLoading ? (
            <p className="text-sm text-gray-500">Loading earnings rows...</p>
          ) : earningsRows.length === 0 ? (
            <p className="text-sm text-gray-500">No earnings rows found.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {earningsRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-bold text-gray-900 dark:text-gray-100">{row.region} / {row.symbol}</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-300">{row.company}</span>
                    <span className="ml-2 text-gray-500">{row.when_text}</span>
                    {row.phase ? <span className="ml-2 text-orange-500 font-bold">{row.phase}</span> : null}
                    <span className="ml-2 text-gray-400">order {row.sort_order}</span>
                    <span className={`ml-2 font-bold ${row.is_active ? 'text-emerald-600' : 'text-rose-600'}`}>{row.is_active ? 'active' : 'inactive'}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => handleStartEditEarnings(row)}>Edit</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleDeleteEarnings(row.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>


        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="cards">Credit Cards</option>
                <option value="savings">Savings</option>
                <option value="loans">Loans</option>
                <option value="insurance">Insurance</option>
                <option value="points">Points</option>
                <option value="brokerage">Brokerage (stock page execution compare)</option>
              </select>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Product Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="Enter product name"
              />
            </div>
            <div>
              <label htmlFor="link" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Link
              </label>
              <input
                id="link"
                name="link"
                type="url"
                value={formData.link}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="https://..."
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="Enter product description"
              />
            </div>
            <div>
              <label htmlFor="spec" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Specs
              </label>
              <textarea
                id="spec"
                name="spec"
                rows={3}
                value={formData.spec}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="Specs (JSON supported)"
              />
            </div>
            {message && (
              <p className={`text-sm ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {message.text}
              </p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Product'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Products / Edit / Visibility</h2>
            <Button type="button" variant="ghost" onClick={loadProducts}>Refresh</Button>
          </div>
          {productMessage ? (
            <p className={`text-sm mb-3 ${productMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {productMessage.text}
            </p>
          ) : null}
          {productLoading ? (
            <p className="text-sm text-gray-500">Loading product list...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-gray-500">No products found.</p>
          ) : (
            <div className="space-y-3">
              {products.map((product) => {
                const editing = editingProductId === product.id
                return (
                  <div key={product.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">#{product.id}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{product.category || 'uncategorized'}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${product.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'}`}>
                        {product.is_active ? 'Published' : 'Hidden'}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(product.created_at).toLocaleString('en-US')}</span>
                    </div>

                    {editing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <select
                            name="category"
                            value={editProductForm.category}
                            onChange={handleEditProductChange}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                          >
                            <option value="cards">Credit Cards</option>
                            <option value="savings">Savings</option>
                            <option value="loans">Loans</option>
                            <option value="insurance">Insurance</option>
                            <option value="points">Points</option>
                            <option value="brokerage">Brokerage (stock page execution compare)</option>
                          </select>
                          <input
                            name="name"
                            value={editProductForm.name}
                            onChange={handleEditProductChange}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                            placeholder="Product name"
                          />
                        </div>
                        <input
                          name="link"
                          value={editProductForm.link}
                          onChange={handleEditProductChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                          placeholder="https://..."
                        />
                        <textarea
                          name="description"
                          rows={2}
                          value={editProductForm.description}
                          onChange={handleEditProductChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                          placeholder="Description"
                        />
                        <textarea
                          name="spec"
                          rows={2}
                          value={editProductForm.spec}
                          onChange={handleEditProductChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                          placeholder="Specs"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={() => handleSaveProductEdit(product.id)}>Save</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={handleCancelEditProduct}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{product.name}</p>
                        <p className="text-xs text-gray-500 mt-1 break-all">{product.link || '-'}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{product.description || '-'}</p>
                        <p className="text-xs text-gray-500 mt-1">{product.spec || '-'}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button type="button" size="sm" onClick={() => handleStartEditProduct(product)}>Edit</Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={product.is_active ? 'ghost' : 'secondary'}
                            onClick={() => handleToggleProductActive(product)}
                          >
                            {product.is_active ? 'Hide' : 'Publish'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Academy Course Registration (YouTube)</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Only 5 fields are required. All other fields use system defaults.
          </p>
          <form onSubmit={handleAcademySubmit} className="space-y-4">
            <div>
              <label htmlFor="academy-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Course Title *
              </label>
              <input
                id="academy-title"
                name="title"
                type="text"
                required
                value={academyForm.title}
                onChange={handleAcademyChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="e.g. New NISA Basics #1"
              />
            </div>
            <div>
              <label htmlFor="academy-youtube" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                YouTube URL *
              </label>
              <input
                id="academy-youtube"
                name="youtubeUrl"
                type="url"
                required
                value={academyForm.youtubeUrl}
                onChange={handleAcademyChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="academy-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  id="academy-category"
                  name="categoryKey"
                  value={academyForm.categoryKey}
                  onChange={handleAcademyChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="general">General</option>
                  <option value="beginner">Beginner</option>
                  <option value="analysis">Analysis</option>
                </select>
              </div>
              <div>
                <label htmlFor="academy-level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Level
                </label>
                <select
                  id="academy-level"
                  name="level"
                  value={academyForm.level}
                  onChange={handleAcademyChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="初級">Beginner</option>
                  <option value="中級">Intermediate</option>
                  <option value="上級">Advanced</option>
                </select>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="isFeatured"
                checked={academyForm.isFeatured}
                onChange={handleAcademyChange}
              />
              Set as featured course
            </label>
            {academyMessage ? (
              <p className={`text-sm ${academyMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {academyMessage.text}
              </p>
            ) : null}
            <Button type="submit" disabled={academyLoading}>
              {academyLoading ? 'Creating...' : 'Create Course'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Lounge Report Moderation</h2>
            <div className="flex items-center gap-2">
              <select
                value={reportStatusFilter}
                onChange={(e) => {
                  const value = e.target.value
                  setReportStatusFilter(value)
                  loadReports(value)
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              >
                <option value="all">All</option>
                <option value="submitted">Submitted</option>
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
              <Button type="button" variant="ghost" onClick={() => loadReports(reportStatusFilter)}>
                Refresh
              </Button>
            </div>
          </div>
          {reportLoading ? (
            <p className="text-sm text-gray-500">Loading reports...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-gray-500">No reports found.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      #{report.id}
                    </span>
                    <span className="text-xs font-bold px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                      {report.target_type}
                    </span>
                    <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {report.status}
                    </span>
                    <span className="text-xs text-gray-500">{new Date(report.created_at).toLocaleString('en-US')}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Reason: {report.reason}</p>
                  {report.details ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Details: {report.details}</p>
                  ) : null}
                  <p className="text-xs text-gray-500 mt-1">
                    target post: {report.target_post_id || '-'} / comment: {report.target_comment_id || '-'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button type="button" size="sm" onClick={() => handleUpdateReportStatus(report.id, 'reviewing')}>
                      Mark Reviewing
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => handleModerateTarget(report)}>
                      Hide Target + Resolve
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleRestoreTarget(report)}>
                      Restore Target + Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
          </>
        )}
          </div>
        )}
      </div>
    </div>
  )
}
