/**
 * JP StockPage 217銘柄を MarketStack EOD で指定日取得 → stock_daily_prices upsert
 *
 *   node scripts/import-jp-stocks-marketstack-date.mjs 2026-08-04
 *   node scripts/import-jp-stocks-marketstack-date.mjs 2026-08-04 --volume-xlsx=/path/jp_prices.xlsx
 *
 * Env: SUPABASE_URL, SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY, MARKETSTACK_ACCESS_KEY
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_SYMBOLS_FILE = path.join(__dirname, '../reports/STOCK_PAGE_STATIC_JP_SYMBOLS.txt')
const SOURCE = 'marketstack'
const CHUNK_SIZE = 20

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
    } else pos.push(a)
  }
  return { pos, flags }
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

const normalizeSymbolForStorage = (symbol) => {
  const s = String(symbol || '').trim().toUpperCase()
  if (!s) return ''
  if (s.endsWith('.XTKS')) return `${s.slice(0, -5)}.T`
  if (s.endsWith('.T')) return s
  if (/^\d{4}$/.test(s)) return `${s}.T`
  return s
}

const toMarketstackJpSymbol = (symbol) => normalizeSymbolForStorage(symbol)

const toDateOnly = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const pickReliableClose = (row) => {
  const candidates = [row?.close, row?.adj_close, row?.adjusted_close]
  for (const c of candidates) {
    const n = toNum(c)
    if (n != null && n > 0) return n
  }
  return null
}

const getJson = async (url, init) => {
  const res = await fetch(url, init)
  const json = await res.json()
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Request failed: ${res.status}`)
  }
  return json
}

const fetchJpEodChunk = async (key, symbols, tradeDate) => {
  const encodedKey = encodeURIComponent(key)
  const encodedSymbols = encodeURIComponent(symbols.join(','))
  const attempts = [
    { authQuery: `access_key=${encodedKey}&`, init: undefined },
    { authQuery: '', init: { headers: { apikey: key } } },
  ]
  const errors = []
  for (const { authQuery, init } of attempts) {
    const url = `https://api.marketstack.com/v2/eod/${tradeDate}?${authQuery}symbols=${encodedSymbols}&exchange=XTKS`
    try {
      const json = await getJson(url, init)
      const rows = Array.isArray(json?.data) ? json.data : []
      if (rows.length > 0) return rows
      errors.push('empty data')
    } catch (e) {
      errors.push(e.message)
    }
  }
  throw new Error(errors.join(' | '))
}

const loadSymbols = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8')
  return raw
    .split(/\r?\n/)
    .map((line) => normalizeSymbolForStorage(line.trim()))
    .filter(Boolean)
}

const loadVolumeMapFromXlsx = async (filePath, tradeDate) => {
  const wb = XLSX.readFile(filePath)
  const sh = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sh, { defval: '' })
  const map = new Map()
  for (const row of rows) {
    const sym = normalizeSymbolForStorage(row.symbol)
    const date = String(row.trade_date || row.date || '').slice(0, 10)
    if (!sym || date !== tradeDate) continue
    const vol = toNum(row.volume)
    if (vol != null && vol > 0) map.set(sym, Math.round(vol))
  }
  return map
}

const upsertBatches = async (admin, rows) => {
  const batchSize = 200
  let upserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await admin
      .from('stock_daily_prices')
      .upsert(batch, { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
    upserted += batch.length
  }
  return upserted
}

const main = async () => {
  await loadEnv()
  const { pos, flags } = parseFlags(process.argv.slice(2))
  const tradeDate = pos[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) {
    console.error('Usage: node scripts/import-jp-stocks-marketstack-date.mjs YYYY-MM-DD [--volume-xlsx=path]')
    process.exit(1)
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const msKey = process.env.MARKETSTACK_ACCESS_KEY || process.env.MARKETSTACK_API_KEY || process.env.MARKETSTACK_APIKEY
  if (!supabaseUrl || !serviceKey || !msKey) {
    throw new Error('Missing SUPABASE_URL / service role key / MARKETSTACK_ACCESS_KEY')
  }

  const symbolsFile = flags['symbols-file'] || DEFAULT_SYMBOLS_FILE
  const symbols = await loadSymbols(symbolsFile)
  const volumeXlsx = flags['volume-xlsx'] || ''
  const volumeMap = volumeXlsx ? await loadVolumeMapFromXlsx(volumeXlsx, tradeDate) : new Map()

  console.log(`Fetching ${symbols.length} JP symbols for ${tradeDate} via MarketStack (XTKS)...`)
  const admin = createClient(supabaseUrl, serviceKey)
  const apiRows = []
  const chunks = chunk(symbols, CHUNK_SIZE)
  for (let i = 0; i < chunks.length; i++) {
    const msSymbols = chunks[i].map(toMarketstackJpSymbol)
    const rows = await fetchJpEodChunk(msKey, msSymbols, tradeDate)
    apiRows.push(...rows)
    console.log(`  chunk ${i + 1}/${chunks.length}: ${rows.length} rows`)
  }

  const priceRows = []
  const missingClose = []
  for (const r of apiRows) {
    const symbol = normalizeSymbolForStorage(r?.symbol || r?.ticker)
    const rowDate = toDateOnly(r?.date)
    if (!symbol || rowDate !== tradeDate) continue
    const close = pickReliableClose(r)
    if (close == null) {
      missingClose.push(symbol)
      continue
    }
    const volume = volumeMap.get(symbol) ?? toNum(r?.volume)
    priceRows.push({
      source: SOURCE,
      symbol,
      trade_date: tradeDate,
      open: toNum(r?.open),
      high: toNum(r?.high),
      low: toNum(r?.low),
      close,
      volume: volume != null && volume > 0 ? Math.round(volume) : null,
      raw: r,
    })
  }

  const found = new Set(priceRows.map((r) => r.symbol))
  const notReturned = symbols.filter((s) => !found.has(s))
  if (notReturned.length > 0) {
    console.warn(`No MarketStack close for ${notReturned.length} symbols:`, notReturned.slice(0, 10).join(', '), notReturned.length > 10 ? '...' : '')
  }

  if (priceRows.length === 0) {
    throw new Error('No valid price rows to upsert')
  }

  const upserted = await upsertBatches(admin, priceRows)
  console.log(`Done. Upserted ${upserted} rows (${SOURCE}, ${tradeDate}) from ${symbols.length} universe symbols.`)
  if (volumeMap.size > 0) {
    console.log(`Volume overrides from xlsx: ${volumeMap.size} symbols`)
  }
  if (missingClose.length > 0) {
    console.log(`Dropped rows without close: ${missingClose.length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
