const PAYJP_API = 'https://api.pay.jp/v1'

function flattenForm(obj, prefix = '', out = {}) {
  if (obj == null) return out
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) out[prefix] = String(obj)
    return out
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      flattenForm(v, key, out)
    } else if (v != null && v !== '') {
      out[key] = String(v)
    }
  }
  return out
}

export function getPayjpSecretKey() {
  return String(process.env.PAYJP_SECRET_KEY || '').trim()
}

export function getPayjpPlanId(billingCycle) {
  const cycle = String(billingCycle || 'monthly').trim().toLowerCase()
  if (cycle === 'annual' || cycle === 'yearly') {
    return String(process.env.PAYJP_PLAN_ID_ANNUAL || '').trim()
  }
  return String(process.env.PAYJP_PLAN_ID_MONTHLY || '').trim()
}

export async function payjpRequest(path, { method = 'GET', body } = {}) {
  const secret = getPayjpSecretKey()
  if (!secret) {
    const err = new Error('PAYJP_SECRET_KEY is not set')
    err.code = 'payjp_env_missing'
    throw err
  }

  const headers = {
    Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
  }
  let payload
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    payload = new URLSearchParams(flattenForm(body)).toString()
  }

  const res = await fetch(`${PAYJP_API}${path}`, { method, headers, body: payload })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.message || `PAY.JP HTTP ${res.status}`)
    err.code = data?.error?.code || 'payjp_api_error'
    err.status = res.status
    err.payjp = data
    throw err
  }
  return data
}

/** Unix seconds — current_period_end 優先、なければ trial_end（PAY.JP trial 契約） */
export function payjpSubscriptionPeriodEndUnix(sub) {
  const end = Number(sub?.current_period_end)
  if (Number.isFinite(end) && end > 0) return end
  const trialEnd = Number(sub?.trial_end)
  if (Number.isFinite(trialEnd) && trialEnd > 0) return trialEnd
  return 0
}

export function payjpPeriodEndIso(sub) {
  const t = payjpSubscriptionPeriodEndUnix(sub)
  if (t > 0) return new Date(t * 1000).toISOString()
  return null
}

export function isPayjpTrialLikeStatus(status) {
  const st = String(status || '').toLowerCase()
  return st === 'trial' || st === 'trialing'
}

/** @returns {'active'|'canceled'|'paused'|'expired'} */
export function payjpEntitlementStatus(sub) {
  const nowSec = Date.now() / 1000
  const end = payjpSubscriptionPeriodEndUnix(sub)
  const st = String(sub?.status || '').toLowerCase()
  const inPeriod = end > 0 && end > nowSec

  // PAY.JP 本番は status: "trial"（Stripe 流の trialing ではない）
  if (isPayjpTrialLikeStatus(st) && inPeriod) return 'active'
  if (st === 'active' && inPeriod) return 'active'
  if ((st === 'canceled' || st === 'paused') && inPeriod) return 'active'
  if (st === 'paused') return 'paused'
  if (st === 'canceled') return 'canceled'
  return 'expired'
}

/**
 * Cancel is idempotent for account deletion.
 * PAY.JP returns HTTP 400 with message
 * "Subscription `sub_…` already has been canceled" (the word "has" is required).
 * A missing subscription is HTTP 404, often "No such subscription: sub_…".
 */
export function isPayjpSubscriptionAlreadyGone(err) {
  if (Number(err?.status) === 404) return true
  const code = String(err?.code || err?.payjp?.error?.code || '').toLowerCase()
  if (code === 'already_canceled') return true
  const msg = String(err?.message || err?.payjp?.error?.message || '')
  return /no such subscription|already has been canceled|already been canceled|already canceled/i.test(msg)
}

export async function fetchPayjpCustomer(customerId) {
  if (!customerId) return null
  return payjpRequest(`/customers/${encodeURIComponent(customerId)}`)
}

export async function fetchPayjpSubscription(subscriptionId) {
  if (!subscriptionId) return null
  return payjpRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
}

export function userIdFromPayjpCustomer(customer) {
  const meta = customer?.metadata || {}
  return String(meta.supabase_user_id || meta.user_id || '').trim() || null
}
