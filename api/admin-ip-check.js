import { verifyAdminIp } from './_lib/admin-security.js'

export default function handler(req, res) {
  const ipCheck = verifyAdminIp(req)

  if (!ipCheck.ok) {
    return res.status(403).json({ ok: false, error: 'Access denied', ip: ipCheck.ip })
  }

  return res.status(200).json({ ok: true, ip: ipCheck.ip, mode: ipCheck.mode })
}
