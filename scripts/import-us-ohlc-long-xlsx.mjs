/**
 * US OHLC long xlsx → stock_daily_prices（open/high/low/close 更新、volume は維持）
 *
 * Long: symbol + trade_date + open + high + low + close
 *
 *   node scripts/import-us-ohlc-long-xlsx.mjs /path/to.xlsx
 *   node scripts/import-us-ohlc-long-xlsx.mjs /path/to.xlsx --only-symbols=MU,NVDA --dry-run
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 SUPABASE_SECRET_KEY)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { normalizeStockSymbolForDb } from '../src/lib/stockSymbolNormalize.js'

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

const normalizeDbSymbol = (raw) => normalizeStockSymbolForDb(raw)

const norm = (h) => String(h || '').normalize('NFKC').trim().toLowerCase()

const parseLongOhlc = (rows) => {
  const header = rows[0] || []
  const symIdx = header.findIndex((h) => norm(h) === 'symbol' || norm(h) === 'ticker')
  const dateIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'trade_date' || x === 'date' || x.includes('trade_date')
  })
  const openIdx = header.findIndex((h) => norm(h) === 'open' || norm(h).includes('시가'))
  const highIdx = header.findIndex((h) => norm(h) === 'high' || norm(h).includes('고가'))
  const lowIdx = header.findIndex((h) => norm(h) === 'low' || norm(h).includes('저가'))
  const closeIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'close' || x === 'adj_close' || x.includes('종가')
  })
  if (symIdx < 0 || dateIdx < 0 || openIdx < 0 || highIdx < 0 || lowIdx < 0 || closeIdx < 0) {
    return null
  }

  const out = []
  for (const row of rows.slice(1)) {
    const symbol = normalizeDbSymbol(row[symIdx])
    const tradeDate = cellToTradeDate(row[dateIdx])
    const open = toNum(row[openIdx])
    const high = toNum(row[highIdx])
    const low = toNum(row[lowIdx])
    const close = toNum(row[closeIdx])
    if (!symbol || !tradeDate) continue
    if (![open, high, low, close].every((n) => n != null && n > 0)) continue
    if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) continue
    out.push({ symbol, trade_date: tradeDate, open, high, low, close })
  }
  return out
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

const ohlcSame = (a, b, eps = 1e-6) => (
  Math.abs(Number(a.open) - Number(b.open)) <= eps
  && Math.abs(Number(a.high) - Number(b.high)) <= eps
  && Math.abs(Number(a.low) - Number(b.low)) <= eps
  && Math.abs(Number(a.close) - Number(b.close)) <= eps
)

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
  if (!xlsxPath) {
    console.error('Usage: node scripts/import-us-ohlc-long-xlsx.mjs /path/to.xlsx [--only-symbols=MU,NVDA] [--dry-run]')
    process.exit(1)
  }

  const dryRun = flags['dry-run'] === 'true' || flags['dry-run'] === '1' || flags.dry_run === 'true'
  const fileBase = path.basename(xlsxPath)
  const sheetPref = String(flags.sheet || '').trim()

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const sheetName = sheetPref || (wb.SheetNames.find((n) => /long.*ohlc/i.test(n)) ?? wb.SheetNames[0])
  const ws = wb.Sheets[sheetName]
  if (!ws) throw new Error(`시트 없음: ${sheetName}`)
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  let ohlcRows = parseLongOhlc(rawRows)
  if (!ohlcRows?.length) throw new Error(`symbol+trade_date+open+high+low+close 형식 필요. sheet=${sheetName}`)

  const onlySymbolsRaw = String(flags['only-symbols'] || flags.only_symbols || '').trim()
  if (onlySymbolsRaw) {
    const allow = new Set(
      onlySymbolsRaw.split(/[,，]/).map((s) => normalizeDbSymbol(s.trim())).filter(Boolean),
    )
    ohlcRows = ohlcRows.filter((r) => allow.has(r.symbol))
    console.log(`--only-symbols: ${ohlcRows.length} rows (${allow.size} tickers)`)
  }

  /** @type {Map<string, Map<string, object>>} */
  const bySymbol = new Map()
  for (const r of ohlcRows) {
    if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, new Map())
    bySymbol.get(r.symbol).set(r.trade_date, r)
  }

  const symbols = [...bySymbol.keys()].sort()
  console.log(`Parsed ${ohlcRows.length} OHLC rows, ${symbols.length} symbols from ${fileBase} [${sheetName}]`)

  const supabase = createClient(supabaseUrl, supabaseKey)
  let totalUpsert = 0
  let totalSkipNoRow = 0
  let totalSkipSame = 0
  let totalSkipInvalid = 0

  for (const symbol of symbols) {
    const ohlcByDate = bySymbol.get(symbol)
    const dates = [...ohlcByDate.keys()].sort()

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
      const incoming = ohlcByDate.get(tradeDate)
      const existing = pickPreferredRow(existingByDate.get(tradeDate) || [])
      if (!existing) {
        totalSkipNoRow += 1
        continue
      }
      if (ohlcSame(existing, incoming)) {
        totalSkipSame += 1
        continue
      }
      const prevRaw = existing.raw && typeof existing.raw === 'object' && !Array.isArray(existing.raw)
        ? { ...existing.raw }
        : {}
      upserts.push({
        source: existing.source,
        symbol,
        trade_date: tradeDate,
        open: incoming.open,
        high: incoming.high,
        low: incoming.low,
        close: incoming.close,
        volume: existing.volume ?? null,
        raw: {
          ...prevRaw,
          ohlc_patched_from: fileBase,
          ohlc_patched_at: new Date().toISOString(),
        },
      })
    }

    if (upserts.length === 0) continue

    if (dryRun) {
      console.log(`[dry-run] ${symbol}: would upsert ${upserts.length} / ${dates.length}`)
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
    console.log(`${symbol}: upserted OHLC on ${upserts.length} / ${dates.length} dates`)
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Done. upsert=${totalUpsert}, skip_no_row=${totalSkipNoRow}, skip_same=${totalSkipSame}, skip_invalid=${totalSkipInvalid}`,
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
