const STORAGE_KEY = 'mm_pending_referral_code'
const QUERY_KEYS = ['ref', 'invite', 'r']

const normalizeCode = (raw) => {
  const s = String(raw ?? '').trim()
  if (!s || s.length > 32) return ''
  if (!/^[a-zA-Z0-9]+$/.test(s)) return ''
  return s.toUpperCase()
}

/**
 * Persist ?ref= / ?invite= from the URL for signup + OAuth attribution.
 * Call on navigation (e.g. when location.search changes).
 */
export function captureReferralFromUrl(search) {
  if (typeof window === 'undefined') return
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  for (const key of QUERY_KEYS) {
    const code = normalizeCode(q.get(key))
    if (code.length >= 4) {
      try {
        window.localStorage.setItem(STORAGE_KEY, code)
      } catch {
        // ignore quota / private mode
      }
      return
    }
  }
}

export function getPendingReferralCode() {
  if (typeof window === 'undefined') return ''
  try {
    return normalizeCode(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return ''
  }
}

export function clearPendingReferralCode() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
