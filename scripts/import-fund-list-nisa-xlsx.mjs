/**
 * fund_list_nisa_*.xlsx → stock_symbols upsert（銘柄・ISIN・ファンド名JP・NISA区分）
 *
 * 想定ヘッダー: 銘柄, 証券コード, ISIN, ファンド名JP, NISA区分, Official Name（任意・Ｆ列）
 * stock_symbols.name には Official Name があればそれを、無ければファンド名JP を使う。
 * （英語 symbol, isin, name / fund_name でも可）
 *
 *   node scripts/import-fund-list-nisa-xlsx.mjs /path/to.xlsx
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { normalizeFundDisplayNamePlain, normalizeNisaCategoryField } from '../src/lib/textEncodingUtils.js'

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

const normHeader = (h) => String(h || '').trim().toLowerCase().replace(/\s+/g, '_')

/** 列インデックス解決（日本語・英語） */
const resolveColumns = (headerRow) => {
  const idx = new Map()
  headerRow.forEach((h, i) => {
    const k = normHeader(h)
    const raw = String(h || '').trim()
    if (k) idx.set(k, i)
    if (raw) idx.set(raw, i)
  })
  const pick = (...keys) => {
    for (const key of keys) {
      const lo = normHeader(key)
      if (idx.has(lo)) return idx.get(lo)
      if (idx.has(key)) return idx.get(key)
    }
    return undefined
  }
  return {
    symbol:
      pick('symbol', 'ticker', '銘柄'),
    isin:
      pick('isin', 'is_in', 'ISIN'),
    name:
      pick('name', 'fund_name', 'ファンド名jp', 'ファンド名', 'jp_name'),
    officialName:
      pick('official_name', 'official name', 'officialname'),
    nisa:
      pick('nisa_category', 'nisa', 'nisa区分', 'NISA区分'),
  }
}

const cellStr = (v) => {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }

  const xlsxPath = process.argv[2]
  if (!xlsxPath) {
    console.error('Usage: node scripts/import-fund-list-nisa-xlsx.mjs <file.xlsx>')
    process.exit(1)
  }

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const sheetName =
    wb.SheetNames.includes('fund_list') ? 'fund_list' : wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const headerRow = matrix[0] || []
  const col = resolveColumns(headerRow)
  if (col.symbol === undefined) {
    throw new Error(`銘柄 / symbol 列が必要です。ヘッダー: ${headerRow.join(', ')}`)
  }

  const rows = []
  for (let r = 1; r < matrix.length; r += 1) {
    const row = matrix[r]
    if (!row || !row.length) continue
    const symbol = cellStr(row[col.symbol]).toUpperCase()
    if (!symbol) continue
    const isin = col.isin !== undefined ? cellStr(row[col.isin]).toUpperCase() : ''
    const nameJp = col.name !== undefined ? cellStr(row[col.name]) : ''
    const official =
      col.officialName !== undefined ? cellStr(row[col.officialName]) : ''
    const displayNameRaw = (official || nameJp).trim()
    const displayName = normalizeFundDisplayNamePlain(displayNameRaw) || displayNameRaw || symbol
    const nisaRaw = col.nisa !== undefined ? cellStr(row[col.nisa]) : ''
    let nisaNorm = normalizeNisaCategoryField(nisaRaw || '-')
    if (['1540.T', '1541.T', '1542.T', '1543.T'].includes(symbol)) {
      nisaNorm = normalizeNisaCategoryField('成長')
    }
    const rec = {
      symbol,
      name: displayName || symbol,
      is_active: true,
    }
    if (isin) rec.isin = isin
    if (nisaNorm && nisaNorm !== '-') rec.nisa_category = nisaNorm
    rows.push(rec)
  }

  if (rows.length === 0) {
    console.log('No data rows')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const chunk = 200
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk)
    const { error } = await supabase.from('stock_symbols').upsert(batch, { onConflict: 'symbol' })
    if (error) throw error
  }

  console.log(`Done. Upserted ${rows.length} stock_symbols from ${path.basename(xlsxPath)}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
