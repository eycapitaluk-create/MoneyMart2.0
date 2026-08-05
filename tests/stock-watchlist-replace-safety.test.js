import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { prepareStockWatchlistReplace } from '../src/lib/stockWatchlistReplace.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('empty stock watchlist replace is blocked by default to prevent accidental wipe', () => {
  const plan = prepareStockWatchlistReplace({ symbols: [] })
  assert.equal(plan.skip, true)
  assert.equal(plan.reason, 'empty_replace_blocked')
  assert.deepEqual(plan.symbols, [])
})

test('empty stock watchlist replace remains blocked for blank/whitespace symbols', () => {
  const plan = prepareStockWatchlistReplace({ symbols: ['', '  ', '\t'] })
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

test('StockPage toggles wait for hydration and use incremental DB writes', () => {
  const source = readFileSync(join(root, 'src/pages/StockPage.jsx'), 'utf8')
  assert.match(source, /if\s*\(\s*!watchlistHydratedRef\.current\s*\)\s*return/)
  assert.match(source, /upsertStockWatchlistSymbolInDb/)
  assert.match(source, /removeStockWatchlistSymbolInDb/)
  assert.doesNotMatch(
    source,
    /replaceStockWatchlistInDb\(\{\s*userId:\s*uid,\s*symbols:\s*next\s*\}\)/,
  )
})

test('MyPage removes a single stock watchlist symbol without full list replace', () => {
  const source = readFileSync(join(root, 'src/pages/MyPage.jsx'), 'utf8')
  assert.match(source, /removeStockWatchlistSymbolInDb\(\{\s*userId:\s*user\.id,\s*symbol:\s*id\s*\}\)/)
  assert.doesNotMatch(
    source,
    /replaceStockWatchlistInDb\(\{\s*userId:\s*user\.id,\s*symbols:\s*nextIds\s*\}\)/,
  )
})
