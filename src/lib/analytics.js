import { supabase } from './supabase'
import { isInternalReferrerDomain } from './crmInternalUsers'
import { ANALYTICS_DWELL_REPORT_CAP_MS, capDwellMsForReport } from './analyticsDwellStats.js'

const STORAGE_KEYS = {
  sessionId: 'mm_analytics_session_id',
  sessionSeenAt: 'mm_analytics_session_seen_at',
  landingContext: 'mm_analytics_landing_context_v1',
  currentPath: 'mm_analytics_current_path',
  currentQuery: 'mm_analytics_current_query',
  pathEnteredAt: 'mm_analytics_path_entered_at',
  pathActiveMs: 'mm_analytics_path_active_ms',
  pathVisibleSince: 'mm_analytics_path_visible_since',
  pendingExit: 'mm_analytics_pending_exit_v1',
}

const SIGNUP_FLOW_PATH_RE = /^\/(signup|signup-complete|login|complete-profile)(\/|$)/

const SESSION_CACHE_TTL_MS = 60 * 1000

/** A visit ends after 30 minutes idle, or at the UTC day boundary. */
const SESSION_IDLE_TTL_MS = 30 * 60 * 1000

let cachedUserId = null
let cachedUserIdAt = 0
let dwellListenersInstalled = false

export { ANALYTICS_DWELL_REPORT_CAP_MS, capDwellMsForReport } from './analyticsDwellStats.js'

const isBrowser = () => typeof window !== 'undefined'

