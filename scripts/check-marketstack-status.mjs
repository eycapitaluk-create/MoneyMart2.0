#!/usr/bin/env node
/**
 * MarketStack 호출 상태 및 JP 데이터 딜레이 확인
 * 실행: node scripts/check-marketstack-status.mjs
 *
 * - ingestion_jobs: 최근 성공/실패, endpointStats
 * - stock_daily_prices: JP 심볼(.T)의 marketstack source 최신 trade_date → MarketStack 실제 제공 날짜
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

console.log('=== ingestion_jobs (최근 5건) ===\n')

const { data: jobs, error: jobsErr } = await supabase
  .from('ingestion_jobs')
  .select('id,status,started_at,finished_at,rows_processed,error_message,meta')
  .eq('source', 'marketstack')
  .eq('dataset', 'stock_daily_prices')
  .order('started_at', { ascending: false })
  .limit(5)

if (jobsErr) {
  console.error('ingestion_jobs error:', jobsErr.message)
} else {
  for (const j of jobs || []) {
    console.log(`[${j.status}] ${j.started_at?.slice(0, 19)} | rows: ${j.rows_processed ?? '-'} | ${j.error_message || 'OK'}`)
    if (j.meta?.endpointStats) {
      console.log('  endpointStats:', JSON.stringify(j.meta.endpointStats))
    }
    if (j.meta?.qualitySummary) {
      console.log('  quality:', `accepted=${j.meta.qualitySummary.acceptedPriceRows} dropped=${j.meta.qualitySummary.droppedPriceRows}`)
    }
    console.log('')
  }
}

console.log('=== JP 심볼(.T) marketstack 최신 trade_date (딜레이 확인) ===\n')

const { data: jpLatest, error: jpErr } = await supabase
  .from('stock_daily_prices')
  .select('symbol,trade_date')
  .eq('source', 'marketstack')
  .like('symbol', '%.T')
  .limit(10000)

if (jpErr) {
  console.error('stock_daily_prices error:', jpErr.message)
} else {
  const byDate = new Map()
  for (const r of jpLatest || []) {
    const d = r.trade_date
    if (!byDate.has(d)) byDate.set(d, 0)
    byDate.set(d, byDate.get(d) + 1)
  }
  const sorted = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const maxDate = sorted[0]?.[0]
  console.log(`JP(.T) marketstack source 최신 날짜: ${maxDate} (${sorted[0]?.[1]}건)`)
  console.log('\n날짜별 건수:')
  for (const [d, cnt] of sorted.slice(0, 7)) {
    console.log(`  ${d}: ${cnt}건`)
  }
  console.log('\n→ JP 청크는 eod/{JP날짜}&exchange=XTKS로 날짜 지정 조회. 실패 시 /latest fallback.')
}
