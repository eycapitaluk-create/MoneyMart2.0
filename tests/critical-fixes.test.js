import test from 'node:test'
import assert from 'node:assert/strict'
import { hasAdminBasicSession } from '../api/admin/basic-auth.js'
import { replaceNewsManualBucketRows } from '../api/_lib/news-manual-replace.js'
import { isPaidFromUserProfileRow } from '../src/lib/membership.js'

function makeNewsManualClient({ insertError = null, deleteError = null } = {}) {
  const ops = []
  return {
    ops,
    client: {
      from(table) {
        ops.push({ op: 'from', table })
        return {
          insert(rows) {
            ops.push({ op: 'insert', rows })
            return Promise.resolve({ error: insertError })
          },
          delete() {
            ops.push({ op: 'delete' })
            return {
              in(column, values) {
                ops.push({ op: 'in', column, values })
                return {
                  lt(columnName, value) {
                    ops.push({ op: 'lt', column: columnName, value })
                    return Promise.resolve({ error: deleteError })
                  },
                }
              },
            }
          },
        }
      },
    },
  }
}

test('admin basic session cookie must match exact cookie name and value', () => {
  assert.equal(hasAdminBasicSession('mm_admin_basic=1'), true)
  assert.equal(hasAdminBasicSession('theme=dark; mm_admin_basic=1; other=x'), true)
  assert.equal(hasAdminBasicSession('x=mm_admin_basic=1'), false)
  assert.equal(hasAdminBasicSession('mm_admin_basic=10'), false)
  assert.equal(hasAdminBasicSession('mm_admin_basic=0; other=1'), false)
})

test('news_manual replacement inserts new rows before deleting old rows', async () => {
  const { client, ops } = makeNewsManualClient()
  const result = await replaceNewsManualBucketRows(client, ['market_ticker'], [
    { bucket: 'market_ticker', title: 'A', sort_order: 1 },
  ])

  assert.equal(result.inserted, 1)
  assert.deepEqual(ops.map((op) => op.op), ['from', 'insert', 'from', 'delete', 'in', 'lt'])
  assert.equal(ops[1].rows[0].updated_at, ops[5].value)
  assert.equal(ops[5].column, 'updated_at')
})

test('news_manual replacement preserves old rows when insert fails', async () => {
  const { client, ops } = makeNewsManualClient({ insertError: new Error('insert failed') })
  await assert.rejects(
    replaceNewsManualBucketRows(client, ['market_ticker'], [
      { bucket: 'market_ticker', title: 'A', sort_order: 1 },
    ]),
    /insert failed/,
  )

  assert.deepEqual(ops.map((op) => op.op), ['from', 'insert'])
})

test('paid profile checks ignore client-writable legacy aliases', () => {
  assert.equal(isPaidFromUserProfileRow({ is_premium: true }), true)
  assert.equal(isPaidFromUserProfileRow({ subscription_tier: 'premium' }), true)
  assert.equal(isPaidFromUserProfileRow({ is_prime: true, plan_tier: 'prime' }), false)
  assert.equal(isPaidFromUserProfileRow({ prime_member: true, membership_tier: 'pro' }), false)
})
