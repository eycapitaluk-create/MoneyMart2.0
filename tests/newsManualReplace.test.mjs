import assert from 'node:assert/strict'
import test from 'node:test'
import { replaceNewsManualBucketRows } from '../src/lib/newsManualReplace.js'

function createSupabaseDouble({ insertError = null, deleteError = null } = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      calls.push({ op: 'from', table })
      return {
        insert(rows) {
          calls.push({ op: 'insert', rows })
          return {
            async select(columns) {
              calls.push({ op: 'select', columns })
              return {
                data: insertError ? null : rows.map((_, idx) => ({ id: idx + 1 })),
                error: insertError,
              }
            },
          }
        },
        delete() {
          calls.push({ op: 'delete' })
          return {
            in(column, values) {
              calls.push({ op: 'in', column, values })
              return {
                async lt(columnName, value) {
                  calls.push({ op: 'lt', column: columnName, value })
                  return { error: deleteError }
                },
              }
            },
          }
        },
      }
    },
  }
  return client
}

test('preserves existing news_manual rows when inserting the replacement batch fails', async () => {
  const insertError = new Error('insert failed')
  const client = createSupabaseDouble({ insertError })
  const rows = [
    { bucket: 'daily_brief', title: 'new brief', sort_order: 1 },
  ]

  await assert.rejects(
    () => replaceNewsManualBucketRows(client, 'daily_brief', rows),
    /insert failed/,
  )

  assert.equal(client.calls.some((call) => call.op === 'delete'), false)
  assert.equal(rows[0].updated_at, undefined)
})

test('inserts a timestamped batch before deleting only older rows in target buckets', async () => {
  const client = createSupabaseDouble()
  const rows = [
    { bucket: 'market_pickup', title: 'market', sort_order: 1 },
    { bucket: 'daily_brief', title: 'brief', sort_order: 1 },
  ]

  const result = await replaceNewsManualBucketRows(client, ['market_pickup', 'daily_brief'], rows)

  const ops = client.calls.map((call) => call.op)
  assert.deepEqual(ops, ['from', 'insert', 'select', 'from', 'delete', 'in', 'lt'])

  const insertCall = client.calls.find((call) => call.op === 'insert')
  assert.equal(insertCall.rows.length, 2)
  assert.match(insertCall.rows[0].updated_at, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(insertCall.rows[0].updated_at, insertCall.rows[1].updated_at)

  const bucketFilter = client.calls.find((call) => call.op === 'in')
  assert.equal(bucketFilter.column, 'bucket')
  assert.deepEqual(bucketFilter.values, ['market_pickup', 'daily_brief'])

  const olderThanFilter = client.calls.find((call) => call.op === 'lt')
  assert.equal(olderThanFilter.column, 'updated_at')
  assert.equal(olderThanFilter.value, insertCall.rows[0].updated_at)
  assert.equal(result.inserted, 2)
})

test('rejects empty or out-of-scope replacement batches before writing', async () => {
  const emptyClient = createSupabaseDouble()
  await assert.rejects(
    () => replaceNewsManualBucketRows(emptyClient, 'daily_brief', []),
    /empty batch/,
  )
  assert.equal(emptyClient.calls.length, 0)

  const scopedClient = createSupabaseDouble()
  await assert.rejects(
    () => replaceNewsManualBucketRows(scopedClient, 'daily_brief', [
      { bucket: 'fund_pickup', title: 'wrong bucket' },
    ]),
    /outside target scope/,
  )
  assert.equal(scopedClient.calls.length, 0)
})
