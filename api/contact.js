/**
 * FAQ お問い合わせフォーム → justin.nam@moneymart.co.jp にメール送信
 * POST /api/contact
 * Body: { email, message }
 * 必要: RESEND_API_KEY, RESEND_FROM (認証済みドメイン)
 */
const RECIPIENT = 'justin.nam@moneymart.co.jp'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.end(JSON.stringify(payload))
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  let body = {}
  try {
    const raw = await new Promise((resolve, reject) => {
      let data = ''
      req.on('data', (chunk) => { data += chunk })
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })
    body = raw ? JSON.parse(raw) : {}
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON body' })
  }

  const email = String(body.email || '').trim()
  const message = String(body.message || '').trim()

  if (!email || !message) {
    return sendJson(res, 400, { ok: false, error: 'email と message は必須です' })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJson(res, 400, { ok: false, error: '有効なメールアドレスを入力してください' })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return sendJson(res, 500, { ok: false, error: 'RESEND_API_KEY を設定してください' })
  }

  const safeEmailDisplay = escapeHtml(email)
  const safeMessageHtml = escapeHtml(message).replace(/\r\n/g, '\n').replace(/\n/g, '<br>')

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'MoneyMart <onboarding@resend.dev>',
        to: [RECIPIENT],
        reply_to: email,
        subject: `[MoneyMart お問い合わせ] ${email}`,
        html: `<p>${safeMessageHtml}</p><p><strong>送信者:</strong> ${safeEmailDisplay}</p>`,
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      console.error('Resend error:', resendRes.status, errBody)
      return sendJson(res, 500, { ok: false, error: '送信に失敗しました。しばらくしてからお試しください。' })
    }
  } catch (err) {
    console.error('contact error:', err?.message || err)
    return sendJson(res, 500, { ok: false, error: '送信に失敗しました。しばらくしてからお試しください。' })
  }

  return sendJson(res, 200, { ok: true, message: '送信しました。24時間以内にご返信いたします。' })
}
