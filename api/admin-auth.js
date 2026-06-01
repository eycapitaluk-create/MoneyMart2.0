import { getAdminBasicConfig, parseBasicAuth, verifyAdminIp } from './_lib/admin-security.js'

export default function handler(req, res) {
  const ipCheck = verifyAdminIp(req)
  if (!ipCheck.ok) {
    return res.status(403).json({ ok: false, error: 'Access denied', ip: ipCheck.ip })
  }

  const adminConfig = getAdminBasicConfig()
  if (!adminConfig.configured) {
    return res.status(500).json({ ok: false, error: 'ADMIN_BASIC_USER / ADMIN_BASIC_PASS is required' })
  }

  const parsed = parseBasicAuth(req.headers.authorization || '')
  if (parsed?.user === adminConfig.user && parsed?.pass === adminConfig.pass) {
    return res.status(200).json({ ok: true })
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="MoneyMart Admin"')
  return res.status(401).json({ ok: false, error: 'Unauthorized' })
}
