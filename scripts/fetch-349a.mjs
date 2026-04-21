/**
 * 349A.T 단일 심볼 데이터 조회
 * 실행: node scripts/fetch-349a.mjs
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

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
  const symbol = '349A.T'

  console.log(`\n🔍 ${symbol} 데이터 조회\n`)

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const { data: latest, error: latestErr } = await supabase
    .from('v_stock_latest')
    .select('symbol,trade_date,open,high,low,close,volume')
    .eq('symbol', symbol)
    .limit(1)

  if (latestErr) {
    console.error('v_stock_latest error:', latestErr)
    return
  }
  console.log('v_stock_latest:', latest?.length ? latest[0] : '(없음)')

  const { data: history, error: histErr } = await supabase
    .from('stock_daily_prices')
    .select('symbol,trade_date,close,volume,source')
    .eq('symbol', symbol)
    .gte('trade_date', cutoffStr)
    .order('trade_date', { ascending: true })
    .limit(400)

  if (histErr) {
    console.error('stock_daily_prices error:', histErr)
    return
  }

  console.log(`\nstock_daily_prices (${cutoffStr}~): ${history?.length || 0}건`)
  if (history?.length) {
    const first = history[0]
    const last = history[history.length - 1]
    const spanDays = Math.floor((new Date(last.trade_date) - new Date(first.trade_date)) / (1000 * 60 * 60 * 24))
    const closeFirst = Number(first.close)
    const closeLast = Number(last.close)
    const return1y = closeFirst > 0 ? ((closeLast - closeFirst) / closeFirst) * 100 : null
    console.log(`  첫 거래일: ${first.trade_date} close=${first.close}`)
    console.log(`  최근 거래일: ${last.trade_date} close=${last.close}`)
    console.log(`  기간: ${spanDays}일`)
    console.log(`  1년 리턴: ${return1y != null ? `${return1y.toFixed(1)}%` : 'N/A'}`)
    console.log(`  source: ${[...new Set(history.map((r) => r.source))].join(', ')}`)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
