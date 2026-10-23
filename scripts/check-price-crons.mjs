import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'))
const required = [
  ['us', 0, 6, '0 22 * * *'], ['us', 1, 6, '6 22 * * *'],
  ['us', 2, 6, '12 22 * * *'], ['us', 3, 6, '18 22 * * *'],
  ['us', 4, 6, '24 22 * * *'], ['us', 5, 6, '30 22 * * *'],
  ['jp', 0, 3, '36 22 * * *'], ['jp', 1, 3, '42 22 * * *'],
  ['jp', 2, 3, '48 22 * * *'],
  ['etf', 0, 4, '54 22 * * *'], ['etf', 1, 4, '0 23 * * *'],
  ['etf', 2, 4, '6 23 * * *'], ['etf', 3, 4, '12 23 * * *'],
  ['dashboard', null, null, '18 23 * * *'], ['fx', null, null, '24 23 * * *'],
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

// Owner request 2026-10-24: finish by08:30 JST, before09:00 stock alerts.
// Six-minute spacing retains a full five-minute function budget plus one minute.
const localMinutes = priceCrons.map(c => { const [m,h]=c.schedule.split(' ').map(Number); return ((h+9)%24)*60+m }).sort((a,b)=>a-b)
assert.equal(localMinutes[0],7*60,'Do not collect before the completed US session can be verified in winter')
for(let i=1;i<localMinutes.length;i++)assert.ok(localMinutes[i]-localMinutes[i-1]>=6,'Daily price batches must not overlap the five-minute function budget')
assert.ok(localMinutes.at(-1)+5<=8*60+30,'The final FX batch must finish before08:30 JST')
assert.equal(config.functions['api/cron/*.js'].maxDuration,300,'The schedule guard assumes the existing five-minute function budget')

const route = readFileSync(new URL('api/cron/yahoo-unadjusted-daily.js', root), 'utf8')
for (const safeguard of ['priceScheduleGate', 'incompleteBatchAlreadyAttempted', 'mapUntilYahooLimit', 'yahooCooldownActive']) {
  assert.ok(route.includes(safeguard), `Price collector safety check missing: ${safeguard}`)
}
const helpers = await import(new URL('api/_lib/yahooUnadjustedBar.js', root))
assert.equal(helpers.shouldRetryYahoo('pending_yahoo'), false, 'Same-run Yahoo retries must remain disabled')
assert.equal(helpers.YAHOO_FETCH_CONCURRENCY, 1)
assert.ok(helpers.YAHOO_MIN_GAP_MS >= 2000)
console.log('Price schedule guard passed: 15 daily schedules and collector safeguards preserved.')
