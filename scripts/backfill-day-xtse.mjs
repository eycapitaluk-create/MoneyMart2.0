#!/usr/bin/env node
/**
 * DAY.XTSE (Dayforce on Toronto Stock Exchange) 1년치 데이터 Marketstack에서 수집 후 저장
 * 실행: node scripts/backfill-day-xtse.mjs
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
const marketstackKey = process.env.MARKETSTACK_ACCESS_KEY || process.env.MARKETSTACK_APIKEY || process.env.MARKETSTACK_API_KEY

if (!supabaseUrl || !serviceKey || !marketstackKey) {
  console.error('Missing env. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MARKETSTACK_ACCESS_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

const toDateOnly = (v) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const getJson = async (url, init) => {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  const dateTo = new Date()
  const dateFrom = new Date()
  dateFrom.setFullYear(dateFrom.getFullYear() - 1)
  const fromStr = dateFrom.toISOString().slice(0, 10)
  const toStr = dateTo.toISOString().slice(0, 10)

  console.log(`Fetching DAY.XTSE from ${fromStr} to ${toStr}...`)

  const authQuery = `access_key=${encodeURIComponent(marketstackKey)}&`
  const url = `https://api.marketstack.com/v2/eod?${authQuery}symbols=DAY&exchange=XTSE&date_from=${fromStr}&date_to=${toStr}&limit=1000&sort=ASC`
  const json = await getJson(url)
  const rows = Array.isArray(json?.data) ? json.data : []

  if (rows.length === 0) {
    console.error('No data returned from Marketstack. Check DAY (exchange=XTSE) availability.')
    if (json?.error) console.error('API error:', json.error)
    process.exit(1)
  }

  console.log(`Got ${rows.length} rows. Upserting as symbol DAY...`)

  const symbolRows = [{ symbol: 'DAY', name: 'Dayforce', exchange: 'XTSE', currency: 'CAD', is_active: true }]
  const priceRows = rows
    .filter((r) => r?.close != null && Number(r.close) > 0)
    .map((r) => ({
      source: 'marketstack',
      symbol: 'DAY',
      trade_date: toDateOnly(r?.date),
      open: r?.open != null ? Number(r.open) : null,
      high: r?.high != null ? Number(r.high) : null,
      low: r?.low != null ? Number(r.low) : null,
      close: Number(r.close),
      volume: r?.volume != null ? Number(r.volume) : null,
      raw: r,
    }))
    .filter((r) => r.trade_date)

  const { error: symErr } = await supabase.from('stock_symbols').upsert(symbolRows, { onConflict: 'symbol' })
  if (symErr) throw symErr

  const { error: priceErr } = await supabase
    .from('stock_daily_prices')
    .upsert(priceRows, { onConflict: 'source,symbol,trade_date' })
  if (priceErr) throw priceErr

  console.log(`Done. Upserted ${priceRows.length} price rows for DAY (XTSE).`)
}

const isMain = process.argv[1]?.includes('backfill-day-xtse')
if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
export { main }
