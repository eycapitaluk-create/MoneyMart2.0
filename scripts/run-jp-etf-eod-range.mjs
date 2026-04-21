#!/usr/bin/env node
/**
 * JP上場ETF (marketstack-daily の jp_etf_only と同じ銘柄集合) を、指定した各暦日の XTKS EOD で埋める。
 * 欠損区間のバックフィル用。英語週末はスキップ（東証休場に近いが、振替休日は API 側で空振りしうる）。
 *
 * Usage:
 *   node scripts/run-jp-etf-eod-range.mjs [date_from] [date_to]
 *   node scripts/run-jp-etf-eod-range.mjs 2026-02-17 2026-03-28
 *
 * Env: .env.local — CRON_SECRET, SUPABASE_*, MARKETSTACK_ACCESS_KEY
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

try {
  const envPath = resolve(process.cwd(), '.env.local')
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

process.env.MARKETSTACK_MAX_SYMBOLS = process.env.MARKETSTACK_MAX_SYMBOLS ?? '0'

function* weekdayUtcDates(isoFrom, isoTo) {
  const d = new Date(`${isoFrom}T12:00:00Z`)
  const end = new Date(`${isoTo}T12:00:00Z`)
  while (d <= end) {
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) yield d.toISOString().slice(0, 10)
    d.setUTCDate(d.getUTCDate() + 1)
  }
}

const dateFrom = process.argv[2] || '2026-02-17'
const dateTo = process.argv[3] || '2026-03-28'
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
  console.error('Usage: node scripts/run-jp-etf-eod-range.mjs YYYY-MM-DD YYYY-MM-DD')
  process.exit(1)
}

const handler = (await import('../api/cron/marketstack-daily.js')).default

let ok = 0
let skipped = 0
let failed = 0

for (const tradeDate of weekdayUtcDates(dateFrom, dateTo)) {
  const params = new URLSearchParams({
    force: '1',
    jp_etf_only: '1',
    jp_only: '1',
    us_only: '0',
    trade_date: tradeDate,
  })
  const req = {
    url: `/api/cron/marketstack-daily?${params.toString()}`,
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }
  let body
  const res = {
    _status: 200,
    status(code) {
      this._status = code
      return this
    },
    json(b) {
      body = b
      return this
    },
  }
  try {
    await handler(req, res)
  } catch (e) {
    failed += 1
    console.error(`[${tradeDate}] ERROR`, e?.message || e)
    continue
  }
  const b = body || {}
  if (b.skipped) {
    skipped += 1
    console.log(`[${tradeDate}] skipped:`, b.reason || b.budget_mode || JSON.stringify(b))
  } else if (b.ok === false) {
    failed += 1
    console.log(`[${tradeDate}] failed:`, b.error || JSON.stringify(b))
  } else {
    ok += 1
    console.log(`[${tradeDate}] ok rows=${b.rows_processed ?? '—'} chunks=${b.chunks ?? '—'}`)
  }
  await new Promise((r) => setTimeout(r, 4000))
}

console.log('\nDone.', { ok, skipped, failed })
