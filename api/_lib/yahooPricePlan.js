import universe from './colabTargetUniverse.json' with { type: 'json' }
import { expectedPriceDate, previousSessionDate } from './exchangeCalendar.js'
import { isExtremeCloseMove } from './price-ingest-guard.js'
import { PRICE_BASIS, sameBasisClose } from './yahooUnadjustedBar.js'

export const STORAGE_SOURCE = 'marketstack'
export const PROVIDER = 'yahoo'

const HELD_ITEMS = new Set(['VXTLT', 'Gold', 'Silver', 'WTI', 'Brent', 'Risk-On/Off Score'])

export const DASHBOARD_SPECS = [
  { item: '日経225', yahoo: '^N225', symbol: '^N225', calendar: 'XTKS', category: 'index' },
  { item: 'TOPIX', yahoo: '1306.T', symbol: '1306.T', calendar: 'XTKS', category: 'index' },
  { item: 'S&P500', yahoo: '^GSPC', symbol: '^GSPC', calendar: 'XNYS', category: 'index' },
  { item: 'NASDAQ', yahoo: '^IXIC', symbol: '^IXIC', calendar: 'XNYS', category: 'index' },
  { item: 'Dow', yahoo: '^DJI', symbol: '^DJI', calendar: 'XNYS', category: 'index' },
  { item: 'Hang Seng', yahoo: '^HSI', symbol: '^HSI', calendar: 'XHKG', category: 'index' },
  { item: '上海総合', yahoo: '000001.SS', symbol: '^SSEC', calendar: 'XSHG', category: 'index' },
  { item: 'DAX', yahoo: '^GDAXI', symbol: '^GDAXI', calendar: 'XETR', category: 'index' },
  { item: 'US10Y', yahoo: '^TNX', symbol: '^TNX', calendar: 'XNYS', category: 'rates' },
  { item: 'VIX', yahoo: '^VIX', symbol: '^VIX', calendar: 'XNYS', category: 'vol' },
  { item: 'MOVE', yahoo: '^MOVE', symbol: '^MOVE', calendar: 'XNYS', category: 'vol' },
  { item: 'USD/JPY', yahoo: 'JPY=X', symbol: null, calendar: 'FX_UTC', category: 'fx', dashboardOnly: true },
  { item: 'EUR/JPY', yahoo: 'EURJPY=X', symbol: null, calendar: 'FX_UTC', category: 'fx', dashboardOnly: true },
  { item: 'GBP/JPY', yahoo: 'GBPJPY=X', symbol: null, calendar: 'FX_UTC', category: 'fx', dashboardOnly: true },
  { item: 'AUD/JPY', yahoo: 'AUDJPY=X', symbol: null, calendar: 'FX_UTC', category: 'fx', dashboardOnly: true },
  { item: 'CNY/JPY', yahoo: 'CNYJPY=X', symbol: null, calendar: 'FX_UTC', category: 'fx', dashboardOnly: true },
]

export function completedFxDate(now = new Date()) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  day.setUTCDate(day.getUTCDate() - 1)
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

export function yahooSymbolForStorage(symbol) {
  if (symbol === 'BRK.B' || symbol === 'BRK/B') return 'BRK-B'
  if (symbol === 'BF.B' || symbol === 'BF/B') return 'BF-B'
  return symbol
}

function sessionPair(calendar, now, indexBuffer) {
  const expectedDate = expectedPriceDate(calendar, now, { indexBuffer }).date
  return {
    expectedDate,
    expectedPreviousDate: previousSessionDate(calendar, expectedDate),
  }
}

export function scopeSymbols(scope) {
  if (scope === 'us') return universe.us_equities
  if (scope === 'jp') return universe.jp_equities
  if (scope === 'etf') return universe.jp_etfs
  return []
}

export function sliceBatch(symbols, batch, batches) {
  const size = Math.ceil(symbols.length / batches)
  const start = batch * size
  return symbols.slice(start, start + size)
}

export function equityTargets(scope, batch, batches, now = new Date()) {
  const calendar = scope === 'us' ? 'XNYS' : 'XTKS'
  const { expectedDate, expectedPreviousDate } = sessionPair(calendar, now, false)
  return sliceBatch(scopeSymbols(scope), batch, batches).map((symbol) => ({
    item: symbol,
    yahoo: yahooSymbolForStorage(symbol),
    symbol,
    calendar,
    category: 'equity',
    requireOhlc: true,
    expectedDate,
    expectedPreviousDate,
    dashboardOnly: false,
    held: false,
  }))
}

export function marketstackAllowed({ catchup = false, needed = 0, hold = null } = {}) {
  if (catchup) return false
  return needed > 0 && !hold
}

/** Same confirmed session, plus only the immediately previous session when that row is absent. */
export function selectCatchupTargets(targets, presentKeys, previousOf) {
  const present = presentKeys instanceof Set ? presentKeys : new Set(presentKeys || [])
  const selected = []
  for (const target of targets || []) {
    const id = target?.symbol || target?.item
    const expected = target?.expectedDate
    if (!id || !expected) continue
    if (!present.has(`${id}|${expected}`)) selected.push(target)
    const previous = target?.expectedPreviousDate
    if (!previous || present.has(`${id}|${previous}`)) continue
    selected.push({
      ...target,
      expectedDate: previous,
      expectedPreviousDate: typeof previousOf === 'function' ? previousOf(target.calendar, previous) : null,
    })
  }
  return selected
}

