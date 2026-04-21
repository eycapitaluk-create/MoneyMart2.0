/**
 * 펀드 리스트 심볼 중 MarketStack vs 기타 소스 개수 집계
 * 실행: node scripts/count-fund-source.mjs
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { ETF_SYMBOLS_FROM_XLSX } from '../src/data/etfListFromXlsx.js'

const loadEnv = async () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(f, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch {}
  }
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or key. Set .env.local')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const fundSymbols = ETF_SYMBOLS_FROM_XLSX

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  console.log(`\n📋 펀드 리스트: ${fundSymbols.length}개 심볼`)
  console.log(`   기준: stock_daily_prices (전체 기간) 1건 이상 있는 심볼\n`)

  const symbolToSource = new Map()
  const BATCH = 5
  const PAGE_SIZE = 2000

  for (let i = 0; i < fundSymbols.length; i += BATCH) {
    const batch = fundSymbols.slice(i, i + BATCH)
    let offset = 0
    let hasMore = true
    while (hasMore) {
      const { data, error } = await supabase
        .from('stock_daily_prices')
        .select('symbol,source')
        .in('symbol', batch)
        .order('symbol')
        .order('trade_date', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        console.error('Error:', error)
        return
      }
      const rows = data || []
      for (const row of rows) {
        const sym = String(row?.symbol || '').trim()
        const src = String(row?.source || '').trim() || 'unknown'
        if (!sym) continue
        if (!symbolToSource.has(sym)) symbolToSource.set(sym, new Set())
        symbolToSource.get(sym).add(src)
      }
      hasMore = rows.length >= PAGE_SIZE
      offset += PAGE_SIZE
    }
  }

  const marketstackCount = [...symbolToSource.entries()].filter(([, s]) => s.has('marketstack')).length
  const jpEtfCsvOnly = [...symbolToSource.entries()].filter(([, s]) => s.has('jp_etf_csv') && !s.has('marketstack')).length
  const otherOnly = [...symbolToSource.entries()].filter(([, s]) => !s.has('marketstack') && !s.has('jp_etf_csv')).length
  const multiSource = [...symbolToSource.entries()].filter(([, s]) => s.size > 1).length
  const noData = fundSymbols.filter((s) => !symbolToSource.has(s)).length

  const bySource = {}
  for (const [sym, sources] of symbolToSource) {
    for (const src of sources) {
      if (!bySource[src]) bySource[src] = new Set()
      bySource[src].add(sym)
    }
  }

  console.log('=== 소스별 심볼 수 (1년 내 데이터 있음, unique) ===')
  const sorted = Object.entries(bySource)
    .map(([k, v]) => [k, v.size])
    .sort((a, b) => b[1] - a[1])
  for (const [src, cnt] of sorted) {
    console.log(`  ${src || '(empty)'}: ${cnt}개`)
  }

  // v_stock_latest에 있는 펀드 심볼 수 (실제 화면에 나올 수 있는 것)
  let inVLatest = 0
  for (let i = 0; i < fundSymbols.length; i += 80) {
    const batch = fundSymbols.slice(i, i + 80)
    const { data: latestData } = await supabase
      .from('v_stock_latest')
      .select('symbol')
      .in('symbol', batch)
    inVLatest += (latestData || []).length
  }

  console.log('\n=== 요약 ===')
  console.log(`  펀드 리스트 총: ${fundSymbols.length}개`)
  console.log(`  v_stock_latest에 있음 (화면 표시 가능): ${inVLatest}개`)
  console.log(`  stock_daily_prices에 있음 (전체 기간): ${symbolToSource.size}개`)
  console.log(`  MarketStack 데이터 있음: ${marketstackCount}개`)
  console.log(`  jp_etf_csv만 있음 (MarketStack 없음): ${jpEtfCsvOnly}개`)
  console.log(`  기타 소스만: ${otherOnly}개`)
  console.log(`  데이터 없음: ${noData}개`)
  console.log(`  복수 소스 보유: ${multiSource}개`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
