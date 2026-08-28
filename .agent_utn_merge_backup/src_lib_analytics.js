/**
 * Analytics - no-op stub for tracking
 */
export function trackAnalyticsEvent(name, props = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, props)
  }
}
