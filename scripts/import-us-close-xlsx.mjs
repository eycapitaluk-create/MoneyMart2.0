/**
 * US 등: xlsx 1행 헤더 — date|trade_date + close|close_usd → stock_daily_prices upsert
 * 종가만 있으면 open/high/low 를 close 와 동일하게 넣고 volume 은 null.
 * 기본 source: manual_close（同日他 source 行と併存可。アプリ側 dedupe は fetched_at が新しい方を優先）
 *
 *   node scripts/import-us-close-xlsx.mjs /path/to.xlsx --symbol=VRT [--name=Vertiv] [--source=manual_close]
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

const parseFlags = (argv) => {
  const pos = []
  const flags = {}
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1)
      else flags[a.slice(2)] = 'true'
    } else {
      pos.push(a)
    }
  }
  return { pos, flags }
}

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

/** YYYY-MM-DD（Date は UTC 暦日。必要なら xlsx 側で日付列を調整） */
const cellToTradeDate = (cell) => {
  if (cell == null || cell === '') return null
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return cell.toISOString().slice(0, 10)
  }
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    const d = XLSX.SSF.parse_date_code(cell)
    if (!d) return null
    const dt = new Date(Date.UTC(d.y, d.m - 1, d.d))
    return dt.toISOString().slice(0, 10)
  }
  const s = String(cell).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }

  const { pos, flags } = parseFlags(process.argv.slice(2))
  const xlsxPath = pos[0]
  if (!xlsxPath) {
    console.error('Usage: node scripts/import-us-close-xlsx.mjs <file.xlsx> --symbol=VRT [--name=DisplayName] [--source=manual_close]')
    process.exit(1)
  }
  const symbol = String(flags.symbol || '').trim().toUpperCase()
  if (!symbol) {
    console.error('--symbol= (例: VRT) が必要です')
    process.exit(1)
  }
  const displayName = String(flags.name || symbol).trim() || symbol
  const source = String(flags.source || 'manual_close').trim() || 'manual_close'
  const fileBase = path.basename(xlsxPath)

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  const header = rows[0] || []

  const norm = (h) => String(h || '').trim().toLowerCase()
  const dateIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'date' || x === 'trade_date' || x === 'datetime'
  })
  const closeIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'close' || x === 'close_usd' || x === 'adj_close' || x === 'adj close'
  })
  if (dateIdx < 0 || closeIdx < 0) {
    throw new Error(`date + close 列が必要です。ヘッダ: ${header.join(', ')}`)
  }

  const fetchedAt = new Date().toISOString()
  const priceRows = []
  for (const row of rows.slice(1)) {
    const tradeDate = cellToTradeDate(row[dateIdx])
    const close = toNum(row[closeIdx])
    if (!tradeDate || close == null || close <= 0) continue
    priceRows.push({
      source,
      symbol,
      trade_date: tradeDate,
      open: close,
      high: close,
      low: close,
      close,
      volume: null,
      fetched_at: fetchedAt,
      raw: { imported_from: fileBase, close_only: true },
    })
  }

  if (priceRows.length === 0) {
    console.log('No valid rows')
    return
  }

  const dedup = [...new Map(priceRows.map((r) => [`${r.source}|${r.symbol}|${r.trade_date}`, r])).values()]
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { error: symErr } = await supabase
    .from('stock_symbols')
    .upsert([{ symbol, name: displayName, is_active: true }], { onConflict: 'symbol' })
  if (symErr) throw symErr

  const chunk = 250
  for (let i = 0; i < dedup.length; i += chunk) {
    const batch = dedup.slice(i, i + chunk)
    const { error } = await supabase.from('stock_daily_prices').upsert(batch, { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
  }

  console.log(`Done. Upserted ${dedup.length} rows for ${symbol} (source=${source}) from ${fileBase}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
