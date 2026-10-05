/**
 * Write issuer expense ratios and AUM onto stock_symbols for US-listed ETFs.
 * trust_fee is the prospectus expense ratio in percent (0.03 = 0.03%).
 * aum is yen: published USD net assets × USD/JPY on or before the figure's date.
 * Does not set nisa_category.
 *
 *   node scripts/apply-us-listed-etf-fee-aum.mjs
 *   node scripts/apply-us-listed-etf-fee-aum.mjs --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { US_LISTED_ETFS } from '../src/data/usListedEtfUniverse.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const eq = t.indexOf('=')
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (k && process.env[k] == null) process.env[k] = v
    }
  } catch {}
}

loadEnv(path.join(ROOT, '.env.local'))
loadEnv(path.join(ROOT, '.env'))

/** USD net assets and expense ratio from the issuer page or prospectus. */
const OFFICIAL = {
  VOO: { trustFee: 0.03, aumUsd: 978_960_000_000, asOf: '2026-06-30' },
  QQQ: { trustFee: 0.18, aumUsd: 371_121_437_386, asOf: '2026-03-31' },
  VTI: { trustFee: 0.03, aumUsd: 663_488_000_000, asOf: '2026-06-30' },
  VT: { trustFee: 0.06, aumUsd: 77_627_000_000, asOf: '2026-06-30' },
  VEA: { trustFee: 0.03, aumUsd: 238_100_000_000, asOf: '2026-08-31' },
  VWO: { trustFee: 0.06, aumUsd: 127_300_000_000, asOf: '2026-08-31' },
  VNQ: { trustFee: 0.13, aumUsd: 38_100_000_000, asOf: '2026-08-31' },
  BND: { trustFee: 0.03, aumUsd: 163_300_000_000, asOf: '2026-08-31' },
  LQD: { trustFee: 0.14, aumUsd: 27_312_483_080, asOf: '2026-09-24' },
  IEF: { trustFee: 0.15, aumUsd: 41_422_981_390, asOf: '2026-09-24' },
}

async function fxOnOrBefore(sb, iso) {
  const { data, error } = await sb
    .from('fx_daily_usdjpy')
    .select('as_of_date, usd_jpy')
    .lte('as_of_date', iso)
    .order('as_of_date', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = data?.[0]
  const rate = Number(row?.usd_jpy)
  if (!(rate > 0)) return null
  return { rate, asOf: String(row.as_of_date).slice(0, 10) }
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing supabase env')
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const symbols = US_LISTED_ETFS.map((row) => row.symbol)
  const { data: existing, error: existErr } = await sb
    .from('stock_symbols')
    .select('symbol')
    .in('symbol', symbols)
  if (existErr) throw existErr
  const have = new Set((existing || []).map((row) => row.symbol))

  const fxCache = new Map()
  let updated = 0
  for (const row of US_LISTED_ETFS) {
    const official = OFFICIAL[row.symbol]
    if (!official) throw new Error(`Missing official row ${row.symbol}`)
    if (!have.has(row.symbol)) {
      console.log(`SKIP missing symbol ${row.symbol}`)
      continue
    }
    if (!fxCache.has(official.asOf)) fxCache.set(official.asOf, await fxOnOrBefore(sb, official.asOf))
    const fx = fxCache.get(official.asOf)
    if (!fx) {
      console.log(`SKIP no FX ${row.symbol} ${official.asOf}`)
      continue
    }
    const aumYen = Math.round(official.aumUsd * fx.rate)
    console.log(`${row.symbol} fee=${official.trustFee} aumYen=${aumYen} fx=${fx.rate} (${fx.asOf})`)
    if (DRY) continue
    const { error } = await sb
      .from('stock_symbols')
      .update({
        trust_fee: official.trustFee,
        aum: aumYen,
        category: row.category,
        country: row.country,
      })
      .eq('symbol', row.symbol)
    if (error) throw error
    updated += 1
  }
  console.log(DRY ? 'dry-run' : `updated ${updated}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
