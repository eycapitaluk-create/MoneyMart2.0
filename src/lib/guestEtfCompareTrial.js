const STORAGE_KEY = 'moneymart.guest.etf_compare.trial.v1'
export const GUEST_ETF_COMPARE_TRIAL_LIMIT = 1

function readStore() {
  try {
    if (typeof window === 'undefined') return {}
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(next) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* best-effort */
  }
}

export function getGuestEtfCompareTrialUsageCount() {
  const used = Number(readStore()?.usedCount ?? 0)
  return Number.isFinite(used) ? Math.max(0, Math.floor(used)) : 0
}

export function isGuestEtfCompareTrialConsumed() {
  return getGuestEtfCompareTrialUsageCount() >= GUEST_ETF_COMPARE_TRIAL_LIMIT
}

export function getGuestEtfCompareTrialRemaining() {
  return Math.max(0, GUEST_ETF_COMPARE_TRIAL_LIMIT - getGuestEtfCompareTrialUsageCount())
}

/** @returns {boolean} true if a trial slot was consumed by this call */
export function consumeGuestEtfCompareTrial() {
  if (isGuestEtfCompareTrialConsumed()) return false
  const store = readStore()
  const nextUsed = getGuestEtfCompareTrialUsageCount() + 1
  writeStore({
    ...store,
    usedCount: nextUsed,
    consumedAt: new Date().toISOString(),
  })
  return true
}

export function canGuestAccessEtfCompare(isLoggedIn = false) {
  if (isLoggedIn) return true
  return !isGuestEtfCompareTrialConsumed()
}
