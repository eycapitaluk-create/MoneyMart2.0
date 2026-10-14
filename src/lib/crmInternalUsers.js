/** Admin CRM: staff / test accounts to exclude from acquisition metrics. */

export const INTERNAL_EMAIL_DOMAINS = ['moneymart.co.jp', 'community.seed']

export const INTERNAL_EMAILS = new Set([
  'justin.nam@moneymart.co.jp',
  'kelly.nam@moneymart.co.jp',
  'ellen.nam@moneymart.co.jp',
  'test@moneymart.co.jp',
])

const LOCALHOST_RE = /localhost|127\.0\.0\.1|0\.0\.0\.0/i

export const INTERNAL_REFERRER_HOST = 'moneymart.co.jp'

/** Site self-referrals (staff clicking around moneymart.co.jp) — not acquisition. */
export function isInternalReferrerDomain(domain) {
  const raw = String(domain || '').trim().toLowerCase()
  if (!raw || raw === '(direct / unknown)' || raw === '(unknown)' || raw === 'direct / none') return false
  const host = raw.replace(/^www\./, '').split('/')[0].split(':')[0]
  return host === INTERNAL_REFERRER_HOST || host.endsWith(`.${INTERNAL_REFERRER_HOST}`)
}

/** Local dev / Vercel preview origins. Mirrors mm_is_dev_traffic() in SQL. */
export function isDevTrafficDomain(domain) {
  const raw = String(domain || '').trim().toLowerCase()
  if (!raw) return false
  if (LOCALHOST_RE.test(raw)) return true
  const host = raw.split('/')[0].split(':')[0]
  return host.endsWith('.local') || host.endsWith('.vercel.app')
}

export function buildInternalUserIdSet(rows = []) {
  return new Set(
    rows.filter(isCrmInternalUser).map((r) => r.user_id).filter(Boolean),
  )
}

/** Drop rows where a staff account is logged in. Does not drop whole sessions (logged-out browsing in same browser still counts). */
export function filterStaffAnalyticsEvents(rows = [], internalUserIds = new Set()) {
  return rows.filter((row) => {
    if (row?.user_id && internalUserIds.has(row.user_id)) return false
    const path = String(row?.page_path || '')
    if (path === '/admin' || path.startsWith('/admin/')) return false
    if (isDevTrafficDomain(row?.referrer_domain)) return false
    return true
  })
}

export function isCrmInternalEmail(emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase()
  if (!email) return false
  if (INTERNAL_EMAILS.has(email)) return true
  if (email.startsWith('test+') || email.includes('+test@')) return true
  const domain = email.split('@')[1] || ''
  return INTERNAL_EMAIL_DOMAINS.includes(domain)
}

export function isCrmInternalUser(row) {
  // Email wins over the SQL flag. admin_crm_users marks only @moneymart.co.jp
  // and test aliases, so @community.seed rows arrive with is_internal = false.
  if (isCrmInternalEmail(row?.email)) return true
  if (row?.is_internal != null) return Boolean(row.is_internal)
  const email = String(row?.email || '').trim().toLowerCase()
  if (!email) return false
  if (isInternalReferrerDomain(row?.signup_referrer_domain)) return true
  const landQ = String(row?.signup_landing_query || '')
  const landPath = String(row?.signup_landing_path || '')
  const refUrl = String(row?.signup_referrer_url || '')
  if (LOCALHOST_RE.test(landQ) || LOCALHOST_RE.test(landPath) || LOCALHOST_RE.test(refUrl)) return true
  if (refUrl.toLowerCase().includes('moneymart.co.jp')) return true
  return false
}

export function isGoogleOrganicSignup(row) {
  const ref = String(row?.signup_referrer_domain || '').trim().toLowerCase()
  return ref.includes('google.')
}

export function isSmartNewsSignup(row) {
  const ref = String(row?.signup_referrer_domain || '').trim().toLowerCase()
  const utm = [
    row?.signup_utm_source,
    row?.signup_utm_medium,
    row?.signup_utm_campaign,
    row?.signup_ref,
  ].map((v) => String(v || '').trim().toLowerCase()).join(' ')
  return ref.includes('smartnews') || utm.includes('smartnews')
}

const JST = 'Asia/Tokyo'

/** Calendar date in Japan. Signup charts must not use the UTC date prefix. */
export function jstDateKey(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function formatCrmJst(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: JST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** Referrer, UTM, or ref code. A landing path alone is not a source. */
export function hasSignupSource(row) {
  return Boolean(
    String(row?.signup_referrer_domain || '').trim()
    || String(row?.signup_utm_source || '').trim()
    || String(row?.signup_utm_medium || '').trim()
    || String(row?.signup_utm_campaign || '').trim()
    || String(row?.signup_ref || '').trim(),
  )
}

export function signupSourceText(row) {
  if (hasSignupSource(row)) {
    return [
      row?.signup_referrer_domain,
      row?.signup_utm_source,
      row?.signup_utm_medium,
      row?.signup_ref,
    ].map((v) => String(v || '').trim()).filter(Boolean).join(' · ')
  }
  const landing = String(row?.signup_landing_path || '').trim()
  if (landing) return `Not captured · first page ${landing}`
  return 'Not captured'
}

export function isUnknownSignup(row) {
  return !hasSignupSource(row)
}

export function isActivatedSignup(row) {
  if (row?.is_activated != null) return Boolean(row.is_activated)
  return Boolean(
    row?.logged_in_within_7d
    && (
      row?.has_search_7d
      || row?.has_product_view_7d
      || row?.has_watchlist_add_7d
    ),
  )
}

export function isDormantSignup(row) {
  if (row?.is_dormant != null) return Boolean(row.is_dormant)
  return !isActivatedSignup(row) && !isCrmInternalUser(row)
}

export function hasPremiumIntent(row) {
  if (row?.has_premium_intent != null) return Boolean(row.has_premium_intent)
  return Boolean(row?.visited_premium_page || row?.premium_checkout_click)
}

/** Primary CRM lifecycle segment (one label per user). */
export function crmUserSegment(row) {
  if (row?.crm_segment) return String(row.crm_segment)
  if (isCrmInternalUser(row)) return 'internal_test'
  if (hasPremiumIntent(row)) return 'premium_intent'
  if (isUnknownSignup(row)) return 'unknown_signup'
  if (isSmartNewsSignup(row)) return 'smartnews_referral'
  if (isGoogleOrganicSignup(row)) return 'google_organic'
  if (isActivatedSignup(row)) return 'activated'
  return 'dormant'
}

export const CRM_SEGMENT_LABELS = {
  internal_test: 'Internal / test',
  unknown_signup: 'Unknown signup',
  smartnews_referral: 'SmartNews',
  google_organic: 'Google organic',
  activated: 'Activated',
  dormant: 'Dormant',
  premium_intent: 'Premium intent',
}
