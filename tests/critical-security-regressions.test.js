import test from 'node:test'
import assert from 'node:assert/strict'

import { hasAdminBasicSessionCookie } from '../api/admin/basic-auth.js'
import summarizeHandler from '../api/cron/ai-news-summarize.js'
import { replaceAiNewsSummaryRows } from '../api/cron/ai-news.js'
import { replaceNewsManualBucketRows } from '../api/_lib/refresh-market-news.js'
import { isPaidFromUserProfileRow } from '../src/lib/membership.js'

function mockJsonResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
}

test('admin basic session cookie requires exact cookie name and value', () => {
  assert.equal(hasAdminBasicSessionCookie('mm_admin_basic=1'), true)
  assert.equal(hasAdminBasicSessionCookie('foo=bar; mm_admin_basic=1; theme=dark'), true)
  assert.equal(hasAdminBasicSessionCookie('mm_admin_basic=10'), false)
  assert.equal(hasAdminBasicSessionCookie('other=mm_admin_basic=1'), false)
})

test('ai-news-summarize fails closed when CRON_SECRET is missing', async () => {
  const previous = process.env.CRON_SECRET
  delete process.env.CRON_SECRET
  try {
    const res = mockJsonResponse()
    await summarizeHandler({ headers: { authorization: 'Bearer undefined' } }, res)
    assert.equal(res.statusCode, 500)
    assert.equal(res.payload?.error, 'CRON_SECRET is required')
  } finally {
    if (previous == null) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  }
})

test('manual news replacement inserts new rows before pruning old rows', async () => {
  const calls = []
  const client = {
    from(table) {
      assert.equal(table, 'news_manual')
      return {
        async insert(rows) {
          calls.push(['insert', rows])
          return { error: null }
        },
        delete() {
          calls.push(['delete'])
          return {
            in(column, buckets) {
              calls.push(['in', column, buckets])
              return {
                or(filter) {
                  calls.push(['or', filter])
                  return {
                    async select(columns) {
                      calls.push(['select', columns])
                      return { data: [{ id: 1 }], error: null }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  const result = await replaceNewsManualBucketRows(
    client,
    ['market_ticker'],
    [{ bucket: 'market_ticker', title: 'next' }],
    '2026-07-10T11:00:00.000Z',
  )

  assert.deepEqual(result, { inserted: 1, pruned: 1 })
  assert.equal(calls[0][0], 'insert')
  assert.equal(calls[1][0], 'delete')
  assert.equal(calls[0][1][0].updated_at, '2026-07-10T11:00:00.000Z')
  assert.match(calls.find((call) => call[0] === 'or')?.[1], /updated_at\.lt\.2026-07-10/)
})

test('manual news replacement does not delete old rows if insert fails', async () => {
  const calls = []
  const client = {
    from() {
      return {
        async insert() {
          calls.push('insert')
          return { error: new Error('insert failed') }
        },
        delete() {
          calls.push('delete')
          return {}
        },
      }
    },
  }

  await assert.rejects(
    replaceNewsManualBucketRows(client, ['market_ticker'], [{ bucket: 'market_ticker' }]),
    /insert failed/,
  )
  assert.deepEqual(calls, ['insert'])
})

test('ai news replacement inserts active rows before deactivating older rows', async () => {
  const calls = []
  const admin = {
    from(table) {
      assert.equal(table, 'ai_news_summaries')
      return {
        async insert(rows) {
          calls.push(['insert', rows])
          return { error: null }
        },
        update(values) {
          calls.push(['update', values])
          return {
            eq(column, value) {
              calls.push(['eq', column, value])
              return {
                lt(column, value) {
                  calls.push(['lt', column, value])
                  return {
                    async select(columns) {
                      calls.push(['select', columns])
                      return { data: [{ id: 1 }, { id: 2 }], error: null }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  const result = await replaceAiNewsSummaryRows(
    admin,
    [{ headline: 'next', is_active: false }],
    '2026-07-10T11:00:00.000Z',
  )

  assert.deepEqual(result, { inserted: 1, deactivated: 2 })
  assert.equal(calls[0][0], 'insert')
  assert.equal(calls[1][0], 'update')
  assert.equal(calls[0][1][0].is_active, true)
  assert.equal(calls[0][1][0].updated_at, '2026-07-10T11:00:00.000Z')
  assert.deepEqual(calls.find((call) => call[0] === 'lt'), ['lt', 'updated_at', '2026-07-10T11:00:00.000Z'])
})

test('paid profile helper ignores client-writable plan aliases', () => {
  assert.equal(isPaidFromUserProfileRow({ plan_tier: 'premium', membership_tier: 'prime' }), false)
  assert.equal(isPaidFromUserProfileRow({ is_prime: true, prime_member: true }), false)
  assert.equal(isPaidFromUserProfileRow({ is_premium: true }), true)
  assert.equal(isPaidFromUserProfileRow({ subscription_tier: 'premium' }), true)
})
