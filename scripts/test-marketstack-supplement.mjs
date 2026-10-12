import assert from 'node:assert/strict'
import {
  VERIFIED_MARKETSTACK_USAGE,
  assessmentFromMarketstackRow,
  budgetAllows,
  conservativeBilledSymbols,
  enforcedQuota,
  marketstackCandidates,
  marketstackHoldReason,
  requestsForSymbols,
  supplementStorm,
  usageSinceVerifiedBaseline,
} from '../api/_lib/marketstackSupplement.js'

const miss = (symbol, extra = {}) => ({
  symbol,
  yahoo: symbol,
  item: symbol,
  expectedDate: '2026-10-08',
  assessment: { status: 'pending_yahoo' },
  ...extra,
})

const { eligible, skipped } = marketstackCandidates([
  miss('AAPL'),
  miss('7203.T'),
  miss('491A.T'),
  miss('^GSPC'),
  miss('^MOVE'),
  miss('^N225'),
  miss('000001.SS'),
  miss('JPY=X', { dashboardOnly: true }),
  { symbol: 'GC=F', held: true, assessment: { status: 'pending_yahoo' } },
  miss('MSFT', { assessment: { status: 'ok' } }),
  miss('INTU', { assessment: { status: 'corporate_action_isolated' } }),
])

assert.deepEqual(eligible.map((row) => row.symbol), ['AAPL', '7203.T'])
assert.ok(skipped.some((row) => row.symbol === '491A.T' && row.reason === 'known_unsupported'))
assert.ok(skipped.some((row) => row.symbol === '^GSPC' && row.reason === 'known_unsupported'))
assert.equal(requestsForSymbols(0), 0)
assert.equal(requestsForSymbols(5), 5)
assert.equal(requestsForSymbols(80), 80)
assert.equal(requestsForSymbols(81), 81)
assert.equal(budgetAllows(9995, 10000, 5), true)
assert.equal(budgetAllows(9996, 10000, 5), false)

const good = assessmentFromMarketstackRow({
  date: '2026-10-08T00:00:00+0000',
  open: 336.82,
  high: 341.57,
  low: 335.9,
  close: 340.42,
  adj_close: 300,
  volume: 10,
}, '2026-10-08')
assert.equal(good.close, 340.42)
assert.equal(good.trade_date, '2026-10-08')
assert.equal(good.provider, 'marketstack')
assert.equal(good.price_basis, 'unadjusted_daily_ohlc')

assert.equal(assessmentFromMarketstackRow({
  date: '2026-10-07T00:00:00+0000', open: 1, high: 2, low: 1, close: 1,
}, '2026-10-08'), null)
assert.equal(assessmentFromMarketstackRow({
  date: '2026-10-08', open: 10, high: 9, low: 8, close: 8,
}, '2026-10-08'), null)
assert.equal(assessmentFromMarketstackRow({
  date: '2026-10-08', close: 10, adj_close: 10,
}, '2026-10-08'), null)

assert.equal(supplementStorm(8, 100), false)
assert.equal(supplementStorm(30, 100), true)
const chunksOnly = conservativeBilledSymbols([{ source: 'marketstack', meta: { chunks: 2 } }])
assert.equal(chunksOnly.used, 160)
const listed = conservativeBilledSymbols([{ source: 'marketstack', meta: { symbols: ['AAPL', 'MSFT', 'NVDA'] } }])
assert.equal(listed.used, 3)
assert.equal(conservativeBilledSymbols([{ source: 'marketstack', status: 'success', meta: {} }]).used, null)
assert.equal(conservativeBilledSymbols([]).reason, 'usage_unconfirmed')
assert.equal(conservativeBilledSymbols([]).used, null)
assert.equal(conservativeBilledSymbols([{ source: 'yahoo', meta: { marketstack_billed_symbols: 3 } }]).reason, 'usage_unconfirmed')
assert.equal(conservativeBilledSymbols([], { truncated: true }).used, null)
assert.ok(marketstackCandidates([miss('348A.T')]).eligible.some((row) => row.symbol === '348A.T'))
assert.ok(marketstackCandidates([miss('491A.T')]).skipped.some((row) => row.symbol === '491A.T'))

const duringCycle = new Date('2026-10-09T06:00:00Z')
const afterCycle = new Date('2026-10-14T00:00:00Z')
const emptyAfterBaseline = usageSinceVerifiedBaseline([], { now: duringCycle })
assert.equal(emptyAfterBaseline.used, 1845)
assert.equal(emptyAfterBaseline.reason, 'verified_baseline')
assert.notEqual(emptyAfterBaseline.used, 0)
const reservedAfter = usageSinceVerifiedBaseline([
  { source: 'yahoo', started_at: '2026-10-09T05:00:00Z', meta: { marketstack_billed_symbols: 400 } },
  { source: 'yahoo', started_at: '2026-10-09T05:40:00Z', meta: { marketstack_billed_symbols: 5 } },
  { source: 'marketstack', started_at: '2026-09-20T00:00:00Z', meta: { marketstack_billed_symbols: 80 } },
], { now: duringCycle })
assert.equal(reservedAfter.used, 1850)
assert.equal(reservedAfter.extra, 5)
assert.equal(usageSinceVerifiedBaseline([
  { source: 'marketstack', started_at: '2026-10-09T05:40:00Z', meta: {} },
], { now: duringCycle }).reason, 'usage_unconfirmed')
assert.equal(usageSinceVerifiedBaseline([], { now: new Date('2026-10-12T14:59:59Z') }).reason, 'verified_baseline')
assert.equal(usageSinceVerifiedBaseline([], { now: new Date('2026-10-12T15:00:00Z') }).reason, 'billing_period_unconfirmed')
assert.equal(usageSinceVerifiedBaseline([], { now: afterCycle }).reason, 'billing_period_unconfirmed')
assert.equal(usageSinceVerifiedBaseline([], { truncated: true, now: duringCycle }).used, null)
assert.equal(enforcedQuota(50000), 10000)
assert.equal(enforcedQuota(undefined), VERIFIED_MARKETSTACK_USAGE.quotaRequests)
assert.equal(budgetAllows(1845, 10000, 8155), true)
assert.equal(budgetAllows(1845, 10000, 8156), false)
assert.equal(marketstackHoldReason({
  needed: 3, classifiedCount: 100, usage: emptyAfterBaseline, hasKey: true, now: duringCycle, budget: 10000,
}), null)
assert.equal(marketstackHoldReason({
  needed: 8156, classifiedCount: 100000, usage: emptyAfterBaseline, hasKey: true, now: duringCycle, budget: 10000,
}), 'budget')
assert.equal(marketstackHoldReason({
  needed: 1, classifiedCount: 100, usage: emptyAfterBaseline, hasKey: true, now: new Date('2026-10-12T15:00:00Z'), budget: 10000,
}), 'billing_period_unconfirmed')
assert.equal(marketstackHoldReason({
  needed: 1, classifiedCount: 100, usage: emptyAfterBaseline, hasKey: true, now: afterCycle, budget: 10000,
}), 'billing_period_unconfirmed')

console.log('marketstack supplement order checks passed')
