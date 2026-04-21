/**
 * stock_symbol_profiles_final.csv → Supabase stock_symbol_profiles 업데이트
 * 실행: node scripts/import-stock-symbol-profiles.mjs [--dry-run]
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_CSV = '/Users/justinnam/Downloads/stock_symbol_profiles_final.csv'
const DEFAULT_ENV_FILES = ['.env.local', '.env']

const stripQuotes = (v = '') => {
  const t = String(v || '').trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
    return t.slice(1, -1)
  return t
}

const loadEnv = async () => {
  for (const f of DEFAULT_ENV_FILES) {
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
    } catch {}
  }
}

const parseCsvLine = (line) => {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQ = !inQ
    } else if ((c === ',' && !inQ) || c === '\n' || c === '\r') {
      out.push(cur.trim())
      cur = ''
      if (c !== ',') break
    } else {
      cur += c
    }
  }
  if (cur !== '' || out.length > 0) out.push(cur.trim())
  return out
}

const run = async () => {
  await loadEnv()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const csvPath = process.env.STOCK_PROFILES_CSV || DEFAULT_CSV
  const dryRun = process.argv.includes('--dry-run')

  if (!url || !key) throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')

  const raw = await fs.readFile(csvPath, 'utf8')
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('CSV needs header + rows')

  const header = parseCsvLine(lines[0])
  const symbolIdx = header.findIndex((h) => /symbol/i.test(h))
  const regionIdx = header.findIndex((h) => /region/i.test(h))
  const sectorIdx = header.findIndex((h) => /sector/i.test(h))
  const industryIdx = header.findIndex((h) => /industry/i.test(h))
  const priorityIdx = header.findIndex((h) => /priority/i.test(h))
  const assetIdx = header.findIndex((h) => /asset_type/i.test(h))
  const indexIdx = header.findIndex((h) => /index_tag/i.test(h))
  const capIdx = header.findIndex((h) => /market_cap/i.test(h))

  if (symbolIdx < 0) throw new Error('CSV must have symbol column')

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const symbol = (cells[symbolIdx] || '').trim()
    if (!symbol) continue

    const region = (cells[regionIdx] || 'US').trim().toUpperCase().slice(0, 2)
    const sector = (cells[sectorIdx] || '').trim() || null
    const industry = (cells[industryIdx] || '').trim() || null
    const priority = Number(cells[priorityIdx])
    const assetType = (cells[assetIdx] || 'stock').trim().toLowerCase()
    const indexTag = (cells[indexIdx] || '').trim() || null
    const marketCap = cells[capIdx] ? Number(cells[capIdx]) : null

    rows.push({
      symbol,
      region: ['US', 'JP', 'UK', 'EU'].includes(region) ? region : 'US',
      sector,
      industry,
      priority: Number.isFinite(priority) ? priority : 9999,
      asset_type: ['stock', 'etf'].includes(assetType) ? assetType : 'stock',
      index_tag: indexTag,
      market_cap: Number.isFinite(marketCap) ? marketCap : null,
    })
  }

  console.log(`Parsed ${rows.length} rows from ${csvPath}`)

  if (dryRun) {
    console.log('Dry run. Sample:', rows.slice(0, 3))
    return
  }

  const supabase = createClient(url, key)

  // stock_symbol_profiles references stock_symbols - only upsert symbols that exist
  const { data: existingSymbols } = await supabase.from('stock_symbols').select('symbol')
  const existingSet = new Set((existingSymbols || []).map((r) => r.symbol))
  const filtered = rows.filter((r) => existingSet.has(r.symbol))
  if (filtered.length < rows.length) {
    console.log(`Filtered to ${filtered.length} rows (${rows.length - filtered.length} symbols not in stock_symbols)`)
  }

  const BATCH = 200
  let upserted = 0
  for (let i = 0; i < filtered.length; i += BATCH) {
    const batch = filtered.slice(i, i + BATCH)
    const { error } = await supabase
      .from('stock_symbol_profiles')
      .upsert(batch, { onConflict: 'symbol' })
    if (error) {
      console.error('Batch error:', error.message)
      throw error
    }
    upserted += batch.length
    process.stdout.write(`\r  Upserted ${upserted}/${filtered.length}`)
  }
  console.log('\nDone.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
