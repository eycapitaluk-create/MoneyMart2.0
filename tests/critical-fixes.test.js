import assert from 'node:assert/strict'
import test from 'node:test'

import { hasAdminBasicSession } from '../api/admin/basic-auth.js'
import { verifyCronBearerToken } from '../api/_lib/cron-auth.js'
import {
  replaceAiNewsSummaryRows,
  replaceNewsManualBucketRows,
} from '../api/_lib/news-replacement.js'

function createFakeSupabaseClient({ failInsert = false } = {}) {
  const calls = []

  const makeBuilder = (table) => {
    const builder = {
      insert(rows) {
        calls.push({ op: 'insert', table, rows })
        return Promise.resolve({ error: failInsert ? new Error('insert failed') : null })
      },
      delete() {
        calls.push({ op: 'delete', table })
        return builder
      },
      update(values) {
        calls.push({ op: 'update', table, values })
        return builder
      },
      in(column, values) {
        calls.push({ op: 'in', table, column, values })
        return builder
      },
      eq(column, value) {
        calls.push({ op: 'eq', table, column, value })
        return builder
      },
      lt(column, value) {
        calls.push({ op: 'lt', table, column, value })
        return Promise.resolve({ error: null })
      },
    }
    return builder
  }

  return {
    calls,
    from(table) {
      calls.push({ op: 'from', table })
      return makeBuilder(table)
    },
  }
}

test('admin basic auth session cookie must match exact name and value', () => {
  assert.equal(hasAdminBasicSession('mm_admin_basic=1'), true)
  assert.equal(hasAdminBasicSession('foo=bar; mm_admin_basic=1; theme=dark'), true)
  assert.equal(hasAdminBasicSession('mm_admin_basic=10'), false)
  assert.equal(hasAdminBasicSession('foo=mm_admin_basic=1'), false)
  assert.equal(hasAdminBasicSession('x=1; mm_admin_basic=1y'), false)
})

test('cron bearer token verification fails closed when secret is missing', () => {
  assert.deepEqual(
    verifyCronBearerToken('Bearer undefined', undefined),
    { ok: false, status: 500, payload: { ok: false, error: 'CRON_SECRET is required' } },
  )
  assert.deepEqual(
    verifyCronBearerToken('Bearer wrong', 'secret'),
    { ok: false, status: 401, payload: { ok: false, error: 'Unauthorized cron request' } },
  )
  assert.deepEqual(verifyCronBearerToken('Bearer secret', 'secret'), { ok: true })
})

test('news manual replacement inserts new batch before deleting old rows', async () => {
  const client = createFakeSupabaseClient()
  const batchUpdatedAt = '2026-06-14T11:00:00.000Z'

  const result = await replaceNewsManualBucketRows(
    client,
    ['market_ticker'],
    [{ bucket: 'market_ticker', title: 'new' }],
    batchUpdatedAt,
  )

  assert.equal(result.inserted, 1)
  assert.equal(client.calls[1].op, 'insert')
  assert.equal(client.calls[1].rows[0].updated_at, batchUpdatedAt)
  assert.equal(client.calls[3].op, 'delete')
  assert.deepEqual(client.calls.map((call) => call.op), ['from', 'insert', 'from', 'delete', 'in', 'lt'])
})

test('news manual replacement keeps old rows when insert fails', async () => {
  const client = createFakeSupabaseClient({ failInsert: true })

  const result = await replaceNewsManualBucketRows(
    client,
    ['market_ticker'],
    [{ bucket: 'market_ticker', title: 'new' }],
    '2026-06-14T11:00:00.000Z',
  )

  assert.match(result.error.message, /insert failed/)
  assert.deepEqual(client.calls.map((call) => call.op), ['from', 'insert'])
})

test('AI news replacement inserts new active rows before deactivating old rows', async () => {
  const client = createFakeSupabaseClient()
  const batchUpdatedAt = '2026-06-14T11:00:00.000Z'

  const result = await replaceAiNewsSummaryRows(
    client,
    [{ headline: 'new', is_active: true }],
    batchUpdatedAt,
  )

  assert.equal(result.inserted, 1)
  assert.deepEqual(client.calls.map((call) => call.op), ['from', 'insert', 'from', 'update', 'eq', 'lt'])
  assert.deepEqual(client.calls[3].values, { is_active: false })
  assert.equal(client.calls[5].value, batchUpdatedAt)
})

test('AI news replacement does not deactivate old rows when insert fails', async () => {
  const client = createFakeSupabaseClient({ failInsert: true })

  const result = await replaceAiNewsSummaryRows(
    client,
    [{ headline: 'new', is_active: true }],
    '2026-06-14T11:00:00.000Z',
  )

  assert.match(result.error.message, /insert failed/)
  assert.deepEqual(client.calls.map((call) => call.op), ['from', 'insert'])
})
