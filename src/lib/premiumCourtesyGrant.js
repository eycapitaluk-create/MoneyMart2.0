import { isPremiumTrialActive, isPaidPlanTier } from './membership'

export const PREMIUM_COURTESY_GIFT_BADGE = '🎁 プレミアム1ヶ月無料プレゼント中'

const THANKS_STORAGE_PREFIX = 'mm_premium_courtesy_thanks_v1:'

/** 運営付与の短期 Premium（おおよそ1ヶ月）。Pay/Apple 課金・長期スタッフ付与・7日お試しは除外 */
export function isCourtesyPremiumGiftActive({
  premiumUntil = null,
  premiumTrialEndsAt = null,
  hasBillingEntitlement = false,
  planTier = '',
} = {}) {
  if (hasBillingEntitlement) return false

  const untilTs = premiumUntil ? new Date(premiumUntil).getTime() : NaN
  if (!Number.isFinite(untilTs) || untilTs <= Date.now()) return false

  const daysLeft = (untilTs - Date.now()) / 86400000
  if (daysLeft > 45) return false

  const pt = String(planTier || '').toLowerCase()
  if (!isPaidPlanTier(pt)) return false

  if (isPremiumTrialActive(premiumTrialEndsAt) && !premiumUntil) return false

  return true
}

export function courtesyThanksStorageKey(userId, premiumUntil) {
  const uid = String(userId || '').trim()
  const until = String(premiumUntil || '').trim()
  if (!uid || !until) return ''
  return `${THANKS_STORAGE_PREFIX}${uid}:${until}`
}

export function shouldShowCourtesyThanksOnLogin(userId, premiumUntil) {
  if (typeof window === 'undefined') return false
  const key = courtesyThanksStorageKey(userId, premiumUntil)
  if (!key) return false
  try {
    return window.sessionStorage.getItem(key) !== '1'
  } catch {
    return true
  }
}

export function markCourtesyThanksShown(userId, premiumUntil) {
  if (typeof window === 'undefined') return
  const key = courtesyThanksStorageKey(userId, premiumUntil)
  if (!key) return
  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // ignore quota / private mode
  }
}

export function buildCourtesyThanksMessage(premiumUntil = null) {
  const untilJa = premiumUntil
    ? new Date(premiumUntil).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Tokyo',
    })
    : null
  const suffix = untilJa ? `（${untilJa}まで）` : ''
  return `${PREMIUM_COURTESY_GIFT_BADGE}を適用しました。ご利用ありがとうございます！${suffix}`
}

export function formatCourtesyGiftUntilJa(premiumUntil) {
  if (!premiumUntil) return ''
  try {
    return new Date(premiumUntil).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Tokyo',
    })
  } catch {
    return ''
  }
}
