/**
 * Admin IP allowlist — Stripe 일본 보안 요건 대응
 * Vercel 환경변수 ALLOWED_ADMIN_IPS 에 허용할 IP를 콤마로 설정
 * 예: ALLOWED_ADMIN_IPS=1.2.3.4,5.6.7.8
 */
export default function handler(req, res) {
  const forwarded = req.headers['x-forwarded-for']
  const realIp = req.headers['x-real-ip']
  const clientIp = (forwarded ? forwarded.split(',')[0] : realIp || '').trim()

  const allowedIps = (process.env.ALLOWED_ADMIN_IPS || '')
    .split(',').map((ip) => ip.trim()).filter(Boolean)

  // 환경변수 미설정 시 → 모든 접근 허용 (개발 환경)
  if (allowedIps.length === 0) {
    return res.status(200).json({ ok: true, ip: clientIp, mode: 'open' })
  }

  if (!allowedIps.includes(clientIp)) {
    return res.status(403).json({ ok: false, error: 'Access denied', ip: clientIp })
  }

  return res.status(200).json({ ok: true, ip: clientIp, mode: 'restricted' })
}
