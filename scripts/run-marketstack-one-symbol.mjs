#!/usr/bin/env node
import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

const symbol = process.argv[2] || 'AAPL'
const tradeDate = process.argv[3] || ''
const handler = (await import('../api/cron/marketstack-daily.js')).default

const query = new URLSearchParams({
  force: '1',
  us_only: '1',
  symbols: symbol,
})
if (tradeDate) query.set('trade_date', tradeDate)

const req = {
  url: `/api/cron/marketstack-daily?${query.toString()}`,
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
}
const res = {
  _status: 200,
  status(code) {
    this._status = code
    return this
  },
  json(body) {
    console.log('Status:', this._status)
    console.log(JSON.stringify(body, null, 2))
    return this
  },
}

await handler(req, res)
