import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FREE_FUND_WATCHLIST_LIMIT,
  applyFundWatchlistPlanLimit,
  shouldSyncFundWatchlistFromDb,
} from '../src/lib/fundWatchlistPlanLimit.js'

describe('fund watchlist entitlement sync safety', () => {
  it('does not sync from DB until display profile entitlement is resolved', () => {
    assert.equal(shouldSyncFundWatchlistFromDb({
      userId: 'user-1',
      displayProfileResolved: false,
    }), false)
    assert.equal(shouldSyncFundWatchlistFromDb({
      userId: 'user-1',
      displayProfileResolved: true,
    }), true)
    assert.equal(shouldSyncFundWatchlistFromDb({
      userId: '',
      displayProfileResolved: true,
    }), false)
  })

  it('caps free users to the free limit and leaves paid users uncapped', () => {
    const funds = [1, 2, 3, 4, 5].map((n) => ({ id: `F${n}` }))
    assert.deepEqual(
      applyFundWatchlistPlanLimit(funds, false).map((r) => r.id),
      ['F1', 'F2', 'F3'],
    )
    assert.equal(applyFundWatchlistPlanLimit(funds, false).length, FREE_FUND_WATCHLIST_LIMIT)
    assert.deepEqual(
      applyFundWatchlistPlanLimit(funds, true).map((r) => r.id),
      ['F1', 'F2', 'F3', 'F4', 'F5'],
    )
  })

  it('uses the explicit paid flag so a stale free closure cannot hide paid funds', () => {
    // Concrete race: idle sync scheduled while currentUserProfile was still undefined
    // (isPaidMember === false), then profile resolves to premium before the callback runs.
    // The callback must apply the paid=true flag captured after resolution, not the stale free flag.
    const funds = Array.from({ length: 8 }, (_, i) => ({ id: `ETF${i + 1}` }))
    const staleFreeClosurePaid = false
    const resolvedPaid = true
    assert.equal(applyFundWatchlistPlanLimit(funds, staleFreeClosurePaid).length, 3)
    assert.equal(applyFundWatchlistPlanLimit(funds, resolvedPaid).length, 8)
  })
})
