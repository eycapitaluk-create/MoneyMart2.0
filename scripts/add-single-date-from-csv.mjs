/**
 * CSV에서 특정 날짜(2025-03-13) 데이터만 추출해 Supabase에 추가
 * 실행: node scripts/add-single-date-from-csv.mjs [--date 2025-03-13]
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const US_CSV = process.argv.includes('--us-csv')
  ? process.argv[process.argv.indexOf('--us-csv') + 1]
  : '/Users/justinnam/Downloads/us_prices_final (1).csv'
const JP_CSV = process.argv.includes('--jp-csv')
  ? process.argv[process.argv.indexOf('--jp-csv') + 1]
  : '/Users/justinnam/Downloads/jp_prices_final (1).csv'
const TARGET_DATE = process.argv.includes('--date')
  ? process.argv[process.argv.indexOf('--date') + 1]
  : '2025-03-13'

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

const normalizeSymbol = (s) => {
  const u = String(s || '').trim().toUpperCase()
  return u === 'BRK-B' ? 'BRK.B' : u
}

const readCsvRowForDate = async (csvPath, targetDate) => {
  const raw = await fs.readFile(csvPath, 'utf8')
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return null

  const header = lines[0].split(',').map((c) => c.trim())
  const symbols = header.slice(1).map(normalizeSymbol).filter(Boolean)

  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((c) => c.trim())
    const rowDate = cells[0]
    if (rowDate !== targetDate) continue

    const priceRows = []
    for (let i = 0; i < symbols.length; i++) {
      const close = Number(cells[i + 1])
      if (!symbols[i] || !Number.isFinite(close) || close <= 0) continue
      priceRows.push({ symbol: symbols[i], close })
    }
    return { symbols, priceRows, region: csvPath.includes('jp_') ? 'JP' : 'US' }
  }
  return null
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log(`Extracting ${TARGET_DATE} from CSV...`)

  const readSafe = async (path) => {
    try {
      return await readCsvRowForDate(path, TARGET_DATE)
    } catch (e) {
      return null
    }
  }
  const [usData, jpData] = await Promise.all([
    readSafe(US_CSV),
    readSafe(JP_CSV),
  ])

  const priceRows = []
  const symbolRows = []

  for (const data of [usData, jpData]) {
    if (!data) continue
    for (const { symbol, close } of data.priceRows) {
      symbolRows.push({ symbol, name: symbol, is_active: true })
      priceRows.push({
        source: 'marketstack',
        symbol,
        trade_date: TARGET_DATE,
        open: null,
        high: null,
        low: null,
        close,
        volume: null,
        raw: { imported_via: 'add_single_date_csv', close },
      })
    }
  }

  if (priceRows.length === 0) {
    console.log(`No data found for ${TARGET_DATE} in CSV files`)
    return
  }

  const dedupSymbols = [...new Map(symbolRows.map((r) => [r.symbol, r])).values()]
  const dedupPrices = [...new Map(priceRows.map((r) => [`${r.symbol}`, r])).values()]

  console.log(`US: ${usData?.priceRows.length || 0}, JP: ${jpData?.priceRows.length || 0}`)
  console.log(`Upserting ${dedupPrices.length} price rows...`)

  const { error: symErr } = await supabase
    .from('stock_symbols')
    .upsert(dedupSymbols, { onConflict: 'symbol' })
  if (symErr) throw symErr

  const { error: priceErr } = await supabase
    .from('stock_daily_prices')
    .upsert(dedupPrices, { onConflict: 'source,symbol,trade_date' })
  if (priceErr) throw priceErr

  console.log(`Done. Added ${TARGET_DATE} for ${dedupPrices.length} symbols.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
