export function parseBasicAuth(headerValue = '') {
  const raw = String(headerValue || '')
  if (!raw.startsWith('Basic ')) return null
  const encoded = raw.slice(6).trim()
  if (!encoded) return null

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    const idx = decoded.indexOf(':')
    if (idx < 0) return null
    return {
      user: decoded.slice(0, idx),
      pass: decoded.slice(idx + 1),
    }
  } catch {
    return null
  }
}

export function getAdminBasicConfig(env = process.env) {
  const user = String(env.ADMIN_BASIC_USER || '').trim()
  const pass = String(env.ADMIN_BASIC_PASS || '').trim()
  return { user, pass, configured: Boolean(user && pass) }
}

export function safeCookieValue(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '')
}

export function hasCookieValue(cookieHeader = '', name, expectedValue) {
  const expectedName = String(name || '')
  const expected = String(expectedValue || '')
  return String(cookieHeader || '')
    .split(';')
    .some((part) => {
      const idx = part.indexOf('=')
      if (idx < 0) return false
      const key = part.slice(0, idx).trim()
      const value = part.slice(idx + 1).trim()
      return key === expectedName && value === expected
    })
}

export function hasAdminBasicSession(req) {
  return hasCookieValue(req?.headers?.cookie || '', 'mm_admin_basic', '1')
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

export function getClientIp(req) {
  const forwarded = firstHeaderValue(req?.headers?.['x-forwarded-for'])
  const realIp = firstHeaderValue(req?.headers?.['x-real-ip'])
  return String(forwarded ? forwarded.split(',')[0] : realIp || '').trim()
}

export function getAllowedAdminIps(env = process.env) {
  return String(env.ALLOWED_ADMIN_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
}

export function verifyAdminIp(req, env = process.env) {
  const ip = getClientIp(req)
  const allowedIps = getAllowedAdminIps(env)
  if (allowedIps.length === 0) return { ok: true, ip, mode: 'open' }
  if (allowedIps.includes(ip)) return { ok: true, ip, mode: 'restricted' }
  return { ok: false, ip, mode: 'restricted' }
}