export function dashboardTargets(now = new Date()) {
  return DASHBOARD_SPECS.map((spec) => ({
    ...spec,
    requireOhlc: false,
    ...sessionPair(spec.calendar, now, spec.calendar === 'XNYS'),
    held: HELD_ITEMS.has(spec.item),
  }))
}

const HOLD_STATUSES = new Set([
  'pending_yahoo',
  'invalid_price',
  'corporate_action_isolated',
  'held',
  'marketstack_unsupported',
  'calendar_hold',
  'missing_previous',
  'previous_session_mismatch',
])

function verifiedSameSessionClose(assessment, dbPreviousClose, verifiedPrevious) {
  if (!verifiedPrevious || verifiedPrevious.trade_date !== assessment.expected_previous_date) return false
  if (verifiedPrevious.price_basis !== PRICE_BASIS) return false
  return sameBasisClose(dbPreviousClose, verifiedPrevious.close)
}

export function decidePriceWrite({ existing, assessment, dbPreviousClose, verifiedPrevious = null }) {
  if (!assessment?.trade_date || HOLD_STATUSES.has(assessment.status)) {
    return { action: 'hold', reason: assessment?.status || 'pending_yahoo' }
  }
  if (!assessment.ohlc_ok) return { action: 'hold', reason: 'ohlc_unavailable' }
  const hasRange = existing && [existing.open, existing.high, existing.low].some((value) => value != null)
  if (hasRange) return { action: 'keep', reason: 'existing_ohlc' }
  if (assessment.previous_trade_date && assessment.expected_previous_date && assessment.previous_trade_date !== assessment.expected_previous_date) {
    return { action: 'hold', reason: 'previous_session_mismatch' }
  }
  if (!(Number(dbPreviousClose) > 0)) {
    return { action: 'hold', reason: 'missing_db_previous_session' }
  }
  const providerVerified = verifiedSameSessionClose(assessment, dbPreviousClose, verifiedPrevious)
  if (assessment.previous_close == null) {
    if (!providerVerified) return { action: 'hold', reason: 'missing_previous_close' }
  } else if (!sameBasisClose(dbPreviousClose, assessment.previous_close)) {
    return { action: 'hold', reason: 'basis_mismatch' }
  }
  if (existing && existing.close != null && !sameBasisClose(existing.close, assessment.close)) {
    return { action: 'hold', reason: 'close_mismatch' }
  }
  if (isExtremeCloseMove(dbPreviousClose, assessment.close)) return { action: 'quarantine', reason: 'extreme_vs_prev_close' }
  if (existing) return { action: 'fill_ohlc', reason: 'close_only_existing' }
  return { action: 'insert', reason: 'missing_bar' }
}

export function approveDashboardUpdate({ snapshot, current, assessment, decision, replaceClose = false }) {
  if (decision?.action === 'quarantine') return { ok: false, reason: 'quarantine' }
  if (decision?.action === 'hold' && decision.reason !== 'ohlc_unavailable') {
    return { ok: false, reason: decision.reason || 'hold' }
  }
  if (!assessment || assessment.price_basis !== PRICE_BASIS) return { ok: false, reason: 'basis_mismatch' }
  if (assessment.status === 'previous_session_mismatch' || !assessment.expected_previous_date || assessment.previous_trade_date !== assessment.expected_previous_date) {
    return { ok: false, reason: 'previous_session_mismatch' }
  }
  if (assessment.status !== 'ok' || !assessment.trade_date) return { ok: false, reason: assessment?.status || 'pending_yahoo' }
  if (!(Number(assessment.previous_close) > 0)) return { ok: false, reason: 'missing_previous_close' }
  if (isExtremeCloseMove(assessment.previous_close, assessment.close)) return { ok: false, reason: 'extreme_vs_prev_close' }
  if (current) {
    if (!snapshot) return { ok: false, reason: 'concurrent_change' }
    if (String(current.updated_at || '') !== String(snapshot.updated_at || '')) return { ok: false, reason: 'concurrent_change' }
    if (Number(current.value) !== Number(snapshot.value)) return { ok: false, reason: 'concurrent_change' }
    if (!replaceClose && current.value != null && !sameBasisClose(current.value, assessment.close)) return { ok: false, reason: 'close_mismatch' }
  }
  return { ok: true, reason: 'ok' }
}

export function applyDashboardVerdict(row, verdict) {
  if (verdict?.ok) return row
  return { ...row, decision: { action: 'hold', reason: verdict?.reason || 'hold' } }
}

export function dashboardRowAllowed(row) {
  if (row?.held || row?.assessment?.status !== 'ok' || !row?.assessment?.trade_date) return false
  if (row.decision?.action === 'hold' || row.decision?.action === 'quarantine') return false
  if (isExtremeCloseMove(row.assessment.previous_close, row.assessment.close)) return false
  return true
}

/** ingestion_jobs_status_check allows only started, success, and failed. */
export function jobOutcome(rows) {
  const problems = []
  for (const row of rows || []) {
    if (row.held || row.assessment?.status === 'held') {
      problems.push(row)
      continue
    }
    const action = row.decision?.action
    if (action === 'insert' || action === 'fill_ohlc' || action === 'keep') continue
    if (action === 'dashboard_only' && row.assessment?.status === 'ok' && row.assessment?.trade_date) continue
    problems.push(row)
  }
  if (!problems.length) return { status: 'success', completeness: 'complete' }
  return { status: 'failed', completeness: 'partial' }
}

export const UNIVERSE_COUNTS = {
  us: universe.us_equities.length,
  jp: universe.jp_equities.length,
  etf: universe.jp_etfs.length,
}
