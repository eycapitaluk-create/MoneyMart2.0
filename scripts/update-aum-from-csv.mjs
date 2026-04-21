/**
 * Transformed_ETF_Universe_Fully_Corrected (1).csv → Supabase stock_symbols.aum 업데이트
 * NEW AUM 컬럼 기준
 * 실행: node scripts/update-aum-from-csv.mjs [--dry-run]
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_CSV = '/Users/justinnam/Downloads/Transformed_ETF_Universe_Fully_Corrected (1).csv'
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
    } else if (c === ',' && !inQ) {
      out.push(cur.trim())
      cur = ''
    } else if (c === '\n' || c === '\r') {
      out.push(cur.trim())
      cur = ''
      break
    } else {
      cur += c
    }
  }
  if (cur !== '' || out.length > 0) out.push(cur.trim())
  return out
}

const parseAum = (val) => {
  if (val == null || val === '') return null
  let s = String(val).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  s = s.replace(/\s/g, '').replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const run = async () => {
  await loadEnv()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const csvPath = process.env.AUM_CSV || DEFAULT_CSV
  const dryRun = process.argv.includes('--dry-run')

  if (!url || !key) throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')

  const raw = await fs.readFile(csvPath, 'utf8')
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('CSV needs header + rows')

  const header = parseCsvLine(lines[0])
  const symbolIdx = header.findIndex((h) => /^symbol$/i.test(h.trim()))
  const newAumIdx = header.findIndex((h) => /NEW\s*AUM/i.test(String(h).trim()))

  if (symbolIdx < 0) throw new Error('CSV must have symbol column')
  if (newAumIdx < 0) throw new Error('CSV must have NEW AUM column')

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const symbol = (cells[symbolIdx] || '').trim()
    if (!symbol) continue
    const aum = parseAum(cells[newAumIdx])
    if (aum == null) continue
    rows.push({ symbol, aum })
  }

  console.log(`Parsed ${rows.length} rows with NEW AUM from ${csvPath}`)

  if (dryRun) {
    console.log('Dry run. Sample:', rows.slice(0, 5))
    return
  }

  const supabase = createClient(url, key)

  let updated = 0
  for (const { symbol, aum } of rows) {
    const { error } = await supabase
      .from('stock_symbols')
      .update({ aum })
      .eq('symbol', symbol)
    if (!error) updated += 1
    if (updated % 50 === 0) process.stdout.write(`\r  Updated ${updated}/${rows.length}`)
  }
  console.log(`\nDone. Updated ${updated}/${rows.length} stock_symbols.aum`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
