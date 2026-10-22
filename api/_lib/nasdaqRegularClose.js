// Independent fallback: an explicitly dated regular close, never last sale
// during an open session or primary after-hours data. Missing OHLC stays NULL.
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const numeric = v => {
  if (v == null || !String(v).trim()) return null
  const n = Number(String(v).replace(/[$,%\s,]/g, ''))
  return Number.isFinite(n) ? n : null
}
export function nasdaqRegularClose(payload, { symbol, expectedDate, expectedPreviousDate, now = new Date() }) {
  const d = payload?.data
  if (!d || d.symbol?.toUpperCase() !== symbol.toUpperCase()) return null
  if (!['Closed', 'After-Hours', 'Pre-Market'].includes(d.marketStatus)) return null
  const [y,m,day] = expectedDate.split('-').map(Number)
  const label = `${months[m-1]} ${day}, ${y}`
  const secondary = d.secondaryData
  const explicit = secondary?.lastTradeTimestamp === `Closed at ${label} 4:00 PM ET` ? secondary : null
  const closed = d.marketStatus === 'Closed' && d.primaryData?.lastTradeTimestamp === label ? d.primaryData : null
  const row = explicit || closed
  const close = numeric(row?.lastSalePrice)
  const nyDate = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
  const nyTime = new Intl.DateTimeFormat('en-GB', {timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now)
  if (!row || !(close > 0) || expectedDate > nyDate || (expectedDate === nyDate && nyTime < '16:30')) return null
  return {
    status: 'ok', trade_date: expectedDate, expected_trade_date: expectedDate,
    expected_previous_date: expectedPreviousDate, previous_trade_date: null,
    previous_close: null, change_pct: null, close,
    open: null, high: null, low: null, volume: null, ohlc_ok: false,
    regular_close_verified: true, provider: 'Nasdaq', price_basis: 'unadjusted_daily_ohlc',
    close_evidence: {kind:'nasdaq_explicit_regular_close', symbol:d.symbol, trade_date:expectedDate,
      timestamp:row.lastTradeTimestamp, market_status:d.marketStatus, price:close,
      source_field:explicit ? 'secondaryData' : 'primaryData', extended_hours_price_used:false,
      verified_at:now.toISOString()},
    note: 'Regular close verified independently; unavailable OHLCV retained as NULL',
  }
}
export async function fetchNasdaqRegularClose(target, { fetchImpl = fetch, now = new Date() } = {}) {
  const assetclass = /^(VWO|IY[A-Z]|SPY|VOO|IVV|QQQ|VT|ACWI)$/.test(target.symbol) ? 'etf' : 'stocks'
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(target.yahoo)}/info?assetclass=${assetclass}`
  const response = await fetchImpl(url, {signal:AbortSignal.timeout(7000), headers:{'user-agent':'Mozilla/5.0','accept':'application/json','origin':'https://www.nasdaq.com'}})
  // No retry or alternate asset class after any source rejection.
  if (!response.ok) return {assessment:null, status:response.status}
  const assessment = nasdaqRegularClose(await response.json(), {symbol:target.yahoo, expectedDate:target.expectedDate, expectedPreviousDate:target.expectedPreviousDate,now})
  if (assessment) assessment.close_evidence.source_url = url
  return {assessment,status:response.status}
}
