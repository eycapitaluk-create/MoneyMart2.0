/**
 * Stripe Checkout（月額プレミアム）開始。認証セッションのアクセストークンを付与する。
 */
export async function startPremiumCheckout(accessToken) {
  const token = String(accessToken || '').trim()
  if (!token) {
    throw new Error('ログインが必要です')
  }
  const res = await fetch('/api/billing/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  })
  const rawText = await res.text()
  let data = {}
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    data = {}
  }
  if (!res.ok) {
    const hint = data?.error
      || (res.status === 404
        ? 'API が見つかりません。開発環境では vite.config の /api/billing ミドルウェアと .env の Stripe/Supabase 設定を確認してください。'
        : null)
    throw new Error(hint || rawText?.slice(0, 200) || `決済セッションの開始に失敗しました (${res.status})`)
  }
  const url = data?.url
  if (!url) throw new Error('決済URLを取得できませんでした')
  window.location.href = url
}
