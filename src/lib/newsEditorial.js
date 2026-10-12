const timestamp = (value) => Date.parse(value || '') || 0
const publishedAt = (row) => row?.publishedAt || row?.published_at || ''
const updatedAt = (row) => row?.updatedAt || row?.updated_at || publishedAt(row)
const batchKey = (row) => String(row?.batchKey || row?.batch_key || '').trim()
const tokyoDay = (value) => {
  const time = timestamp(value)
  return time ? new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) : ''
}

/** Newer editorial editions first; preserve the editor's priority within each edition. */
export function sortNewsEditorial(rows) {
  const groups = new Map()
  const groupKey = (row) => batchKey(row) || `legacy:${tokyoDay(publishedAt(row))}`
  for (const row of rows || []) {
    const key = groupKey(row)
    const day = batchKey(row).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || tokyoDay(publishedAt(row))
    const group = groups.get(key) || { day, updated: 0 }
    group.updated = Math.max(group.updated, timestamp(updatedAt(row)))
    groups.set(key, group)
  }
  const priority = (row) => {
    const value = row?.sortOrder ?? row?.sort_order
    return value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0
      ? Number(value)
      : Number.POSITIVE_INFINITY
  }
  return [...(rows || [])].sort((a, b) => {
    const ka = groupKey(a)
    const kb = groupKey(b)
    const ga = groups.get(ka)
    const gb = groups.get(kb)
    if (ga.day !== gb.day) return gb.day.localeCompare(ga.day)
    if (ka !== kb && ga.updated !== gb.updated) return gb.updated - ga.updated
    // Keep editions contiguous even when their publication timestamps are identical.
    if (ka !== kb) return kb.localeCompare(ka)
    const pa = priority(a)
    const pb = priority(b)
    if (pa !== pb) return pa - pb
    return timestamp(publishedAt(b)) - timestamp(publishedAt(a))
  })
}

/** Geographic label, not an inferred stock exchange or equity asset class. */
export function newsRegionLabel(item) {
  const region = String(item?.marketRegion ?? item?.market ?? '').toLowerCase()
  if (['jp', 'ja', 'japan', 'jpx', 'tokyo'].includes(region)) return '🇯🇵 日本'
  if (['us', 'usa', 'america', 'nyse', 'nasdaq'].includes(region)) return '🇺🇸 米国'
  if (['eu', 'europe', 'uk', 'london', 'xetra', 'de'].includes(region)) return '🇪🇺 欧州'
  return '🌐 グローバル'
}

const NON_STOCK_TOPICS = new Set([
  'DJI', 'DJIA', 'SPX', 'GSPC', 'NDX', 'IXIC', 'NIKKEI', 'TOPIX',
  'GOLD', 'SILVER', 'WTI', 'OIL', 'BRENT', 'USDJPY', 'EURUSD', 'EURJPY',
  'US10Y', 'UK30Y', 'USINFL', 'USHOUSE', 'USCREDIT', 'JPFISCAL',
  'SHIPPING', 'ECB', 'FOMC', 'BOJ', 'EUROPE', 'GLOBAL', 'ANTHROPIC', 'MISTRAL',
])

export function hasNewsStockDetail(item) {
  const ticker = String(item?.ticker || '').trim().toUpperCase()
  return Boolean(ticker) && !ticker.startsWith('^') && !NON_STOCK_TOPICS.has(ticker)
}
