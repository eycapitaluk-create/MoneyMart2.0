/**
 * 株式分割・逆株式分割後の履歴 OHLC を分割後スケールに揃える。
 *
 * 通常分割（価格 ÷ratio）:
 *   node scripts/apply-stock-split-adjustment.mjs \
 *     --symbols=2558.T,2559.T --ratio=10 --effective-date=2026-06-05 [--dry-run]
 *
 * 逆分割（価格 ×ratio、例: DD 1-for-3 on 2026-06-24）:
 *   node scripts/apply-stock-split-adjustment.mjs \
 *     --symbols=DD --ratio=3 --effective-date=2026-06-24 --reverse [--dry-run]
 *
 * trade_date < effective-date の open/high/low/close を調整、volume は逆方向。
 * 全 source 行が対象（jp_etf_csv / marketstack 等）。
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

const parseFlags = (argv) => {
  const flags = {}
  for (const a of argv) {
    if (!a.startsWith('--')) continue
    const eq = a.indexOf('=')
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1)
    else flags[a.slice(2)] = 'true'
  }
  return flags
}

const scaleNum = (v, factor) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return Number((n * factor).toFixed(4))
}

const scaleVolume = (v, factor) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return Math.round(n * factor)
}

await loadEnv()
const flags = parseFlags(process.argv.slice(2))
const symbols = String(flags.symbols || '')
  .split(/[,，\s]+/)
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean)
const ratio = Number(flags.ratio || 0)
const effectiveDate = String(flags['effective-date'] || flags.effective || '').slice(0, 10)
const dryRun = flags['dry-run'] === 'true' || flags.dry === 'true'
const reverse = flags.reverse === 'true' || flags['reverse-split'] === 'true'
const onlyCloseBelow = flags['only-close-below'] != null ? Number(flags['only-close-below']) : null

if (!symbols.length || !Number.isFinite(ratio) || ratio <= 1 || !effectiveDate) {
  console.error('Usage: --symbols=2558.T,2559.T --ratio=10 --effective-date=2026-06-05 [--reverse] [--only-close-below=55] [--dry-run]')
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })
const priceFactor = reverse ? ratio : 1 / ratio
const volumeFactor = reverse ? 1 / ratio : ratio
const priceOp = reverse ? `×${ratio}` : `÷${ratio}`
const volumeOp = reverse ? `÷${ratio}` : `×${ratio}`

for (const symbol of symbols) {
  const { data: rows, error } = await admin
    .from('stock_daily_prices')
    .select('source,symbol,trade_date,open,high,low,close,volume')
    .eq('symbol', symbol)
    .lt('trade_date', effectiveDate)
    .order('trade_date', { ascending: true })

  if (error) throw error
  let list = Array.isArray(rows) ? rows : []
  if (Number.isFinite(onlyCloseBelow)) {
    list = list.filter((r) => Number(r.close) < onlyCloseBelow)
  }
  console.log(`${symbol}: ${list.length} rows before ${effectiveDate}${Number.isFinite(onlyCloseBelow) ? ` (close < ${onlyCloseBelow})` : ''}`)

  if (dryRun) {
    const sample = list.slice(-3)
    for (const r of sample) {
      console.log('  sample', r.trade_date, 'close', r.close, '→', scaleNum(r.close, priceFactor))
    }
    continue
  }

  let updated = 0
  for (const r of list) {
    const payload = {
      open: scaleNum(r.open, priceFactor),
      high: scaleNum(r.high, priceFactor),
      low: scaleNum(r.low, priceFactor),
      close: scaleNum(r.close, priceFactor),
      volume: r.volume == null ? r.volume : scaleVolume(r.volume, volumeFactor),
    }
    const { error: upErr } = await admin
      .from('stock_daily_prices')
      .update(payload)
      .eq('source', r.source)
      .eq('symbol', r.symbol)
      .eq('trade_date', r.trade_date)
    if (upErr) throw upErr
    updated += 1
  }
  console.log(`${symbol}: updated ${updated} rows (${priceOp} prices, ${volumeOp} volume)`)
}

console.log('Done.')
