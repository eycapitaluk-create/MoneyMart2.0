/**
 * US volume long/wide xlsx → stock_daily_prices（volume のみ更新、OHLC は維持）
 *
 * Long: trade_date + symbol + volume（例: us_volume_1yr_*.xlsx の Long シート）
 * Wide: trade_date 列 + ティッカー列（例: Wide シート）
 *
 *   node scripts/import-us-volume-long-xlsx.mjs /path/to.xlsx
 *   node scripts/import-us-volume-long-xlsx.mjs /path/to.xlsx --sheet="Long (symbol-date-volume)"
 *   node scripts/import-us-volume-long-xlsx.mjs /path/to.xlsx --only-symbols=AAPL,NVDA --dry-run
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 SUPABASE_SECRET_KEY)
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

const normalizeDbSymbol = (raw) => {
  const u = String(raw ?? '').trim().toUpperCase()
  if (!u) return ''
  if (u === 'BRK/B' || u === 'BRK-B') return 'BRK.B'
  if (u === 'BF/B' || u === 'BF-B' || u === 'BF.B') return 'BF-B'
  if (u.includes('/')) return u.replace(/\//g, '-')
  return u
}

const volNormalize = (v) => {
  const n = toNum(v)
  if (n == null || !Number.isFinite(n) || n < 0) return null
  if (n > 1e12) return null
  return Math.round(n)
}

const sourcePriority = (src) => {
  const s = String(src || '').toLowerCase()
  if (s === 'marketstack') return 0
  if (s === 'manual_close') return 1
  if (s === 'yfinance') return 2
  return 3
}

const pickPreferredRow = (rows) => {
  if (!rows?.length) return null
  return rows.reduce((best, row) => {
    if (!best) return row
    return sourcePriority(row.source) < sourcePriority(best.source) ? row : best
  }, null)
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const norm = (h) => String(h || '').normalize('NFKC').trim().toLowerCase()

const parseLongSheet = (rows) => {
  const header = rows[0] || []
  const dateIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'trade_date' || x === 'date' || x.includes('trade_date')
  })
  const symIdx = header.findIndex((h) => norm(h) === 'symbol' || norm(h) === 'ticker')
  const volIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'volume' || x === 'vol'
  })
  if (dateIdx < 0 || symIdx < 0 || volIdx < 0) return null

  /** @type {{ symbol: string, trade_date: string, volume: number }[]} */
  const out = []
  for (const row of rows.slice(1)) {
    const symbol = normalizeDbSymbol(row[symIdx])
    const tradeDate = cellToTradeDate(row[dateIdx])
    const volume = volNormalize(row[volIdx])
    if (!symbol || !tradeDate || volume == null) continue
    out.push({ symbol, trade_date: tradeDate, volume })
  }
  return out
}

const parseWideSheet = (rows) => {
  const header = rows[0] || []
  const dateIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'trade_date' || x === 'date' || x.includes('trade_date')
  })
  if (dateIdx < 0) return null

  /** @type {{ symbol: string, trade_date: string, volume: number }[]} */
  const out = []
  for (let ci = 0; ci < header.length; ci += 1) {
    if (ci === dateIdx) continue
    const symbol = normalizeDbSymbol(header[ci])
    if (!symbol) continue
    for (const row of rows.slice(1)) {
      const tradeDate = cellToTradeDate(row[dateIdx])
      const volume = volNormalize(row[ci])
      if (!tradeDate || volume == null) continue
      out.push({ symbol, trade_date: tradeDate, volume })
    }
  }
  return out
}

