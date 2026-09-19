/**
 * POST /api/billing/payjp/cancel-subscription
 * 次回更新停止（期間終了まで利用可）。Authorization: Bearer <Supabase access_token>
 */
import { getPayjpSecretKey, payjpRequest } from '../../_lib/payjp-api.js'
import { syncPayjpSubscription } from '../../_lib/payjp-sync.js'
import {
  readJsonBody,
  requireSupabaseUser,
  sendBillingJson,
} from '../../_lib/supabase-bearer-auth.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    return sendBillingJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  if (!getPayjpSecretKey()) {
    return sendBillingJson(res, 503, { ok: false, code: 'payjp_env_missing', error: '決済未設定' })
  }

  let user
  let admin
  try {
    const authResult = await requireSupabaseUser(req)
    user = authResult.user
    admin = authResult.admin
  } catch (err) {
    return sendBillingJson(res, err.status || 401, { ok: false, error: err.message })
  }

  let body = {}
  try {
    body = await readJsonBody(req)
  } catch {
    body = {}
  }

  const { data: profile } = await admin
    .from('user_profiles')
    .select('payjp_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const subId = String(
    body.subscription_id
    || profile?.payjp_subscription_id
    || '',
  ).trim()

  if (!subId) {
    return sendBillingJson(res, 404, {
      ok: false,
      error: 'PAY.JP の契約が見つかりません。App Store 経由の場合は Apple の設定から解約してください。',
    })
  }

  const { data: ent } = await admin
    .from('user_premium_entitlements')
    .select('external_subscription_key')
    .eq('user_id', user.id)
    .eq('provider', 'payjp')
    .eq('external_subscription_key', subId)
    .maybeSingle()

  if (!ent) {
    return sendBillingJson(res, 403, { ok: false, error: 'この契約を解約する権限がありません。' })
  }

  let subscription
  try {
    subscription = await payjpRequest(`/subscriptions/${encodeURIComponent(subId)}/cancel`, {
      method: 'POST',
    })
  } catch (err) {
    console.error('[payjp/cancel-subscription]', err?.message, err?.payjp)
    return sendBillingJson(res, 502, {
      ok: false,
      error: err.message || '解約処理に失敗しました。',
    })
  }

  try {
    const synced = await syncPayjpSubscription(admin, subscription, user.id)
    return sendBillingJson(res, 200, {
      ok: true,
      subscription_id: subId,
      canceled_at_period_end: true,
      current_period_end: synced.periodEnd,
      profile: synced.profile,
    })
  } catch (err) {
    return sendBillingJson(res, 500, { ok: false, error: err.message || 'DB 同期に失敗しました。' })
  }
}
