import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_POSTGREST_PAGE_SIZE,
  fetchAllRowsPaged,
} from '../src/lib/supabasePaginate.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('fetchAllRowsPaged merges pages past the PostgREST default cap', async () => {
  const pageSize = 100
  const total = 250
  const calls = []
  const { data, error } = await fetchAllRowsPaged(
    async (from, to) => {
      calls.push([from, to])
      const rows = []
      for (let i = from; i <= to && i < total; i += 1) {
        rows.push({ id: i })
      }
      return { data: rows, error: null }
    },
    { pageSize },
  )

  assert.equal(error, null)
  assert.equal(data.length, total)
  assert.deepEqual(calls, [
    [0, 99],
    [100, 199],
    [200, 299],
  ])
  assert.equal(data[0].id, 0)
  assert.equal(data[249].id, 249)
})

test('fetchAllRowsPaged requests one more page when the first page is exactly full', async () => {
  const pageSize = DEFAULT_POSTGREST_PAGE_SIZE
  const total = pageSize
  let calls = 0
  const { data, error } = await fetchAllRowsPaged(
    async (from, to) => {
      calls += 1
      const rows = []
      for (let i = from; i <= to && i < total; i += 1) {
        rows.push({ id: i })
      }
      return { data: rows, error: null }
    },
    { pageSize },
  )

  assert.equal(error, null)
  assert.equal(data.length, total)
  // Full first page requires a follow-up page that returns [] to confirm exhaustion.
  assert.equal(calls, 2)
})

test('fetchAllRowsPaged stops immediately when the only page is short', async () => {
  let calls = 0
  const { data, error } = await fetchAllRowsPaged(
    async () => {
      calls += 1
      return { data: [{ id: 1 }, { id: 2 }], error: null }
    },
    { pageSize: 100 },
  )
  assert.equal(error, null)
  assert.equal(data.length, 2)
  assert.equal(calls, 1)
})

test('fetchAllRowsPaged propagates the first page error without partial data', async () => {
  const boom = { message: 'boom', code: 'PGRST000' }
  const { data, error } = await fetchAllRowsPaged(async () => ({ data: null, error: boom }), {
    pageSize: 10,
  })
  assert.equal(data, null)
  assert.equal(error, boom)
})

test('loadOwnedAssetPositions and replace backups paginate with .range()', () => {
  const source = readFileSync(join(root, 'src/lib/myPageApi.js'), 'utf8')
  assert.match(source, /import\s+\{\s*fetchAllRowsPaged\s*\}\s+from\s+'\.\/supabasePaginate'/)
  assert.match(source, /export const loadOwnedAssetPositions[\s\S]*fetchAllRowsPaged\([\s\S]*user_owned_stocks[\s\S]*\.range\(from,\s*to\)/)
  assert.match(source, /export const loadOwnedAssetPositions[\s\S]*fetchAllRowsPaged\([\s\S]*user_owned_funds[\s\S]*\.range\(from,\s*to\)/)
  assert.match(
    source,
    /runSerializedOwnedStocksReplace\([\s\S]*fetchAllRowsPaged\([\s\S]*user_owned_stocks[\s\S]*\.range\(from,\s*to\)/,
  )
  assert.match(
    source,
    /runSerializedOwnedFundsReplace\([\s\S]*fetchAllRowsPaged\([\s\S]*user_owned_funds[\s\S]*\.range\(from,\s*to\)/,
  )
  // Unpaged single-shot SELECTs on owned tables must not remain in load/backup paths.
  assert.doesNotMatch(
    source,
    /from\('user_owned_stocks'\)\s*\n\s*\.select\([^)]+\)\s*\n\s*\.eq\('user_id',\s*userId\)\s*\n\s*\.order\('created_at',\s*\{\s*ascending:\s*true\s*\},?\s*\)\s*(?!\s*\.order)/,
  )
})
