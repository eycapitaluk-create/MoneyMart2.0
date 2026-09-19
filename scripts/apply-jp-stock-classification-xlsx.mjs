/**
 * 「jp stock data classification」xlsx → stock_symbol_profiles の sector/industry/name を反映。
 *
 * sector 適用規則: NEW が非空白なら NEW、否则は旧 segment カラムの sector を使用。
 * （NEW は東証系の整理ラベルを想定した列）
 *
 *   node scripts/apply-jp-stock-classification-xlsx.mjs [path/to.xlsx] [--dry-run]
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY（または SUPABASE_SECRET_KEY）
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { normalizeSectorForDb } from '../src/lib/stockSectorNormalize.js'

const DEFAULT_XLSX = '/Users/justinnam/Downloads/jp stock data classification.xlsx'

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

const clean = (v) => {
  if (v == null) return ''
  const s = String(v).trim()
  return s
}

const parseFlags = (argv) => {
  const pos = []
  for (const a of argv) {
    if (a.startsWith('--')) continue
    pos.push(a)
  }
  return pos
}

const run = async () => {
  await loadEnv()
  const url = process.env.SUPABASE_URL?.trim()
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !key) throw new Error('Missing SUPABASE_URL and service key')

  const dryRun = process.argv.includes('--dry-run')
  const pos = parseFlags(process.argv.slice(2))
  const xlsxPath = pos[0] || DEFAULT_XLSX
  const fileBase = path.basename(xlsxPath)

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true })

  const headerIdx = rows.findIndex(
    (r) => Array.isArray(r) && String(r[0] || '').trim().toLowerCase() === 'symbol',
  )
  if (headerIdx < 0) throw new Error('header row with "symbol" not found')

  /** @type {{ symbol: string, sector: string|null, industry: string|null, name_jp: string|null, name_en: string|null, asset_type: string }[]} */
  const parsed = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const symbol = clean(r[0]).toUpperCase()
    if (!symbol || !symbol.endsWith('.T')) continue

    const sectorCol = clean(r[1])
    const newCol = clean(r[2])
    const effectiveSector = newCol || sectorCol || ''

    const industry = clean(r[3]) || null
    const nameJpRaw = clean(r[4])
    const nameEnRaw = clean(r[5])
    const assetRaw = clean(r[6]).toLowerCase()
    const asset_type = assetRaw === 'etf' ? 'etf' : 'stock'

    parsed.push({
      symbol,
      sector: normalizeSectorForDb(effectiveSector),
      industry,
      name_jp: nameJpRaw || null,
      name_en: nameEnRaw || null,
      asset_type,
    })
  }

  if (parsed.length === 0) {
    console.log('No .T rows to apply')
    return
  }

  console.log(`Parsed ${parsed.length} rows from ${fileBase}`)

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  /** @type {Set<string>} */
  const symbolsInStockSymbols = new Set()
  {
    const need = [...new Set(parsed.map((x) => x.symbol))]
    const chunk = 500
    for (let i = 0; i < need.length; i += chunk) {
      const { data, error } = await supabase
        .from('stock_symbols')
        .select('symbol')
        .in('symbol', need.slice(i, i + chunk))
      if (error) throw error
      ;(data || []).forEach((row) => symbolsInStockSymbols.add(String(row.symbol)))
    }
  }

  const filtered = parsed.filter((r) => symbolsInStockSymbols.has(r.symbol))
  if (filtered.length < parsed.length) {
    console.log(
      `Skip ${parsed.length - filtered.length} symbols not in stock_symbols; applying ${filtered.length}`,
    )
  }

  /** @type {Map<string, object>} */
  const existingMap = new Map()
  const symList = [...new Set(filtered.map((x) => x.symbol))]
  const pg = 200
  for (let i = 0; i < symList.length; i += pg) {
    const { data, error } = await supabase
      .from('stock_symbol_profiles')
      .select(
        'symbol,region,priority,index_tag,market_cap,name_jp,name_en,sector,industry,asset_type',
      )
      .in('symbol', symList.slice(i, i + pg))
    if (error) throw error
    ;(data || []).forEach((row) => existingMap.set(String(row.symbol).toUpperCase(), row))
  }

  const REGION_JP = 'JP'
  const merged = []

  for (const row of filtered) {
    const prev = existingMap.get(row.symbol) || {}
    const nameJp = row.name_jp ?? prev.name_jp ?? null
    const nameEn = row.name_en ?? prev.name_en ?? null
    merged.push({
      symbol: row.symbol,
      region: prev.region || REGION_JP,
      sector: row.sector,
      industry: row.industry ?? prev.industry ?? null,
      name_jp: nameJp,
      name_en: nameEn,
      asset_type: row.asset_type,
      priority: Number.isFinite(Number(prev.priority)) ? Number(prev.priority) : 9999,
      index_tag: prev.index_tag ?? null,
      market_cap: prev.market_cap ?? null,
    })
  }

  const sampleChanged = []
  for (const m of merged) {
    const p = existingMap.get(m.symbol)
    if (!p) continue
    if (String(p.sector || '') !== String(m.sector || '')) {
      sampleChanged.push({ symbol: m.symbol, before: p.sector, after: m.sector })
    }
  }
  console.log(
    `Sector label changes (sample up to 12):`,
    sampleChanged.slice(0, 12),
    sampleChanged.length > 12 ? `… +${sampleChanged.length - 12} more` : '',
  )

  if (dryRun) {
    console.log('Dry run — no DB write. First merged row:', merged[0])
    return
  }

  const BATCH = 150
  let done = 0
  for (let i = 0; i < merged.length; i += BATCH) {
    const batch = merged.slice(i, i + BATCH)
    const { error } = await supabase.from('stock_symbol_profiles').upsert(batch, {
      onConflict: 'symbol',
    })
    if (error) throw error
    done += batch.length
    process.stdout.write(`\r  Upserted ${done}/${merged.length}`)
  }
  console.log(`\nDone. ${done} rows (sector from NEW || sector column in ${fileBase}).`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
