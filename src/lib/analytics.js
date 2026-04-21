import { supabase } from './supabase'

const STORAGE_KEYS = {
  sessionId: 'mm_analytics_session_id',
  landingContext: 'mm_analytics_landing_context_v1',
  currentPath: 'mm_analytics_current_path',
  currentQuery: 'mm_analytics_current_query',
  pathEnteredAt: 'mm_analytics_path_entered_at',
}

const SESSION_CACHE_TTL_MS = 60 * 1000

let cachedUserId = null
let cachedUserIdAt = 0

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
  let value = storage.getItem(STORAGE_KEYS.sessionId)
  if (!value) {
    value = generateId()
    storage.setItem(STORAGE_KEYS.sessionId, value)
  }
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

export const bootstrapAnalytics = () => {
  if (!isBrowser()) return

  getAnalyticsSessionId()

  const storage = safeStorage('local')
  const existing = parseLandingContext()
  if (existing || !storage) return

  const params = new URLSearchParams(window.location.search)
  const referrerUrl = document.referrer || ''
  let referrerDomain = ''
  try {
    referrerDomain = referrerUrl ? new URL(referrerUrl).hostname : ''
  } catch {
    referrerDomain = ''
  }

  const landingContext = {
    first_seen_at: new Date().toISOString(),
    landing_path: window.location.pathname || '/',
    landing_query: window.location.search || '',
    referrer_url: referrerUrl,
    referrer_domain: referrerDomain,
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_term: params.get('utm_term') || '',
    utm_content: params.get('utm_content') || '',
  }

  storage.setItem(STORAGE_KEYS.landingContext, JSON.stringify(landingContext))
}

const getLandingContext = () => parseLandingContext() || {}

const getCachedUserId = async () => {
  const now = Date.now()
  if ((now - cachedUserIdAt) < SESSION_CACHE_TTL_MS) return cachedUserId
  cachedUserIdAt = now
  try {
    // Prefer local session read to avoid unnecessary network on route changes.
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
    event_meta: eventMeta,
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
      event_meta: meta,
    })
  } catch {
    // no-op
  }
}

export const trackPageExit = async ({ path, query = '', dwellMs = 0, meta = {} } = {}) => {
  const safeDwellMs = Math.max(0, Math.round(Number(dwellMs) || 0))
  if (safeDwellMs <= 0) return
  try {
    const landing = getLandingContext()
    const userId = await getCachedUserId()
    await supabase.from('site_analytics_events').insert({
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
      event_meta: meta,
    })
  } catch {
    // no-op
  }
}

const truncateUtf = (value, max) => {
  const str = String(value || '')
  if (str.length <= max) return str
  return str.slice(0, max)
}

/** Columns for user_profiles (first-touch only; omit empty fields). */
export const getSignupAttributionForProfile = () => {
  if (!isBrowser()) return {}
  bootstrapAnalytics()
  const landing = getLandingContext()
  const hasAttribution = Boolean(
    landing.referrer_domain
      || landing.utm_source
      || landing.utm_medium
      || landing.utm_campaign,
  )
  const capturedAt = landing.first_seen_at || new Date().toISOString()
  const out = {}
  if (landing.referrer_domain) out.signup_referrer_domain = truncateUtf(landing.referrer_domain, 255)
  if (landing.referrer_url) out.signup_referrer_url = truncateUtf(landing.referrer_url, 1000)
  if (landing.utm_source) out.signup_utm_source = truncateUtf(landing.utm_source, 255)
  if (landing.utm_medium) out.signup_utm_medium = truncateUtf(landing.utm_medium, 255)
  if (landing.utm_campaign) out.signup_utm_campaign = truncateUtf(landing.utm_campaign, 255)
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
    signup_landing_path: p.signup_landing_path || '',
    signup_landing_query: p.signup_landing_query || '',
    signup_attribution_captured_at: p.signup_attribution_captured_at || '',
  }
}

/** OAuth / delayed session: fill attribution once if profile row is still empty. */
export async function backfillSignupAttributionIfEmpty(supabaseClient, userId) {
  if (!supabaseClient || !userId) return
  const attr = getSignupAttributionForProfile()
  const has = Boolean(
    attr.signup_referrer_domain
      || attr.signup_utm_source
      || attr.signup_utm_medium
      || attr.signup_utm_campaign,
  )
  if (!has) return
  try {
    const { data: row, error: selErr } = await supabaseClient
      .from('user_profiles')
      .select('signup_referrer_domain, signup_utm_source, signup_utm_medium')
      .eq('user_id', userId)
      .maybeSingle()
    if (selErr || !row) return
    if (row.signup_referrer_domain || row.signup_utm_source || row.signup_utm_medium) return
    await supabaseClient.from('user_profiles').update(attr).eq('user_id', userId)
  } catch {
    // ignore
  }
}
