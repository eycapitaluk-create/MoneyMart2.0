/** Symbols delisted / merged out of the app universe (no listing, no search). */
const RETIRED_CANONICAL = new Set(['7205.T', '9719.T'])

function toCanonicalJpSymbolKey(input = '') {
  const t = String(input || '').trim().toUpperCase()
  if (!t) return ''
  if (/^\d{4}$/.test(t)) return `${t}.T`
  return t
}

export function isRetiredStockSymbol(input = '') {
  const k = toCanonicalJpSymbolKey(input)
  return Boolean(k && RETIRED_CANONICAL.has(k))
}
