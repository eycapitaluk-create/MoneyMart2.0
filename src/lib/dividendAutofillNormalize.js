/**
 * Autofill-only dividend schedule normalization for US-like symbols.
 *
 * Collapses 6–8 month "quarter-boundary drift" / bi-monthly patterns to one
 * month per quarter and optionally equalizes amounts to the current run-rate.
 *
 * Must NOT be applied to persisted user_dividend_watchlist rows on mere load —
 * that silently drops months and rewrites amounts without user consent.
 */

export function toCanonicalDividendRows(rows) {
  return [...new Map(
    (Array.isArray(rows) ? rows : [])
      .map((d) => ({
        month: Math.min(12, Math.max(1, Number(d?.month) || 1)),
        amount: Math.round(Math.max(0, Number(d?.amount) || 0) * 10000) / 10000,
      }))
      .filter((d) => Number.isFinite(d.month))
      .sort((a, b) => a.month - b.month)
      .map((d) => [d.month, d]),
  ).values()]
}

export function normalizeAutofillDividendRows(rows, detail) {
  const normalized = [...new Map(
    (Array.isArray(rows) ? rows : [])
      .map((d) => ({
        month: Math.min(12, Math.max(1, Number(d?.month) || 1)),
        amount: Math.max(0, Number(d?.amount) || 0),
      }))
      .filter((d) => Number.isFinite(d.month))
      .sort((a, b) => a.month - b.month)
      .map((d) => [d.month, d]),
  ).values()]
  if (normalized.length === 0) return []

  // US quarterly names can drift by month boundary in source history (e.g. 1/2, 4/5, 7/8, 10/11).
  // For auto-fill only, collapse 6-8 month "double-month quarter" patterns to one month per quarter.
  const cat = String(detail?.category || '')
  const isUs = cat.includes('米国') || Boolean(String(detail?.symbol || '').toUpperCase().match(/^[A-Z]+$/))
  if (!isUs || normalized.length < 6 || normalized.length > 8) return normalized

  const byQuarter = [[], [], [], []]
  normalized.forEach((row) => {
    const q = Math.floor((row.month - 1) / 3)
    if (q >= 0 && q <= 3) byQuarter[q].push(row)
  })
  const looksLikeQuarterDrift = byQuarter.every((qRows) => qRows.length >= 1 && qRows.length <= 2)
    && byQuarter.some((qRows) => qRows.length === 2)
  if (!looksLikeQuarterDrift) return normalized

  const quarterlyRows = byQuarter
    .map((qRows) => qRows.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0])
    .filter(Boolean)
    .sort((a, b) => a.month - b.month)
  if (quarterlyRows.length !== 4) return quarterlyRows

  // For quarter-boundary drift patterns, use current run-rate amount across quarters
  // so users don't get stale mixed values like 0.5875/0.675/0.745 in one schedule.
  const runRate = Math.max(...quarterlyRows.map((r) => Number(r.amount || 0)), 0)
  const normalizedRunRate = Math.round(runRate * 10000) / 10000
  return quarterlyRows.map((r) => ({ ...r, amount: normalizedRunRate }))
}

/**
 * Load-path policy: never persist autofill mutations just because the dividend tab opened.
 * Display the stored schedule as-is (callers may still uppercase stock_id in UI state only).
 */
export function planDividendWatchlistLoad(rows) {
  const loadedRows = Array.isArray(rows) ? rows : []
  return {
    displayRows: loadedRows,
    persistRows: [],
  }
}
