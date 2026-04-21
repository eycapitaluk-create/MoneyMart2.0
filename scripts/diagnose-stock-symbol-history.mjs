#!/usr/bin/env node
/**
 * 심볼별 stock_daily_prices 소스·최근 종가·fetched_at 확인
 * 사용: node scripts/diagnose-stock-symbol-history.mjs 5803.T
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const symbol = (process.argv[2] || '5803.T').trim().toUpperCase()

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('.env.local 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}

const supabase = createClient(url, key)

const { data: rows, error } = await supabase
  .from('stock_daily_prices')
  .select('source, trade_date, close, fetched_at, raw')
  .eq('symbol', symbol)
  .order('trade_date', { ascending: false })
  .limit(400)

if (error) {
  console.error(error.message)
  process.exit(1)
}

const list = rows || []
const bySource = new Map()
for (const r of list) {
  const s = r.source || '(null)'
  if (!bySource.has(s)) bySource.set(s, [])
  bySource.get(s).push(r)
}

console.log(`Symbol: ${symbol} (최근 ${list.length}행 샘플)\n`)
console.log('소스별 샘플 건수:')
for (const [src, arr] of [...bySource.entries()].sort()) {
  const latest = arr[0]
  console.log(`  ${src}: ${arr.length}행, 최신일 ${latest?.trade_date} close=${latest?.close} fetched_at=${latest?.fetched_at || '—'}`)
}

console.log('\n최근 12행 (날짜 내림차순):')
for (const r of list.slice(0, 12)) {
  const via = r.raw?.imported_via ?? ''
  console.log(
    `  ${r.trade_date} | ${r.source} | close=${r.close} | fetched=${(r.fetched_at || '').slice(0, 19)} | raw.via=${via || '—'}`
  )
}
