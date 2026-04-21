/**
 * 펀드 리스트 ∩ v_stock_latest 중 3월 14일 trade_date로 fetch된 개수
 * 실행: node scripts/count-fund-mar14.mjs
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
  const TARGET_DATE = '2025-03-14'

  // 1) v_stock_latest에 있는 펀드 심볼
  const inVLatest = new Set()
  for (let i = 0; i < fundSymbols.length; i += 80) {
    const batch = fundSymbols.slice(i, i + 80)
    const { data } = await supabase
      .from('v_stock_latest')
      .select('symbol')
      .in('symbol', batch)
    for (const row of data || []) {
      if (row?.symbol) inVLatest.add(String(row.symbol).trim())
    }
  }

  // 2) stock_daily_prices에서 3월 14일 trade_date로 fetch된 펀드 심볼
  const mar14Symbols = new Set()
  for (let i = 0; i < fundSymbols.length; i += 80) {
    const batch = fundSymbols.slice(i, i + 80)
    const { data } = await supabase
      .from('stock_daily_prices')
      .select('symbol')
      .in('symbol', batch)
      .eq('trade_date', TARGET_DATE)
    for (const row of data || []) {
      if (row?.symbol) mar14Symbols.add(String(row.symbol).trim())
    }
  }

  // 3) v_stock_latest에 있지만 3월 14일 데이터 없는 것 (제거 대상)
  const noMar14 = [...inVLatest].filter((s) => !mar14Symbols.has(s)).sort()

  console.log(`\n📋 펀드 리스트: ${fundSymbols.length}개`)
  console.log(`   v_stock_latest에 있는 펀드: ${inVLatest.size}개`)
  console.log(`   stock_daily_prices에 3월 14일(trade_date) 데이터 있는 펀드: ${mar14Symbols.size}개`)
  console.log(`\n❌ 3월 14일 데이터 없음 (제거 후보): ${noMar14.length}개`)
  console.log(noMar14.join(', '))
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
