const SETTLEMENT_NAMES = new Set(['gold', 'silver', 'crude_oil', 'brent_crude'])
const PROTECTED_DASHBOARD_ITEMS = new Set(['Gold', 'Silver', 'WTI', 'Brent', 'Risk-On/Off', 'Risk-On/Off Score'])

// Spreadsheet quotes do not identify a futures contract or a final settlement.
// The verified settlement job owns these values; the score has a separate formula.
export function omitUnverifiedSpreadsheetCommodities(recentRows = []) {
  return recentRows.filter((row) => !PROTECTED_DASHBOARD_ITEMS.has(row.item))
}

export function latestUsableCommodityRows(rows = []) {
  const latest = new Map()
  for (const row of [...rows].sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))) {
    const name = String(row.commodity_name || '')
    if (!name || latest.has(name) || row.percentage_day == null || !Number.isFinite(Number(row.percentage_day))) continue
    if (SETTLEMENT_NAMES.has(name) && row.raw?.validation_status !== 'verified') continue
    latest.set(name, row)
  }
  return latest
}
