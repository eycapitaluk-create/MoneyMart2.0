/** entitlement 行が現在有効か（sync 後は trial も status=active で格納） */
export function isEntitlementRowPremium(row, nowMs = Date.now()) {
  const st = String(row?.status || '').toLowerCase()
  if (st !== 'active' && st !== 'trialing' && st !== 'trial') return false
  const endRaw = row?.current_period_end
  if (endRaw == null || endRaw === '') return true
  const t = new Date(endRaw).getTime()
  return Number.isFinite(t) && t > nowMs
}

/**
 * user_premium_entitlements → user_profiles 集約（Apple / PAY.JP 共通）
 */
export async function recomputeUserPremium(admin, userId) {
  const { data: ents, error: e1 } = await admin
    .from('user_premium_entitlements')
    .select('status, current_period_end')
    .eq('user_id', userId)
  if (e1) throw e1

  if (!ents?.length) {
    return { skipped: true }
  }

  const now = Date.now()
  let maxEnd = 0
  let hasOpenEndedActive = false
  for (const row of ents) {
    if (!isEntitlementRowPremium(row, now)) continue
    const endRaw = row.current_period_end
    if (endRaw == null || endRaw === '') {
      hasOpenEndedActive = true
      continue
    }
    const t = new Date(endRaw).getTime()
    if (Number.isFinite(t) && t > maxEnd) maxEnd = t
  }
  const isPremium = hasOpenEndedActive || maxEnd > now
  const premiumUntil = maxEnd > 0 ? new Date(maxEnd).toISOString() : null

  const { error: e2 } = await admin
    .from('user_profiles')
    .update({
      is_premium: isPremium,
      premium_until: premiumUntil,
      plan_tier: isPremium ? 'premium' : 'free',
      subscription_tier: isPremium ? 'premium' : 'free',
    })
    .eq('user_id', userId)
  if (e2) throw e2
  return { skipped: false, isPremium, premiumUntil }
}

export async function upsertPremiumEntitlement(admin, row) {
  const { error } = await admin.from('user_premium_entitlements').upsert(row, {
    onConflict: 'user_id,provider,external_subscription_key',
  })
  if (error) throw error
}