const safeStorage = (type = 'local') => {
  if (!isBrowser()) return null
  try {
    return type === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const getAnalyticsSessionId = () => {
  const storage = safeStorage('local')
  if (!storage) return 'anonymous-session'

  const now = Date.now()
  const seenAt = Number(storage.getItem(STORAGE_KEYS.sessionSeenAt) || 0)
  const sameDay = seenAt > 0
    && new Date(seenAt).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10)

  let value = storage.getItem(STORAGE_KEYS.sessionId)
  if (!value || !seenAt || now - seenAt > SESSION_IDLE_TTL_MS || !sameDay) {
    value = generateId()
    storage.setItem(STORAGE_KEYS.sessionId, value)
  }
  storage.setItem(STORAGE_KEYS.sessionSeenAt, String(now))
  return value
}

const parseLandingContext = () => {
  const storage = safeStorage('local')
  if (!storage) return null
  try {
    const raw = storage.getItem(STORAGE_KEYS.landingContext)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const persistLandingContext = (landingContext) => {
  const storage = safeStorage('local')
  if (!storage || !landingContext) return
  storage.setItem(STORAGE_KEYS.landingContext, JSON.stringify(landingContext))
}

const parseReferrerDomain = (referrerUrl = '') => {
  try {
    return referrerUrl ? new URL(referrerUrl).hostname : ''
  } catch {
    return ''
  }
}

/** Parse UTM / ref / click-id from a query string + optional document.referrer. */
export const parseAttributionFromLocation = ({
  search = '',
  pathname = '/',
  referrerUrl = '',
} = {}) => {
  const rawSearch = String(search || '')
  const params = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch)

  let utm_source = params.get('utm_source') || ''
  let utm_medium = params.get('utm_medium') || ''
  let utm_campaign = params.get('utm_campaign') || ''
  const utm_term = params.get('utm_term') || ''
  const utm_content = params.get('utm_content') || ''

  if (!utm_source && params.get('gclid')) {
    utm_source = 'google'
    utm_medium = utm_medium || 'cpc'
    utm_campaign = utm_campaign || 'gclid'
  } else if (!utm_source && params.get('fbclid')) {
    utm_source = 'facebook'
    utm_medium = utm_medium || 'social'
    utm_campaign = utm_campaign || 'fbclid'
  } else if (!utm_source && params.get('msclkid')) {
    utm_source = 'bing'
    utm_medium = utm_medium || 'cpc'
    utm_campaign = utm_campaign || 'msclkid'
  }

  const refRaw = String(params.get('ref') || params.get('invite') || '').trim().slice(0, 64)
  if (refRaw && !utm_source) {
    utm_source = 'ref'
    utm_medium = utm_medium || 'community'
    utm_campaign = utm_campaign || refRaw
  }

  const landing_query = rawSearch
    ? (rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`)
    : ''

  return {
    landing_path: pathname || '/',
    landing_query,
    referrer_url: referrerUrl || '',
    referrer_domain: parseReferrerDomain(referrerUrl),
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    signup_ref: refRaw,
  }
}

const mergeLandingAttribution = (existing, incoming, { preferIncomingUtm = false } = {}) => {
  const base = existing && typeof existing === 'object' ? { ...existing } : {}
  if (!base.first_seen_at) base.first_seen_at = new Date().toISOString()

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'signup_ref']
  for (const key of utmKeys) {
    const next = String(incoming?.[key] || '').trim()
    if (!next) continue
    if (preferIncomingUtm || !String(base[key] || '').trim()) base[key] = next
  }

  const incomingRefDomain = String(incoming?.referrer_domain || '').trim()
  const incomingRefUrl = String(incoming?.referrer_url || '').trim()
  const baseRefDomain = String(base.referrer_domain || '').trim()
  const canUseIncomingReferrer = incomingRefDomain
    && !isInternalReferrerDomain(incomingRefDomain)
  if (canUseIncomingReferrer && (!baseRefDomain || isInternalReferrerDomain(baseRefDomain))) {
    base.referrer_domain = incomingRefDomain
    base.referrer_url = incomingRefUrl
  }

  const signupFlowPath = SIGNUP_FLOW_PATH_RE.test(String(incoming?.landing_path || ''))
  if (signupFlowPath) {
    if (incoming.landing_path) base.landing_path = incoming.landing_path
    if (incoming.landing_query) base.landing_query = incoming.landing_query
  } else if (!base.landing_path && incoming.landing_path) {
    base.landing_path = incoming.landing_path
    base.landing_query = incoming.landing_query || ''
  }

  return base
}

/** Merge signup-page UTM/ref into stored first-touch (fixes late tagged /signup links). */
export const refreshSignupAttributionFromBrowser = () => {
  if (!isBrowser()) return

  getAnalyticsSessionId()
  const storage = safeStorage('local')
  if (!storage) return

  const pathname = window.location.pathname || '/'
  const search = window.location.search || ''
  const incoming = parseAttributionFromLocation({
    search,
    pathname,
    referrerUrl: document.referrer || '',
  })

  const hasIncomingTags = Boolean(
    incoming.utm_source
      || incoming.utm_medium
      || incoming.utm_campaign
      || incoming.signup_ref
      || (incoming.referrer_domain && !isInternalReferrerDomain(incoming.referrer_domain)),
  )
  const onSignupFlow = SIGNUP_FLOW_PATH_RE.test(pathname)

  const existing = parseLandingContext()
  if (!existing) {
    if (!hasIncomingTags && !onSignupFlow) return
    persistLandingContext({
      ...incoming,
      first_seen_at: new Date().toISOString(),
    })
    return
  }

  if (!hasIncomingTags && !onSignupFlow) return

  persistLandingContext(mergeLandingAttribution(existing, incoming, {
    preferIncomingUtm: onSignupFlow || hasIncomingTags,
  }))
}

export const bootstrapAnalytics = () => {
  if (!isBrowser()) return

  getAnalyticsSessionId()
  flushPendingPageExit()
  installAnalyticsDwellListeners()

  const storage = safeStorage('local')
  const existing = parseLandingContext()
  if (existing || !storage) {
    refreshSignupAttributionFromBrowser()
    return
  }

  const incoming = parseAttributionFromLocation({
    search: window.location.search || '',
    pathname: window.location.pathname || '/',
    referrerUrl: document.referrer || '',
  })
  if (isInternalReferrerDomain(incoming.referrer_domain)) {
    incoming.referrer_domain = ''
    incoming.referrer_url = ''
  }

  persistLandingContext({
    ...incoming,
    first_seen_at: new Date().toISOString(),
  })
}

const getLandingContext = () => parseLandingContext() || {}

const getCachedUserId = async () => {
  const now = Date.now()
  if ((now - cachedUserIdAt) < SESSION_CACHE_TTL_MS) return cachedUserId
  cachedUserIdAt = now
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const sessionUserId = sessionData?.session?.user?.id || null
    if (sessionUserId) {
      cachedUserId = sessionUserId
      return cachedUserId
    }
    const { data } = await supabase.auth.getUser()
    cachedUserId = data?.user?.id || null
  } catch {
    cachedUserId = null
  }
  return cachedUserId
}

export const setCurrentAnalyticsPath = (path, query = '') => {
  const storage = safeStorage('session')
  if (!storage) return
  storage.setItem(STORAGE_KEYS.currentPath, String(path || ''))
  storage.setItem(STORAGE_KEYS.currentQuery, String(query || ''))
  storage.setItem(STORAGE_KEYS.pathEnteredAt, String(Date.now()))
  storage.setItem(STORAGE_KEYS.pathActiveMs, '0')
  storage.setItem(STORAGE_KEYS.pathVisibleSince, String(Date.now()))
}

const readPathActiveMs = () => {
  const storage = safeStorage('session')
  if (!storage) return 0
  return Math.max(0, Number(storage.getItem(STORAGE_KEYS.pathActiveMs) || 0))
}

const writePathActiveMs = (ms) => {
  const storage = safeStorage('session')
  if (!storage) return
  storage.setItem(STORAGE_KEYS.pathActiveMs, String(Math.max(0, Math.round(ms))))
}

const readPathVisibleSince = () => {
  const storage = safeStorage('session')
  if (!storage) return 0
  return Math.max(0, Number(storage.getItem(STORAGE_KEYS.pathVisibleSince) || 0))
}

const writePathVisibleSince = (ts) => {
  const storage = safeStorage('session')
  if (!storage) return
  storage.setItem(STORAGE_KEYS.pathVisibleSince, String(Math.max(0, Math.round(ts))))
}

/** Accumulate only while the tab is visible (background time excluded). */
const syncActiveDwellSlice = (now = Date.now()) => {
  if (!isBrowser()) return
  const visibleSince = readPathVisibleSince()
  if (document.visibilityState !== 'visible' || visibleSince <= 0) return
  const elapsed = Math.max(0, now - visibleSince)
  if (elapsed <= 0) return
  writePathActiveMs(readPathActiveMs() + elapsed)
  writePathVisibleSince(now)
}

const pauseActiveDwell = (now = Date.now()) => {
  syncActiveDwellSlice(now)
  writePathVisibleSince(0)
}

const resumeActiveDwell = (now = Date.now()) => {
  if (document.visibilityState === 'visible') {
    writePathVisibleSince(now)
  }
}

export const getActiveDwellMs = () => {
  if (!isBrowser()) return 0
  syncActiveDwellSlice()
  return capDwellMsForReport(readPathActiveMs())
}

const buildPageExitRow = async ({ path, query = '', dwellMs = 0, meta = {} } = {}) => {
  const landing = getLandingContext()
  const userId = await getCachedUserId()
  const safeDwellMs = capDwellMsForReport(dwellMs)
  if (safeDwellMs <= 0) return null
  return {
    session_id: getAnalyticsSessionId(),
    user_id: userId,
    event_name: 'page_exit',
    page_path: path || (isBrowser() ? window.location.pathname || '' : ''),
    page_query: query || (isBrowser() ? window.location.search || '' : ''),
    page_title: isBrowser() ? document.title || '' : '',
    internal_referrer_path: getCurrentAnalyticsPath(),
    referrer_url: landing.referrer_url || '',
    referrer_domain: landing.referrer_domain || '',
    source: landing.utm_source || '',
    medium: landing.utm_medium || '',
    campaign: landing.utm_campaign || '',
    dwell_ms: safeDwellMs,
    event_meta: withClientContext({
      dwell_kind: 'active_visible',
      dwell_cap_ms: ANALYTICS_DWELL_REPORT_CAP_MS,
      ...(meta && typeof meta === 'object' ? meta : {}),
    }),
  }
}

const queuePendingPageExit = (row) => {
  const storage = safeStorage('session')
  if (!storage || !row) return
  try {
    storage.setItem(STORAGE_KEYS.pendingExit, JSON.stringify(row))
  } catch {
    // ignore quota
  }
}

const flushPendingPageExit = async () => {
  const storage = safeStorage('session')
  if (!storage) return
  const raw = storage.getItem(STORAGE_KEYS.pendingExit)
  if (!raw) return
  storage.removeItem(STORAGE_KEYS.pendingExit)
  try {
    const row = JSON.parse(raw)
    if (!row || row.event_name !== 'page_exit') return
    await supabase.from('site_analytics_events').insert(row)
  } catch {
    // ignore stale / invalid pending rows
  }
}

export const commitAnalyticsPageExit = async ({ path, query = '', meta = {} } = {}) => {
  if (!isBrowser()) return
  syncActiveDwellSlice()
  const dwellMs = readPathActiveMs()
  const row = await buildPageExitRow({ path, query, dwellMs, meta })
  if (!row) return
  writePathActiveMs(0)
  writePathVisibleSince(document.visibilityState === 'visible' ? Date.now() : 0)
  try {
    await supabase.from('site_analytics_events').insert(row)
  } catch {
    queuePendingPageExit(row)
  }
}

export const installAnalyticsDwellListeners = () => {
  if (!isBrowser() || dwellListenersInstalled) return
  dwellListenersInstalled = true

  if (readPathVisibleSince() <= 0 && document.visibilityState === 'visible') {
    writePathVisibleSince(Date.now())
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pauseActiveDwell()
      return
    }
    resumeActiveDwell()
  })

  window.addEventListener('pagehide', (event) => {
    pauseActiveDwell()
    if (event.persisted) return
    const path = getCurrentAnalyticsPath()
    if (!path) return
    void buildPageExitRow({
      path,
      query: getCurrentAnalyticsQuery(),
      dwellMs: readPathActiveMs(),
      meta: { flush_reason: 'pagehide' },
    }).then((row) => {
      if (row) queuePendingPageExit(row)
    })
  })
}

export const getCurrentAnalyticsPath = () => {
  const storage = safeStorage('session')
  if (!storage) return ''
  return storage.getItem(STORAGE_KEYS.currentPath) || ''
}

export const getCurrentAnalyticsQuery = () => {
  const storage = safeStorage('session')
  if (!storage) return ''
  return storage.getItem(STORAGE_KEYS.currentQuery) || ''
}

export const getCurrentPathEnteredAt = () => {
  const storage = safeStorage('session')
  if (!storage) return 0
  return Number(storage.getItem(STORAGE_KEYS.pathEnteredAt) || 0)
}

/** Device / locale / timezone — stored in event_meta for CRM Audience panel. */
export const getClientAnalyticsContext = () => {
  if (!isBrowser()) {
    return { device_type: 'unknown', locale: '', timezone: 'UTC' }
  }
  const ua = String(navigator.userAgent || '')
  let device_type = 'desktop'
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/\bAndroid\b/i.test(ua) && !/Mobile/i.test(ua))) {
    device_type = 'tablet'
  } else if (/Mobi|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    device_type = 'mobile'
  }
  let timezone = 'UTC'
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone
  } catch {
    // keep UTC
  }
  const locale = String(navigator.language || '').trim()
  return { device_type, locale, timezone }
}

const withClientContext = (meta = {}) => ({
  ...getClientAnalyticsContext(),
  ...(meta && typeof meta === 'object' ? meta : {}),
})

const buildAnalyticsRow = async (eventName, eventMeta = {}) => {
  bootstrapAnalytics()

  const landing = getLandingContext()
  const userId = await getCachedUserId()

  return {
    session_id: getAnalyticsSessionId(),
    user_id: userId,
    event_name: eventName,
    page_path: isBrowser() ? window.location.pathname || '' : '',
    page_query: isBrowser() ? window.location.search || '' : '',
    page_title: isBrowser() ? document.title || '' : '',
    internal_referrer_path: getCurrentAnalyticsPath(),
    referrer_url: landing.referrer_url || '',
    referrer_domain: landing.referrer_domain || '',
    source: landing.utm_source || '',
    medium: landing.utm_medium || '',
    campaign: landing.utm_campaign || '',
    event_meta: withClientContext(eventMeta),
  }
}

export const trackAnalyticsEvent = async (eventName, eventMeta = {}) => {
  try {
    const row = await buildAnalyticsRow(eventName, eventMeta)
    const { error } = await supabase.from('site_analytics_events').insert(row)
    if (error && import.meta.env.DEV) console.warn('[analytics] insert error:', error.message)
  } catch {
    // Do not block user interactions on analytics failures.
  }
}

export const trackPageView = async ({ path, query = '', dwellMs = null, meta = {} } = {}) => {
  try {
    bootstrapAnalytics()
    const landing = getLandingContext()
    const userId = await getCachedUserId()

    await supabase.from('site_analytics_events').insert({
      session_id: getAnalyticsSessionId(),
      user_id: userId,
      event_name: 'page_view',
      page_path: path || (isBrowser() ? window.location.pathname || '' : ''),
      page_query: query || (isBrowser() ? window.location.search || '' : ''),
      page_title: isBrowser() ? document.title || '' : '',
      internal_referrer_path: getCurrentAnalyticsPath(),
      referrer_url: landing.referrer_url || '',
      referrer_domain: landing.referrer_domain || '',
      source: landing.utm_source || '',
      medium: landing.utm_medium || '',
      campaign: landing.utm_campaign || '',
      dwell_ms: Number.isFinite(Number(dwellMs)) ? Math.max(0, Math.round(Number(dwellMs))) : null,
      event_meta: withClientContext(meta),
    })
  } catch {
    // no-op
  }
}

export const trackPageExit = async ({ path, query = '', dwellMs = 0, meta = {} } = {}) => {
  const safeDwellMs = capDwellMsForReport(dwellMs)
  if (safeDwellMs <= 0) return
  try {
    const row = await buildPageExitRow({
      path,
      query,
      dwellMs: safeDwellMs,
      meta: { ...meta, flush_reason: meta.flush_reason || 'spa_navigate' },
    })
    if (!row) return
    await supabase.from('site_analytics_events').insert(row)
  } catch {
    // no-op
  }
}

const truncateUtf = (value, max) => {
  const str = String(value || '')
  if (str.length <= max) return str
  return str.slice(0, max)
}

const PROFILE_ATTRIBUTION_FIELDS = [
  'signup_referrer_domain',
  'signup_referrer_url',
  'signup_utm_source',
  'signup_utm_medium',
  'signup_utm_campaign',
  'signup_ref',
  'signup_landing_path',
  'signup_landing_query',
  'signup_attribution_captured_at',
]

export const getSignupAttributionFromUserMetadata = (meta = {}) => {
  const m = meta && typeof meta === 'object' ? meta : {}
  const out = {}
  for (const key of PROFILE_ATTRIBUTION_FIELDS) {
    const val = String(m[key] ?? '').trim()
    if (val) out[key] = truncateUtf(val, key.includes('url') ? 1000 : key.includes('path') ? 512 : 255)
  }
  return out
}

/** Columns for user_profiles (first-touch only; omit empty fields). */
export const getSignupAttributionForProfile = () => {
  if (!isBrowser()) return {}
  refreshSignupAttributionFromBrowser()
  bootstrapAnalytics()
  const landing = getLandingContext()
  const hasAttribution = Boolean(
    landing.referrer_domain
      || landing.utm_source
      || landing.utm_medium
      || landing.utm_campaign
      || landing.signup_ref,
  )
  const capturedAt = landing.first_seen_at || new Date().toISOString()
  const out = {}
  if (landing.referrer_domain) out.signup_referrer_domain = truncateUtf(landing.referrer_domain, 255)
  if (landing.referrer_url) out.signup_referrer_url = truncateUtf(landing.referrer_url, 1000)
  if (landing.utm_source) out.signup_utm_source = truncateUtf(landing.utm_source, 255)
  if (landing.utm_medium) out.signup_utm_medium = truncateUtf(landing.utm_medium, 255)
  if (landing.utm_campaign) out.signup_utm_campaign = truncateUtf(landing.utm_campaign, 255)
  if (landing.signup_ref) out.signup_ref = truncateUtf(landing.signup_ref, 64)
  if (landing.landing_path) out.signup_landing_path = truncateUtf(landing.landing_path, 512)
  if (landing.landing_query) out.signup_landing_query = truncateUtf(landing.landing_query, 512)
  if (hasAttribution || landing.landing_path) {
    out.signup_attribution_captured_at = capturedAt
  }
  return out
}

/** Flat strings for auth.signUp options.data → raw_user_meta_data → DB trigger. */
export const getSignupAttributionForUserMetadata = () => {
  const p = getSignupAttributionForProfile()
  return {
    signup_referrer_domain: p.signup_referrer_domain || '',
    signup_referrer_url: p.signup_referrer_url || '',
    signup_utm_source: p.signup_utm_source || '',
    signup_utm_medium: p.signup_utm_medium || '',
    signup_utm_campaign: p.signup_utm_campaign || '',
    signup_ref: p.signup_ref || '',
    signup_landing_path: p.signup_landing_path || '',
    signup_landing_query: p.signup_landing_query || '',
    signup_attribution_captured_at: p.signup_attribution_captured_at || '',
  }
}

const mergeAttributionPatch = (row = {}, ...sources) => {
  const patch = {}
  for (const key of PROFILE_ATTRIBUTION_FIELDS) {
    if (String(row?.[key] ?? '').trim()) continue
    for (const src of sources) {
      const val = String(src?.[key] ?? '').trim()
      if (val) {
        patch[key] = val
        break
      }
    }
  }
  return patch
}

/** OAuth / delayed session: fill empty profile attribution from browser + auth metadata. */
export async function backfillSignupAttributionIfEmpty(supabaseClient, userId) {
  if (!supabaseClient || !userId) return
  refreshSignupAttributionFromBrowser()
  try {
    const { data: row, error: selErr } = await supabaseClient
      .from('user_profiles')
      .select(PROFILE_ATTRIBUTION_FIELDS.join(','))
      .eq('user_id', userId)
      .maybeSingle()
    if (selErr || !row) return

    const hasAny = PROFILE_ATTRIBUTION_FIELDS.some((key) => String(row?.[key] ?? '').trim())
    if (hasAny) return

    const fromLanding = getSignupAttributionForProfile()
    let fromMeta = {}
    try {
      const { data: authData } = await supabaseClient.auth.getUser()
      fromMeta = getSignupAttributionFromUserMetadata(authData?.user?.user_metadata)
    } catch {
      // ignore
    }

    const patch = mergeAttributionPatch(row, fromLanding, fromMeta)
    if (Object.keys(patch).length === 0) return
    await supabaseClient.from('user_profiles').update(patch).eq('user_id', userId)
  } catch {
    // ignore
  }
}
