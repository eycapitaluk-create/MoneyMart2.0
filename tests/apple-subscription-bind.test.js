import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appleSubscriptionGrant,
  foreignAppleSubscriptionOwner,
} from '../api/_lib/appleSubscriptionBind.js'

const NOW = Date.parse('2026-10-21T00:00:00Z')
const FUTURE = Date.parse('2026-11-21T00:00:00Z')
const PAST = Date.parse('2026-09-21T00:00:00Z')

test('the same App Store subscription cannot be linked to a second account', () => {
  const rows = [{ user_id: 'buyer-account' }]
  assert.equal(foreignAppleSubscriptionOwner(rows, 'buyer-account'), null)
  assert.equal(foreignAppleSubscriptionOwner(rows, 'other-account'), 'buyer-account')
  assert.equal(foreignAppleSubscriptionOwner([], 'other-account'), null)
  assert.equal(foreignAppleSubscriptionOwner([{ user_id: '' }], 'other-account'), null)
})

test('a refunded subscription does not stay active until the original expiry', () => {
  const paid = appleSubscriptionGrant({ expiresDate: FUTURE }, NOW)
  assert.equal(paid.active, true)
  assert.equal(paid.revoked, false)

  const refunded = appleSubscriptionGrant({
    expiresDate: FUTURE,
    revocationDate: PAST,
  }, NOW)
  assert.equal(refunded.active, false)
  assert.equal(refunded.revoked, true)
  assert.equal(refunded.expiresMs, FUTURE)
})

test('missing or elapsed expiry is not an active grant', () => {
  assert.deepEqual(appleSubscriptionGrant({}, NOW), {
    expiresMs: null,
    revoked: false,
    active: false,
  })
  const elapsed = appleSubscriptionGrant({ expiresDate: PAST, revocationDate: 0 }, NOW)
  assert.equal(elapsed.active, false)
  assert.equal(elapsed.revoked, false)
})
