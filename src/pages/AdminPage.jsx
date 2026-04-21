import { useEffect, useMemo, useState } from 'react'
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
import { fetchAdminReports, updateCommentStatus, updatePostStatus, updateReportStatus } from '../lib/loungeApi'
import { Activity, AlertTriangle, BookOpen, Database, Download, Globe2, LayoutDashboard, MousePointerClick, Package, Search, Timer, Users } from 'lucide-react'
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../data/etfListFromXlsx'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { publishedAtNoonTokyoFromDateOnly, publishedAtNowIso } from '../lib/newsPublishedAt'
import {
  fetchDividendMasterSchedule,
  insertDividendMasterRow,
  updateDividendMasterRow,
  deleteDividendMasterRow,
} from '../lib/dividendMasterScheduleApi'

const formatAnalyticsDuration = (value) => {
  const ms = Number(value || 0)
  if (!Number.isFinite(ms) || ms <= 0) return '-'
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)} min`
  return `${Math.round(ms / 1000)} sec`
}

const formatAnalyticsLoadError = (err) => {
  const message = String(err?.message || err || '')
  if (
    message.includes("Could not find the table 'public.site_analytics_events' in the schema cache")
    || message.includes("relation \"public.site_analytics_events\" does not exist")
    || message.includes("Could not find the table 'public.site_analytics_top_pages_30d' in the schema cache")
  ) {
    return 'Supabase analytics テーブル/ビューがまだありません。`SUPABASE_SETUP_SITE_ANALYTICS.sql` を先に実行してから再読み込みしてください。'
  }
  if (
    message.toLowerCase().includes('admin_site_analytics_dashboard')
    && (message.includes('does not exist') || message.includes('Could not find') || message.includes('schema cache'))
  ) {
    return '集計RPCがありません。`SUPABASE_ADMIN_SITE_ANALYTICS_DASHBOARD_RPC.sql` を Supabase SQL Editor で実行してから再読み込みしてください。（未適用時は最大2万件までブラウザで要約します。）'
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

const formatAnalyticsDeltaPct = (current, prev) => {
  const c = Number(current || 0)
  const p = Number(prev || 0)
  if (c === 0 && p === 0) return null
  if (p === 0) return c > 0 ? '+ (prior 0)' : null
  const pct = ((c - p) / p) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
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
  if (path === '/' || path === '') return 'home'
  return 'other'
}

const PAGE_BUCKET_LABELS = {
  funds_list: 'Funds / ETF list (/funds)',
  fund_detail: 'Fund detail (/funds/:id)',
  fund_compare: 'Fund compare (/funds/compare, /etf-compare)',
  stocks: 'Stocks (/stocks)',
  mypage: 'My page (/mypage)',
  tools: 'Tools hub (/tools)',
  market: 'Market (/market)',
  insights: 'Insights (/insights)',
  products: 'Products (/products)',
  home: 'Home (/)',
  other: 'Other routes',
}

const buildProductDashboardRollups = (analytics) => {
  const topPages = Array.isArray(analytics?.topPages) ? analytics.topPages : []
  const buckets = new Map()
  for (const row of topPages) {
    const key = bucketPagePath(row.page_path)
    const cur = buckets.get(key) || { views: 0, uniqueSessionsSum: 0, dwellWeighted: 0, dwellWeight: 0 }
    const views = Number(row.views || 0)
    cur.views += views
    cur.uniqueSessionsSum += Number(row.unique_sessions || 0)
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

  return { rollups, fundClicks, watchHints }
}

const formatCrmLoadError = (err) => {
  const message = String(err?.message || err || '')
  if (
    message.includes('admin_crm_users')
    && (message.includes('does not exist') || message.includes('schema cache') || message.includes('Could not find'))
  ) {
    return 'CRM is not set up yet: the `admin_crm_users` RPC is missing. Run `SUPABASE_CRM_SIGNUP_ATTRIBUTION.sql` in the Supabase SQL editor, then reload.'
  }
  if (message.toLowerCase().includes('not allowed')) return 'Admin access required.'
  if (message.includes('signup_referrer_domain')) {
    return 'Signup attribution columns are missing on `user_profiles`. Run `SUPABASE_CRM_SIGNUP_ATTRIBUTION.sql` in Supabase.'
  }
  return message || 'Failed to load CRM data.'
}

const ADMIN_TAB_VALID = new Set(['dashboard', 'operations', 'analytics', 'crm'])
const ADMIN_TAB_STORAGE_KEY = 'mm_admin_active_tab'
const ADMIN_ANALYTICS_SECTION_KEY = 'mm_admin_analytics_section'
const NEWS_MANUAL_DRAFT_KEY = 'mm_admin_news_manual_draft'
const INSIGHT_DRAFT_KEY = 'mm_admin_insight_draft'
const INSIGHTS_DEFAULT_READ_TIME = '5分'
/** かんたん入力：本文内で「テーゼ」と「根拠」を分ける区切り（プレーンテキスト時・1行） */
const INSIGHT_BODY_DELIM = INSIGHT_BODY_DELIM_PLAIN
const INSIGHT_CATEGORY_OPTIONS = ['インサイト', 'マーケット', 'ETF分析']
/** ニュース画像と同じ公開バケット（`SUPABASE_SETUP_NEWS_IMAGES_STORAGE.sql`） */
const INSIGHT_COVER_IMAGE_BUCKET = 'news-images'

const buildDefaultInsightSimpleForm = () => ({
  headline: '',
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

const parseInsightKeywordsText = (value) => (
  String(value || '')
    .split(/[,、\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
)

const slugifyInsightHeadline = (value) => {
  const base = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ぁ-んァ-ン一-龯\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'insight'
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

  const sections = [
    {
      type: 'prose',
      kicker: '// MARKET INSIGHT',
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
        '※本ページは情報提供を目的としたものであり、特定の金融商品の購入・売却を推奨するものではありません。投資判断はご自身の責任において行ってください。',
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
  const initialTab = ADMIN_TAB_VALID.has(resolvedTab) ? resolvedTab : 'dashboard'
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    const t = searchParams.get('tab') || tabFromStorage || 'dashboard'
    const validTab = ADMIN_TAB_VALID.has(t) ? t : 'dashboard'
    setActiveTab(validTab)
    if (!searchParams.get('tab') && validTab !== 'dashboard') {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', validTab)
        return next
      })
    }
  }, [searchParams])

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
    signupsToday: 0,
    saveSuccessRate: 0,
    latestStockDate: null,
    latestFundDate: null,
    daily: [],
  })
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState(30)
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
  })
  const productDashboard = useMemo(() => buildProductDashboardRollups(analytics), [analytics])
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmError, setCrmError] = useState('')
  const [crmRows, setCrmRows] = useState([])
  const [crmFilter, setCrmFilter] = useState('')
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
          throw new Error('要約APIが見つかりません。開発サーバーを再起動してください。')
        }
        throw new Error(json?.error || `要約の更新に失敗しました。(HTTP ${resp.status})`)
      }
      if (!json?.ok) throw new Error(json?.error || '要約の更新に失敗しました。')
      setDigestRefreshMessage({
        type: 'success',
        text: `要約を更新しました（${json.slot === 'pm' ? '午後' : '午前'}スロット）`,
      })
    } catch (err) {
      setDigestRefreshMessage({ type: 'error', text: err.message || '要約の更新に失敗しました。' })
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
        .select('id,bucket,title,description,published_at,source,sort_order,is_active,updated_at')
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
          ? 'テーブルがありません。Supabase で `SUPABASE_SETUP_DIVIDEND_MASTER_SCHEDULE.sql` を実行してください。'
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
      if (file) setInsightsMessage({ type: 'error', text: '画像ファイル（JPEG/PNG/WebP 等）を選んでください。' })
      return
    }
    setInsightCoverUploading(true)
    setInsightsMessage(null)
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser()
      if (authErr || !auth?.user) {
        setInsightsMessage({ type: 'error', text: 'ログインが必要です（Storage にアップロードするため）。' })
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
      if (!url) throw new Error('公開URLを取得できませんでした')
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
      setInsightsMessage({ type: 'success', text: 'カバー画像をアップロードしました。Create/Update で保存してください。' })
    } catch (err) {
      setInsightsMessage({ type: 'error', text: err?.message || 'アップロードに失敗しました。' })
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
        setInsightsMessage({ type: 'error', text: 'JSONモードの内容が不正です。JSON形式を確認してください。' })
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
    const slugBase = slugifyInsightHeadline(headline)
    const payload = {
      slug: editingRow?.slug || `${slugBase}-${Date.now().toString().slice(-6)}`,
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
      setInsightsMessage({ type: 'error', text: err?.message || 'Failed to save insight.' })
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
          if (!hasVLatest) issues.push('v_stock_latestなし')
          if (historyCount < 100) issues.push(`履歴${historyCount}件`)
          if (!hasTrustFee) issues.push('信託報酬なし')
          if (!hasNisa) issues.push('NISA区分なし')
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
      let signupsToday = 0
      let saveSuccessRate = 0
      const { data: adminDailyMetrics, error: dailyMetricErr } = await supabase
        .from('admin_daily_metrics')
        .select('metric_date,dau,signup_count,mypage_save_success_rate')
        .order('metric_date', { ascending: false })
        .limit(7)
      if (!dailyMetricErr && Array.isArray(adminDailyMetrics) && adminDailyMetrics.length > 0) {
        const latest = adminDailyMetrics[0]
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

  const loadAnalyticsClientFallback = async (safeRangeDays) => {
    const sinceIso = new Date(Date.now() - (safeRangeDays * 24 * 60 * 60 * 1000)).toISOString()
    const { data, error } = await supabase
      .from('site_analytics_events')
      .select('event_name,page_path,session_id,user_id,referrer_domain,source,medium,campaign,dwell_ms,event_meta,created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(20000)

    if (error) throw error

    const rows = Array.isArray(data) ? data : []
    const pageViewEvents = rows.filter((row) => row.event_name === 'page_view')
    const searchEvents = rows.filter((row) => row.event_name === 'search')
    const productEvents = rows.filter((row) => ANALYTICS_CLICK_EVENTS.has(row.event_name))
    const landingEvents = pageViewEvents.filter((row) => String(row.referrer_domain || row.source || row.medium || '').trim() !== '')
    const pageExitEvents = rows.filter((row) => row.event_name === 'page_exit' && Number(row.dwell_ms || 0) > 0)

    const topPagesMap = new Map()
    pageViewEvents.forEach((row) => {
      const key = row.page_path || '/'
      const entry = topPagesMap.get(key) || { page_path: key, views: 0, uniqueSessions: new Set(), dwellTotal: 0, dwellCount: 0 }
      entry.views += 1
      if (row.session_id) entry.uniqueSessions.add(row.session_id)
      topPagesMap.set(key, entry)
    })
    pageExitEvents.forEach((row) => {
      const key = row.page_path || '/'
      const entry = topPagesMap.get(key) || { page_path: key, views: 0, uniqueSessions: new Set(), dwellTotal: 0, dwellCount: 0 }
      entry.dwellTotal += Number(row.dwell_ms || 0)
      entry.dwellCount += 1
      topPagesMap.set(key, entry)
    })
    const topPages = [...topPagesMap.values()]
      .map((entry) => ({
        page_path: entry.page_path,
        views: entry.views,
        unique_sessions: entry.uniqueSessions.size,
        avg_dwell_ms: entry.dwellCount > 0 ? entry.dwellTotal / entry.dwellCount : 0,
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
      .map((row) => Number(row.dwell_ms || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
    const avgDwellMs = dwellValues.length > 0
      ? dwellValues.reduce((sum, value) => sum + value, 0) / dwellValues.length
      : 0

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
    })
  }

  const loadAnalytics = async (rangeDays = analyticsRangeDays) => {
    setAnalyticsLoading(true)
    setAnalyticsError('')
    const clamped = Math.max(1, Math.min(366, Number(rangeDays || 30)))
    try {
      const { data, error } = await supabase.rpc('admin_site_analytics_dashboard', { p_days: clamped })
      if (error) throw error
      if (data == null || typeof data !== 'object') throw new Error('Empty analytics response')
      setAnalytics(mapAnalyticsRpcPayload(data))
    } catch (err) {
      if (isAnalyticsRpcMissingError(err)) {
        try {
          await loadAnalyticsClientFallback(clamped)
        } catch (e2) {
          setAnalyticsError(formatAnalyticsLoadError(e2))
        }
      } else {
        setAnalyticsError(formatAnalyticsLoadError(err))
      }
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const loadCrm = async () => {
    setCrmLoading(true)
    setCrmError('')
    try {
      const { data, error } = await supabase.rpc('admin_crm_users', { p_limit: 300 })
      if (error) throw error
      setCrmRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setCrmError(formatCrmLoadError(err))
      setCrmRows([])
    } finally {
      setCrmLoading(false)
    }
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
    if (activeTab !== 'analytics') return
    loadAnalytics(analyticsRangeDays)
  }, [analyticsRangeDays, activeTab])

  useEffect(() => {
    if (activeTab !== 'crm') return
    loadCrm()
  }, [activeTab])

  const crmFiltered = crmRows.filter((r) => {
    const q = crmFilter.trim().toLowerCase()
    if (!q) return true
    const hay = [
      r.email,
      r.full_name,
      r.nickname,
      r.signup_referrer_domain,
      r.signup_utm_source,
      r.signup_utm_medium,
      r.signup_utm_campaign,
      r.signup_landing_path,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const tabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => handleTabChange(id)}
      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold border transition ${
        activeTab === id
          ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans pb-12">
      <div className="sticky top-14 z-[80] border-b border-gray-200/90 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">
              Admin
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {tabBtn('dashboard', 'Business')}
              {tabBtn('operations', 'Operations')}
              {tabBtn('analytics', 'Analytics')}
              {tabBtn('crm', 'CRM')}
            </div>
          </div>
          {activeTab === 'analytics' ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pt-1 border-t border-gray-200/80 dark:border-gray-800">
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'traffic', label: 'Traffic & tables' },
                  { id: 'users', label: 'Users & DAU' },
                  { id: 'product', label: 'Product map' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAnalyticsSection(id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold border transition ${
                      analyticsSection === id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-500'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setAnalyticsRangeDays(days)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold border transition ${
                      analyticsRangeDays === days
                        ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => loadAnalytics(analyticsRangeDays)}>
                  Refresh
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">

        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3">
              <Card className="p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Package size={14} /> Products</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{dashboard.totalProducts}</p>
              </Card>
              <Card className="p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Activity size={14} /> Active</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{dashboard.activeProducts}</p>
              </Card>
              <Card className="p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><BookOpen size={14} /> Academy</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{dashboard.academyCourses}</p>
              </Card>
              <Card className="p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><AlertTriangle size={14} /> Reports</p>
                <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">{dashboard.openReports}</p>
              </Card>
              <Card className="p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-1">DAU (today)</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{dashboard.dauToday.toLocaleString()}</p>
              </Card>
              <Card className="p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-1">Signups</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{dashboard.signupsToday.toLocaleString()}</p>
              </Card>
              <Card className="p-3 sm:p-4 col-span-2 sm:col-span-1 lg:col-span-1 xl:col-span-1">
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-1">MyPage save OK</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{dashboard.saveSuccessRate.toFixed(1)}%</p>
              </Card>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">7-Day Operations Trend</h2>
                <Button type="button" variant="ghost" onClick={loadDashboard}>Refresh</Button>
              </div>
              {dashboardLoading ? (
                <p className="text-sm text-gray-500">Loading dashboard...</p>
              ) : dashboardError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{dashboardError}</p>
              ) : (
                <div className="h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="products" name="Products" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="academy" name="Academy" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="reports" name="Reports" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><Database size={14} /> Data Freshness</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Latest Stock Trade Date</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{dashboard.latestStockDate || '-'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Latest Fund Standard Date</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{dashboard.latestFundDate || '-'}</p>
                </div>
              </div>
            </Card>
          </>
        )}

        {activeTab === 'analytics' && (
          <>
            {analyticsSection === 'product' ? (
            <Card className="p-6 border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/25 dark:to-gray-900">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-indigo-500/15 dark:bg-indigo-400/10 p-2.5 shrink-0">
                    <LayoutDashboard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Product dashboard</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-3xl leading-relaxed">
                      Maps the “Dashboard data” brief to what this admin can show today. Green = available from{' '}
                      <code className="text-xs bg-white/80 dark:bg-gray-800 px-1 rounded">site_analytics_events</code>
                      {' '}and the Analytics RPC. Amber = partial proxy. Gray = needs new events or billing joins.
                    </p>
                  </div>
                </div>
              </div>

              <details className="group mb-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-900/30 open:shadow-sm">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between gap-2">
                  <span>데이터 커버리지 범례 (펼치기)</span>
                  <span className="text-xs font-normal text-gray-500 group-open:hidden">▼</span>
                  <span className="text-xs font-normal text-gray-500 hidden group-open:inline">▲</span>
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 pb-4 text-sm border-t border-gray-100 dark:border-gray-800 pt-3">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3">
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wide mb-2">Available now</p>
                    <ul className="space-y-1 text-gray-800 dark:text-gray-200 list-disc list-inside">
                      <li>Top pages, views, avg dwell (page_exit)</li>
                      <li>Search terms, product / fund click ranking</li>
                      <li>Referrers, UTM campaigns</li>
                      <li>Funnel (landing → search → detail view → click → apply)</li>
                      <li>Daily trend of views / searches / clicks / sessions</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/15 px-4 py-3">
                    <p className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide mb-2">Partial / not in brief form</p>
                    <ul className="space-y-1 text-gray-800 dark:text-gray-200 list-disc list-inside">
                      <li>
                        <strong>DAU / WAU / MAU</strong> — use “Unique sessions” as a proxy; true DAU needs per-day user/session SQL.
                      </li>
                      <li>
                        <strong>New vs returning</strong> — CRM tab has signups + first-touch; returning cohort not automated here.
                      </li>
                      <li>
                        <strong>Watchlist adds / premium retention</strong> — only if you add{' '}
                        <code className="text-xs">trackAnalyticsEvent</code> hooks (and optional Stripe RPC).
                      </li>
                      <li>
                        <strong>Demographics</strong> — not collected (privacy); country can sometimes be inferred from referrer only.
                      </li>
                    </ul>
                  </div>
                </div>
              </details>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white/70 dark:bg-gray-900/40">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Page areas (rolled up)</h3>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      onClick={() => downloadAnalyticsCsv(
                        `analytics-page-areas-${analyticsRangeDays}d.csv`,
                        productDashboard.rollups,
                        [
                          { header: 'area_id', key: 'id' },
                          { header: 'label', key: 'label' },
                          { header: 'views', key: 'views' },
                          { header: 'unique_sessions_sum_non_deduped', key: 'unique_sessions_sum' },
                          { header: 'avg_dwell_ms', key: 'avg_dwell_ms' },
                        ],
                      )}
                    >
                      <Download size={14} /> CSV
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Aggregated from “Top pages” paths. Session column sums per-route uniques — same user across pages is counted more than once.
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {productDashboard.rollups.map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{row.label}</p>
                          <p className="text-xs text-gray-500">
                            Σ sessions {Number(row.unique_sessions_sum || 0).toLocaleString()} · Avg dwell {formatAnalyticsDuration(row.avg_dwell_ms)}
                          </p>
                        </div>
                        <p className="font-black text-indigo-600 dark:text-indigo-400 shrink-0">{Number(row.views || 0).toLocaleString()}</p>
                      </div>
                    ))}
                    {productDashboard.rollups.length === 0 ? (
                      <p className="text-sm text-gray-500">No page data in range.</p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white/70 dark:bg-gray-900/40">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Fund / ETF click interest</h3>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      onClick={() => downloadAnalyticsCsv(
                        `analytics-fund-clicks-${analyticsRangeDays}d.csv`,
                        productDashboard.fundClicks,
                        [
                          { header: 'product_type', key: 'product_type' },
                          { header: 'product_id', key: 'product_id' },
                          { header: 'product_name', key: 'product_name' },
                          { header: 'clicks', key: 'clicks' },
                          { header: 'unique_sessions', key: 'unique_sessions' },
                        ],
                      )}
                    >
                      <Download size={14} /> CSV
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Subset of “Top products” where type looks like fund/ETF or id ends with .T
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {productDashboard.fundClicks.map((row) => (
                      <div
                        key={`${row.product_type}-${row.product_id}`}
                        className="flex items-center justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-2"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{row.product_name || row.product_id}</p>
                          <p className="text-xs text-gray-500">
                            {row.product_type} · Sessions {Number(row.unique_sessions || 0).toLocaleString()}
                          </p>
                        </div>
                        <p className="font-black text-orange-600 dark:text-orange-400 shrink-0">{Number(row.clicks || 0).toLocaleString()}</p>
                      </div>
                    ))}
                    {productDashboard.fundClicks.length === 0 ? (
                      <p className="text-sm text-gray-500">No fund-like clicks in range (check product_type metadata on events).</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {productDashboard.watchHints.length > 0 ? (
                <div className="mt-4 rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/20 p-4">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2">Watchlist-related events (auto-detected names)</h3>
                  <div className="flex flex-wrap gap-2">
                    {productDashboard.watchHints.map((row) => (
                      <span
                        key={row.event_name}
                        className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-800 px-2.5 py-1 text-xs font-mono"
                      >
                        {row.event_name}
                        <span className="text-teal-700 dark:text-teal-300 font-sans font-bold">{Number(row.events || 0).toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  No watchlist event names matched yet. Add e.g.{' '}
                  <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 rounded">trackAnalyticsEvent(&apos;fund_watchlist_add&apos;, …)</code>{' '}
                  in the app to populate this section.
                </p>
              )}
            </Card>
            ) : null}

            {analyticsSection === 'users' ? (
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" aria-hidden />
                    Activity &amp; conversion
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-3xl">
                    <strong>DAU</strong> = calendar-day unique sessions (page_view). <strong>WAU</strong> = last 7 days rolling.
                    <strong> MAU (window)</strong> = unique sessions in the selected range. Logged-in new vs returning uses first
                    <code className="mx-1 text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">page_view</code>
                    timestamp per user. Signup rows use <code className="mx-1 text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">auth.users</code>
                    + first-touch landing on profile (not pre-login anonymous tool sessions).
                  </p>
                  {analytics.dataSource === 'client' ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 font-bold">
                      Client mode: cohorts &amp; DAU use at most 20k recent rows; signup/premium counts are 0. Apply the extended RPC SQL for full accuracy.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  onClick={() => downloadAnalyticsCsv(
                    `analytics-dau-daily-${analyticsRangeDays}d.csv`,
                    analytics.activity.dauDaily,
                    [
                      { header: 'day', key: 'day' },
                      { header: 'active_sessions', key: 'activeSessions' },
                      { header: 'active_users', key: 'activeUsers' },
                    ],
                  )}
                >
                  <Download size={14} /> DAU CSV
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/80 dark:bg-gray-900/50">
                  <p className="text-[10px] font-black text-gray-500 uppercase">WAU (7d sessions)</p>
                  <p className="text-xl font-black text-violet-600 dark:text-violet-400">{Number(analytics.activity.rolling.wauSessions || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/80 dark:bg-gray-900/50">
                  <p className="text-[10px] font-black text-gray-500 uppercase">MAU (range sessions)</p>
                  <p className="text-xl font-black text-violet-600 dark:text-violet-400">{Number(analytics.activity.rolling.mauSessionsWindow || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/80 dark:bg-gray-900/50">
                  <p className="text-[10px] font-black text-gray-500 uppercase">Avg DAU (sessions)</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white">
                    {analytics.activity.dauDaily.length > 0
                      ? (analytics.activity.dauDaily.reduce((s, r) => s + Number(r.activeSessions || 0), 0) / analytics.activity.dauDaily.length).toFixed(1)
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/80 dark:bg-gray-900/50">
                  <p className="text-[10px] font-black text-gray-500 uppercase">Premium sessions (range)</p>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400">{Number(analytics.activity.attributionSignups.premiumSessionsPageview || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">page_view + is_premium</p>
                </div>
              </div>

              {analytics.activity.dauDaily.length > 0 ? (
                <div className="h-64 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analytics.activity.dauDaily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dayShort" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="activeSessions" name="DAU sessions" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="activeUsers" name="DAU logged-in users" stroke="#10b981" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : analyticsLoading ? null : (
                <p className="text-sm text-gray-500 mb-4">No DAU series yet. Run extended analytics RPC on Supabase.</p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white mb-3">Logged-in sessions (range)</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
                      <p className="text-[10px] font-bold text-gray-500">Total w/ user_id</p>
                      <p className="font-black text-lg">{Number(analytics.activity.cohortSessions.loggedInSessions || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 p-2">
                      <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200">New (first PV in window)</p>
                      <p className="font-black text-lg text-emerald-700 dark:text-emerald-300">{Number(analytics.activity.cohortSessions.newUserSessions || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-indigo-50/80 dark:bg-indigo-950/30 p-2">
                      <p className="text-[10px] font-bold text-indigo-800 dark:text-indigo-200">Returning</p>
                      <p className="font-black text-lg text-indigo-700 dark:text-indigo-300">{Number(analytics.activity.cohortSessions.returningUserSessions || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-800/80 p-2">
                      <p className="text-[10px] font-bold text-gray-500">Anonymous sessions</p>
                      <p className="font-black text-lg">{Number(analytics.activity.cohortSessions.anonymousSessions || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white mb-3">Watchlist events (add / remove)</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <p className="font-bold">Fund +{Number(analytics.activity.watchlist.fundAdds || 0)} / −{Number(analytics.activity.watchlist.fundRemoves || 0)}</p>
                    <p className="font-bold">Stock +{Number(analytics.activity.watchlist.stockAdds || 0)} / −{Number(analytics.activity.watchlist.stockRemoves || 0)}</p>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2">Top symbols (adds only)</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {(analytics.activity.watchlist.topAddSymbols || []).map((row) => (
                      <div key={String(row.symbol)} className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1">
                        <span className="font-mono text-xs truncate">{row.symbol}</span>
                        <span className="font-black text-orange-600 dark:text-orange-400">{Number(row.adds || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    {(analytics.activity.watchlist.topAddSymbols || []).length === 0 ? (
                      <p className="text-xs text-gray-500">No add events in range.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/40 dark:bg-cyan-950/20 p-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2">Signup attribution (first-touch landing path)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500">Signups in range</p>
                    <p className="text-xl font-black text-cyan-700 dark:text-cyan-300">{Number(analytics.activity.attributionSignups.signupsInWindow || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500">Landing: funds / tools / stocks / market / insights</p>
                    <p className="text-xl font-black text-cyan-700 dark:text-cyan-300">{Number(analytics.activity.attributionSignups.signupsLandingFundsOrTools || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500">Landing: compare pages</p>
                    <p className="text-xl font-black text-cyan-700 dark:text-cyan-300">{Number(analytics.activity.attributionSignups.signupsLandingCompare || 0).toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                  “Tool → signup” before login is not in this table; use landing path at registration. Full funnel needs server RPC + this SQL applied.
                </p>
              </div>
            </Card>
            ) : null}

            {analyticsSection === 'traffic' ? (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Activity size={14} /> Page Views</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{analytics.pageViews.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">Sessions {Number(analytics.uniqueSessionsPageView || 0).toLocaleString()}</p>
                {analytics.dataSource === 'rpc' && analytics.summaryPrev ? (() => {
                  const d = formatAnalyticsDeltaPct(analytics.pageViews, analytics.summaryPrev.pageViews)
                  return d ? (
                    <p className={`text-xs mt-1 font-bold ${String(d).startsWith('-') ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      vs prior {analyticsRangeDays}d: {d}
                    </p>
                  ) : null
                })() : null}
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><MousePointerClick size={14} /> Product Clicks</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{analytics.productClicks.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">Sessions {Number(analytics.uniqueProductClickSessions || 0).toLocaleString()}</p>
                {analytics.dataSource === 'rpc' && analytics.summaryPrev ? (() => {
                  const d = formatAnalyticsDeltaPct(analytics.productClicks, analytics.summaryPrev.productClicks)
                  return d ? (
                    <p className={`text-xs mt-1 font-bold ${String(d).startsWith('-') ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      vs prior {analyticsRangeDays}d: {d}
                    </p>
                  ) : null
                })() : null}
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Search size={14} /> Searches</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{analytics.searches.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">Sessions {Number(analytics.uniqueSearchSessions || 0).toLocaleString()}</p>
                {analytics.dataSource === 'rpc' && analytics.summaryPrev ? (() => {
                  const d = formatAnalyticsDeltaPct(analytics.searches, analytics.summaryPrev.searches)
                  return d ? (
                    <p className={`text-xs mt-1 font-bold ${String(d).startsWith('-') ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      vs prior {analyticsRangeDays}d: {d}
                    </p>
                  ) : null
                })() : null}
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Globe2 size={14} /> Referrer Landings</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{analytics.landingViews.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">Sessions {Number(analytics.uniqueLandingSessions || 0).toLocaleString()}</p>
                {analytics.dataSource === 'rpc' && analytics.summaryPrev ? (() => {
                  const d = formatAnalyticsDeltaPct(analytics.landingViews, analytics.summaryPrev.landingViews)
                  return d ? (
                    <p className={`text-xs mt-1 font-bold ${String(d).startsWith('-') ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      vs prior {analyticsRangeDays}d: {d}
                    </p>
                  ) : null
                })() : null}
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Timer size={14} /> Avg Dwell</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{formatAnalyticsDuration(analytics.avgDwellMs)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{'page_exit, dwell > 0ms'}</p>
                {analytics.dataSource === 'rpc' && analytics.summaryPrev ? (() => {
                  const d = formatAnalyticsDeltaPct(analytics.avgDwellMs, analytics.summaryPrev.avgDwellMs)
                  return d ? (
                    <p className={`text-xs mt-1 font-bold ${String(d).startsWith('-') ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      vs prior {analyticsRangeDays}d: {d}
                    </p>
                  ) : null
                })() : null}
              </Card>
            </div>

            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Site Analytics Snapshot</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">期間・更新は上部のAnalyticsバーで選択します。</p>
              </div>
              {analyticsLoading ? (
                <p className="text-sm text-gray-500">Loading analytics...</p>
              ) : analyticsError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{analyticsError}</p>
              ) : (
                <div className="space-y-4">
                  {analytics.dataSource === 'client' ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                      ブラウザでは最大2万件まで要約中です。全期間集計と前期間比較は Supabase の{' '}
                      <code className="text-xs font-mono bg-amber-100/80 dark:bg-amber-900/50 px-1 rounded">admin_site_analytics_dashboard</code>{' '}
                      RPC を適用してから再読み込みしてください。
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <h3 className="text-sm font-black text-gray-900 dark:text-white mb-3">Conversion Funnel</h3>
                      <div className="space-y-3">
                        {analytics.funnel.map((row, idx) => {
                          const maxSessions = Math.max(...analytics.funnel.map((item) => Number(item.sessions || 0)), 1)
                          const width = maxSessions > 0 ? (Number(row.sessions || 0) / maxSessions) * 100 : 0
                          return (
                            <div key={row.step}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{idx + 1}. {row.step}</p>
                                <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{Number(row.sessions || 0).toLocaleString()}</p>
                              </div>
                              <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${width.toFixed(1)}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">Daily Trend</h3>
                        <p className="text-xs text-gray-500">Bars: views / searches / clicks · Line: unique sessions (page_view)</p>
                      </div>
                      {analytics.dailyTrend.length > 0 ? (
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={analytics.dailyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={36} />
                              <Tooltip />
                              <Bar yAxisId="left" dataKey="pageViews" name="Page Views" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar yAxisId="left" dataKey="searches" name="Searches" fill="#10b981" radius={[4, 4, 0, 0]} />
                              <Bar yAxisId="left" dataKey="productClicks" name="Clicks" fill="#f97316" radius={[4, 4, 0, 0]} />
                              <Line yAxisId="right" type="monotone" dataKey="uniqueSessions" name="Unique sessions" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No trend data yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">Top Pages</h3>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          onClick={() => downloadAnalyticsCsv(
                            `analytics-top-pages-${analyticsRangeDays}d.csv`,
                            analytics.topPages,
                            [
                              { header: 'page_path', key: 'page_path' },
                              { header: 'views', key: 'views' },
                              { header: 'unique_sessions', key: 'unique_sessions' },
                              { header: 'avg_dwell_ms', key: 'avg_dwell_ms' },
                            ],
                          )}
                        >
                          <Download size={14} /> CSV
                        </button>
                      </div>
                      <div className="space-y-2">
                        {analytics.topPages.map((row) => (
                          <div key={row.page_path} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-white truncate">{row.page_path}</p>
                              <p className="text-xs text-gray-500">Sessions {Number(row.unique_sessions || 0).toLocaleString()} · Avg dwell {formatAnalyticsDuration(row.avg_dwell_ms)}</p>
                            </div>
                            <p className="font-black text-blue-600 dark:text-blue-400 shrink-0">{Number(row.views || 0).toLocaleString()}</p>
                          </div>
                        ))}
                        {analytics.topPages.length === 0 ? <p className="text-sm text-gray-500">No page data yet.</p> : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">Top Products / Items</h3>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          onClick={() => downloadAnalyticsCsv(
                            `analytics-top-products-${analyticsRangeDays}d.csv`,
                            analytics.topProducts,
                            [
                              { header: 'product_type', key: 'product_type' },
                              { header: 'product_id', key: 'product_id' },
                              { header: 'product_name', key: 'product_name' },
                              { header: 'clicks', key: 'clicks' },
                              { header: 'unique_sessions', key: 'unique_sessions' },
                            ],
                          )}
                        >
                          <Download size={14} /> CSV
                        </button>
                      </div>
                      <div className="space-y-2">
                        {analytics.topProducts.map((row) => (
                          <div key={`${row.product_type}-${row.product_id}`} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-white truncate">{row.product_name || row.product_id}</p>
                              <p className="text-xs text-gray-500">{row.product_type} · Sessions {Number(row.unique_sessions || 0).toLocaleString()}</p>
                            </div>
                            <p className="font-black text-orange-600 dark:text-orange-400 shrink-0">{Number(row.clicks || 0).toLocaleString()}</p>
                          </div>
                        ))}
                        {analytics.topProducts.length === 0 ? <p className="text-sm text-gray-500">No click data yet.</p> : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">Top Search Terms</h3>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          onClick={() => downloadAnalyticsCsv(
                            `analytics-top-searches-${analyticsRangeDays}d.csv`,
                            analytics.topSearches,
                            [
                              { header: 'page_path', key: 'page_path' },
                              { header: 'query', key: 'query' },
                              { header: 'searches', key: 'searches' },
                              { header: 'avg_result_count', key: 'avg_result_count' },
                            ],
                          )}
                        >
                          <Download size={14} /> CSV
                        </button>
                      </div>
                      <div className="space-y-2">
                        {analytics.topSearches.map((row) => (
                          <div key={`${row.page_path}-${row.query}`} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-white truncate">{row.query}</p>
                              <p className="text-xs text-gray-500">{row.page_path} · Avg results {Number(row.avg_result_count || 0).toLocaleString()}</p>
                            </div>
                            <p className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">{Number(row.searches || 0).toLocaleString()}</p>
                          </div>
                        ))}
                        {analytics.topSearches.length === 0 ? <p className="text-sm text-gray-500">No search data yet.</p> : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">Top Referrers</h3>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          onClick={() => downloadAnalyticsCsv(
                            `analytics-top-referrers-${analyticsRangeDays}d.csv`,
                            analytics.topReferrers,
                            [
                              { header: 'referrer_domain', key: 'referrer_domain' },
                              { header: 'utm_source', key: 'utm_source' },
                              { header: 'utm_medium', key: 'utm_medium' },
                              { header: 'landing_views', key: 'landing_views' },
                              { header: 'unique_sessions', key: 'unique_sessions' },
                            ],
                          )}
                        >
                          <Download size={14} /> CSV
                        </button>
                      </div>
                      <div className="space-y-2">
                        {analytics.topReferrers.map((row, idx) => (
                          <div key={`${row.referrer_domain || row.utm_source || 'direct'}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-white truncate">{row.referrer_domain || row.utm_source || 'direct / none'}</p>
                              <p className="text-xs text-gray-500">{row.utm_medium || '-'} · Sessions {Number(row.unique_sessions || 0).toLocaleString()}</p>
                            </div>
                            <p className="font-black text-violet-600 dark:text-violet-400 shrink-0">{Number(row.landing_views || 0).toLocaleString()}</p>
                          </div>
                        ))}
                        {analytics.topReferrers.length === 0 ? <p className="text-sm text-gray-500">No referrer data yet.</p> : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">Top UTM Campaigns</h3>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          onClick={() => downloadAnalyticsCsv(
                            `analytics-top-campaigns-${analyticsRangeDays}d.csv`,
                            analytics.topCampaigns,
                            [
                              { header: 'campaign', key: 'campaign' },
                              { header: 'utm_source', key: 'utm_source' },
                              { header: 'utm_medium', key: 'utm_medium' },
                              { header: 'page_views', key: 'page_views' },
                              { header: 'unique_sessions', key: 'unique_sessions' },
                            ],
                          )}
                        >
                          <Download size={14} /> CSV
                        </button>
                      </div>
                      <div className="space-y-2">
                        {analytics.topCampaigns.map((row, idx) => (
                          <div key={`${row.campaign || 'c'}-${row.utm_source || ''}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-white truncate">{row.campaign || '—'}</p>
                              <p className="text-xs text-gray-500">
                                {row.utm_source || '—'} / {row.utm_medium || '—'} · Sessions {Number(row.unique_sessions || 0).toLocaleString()}
                              </p>
                            </div>
                            <p className="font-black text-cyan-600 dark:text-cyan-400 shrink-0">{Number(row.page_views || 0).toLocaleString()}</p>
                          </div>
                        ))}
                        {analytics.topCampaigns.length === 0 ? <p className="text-sm text-gray-500">No campaign-tagged page views yet.</p> : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">Engagement (subset)</h3>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          onClick={() => downloadAnalyticsCsv(
                            `analytics-engagement-${analyticsRangeDays}d.csv`,
                            analytics.engagement,
                            [
                              { header: 'event_name', key: 'event_name' },
                              { header: 'events', key: 'events' },
                              { header: 'unique_sessions', key: 'unique_sessions' },
                            ],
                          )}
                        >
                          <Download size={14} /> CSV
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">Nav clicks, referral actions, fund/product detail views.</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {analytics.engagement.map((row) => (
                          <div key={row.event_name} className="flex items-center justify-between gap-3 text-sm">
                            <p className="font-mono text-xs font-bold text-gray-900 dark:text-white truncate">{row.event_name}</p>
                            <div className="text-right shrink-0">
                              <p className="font-black text-teal-600 dark:text-teal-400">{Number(row.events || 0).toLocaleString()}</p>
                              <p className="text-[10px] text-gray-500">sess {Number(row.unique_sessions || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                        {analytics.engagement.length === 0 ? <p className="text-sm text-gray-500">No engagement events in range.</p> : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-sm font-black text-gray-900 dark:text-white">Event breakdown</h3>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={() => downloadAnalyticsCsv(
                          `analytics-events-${analyticsRangeDays}d.csv`,
                          analytics.eventBreakdown,
                          [
                            { header: 'event_name', key: 'event_name' },
                            { header: 'events', key: 'events' },
                            { header: 'unique_sessions', key: 'unique_sessions' },
                          ],
                        )}
                      >
                        <Download size={14} /> CSV
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                      {analytics.eventBreakdown.map((row) => (
                        <div key={row.event_name} className="flex items-center justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5">
                          <p className="font-mono text-xs text-gray-800 dark:text-gray-200 truncate">{row.event_name}</p>
                          <div className="text-right shrink-0 text-xs">
                            <span className="font-black text-gray-900 dark:text-white">{Number(row.events || 0).toLocaleString()}</span>
                            <span className="text-gray-500 ml-2">sess {Number(row.unique_sessions || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                      {analytics.eventBreakdown.length === 0 ? <p className="text-sm text-gray-500">No events in range.</p> : null}
                    </div>
                  </div>
                </div>
              )}
            </Card>
            </>
            ) : null}
          </>
        )}

        {activeTab === 'crm' && (
          <>
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">User CRM</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Latest 300 registered users with first-touch acquisition (referrer, UTM, landing). Rows created before email verification are backfilled on the user&apos;s first login after they verify.
                    </p>
                  </div>
                </div>
                <Button type="button" variant="ghost" onClick={() => loadCrm()}>
                  Reload
                </Button>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1" htmlFor="crm-filter">
                  Search (email, name, referrer, UTM, landing)
                </label>
                <input
                  id="crm-filter"
                  type="search"
                  value={crmFilter}
                  onChange={(e) => setCrmFilter(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  placeholder="google / t.co / utm / ..."
                />
              </div>
              {crmLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : crmError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{crmError}</p>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[min(70vh,560px)] rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-[920px] w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-3 py-2 font-bold text-gray-600 dark:text-gray-400">Signed up</th>
                        <th className="px-3 py-2 font-bold text-gray-600 dark:text-gray-400">Email</th>
                        <th className="px-3 py-2 font-bold text-gray-600 dark:text-gray-400">Display name</th>
                        <th className="px-3 py-2 font-bold text-gray-600 dark:text-gray-400">Referrer</th>
                        <th className="px-3 py-2 font-bold text-gray-600 dark:text-gray-400">UTM</th>
                        <th className="px-3 py-2 font-bold text-gray-600 dark:text-gray-400">Landing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crmFiltered.map((r) => (
                        <tr
                          key={r.user_id}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-900/50"
                        >
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                            {r.user_created_at
                              ? new Date(r.user_created_at).toLocaleString('en-US')
                              : '-'}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-gray-900 dark:text-gray-100 max-w-[200px] truncate" title={r.email || ''}>
                            {r.email || '-'}
                          </td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-200 max-w-[140px] truncate" title={r.nickname || r.full_name || ''}>
                            {r.nickname || r.full_name || '-'}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[160px] truncate" title={r.signup_referrer_domain || ''}>
                            {r.signup_referrer_domain || '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[220px]">
                            <span className="block truncate" title={[r.signup_utm_source, r.signup_utm_medium, r.signup_utm_campaign].filter(Boolean).join(' / ')}>
                              {[r.signup_utm_source, r.signup_utm_medium].filter(Boolean).join(' · ') || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px] text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={`${r.signup_landing_path || ''}${r.signup_landing_query || ''}`}>
                            {r.signup_landing_path || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {crmFiltered.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">No matching users.</p>
                  ) : null}
                </div>
              )}
            </Card>
          </>
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

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Market News (Auto)</h2>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              Cron Enabled
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            MarketPageニュースは `TheNewsAPI → cron → news_manual` の流れで自動更新されます。管理画面の手動更新・手動入力UIは削除済みです。
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {newsLastUpdatedAt ? new Date(newsLastUpdatedAt).toLocaleString('ja-JP') : '-'}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">データ不足リスト（ファンド/ETF）</h2>
            <Button type="button" variant="ghost" onClick={loadMissingDataList} disabled={missingDataLoading}>
              {missingDataLoading ? 'Loading...' : '照会'}
            </Button>
          </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            ETF一覧のうち、v_stock_latest・履歴・信託報酬・NISA区分が不足している項目を表示します。
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
            <p className="text-sm text-gray-500">「照会」ボタンを押して確認してください。</p>
          ) : (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">全項目でデータあり</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">配当マスター（月ベース）</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                銘柄コードはマイページ・配当カレンダーの <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">stock_id</code> と同一（例: <span className="font-mono">AAPL</span>, <span className="font-mono">8306</span>, <span className="font-mono">2558.T</span>）。
                配当がある<strong>暦月</strong>を登録。年を空欄にすると毎年その月に通知ロジックが当たります。
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
                  setDividendMasterMessage({ type: 'success', text: '更新しました。' })
                } else {
                  await insertDividendMasterRow(payload)
                  setDividendMasterMessage({ type: 'success', text: '追加しました。' })
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
                setDividendMasterMessage({ type: 'error', text: err?.message || '保存に失敗しました。' })
              }
            }}
          >
            <input
              value={dividendMasterForm.stock_id}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, stock_id: e.target.value }))}
              className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
              placeholder="stock_id (例: AAPL, 2558.T)"
              required
            />
            <select
              value={dividendMasterForm.asset_kind}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, asset_kind: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="us_stock">米国株</option>
              <option value="jp_stock">日本株</option>
              <option value="jp_fund">日本投信/ETF</option>
            </select>
            <select
              value={dividendMasterForm.dividend_month}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, dividend_month: Number(e.target.value) }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
            <input
              type="number"
              min={2000}
              max={2100}
              value={dividendMasterForm.calendar_year}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, calendar_year: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="年(任意・空=毎年)"
            />
            <input
              value={dividendMasterForm.name_hint}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, name_hint: e.target.value }))}
              className="md:col-span-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="名称メモ(任意)"
            />
            <input
              value={dividendMasterForm.notes}
              onChange={(e) => setDividendMasterForm((p) => ({ ...p, notes: e.target.value }))}
              className="md:col-span-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="備考(任意)"
            />
            <div className="md:col-span-6 flex flex-wrap gap-2">
              <Button type="submit" size="sm">{editingDividendMasterId ? '更新' : '追加'}</Button>
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
                  キャンセル
                </Button>
              )}
            </div>
          </form>
          {dividendMasterLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : dividendMasterRows.length === 0 ? (
            <p className="text-sm text-gray-500">行がありません。上のフォームから追加するか、SQLで一括投入してください。</p>
          ) : (
            <div className="max-h-80 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-gray-700 dark:text-gray-300">stock_id</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-700 dark:text-gray-300">種別</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-700 dark:text-gray-300">月</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-700 dark:text-gray-300">年</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-700 dark:text-gray-300">名称メモ</th>
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
                          編集
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            setDividendMasterMessage(null)
                            if (!window.confirm('この行を削除しますか？')) return
                            try {
                              await deleteDividendMasterRow(row.id)
                              setDividendMasterMessage({ type: 'success', text: '削除しました。' })
                              await loadDividendMaster()
                            } catch (err) {
                              setDividendMasterMessage({ type: 'error', text: err?.message || '削除に失敗しました。' })
                            }
                          }}
                        >
                          削除
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">News Page 手動ニュース</h2>
            <Button type="button" variant="ghost" onClick={loadNewsPageManual}>Refresh</Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            ニュースページ上部に表示される手動ニュース。エディターは固定で MoneyMart。画像は「画像URL」欄に直接URLを入力（例: https://example.com/image.jpg）。
            <span className="block mt-1 text-gray-500 dark:text-gray-400">掲載の日時は Create / Update を押したときの時刻が保存されます。</span>
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
              placeholder="タイトル (例: 日経平均、1,100円超の急落)"
              required
            />
            <input
              type="date"
              value={newsPageManualForm.publishedAt}
              onChange={(e) => setNewsPageManualForm((p) => ({ ...p, publishedAt: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              title="参考用（下書き・メモ）。DBの掲載時刻は保存ボタンを押した瞬間。"
            />
            <textarea
              value={newsPageManualForm.content}
              onChange={(e) => setNewsPageManualForm((p) => ({ ...p, content: e.target.value }))}
              rows={3}
              className="md:col-span-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="内容"
              required
            />
            <input
              value={newsPageManualForm.imageUrl}
              onChange={(e) => setNewsPageManualForm((p) => ({ ...p, imageUrl: e.target.value }))}
              className="md:col-span-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="画像URL（任意）例: https://example.com/image.jpg"
            />
            <input
              type="url"
              value={newsPageManualForm.linkUrl}
              onChange={(e) => setNewsPageManualForm((p) => ({ ...p, linkUrl: e.target.value }))}
              className="md:col-span-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="記事リンクURL（任意）例: https://example.com/news-article"
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
                    <p className="text-gray-500">{row.published_at ? new Date(row.published_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'} · {row.source || 'MoneyMart'}</p>
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">MarketPage 市場主要ニュース（手動）</h2>
            <Button type="button" variant="ghost" onClick={loadMarketMajorNewsManual}>Refresh</Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            MarketPageの「市場主要ニュース」電光パネルを手動編集します。「メジャー企業・イベント」「今週の主要結果サマリー」はそれぞれ大きなパネル1枚ずつにまとまり、自動で切り替わります（項目は sort_order）。本文は◆付き行として並びます。
            <span className="block mt-1 text-gray-500 dark:text-gray-400">掲載の日時は Create / Update を押したときの時刻が保存されます。</span>
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setMarketMajorNewsMessage(null)
              const title = String(marketMajorNewsForm.title || '').trim()
              const content = String(marketMajorNewsForm.content || '').trim()
              const section = String(marketMajorNewsForm.section || 'market_major_event')
              const sortOrder = Number(marketMajorNewsForm.sortOrder || 0)
              if (!title || !content) {
                setMarketMajorNewsMessage({ type: 'error', text: 'Title and content are required.' })
                return
              }
              try {
                const payload = {
                  bucket: section,
                  source: 'MoneyMart',
                  title,
                  description: content,
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
              <option value="market_major_event">メジャー企業・イベント</option>
              <option value="market_weekly_summary">今週の主要結果サマリー</option>
            </select>
            <input
              value={marketMajorNewsForm.title}
              onChange={(e) => setMarketMajorNewsForm((p) => ({ ...p, title: e.target.value }))}
              className="md:col-span-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              placeholder="タイトル"
              required
            />
            <input
              type="date"
              value={marketMajorNewsForm.publishedAt}
              onChange={(e) => setMarketMajorNewsForm((p) => ({ ...p, publishedAt: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              title="参考用（メモ）。DBの掲載時刻は保存ボタンを押した瞬間。"
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
              placeholder="内容"
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
                      {(row.bucket === 'market_weekly_summary') ? '今週の主要結果サマリー' : 'メジャー企業・イベント'}
                      {' · '}
                      {row.published_at ? new Date(row.published_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Insights 編集</h2>
            <Button type="button" variant="ghost" onClick={loadInsights} disabled={insightsLoading}>
              {insightsLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            インサイト記事を作成・修正します。公開中の記事は `is_published=true` のものが `/insights` に表示されます。
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
                    setInsightsMessage({ type: 'error', text: 'JSONの形式が不正なため、かんたん入力に戻せません。' })
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
              かんたん入力
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
              JSONモード
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
                      placeholder="タイトル"
                      required
                    />
                    <select
                      value={insightSimpleForm.category}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, category: e.target.value }))}
                      className="shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm font-bold text-white sm:min-w-[11rem]"
                      aria-label="カテゴリ"
                    >
                      {[...INSIGHT_CATEGORY_OPTIONS, ...(insightSimpleForm.category && !INSIGHT_CATEGORY_OPTIONS.includes(insightSimpleForm.category) ? [insightSimpleForm.category] : [])].map((opt) => (
                        <option key={opt} value={opt} className="bg-slate-900 text-white">
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    value={insightSimpleForm.summary}
                    onChange={(e) => setInsightSimpleForm((p) => ({ ...p, summary: e.target.value }))}
                    className="mt-3 w-full resize-y rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 leading-relaxed"
                    placeholder="一覧・プレビュー用の短い要約（必須）"
                    required
                  />
                  <div className="mt-4 space-y-2">
                    <label className="block text-[11px] font-bold tracking-wide text-slate-400">
                      一覧・記事ヘッダー用カバー画像（任意）
                    </label>
                    <p className="text-[10px] leading-relaxed text-slate-500">
                      Storage バケット「{INSIGHT_COVER_IMAGE_BUCKET}」へアップロードします（ニュース画像と共通）。手元の公開 URL を貼ることもできます。
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                        disabled={insightCoverUploading}
                        onChange={handleInsightCoverFileChange}
                      />
                      {insightCoverUploading ? <span className="text-xs text-amber-300">アップロード中…</span> : null}
                    </div>
                    <input
                      value={insightSimpleForm.coverImageUrl}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, coverImageUrl: e.target.value }))}
                      className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500"
                      placeholder="https://… （公開画像URL）"
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
                    <div className="text-xs font-black tracking-wider">main · 本文（リッチ編集）</div>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      すぐ下の<span className="text-amber-300 font-bold">オレンジ色の帯</span>に太字・番号リストなどのボタンがあります。ここがテキストエリアだけの場合は、未デプロイまたは別ブランチのビルドを見ています。
                    </p>
                  </div>
                  <InsightRichEditor
                    value={insightSimpleForm.mainCombined}
                    onChange={(html) => setInsightSimpleForm((p) => ({ ...p, mainCombined: html }))}
                    placeholder="本文（投資テーゼ・分析本文）。テーゼと根拠を分けるときはツールバーの「テーゼ/根拠の区切り」を使うか、プレーンテキストのときは1行に --- とだけ入力。"
                  />
                </div>

                <div className="rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-4">
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 tracking-wide mb-1.5">Keywords</label>
                  <input
                    value={insightSimpleForm.keywordsText}
                    onChange={(e) => setInsightSimpleForm((p) => ({ ...p, keywordsText: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
                    placeholder="例: NISA, 金利, 為替（カンマ・読点・改行で区切り）"
                  />
                </div>

                <div className="rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-4">
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 tracking-wide mb-1.5">MM 関連コンテンツ</label>
                  <textarea
                    rows={4}
                    value={insightSimpleForm.relatedToolsText}
                    onChange={(e) => setInsightSimpleForm((p) => ({ ...p, relatedToolsText: e.target.value }))}
                    className="w-full resize-y rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm leading-relaxed"
                    placeholder={'関連ツール・内部リンク（1行に1つ）。例: ETF比較ツール、/etf-compare、https://…\nラベルを指定したい場合は「表示名 | URL」形式（例: ETF比較 | https://moneymart.co.jp/etf-compare）。'}
                  />
                </div>

                <details className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-gray-700 dark:text-gray-300">詳細設定（ターゲット・リスク・データ・公開）</summary>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={insightSimpleForm.target}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, target: e.target.value }))}
                      className="md:col-span-2 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      placeholder="Target（任意・バッジ用）"
                    />
                    <textarea
                      rows={4}
                      value={insightSimpleForm.risk}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, risk: e.target.value }))}
                      className="min-h-[100px] resize-y px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm leading-relaxed"
                      placeholder="リスク要因"
                    />
                    <input
                      value={insightSimpleForm.dataNote}
                      onChange={(e) => setInsightSimpleForm((p) => ({ ...p, dataNote: e.target.value }))}
                      className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      placeholder="データ注記"
                    />
                    <label className="md:col-span-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                      <input
                        type="checkbox"
                        checked={insightSimpleForm.tickerEnabled}
                        onChange={(e) => setInsightSimpleForm((p) => ({ ...p, tickerEnabled: e.target.checked }))}
                      />
                      ティッカー表示（1行: ラベル|値|変動|up/down）
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
                      placeholder="読了時間 (例: 5分)"
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
                    <p className="text-gray-500">
                      {row.published_at ? new Date(row.published_at).toLocaleDateString('ja-JP') : '-'}
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">ラウンジ キー要約</h2>
            <Button type="button" onClick={handleRefreshDigest} disabled={digestRefreshLoading}>
              {digestRefreshLoading ? '更新中...' : 'キー要約を更新'}
            </Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            ラウンジ上部の「その日のキー要約」カードを即時再生成します。
          </p>
          {digestRefreshMessage ? (
            <p className={`text-sm mt-3 ${digestRefreshMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {digestRefreshMessage.text}
            </p>
          ) : null}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">カリカエ金利マスター</h2>
            <Button type="button" variant="ghost" onClick={loadRefinanceProducts}>Refresh</Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            AIカリカエエージェント向けに、銀行別の借り換え候補金利を管理します。
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
                    <span className="ml-2 text-gray-500">fee ¥{Number(row.fees_yen || 0).toLocaleString()}</span>
                    <span className="ml-2 text-gray-500">range ¥{Number(row.min_amount_yen || 0).toLocaleString()} - ¥{Number(row.max_amount_yen || 0).toLocaleString()}</span>
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
                      <span className="text-xs text-gray-500">{new Date(product.created_at).toLocaleString()}</span>
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
                    <span className="text-xs text-gray-500">{new Date(report.created_at).toLocaleString()}</span>
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
