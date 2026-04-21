/**
 * stock_symbol_profiles_final (1).numbers → Supabase stock_symbol_profiles 업데이트
 * name_jp, name_en 포함. Python numbers-parser 필요: pip install numbers-parser
 *
 * 1) 먼저 마이그레이션 실행 (Supabase SQL Editor):
 *    SUPABASE_ALTER_STOCK_SYMBOL_PROFILES_NAMES.sql 내용 실행
 *
 * 2) 실행: node scripts/import-stock-symbol-profiles-from-numbers.mjs [--dry-run]
 */
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'

const NUMBERS_PATH = '/Users/justinnam/Downloads/stock_symbol_profiles_final (1).numbers'
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

/** Run Python to extract Numbers → JSON */
const extractNumbersToJson = () =>
  new Promise((resolve, reject) => {
    const py = spawn('python3', [
      '-c', `
from numbers_parser import Document
import json
doc = Document("${NUMBERS_PATH.replace(/\\/g, '/')}")
t = doc.sheets[0].tables[0]
rows = []
for r in range(t.num_rows):
  row = [t.cell(r, c).value for c in range(t.num_cols)]
  if r == 0:
    headers = [str(x or '').strip() for x in row]
    continue
  vals = {}
  for i, h in enumerate(headers):
    v = row[i] if i < len(row) else None
    if v is not None and isinstance(v, (int, float)) and not isinstance(v, bool):
      vals[h] = v
    else:
      vals[h] = str(v).strip() if v else ''
  if vals.get('symbol'):
    rows.append(vals)
print(json.dumps(rows, ensure_ascii=False))
`,
    ])
    let out = ''
    let err = ''
    py.stdout.on('data', (d) => { out += d })
    py.stderr.on('data', (d) => { err += d })
    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python exit ${code}: ${err || out}`))
      } else {
        try {
          resolve(JSON.parse(out))
        } catch (e) {
          reject(new Error(`Parse JSON failed: ${e.message}\n${out.slice(0, 500)}`))
        }
      }
    })
  })

const run = async () => {
  await loadEnv()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const dryRun = process.argv.includes('--dry-run')

  if (!url || !key) throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')

  console.log('Extracting from Numbers...')
  const rawRows = await extractNumbersToJson()
  console.log(`Parsed ${rawRows.length} rows`)

  const rows = rawRows.map((r) => {
    const symbol = String(r.symbol || '').trim()
    if (!symbol) return null
    const region = String(r.region || 'US').toUpperCase().slice(0, 2)
    const sector = (r.sector && String(r.sector).trim()) || null
    const industry = (r.industry && String(r.industry).trim()) || null
    const priority = Number(r.priority)
    const assetType = String(r.asset_type || 'stock').toLowerCase()
    const indexTag = (r.index_tag && String(r.index_tag).trim()) || null
    const marketCap = r.market_cap != null && Number.isFinite(Number(r.market_cap)) ? Number(r.market_cap) : null
    const nameJp = (r.name_jp && String(r.name_jp).trim()) || null
    const nameEn = (r.name_en && String(r.name_en).trim()) || null

    return {
      symbol,
      region: ['US', 'JP', 'UK', 'EU'].includes(region) ? region : 'US',
      sector,
      industry,
      priority: Number.isFinite(priority) ? priority : 9999,
      asset_type: ['stock', 'etf'].includes(assetType) ? assetType : 'stock',
      index_tag: indexTag,
      market_cap: Number.isFinite(marketCap) ? marketCap : null,
      name_jp: nameJp,
      name_en: nameEn,
    }
  }).filter(Boolean)

  if (dryRun) {
    console.log('Dry run. Sample:', rows.slice(0, 3))
    return
  }

  const supabase = createClient(url, key)

  const { data: existingSymbols } = await supabase.from('stock_symbols').select('symbol')
  const existingSet = new Set((existingSymbols || []).map((r) => r.symbol))
  const missing = rows.filter((r) => !existingSet.has(r.symbol))
  if (missing.length > 0) {
    console.log(`Adding ${missing.length} missing symbols to stock_symbols first...`)
    const EXCHANGE_BY_REGION = { US: 'XNAS', JP: 'XTKS', UK: 'XLON', EU: 'XFRA' }
    const CURRENCY_BY_REGION = { US: 'USD', JP: 'JPY', UK: 'GBP', EU: 'EUR' }
    const symbolRows = missing.map((r) => ({
      symbol: r.symbol,
      name: r.name_en || r.name_jp || r.symbol,
      exchange: EXCHANGE_BY_REGION[r.region] || 'XNAS',
      currency: CURRENCY_BY_REGION[r.region] || 'USD',
      is_active: true,
    }))
    for (let i = 0; i < symbolRows.length; i += 100) {
      const batch = symbolRows.slice(i, i + 100)
      const { error } = await supabase.from('stock_symbols').upsert(batch, { onConflict: 'symbol' })
      if (error) {
        console.error('stock_symbols upsert error:', error.message)
        throw error
      }
      process.stdout.write(`\r  Added ${Math.min(i + 100, symbolRows.length)}/${symbolRows.length} symbols`)
    }
    console.log('\n')
  }

  const BATCH = 200
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('stock_symbol_profiles')
      .upsert(batch, { onConflict: 'symbol' })
    if (error) {
      console.error('Batch error:', error.message)
      throw error
    }
    upserted += batch.length
    process.stdout.write(`\r  Upserted ${upserted}/${rows.length}`)
  }
  console.log('\nDone.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
