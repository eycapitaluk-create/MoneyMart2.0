import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canMutateOwnedAssets,
  mergeLocalOwnedRowsOntoDb,
} from '../src/lib/ownedAssetHydrateSafety.js'

test('logged-in users cannot mutate owned assets until hydrate is ready', () => {
  assert.equal(canMutateOwnedAssets({ userId: 'u1', ownedAssetDbReady: false }), false)
  assert.equal(canMutateOwnedAssets({ userId: 'u1', ownedAssetDbReady: true }), true)
})

test('logged-out users can mutate in-memory owned assets', () => {
  assert.equal(canMutateOwnedAssets({ userId: null, ownedAssetDbReady: false }), true)
  assert.equal(canMutateOwnedAssets({ userId: '', ownedAssetDbReady: false }), true)
})

test('hydrate merge keeps in-flight local lots and preserves existing DB lots', () => {
  const db = [
    { lotId: 'db-1', symbol: '7203.T', qty: 100 },
    { lotId: 'db-2', symbol: 'AAPL', qty: 5 },
  ]
  const local = [
    { lotId: 'new-1', symbol: 'NVDA', qty: 2 },
  ]
  const merged = mergeLocalOwnedRowsOntoDb(db, local, 'lotId')
  assert.deepEqual(
    merged.map((row) => row.lotId),
    ['db-1', 'db-2', 'new-1'],
  )
  assert.equal(merged.find((row) => row.lotId === 'db-1').qty, 100)
})

test('hydrate merge does not let empty pre-hydrate local rows wipe DB lots', () => {
  const db = [{ lotId: 'db-1', symbol: '7203.T', qty: 100 }]
  assert.deepEqual(mergeLocalOwnedRowsOntoDb(db, [], 'lotId'), db)
  assert.deepEqual(mergeLocalOwnedRowsOntoDb(db, null, 'lotId'), db)
})

test('hydrate merge ignores local rows that already exist in the DB snapshot', () => {
  const db = [{ lotId: 'db-1', symbol: '7203.T', qty: 100 }]
  const local = [{ lotId: 'db-1', symbol: '7203.T', qty: 1 }]
  const merged = mergeLocalOwnedRowsOntoDb(db, local, 'lotId')
  assert.equal(merged.length, 1)
  assert.equal(merged[0].qty, 100)
})

test('hydrate merge uses fund_row id key', () => {
  const db = [{ id: 'fund-1', symbol: '1306.T', investAmount: 10000 }]
  const local = [{ id: 'fund-new', symbol: '2558.T', investAmount: 5000 }]
  const merged = mergeLocalOwnedRowsOntoDb(db, local, 'id')
  assert.deepEqual(
    merged.map((row) => row.id),
    ['fund-1', 'fund-new'],
  )
})
