#!/usr/bin/env node
/**
 * marketstack-daily cron 로컬 실행
 *
 * 실행 예:
 *   node scripts/run-marketstack-daily.mjs
 *   node scripts/run-marketstack-daily.mjs jp 2026-03-30
 *   node scripts/run-marketstack-daily.mjs jp-etf 2026-04-01   # 日本上場ETFのみ指定日で再取得
 *   node scripts/run-marketstack-daily.mjs us 2026-03-28
 *
 * .env.local 에 CRON_SECRET, SUPABASE_*, MARKETSTACK_ACCESS_KEY 필요
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

// env에 없으면 0 (전체)
process.env.MARKETSTACK_MAX_SYMBOLS = process.env.MARKETSTACK_MAX_SYMBOLS ?? '0'

const scopeArg = (process.argv[2] || '').toLowerCase()
const dateArg = process.argv[3] || ''
const isJpEtf = scopeArg === 'jp-etf' || scopeArg === 'jp_etf' || scopeArg === 'jpetf'
const isJp = scopeArg === 'jp' || scopeArg === 'japan' || isJpEtf
const isUs = scopeArg === 'us' || scopeArg === 'usa'

const params = new URLSearchParams({ force: '1' })
if (isJpEtf) {
  params.set('jp_etf_only', '1')
  params.set('jp_only', '1')
  params.set('us_only', '0')
} else if (isJp) {
  params.set('jp_only', '1')
  params.set('us_only', '0')
} else if (isUs) {
  params.set('us_only', '1')
  params.set('jp_only', '0')
}
if (/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  params.set('trade_date', dateArg)
}

const handler = (await import('../api/cron/marketstack-daily.js')).default

const req = {
  url: `/api/cron/marketstack-daily?${params.toString()}`,
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
