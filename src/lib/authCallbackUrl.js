import { SITE_ORIGIN } from './seoConfig'

export const AUTH_CALLBACK_PATH = '/signup-complete'

function callbackOrigin() {
  if (typeof window !== 'undefined') {
    const origin = String(window.location.origin || '').trim()
    if (origin.startsWith('http')) return origin.replace(/\/$/, '')
  }
  return String(SITE_ORIGIN || 'https://www.moneymart.co.jp').replace(/\/$/, '')
}

/**
 * Exact callback only. The production allowlist is
 * https://www.moneymart.co.jp/signup-complete with no query and no wildcard.
 * A `?next` query is not sent. The return path travels in user metadata instead.
 */
export function getAuthCallbackUrl() {
  return `${callbackOrigin()}${AUTH_CALLBACK_PATH}`
}

export function parseAuthCallbackError() {
  if (typeof window === 'undefined') return ''
  try {
    const params = new URLSearchParams(window.location.search || '')
    const desc = String(params.get('error_description') || params.get('error') || '').trim()
    if (!desc) return ''
    try {
      return decodeURIComponent(desc.replace(/\+/g, ' '))
    } catch {
      return desc
    }
  } catch {
    return ''
  }
}

export function hasAuthCallbackPayload() {
  if (typeof window === 'undefined') return false
  const search = window.location.search || ''
  const hash = window.location.hash || ''
  return search.includes('code=')
    || hash.includes('access_token')
    || hash.includes('type=signup')
    || Boolean(parseAuthCallbackError())
}

export function scrubAuthCallbackUrl() {
  if (typeof window === 'undefined') return
  try {
    window.history.replaceState({}, document.title, AUTH_CALLBACK_PATH)
  } catch {
    /* ignore */
  }
}
