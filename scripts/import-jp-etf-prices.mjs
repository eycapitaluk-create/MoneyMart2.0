import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const csvPath = process.argv[2] || '/Users/justinnam/Downloads/jp_etf_prices.csv'
const symbolsSqlPath = path.resolve(projectRoot, 'new_etf_symbols.sql')

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const parseCsv = (raw) => {
  const lines = raw.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('CSV has no data rows')

  const headers = lines[0].split(',').map((value) => value.trim())
  const symbols = headers.slice(1)
  const rows = []

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = line.split(',')
    const tradeDate = (cells[0] || '').trim()
    if (!tradeDate) continue

    for (let index = 1; index < headers.length; index += 1) {
      const symbol = symbols[index - 1]
      const rawValue = (cells[index] || '').trim()
      if (!symbol || !rawValue) continue

      const close = Number(rawValue)
      if (!Number.isFinite(close)) continue

      rows.push({
        source: 'jp_etf_csv',
        symbol,
        trade_date: tradeDate,
        open: close,
        high: close,
        low: close,
        close,
        volume: null,
        raw: {
          source: 'jp_etf_csv',
          imported_from: path.basename(csvPath),
          close,
        },
      })
    }
  }

  return { symbols, rows }
}

const parseSymbolMetadata = (raw) => {
  const metadata = new Map()
  const regex = /\('([^']+)', '([^']+)', ([^,]+), '([^']+)', true\)/g
  let match = regex.exec(raw)

  while (match) {
    const [, symbol, name, nisaCategoryRaw, exchange] = match
    const nisaCategory = nisaCategoryRaw === 'NULL' ? null : nisaCategoryRaw.replace(/^'|'$/g, '')
    metadata.set(symbol, {
      symbol,
      name,
      exchange,
      currency: 'JPY',
      is_active: true,
      asset_type: 'fund',
      country: 'JP',
      raw_ticker: symbol.replace(/\.T$/i, ' JP'),
      nisa_category: nisaCategory,
    })
    match = regex.exec(raw)
  }

  return metadata
}

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const main = async () => {
  const [csvRaw, symbolSqlRaw] = await Promise.all([
    fs.readFile(csvPath, 'utf8'),
    fs.readFile(symbolsSqlPath, 'utf8'),
  ])

  const { symbols, rows } = parseCsv(csvRaw)
  const symbolMetadata = parseSymbolMetadata(symbolSqlRaw)

  const symbolRows = symbols.map((symbol) => {
    const meta = symbolMetadata.get(symbol)
    return {
      symbol,
      name: meta?.name || symbol,
      exchange: meta?.exchange || 'XJPX',
      currency: meta?.currency || 'JPY',
      is_active: true,
      asset_type: 'fund',
      country: 'JP',
      raw_ticker: meta?.raw_ticker || symbol.replace(/\.T$/i, ' JP'),
      nisa_category: meta?.nisa_category || null,
    }
  })

  const symbolChunks = chunk(symbolRows, 200)
  const priceChunks = chunk(rows, 1000)

  for (const batch of symbolChunks) {
    const { error } = await supabase.from('stock_symbols').upsert(batch, { onConflict: 'symbol' })
    if (error) throw error
  }

  for (const batch of priceChunks) {
    const { error } = await supabase
      .from('stock_daily_prices')
      .upsert(batch, { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
  }

  const summary = {
    symbols: symbolRows.length,
    priceRows: rows.length,
    firstDate: rows[0]?.trade_date || null,
    lastDate: rows[rows.length - 1]?.trade_date || null,
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
