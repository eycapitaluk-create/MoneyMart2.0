/**
 * stockList400.js 심볼 vs stock_daily_prices DB 커버리지 검증
 * 실행: node scripts/check-stock-list-coverage.mjs
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { STOCK_LIST_400 } from '../src/data/stockList400.js'

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
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const listSymbols = STOCK_LIST_400.map((r) => r.symbol)
  const uniqueList = [...new Set(listSymbols)]

  console.log(`\n📋 stockList400.js: ${uniqueList.length}개 심볼`)

  // v_stock_latest 또는 stock_daily_prices에서 최신 데이터 있는 심볼 조회
  const chunk = (arr, size) => {
    const out = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }
  const batches = chunk(uniqueList, 80)

  // stock_daily_prices에서 symbol별로 최소 1건 있는지 확인
  const hasData = new Set()
  for (const batch of batches) {
    const { data, error } = await supabase
      .from('stock_daily_prices')
      .select('symbol')
      .in('symbol', batch)
      .eq('source', 'marketstack')
      .limit(100000)
    if (error) throw error
    ;(data || []).forEach((r) => hasData.add(r.symbol))
  }

  const missing = uniqueList.filter((s) => !hasData.has(s))
  const ok = uniqueList.filter((s) => hasData.has(s))

  const byRegion = {}
  for (const s of uniqueList) {
    const row = STOCK_LIST_400.find((r) => r.symbol === s)
    const region = row?.region || '?'
    byRegion[region] = byRegion[region] || { total: 0, ok: 0, missing: 0 }
    byRegion[region].total++
    if (hasData.has(s)) byRegion[region].ok++
    else byRegion[region].missing++
  }

  console.log(`\n✅ DB에 데이터 있음: ${ok.length}개`)
  console.log(`❌ DB에 데이터 없음: ${missing.length}개`)

  if (Object.keys(byRegion).length > 0) {
    console.log('\n📊 리전별:')
    for (const [region, stats] of Object.entries(byRegion)) {
      const pct = stats.total ? ((stats.ok / stats.total) * 100).toFixed(1) : 0
      console.log(`   ${region}: ${stats.ok}/${stats.total} (${pct}%)`)
    }
  }

  if (missing.length > 0) {
    console.log('\n❌ 데이터 없는 심볼 (최대 50개):')
    missing.slice(0, 50).forEach((s) => console.log(`   ${s}`))
    if (missing.length > 50) console.log(`   ... 외 ${missing.length - 50}개`)
  }

  const pctTotal = uniqueList.length ? ((ok.length / uniqueList.length) * 100).toFixed(1) : 0
  console.log(`\n📈 전체 커버리지: ${ok.length}/${uniqueList.length} (${pctTotal}%)\n`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
