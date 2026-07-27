import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  PRIMARY_STORAGE_KEY,
  planFundOptimizerDbMigration,
  planFundOptimizerLocalSave,
  scopedFundOptimizerStorageKey,
} from '../src/lib/fundOptimizerWatchsetsStorage.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const sampleSet = {
  id: 'set-a',
  name: 'A配分',
  funds: [
    { id: 'AAA', weightPct: 60 },
    { id: 'BBB', weightPct: 40 },
  ],
}

test('scoped storage key isolates accounts on the same browser', () => {
  assert.equal(scopedFundOptimizerStorageKey('user-a'), `${PRIMARY_STORAGE_KEY}:user-a`)
  assert.equal(scopedFundOptimizerStorageKey('user-b'), `${PRIMARY_STORAGE_KEY}:user-b`)
  assert.equal(scopedFundOptimizerStorageKey(''), PRIMARY_STORAGE_KEY)
})

test('authenticated local save writes a scoped key and clears the shared primary key', () => {
  const plan = planFundOptimizerLocalSave({ userId: 'user-b', sets: [sampleSet] })
  assert.equal(plan.writeKey, `${PRIMARY_STORAGE_KEY}:user-b`)
  assert.equal(plan.clearUnscopedPrimary, true)
  assert.equal(plan.sets.length, 1)
})

test('guest local save keeps the shared primary key', () => {
  const plan = planFundOptimizerLocalSave({ sets: [sampleSet] })
  assert.equal(plan.writeKey, PRIMARY_STORAGE_KEY)
  assert.equal(plan.clearUnscopedPrimary, false)
})

test('migration refuses to run without user-scoped local sets even when shared leftovers exist conceptually', () => {
  const plan = planFundOptimizerDbMigration({
    userId: 'user-b',
    userScopedSets: [],
    existingDbSets: [],
  })
  assert.equal(plan.action, 'skip')
  assert.equal(plan.reason, 'no_user_scoped_sets')
  assert.deepEqual(plan.sets, [])
})

test('migration pushes only user-scoped sets into an empty cloud account', () => {
  const plan = planFundOptimizerDbMigration({
    userId: 'user-a',
    userScopedSets: [sampleSet],
    existingDbSets: [],
  })
  assert.equal(plan.action, 'migrate')
  assert.equal(plan.reason, 'user_scoped')
  assert.equal(plan.sets[0].id, 'set-a')
})

test('migration skips when the cloud account already has sets', () => {
  const plan = planFundOptimizerDbMigration({
    userId: 'user-a',
    userScopedSets: [sampleSet],
    existingDbSets: [{ id: 'existing' }],
  })
  assert.equal(plan.action, 'skip')
  assert.equal(plan.reason, 'db_already_has_sets')
})

test('MyPage migrate path no longer saves cloud rows from the shared unscoped loader', () => {
  const source = readFileSync(join(root, 'src/pages/MyPage.jsx'), 'utf8')
  assert.match(source, /migrateFundOptimizerSetsToDb\(userId\)/)
  assert.match(source, /saveFundOptimizerWatchsets\(data,\s*userId\)/)
  assert.match(source, /loadFundOptimizerWatchsets\(userId\)/)
  assert.doesNotMatch(
    source,
    /saveFundOptimizerWatchsets\(data\)\s*;\s*\/\/\s*localStorage/,
  )
})

test('App clears shared fund-optimizer leftovers on auth identity change', () => {
  const source = readFileSync(join(root, 'src/App.jsx'), 'utf8')
  assert.match(source, /clearUnscopedFundOptimizerWatchsets/)
  assert.match(source, /prevUserId !== nextUserId/)
})
