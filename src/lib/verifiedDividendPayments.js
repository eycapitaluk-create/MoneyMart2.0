export function normalizePaymentSymbol(value) {
  const key = String(value || '').trim().toUpperCase()
  return /^(?:\d{4}|\d{3}[A-Z])$/.test(key) ? `${key}.T` : key
}

// Exact issuer payment dates; never synthesize dates from ex-date month patterns.
export function listVerifiedPaymentEvents(pack, { symbols = [], year, query = '' } = {}) {
  const keys = new Set(symbols.map(normalizePaymentSymbol))
  const search = String(query).normalize('NFKC').toLowerCase().trim()
  return (Array.isArray(pack?.records) ? pack.records : []).flatMap(record => {
    if (keys.size && !keys.has(normalizePaymentSymbol(record.symbol))) return []
    if (search && !`${record.symbol} ${record.name}`.normalize('NFKC').toLowerCase().includes(search)) return []
    return (record.events || []).filter(event => (
      /^\d{4}-\d{2}-\d{2}$/.test(String(event.payment_date || '')) &&
      Number(event.amount) > 0 && event.source_url &&
      (year == null || Number(event.payment_date.slice(0, 4)) === Number(year))
    )).map(event => ({ ...event, symbol: record.symbol, name: record.name, currency: event.currency || record.currency }))
  }).sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.symbol.localeCompare(b.symbol))
}
