/**
 * GET /api/billing/payjp/public-config
 * PAY.JP 公開鍵（pk_）のみ返す。Vite ビルド時未埋め込みでも Vercel env から読める。
 */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.end(JSON.stringify(payload))
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  const publicKey = String(
    process.env.VITE_PAYJP_PUBLIC_KEY
    || process.env.PAYJP_PUBLIC_KEY
    || '',
  ).trim()
  if (publicKey.startsWith('sk_')) {
    return sendJson(res, 503, {
      ok: false,
      error: 'PAYJP_PUBLIC_KEY must be pk_ (public), not sk_ (secret). Fix Vercel env.',
      publicKey: null,
    })
  }
  if (req.method === 'HEAD') {
    res.statusCode = publicKey ? 200 : 503
    res.end()
    return
  }
  const extendedBrandsLiveAt = String(
    process.env.PAYJP_EXTENDED_BRANDS_LIVE_AT || '2026-06-17T12:00:00+09:00',
  ).trim()
  const extendedBrandsLiveAtMs = new Date(extendedBrandsLiveAt).getTime()
  const extendedBrandsLive = Number.isFinite(extendedBrandsLiveAtMs)
    && Date.now() >= extendedBrandsLiveAtMs

  return sendJson(res, publicKey ? 200 : 503, {
    ok: Boolean(publicKey),
    publicKey: publicKey || null,
    supportedCardBrands: ['visa', 'mastercard', 'jcb', 'amex', 'diners', 'discover'],
    extendedBrandsLiveAt,
    extendedBrandsLive,
    applePayEnabled: false,
  })
}
