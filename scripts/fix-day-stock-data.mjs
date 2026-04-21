#!/usr/bin/env node
/**
 * DAY (Dayforce) 주식 데이터 수정
 * 1. 비정상 가격(close > 200 or < 10) 삭제
 * 2. Marketstack에서 DAY 재수집
 *
 * 실행: node scripts/fix-day-stock-data.mjs
 * .env.local 필요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, MARKETSTACK_ACCESS_KEY
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
  // 1. DAY 비정상 데이터 확인 및 삭제 (DAY ~$70, 10~200 범위 밖은 삭제)
  const { data: badRows, error: selectErr } = await supabase
    .from('stock_daily_prices')
    .select('id,symbol,trade_date,close')
    .eq('symbol', 'DAY')
    .or('close.gt.200,close.lt.10')

  if (selectErr) {
    console.error('Select error:', selectErr)
    process.exit(1)
  }

  if (badRows?.length > 0) {
    console.log(`Deleting ${badRows.length} bad DAY rows (close > 200 or < 10):`)
    badRows.forEach((r) => console.log(`  ${r.trade_date} close=${r.close}`))

    const ids = badRows.map((r) => r.id).filter(Boolean)
    const { error: deleteErr } = await supabase
      .from('stock_daily_prices')
      .delete()
      .in('id', ids)

    if (deleteErr) {
      console.error('Delete error:', deleteErr)
      process.exit(1)
    }
    console.log('Deleted.')
  } else {
    console.log('No bad DAY rows found (all close in 10-200 range).')
  }

  // 2. 전체 DAY 데이터 삭제 후 재수집 (비정상 데이터가 많을 수 있으므로)
  const { data: allDay, error: allErr } = await supabase
    .from('stock_daily_prices')
    .select('id')
    .eq('symbol', 'DAY')

  if (!allErr && allDay?.length > 0) {
    console.log(`Deleting all ${allDay.length} DAY rows for fresh re-fetch...`)
    const { error: delAllErr } = await supabase
      .from('stock_daily_prices')
      .delete()
      .eq('symbol', 'DAY')
    if (delAllErr) {
      console.error('Delete all error:', delAllErr)
    } else {
      console.log('All DAY rows deleted.')
    }
  }

  // 3. DAY.XTSE 1년치 백필 (Marketstack exchange=XTSE)
  console.log('Running backfill-day-xtse for 1 year of DAY (XTSE) data...')
  const { main: runBackfill } = await import('./backfill-day-xtse.mjs')
  await runBackfill()
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
