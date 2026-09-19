/**
 * Microsoft Clarity — session replay / click heatmaps (public pages only).
 * Base tag is injected in index.html at build time (Vite plugin).
 *
 * Env: VITE_CLARITY_PROJECT_ID (production). Optional VITE_CLARITY_DEV=true for local.
 */

const PROJECT_ID = String(import.meta.env.VITE_CLARITY_PROJECT_ID || '').trim()

/** Paths where recording must not run (portfolio, admin, auth recovery). */
const EXCLUDED_PATH_PREFIXES = [
  '/mypage',
  '/admin',
  '/reset-password',
  '/forgot-password',
]

const isBrowser = () => typeof window !== 'undefined'

export const isClarityConfigured = () => Boolean(PROJECT_ID)

export const shouldLoadClarity = () => {
  if (!isClarityConfigured() || !isBrowser()) return false
  if (import.meta.env.PROD) return true
  return String(import.meta.env.VITE_CLARITY_DEV || '').toLowerCase() === 'true'
}

export const isClarityExcludedPath = (pathname = '') => {
  const path = String(pathname || '/').toLowerCase()
  return EXCLUDED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

let recordingPaused = false

const clarityCall = (...args) => {
  if (!isBrowser()) return
  const fn = window.clarity
  if (typeof fn === 'function') fn(...args)
}

const ensureClarityScript = () => {
  if (!shouldLoadClarity() || !isBrowser()) return false
  if (typeof window.clarity === 'function') return true
  if (document.querySelector('script[data-mm-clarity="1"]')) return true

  window.clarity = window.clarity || function clarityQueue(...queued) {
    (window.clarity.q = window.clarity.q || []).push(queued)
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(PROJECT_ID)}`
  script.setAttribute('data-mm-clarity', '1')
  document.head.appendChild(script)
  return true
}

const pauseRecording = () => {
  if (recordingPaused) return
  clarityCall('pause')
  recordingPaused = true
}

const resumeRecording = (pathname) => {
  if (!recordingPaused) {
    if (pathname) clarityCall('set', 'page', pathname)
    return
  }
  clarityCall('resume')
  recordingPaused = false
  if (pathname) clarityCall('set', 'page', pathname)
}

/** Call on SPA route changes (see Layout.jsx). */
export const syncClarityForRoute = (pathname = '/') => {
  if (!shouldLoadClarity()) return

  const path = String(pathname || '/')
  ensureClarityScript()

  if (isClarityExcludedPath(path)) {
    pauseRecording()
    return
  }

  resumeRecording(path)
}
