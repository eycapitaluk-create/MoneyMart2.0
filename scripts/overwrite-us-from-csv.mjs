#!/usr/bin/env node
/**
 * us_prices_1year.csv로 미국 주식 1년치 데이터 Supabase에 덮어쓰기
 * 실행: node scripts/overwrite-us-from-csv.mjs
 * 또는: BACKFILL_US_CSV=/path/to/us_prices_1year.csv node scripts/overwrite-us-from-csv.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { STOCK_LIST_400 } from '../src/data/stockList400.js'

const DEFAULT_CSV = '/Users/justinnam/Downloads/us_prices_1year.csv'
const PRICE_UPSERT_BATCH_SIZE = 2000

const stripQuotes = (v = '') => {
  const s = String(v || '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    return s.slice(1, -1)
  return s
}

const loadEnv = async () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(f, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = stripQuotes(t.slice(eq + 1))
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch (_) {}
  }
}

const normalizeSymbol = (s = '') => {
  const u = String(s || '').trim().toUpperCase()
  if (u === 'BRK-B') return 'BRK.B'
  if (u === 'BF-B') return 'BRK.B'
  return u
}

const splitCsv = (line) => line.split(',').map((c) => c.trim())

const readCsv = async (csvPath) => {
  const raw = await fs.readFile(csvPath, 'utf8')
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error(`CSV has no data: ${csvPath}`)
  const header = splitCsv(lines[0])
  const symbols = header.slice(1).map(normalizeSymbol).filter(Boolean)
  const rows = []
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line)
    const tradeDate = cells[0]
    if (!tradeDate || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) continue
    const values = cells.slice(1)
    const closeBySymbol = new Map()
    header.slice(1).forEach((rawSym, i) => {
      const sym = normalizeSymbol(rawSym)
      const close = Number(values[i])
      if (sym && Number.isFinite(close) && close > 0) closeBySymbol.set(sym, close)
    })
    rows.push({ tradeDate, closeBySymbol })
  }
  return { symbols: new Set(symbols), rows }
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }
  const csvPath = process.env.BACKFILL_US_CSV || DEFAULT_CSV
  const dryRun = process.argv.includes('--dry-run')
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { symbols: csvSymbols, rows } = await readCsv(csvPath)
  const usAppSymbols = STOCK_LIST_400
    .filter((r) => r?.region === 'US')
    .map((r) => normalizeSymbol(r.symbol))
  const toImport = [...new Set(usAppSymbols.filter((s) => csvSymbols.has(s)))]
  const symbolRows = toImport.map((s) => ({ symbol: s, name: s, is_active: true }))
  const priceRows = []
  for (const sym of toImport) {
    for (const row of rows) {
      const close = row.closeBySymbol.get(sym)
      if (!Number.isFinite(close) || close <= 0) continue
      priceRows.push({
        source: 'marketstack',
        symbol: sym,
        trade_date: row.tradeDate,
        open: null,
        high: null,
        low: null,
        close,
        volume: null,
        raw: { imported_from: path.basename(csvPath), close },
      })
    }
  }
  const dedupMap = new Map()
  for (const r of priceRows) {
    const key = `${r.source}|${r.symbol}|${r.trade_date}`
    dedupMap.set(key, r)
  }
  const dedup = [...dedupMap.values()]
  console.log(`CSV: ${csvPath}`)
  console.log(`US symbols in app: ${usAppSymbols.length}`)
  console.log(`Covered by CSV: ${toImport.length}`)
  console.log(`Price rows: ${dedup.length}`)
  if (dryRun) {
    console.log('Dry run. No write.')
    return
  }
  if (symbolRows.length > 0) {
    const { error } = await supabase.from('stock_symbols').upsert(symbolRows, { onConflict: 'symbol' })
    if (error) throw error
  }
  const batches = chunk(dedup, PRICE_UPSERT_BATCH_SIZE)
  for (let i = 0; i < batches.length; i++) {
    const { error } = await supabase
      .from('stock_daily_prices')
      .upsert(batches[i], { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
    console.log(`Upserted batch ${i + 1}/${batches.length} (${batches[i].length} rows)`)
  }
  console.log('Done.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
