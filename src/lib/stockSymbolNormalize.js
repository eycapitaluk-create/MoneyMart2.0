/**
 * Canonical DB / app ticker normalization.
 * Yahoo Finance renamed BK → BNY (Bank of New York Mellon, 2026).
 * Imports and legacy URLs may still send BK.
 */
export const LEGACY_STOCK_SYMBOL_ALIASES = Object.freeze({
  BK: 'BNY',
})

/** @param {string} raw */
export function normalizeStockSymbolForDb(raw = '') {
  const u = String(raw ?? '').trim().toUpperCase()
  if (!u) return ''
  if (u === 'BRK/B' || u === 'BRK-B') return 'BRK.B'
  if (u === 'BF/B' || u === 'BF-B' || u === 'BF.B') return 'BF-B'
  const aliased = LEGACY_STOCK_SYMBOL_ALIASES[u]
  if (aliased) return aliased
  if (u.includes('/')) return u.replace(/\//g, '-')
  return u
}

/** @param {string} raw */
export function isLegacyStockSymbolAlias(raw = '') {
  const u = String(raw ?? '').trim().toUpperCase()
  return Boolean(u && LEGACY_STOCK_SYMBOL_ALIASES[u])
}

/** ?symbol= / search keys: canonical + known legacy aliases for the same issuer */
export function canonicalStockSymbolKeys(raw = '') {
  const canon = normalizeStockSymbolForDb(raw)
  if (!canon) return []
  const keys = [canon]
  for (const [legacy, target] of Object.entries(LEGACY_STOCK_SYMBOL_ALIASES)) {
    if (target === canon) keys.push(legacy)
  }
  return [...new Set(keys)]
}
