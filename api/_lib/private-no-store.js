/** Authenticated campaign and admin payloads must not be stored by shared caches. */
export function applyPrivateNoStore(res) {
  if (!res || typeof res.setHeader !== 'function') return
  res.setHeader('Cache-Control', 'private, no-store')
}
