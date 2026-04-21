export function sanitizeInternalRedirectPath(input, fallback = '/') {
  const raw = String(input || '').trim()
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//')) return fallback
  if (/^\/(login|signup|reset-password)(?:[/?#]|$)/.test(raw)) return fallback
  return raw
}

