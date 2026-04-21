/**
 * JP ETF / 단일 .T 심볼 일별 시세 xlsx → stock_daily_prices
 *
 * 형식 A (기존): 1행 헤더 — symbol, trade_date|date, open, high, low, close, volume
 * 형식 B: 1행 제목, 2행 한국어 헤더(날짜·시가·고가·저가·종가·거래량·…), 이후 데이터, 하단 요약 블록은 자동 스킵
 *
 * 실행:
 *   node scripts/import-jp-etf-xlsx.mjs [경로.xlsx] [--symbol=314A.T] [--source=jp_etf_csv]
 *
 * 형식 B 기본 source: jp_etf_csv (수동 적재). 형식 A 기본 source: marketstack (기존 배치와 동일).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const DEFAULT_XLSX = '/Users/justinnam/Downloads/jp_etf_2026-04-13.xlsx'

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

const normalizeSymbol = (s) => String(s || '').trim()
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

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

/** YYYY-MM-DD */
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

const isKoreanOhlcvHeaderRow = (row) => {
  if (!row || !row.length) return false
  const a = String(row[0] || '').trim()
  return a === '날짜' || /^date$/i.test(a)
}

const extractSymbolFromTitleOrPath = (rows, filePath) => {
  for (let i = 0; i < Math.min(3, rows.length); i += 1) {
    const line = rows[i]
    if (!Array.isArray(line)) continue
    for (const cell of line) {
      const m = String(cell || '').match(/(\d{3,4}[A-Z]?)\.T\b/i)
      if (m) return `${m[1].toUpperCase()}.T`
    }
  }
  const base = path.basename(filePath, path.extname(filePath))
  const m2 = base.match(/^(\d{3,4}[A-Z]?)_T_/i) || base.match(/^(\d{3,4}[A-Z]?)[_-]/i)
  if (m2) return `${m2[1].toUpperCase()}.T`
  return null
}

const displayNameFromTitleRow = (rows) => {
  const t = String(rows[0]?.[0] || '').trim()
  if (!t) return null
  const cut = t.split(/\s*[-–—]\s*/)[0]?.split('(')[0]?.trim()
  return cut || null
}

const parseStandardFormat = (rows, source, fileBase) => {
  const header = rows[0] || []
  const symbolIdx = header.findIndex((h) => String(h).toLowerCase() === 'symbol')
  const dateIdx = header.findIndex(
    (h) => String(h).toLowerCase().includes('trade_date') || String(h).toLowerCase() === 'date'
  )
  const openIdx = header.findIndex((h) => String(h).toLowerCase() === 'open')
  const highIdx = header.findIndex((h) => String(h).toLowerCase() === 'high')
  const lowIdx = header.findIndex((h) => String(h).toLowerCase() === 'low')
  const closeIdx = header.findIndex((h) => String(h).toLowerCase() === 'close')
  const volIdx = header.findIndex((h) => String(h).toLowerCase() === 'volume')
  const aumIdx = header.findIndex((h) => {
    const x = String(h || '').trim().toLowerCase()
    return x === 'aum_oku_yen' || x === 'aum_oku' || x === 'aum'
  })

  if (symbolIdx < 0 || closeIdx < 0) {
    return null
  }

  const priceRows = []
  const symbolRows = []

  for (const row of rows.slice(1)) {
    const symbol = normalizeSymbol(row[symbolIdx])
    if (!symbol) continue

    const tradeDate = cellToTradeDate(row[dateIdx])
    const close = toNum(row[closeIdx])
    if (!tradeDate || close == null || close <= 0) continue

    const aumVal = aumIdx >= 0 ? toNum(row[aumIdx]) : null
    const raw = { imported_from: fileBase }
    if (aumVal != null && aumVal > 0) raw.aum_oku_yen = aumVal

    symbolRows.push({ symbol, name: symbol, is_active: true })
    priceRows.push({
      source,
      symbol,
      trade_date: tradeDate,
      open: openIdx >= 0 ? toNum(row[openIdx]) : null,
      high: highIdx >= 0 ? toNum(row[highIdx]) : null,
      low: lowIdx >= 0 ? toNum(row[lowIdx]) : null,
      close,
      volume: volIdx >= 0 ? toNum(row[volIdx]) : null,
      raw,
    })
  }

  return { priceRows, symbolRows }
}

