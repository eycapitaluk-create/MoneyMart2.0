import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  commitFxPair,
  dbFxSeriesResponse,
  fxChangePct,
  fxConcurrentChange,
  frankfurterRowsSkippingYahoo,
  importerFxWrites,
  planFxPublication,
  planUsdJpyWrites,
  previousFxAlign,
  readFxDaily,
} from '../api/_lib/fxYahooSync.js'

const storedPct = -0.14909
const fromCloses = fxChangePct(158.0599976, 157.99)
assert.ok(Math.abs(fromCloses - 0.044305) < 1e-4)
assert.notEqual(Number(fromCloses.toFixed(5)), storedPct)
assert.equal(fxChangePct(null, 157.99), null)
assert.equal(fxChangePct(158, 0), null)

const assessment = {
  status: 'ok',
  trade_date: '2026-10-08',
  expected_trade_date: '2026-10-08',
  expected_previous_date: '2026-10-07',
  previous_trade_date: '2026-10-07',
  previous_close: 157.99,
  close: 158.0599976,
}
const plan = planFxPublication({ assessment })
assert.equal(plan.action, 'publish')
assert.equal(plan.tradeDate, '2026-10-08')
assert.ok(Math.abs(plan.changePct - fromCloses) < 1e-9)
assert.equal(planFxPublication({
  assessment: { ...assessment, previous_trade_date: '2026-10-06', previous_close: 150 },
}).reason, 'previous_session_mismatch')
assert.equal(planFxPublication({
  assessment: { ...assessment, trade_date: '2026-10-09' },
}).reason, 'date_mismatch')
assert.equal(planFxPublication({
  assessment: { ...assessment, previous_close: null },
}).reason, 'missing_previous_close')

assert.equal(previousFxAlign({ trade_date: '2026-10-07', value: 157.99 }, '2026-10-07', 157.99).action, 'keep')
const manualPrev = 157.99
const yahooPrev = 158.29600524902344
const yahooClose = 158.05999755859375
const toleranceGap = Math.abs(manualPrev - yahooPrev) / yahooPrev
assert.ok(toleranceGap < 0.002)
assert.ok(Math.abs(toleranceGap - 0.001933) < 1e-4)
const measured = previousFxAlign(
  { trade_date: '2026-10-07', value: manualPrev, provider: 'manual_xlsx' },
  '2026-10-07',
  yahooPrev,
)
assert.equal(measured.action, 'replace')
assert.equal(measured.value, yahooPrev)
assert.equal(measured.changePct, null)
const yahooPct = fxChangePct(yahooClose, yahooPrev)
assert.ok(Math.abs(yahooPct - (-0.14909263822445729)) < 1e-9)
assert.equal(previousFxAlign(null, '2026-10-07', 157.99).action, 'insert')
assert.equal(previousFxAlign(null, '2026-10-07', null).reason, 'missing_previous_close')

const measuredPlan = planFxPublication({
  assessment: {
    ...assessment,
    previous_close: yahooPrev,
    close: yahooClose,
  },
})
const rerun = planUsdJpyWrites({
  plan: measuredPlan,
  dashboardPrevious: { trade_date: '2026-10-07', value: yahooPrev, change_pct: null },
  fxCurrent: { as_of_date: '2026-10-08', usd_jpy: yahooClose, provider: 'yahoo' },
  fxPrevious: { as_of_date: '2026-10-07', usd_jpy: manualPrev, provider: 'manual_xlsx' },
})
assert.equal(rerun.dashboardAlign.action, 'keep')
assert.equal(rerun.fxPreviousAlign.action, 'replace')
assert.deepEqual(rerun.fxRows.map((row) => row.as_of_date), ['2026-10-07'])
assert.equal(rerun.dashboardPreviousRow, null)

const onlyPreviousFx = planUsdJpyWrites({
  plan: measuredPlan,
  dashboardPrevious: { trade_date: '2026-10-07', value: yahooPrev },
  fxCurrent: { as_of_date: '2026-10-08', usd_jpy: yahooClose, provider: 'yahoo' },
  fxPrevious: { as_of_date: '2026-10-07', usd_jpy: yahooPrev, provider: 'manual_xlsx' },
})
assert.equal(onlyPreviousFx.fxPreviousAlign.action, 'replace')
assert.equal(onlyPreviousFx.fxCurrentAlign.action, 'keep')

assert.equal(fxConcurrentChange(
  { updated_at: 'a', provider: 'manual_xlsx', change_pct: 0.02, value: manualPrev },
  { updated_at: 'a', provider: 'yahoo', change_pct: null, value: manualPrev },
), true)
assert.equal(fxConcurrentChange(
  { updated_at: 'a', provider: 'yahoo', change_pct: 0.02, value: yahooPrev },
  { updated_at: 'a', provider: 'yahoo', change_pct: null, value: yahooPrev },
), true)
assert.equal(fxConcurrentChange(
  { updated_at: 'a', provider: 'yahoo', usd_jpy: yahooPrev },
  { updated_at: 'a', provider: 'yahoo', usd_jpy: yahooPrev },
), false)

const backup = [{ as_of_date: '2026-10-07', usd_jpy: manualPrev, provider: 'manual_xlsx' }]
const writes = []
const failed = await commitFxPair({
  fxRows: [{ as_of_date: '2026-10-07', usd_jpy: yahooPrev, provider: 'yahoo' }],
  dashboardRows: [{ trade_date: '2026-10-08', item: 'USD/JPY', value: yahooClose }],
  fxBackup: backup,
  writeFx: async (rows) => { writes.push(rows) },
  deleteFx: async () => { throw new Error('delete should not run') },
  writeDashboard: async () => { throw new Error('dashboard failed') },
})
assert.equal(failed.ok, false)
assert.equal(failed.compensated, true)
assert.equal(writes[1][0].usd_jpy, manualPrev)
assert.equal(writes[1][0].provider, 'manual_xlsx')

