/**
 * date + volume xlsx → stock_daily_prices（volume のみ更新、close/OHLC は DB 既存値を維持）
 *
 * 헤더: Date/date + Volume/volume
 *
 *   node scripts/patch-stock-volume-xlsx.mjs path.xlsx --symbol=1545.T [--source=marketstack]
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

const isDateVolumeHeader = (row) => {
  if (!row || row.length < 2) return false
  const a = String(row[0] || '').trim().toLowerCase()
  const b = String(row[1] || '').trim().toLowerCase()
  const dateOk = a === 'date' || a === 'trade_date' || a === '날짜'
  const volOk = b === 'volume' || b === 'vol' || b === '거래량'
  return dateOk && volOk
}

const parseDateVolumeRows = (rows) => {
  if (!rows.length || !isDateVolumeHeader(rows[0])) return null
  const out = []
  for (const row of rows.slice(1)) {
    const tradeDate = cellToTradeDate(row[0])
    const volume = toNum(row[1])
    if (!tradeDate || volume == null || volume < 0) continue
    out.push({ trade_date: tradeDate, volume })
  }
  return out
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
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
  if (!xlsxPath) throw new Error('Usage: node scripts/patch-stock-volume-xlsx.mjs path.xlsx --symbol=1545.T')

  const symbol = String(flags.symbol || '').trim().toUpperCase()
  if (!symbol) throw new Error('--symbol=1545.T required')

  const source = String(flags.source || 'marketstack').trim()
  const fileBase = path.basename(xlsxPath)

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  const volumeRows = parseDateVolumeRows(rows)
  if (!volumeRows?.length) {
    throw new Error('Expected header: Date, Volume (or date + volume)')
  }

  const volumeByDate = new Map(volumeRows.map((r) => [r.trade_date, r.volume]))
  const dates = [...volumeByDate.keys()].sort()
  const supabase = createClient(supabaseUrl, supabaseKey)

  /** @type {Map<string, object>} */
  const existingByDate = new Map()
  for (const dateChunk of chunk(dates, 100)) {
    const { data, error } = await supabase
      .from('stock_daily_prices')
      .select('source,symbol,trade_date,open,high,low,close,volume,raw')
      .eq('source', source)
      .eq('symbol', symbol)
      .in('trade_date', dateChunk)
    if (error) throw error
    for (const row of data || []) {
      existingByDate.set(String(row.trade_date).slice(0, 10), row)
    }
  }

  const upserts = []
  const skippedNoRow = []
  const skippedBadClose = []

  for (const tradeDate of dates) {
    const volume = volumeByDate.get(tradeDate)
    const existing = existingByDate.get(tradeDate)
    if (!existing) {
      skippedNoRow.push(tradeDate)
      continue
    }
    const close = Number(existing.close)
    if (!Number.isFinite(close) || close <= 0) {
      skippedBadClose.push(tradeDate)
      continue
    }
    const prevRaw = existing.raw && typeof existing.raw === 'object' && !Array.isArray(existing.raw)
      ? { ...existing.raw }
      : {}
    upserts.push({
      source,
      symbol,
      trade_date: tradeDate,
      open: existing.open ?? close,
      high: existing.high ?? close,
      low: existing.low ?? close,
      close,
      volume,
      raw: {
        ...prevRaw,
        volume_patched_from: fileBase,
        volume_patched_at: new Date().toISOString(),
      },
    })
  }

  if (upserts.length === 0) {
    console.log('Nothing to upsert.')
    if (skippedNoRow.length) console.log(`No ${source} row: ${skippedNoRow.length} dates`)
    return
  }

  for (const batch of chunk(upserts, 200)) {
    const { error } = await supabase
      .from('stock_daily_prices')
      .upsert(batch, { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
  }

  console.log(`Done. ${symbol} source=${source}: upserted volume on ${upserts.length} / ${dates.length} dates`)
  if (skippedNoRow.length) {
    console.log(`Skipped (no ${source} row): ${skippedNoRow.length}`, skippedNoRow.slice(0, 8).join(', '), skippedNoRow.length > 8 ? '...' : '')
  }
  if (skippedBadClose.length) {
    console.log(`Skipped (invalid close): ${skippedBadClose.length}`)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
