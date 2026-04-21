/**
 * us_prices_final.csv, jp_prices_final.csv → Supabase 백필 + stockList400.js 생성
 * 실행: node scripts/backfill-from-final-csv.mjs [--dry-run]
 * JP만: BACKFILL_JP_CSV=/path/to/jp_prices.csv node scripts/backfill-from-final-csv.mjs --jp-only
 * stockList400.js 안 바꿀 때: BACKFILL_SKIP_STOCK_LIST=1
 *
 * 1) CSV 전체 심볼을 stock_symbols, stock_daily_prices에 적재
 * 2) stockList400.js를 US+JP CSV 심볼로 교체 (--jp-only 시 JP만 병합)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_US_CSV = '/Users/justinnam/Downloads/us_prices_updated (1).csv'
const DEFAULT_JP_CSV = '/Users/justinnam/Downloads/jp_prices_updated (1).csv'
const DEFAULT_ENV_FILES = ['.env.local', '.env']
const PRICE_UPSERT_BATCH_SIZE = 5000
const STOCK_LIST_PATH = path.resolve('src/data/stockList400.js')

const stripWrappingQuotes = (value = '') => {
  const trimmed = String(value || '').trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const loadEnvFiles = async () => {
  for (const envFile of DEFAULT_ENV_FILES) {
    try {
      const raw = await fs.readFile(envFile, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
        const eqIdx = trimmed.indexOf('=')
        const key = trimmed.slice(0, eqIdx).trim()
        const value = stripWrappingQuotes(trimmed.slice(eqIdx + 1))
        if (!key || process.env[key]) continue
        process.env[key] = value
      }
    } catch {
      // ignore missing env file
    }
  }
}

const normalizeSymbol = (symbol = '') => {
  let upper = String(symbol || '').trim().toUpperCase()
  upper = upper.replace(/\.\d+$/, '') // 6479.T.1 → 6479.T (중복 헤더)
  if (upper === 'BRK-B') return 'BRK.B'
  return upper
}

const splitCsvLine = (line = '') => line.split(',').map((cell) => cell.trim())

const readPriceCsv = async (csvPath) => {
  const raw = await fs.readFile(csvPath, 'utf8')
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean)
  if (lines.length < 2) {
    throw new Error(`CSV has no data rows: ${csvPath}`)
  }

  const header = splitCsvLine(lines[0])
  const rawSymbols = header.slice(1).map(normalizeSymbol).filter(Boolean)
  const symbolToColIdx = new Map()
  const symbolList = []
  rawSymbols.forEach((sym, idx) => {
    if (symbolToColIdx.has(sym)) return
    symbolToColIdx.set(sym, idx)
    symbolList.push(sym)
  })
  const rows = []

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const tradeDate = cells[0]
    if (!tradeDate) continue
    const values = cells.slice(1)
    const closeBySymbol = new Map()
    symbolList.forEach((symbol) => {
      const idx = symbolToColIdx.get(symbol)
      const close = Number(values[idx])
      if (!Number.isFinite(close) || close <= 0) return
      closeBySymbol.set(symbol, close)
    })
    rows.push({ tradeDate, closeBySymbol })
  }

  return {
    csvPath,
    symbols: new Set(symbolList),
    symbolList,
    rows,
  }
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const run = async () => {
  await loadEnvFiles()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing env. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY(or SUPABASE_SECRET_KEY)')
  }

  const dryRun = process.argv.includes('--dry-run')
  const jpOnly = process.argv.includes('--jp-only')
  const usCsvPath = process.env.BACKFILL_US_CSV || DEFAULT_US_CSV
  const jpCsvPath = process.env.BACKFILL_JP_CSV || DEFAULT_JP_CSV
  const supabase = createClient(supabaseUrl, supabaseKey)

  let usCsv = null
  let jpCsv = null

  if (jpOnly) {
    console.log('Reading JP CSV only...')
    jpCsv = await readPriceCsv(jpCsvPath)
  } else {
    console.log('Reading CSV files...')
    ;[usCsv, jpCsv] = await Promise.all([
      readPriceCsv(usCsvPath),
      readPriceCsv(jpCsvPath),
    ])
  }

  const symbolRows = []
  const priceRows = []

  const processCsv = (sourceCsv, region) => {
    for (const symbol of sourceCsv.symbolList) {
      symbolRows.push({
        symbol,
        name: symbol,
        is_active: true,
      })

      for (const historyRow of sourceCsv.rows) {
        const close = historyRow.closeBySymbol.get(symbol)
        if (!Number.isFinite(close) || close <= 0) continue
        priceRows.push({
          source: 'marketstack',
          symbol,
          trade_date: historyRow.tradeDate,
          open: null,
          high: null,
          low: null,
          close,
          volume: null,
          raw: {
            imported_from: path.basename(sourceCsv.csvPath),
            imported_via: 'csv_backfill_final',
            close,
          },
        })
      }
    }
  }

  if (usCsv) processCsv(usCsv, 'US')
  processCsv(jpCsv, 'JP')

  const dedupSymbolRows = [...new Map(symbolRows.map((row) => [row.symbol, row])).values()]
  const dedupPriceRows = [...new Map(
    priceRows.map((row) => [`${row.source}|${row.symbol}|${row.trade_date}`, row])
  ).values()]

  console.log(`US symbols: ${usCsv?.symbolList?.length ?? 0}, JP symbols: ${jpCsv.symbolList.length}`)
  console.log(`Total symbols: ${dedupSymbolRows.length}`)
  console.log(`Price rows: ${dedupPriceRows.length}`)

  if (!dryRun) {
    if (dedupSymbolRows.length > 0) {
      // 기존 symbol이 있으면 name을 덮어쓰지 않음 (회사명/섹터 보존)
      const { data: existing } = await supabase
        .from('stock_symbols')
        .select('symbol')
        .in('symbol', dedupSymbolRows.map((r) => r.symbol))
      const existingSet = new Set((existing || []).map((r) => r.symbol))
      const newSymbolRows = dedupSymbolRows.filter((r) => !existingSet.has(r.symbol))
      if (newSymbolRows.length > 0) {
        const { error } = await supabase
          .from('stock_symbols')
          .upsert(newSymbolRows, { onConflict: 'symbol' })
        if (error) throw error
        console.log(`Upserted ${newSymbolRows.length} new stock_symbols (${existingSet.size} existing preserved)`)
      } else {
        console.log('All symbols already in stock_symbols, skipping (preserving names)')
      }
    }

    const batches = chunk(dedupPriceRows, PRICE_UPSERT_BATCH_SIZE)
    for (let idx = 0; idx < batches.length; idx += 1) {
      const batch = batches[idx]
      const { error } = await supabase
        .from('stock_daily_prices')
        .upsert(batch, { onConflict: 'source,symbol,trade_date' })
      if (error) throw error
      console.log(`Upserted batch ${idx + 1}/${batches.length} (${batch.length} rows)`)
    }
  } else {
    console.log('Dry run - no data written to DB')
  }

  // Generate or merge stockList400.js
  let stockListRows = []
  if (jpOnly) {
    let existing = []
    try {
      const content = await fs.readFile(STOCK_LIST_PATH, 'utf8')
      const match = content.match(/export const STOCK_LIST_400 = (\[[\s\S]*?\])\s*(?=export|$)/m)
      if (match) existing = JSON.parse(match[1])
    } catch {}
    const existingBySymbol = new Map(existing.map((r) => [r.symbol, r]))
    const jpSymbolsFromCsv = new Set(jpCsv.symbolList)
    stockListRows = existing.filter((r) => r.region !== 'JP')
    for (const symbol of jpCsv.symbolList) {
      const prev = existingBySymbol.get(symbol)
      stockListRows.push({
        symbol,
        name: prev?.name ?? symbol,
        region: 'JP',
        index_tag: prev?.index_tag ?? 'NIKKEI225',
        market_cap: prev?.market_cap ?? 0,
        sector: prev?.sector ?? '未分類',
      })
    }
  } else {
    usCsv.symbolList.forEach((symbol) => {
      stockListRows.push({
        symbol,
        name: symbol,
        region: 'US',
        index_tag: 'SP500',
        market_cap: 0,
        sector: '未分類',
      })
    })
    jpCsv.symbolList.forEach((symbol) => {
      stockListRows.push({
        symbol,
        name: symbol,
        region: 'JP',
        index_tag: 'NIKKEI225',
        market_cap: 0,
        sector: '未分類',
      })
    })
  }

  const stockListJs = `export const STOCK_LIST_400 = ${JSON.stringify(stockListRows, null, 2)}
export const STOCK_LIST_400_SYMBOLS = new Set(STOCK_LIST_400.map((r) => r.symbol))
export const STOCK_LIST_400_BY_SYMBOL = new Map(STOCK_LIST_400.map((r) => [r.symbol, r]))
`

  const skipStockList = process.env.BACKFILL_SKIP_STOCK_LIST === '1'
  if (!dryRun && !skipStockList) {
    await fs.writeFile(STOCK_LIST_PATH, stockListJs, 'utf8')
    console.log(`Wrote ${STOCK_LIST_PATH} (${stockListRows.length} symbols)`)
  } else if (dryRun) {
    console.log(`Would write ${STOCK_LIST_PATH} (${stockListRows.length} symbols)`)
  } else if (skipStockList) {
    console.log('Skipped stockList400.js (BACKFILL_SKIP_STOCK_LIST=1)')
  }

  console.log('Done.')
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
