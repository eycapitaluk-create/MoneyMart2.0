import {
  fetchPayjpCustomer,
  payjpEntitlementStatus,
  payjpPeriodEndIso,
} from './payjp-api.js'
import { recomputeUserPremium, upsertPremiumEntitlement } from './premium-entitlements.js'

export async function resolveUserIdForPayjpSubscription(admin, subscription, hintUserId) {
  const hinted = String(hintUserId || '').trim()
  if (hinted) return hinted

  const customerId = String(subscription?.customer || '').trim()
  if (!customerId) return null

  const { data: profileRow } = await admin
    .from('user_profiles')
    .select('user_id')
    .eq('payjp_customer_id', customerId)
    .maybeSingle()
  if (profileRow?.user_id) return profileRow.user_id

  const customer = await fetchPayjpCustomer(customerId)
  const fromMeta = customer?.metadata?.supabase_user_id
  if (fromMeta) return String(fromMeta).trim()

  const subId = String(subscription?.id || '').trim()
  if (subId) {
    const { data: ent } = await admin
      .from('user_premium_entitlements')
      .select('user_id')
      .eq('provider', 'payjp')
      .eq('external_subscription_key', subId)
      .maybeSingle()
    if (ent?.user_id) return ent.user_id
  }

  return null
}

export async function syncPayjpSubscription(admin, subscription, hintUserId) {
  const subId = String(subscription?.id || '').trim()
  if (!subId) throw new Error('subscription.id is required')

  const userId = await resolveUserIdForPayjpSubscription(admin, subscription, hintUserId)
  if (!userId) {
    const err = new Error('Could not resolve Supabase user for PAY.JP subscription')
    err.code = 'payjp_user_unresolved'
    throw err
  }

  const customerId = String(subscription?.customer || '').trim()
  if (customerId) {
    await admin
      .from('user_profiles')
      .update({
        payjp_customer_id: customerId,
        payjp_subscription_id: subId,
      })
      .eq('user_id', userId)
  }

  const status = payjpEntitlementStatus(subscription)
  const periodEnd = payjpPeriodEndIso(subscription)
  const planId = String(subscription?.plan?.id || subscription?.plan || '').trim() || null

  await upsertPremiumEntitlement(admin, {
    user_id: userId,
    provider: 'payjp',
    external_subscription_key: subId,
    status,
    current_period_end: periodEnd,
    product_id: planId,
    raw_payload: subscription,
  })

  const profile = await recomputeUserPremium(admin, userId)
  return { userId, status, periodEnd, profile }
}
