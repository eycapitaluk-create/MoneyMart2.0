import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'))
const required = [
  ['us', 0, 6, '15 22 * * *'], ['us', 1, 6, '21 22 * * *'],
  ['us', 2, 6, '27 22 * * *'], ['us', 3, 6, '33 22 * * *'],
  ['us', 4, 6, '39 22 * * *'], ['us', 5, 6, '45 22 * * *'],
  ['jp', 0, 3, '51 22 * * *'], ['jp', 1, 3, '57 22 * * *'],
  ['jp', 2, 3, '3 23 * * *'],
  ['etf', 0, 4, '9 23 * * *'], ['etf', 1, 4, '15 23 * * *'],
  ['etf', 2, 4, '21 23 * * *'], ['etf', 3, 4, '27 23 * * *'],
  ['dashboard', null, null, '33 23 * * *'], ['fx', null, null, '15 0 * * *'],
]
const priceCrons = (config.crons || []).filter(c => c.path?.startsWith('/api/cron/yahoo-unadjusted-daily'))
assert.equal(priceCrons.length, required.length, 'Price collection requires all 15 approved daily schedules. Do not deploy with missing or duplicate price crons.')
for (const [scope, batch, batches, schedule] of required) {
  const matches = priceCrons.filter(c => {
    const u = new URL(c.path, 'https://schedule.invalid')
    return u.pathname === '/api/cron/yahoo-unadjusted-daily'
      && u.searchParams.get('scope') === scope
      && (batch === null || u.searchParams.get('batch') === String(batch))
      && (batches === null || u.searchParams.get('batches') === String(batches))
      && c.schedule === schedule
      && !u.searchParams.has('only_date')
      && !u.searchParams.has('catchup')
  })
  assert.equal(matches.length, 1, `Missing/duplicate approved schedule: ${scope}/${batch ?? 'all'}`)
}
const route = readFileSync(new URL('api/cron/yahoo-unadjusted-daily.js', root), 'utf8')
for (const safeguard of ['priceScheduleGate', 'incompleteBatchAlreadyAttempted', 'mapUntilYahooLimit', 'yahooCooldownActive']) {
  assert.ok(route.includes(safeguard), `Price collector safety check missing: ${safeguard}`)
}
const helpers = await import(new URL('api/_lib/yahooUnadjustedBar.js', root))
assert.equal(helpers.shouldRetryYahoo('pending_yahoo'), false, 'Same-run Yahoo retries must remain disabled')
assert.equal(helpers.YAHOO_FETCH_CONCURRENCY, 1)
assert.ok(helpers.YAHOO_MIN_GAP_MS >= 2000)
console.log('Price schedule guard passed: 15 daily schedules and collector safeguards preserved.')
