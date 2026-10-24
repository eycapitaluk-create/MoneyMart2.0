import { timingSafeEqualString } from '../_lib/admin-basic-auth.js'
import { consumeIpRateLimit, sendRateLimitJson } from '../_lib/rate-limit.js'

function parseBasicAuth(headerValue = '') {
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

function safeCookieValue(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '')
}

export default function handler(req, res) {
  // Also configure Vercel Firewall rate limits on /api/admin*
  const ipLimit = consumeIpRateLimit(req, 'admin-basic-login', {
    limit: Number(process.env.ADMIN_BASIC_IP_RATE_LIMIT || 60),
    windowMs: 15 * 60 * 1000,
  })
  if (!ipLimit.ok) {
    return sendRateLimitJson(res, ipLimit.retryAfterSec, '管理画面への試行が多すぎます。しばらくしてから再度お試しください。')
  }

  const adminUser = String(process.env.ADMIN_BASIC_USER || '').trim()
  const adminPass = String(process.env.ADMIN_BASIC_PASS || '').trim()
  const nextPathRaw = String(req.query?.next || '/admin')
  const nextPath = nextPathRaw.startsWith('/admin') ? nextPathRaw : '/admin'

  if (!adminUser || !adminPass) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      ok: false,
      error: 'ADMIN_BASIC_USER / ADMIN_BASIC_PASS is required',
    }))
    return
  }

  const cookieHeader = String(req.headers.cookie || '')
  const hasSession = cookieHeader.includes('mm_admin_basic=1')
  const parsed = parseBasicAuth(req.headers.authorization || '')
  const authenticated = Boolean(
    parsed
    && timingSafeEqualString(parsed.user, adminUser)
    && timingSafeEqualString(parsed.pass, adminPass),
  )

  if (hasSession || authenticated) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.setHeader(
      'Set-Cookie',
      `mm_admin_basic=${safeCookieValue('1')}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`,
    )
    res.statusCode = 302
    res.setHeader('Location', nextPath)
    res.end('OK')
    return
  }

  res.statusCode = 401
  res.setHeader('WWW-Authenticate', 'Basic realm="MoneyMart Admin", charset="UTF-8"')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('Authentication required.')
}
