import { requireSupabaseUser, sendBillingJson } from './_lib/supabase-bearer-auth.js'

const BUSINESS_DEMO_EMAIL_ALLOWLIST = new Set([
  'kelly.nam@moneymart.co.jp',
  'justin.nam@moneymart.co.jp',
  'ellen.nam@moneymart.co.jp',
])

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET') {
    sendBillingJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const { user } = await requireSupabaseUser(req)
    const email = String(user?.email || '').trim().toLowerCase()
    if (!BUSINESS_DEMO_EMAIL_ALLOWLIST.has(email)) {
      sendBillingJson(res, 403, { allowed: false, error: 'Forbidden' })
      return
    }
    sendBillingJson(res, 200, { allowed: true })
  } catch (error) {
    sendBillingJson(res, Number(error?.status) || 401, {
      allowed: false,
      error: Number(error?.status) === 500 ? 'Access verification unavailable' : 'Unauthorized',
    })
  }
}
