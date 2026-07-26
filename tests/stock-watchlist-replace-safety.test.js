import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareStockWatchlistReplace } from '../src/lib/myPageApi.js'

test('empty stock watchlist replace is blocked by default to prevent accidental wipe', () => {
  const plan = prepareStockWatchlistReplace({ symbols: [] })
  assert.equal(plan.skip, true)
  assert.equal(plan.reason, 'empty_replace_blocked')
  assert.deepEqual(plan.symbols, [])
})

test('empty stock watchlist replace remains blocked for blank/whitespace symbols', () => {
  const plan = prepareStockWatchlistReplace({ symbols: ['', '  ', null, undefined] })
  assert.equal(plan.skip, true)
  assert.equal(plan.reason, 'empty_replace_blocked')
})

test('explicit allowEmptyReplace permits intentional clear', () => {
  const plan = prepareStockWatchlistReplace({ symbols: [], allowEmptyReplace: true })
  assert.equal(plan.skip, false)
  assert.deepEqual(plan.symbols, [])
})

test('non-empty replace normalizes and deduplicates symbols', () => {
  const plan = prepareStockWatchlistReplace({
    symbols: ['aapl', ' AAPL ', 'msft', '', 'msft'],
  })
  assert.equal(plan.skip, false)
  assert.deepEqual(plan.symbols, ['AAPL', 'MSFT'])
})
