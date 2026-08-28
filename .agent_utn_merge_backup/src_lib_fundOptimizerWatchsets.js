/**
 * Fund optimizer watchsets - localStorage persistence
 */
const STORAGE_KEY = 'moneymart.fund_optimizer_watchsets.v1'

export function loadFundOptimizerWatchsets() {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFundOptimizerWatchsets(sets) {
  if (typeof window === 'undefined') return
  const arr = Array.isArray(sets) ? sets : []
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
}

export function normalizeFundOptimizerWatchset(payload) {
  if (!payload || typeof payload !== 'object') return null
  const name = String(payload.name || '').trim()
  if (!name) return null
  const funds = Array.isArray(payload.funds) ? payload.funds : []
  return {
    id: payload.id || `set-${Date.now()}`,
    name,
    createdAt: payload.createdAt || new Date().toISOString(),
    source: payload.source || 'fund_page',
    funds: funds.map((f) => ({
      id: f?.id,
      name: f?.name,
      weightPct: Number(f?.weightPct || 0),
    })),
    summary: payload.summary || null,
  }
}
