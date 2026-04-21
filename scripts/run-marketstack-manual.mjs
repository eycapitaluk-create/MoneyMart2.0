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

const handler = (await import('../api/cron/marketstack-daily.js')).default

const args = process.argv.slice(2)
const getArg = (name, fallback = '') => {
  const idx = args.indexOf(name)
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1]
  return fallback
}
const hasArg = (name) => args.includes(name)

const query = new URLSearchParams()
query.set('force', hasArg('--force') ? '1' : getArg('--force', '0'))
if (hasArg('--us-only')) query.set('us_only', '1')
if (hasArg('--jp-only')) query.set('jp_only', '1')
if (hasArg('--jp-etf-only')) query.set('jp_etf_only', '1')
const symbols = getArg('--symbols')
if (symbols) query.set('symbols', symbols)
const tradeDate = getArg('--trade-date')
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
