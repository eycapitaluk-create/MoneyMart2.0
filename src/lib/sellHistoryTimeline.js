/**
 * Merge stock + fund realized sell rows for MyPage 「売却履歴」.
 * Pure helpers — safe for memoization.
 */

export function parseSellDateKey(sellDate = '') {
  const s = String(sellDate || '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

export function sellDateSortMs(sellDate = '') {
  const key = parseSellDateKey(sellDate)
  if (!key) return 0
  const t = Date.parse(`${key}T12:00:00`)
  return Number.isFinite(t) ? t : 0
}

export function extractYearsFromSellDates(rows = []) {
  const years = new Set()
  for (const row of rows) {
    const key = parseSellDateKey(row?.sellDate)
    const y = Number(key.slice(0, 4))
    if (Number.isFinite(y) && y >= 1970 && y <= 2100) years.add(y)
  }
  return [...years].sort((a, b) => b - a)
}

/**
 * @param {{ stockTrades?: object[], fundTrades?: object[] }} param0
 * @returns {Array<object & { kind: 'stock'|'fund' }>}
 */
export function buildSellHistoryTimeline({ stockTrades = [], fundTrades = [] }) {
  const out = []
  const stocks = Array.isArray(stockTrades) ? stockTrades : []
  const funds = Array.isArray(fundTrades) ? fundTrades : []
  for (const t of stocks) {
    if (!t || !String(t.symbol || '').trim()) continue
    out.push({ kind: 'stock', ...t })
  }
  for (const t of funds) {
    if (!t || !String(t.symbol || '').trim()) continue
    out.push({ kind: 'fund', ...t })
  }
  out.sort((a, b) => {
    const dt = sellDateSortMs(b.sellDate) - sellDateSortMs(a.sellDate)
    if (dt !== 0) return dt
    return String(b.tradeId || '').localeCompare(String(a.tradeId || ''))
  })
  return out
}
