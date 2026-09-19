/**
 * SPCX IPO offering price → stock_daily_prices upsert
 *   node scripts/upsert-spcx-ipo-2026-06-11.mjs
 * Env: SUPABASE_URL, SUPABASE_SECRET_KEY | SUPABASE_SERVICE_ROLE_KEY
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

const SOURCE = 'manual_close'
const SYMBOL = 'SPCX'
const TRADE_DATE = '2026-06-11'
const IPO_PRICE = 135

async function main() {
  await loadEnv()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL / service key')

  const fetchedAt = new Date().toISOString()
  const row = {
    source: SOURCE,
    symbol: SYMBOL,
    trade_date: TRADE_DATE,
    open: IPO_PRICE,
    high: IPO_PRICE,
    low: IPO_PRICE,
    close: IPO_PRICE,
    volume: null,
    fetched_at: fetchedAt,
    raw: {
      imported_from: 'upsert-spcx-ipo-2026-06-11.mjs',
      note: 'IPO offering price (user-provided)',
    },
  }

  const supabase = createClient(url, key)
  const { error } = await supabase.from('stock_daily_prices').upsert([row], {
    onConflict: 'source,symbol,trade_date',
  })
  if (error) throw error
  console.log(`Upserted ${SYMBOL} ${TRADE_DATE} close=${IPO_PRICE} (${SOURCE})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
