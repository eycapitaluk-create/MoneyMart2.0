import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import universe from '../api/_lib/colabTargetUniverse.json' with { type: 'json' }
import { previousSessionDate } from '../api/_lib/exchangeCalendar.js'
import { assessmentFromMarketstackRow } from '../api/_lib/marketstackSupplement.js'
import { assessUnadjustedBar, shouldRetryYahoo } from '../api/_lib/yahooUnadjustedBar.js'
import {
  applyDashboardVerdict,
  approveDashboardUpdate,
  dashboardTargets,
  decidePriceWrite,
  equityTargets,
  jobOutcome,
  yahooSymbolForStorage,
  UNIVERSE_COUNTS,
} from '../api/_lib/yahooPricePlan.js'

const at = (iso) => new Date(iso)

assert.equal(UNIVERSE_COUNTS.us, 579)
assert.equal(UNIVERSE_COUNTS.jp, 217)
assert.equal(UNIVERSE_COUNTS.etf, 337)
assert.equal(new Set(universe.jp_etfs).size, 337)
assert.ok(universe.jp_etfs.includes('491A.T'))
assert.ok(universe.jp_etfs.includes('348A.T'))

const etfSymbols = [0, 1, 2, 3].flatMap((batch) => equityTargets('etf', batch, 4, at('2026-10-10T00:20:00Z')).map((row) => row.symbol))
assert.equal(etfSymbols.length, 337)
assert.ok(etfSymbols.includes('491A.T'))
assert.ok(etfSymbols.includes('348A.T'))
assert.equal(equityTargets('etf', 0, 4, at('2026-10-10T00:20:00Z'))[0].expectedDate, '2026-10-09')
assert.equal(equityTargets('etf', 0, 4, at('2026-10-10T00:20:00Z'))[0].expectedPreviousDate, '2026-10-08')
assert.equal(previousSessionDate('XTKS', '2026-10-13'), '2026-10-09')
assert.notEqual(previousSessionDate('XTKS', '2026-10-13'), '2026-10-12')
assert.equal(shouldRetryYahoo('invalid_price'), true)
assert.equal(shouldRetryYahoo('pending_yahoo'), true)
assert.equal(shouldRetryYahoo('ok'), false)
assert.equal(shouldRetryYahoo('corporate_action_isolated'), false)

const stale = assessUnadjustedBar({
  bars: [
    { date: '2026-10-06', open: 10, high: 11, low: 9, close: 10, volume: 1 },
    { date: '2026-10-08', open: 12, high: 13, low: 11, close: 12, volume: 1 },
  ],
  events: {},
  timeZone: 'Asia/Tokyo',
  expectedDate: '2026-10-08',
  expectedPreviousDate: '2026-10-07',
  requireOhlc: true,
})
assert.equal(stale.status, 'previous_session_mismatch')
assert.equal(stale.change_pct, null)
assert.equal(stale.previous_close, null)
assert.equal(stale.trade_date, null)

const matched = assessUnadjustedBar({
  bars: [
    { date: '2026-10-07', open: 10, high: 11, low: 9, close: 10, volume: 1 },
    { date: '2026-10-08', open: 12, high: 13, low: 11, close: 11, volume: 1 },
  ],
  events: {},
  timeZone: 'Asia/Tokyo',
  expectedDate: '2026-10-08',
  expectedPreviousDate: '2026-10-07',
  requireOhlc: true,
})
assert.equal(matched.status, 'ok')
assert.equal(matched.previous_trade_date, '2026-10-07')
assert.ok(Math.abs(matched.change_pct - 10) < 1e-9)