const detectAndParse = (rows) => {
  const long = parseLongSheet(rows)
  if (long?.length) return { format: 'long', rows: long }
  const wide = parseWideSheet(rows)
  if (wide?.length) return { format: 'wide', rows: wide }
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
    console.error('Usage: node scripts/import-us-volume-long-xlsx.mjs /path/to.xlsx [--sheet=...] [--only-symbols=AAPL,NVDA] [--dry-run]')
    process.exit(1)
  }

  const dryRun = flags['dry-run'] === 'true' || flags['dry-run'] === '1' || flags.dry_run === 'true'
  const fileBase = path.basename(xlsxPath)
  const sheetPref = String(flags.sheet || '').trim()

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const sheetName = sheetPref || (wb.SheetNames.find((n) => /long/i.test(n)) ?? wb.SheetNames[0])
  const ws = wb.Sheets[sheetName]
  if (!ws) throw new Error(`시트 없음: ${sheetName}`)
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  const parsed = detectAndParse(rawRows)
  if (!parsed?.rows?.length) {
    throw new Error(`trade_date+symbol+volume (long) 또는 trade_date+티커열 (wide) 형식이 필요합니다. sheet=${sheetName}`)
  }

  let volumeRows = parsed.rows
  const onlySymbolsRaw = String(flags['only-symbols'] || flags.only_symbols || '').trim()
  if (onlySymbolsRaw) {
    const allow = new Set(
      onlySymbolsRaw.split(/[,，]/).map((s) => normalizeDbSymbol(s.trim())).filter(Boolean),
    )
    volumeRows = volumeRows.filter((r) => allow.has(r.symbol))
    console.log(`--only-symbols: ${volumeRows.length} rows (${allow.size} tickers)`)
  }

  /** @type {Map<string, Map<string, number>>} */
  const bySymbol = new Map()
  for (const r of volumeRows) {
    if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, new Map())
    bySymbol.get(r.symbol).set(r.trade_date, r.volume)
  }

  const symbols = [...bySymbol.keys()].sort()
  console.log(`Parsed ${volumeRows.length} volume rows (${parsed.format}), ${symbols.length} symbols from ${fileBase} [${sheetName}]`)

  const supabase = createClient(supabaseUrl, supabaseKey)
  let totalUpsert = 0
  let totalSkipNoRow = 0
  let totalSkipBadClose = 0
  let totalSkipSameVol = 0

  for (const symbol of symbols) {
    const volumeByDate = bySymbol.get(symbol)
    const dates = [...volumeByDate.keys()].sort()
    const minDate = dates[0]
    const maxDate = dates[dates.length - 1]

    /** @type {Map<string, object[]>} */
    const existingByDate = new Map()
    for (const dateChunk of chunk(dates, 120)) {
      const { data, error } = await supabase
        .from('stock_daily_prices')
        .select('source,symbol,trade_date,open,high,low,close,volume,raw')
        .eq('symbol', symbol)
        .in('trade_date', dateChunk)
      if (error) throw error
      for (const row of data || []) {
        const d = String(row.trade_date).slice(0, 10)
        if (!existingByDate.has(d)) existingByDate.set(d, [])
        existingByDate.get(d).push(row)
      }
    }

    const upserts = []
    for (const tradeDate of dates) {
      const volume = volumeByDate.get(tradeDate)
      const candidates = existingByDate.get(tradeDate) || []
      const existing = pickPreferredRow(candidates)
      if (!existing) {
        totalSkipNoRow += 1
        continue
      }
      const close = Number(existing.close)
      if (!Number.isFinite(close) || close <= 0) {
        totalSkipBadClose += 1
        continue
      }
      const prevVol = Number(existing.volume)
      if (Number.isFinite(prevVol) && prevVol === volume) {
        totalSkipSameVol += 1
        continue
      }
      const prevRaw = existing.raw && typeof existing.raw === 'object' && !Array.isArray(existing.raw)
        ? { ...existing.raw }
        : {}
      upserts.push({
        source: existing.source,
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

    if (upserts.length === 0) continue

    if (dryRun) {
      console.log(`[dry-run] ${symbol}: would upsert ${upserts.length} / ${dates.length} (${minDate}..${maxDate})`)
      totalUpsert += upserts.length
      continue
    }

    for (const batch of chunk(upserts, 200)) {
      const { error } = await supabase
        .from('stock_daily_prices')
        .upsert(batch, { onConflict: 'source,symbol,trade_date' })
      if (error) throw error
    }
    totalUpsert += upserts.length
    console.log(`${symbol}: upserted volume on ${upserts.length} / ${dates.length} dates`)
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Done. upsert=${totalUpsert}, skip_no_row=${totalSkipNoRow}, skip_bad_close=${totalSkipBadClose}, skip_same_vol=${totalSkipSameVol}`,
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
