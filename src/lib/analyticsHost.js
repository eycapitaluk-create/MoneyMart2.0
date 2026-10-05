/** Local dev hostnames. Production analytics inserts skip these. */

export function isLocalAnalyticsHost(hostname = '') {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host) return false
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || host === '[::1]'
    || host.endsWith('.local')
}
