import assert from 'node:assert/strict'
import {
  getLastJPTradingDate,
  getLastUSTradingDate,
  rowsForRequestedSession,
} from '../api/_lib/tradingSessionDate.js'

const at = (iso) => new Date(iso)

// Friday 09:00 KST is Thursday 20:00 New York. The US Friday session has not opened.
assert.equal(getLastUSTradingDate(at('2026-10-09T00:00:00Z')), '2026-10-08')
assert.notEqual(getLastUSTradingDate(at('2026-10-09T00:00:00Z')), '2026-10-09')
// Same clock is 09:00 in Tokyo, before the 15:30 cash close.
assert.equal(getLastJPTradingDate(at('2026-10-09T00:00:00Z')), '2026-10-08')

// Saturday 09:00 KST is Friday 20:00 New York, after the Friday close.
assert.equal(getLastUSTradingDate(at('2026-10-10T00:00:00Z')), '2026-10-09')
assert.equal(getLastJPTradingDate(at('2026-10-10T00:00:00Z')), '2026-10-09')
// Saturday 16:00 KST is still the Friday Tokyo session.
assert.equal(getLastJPTradingDate(at('2026-10-10T07:00:00Z')), '2026-10-09')

// Monday 09:00 KST is Sunday evening in New York, and before the Tokyo close.
assert.equal(getLastUSTradingDate(at('2026-10-12T00:00:00Z')), '2026-10-09')
assert.equal(getLastJPTradingDate(at('2026-10-12T00:00:00Z')), '2026-10-09')
// Monday 16:00 KST is after the Tokyo close, so that session is complete.
assert.equal(getLastJPTradingDate(at('2026-10-12T07:00:00Z')), '2026-10-12')
// Monday 16:00 KST is 03:00 New York, before the US close.
assert.equal(getLastUSTradingDate(at('2026-10-12T07:00:00Z')), '2026-10-09')

// DST: July is EDT (UTC-4). 09:00 KST Wednesday is 20:00 Tuesday in New York.
assert.equal(getLastUSTradingDate(at('2026-07-15T00:00:00Z')), '2026-07-14')
// DST: January is EST (UTC-5). 09:00 KST Wednesday is 19:00 Tuesday in New York.
assert.equal(getLastUSTradingDate(at('2026-01-14T00:00:00Z')), '2026-01-13')
// First Monday after the 2026 US spring-forward is still the prior Friday.
assert.equal(getLastUSTradingDate(at('2026-03-09T00:00:00Z')), '2026-03-06')
// First Monday after the 2026 US fall-back is still the prior Friday.
assert.equal(getLastUSTradingDate(at('2026-11-02T00:00:00Z')), '2026-10-30')

// Exactly 16:00 New York is a completed session. One minute earlier is not.
assert.equal(getLastUSTradingDate(at('2026-10-08T20:00:00Z')), '2026-10-08')
assert.equal(getLastUSTradingDate(at('2026-10-08T19:59:00Z')), '2026-10-07')
// Tokyo cash close is 15:30. 15:00 through 15:29 is still the open session.
for (const iso of ['2026-10-08T06:00:00Z', '2026-10-08T06:15:00Z', '2026-10-08T06:29:00Z']) {
  assert.equal(getLastJPTradingDate(at(iso)), '2026-10-07')
  assert.notEqual(getLastJPTradingDate(at(iso)), '2026-10-08')
}
assert.equal(getLastJPTradingDate(at('2026-10-08T06:30:00Z')), '2026-10-08')

// Holiday or empty provider payload must not invent a bar or accept another date.
assert.deepEqual(rowsForRequestedSession([], '2026-11-26'), [])
assert.deepEqual(
  rowsForRequestedSession(
    [{ symbol: 'AAPL', date: '2026-11-25T00:00:00+0000', close: 100 }],
    '2026-11-26',
  ),
  [],
)
const kept = rowsForRequestedSession(
  [{ symbol: 'AAPL', date: '2026-10-08T00:00:00+0000', close: 100 }],
  '2026-10-08',
)
assert.equal(kept.length, 1)
assert.equal(kept[0].close, 100)

console.log('trading-session-date tests passed')
