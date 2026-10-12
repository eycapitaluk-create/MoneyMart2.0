/**
 * POST /api/billing/payjp/webhook
 * PAY.JP Webhook（定期課金イベント）→ user_premium_entitlements 同期
 *
 * Env: PAYJP_WEBHOOK_TOKEN（ダッシュボードの Webhook トークンと一致）
 */
import { createClient } from '@supabase/supabase-js'
import { fetchPayjpSubscription } from '../../_lib/payjp-api.js'
import { syncPayjpSubscription } from '../../_lib/payjp-sync.js'
import { getSupabaseEnv, readJsonBody, sendBillingJson } from '../../_lib/supabase-bearer-auth.js'

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.created',
  'subscription.updated',
  'subscription.renewed',
  'subscription.canceled',
  'subscription.deleted',
  'subscription.paused',
  'subscription.resumed',
])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendBillingJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const expectedToken = String(process.env.PAYJP_WEBHOOK_TOKEN || '').trim()
  const receivedToken = String(
    req.headers['payjp-webhook-token']
    || req.headers['x-payjp-webhook-token']
    || '',
  ).trim()

  if (!expectedToken) {
    console.error('[payjp/webhook] PAYJP_WEBHOOK_TOKEN missing')
    return sendBillingJson(res, 503, { ok: false, error: 'Webhook not configured' })
  }
  if (!receivedToken || receivedToken !== expectedToken) {
    return sendBillingJson(res, 401, { ok: false, error: 'Invalid webhook token' })
  }

  const { supabaseUrl, serviceKey } = getSupabaseEnv()
  if (!supabaseUrl || !serviceKey) {
    return sendBillingJson(res, 500, { ok: false, error: 'Supabase env missing' })
  }

  let event
  try {
    event = await readJsonBody(req)
  } catch {
    return sendBillingJson(res, 400, { ok: false, error: 'Invalid JSON' })
  }

  const type = String(event?.type || '').trim()
  if (!SUBSCRIPTION_EVENTS.has(type)) {
    return sendBillingJson(res, 200, { ok: true, ignored: true, type })
  }

  let subscription = event?.data
  if (!subscription?.id) {
    return sendBillingJson(res, 400, { ok: false, error: 'Missing subscription data' })
  }

  try {
    subscription = await fetchPayjpSubscription(subscription.id)
  } catch (err) {
    console.error('[payjp/webhook] fetch subscription', err?.message)
    return sendBillingJson(res, 502, { ok: false, error: 'Failed to refresh subscription' })
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  try {
    const synced = await syncPayjpSubscription(admin, subscription)
    return sendBillingJson(res, 200, {
      ok: true,
      type,
      subscription_id: subscription.id,
      user_id: synced.userId,
      status: synced.status,
    })
  } catch (err) {
    console.error('[payjp/webhook] sync', err?.message)
    if (err.code === 'payjp_user_unresolved') {
      return sendBillingJson(res, 200, { ok: true, skipped: true, reason: err.message })
    }
    return sendBillingJson(res, 500, { ok: false, error: err.message || 'sync failed' })
  }
}
