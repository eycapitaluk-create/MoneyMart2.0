#!/usr/bin/env node
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

const usProbe = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'SPY', 'QQQ', 'IVV']

const { data: probe, error: probeErr } = await supabase
  .from('stock_daily_prices')
  .select('symbol,trade_date,close,source')
  .eq('source', 'marketstack')
  .in('symbol', usProbe)
  .order('trade_date', { ascending: false })
  .limit(100)

if (probeErr) {
  console.error('probe error:', probeErr.message)
  process.exit(1)
}

const latestDate = [...new Set((probe || []).map((r) => r.trade_date))][0] || null
console.log('US probe latest trade_date:', latestDate)

const latestBySymbol = {}
for (const row of probe || []) {
  if (!latestBySymbol[row.symbol]) latestBySymbol[row.symbol] = row
}

for (const symbol of usProbe) {
  const row = latestBySymbol[symbol]
  console.log(`${symbol}:`, row ? `${row.trade_date} close=${row.close}` : 'missing')
}

if (latestDate) {
  const { count, error: countErr } = await supabase
    .from('stock_daily_prices')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'marketstack')
    .eq('trade_date', latestDate)
    .not('symbol', 'like', '%.T')

  if (countErr) {
    console.error('count error:', countErr.message)
    process.exit(1)
  }

  console.log('Rows on latestDate (source=marketstack, symbol not like %.T):', count)
}
