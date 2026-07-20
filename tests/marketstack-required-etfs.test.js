import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldIncludeAutomaticMarketstackEtf } from '../api/cron/marketstack-daily.js'

test('automatic cron keeps ETF proxies used by live market widgets', () => {
  const liveWidgetSymbols = [
    'ACWI', 'MCHI', '1329.T', '1475.T', '1478.T', '2854.T', 'AAXJ', 'EEM',
    'IVV', 'IJH', 'IJR', 'IYE', 'IYM', 'IYJ', 'IYC', 'IYK', 'IYH', 'IYF',
    'IYW', 'IYZ', 'IDU', 'IYR', 'TLT', '2621.T', 'GLD', 'SLV', 'CPER', 'USO',
  ]

  for (const symbol of liveWidgetSymbols) {
    assert.equal(
      shouldIncludeAutomaticMarketstackEtf(symbol),
      true,
      `${symbol} must remain in scheduled ingestion`,
    )
  }
})

test('automatic cron still excludes ETFs outside the live widget allowlist', () => {
  assert.equal(shouldIncludeAutomaticMarketstackEtf('EUNK.DE'), false)
  assert.equal(shouldIncludeAutomaticMarketstackEtf('AAPL'), true)
})
