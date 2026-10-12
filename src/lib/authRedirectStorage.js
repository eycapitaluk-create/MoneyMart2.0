import { sanitizeInternalRedirectPath } from './navigationGuards'

const AUTH_REDIRECT_KEY = 'mm_auth_redirect'

export function storeAuthRedirectPath(path) {
  try {
    sessionStorage.setItem(AUTH_REDIRECT_KEY, sanitizeInternalRedirectPath(path, '/'))
  } catch {
    /* ignore */
  }
}

export function consumeAuthRedirectPath(fallback = '/') {
  try {
    const raw = sessionStorage.getItem(AUTH_REDIRECT_KEY)
    sessionStorage.removeItem(AUTH_REDIRECT_KEY)
    return sanitizeInternalRedirectPath(raw, fallback)
  } catch {
    return fallback
  }
}

export function peekAuthRedirectPath(fallback = '/') {
  try {
    const raw = sessionStorage.getItem(AUTH_REDIRECT_KEY)
    return sanitizeInternalRedirectPath(raw, fallback)
  } catch {
    return fallback
  }
}
