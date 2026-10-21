/** One App Store original transaction may unlock only one MoneyMart account. */

export function foreignAppleSubscriptionOwner(rows, userId) {
  const self = String(userId || '').trim()
  for (const row of Array.isArray(rows) ? rows : []) {
    const owner = String(row?.user_id || '').trim()
    if (owner && owner !== self) return owner
  }
  return null
}

/**
 * StoreKit signed transaction dates are Unix milliseconds.
 * A refund sets revocationDate while expiresDate can still be in the future.
 */
export function appleSubscriptionGrant(tx, nowMs = Date.now()) {
  const expiresMs = Number(tx?.expiresDate)
  const expiresOk = Number.isFinite(expiresMs)
  const revokedMs = Number(tx?.revocationDate)
  const revoked = Number.isFinite(revokedMs) && revokedMs > 0
  const active = expiresOk && !revoked && expiresMs > nowMs
  return {
    expiresMs: expiresOk ? expiresMs : null,
    revoked,
    active,
  }
}
