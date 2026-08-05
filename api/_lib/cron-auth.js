export function normalizeSecret(value) {
  const raw = String(value || '').trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

export function getBearerToken(headerValue = '') {
  const auth = String(headerValue || '')
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

export function verifyCronBearerToken(headerValue, cronSecretValue) {
  const cronSecret = normalizeSecret(cronSecretValue)
  if (!cronSecret) {
    return { ok: false, status: 500, payload: { ok: false, error: 'CRON_SECRET is required' } }
  }
  if (getBearerToken(headerValue) !== cronSecret) {
    return { ok: false, status: 401, payload: { ok: false, error: 'Unauthorized cron request' } }
  }
  return { ok: true }
}
