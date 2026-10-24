import crypto from 'node:crypto'
import { consumeIpRateLimit } from './rate-limit.js'

/** Prefer also configuring Vercel Firewall rate limits on /api/admin* */

function timingSafeEqualString(a, b) {
  const aBuf = Buffer.from(String(a ?? ''), 'utf8')
  const bBuf = Buffer.from(String(b ?? ''), 'utf8')
  const len = Math.max(aBuf.length, bBuf.length, 1)
  const aPad = Buffer.alloc(len)
  const bPad = Buffer.alloc(len)
  aBuf.copy(aPad)
  bBuf.copy(bPad)
  const same = crypto.timingSafeEqual(aPad, bPad)
  return same && aBuf.length === bBuf.length
}

/** Same HTTP Basic check as /api/admin-crm-insights and AdminIpGuard. */
export function assertAdminBasic(req) {
  const expectedUser = String(process.env.ADMIN_BASIC_USER || '').trim()
  const expectedPass = String(process.env.ADMIN_BASIC_PASS || '').trim()
  if (!expectedUser || !expectedPass) return false

  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || ''
  if (!String(authHeader).startsWith('Basic ')) return false
  let decoded = ''
  try {
    decoded = Buffer.from(String(authHeader).slice(6), 'base64').toString('utf8')
  } catch {
    return false
  }
  const idx = decoded.indexOf(':')
  const user = idx >= 0 ? decoded.slice(0, idx) : decoded
  const pass = idx >= 0 ? decoded.slice(idx + 1) : ''
  return timingSafeEqualString(user, expectedUser) && timingSafeEqualString(pass, expectedPass)
}

export function adminAuthFailure(req) {
  const ipLimit = consumeIpRateLimit(req, 'admin-basic', {
    limit: Number(process.env.ADMIN_BASIC_IP_RATE_LIMIT || 60),
    windowMs: 15 * 60 * 1000,
  })
  if (!ipLimit.ok) return 429

  if (assertAdminBasic(req)) return null
  const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || '')
  if (/^Bearer\s+\S+/i.test(authHeader)) return 403
  return 401
}

export { timingSafeEqualString }
