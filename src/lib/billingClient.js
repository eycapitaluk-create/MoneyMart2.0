/**
 * PAY.JP ウェブ Premium サブスク開始
 */
export async function createPayjpPremiumSubscription({
  accessToken,
  billingCycle,
  payjpToken,
}) {
  const token = String(accessToken || '').trim()
  if (!token) throw new Error('ログインが必要です')

  const res = await fetch('/api/billing/payjp/create-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      billing_cycle: billingCycle,
      payjp_token: payjpToken,
    }),
  })

  const rawText = await res.text()
  let data = {}
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    data = {}
  }

  if (!res.ok) {
    throw new Error(
      data?.error
      || rawText?.slice(0, 200)
      || `決済の開始に失敗しました (${res.status})`,
    )
  }
  return data
}

export async function cancelPayjpPremiumSubscription(accessToken) {
  const token = String(accessToken || '').trim()
  if (!token) throw new Error('ログインが必要です')

  const res = await fetch('/api/billing/payjp/cancel-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || `解約に失敗しました (${res.status})`)
  }
  return data
}
