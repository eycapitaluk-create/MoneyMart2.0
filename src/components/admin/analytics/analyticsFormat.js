export function formatAnalyticsDuration(value) {
  const ms = Number(value || 0)
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)} min`
  return `${Math.round(ms / 1000)} sec`
}

export function formatAnalyticsDeltaPct(current, prev) {
  const c = Number(current || 0)
  const p = Number(prev || 0)
  if (c === 0 && p === 0) return null
  if (p === 0) return c > 0 ? '+ (prior 0)' : null
  const pct = ((c - p) / p) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

export function deltaClass(delta) {
  if (!delta) return 'text-gray-400'
  return String(delta).startsWith('-')
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-emerald-600 dark:text-emerald-400'
}

export function fmt(n) {
  return Number(n || 0).toLocaleString('en-US')
}