const parseSingleSymbolKoreanSheet = (rows, symbol, source, fileBase, friendlyName) => {
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    if (isKoreanOhlcvHeaderRow(rows[i])) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) {
    throw new Error('형식 B: "날짜" 헤더 행을 찾지 못했습니다.')
  }
  if (!symbol) {
    throw new Error('형식 B: 심볼을 --symbol=314A.T 로 지정하거나, 파일명/제목에 314A.T 형태가 있어야 합니다.')
  }

  const name = friendlyName || symbol
  const symbolRows = [{ symbol, name, is_active: true }]
  const priceRows = []

  for (let r = headerIdx + 1; r < rows.length; r += 1) {
    const row = rows[r]
    if (!row || !row.length) continue
    const c0 = row[0]
    const s0 = String(c0 ?? '').trim()
    if (s0 === '요약' || s0.startsWith('요약')) break
    if (!cellToTradeDate(c0)) continue
    if (row.length < 5) continue

    const tradeDate = cellToTradeDate(c0)
    const open = toNum(row[1])
    const high = toNum(row[2])
    const low = toNum(row[3])
    const close = toNum(row[4])
    const volume = row.length > 5 ? toNum(row[5]) : null

    if (!tradeDate || close == null || close <= 0) continue

    priceRows.push({
      source,
      symbol,
      trade_date: tradeDate,
      open,
      high,
      low,
      close,
      volume,
      raw: { imported_from: fileBase, format: 'kr_single_symbol_ohlcv' },
    })
  }

  return { priceRows, symbolRows }
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }

  const { pos, flags } = parseFlags(process.argv.slice(2))
  const xlsxPath = pos[0] || DEFAULT_XLSX
  const fileBase = path.basename(xlsxPath)

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

  const flagSymbol = flags.symbol ? normalizeSymbol(flags.symbol) : null
  const stdSource = flags.source || 'marketstack'
  const standard = parseStandardFormat(rows, stdSource, fileBase)

  let priceRows
  let symbolRows
  let usedSource

  if (standard) {
    if (standard.priceRows.length === 0) {
      throw new Error(`형식 A로 읽었으나 유효 행이 없습니다. 헤더: ${(rows[0] || []).join(', ')}`)
    }
    usedSource = stdSource
    priceRows = standard.priceRows
    symbolRows = standard.symbolRows
  } else {
    usedSource = flags.source || 'jp_etf_csv'
    const sym = flagSymbol || extractSymbolFromTitleOrPath(rows, xlsxPath)
    const friendly = displayNameFromTitleRow(rows)
    const parsed = parseSingleSymbolKoreanSheet(rows, sym, usedSource, fileBase, friendly)
    priceRows = parsed.priceRows
    symbolRows = parsed.symbolRows
  }

  if (priceRows.length === 0) {
    console.log('No valid rows in xlsx')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const dedupSymbols = [...new Map(symbolRows.map((r) => [r.symbol, r])).values()]
  const dedupPrices = [
    ...new Map(priceRows.map((r) => [`${r.source}|${r.symbol}|${r.trade_date}`, r])).values(),
  ]

  console.log(`Importing ${dedupPrices.length} rows from ${fileBase} (source=${usedSource})`)

  const { error: symErr } = await supabase.from('stock_symbols').upsert(dedupSymbols, { onConflict: 'symbol' })
  if (symErr) throw symErr

  const { error: priceErr } = await supabase
    .from('stock_daily_prices')
    .upsert(dedupPrices, { onConflict: 'source,symbol,trade_date' })
  if (priceErr) throw priceErr

  console.log(`Done. Upserted ${dedupPrices.length} price rows.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
