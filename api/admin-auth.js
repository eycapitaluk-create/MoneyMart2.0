/**
 * Admin Basic Auth check — 管理画面アクセス制御
 * ADMIN_BASIC_USER / ADMIN_BASIC_PASS
 * Also configure Vercel Firewall rate limits on /api/admin*
 */
import { timingSafeEqualString } from './_lib/admin-basic-auth.js'
import { consumeIpRateLimit, sendRateLimitJson } from './_lib/rate-limit.js'

export default function handler(req, res) {
  const ipLimit = consumeIpRateLimit(req, 'admin-auth', {
    limit: Number(process.env.ADMIN_BASIC_IP_RATE_LIMIT || 60),
    windowMs: 15 * 60 * 1000,
  })
  if (!ipLimit.ok) {
    return sendRateLimitJson(res, ipLimit.retryAfterSec, '管理画面への試行が多すぎます。しばらくしてから再度お試しください。')
  }

  const expectedUser = String(process.env.ADMIN_BASIC_USER || '').trim()
  const expectedPass = String(process.env.ADMIN_BASIC_PASS || '').trim()
  const authHeader = req.headers.authorization || ''

  if (authHeader.startsWith('Basic ') && expectedUser && expectedPass) {
    let decoded = ''
    try {
      decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
    } catch {
      decoded = ''
    }
    const idx = decoded.indexOf(':')
    const user = idx >= 0 ? decoded.slice(0, idx) : decoded
    const pass = idx >= 0 ? decoded.slice(idx + 1) : ''

    if (timingSafeEqualString(user, expectedUser) && timingSafeEqualString(pass, expectedPass)) {
      return res.status(200).json({ ok: true })
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="MoneyMart Admin"')
  return res.status(401).json({ ok: false, error: 'Unauthorized' })
}
