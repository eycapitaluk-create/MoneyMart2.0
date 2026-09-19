/**
 * US 등: xlsx 1행 헤더 → stock_daily_prices upsert
 *
 * [단일 종목]
 *   단일 종목 시트는 영문/한글 헤더 모두 허용 (예: 날짜·종가·시가… 또는 date·close…).
 *   node scripts/import-us-close-xlsx.mjs /path/to.xlsx --symbol=VRT [--name=Vertiv] [--source=manual_close]
 *
 * [여러 종목 — 첫 줄에 symbol + trade_date + close(, open,high,low,volume)]
 *   --symbol 생략 시 자동 또는 --multi
 *   node scripts/import-us-close-xlsx.mjs /path/to-us-all.xlsx --multi
 *
 *   stock_symbols は触らず日足のみ: --prices-only
 *
 *   特定日のみ upsert: --trade-date=YYYY-MM-DD（その日の行だけ）
 *
 *   StockPage 追加分のみ（stockMarketPageExtras のティッカーに限定）: --only-stock-page-extras=true
 *
 *   カンマ区切りティッカーのみ（例: ヒートマップ用 ETF）: --only-symbols=AAXJ,IJH,IYE
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 SUPABASE_SECRET_KEY)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { STOCK_MARKET_PAGE_EXTRA_SYMBOLS } from '../src/data/stockMarketPageExtras.js'
import { normalizeStockSymbolForDb } from '../src/lib/stockSymbolNormalize.js'

/** stock_daily_prices / extras と並ぶ標準ティッカーへ寄せる */
const normalizeTickerForDb = (raw) => normalizeStockSymbolForDb(raw)

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
    console.error('Usage:\n  단일: node scripts/import-us-close-xlsx.mjs <file.xlsx> --symbol=VRT [--name=]\n  다종목: 첫 줄에 symbol+trade_date+close(…OHLCV) 또는 --multi\n')
    process.exit(1)
  }

  const source = String(flags.source || 'manual_close').trim() || 'manual_close'
  const fileBase = path.basename(xlsxPath)

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  const header = rows[0] || []

  const norm = (h) => String(h || '').normalize('NFKC').trim().toLowerCase()
  const symbolColIdx = header.findIndex((h) => norm(h) === 'symbol' || norm(h) === 'ticker')
  const cliSymbol = String(flags.symbol || '').trim().toUpperCase()
  const symbol = cliSymbol
  const multiFromFlag = flags.multi === 'true' || flags.multi === '1'
  const dateIdx = header.findIndex((h) => {
    const x = norm(h)
    return (
      x === 'date'
      || x === 'trade_date'
      || x === 'datetime'
      || x.includes('trade_date')
      || x.includes('datetime')
      || x.includes('날짜')
      || (x.includes('date') && !x.includes('update'))
    )
  })
  const openIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'open' || x.includes('시가') || (x.includes('open') && !x.includes('high'))
  })
  const highIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'high' || x.includes('고가') || x.includes('high')
  })
  const lowIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'low' || x.includes('저가')
  })
  const closeIdx = header.findIndex((h) => {
    const x = norm(h)
    return (
      x === 'close'
      || x === 'close_usd'
      || x === 'adj_close'
      || x === 'adj close'
      || x.includes('종가')
      || (x.includes('close') && !x.includes('adj close'))
    )
  })
  const volumeIdx = header.findIndex((h) => {
    const x = norm(h)
    return x === 'volume' || x === 'vol' || x.includes('거래량')
  })

  const multiSymbol =
    symbolColIdx >= 0 || multiFromFlag

  if (!multiSymbol && !cliSymbol) {
    console.error('단일 업로드: --symbol=티커 필요. 또는 시트에 symbol 열을 두면 다종목으로 자동 처리됩니다.')
    process.exit(1)
  }
  const displayName = String(flags.name || cliSymbol).trim() || cliSymbol || 'UNKNOWN'

  if (!multiSymbol && (dateIdx < 0 || closeIdx < 0)) {
    throw new Error(`date + close 열이 필요합니다. 헤더: ${header.join(', ')}`)
  }

  const fetchedAt = new Date().toISOString()

  /** @type {{ source: string, symbol: string, trade_date: string, open: number, high: number, low: number, close: number, volume: number|null, fetched_at: string, raw: object }[]} */
  const priceRows = []

  if (!multiSymbol) {
    if (dateIdx < 0 || closeIdx < 0) {
      throw new Error(`date + close 열이 필요합니다. 헤더: ${header.join(', ')}`)
    }
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
  } else {
    if (symbolColIdx < 0 || dateIdx < 0 || closeIdx < 0) {
      throw new Error(
        `여러 종목 모드에서는 symbol + trade_date + close 열이 필요합니다. 헤더: ${header.join(', ')}`,
      )
    }
    const volNormalize = (v) => {
      const n = toNum(v)
      if (n == null || !Number.isFinite(n) || n < 0) return null
      if (n > 1e12) return null
      return Math.round(n)
    }
    for (const row of rows.slice(1)) {
      const sym = String(row[symbolColIdx] ?? '').trim().toUpperCase()
      const tradeDate = cellToTradeDate(row[dateIdx])
      const close = toNum(row[closeIdx])
      if (!sym || !tradeDate || close == null || close <= 0) continue
      const opens = openIdx >= 0 && toNum(row[openIdx]) != null ? Number(row[openIdx]) : close
      const highs = highIdx >= 0 && toNum(row[highIdx]) != null ? Number(row[highIdx]) : close
      const lows = lowIdx >= 0 && toNum(row[lowIdx]) != null ? Number(row[lowIdx]) : close
      const vn = volumeIdx >= 0 ? volNormalize(row[volumeIdx]) : null

      priceRows.push({
        source,
        symbol: sym,
        trade_date: tradeDate,
        open: opens,
        high: highs,
        low: lows,
        close,
        volume: vn,
        fetched_at: fetchedAt,
        raw: { imported_from: fileBase, multi_sheet: true },
      })
    }
  }

  if (multiSymbol) {
    for (let i = 0; i < priceRows.length; i++) {
      priceRows[i] = { ...priceRows[i], symbol: normalizeTickerForDb(priceRows[i].symbol) }
    }
  }

  const onlySymbolsRaw = String(flags['only-symbols'] || flags.only_symbols || '').trim()
  if (onlySymbolsRaw) {
    const allow = new Set(
      onlySymbolsRaw.split(/[,，]/).map((s) => normalizeTickerForDb(s.trim())).filter(Boolean),
    )
    const filtered = priceRows.filter((r) => r.symbol && allow.has(normalizeTickerForDb(r.symbol)))
    priceRows.length = 0
    priceRows.push(
      ...filtered.map((r) => ({ ...r, symbol: normalizeTickerForDb(r.symbol) })),
    )
    console.log(`--only-symbols: ${priceRows.length} rows (${allow.size} tickers requested)`)
  }

  const onlyExtras =
    flags['only-stock-page-extras'] === 'true'
    || flags['only-stock-page-extras'] === '1'
    || flags.only_stock_page_extras === 'true'
    || flags.only_stock_page_extras === '1'

  if (onlyExtras) {
    const allow = new Set(STOCK_MARKET_PAGE_EXTRA_SYMBOLS.map((s) => String(s).trim().toUpperCase()))
    const next = priceRows
      .map((r) => ({ ...r, symbol: normalizeTickerForDb(r.symbol) }))
      .filter((r) => r.symbol && allow.has(r.symbol))
    priceRows.length = 0
    priceRows.push(...next)
    console.log(`--only-stock-page-extras: ${priceRows.length} rows after filter`)
  }

  const tradeDateOnly = String(flags['trade-date'] || flags.trade_date || '').trim().slice(0, 10)
  const filteredRows =
    /^\d{4}-\d{2}-\d{2}$/.test(tradeDateOnly)
      ? priceRows.filter((r) => r.trade_date === tradeDateOnly)
      : priceRows

  if (filteredRows.length === 0) {
    console.log(
      tradeDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(tradeDateOnly)
        ? `No rows for trade_date=${tradeDateOnly}`
        : 'No valid rows',
    )
    return
  }

  const dedup = [...new Map(filteredRows.map((r) => [`${r.source}|${r.symbol}|${r.trade_date}`, r])).values()]
  const supabase = createClient(supabaseUrl, supabaseKey)

  const pricesOnly =
    flags['prices-only'] === 'true'
    || flags['prices-only'] === '1'
    || flags.prices_only === 'true'
    || flags.prices_only === '1'

  if (!pricesOnly) {
    const symRows =
      multiSymbol
        ? [...new Set(dedup.map((r) => r.symbol))].map((s) => ({ symbol: s, name: s, is_active: true }))
        : [{ symbol, name: displayName, is_active: true }]
    const symChunk = 200
    for (let i = 0; i < symRows.length; i += symChunk) {
      const { error: symErr } = await supabase
        .from('stock_symbols')
        .upsert(symRows.slice(i, i + symChunk), { onConflict: 'symbol' })
      if (symErr) throw symErr
    }
  } else {
    console.log('Skip stock_symbols upsert (--prices-only)')
  }

  const chunk = 250
  for (let i = 0; i < dedup.length; i += chunk) {
    const batch = dedup.slice(i, i + chunk)
    const { error } = await supabase.from('stock_daily_prices').upsert(batch, { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
  }

  if (multiSymbol) {
    const symCount = [...new Set(dedup.map((r) => r.symbol))].length
    console.log(`완료. ${symCount}종목 × 총 ${dedup.length}행 upsert (${source}), ${fileBase}`)
  } else {
    console.log(`Done. Upserted ${dedup.length} rows for ${symbol} (source=${source}) from ${fileBase}`)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