const approved = {
  status: 'ok',
  trade_date: '2026-10-08',
  price_basis: 'unadjusted_daily_ohlc',
  previous_trade_date: '2026-10-07',
  expected_previous_date: '2026-10-07',
  close: 3811.9041,
}
const snap = { trade_date: '2026-10-08', item: '上海総合', value: 3811.9041, updated_at: '2026-10-08T10:00:00Z' }
const approvedWithPrevious = { ...approved, previous_close: 3800 }
assert.equal(approveDashboardUpdate({ snapshot: snap, current: { ...snap, value: 3811.9041 }, assessment: approvedWithPrevious }).ok, true)
const concurrent = approveDashboardUpdate({
  snapshot: snap,
  current: { ...snap, updated_at: '2026-10-08T11:00:00Z', value: 3811.9041 },
  assessment: approvedWithPrevious,
})
assert.equal(concurrent.ok, false)
assert.equal(concurrent.reason, 'concurrent_change')
assert.equal(jobOutcome([applyDashboardVerdict({ assessment: approvedWithPrevious, decision: { action: 'dashboard_only', reason: 'ok' } }, concurrent)]).status, 'failed')
assert.equal(approveDashboardUpdate({
  snapshot: snap,
  current: snap,
  assessment: { ...approvedWithPrevious, price_basis: 'adjusted' },
}).reason, 'basis_mismatch')
assert.equal(approveDashboardUpdate({
  snapshot: null,
  current: null,
  assessment: { ...approvedWithPrevious, previous_close: 100, close: 10 },
  decision: { action: 'dashboard_only', reason: 'ok' },
}).reason, 'extreme_vs_prev_close')
assert.equal(approveDashboardUpdate({
  snapshot: null,
  current: null,
  assessment: approvedWithPrevious,
  decision: { action: 'hold', reason: 'basis_mismatch' },
}).reason, 'basis_mismatch')
assert.equal(approveDashboardUpdate({
  snapshot: null,
  current: null,
  assessment: approvedWithPrevious,
  decision: { action: 'hold', reason: 'close_mismatch' },
}).reason, 'close_mismatch')
assert.equal(approveDashboardUpdate({
  snapshot: null,
  current: null,
  assessment: approvedWithPrevious,
  decision: { action: 'quarantine', reason: 'extreme_vs_prev_close' },
}).reason, 'quarantine')
assert.equal(approveDashboardUpdate({
  snapshot: null,
  current: null,
  assessment: { ...approvedWithPrevious, status: 'previous_session_mismatch', previous_trade_date: '2026-10-06' },
  decision: { action: 'hold', reason: 'ohlc_unavailable' },
}).reason, 'previous_session_mismatch')
assert.equal(approveDashboardUpdate({
  snapshot: null,
  current: null,
  assessment: { ...approvedWithPrevious, ohlc_ok: false },
  decision: { action: 'hold', reason: 'ohlc_unavailable' },
}).ok, true)

const jpHoliday = equityTargets('jp', 0, 1, at('2026-10-12T07:00:00Z'))
assert.equal(jpHoliday[0].expectedDate, '2026-10-09')
assert.notEqual(jpHoliday[0].expectedDate, '2026-10-12')

const fridayMorningUs = [0, 1, 2, 3, 4, 5].flatMap((batch) => equityTargets('us', batch, 6, at('2026-10-09T00:00:00Z')))
assert.equal(fridayMorningUs.length, 579)
assert.equal(fridayMorningUs[0].expectedDate, '2026-10-08')
assert.equal(yahooSymbolForStorage('BRK.B'), 'BRK-B')
assert.equal(fridayMorningUs.find((row) => row.symbol === 'BRK.B').yahoo, 'BRK-B')
assert.equal(fridayMorningUs.find((row) => row.symbol === 'BRK.B').symbol, 'BRK.B')
assert.equal(yahooSymbolForStorage('BF.B'), 'BF-B')
assert.equal(yahooSymbolForStorage('BF-B'), 'BF-B')

const dashboard = dashboardTargets(at('2026-10-10T00:55:00Z'))
const topix = dashboard.find((row) => row.item === 'TOPIX')
assert.equal(topix.symbol, '1306.T')
assert.equal(topix.yahoo, '1306.T')
assert.equal(topix.expectedDate, '2026-10-09')
assert.equal(dashboard.find((row) => row.item === 'S&P500').expectedDate, '2026-10-09')
assert.equal(dashboard.find((row) => row.item === 'USD/JPY').expectedDate, '2026-10-09')
assert.equal(dashboardTargets(at('2026-10-09T00:00:00Z')).find((row) => row.item === 'USD/JPY').expectedDate, '2026-10-07')
assert.equal(dashboardTargets(at('2026-10-08T20:30:00Z')).find((row) => row.item === 'S&P500').expectedDate, '2026-10-07')
assert.equal(dashboardTargets(at('2027-01-04T00:55:00Z')).find((row) => row.item === '上海総合').expectedDate, null)

