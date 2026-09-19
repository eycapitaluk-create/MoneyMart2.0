import { supabase } from './supabase'

export async function fetchStockDailyBrief(symbol) {
  const sym = String(symbol || '').trim()
  if (!sym) {
    throw new Error('symbol is required')
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr) throw sessionErr
  const token = sessionData?.session?.access_token
  if (!token) {
    const err = new Error('ログインが必要です')
    err.code = 'auth_required'
    throw err
  }

  const qs = new URLSearchParams({ symbol: sym })
  const res = await fetch(`/api/stock-daily-brief?${qs.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok || !payload?.ok) {
    const err = new Error(payload?.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return payload.brief
}
