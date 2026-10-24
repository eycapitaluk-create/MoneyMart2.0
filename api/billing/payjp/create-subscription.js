/**
 * POST /api/billing/payjp/create-subscription
 * Body: { billing_cycle: "monthly"|"annual", payjp_token: "tok_..." }
 * Authorization: Bearer <Supabase access_token>
 */
import {
  getPayjpPlanId,
  getPayjpSecretKey,
  payjpRequest,
} from '../../_lib/payjp-api.js'
import { syncPayjpSubscription } from '../../_lib/payjp-sync.js'
import {
  readJsonBody,
  requireSupabaseUser,
  sendBillingJson,
} from '../../_lib/supabase-bearer-auth.js'
import { isPremiumTrialActive } from '../../../src/lib/membership.js'

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
    return sendBillingJson(res, 503, {
      ok: false,
      code: 'payjp_env_missing',
      error: '決済機能はただいま準備中です。PAY.JP の API キーを設定してください。',
    })
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
    return sendBillingJson(res, 400, { ok: false, error: 'Invalid JSON body' })
  }

  const billingCycle = String(body.billing_cycle || body.billingCycle || 'monthly').trim().toLowerCase()
  const payjpToken = String(body.payjp_token || body.payjpToken || '').trim()
  if (!payjpToken) {
    return sendBillingJson(res, 400, { ok: false, error: 'payjp_token が必要です。' })
  }

  const planId = getPayjpPlanId(billingCycle)
  if (!planId) {
    return sendBillingJson(res, 503, {
      ok: false,
      code: 'payjp_plan_missing',
      error: 'PAY.JP プラン ID が未設定です（PAYJP_PLAN_ID_MONTHLY / ANNUAL）。',
    })
  }

  const { data: profile, error: profileErr } = await admin
    .from('user_profiles')
    .select('payjp_customer_id, payjp_subscription_id, is_premium, premium_trial_ends_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profileErr) {
    return sendBillingJson(res, 500, { ok: false, error: profileErr.message })
  }

  if (profile?.is_premium) {
    const { data: activePayjp } = await admin
      .from('user_premium_entitlements')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .eq('provider', 'payjp')
      .eq('status', 'active')
      .limit(1)
    const endMs = activePayjp?.[0]?.current_period_end
      ? new Date(activePayjp[0].current_period_end).getTime()
      : 0
    if (endMs > Date.now()) {
      return sendBillingJson(res, 409, {
        ok: false,
        code: 'already_subscribed',
        error: 'すでに Premium 契約中です。解約・変更はマイページまたは PAY.JP の案内に従ってください。',
      })
    }
  }

  let customerId = String(profile?.payjp_customer_id || '').trim()

  const createPayjpCustomer = async () => {
    const customer = await payjpRequest('/customers', {
      method: 'POST',
      body: {
        card: payjpToken,
        email: user.email || undefined,
        description: `MoneyMart Premium (${user.id})`,
        metadata: { supabase_user_id: user.id },
      },
    })
    return String(customer?.id || '').trim()
  }

  const payjpErrMsg = (err) => String(err?.message || '')
  const isStalePayjpCustomer = (err) => /no such customer/i.test(payjpErrMsg(err))
  const isDuplicatePayjpCard = (err) => /already has the same card|same fingerprint/i.test(payjpErrMsg(err))

  try {
    if (!customerId) {
      customerId = await createPayjpCustomer()
    } else {
      try {
        await payjpRequest(`/customers/${encodeURIComponent(customerId)}`, {
          method: 'POST',
          body: { card: payjpToken },
        })
      } catch (updateErr) {
        if (isDuplicatePayjpCard(updateErr)) {
          /* 同一カードは登録済み → そのまま定期課金へ */
        } else if (isStalePayjpCustomer(updateErr)) {
          console.warn('[payjp/create-subscription] stale customer, recreating', customerId)
          customerId = await createPayjpCustomer()
        } else {
          throw updateErr
        }
      }
    }
    if (customerId) {
      await admin
        .from('user_profiles')
        .update({ payjp_customer_id: customerId })
        .eq('user_id', user.id)
    }
  } catch (err) {
    console.error('[payjp/create-subscription] customer', err?.message, err?.payjp)
    return sendBillingJson(res, 402, {
      ok: false,
      code: err.code || 'payjp_customer_failed',
      error: err.message || 'カード登録に失敗しました。',
    })
  }

  if (!customerId) {
    return sendBillingJson(res, 500, { ok: false, error: 'PAY.JP customer の作成に失敗しました。' })
  }

  // 二重課金防止: 生成直前に PAY.JP 側の active / trial 契約を再確認
  try {
    const listed = await payjpRequest(
      `/subscriptions?customer=${encodeURIComponent(customerId)}&limit=100`,
    )
    const activeLike = (listed?.data || []).filter((sub) => {
      const st = String(sub?.status || '').toLowerCase()
      return st === 'active' || st === 'trial' || st === 'trialing'
    })
    if (activeLike.length > 0) {
      return sendBillingJson(res, 409, {
        ok: false,
        code: 'already_subscribed',
        error: 'すでに PAY.JP の有効な定期課金があります。追加作成はできません。',
        subscription_id: activeLike[0]?.id || null,
      })
    }
  } catch (err) {
    console.error('[payjp/create-subscription] list subscriptions', err?.message, err?.payjp)
    return sendBillingJson(res, 502, {
      ok: false,
      code: err.code || 'payjp_list_failed',
      error: '既存契約の確認に失敗したため、新規作成を中止しました。',
    })
  }

  const trialEndsRaw = profile?.premium_trial_ends_at
  const trialActive = isPremiumTrialActive(trialEndsRaw)
  const subscriptionBody = {
    customer: customerId,
    plan: planId,
    metadata: { supabase_user_id: user.id, billing_cycle: billingCycle },
  }
  if (trialActive && trialEndsRaw) {
    subscriptionBody.trial_end = Math.floor(new Date(trialEndsRaw).getTime() / 1000)
  }

  let subscription
  try {
    subscription = await payjpRequest('/subscriptions', {
      method: 'POST',
      body: subscriptionBody,
    })
  } catch (err) {
    console.error('[payjp/create-subscription] subscription', err?.message, err?.payjp)
    const rawMsg = String(err?.message || '')
    const planMissing = /no such plan/i.test(rawMsg)
    return sendBillingJson(res, 402, {
      ok: false,
      code: planMissing ? 'payjp_plan_not_found' : (err.code || 'payjp_subscription_failed'),
      error: planMissing
        ? 'PAY.JP のプラン ID が本番と一致しません。Vercel の PAYJP_PLAN_ID_MONTHLY / ANNUAL を本番（Test OFF）の pln_ に更新して Redeploy してください。'
        : (rawMsg || 'サブスクリプションの開始に失敗しました。'),
    })
  }

  let synced
  try {
    synced = await syncPayjpSubscription(admin, subscription, user.id)
  } catch (err) {
    console.error('[payjp/create-subscription] sync', err?.message)
    return sendBillingJson(res, 500, { ok: false, error: err.message || 'DB 同期に失敗しました。' })
  }

  return sendBillingJson(res, 200, {
    ok: true,
    subscription_id: subscription.id,
    customer_id: customerId,
    billing_cycle: billingCycle,
    trial_deferred: trialActive,
    current_period_end: synced.periodEnd,
    entitlement_status: synced.status,
    profile: synced.profile,
  })
}
