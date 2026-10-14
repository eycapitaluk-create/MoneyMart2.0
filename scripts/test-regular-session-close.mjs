import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { barsFromChart, assessUnadjustedBar } from '../api/_lib/yahooUnadjustedBar.js'
import { incompleteBatchAlreadyAttempted } from '../api/_lib/priceSchedule.js'
const original = JSON.parse(readFileSync(new URL('./fixtures/price-close/NVDA.json', import.meta.url)))
const end = original.chart.result[0].meta.currentTradingPeriod.regular.end
const parse = (p, now = new Date((end + 3600) * 1000)) => barsFromChart(p, 'UTC', { expectedDate: '2026-10-13', now })
const good = parse(original)
const assessed = assessUnadjustedBar({ ...good, expectedDate: '2026-10-13', expectedPreviousDate: '2026-10-12', requireOhlc: true })
assert.equal(assessed.status, 'ok')
assert.equal(assessed.close, 228.52)
assert.equal(assessed.close_evidence.extended_hours_price_used, false)
const rejected = []
for (const [name, mutate] of [
  ['intraday', m => { m.regularMarketTime -= 60 }],
  ['after hours timestamp', m => { m.regularMarketTime += 3600 }],
  ['beyond closing auction report window', m => { m.regularMarketTime += 61 }],
  ['different session', m => { m.currentTradingPeriod.regular.end += 86400; m.regularMarketTime += 86400 }],
  ['futures', m => { m.instrumentType = 'FUTURE' }],
  ['out of daily range', m => { m.regularMarketPrice = 9999 }],
  ['wrong volume', m => { m.regularMarketVolume += 1 }],
  ['wrong high', m => { m.regularMarketDayHigh += 10 }],
]) {
  const p = structuredClone(original); mutate(p.chart.result[0].meta)
  assert.equal(parse(p).bars.at(-1).close, null, name)
  rejected.push(name)
}
assert.equal(parse(original, new Date((end + 60) * 1000)).bars.at(-1).close, null)
rejected.push('settlement buffer not passed')
const present = structuredClone(original); present.chart.result[0].indicators.quote[0].close.at(-1)
const closes = present.chart.result[0].indicators.quote[0].close; closes[closes.length - 1] = 228.50
assert.equal(parse(present).bars.at(-1).close, 228.50)
const msft = JSON.parse(readFileSync(new URL('./fixtures/price-close/MSFT.json', import.meta.url)))
const msftParsed = parse(msft)
assert.equal(msftParsed.bars.at(-1).close, 543.45)
assert.equal(msftParsed.bars.at(-1).close_evidence.closing_auction_report_offset_seconds, 1)
const targets = [{ symbol: 'AAA', expectedDate: '2026-10-13' }]
const meta = { scope: 'us', batch: 0, completeness: 'partial', backup: [{ symbol: 'AAA', trade_date: '2026-10-13' }] }
const review = JSON.parse(readFileSync(new URL('./fixtures/price-close/source-review.json', import.meta.url)))
assert.equal(incompleteBatchAlreadyAttempted([{ meta }], targets, 'us', 0), true)
assert.equal(incompleteBatchAlreadyAttempted([{ meta: { ...meta, price_source_review: review } }], targets, 'us', 0), false)
assert.equal(incompleteBatchAlreadyAttempted([{ meta: { ...meta, price_source_review: review } }, { meta }], targets, 'us', 0), true, 'new partial run blocks further repeats')
assert.equal(incompleteBatchAlreadyAttempted([{ meta: { ...meta, price_source_review: { ...review, trade_date: '2026-10-12' } } }], targets, 'us', 0), true)
console.log('Verified regular session close accepted; 9 unsafe alternatives rejected; additional repeats blocked.')
