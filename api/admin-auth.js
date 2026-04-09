/**
 * Admin Basic Auth check — Stripe 일본 보안 요건 대응
 * ADMIN_BASIC_USER / ADMIN_BASIC_PASS 환경변수로 인증
 */
export default function handler(req, res) {
  const authHeader = req.headers['authorization'] || ''

  if (authHeader.startsWith('Basic ')) {
    const base64 = authHeader.slice(6)
    const decoded = Buffer.from(base64, 'base64').toString('utf-8')
    const [user, pass] = decoded.split(':')

    if (
      user === process.env.ADMIN_BASIC_USER &&
      pass === process.env.ADMIN_BASIC_PASS
    ) {
      return res.status(200).json({ ok: true })
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="MoneyMart Admin"')
  return res.status(401).json({ ok: false, error: 'Unauthorized' })
}
