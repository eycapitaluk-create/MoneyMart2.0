/**
 * SPX 등 multi-symbol xlsx: right-side ticker table = Ticker_1/Check + Sector (GICS 영문)
 * → stock_symbol_profiles.sector 만 일본어로 업데이트 (name_jp/name_en 은 변경 안 함)
 *
 * 사용:
 *   node scripts/update-us-sectors-from-spx-xlsx.mjs "/path/to.xlsx" [--dry-run]
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 SUPABASE_SECRET_KEY)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

/** stock_daily_prices / profiles 와 동일한 티커 정규화 */
const normalizeTickerForDb = (raw) => {
  const u = String(raw ?? '').trim().toUpperCase()
  if (!u) return ''
  if (u === 'BRK/B' || u === 'BRK-B') return 'BRK.B'
  if (u === 'BF/B' || u === 'BF-B' || u === 'BF.B') return 'BF-B'
  if (u.includes('/')) return u.replace(/\//g, '-')
  return u
}

/** GICS 11 sectors → StockPage.jsx normalizeSectorName 과 동일 계열 일본어 */
const GICS_EN_TO_JA = {
  'Communication Services': 'コミュニケーション',
  'Consumer Discretionary': '一般消費財',
  'Consumer Staples': '生活必需品',
  Energy: 'エネルギー',
  Financials: '金融',
  'Health Care': 'ヘルスケア',
  Industrials: '資本財・産業',
  'Information Technology': 'テクノロジー',
  Materials: '素材',
  'Real Estate': '不動産',
  Utilities: '公益',
}

const pickSheetRows = (wb) => {
  const dataSheet = wb.Sheets.data || wb.Sheets[wb.SheetNames[0]]
  const objectRows = XLSX.utils.sheet_to_json(dataSheet, { defval: null, raw: false })
  const hasTickerSector = objectRows.some((row) => row?.Sector && (row?.Ticker_1 || row?.Check || row?.Ticker))
  if (hasTickerSector) {
    return objectRows.map((row) => ({
      symbol: row.Ticker_1 || row.Check || row.Ticker,
      sector: row.Sector,
    }))
  }

  const sheet3 = wb.Sheets.Sheet3
  if (sheet3) {
    return XLSX.utils.sheet_to_json(sheet3, { defval: null, raw: false }).map((row) => ({
      symbol: row.__EMPTY || row.Ticker,
      sector: row.__EMPTY_1,
    }))
  }

  throw new Error('Could not find ticker/sector columns. Expected data!Ticker_1/Sector or Sheet3!__EMPTY/__EMPTY_1.')
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
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch {}
  }
}

const run = async () => {
  await loadEnv()
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
  const dryRun = process.argv.includes('--dry-run')
  const xlsxPath = args.find((a) => !a.startsWith('--'))
  if (!xlsxPath) {
    console.error('Usage: node scripts/update-us-sectors-from-spx-xlsx.mjs <file.xlsx> [--dry-run]')
    process.exit(1)
  }

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const rows = pickSheetRows(wb)
  if (rows.length < 2) throw new Error('empty sheet')

  const symbolToSectorJa = new Map()
  const unknownSectors = new Set()
  let skippedEmptySector = 0

  for (const r of rows) {
    const enSector = String(r.sector ?? '').trim()
    if (!enSector) {
      skippedEmptySector++
      continue
    }
    const sym = normalizeTickerForDb(r.symbol)
    if (!sym) continue
    const ja = GICS_EN_TO_JA[enSector]
    if (!ja) unknownSectors.add(enSector)
    else symbolToSectorJa.set(sym, ja)
  }

  if (unknownSectors.size) {
    throw new Error(`Unknown Sector labels (column N): ${[...unknownSectors].sort().join(', ')}`)
  }

  console.log(
    `Parsed ${symbolToSectorJa.size} symbols with sector; skipped ${skippedEmptySector} rows (empty column N) — ${path.basename(xlsxPath)}`,
  )

  if (dryRun) {
    console.log('Dry run. Sample:', [...symbolToSectorJa.entries()].slice(0, 8))
    return
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, key)
  const symbols = [...symbolToSectorJa.keys()]
  const profileSector = new Map()
  const FETCH = 250

  for (let i = 0; i < symbols.length; i += FETCH) {
    const batch = symbols.slice(i, i + FETCH)
    const { data, error } = await supabase.from('stock_symbol_profiles').select('symbol,sector').in('symbol', batch)
    if (error) throw error
    for (const row of data || []) profileSector.set(row.symbol, row.sector ?? '')
  }

  const toUpdate = []
  let noProfile = 0
  let unchanged = 0

  for (const [sym, ja] of symbolToSectorJa) {
    if (!profileSector.has(sym)) {
      noProfile++
      continue
    }
    const cur = String(profileSector.get(sym) ?? '').trim()
    if (cur === ja) unchanged++
    else toUpdate.push([sym, ja])
  }

  const PAR = 35
  let updated = 0
  for (let i = 0; i < toUpdate.length; i += PAR) {
    const slice = toUpdate.slice(i, i + PAR)
    await Promise.all(
      slice.map(async ([sym, ja]) => {
        const { error } = await supabase.from('stock_symbol_profiles').update({ sector: ja }).eq('symbol', sym)
        if (error) throw error
      }),
    )
    updated += slice.length
    process.stdout.write(`\r  sector updates ${updated}/${toUpdate.length}`)
  }
  if (toUpdate.length) console.log()

  console.log(`Done. Updated ${updated}; unchanged (already correct): ${unchanged}; no profile row: ${noProfile}.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