const ok = {
  status: 'ok',
  trade_date: '2026-10-08',
  expected_previous_date: '2026-10-07',
  previous_trade_date: '2026-10-07',
  ohlc_ok: true,
  close: 110,
  open: 100,
  high: 112,
  low: 99,
  previous_close: 100,
}
assert.equal(decidePriceWrite({ existing: null, assessment: ok, dbPreviousClose: 100 }).action, 'insert')
assert.equal(decidePriceWrite({ existing: null, assessment: { ...ok, close: 10 }, dbPreviousClose: 100 }).action, 'quarantine')
assert.equal(decidePriceWrite({ existing: null, assessment: { ...ok, previous_close: null }, dbPreviousClose: 100 }).reason, 'missing_previous_close')
const splitGap = decidePriceWrite({
  existing: null,
  assessment: { ...ok, previous_close: 20, close: 22, open: 21, high: 23, low: 20 },
  dbPreviousClose: null,
  dbLatestDate: '2026-10-06',
  dbLatestClose: 100,
})
assert.equal(splitGap.action, 'hold')
assert.equal(splitGap.reason, 'missing_db_previous_session')
assert.notEqual(splitGap.action, 'insert')
assert.equal(decidePriceWrite({
  existing: { open: null, high: null, low: null, close: 22 },
  assessment: { ...ok, previous_close: 20, close: 22, open: 21, high: 23, low: 20 },
  dbPreviousClose: null,
}).reason, 'missing_db_previous_session')
const marketstackBar = assessmentFromMarketstackRow({
  date: '2026-10-08',
  open: 101,
  high: 112,
  low: 99,
  close: 110,
  adj_close: 90,
  volume: 10,
}, '2026-10-08')
marketstackBar.expected_previous_date = '2026-10-07'
assert.equal(marketstackBar.previous_close, null)
const verifiedPrev = {
  trade_date: '2026-10-07',
  close: 100,
  price_basis: 'unadjusted_daily_ohlc',
  provider: 'marketstack',
}
assert.equal(decidePriceWrite({
  existing: null,
  assessment: marketstackBar,
  dbPreviousClose: 100,
  verifiedPrevious: verifiedPrev,
}).action, 'insert')
assert.equal(decidePriceWrite({
  existing: { open: null, high: null, low: null, close: 110 },
  assessment: marketstackBar,
  dbPreviousClose: 100,
  verifiedPrevious: verifiedPrev,
}).action, 'fill_ohlc')
assert.equal(decidePriceWrite({
  existing: null,
  assessment: { ...marketstackBar, close: 10, open: 10, high: 12, low: 9 },
  dbPreviousClose: 100,
  verifiedPrevious: verifiedPrev,
}).action, 'quarantine')
assert.equal(decidePriceWrite({
  existing: null,
  assessment: marketstackBar,
  dbPreviousClose: 100,
  verifiedPrevious: { trade_date: '2026-10-06', close: 100, price_basis: 'unadjusted_daily_ohlc', provider: 'marketstack' },
}).reason, 'missing_previous_close')
assert.equal(decidePriceWrite({
  existing: null,
  assessment: marketstackBar,
  dbPreviousClose: 100,
  verifiedPrevious: { trade_date: '2026-10-07', close: 100, provider: 'marketstack' },
}).reason, 'missing_previous_close')
assert.equal(decidePriceWrite({ existing: null, assessment: ok, dbPreviousClose: 50 }).reason, 'basis_mismatch')
assert.equal(decidePriceWrite({
  existing: { open: 1, high: 2, low: 1, close: 100 },
  assessment: ok,
  dbPreviousClose: 100,
}).action, 'keep')

const outcome = jobOutcome([
  { assessment: { status: 'ok' }, decision: { action: 'keep' } },
  { held: true, assessment: { status: 'held' }, decision: { action: 'hold' } },
])
assert.equal(outcome.status, 'failed')
assert.equal(outcome.completeness, 'partial')
assert.notEqual(outcome.status, 'partial')
assert.deepEqual(jobOutcome([{ assessment: { status: 'ok', trade_date: '2026-10-08' }, decision: { action: 'insert' } }]), {
  status: 'success',
  completeness: 'complete',
})

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)))
const priceCrons = vercel.crons.filter((cron) => cron.path.includes('yahoo-unadjusted-daily'))
assert.equal(priceCrons.length, vercel.crons.length)
for (const cron of priceCrons) {
  const [minute, hour] = cron.schedule.split(' ')
  assert.equal(hour, '0')
  assert.ok(Number(minute) >= 15)
  assert.ok(!/marketstack|news|fx-usdjpy|commodit|community/.test(cron.path))
}

console.log('price route guard checks passed')
