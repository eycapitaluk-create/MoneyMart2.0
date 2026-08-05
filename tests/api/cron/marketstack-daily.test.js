import test from 'node:test'
import assert from 'node:assert/strict'

import { __marketstackDailyTestInternals } from '../../../api/cron/marketstack-daily.js'

const { fetchChunkRows } = __marketstackDailyTestInternals

test('fetchChunkRows uses EOD data for US daily ingestion', async () => {
  const originalFetch = globalThis.fetch
  const urls = []

  globalThis.fetch = async (url) => {
    const requestUrl = String(url)
    urls.push(requestUrl)

    if (requestUrl.includes('/v2/eod/2026-05-29')) {
      return new Response(JSON.stringify({
        data: [
          {
            symbol: 'AAPL',
            date: '2026-05-29T00:00:00+0000',
            open: 199,
            high: 204,
            low: 198,
            close: 203,
            volume: 123456789,
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await fetchChunkRows('marketstack-key', ['AAPL'], {
      usTradeDateOverride: '2026-05-29',
    })

    assert.equal(result.endpoint, 'v2:eod:2026-05-29:query')
    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].close, 203)
    assert.ok(urls.some((url) => url.includes('/v2/eod/2026-05-29')))
    assert.ok(urls.every((url) => !url.includes('/intraday/')))
  } finally {
    globalThis.fetch = originalFetch
  }
})
