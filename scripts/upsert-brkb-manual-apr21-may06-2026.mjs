/**
 * BRK.B Yahoo 相当 OHLC（ユーザー提供）→ stock_daily_prices upsert
 *   node scripts/upsert-brkb-manual-apr21-may06-2026.mjs
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

/** [trade_date, open, high, low, close] — 2026-04-21 〜 */
const BRKB_ROWS = [
  ['2026-04-21', 472.54, 474.19, 468.06, 468.5],
  ['2026-04-22', 468.86, 470.99, 464.62, 465.4],
  ['2026-04-23', 466.72, 473.0, 466.72, 470.55],
  ['2026-04-24', 468.8, 470.28, 466.58, 469.32],
  ['2026-04-27', 469.8, 475.5, 469.35, 472.81],
  ['2026-04-28', 476.79, 479.77, 475.67, 478.16],
  ['2026-04-29', 476.45, 477.97, 474.51, 475.38],
  ['2026-04-30', 473.46, 477.55, 470.89, 473.6],
  ['2026-05-01', 475.08, 479.1, 473.0, 473.01],
  ['2026-05-04', 473.03, 479.87, 465.79, 468.52],
  ['2026-05-05', 468.53, 469.66, 464.34, 465.52],
  ['2026-05-06', 466.01, 470.63, 465.64, 469.83],
]

const SOURCE = 'manual_close'
const SYMBOL = 'BRK.B'

async function main() {
  await loadEnv()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL / service key')

  const fetchedAt = new Date().toISOString()
  const priceRows = BRKB_ROWS.map(([trade_date, open, high, low, close]) => ({
    source: SOURCE,
    symbol: SYMBOL,
    trade_date,
    open,
    high,
    low,
    close,
    volume: null,
    fetched_at: fetchedAt,
    raw: { imported_from: 'upsert-brkb-manual-apr21-may06-2026.mjs', user_chart: true },
  }))

  const supabase = createClient(url, key)
  const { error } = await supabase.from('stock_daily_prices').upsert(priceRows, {
    onConflict: 'source,symbol,trade_date',
  })
  if (error) throw error
  console.log(`Upserted ${priceRows.length} rows for ${SYMBOL} (${SOURCE}), ${priceRows[0].trade_date} … ${priceRows.at(-1).trade_date}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
