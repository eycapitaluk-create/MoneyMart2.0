/**
 * jp_etf_*_with_aum.xlsx（列: symbol, …, aum_oku_yen）→ stock_symbols.aum（円）
 *
 * aum_oku_yen は「億円」の数値とみなし、DB には numeric 円で aum = oku * 1e8 を保存
 * （FundPage formatAum と Transformed_ETF CSV の aum 円 と整合）
 *
 *   node scripts/update-aum-from-jp-etf-xlsx.mjs /path/to.xlsx [--dry-run]
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

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

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

const norm = (h) => String(h || '').trim().toLowerCase()

const run = async () => {
  await loadEnv()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const xlsxPath = args[0]
  const dryRun = process.argv.includes('--dry-run')

  if (!url || !key) throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  if (!xlsxPath) {
    console.error('Usage: node scripts/update-aum-from-jp-etf-xlsx.mjs <file.xlsx> [--dry-run]')
    process.exit(1)
  }

  const wb = XLSX.readFile(path.resolve(xlsxPath), { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const header = matrix[0] || []
  const symIdx = header.findIndex((h) => norm(h) === 'symbol')
  const dateIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'trade_date' || x === 'date'
  })
  const aumIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'aum_oku_yen' || x === 'aum_oku' || x === 'aum'
  })

  if (symIdx < 0 || aumIdx < 0) {
    throw new Error(`symbol / aum_oku_yen 列が必要です。ヘッダー: ${header.join(', ')}`)
  }

  /** symbol -> { oku, tradeDate } 最新 trade_date を採用 */
  const best = new Map()
  for (let r = 1; r < matrix.length; r += 1) {
    const row = matrix[r]
    if (!row?.length) continue
    const symbol = String(row[symIdx] || '').trim().toUpperCase()
    const oku = toNum(row[aumIdx])
    if (!symbol || oku == null || oku <= 0) continue
    let tradeDate = ''
    if (dateIdx >= 0) {
      const c = row[dateIdx]
      if (c instanceof Date && !Number.isNaN(c.getTime())) tradeDate = c.toISOString().slice(0, 10)
      else tradeDate = String(c || '').trim().slice(0, 10)
    }
    const prev = best.get(symbol)
    if (!prev || (tradeDate && (!prev.tradeDate || tradeDate > prev.tradeDate))) {
      best.set(symbol, { oku, tradeDate })
    } else if (!tradeDate && prev && !prev.tradeDate) {
      best.set(symbol, { oku, tradeDate: prev.tradeDate })
    }
  }

  const rows = [...best.entries()].map(([symbol, { oku }]) => ({
    symbol,
    aum: oku * 1e8,
  }))

  console.log(`${path.basename(xlsxPath)}: ${rows.length} symbols → stock_symbols.aum (yen = 億円 × 1e8)`)
  if (dryRun) {
    console.log('Dry run sample:', rows.slice(0, 5))
    return
  }

  const supabase = createClient(url, key)
  let updated = 0
  for (const { symbol, aum } of rows) {
    const { error } = await supabase.from('stock_symbols').update({ aum }).eq('symbol', symbol)
    if (!error) updated += 1
    else console.warn(symbol, error.message)
    if (updated % 50 === 0) process.stdout.write(`\r  Updated ${updated}/${rows.length}`)
  }
  console.log(`\nDone. Updated ${updated}/${rows.length} stock_symbols.aum`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
