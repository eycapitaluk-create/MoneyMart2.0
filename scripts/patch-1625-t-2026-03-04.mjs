#!/usr/bin/env node
/**
 * One-off: 1625.T 2026-03-04 OHLCV from verified table (user screenshot).
 * Uses marketstack source so JP StockPage / history queries (.in('source', JP_EOD_SOURCES)) see it.
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const loadEnv = () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const raw = fs.readFileSync(f, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const i = t.indexOf('=')
        const k = t.slice(0, i).trim()
        let v = t.slice(i + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (k && process.env[k] == null) process.env[k] = v
      }
    } catch {
      /* ignore */
    }
  }
}

loadEnv()
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)')
  process.exit(1)
}

const sb = createClient(url, key)
const row = {
  source: 'marketstack',
  symbol: '1625.T',
  trade_date: '2026-03-04',
  open: 51310,
  high: 52270,
  low: 50130,
  close: 50130,
  volume: 1008,
  raw: { patched_from: 'manual_table', script: 'patch-1625-t-2026-03-04.mjs' },
  fetched_at: new Date().toISOString(),
}
const { error } = await sb.from('stock_daily_prices').upsert(row, { onConflict: 'source,symbol,trade_date' })
if (error) {
  console.error(error)
  process.exit(1)
}
console.log('OK: upserted 1625.T 2026-03-04 (marketstack)')
