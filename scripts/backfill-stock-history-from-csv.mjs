import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { STOCK_LIST_400 } from '../src/data/stockList400.js'

const DEFAULT_US_CSV = '/Users/justinnam/Downloads/us_top200_prices (1).csv'
const DEFAULT_JP_CSV = '/Users/justinnam/Downloads/jp_top100_prices (1).csv'
const DEFAULT_ENV_FILES = ['.env.local', '.env']
const PRICE_UPSERT_BATCH_SIZE = 5000

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
  const upper = String(symbol || '').trim().toUpperCase()
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
  const symbols = header.slice(1).map(normalizeSymbol)
  const rows = []

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const tradeDate = cells[0]
    if (!tradeDate) continue
    const values = cells.slice(1)
    const closeBySymbol = new Map()
    symbols.forEach((symbol, idx) => {
      const close = Number(values[idx])
      if (!symbol || !Number.isFinite(close) || close <= 0) return
      closeBySymbol.set(symbol, close)
    })
    rows.push({ tradeDate, closeBySymbol })
  }

  return {
    csvPath,
    symbols: new Set(symbols.filter(Boolean)),
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
  const usCsvPath = process.env.BACKFILL_US_CSV || DEFAULT_US_CSV
  const jpCsvPath = process.env.BACKFILL_JP_CSV || DEFAULT_JP_CSV
  const supabase = createClient(supabaseUrl, supabaseKey)

  const [usCsv, jpCsv] = await Promise.all([
    readPriceCsv(usCsvPath),
    readPriceCsv(jpCsvPath),
  ])

  const appRows = STOCK_LIST_400.filter((row) => row.region === 'US' || row.region === 'JP')
  const appSymbols = appRows.map((row) => ({
    symbol: normalizeSymbol(row.symbol),
    name: row.name || row.symbol,
    region: row.region,
  }))

  const missing = []
  const symbolRows = []
  const priceRows = []

  for (const row of appSymbols) {
    const sourceCsv = row.region === 'US' ? usCsv : jpCsv
    if (!sourceCsv.symbols.has(row.symbol)) {
      missing.push(row)
      continue
    }

    symbolRows.push({
      symbol: row.symbol,
      name: row.name,
      is_active: true,
    })

    for (const historyRow of sourceCsv.rows) {
      const close = historyRow.closeBySymbol.get(row.symbol)
      if (!Number.isFinite(close) || close <= 0) continue
      priceRows.push({
        source: 'marketstack',
        symbol: row.symbol,
        trade_date: historyRow.tradeDate,
        open: null,
        high: null,
        low: null,
        close,
        volume: null,
        raw: {
          imported_from: path.basename(sourceCsv.csvPath),
          imported_via: 'csv_backfill',
          close,
        },
      })
    }
  }

  const dedupSymbolRows = [...new Map(symbolRows.map((row) => [row.symbol, row])).values()]
  const dedupPriceRows = [...new Map(
    priceRows.map((row) => [`${row.source}|${row.symbol}|${row.trade_date}`, row])
  ).values()]

  console.log(`App symbols (US+JP): ${appSymbols.length}`)
  console.log(`Covered symbols: ${dedupSymbolRows.length}`)
  console.log(`Missing symbols: ${missing.length}`)
  if (missing.length > 0) {
    console.log(`Missing list: ${missing.map((row) => row.symbol).join(', ')}`)
  }
  console.log(`Price rows prepared: ${dedupPriceRows.length}`)

  if (dryRun) {
    console.log('Dry run only. No data written.')
    return
  }

  if (dedupSymbolRows.length > 0) {
    const { error } = await supabase
      .from('stock_symbols')
      .upsert(dedupSymbolRows, { onConflict: 'symbol' })
    if (error) throw error
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

  console.log('CSV backfill complete.')
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
