import assert from 'node:assert/strict'
import test from 'node:test'

import { replaceNewsManualBucketRows } from '../api/_lib/news-manual-replace.js'

const createFakeSupabaseClient = ({ insertError = null, deleteError = null } = {}) => {
  const calls = []

  return {
    calls,
    from(table) {
      calls.push({ op: 'from', table })
      return {
        insert(rows) {
          calls.push({ op: 'insert', rows })
          return Promise.resolve({ error: insertError })
        },
        delete() {
          calls.push({ op: 'delete' })
          return {
            in(column, values) {
              calls.push({ op: 'in', column, values })
              return {
                lt(ltColumn, ltValue) {
                  calls.push({ op: 'lt', column: ltColumn, value: ltValue })
                  return Promise.resolve({ error: deleteError })
                },
              }
            },
          }
        },
      }
    },
  }
}

test('replaceNewsManualBucketRows inserts a stamped batch before deleting older bucket rows', async () => {
  const client = createFakeSupabaseClient()
  const rows = [
    { bucket: 'market_ticker', title: 'Market 1', updated_at: 'old' },
    { bucket: 'daily_brief', title: 'Brief 1' },
  ]
  const batchUpdatedAt = '2026-06-10T11:00:00.000Z'

  const result = await replaceNewsManualBucketRows(
    client,
    ['market_ticker', 'daily_brief'],
    rows,
    { batchUpdatedAt },
  )

  assert.equal(result.ok, true)
  assert.equal(result.inserted, 2)

  const insertCall = client.calls.find((call) => call.op === 'insert')
  assert.deepEqual(
    insertCall.rows.map((row) => row.updated_at),
    [batchUpdatedAt, batchUpdatedAt],
  )

  assert.deepEqual(
    client.calls.map((call) => call.op),
    ['from', 'insert', 'from', 'delete', 'in', 'lt'],
  )
  assert.deepEqual(client.calls.find((call) => call.op === 'in').values, ['market_ticker', 'daily_brief'])
  assert.equal(client.calls.find((call) => call.op === 'lt').column, 'updated_at')
  assert.equal(client.calls.find((call) => call.op === 'lt').value, batchUpdatedAt)
})

test('replaceNewsManualBucketRows preserves existing rows when insertion fails', async () => {
  const insertError = new Error('duplicate key value violates constraint')
  const client = createFakeSupabaseClient({ insertError })

  const result = await replaceNewsManualBucketRows(
    client,
    ['community_digest'],
    [{ bucket: 'community_digest', title: 'Digest' }],
    { batchUpdatedAt: '2026-06-10T11:05:00.000Z' },
  )

  assert.equal(result.ok, false)
  assert.equal(result.phase, 'insert')
  assert.equal(result.error, insertError)
  assert.equal(result.deletedOldRows, false)
  assert.equal(client.calls.some((call) => call.op === 'delete'), false)
})

test('replaceNewsManualBucketRows rejects rows outside the replacement buckets', async () => {
  const client = createFakeSupabaseClient()

  await assert.rejects(
    () => replaceNewsManualBucketRows(
      client,
      ['market_ticker'],
      [{ bucket: 'stock_disclosures', title: 'Manual disclosure' }],
      { batchUpdatedAt: '2026-06-10T11:10:00.000Z' },
    ),
    /unexpected buckets: stock_disclosures/,
  )

  assert.equal(client.calls.length, 0)
})
