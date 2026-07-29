import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPremiumEntitlement, isPaidPlanTier } from '../src/lib/membership.js'
import {
  buildCourtesyThanksMessage,
  isCourtesyPremiumGiftActive,
} from '../src/lib/premiumCourtesyGrant.js'
import { normalizeInsightDocumentForRender } from '../src/lib/insightDocumentNormalize.js'
import { FUND_PAGE_SESSION_KEYS } from '../src/lib/fundPageSessionStorage.js'

test('hasPremiumEntitlement: paid plan tiers', () => {
  assert.equal(hasPremiumEntitlement({ planTier: 'premium' }), true)
  assert.equal(hasPremiumEntitlement({ planTier: 'prime' }), true)
  assert.equal(hasPremiumEntitlement({ planTier: 'free' }), false)
  assert.equal(isPaidPlanTier('pro'), true)
})

test('hasPremiumEntitlement: active trial grants access', () => {
  const now = Date.parse('2026-07-29T12:00:00.000Z')
  assert.equal(
    hasPremiumEntitlement({
      planTier: 'free',
      premiumTrialEndsAt: '2026-08-01T00:00:00.000Z',
      now,
    }),
    true,
  )
  assert.equal(
    hasPremiumEntitlement({
      planTier: 'free',
      premiumTrialEndsAt: '2026-07-01T00:00:00.000Z',
      now,
    }),
    false,
  )
})

test('hasPremiumEntitlement: premium_until grants access', () => {
  const now = Date.parse('2026-07-29T12:00:00.000Z')
  assert.equal(
    hasPremiumEntitlement({
      planTier: 'free',
      premiumUntil: '2026-08-15T00:00:00.000Z',
      now,
    }),
    true,
  )
})

test('isCourtesyPremiumGiftActive ignores billed entitlements', () => {
  const until = '2026-08-15T00:00:00.000Z'
  assert.equal(
    isCourtesyPremiumGiftActive({
      premiumUntil: until,
      hasBillingEntitlement: false,
      now: Date.parse('2026-07-29T12:00:00.000Z'),
    }),
    true,
  )
  assert.equal(
    isCourtesyPremiumGiftActive({
      premiumUntil: until,
      hasBillingEntitlement: true,
      now: Date.parse('2026-07-29T12:00:00.000Z'),
    }),
    false,
  )
  assert.match(buildCourtesyThanksMessage(until), /プレミアム体験/)
})

test('normalizeInsightDocumentForRender tolerates null/partial docs', () => {
  const empty = normalizeInsightDocumentForRender(null)
  assert.deepEqual(empty.hero.titleLines, [])
  assert.deepEqual(empty.sections, [])
  assert.deepEqual(empty.ticker, [])

  const partial = normalizeInsightDocumentForRender({ hero: { badge: 'NEWS' }, sections: [{ type: 'prose' }] })
  assert.equal(partial.hero.badge, 'NEWS')
  assert.equal(partial.sections.length, 1)
})

test('fund page session keys cover list cache and UI state', () => {
  assert.ok(FUND_PAGE_SESSION_KEYS.includes('moneymart.fund.page.cache.v12'))
  assert.ok(FUND_PAGE_SESSION_KEYS.includes('moneymart.fund.page.ui.v1'))
})