const series = dbFxSeriesResponse([
  { as_of_date: '2026-10-08', usd_jpy: 158.06, provider: 'manual_xlsx' },
], '2026-10-07', '2026-10-08')
assert.deepEqual(series.missingDates, ['2026-10-07'])
assert.equal(series.asOfByDate['2026-10-08'], '2026-10-08')
assert.equal(series.ratesByDate['2026-10-07'], undefined)
assert.equal(series.source, 'database')

assert.equal(fxConcurrentChange(
  { updated_at: 'a', value: 1 },
  { updated_at: 'b', value: 1 },
), true)
assert.equal(fxConcurrentChange(
  { updated_at: 'a', usd_jpy: 158 },
  { updated_at: 'a', usd_jpy: 158 },
), false)

const guarded = importerFxWrites({
  tradeDate: '2026-10-08',
  fxValue: 150,
  fxExisting: { provider: 'yahoo', as_of_date: '2026-10-08' },
  recentRows: [
    { item: 'USD/JPY', category: 'fx', trade_date: '2026-10-08', value: 150, change_pct: storedPct },
    { item: 'EUR/JPY', category: 'fx', trade_date: '2026-10-08', value: 180 },
    { item: '日経225', category: 'index', trade_date: '2026-10-08', value: 1 },
  ],
})
assert.equal(guarded.writeUsdJpy, false)
assert.deepEqual(guarded.recentRows.map((row) => row.item), ['日経225'])
assert.equal(importerFxWrites({
  tradeDate: '2026-10-08',
  fxValue: 158,
  fxExisting: { provider: 'manual_xlsx' },
  recentRows: [{ item: 'USD/JPY', category: 'fx', trade_date: '2026-10-08' }],
}).writeUsdJpy, true)

const kept = frankfurterRowsSkippingYahoo(
  [{ as_of_date: '2026-10-08', provider: 'yahoo' }, { as_of_date: '2026-10-07', provider: 'manual_xlsx' }],
  [{ as_of_date: '2026-10-08', usd_jpy: 150 }, { as_of_date: '2026-10-07', usd_jpy: 157 }],
)
assert.deepEqual(kept.map((row) => row.as_of_date), ['2026-10-07'])

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)))
assert.equal(vercel.crons.some((cron) => cron.path.includes('fx-usdjpy')), false)

const fxRoute = readFileSync(new URL('../api/fx.js', import.meta.url), 'utf8')
assert.equal(/frankfurter|twelvedata|fetchFrankfurter|fetchTwelveData/i.test(fxRoute), false)

function scriptedAdmin(results) {
  const pending = [...results]
  return {
    from() {
      const result = pending.shift() || { data: [], error: null }
      const api = {
        select() { return api },
        gte() { return api },
        lte() { return api },
        lt() { return api },
        order() { return api },
        limit() { return api },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject) },
      }
      return api
    },
  }
}

async function withNoExternal(run) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = (url) => {
    calls.push(String(url))
    throw new Error('external fx call')
  }
  try {
    const result = await run()
    assert.deepEqual(calls, [])
    return result
  } finally {
    globalThis.fetch = original
  }
}

const friday = { as_of_date: '2026-10-09', usd_jpy: 158.06, provider: 'yahoo' }
const weekend = await withNoExternal(() => readFxDaily(scriptedAdmin([
  { data: [], error: null },
  { data: [friday], error: null },
]), { start: '2026-10-10', end: '2026-10-11' }))
assert.equal(weekend.status, 200)
assert.deepEqual(Object.keys(weekend.body.ratesByDate), ['2026-10-09'])
assert.equal(weekend.body.ratesByDate['2026-10-09'], 158.06)
assert.equal(weekend.body.asOfByDate['2026-10-09'], '2026-10-09')
assert.deepEqual(weekend.body.missingDates, ['2026-10-10', '2026-10-11'])
assert.equal(weekend.body.ratesByDate['2026-10-10'], undefined)
assert.equal(weekend.body.ratesByDate['2026-10-11'], undefined)

const previousDay = await withNoExternal(() => readFxDaily(scriptedAdmin([
  { data: [], error: null },
  { data: [{ as_of_date: '2026-10-07', usd_jpy: 158.29600524902344, provider: 'yahoo' }], error: null },
]), { start: '2026-10-08', end: '2026-10-08' }))
assert.deepEqual(Object.keys(previousDay.body.ratesByDate), ['2026-10-07'])
assert.equal(previousDay.body.asOfByDate['2026-10-07'], '2026-10-07')
assert.deepEqual(previousDay.body.missingDates, ['2026-10-08'])

const missingDate = await withNoExternal(() => readFxDaily(scriptedAdmin([
  { data: [], error: null },
]), { date: '2026-10-08' }))
assert.equal(missingDate.status, 200)
assert.equal(missingDate.body.source, 'unavailable')
assert.deepEqual(missingDate.body.rates, {})

const dbError = await withNoExternal(() => readFxDaily(scriptedAdmin([
  { data: null, error: { message: 'db down' } },
]), { date: '2026-10-08' }))
assert.equal(dbError.status, 500)
assert.equal(dbError.body.error, 'FX database read failed')

const rangeDbError = await withNoExternal(() => readFxDaily(scriptedAdmin([
  { data: null, error: { message: 'db down' } },
]), { start: '2026-10-10', end: '2026-10-11' }))
assert.equal(rangeDbError.status, 500)

const noAdmin = await withNoExternal(() => readFxDaily(null, { date: '2026-10-08' }))
assert.equal(noAdmin.status, 500)

console.log('fx yahoo sync checks passed')
