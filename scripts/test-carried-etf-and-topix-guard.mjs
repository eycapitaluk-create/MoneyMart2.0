import assert from 'node:assert/strict'
import { assessUnadjustedBar } from '../api/_lib/yahooUnadjustedBar.js'
import { dashboardTargets } from '../api/_lib/yahooPricePlan.js'

const previous = { date: '2026-10-09', open: 5010, high: 5040, low: 5000, close: 5032, volume: 30 }
function assess(volume, requireOhlc = true) {
  return assessUnadjustedBar({
    bars: [previous, { date: '2026-10-13', open: 5032, high: 5032, low: 5032, close: 5032, volume }],
    events: {}, timeZone: 'Asia/Tokyo', expectedDate: '2026-10-13', expectedPreviousDate: '2026-10-09', requireOhlc,
  })
}
for (const volume of [null, undefined, 0]) {
  assert.equal(assess(volume).trade_date, null, 'carried mark must not advance an equity execution date')
}
assert.equal(assess(1).status, 'ok', 'one-unit auction execution remains valid')
assert.equal(assess(null, false).status, 'ok', 'indices do not require traded share volume')
const targets = dashboardTargets(new Date('2026-10-14T00:35:00Z'))
assert.equal(targets.find(row => row.item === 'TOPIX').held, true, 'ETF proxy cannot overwrite verified TOPIX index')
assert.equal(targets.find(row => row.item === '日経225').held, false)
assert.equal(targets.find(row => row.item === 'USD/JPY').held, false)
console.log('Carried ETF date and TOPIX proxy regression checks passed.')
