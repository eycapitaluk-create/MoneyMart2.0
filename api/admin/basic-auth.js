import {
  getAdminBasicConfig,
  hasAdminBasicSession,
  parseBasicAuth,
  safeCookieValue,
  verifyAdminIp,
} from '../_lib/admin-security.js'

export default function handler(req, res) {
  const adminConfig = getAdminBasicConfig()
  const nextPathRaw = String(req.query?.next || '/admin')
  const nextPath = nextPathRaw.startsWith('/admin') ? nextPathRaw : '/admin'

  const ipCheck = verifyAdminIp(req)
  if (!ipCheck.ok) {
    res.statusCode = 403
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'Access denied', ip: ipCheck.ip }))
    return
  }

  if (!adminConfig.configured) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      ok: false,
      error: 'ADMIN_BASIC_USER / ADMIN_BASIC_PASS is required',
    }))
    return
  }

  const hasSession = hasAdminBasicSession(req)
  const parsed = parseBasicAuth(req.headers.authorization || '')
  const authenticated = parsed?.user === adminConfig.user && parsed?.pass === adminConfig.pass

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
