import { sanitizeInternalRedirectPath } from './navigationGuards.js'
import { allowlistedCampaignUtm } from './campaignUtm.js'

/**
 * Internal return path for auth callbacks.
 * Keeps the path plus allowlisted UTM only. Drops tokens, emails, ref, and other query keys.
 */
export function sanitizeAuthReturnPath(input, fallback = '/') {
  const safe = sanitizeInternalRedirectPath(input, fallback)
  const hashless = String(safe || '').split('#')[0]
  const qIndex = hashless.indexOf('?')
  const path = qIndex >= 0 ? hashless.slice(0, qIndex) : hashless
  if (!path.startsWith('/') || path.startsWith('//')) return fallback
  const search = qIndex >= 0 ? hashless.slice(qIndex) : ''
  const utm = allowlistedCampaignUtm(search, {})
  return utm.page_query ? `${path}${utm.page_query}` : path
}

/**
 * Metadata stored at signup. The callback URL itself stays exact, with no query.
 * Supabase uses PKCE, so this path does not finish email confirmation on another device.
 * That exchange still needs the code verifier stored in the browser that started signup.
 */
export function authNextMetadata(returnPath) {
  const next = sanitizeAuthReturnPath(returnPath, '/')
  if (!next || next === '/') return {}
  return { mm_auth_next: next }
}

/** Read `next` from a callback URL search string. Empty when absent or unsafe. */
export function readAuthReturnPath(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  const next = params.get('next')
  if (!next) return ''
  const safe = sanitizeAuthReturnPath(next, '')
  return safe && safe !== '/' ? safe : (safe === '/' ? '/' : '')
}

/**
 * page_query safe to store for /signup-complete.
 * Drops code, tokens, email, and the raw callback query. Keeps allowlisted UTM from `next` only.
 */
export function analyticsQueryForSignupComplete(search = '') {
  const next = readAuthReturnPath(search)
  const qIndex = next.indexOf('?')
  return qIndex >= 0 ? next.slice(qIndex) : ''
}
