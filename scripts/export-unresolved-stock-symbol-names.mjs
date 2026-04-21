/**
 * Export unresolved ticker-only names from stock_symbols.
 *
 * Outputs:
 * - reports/unresolved_stock_symbol_names.json
 * - reports/unresolved_stock_symbol_names.csv
 * - reports/unresolved_stock_symbol_names_upsert_template.sql
 *
 * Usage:
 *   node scripts/export-unresolved-stock-symbol-names.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const REPORT_DIR = 'reports'
const JSON_OUT = path.join(REPORT_DIR, 'unresolved_stock_symbol_names.json')
const CSV_OUT = path.join(REPORT_DIR, 'unresolved_stock_symbol_names.csv')
const SQL_OUT = path.join(REPORT_DIR, 'unresolved_stock_symbol_names_upsert_template.sql')

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

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase()
const normalizeName = (value) => String(value || '').trim()

const isTickerLikeText = (value, symbol = '') => {
  const t = normalizeName(value)
  const s = normalizeSymbol(symbol)
  if (!t) return true
  if (s && t.toUpperCase() === s) return true
  if (/^\d{3,4}[A-Z]?\.T$/i.test(t)) return true
  if (/^[A-Z]{1,6}([.-][A-Z])?$/i.test(t)) return true
  return false
}

const fetchAllRows = async (queryBuilderFactory, pageSize = 1000) => {
  let from = 0
  const rows = []
  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await queryBuilderFactory().range(from, to)
    if (error) throw error
    const batch = Array.isArray(data) ? data : []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

const toCsvCell = (value) => {
  const s = String(value ?? '')
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const rows = await fetchAllRows(() =>
    supabase
      .from('stock_symbols')
      .select('symbol,name,exchange,currency,country,category,subcategory,isin,asset_type')
      .order('symbol', { ascending: true })
  )

  const unresolved = rows
    .map((row) => ({
      symbol: normalizeSymbol(row.symbol),
      name: normalizeName(row.name),
      exchange: normalizeName(row.exchange),
      currency: normalizeName(row.currency),
      country: normalizeName(row.country),
      category: normalizeName(row.category),
      subcategory: normalizeName(row.subcategory),
      isin: normalizeName(row.isin),
      asset_type: normalizeName(row.asset_type),
    }))
    .filter((row) => row.symbol && isTickerLikeText(row.name, row.symbol))

  await fs.mkdir(REPORT_DIR, { recursive: true })

  await fs.writeFile(JSON_OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: unresolved.length,
    rows: unresolved,
  }, null, 2), 'utf8')

  const csvHeader = ['symbol', 'name', 'exchange', 'currency', 'country', 'category', 'subcategory', 'isin', 'asset_type']
  const csvBody = unresolved
    .map((row) => csvHeader.map((k) => toCsvCell(row[k] || '')).join(','))
    .join('\n')
  await fs.writeFile(CSV_OUT, `${csvHeader.join(',')}\n${csvBody}\n`, 'utf8')

  const sampleRows = unresolved.slice(0, 30)
  const sqlTemplate = [
    '-- Fill Japanese names for unresolved ticker-only symbols.',
    '-- 1) Edit VALUES rows below (replace 日本語名プレースホルダ).',
    '-- 2) Run this SQL in Supabase SQL Editor.',
    '',
    'WITH name_map(symbol, name) AS (',
    '  VALUES',
    ...sampleRows.map((row, idx) => {
      const comma = idx === sampleRows.length - 1 ? '' : ','
      return `  ('${row.symbol.replace(/'/g, "''")}', '日本語名プレースホルダ')${comma}`
    }),
    ')',
    'UPDATE stock_symbols s',
    'SET name = nm.name',
    'FROM name_map nm',
    "WHERE s.symbol = nm.symbol",
    "  AND COALESCE(NULLIF(TRIM(nm.name), ''), '') <> '';",
    '',
    `-- unresolved count at export time: ${unresolved.length}`,
  ].join('\n')
  await fs.writeFile(SQL_OUT, `${sqlTemplate}\n`, 'utf8')

  console.log(`unresolved exported: ${unresolved.length}`)
  console.log(`json: ${JSON_OUT}`)
  console.log(`csv: ${CSV_OUT}`)
  console.log(`sql template: ${SQL_OUT}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

