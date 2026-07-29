/**
 * Courtesy (gifted) premium helpers — premium_until without an active Stripe entitlement.
 */

const thanksKey = (userId, premiumUntil) => (
  `mm_courtesy_thanks_v1:${String(userId || '').trim()}:${String(premiumUntil || '').trim()}`
)

export function isCourtesyPremiumGiftActive({
  premiumUntil = null,
  hasBillingEntitlement = false,
  now = Date.now(),
} = {}) {
  if (hasBillingEntitlement) return false
  const untilTs = premiumUntil ? new Date(premiumUntil).getTime() : NaN
  return Number.isFinite(untilTs) && untilTs > now
}

export function shouldShowCourtesyThanksOnLogin(userId, premiumUntil) {
  if (!userId || typeof window === 'undefined') return false
  if (!isCourtesyPremiumGiftActive({ premiumUntil })) return false
  try {
    return window.localStorage.getItem(thanksKey(userId, premiumUntil)) !== '1'
  } catch {
    return false
  }
}

export function markCourtesyThanksShown(userId, premiumUntil) {
  if (!userId || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(thanksKey(userId, premiumUntil), '1')
  } catch {
    // ignore quota / private mode
  }
}

export function buildCourtesyThanksMessage(premiumUntil) {
  const untilTs = premiumUntil ? new Date(premiumUntil).getTime() : NaN
  if (Number.isFinite(untilTs)) {
    const label = new Date(untilTs).toLocaleDateString('ja-JP')
    return `プレミアム体験をご利用いただけます（${label}まで）。MoneyMartをご利用いただきありがとうございます。`
  }
  return 'プレミアム体験をご利用いただけます。MoneyMartをご利用いただきありがとうございます。'
}
