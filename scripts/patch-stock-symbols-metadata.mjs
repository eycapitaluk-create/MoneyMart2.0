/**
 * stock_symbols 의 메타만 부분 업데이트 (다른 컬럼은 건드리지 않음)
 *
 * 지원: .csv / .xlsx (Numbers → 파일 →보내기 → CSV 또는 Excel)
 * .numbers 는 이 스크립트에서 직접 읽을 수 없음 → 먼저 CSV/XLSX 로보내기
 *
 * 필수 키 컬럼(하나): symbol | isin
 * 선택 업데이트 컬럼: nisa_category, country, category
 *   - 셀이 비어 있으면 해당 컬럼은 스킵(기존 DB 값 유지)
 *   - 공백만 있으면 스킵
 *
 * 실행:
 *   node scripts/patch-stock-symbols-metadata.mjs /path/to/export.csv
 *   node scripts/patch-stock-symbols-metadata.mjs /path/to/export.csv --dry-run
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { recoverMojibakeUtf8FromLatin1 } from '../src/lib/textEncodingUtils.js'

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

const normKey = (h) =>
  String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')

const cellStr = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return s
}

/** "1306 JP" → "1306.T" (선택적; DB 심볼 형식 맞출 때) */
const maybeNormalizeSymbol = (s) => {
  const t = String(s || '').trim()
  const m = /^(\d+)\s+JP$/i.exec(t)
  if (m) return `${m[1]}.T`
  return t
}

const META_FIELDS = ['nisa_category', 'country', 'category']

const normalizeCountryToJa = (raw) => {
  const src = String(raw || '').trim().normalize('NFKC')
  if (!src || /^#?N\/?A$/i.test(src)) return ''
  const cc = src.toUpperCase().replace(/\s+/g, '')
  if (cc === 'JP' || cc === 'JPN' || cc === 'JAPAN' || cc === 'DOMESTIC' || cc === 'LOCAL' || /日本|国内/.test(src)) return '日本'
  if (cc === 'US' || cc === 'USA' || /米国|アメリカ/.test(src)) return '米国'
  if (cc === 'GLOBAL' || cc === 'WORLD' || cc === 'WORLDWIDE' || cc === 'INTL' || cc === 'INTERNATIONAL' || /全世界|グローバル|海外/.test(src)) return '全世界'
  if (cc === 'EM' || cc === 'EMERGING' || /新興国/.test(src)) return '新興国'
  if (cc === 'CN' || cc === 'CHINA' || /中国/.test(src)) return '中国'
  if (cc === 'IN' || cc === 'INDIA' || /インド/.test(src)) return 'インド'
  if (cc === 'EU' || cc === 'EUROPE' || /欧州/.test(src)) return '欧州'
  if (cc === 'UK' || cc === 'GB' || /英国/.test(src)) return '英国'
  if (cc === 'REIT' || /REIT|リート/.test(src)) return 'REIT'
  if (cc === 'COMMODITY' || cc === 'COMMODITIES' || /コモディティ|商品/.test(src)) return 'コモディティ'
  if (cc === 'FX' || cc === 'FOREX' || /為替/.test(src)) return 'FX'
  if (/高配当/.test(src)) return '高配当'
  return src
}

const normalizeNisaToJa = (raw) => {
  const src = String(raw || '').trim().normalize('NFKC')
  if (!src || src === '-' || /^#?N\/?A$/i.test(src)) return '-'
  if (/(対象外|INELIGIBLE|EXCLUDED|NON[-\s]?NISA)/i.test(src)) return 'NISA対象外'
  if (/(つみたて|積立|SAVINGS)/i.test(src) && /(成長|GROWTH)/i.test(src)) return 'つみたて・成長'
  if (/(つみたて|積立|SAVINGS)/i.test(src)) return 'つみたて投資枠'
  if (/(成長|GROWTH)/i.test(src)) return '成長投資枠'
  return recoverMojibakeUtf8FromLatin1(src) || src
}

const normalizeCategoryToJa = (raw, countryRaw) => {
  const src = String(raw || '').trim().normalize('NFKC')
  if (!src || src === '-' || /^#?N\/?A$/i.test(src)) return ''
  const c = src.toUpperCase().replace(/\s+/g, '')
  const countryJa = normalizeCountryToJa(countryRaw)
  if (/(REIT|リート)/i.test(src)) return 'REIT'
  if (/(COMMODITY|商品|コモディティ)/i.test(src)) return 'コモディティ'
  if (/(BOND|債券)/i.test(src)) return '債券'
  if (/(STOCK|EQUITY|株式|股票)/i.test(src)) {
    if (countryJa === '日本') return '国内株式'
    if (countryJa === '米国') return '米国株式'
    if (countryJa === '全世界') return '全世界株式'
    if (countryJa === '新興国' || countryJa === '中国' || countryJa === 'インド') return '新興国株式'
    return '株式'
  }
  if (/(全世界|GLOBAL|WORLD)/i.test(src)) return '全世界株式'
  if (/(新興国|EMERGING)/i.test(src)) return '新興国株式'
  if (/(米国|S&P|NASDAQ|US)/i.test(src)) return '米国株式'
  if (/(国内|日本|TOPIX|日経|JP)/i.test(src)) return '国内株式'
  return recoverMojibakeUtf8FromLatin1(src) || src
}

const buildPatchFromRow = (row, colMap) => {
  const patch = {}
  const countryIdx = colMap.get('country')
  const rawCountry = countryIdx === undefined ? '' : cellStr(row[countryIdx])
  for (const field of META_FIELDS) {
    const idx = colMap.get(field)
    if (idx === undefined) continue
    const raw = row[idx]
    let val = cellStr(raw)
    if (field === 'country') val = normalizeCountryToJa(val)
    if (field === 'nisa_category') val = normalizeNisaToJa(val)
    if (field === 'category') val = normalizeCategoryToJa(val, rawCountry)
    if (val && (field === 'nisa_category' || field === 'category' || field === 'country')) val = recoverMojibakeUtf8FromLatin1(val) || val
    if (val !== '') patch[field] = val
  }
  return patch
}

const run = async () => {
  await loadEnv()
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
  const dryRun = process.argv.includes('--dry-run')

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)')
  }

  const filePath = args[0]
  if (!filePath) {
    throw new Error('Usage: node scripts/patch-stock-symbols-metadata.mjs <export.csv|xlsx> [--dry-run]')
  }

  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.numbers') {
    throw new Error(
      '.numbers cannot be read here. In Numbers: File → Export To → CSV (or Excel), then run this script on that file.'
    )
  }

  let wb
  if (ext === '.csv') {
    const text = await fs.readFile(filePath, 'utf8')
    wb = XLSX.read(text, { type: 'string' })
  } else {
    wb = XLSX.readFile(filePath)
  }
  const ws = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const headerRow = matrix[0] || []
  if (headerRow.length === 0) throw new Error('Empty sheet')

  const colMap = new Map()
  headerRow.forEach((h, i) => {
    const k = normKey(h)
    if (k) colMap.set(k, i)
  })

  const symbolIdx = colMap.has('symbol') ? colMap.get('symbol') : colMap.get('ticker')
  const isinIdx = colMap.get('isin')
  if (symbolIdx === undefined && isinIdx === undefined) {
    throw new Error(`Need a symbol (or ticker) or isin column. Headers: ${headerRow.join(', ')}`)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  let updated = 0
  let skipped = 0
  let errors = 0

  for (let r = 1; r < matrix.length; r += 1) {
    const row = matrix[r]
    if (!row || !row.length) continue

    const symbolRaw = symbolIdx !== undefined ? cellStr(row[symbolIdx]) : ''
    const isinRaw = isinIdx !== undefined ? cellStr(row[isinIdx]) : ''
    const symbol = symbolRaw ? maybeNormalizeSymbol(symbolRaw) : ''
    const isin = isinRaw ? isinRaw.toUpperCase() : ''

    if (!symbol && !isin) {
      skipped += 1
      continue
    }

    const patch = buildPatchFromRow(row, colMap)
    if (Object.keys(patch).length === 0) {
      skipped += 1
      continue
    }

    if (dryRun) {
      console.log('[dry-run]', { symbol: symbol || null, isin: isin || null, patch })
      updated += 1
      continue
    }

    let q = supabase.from('stock_symbols').update(patch)
    if (symbol) q = q.eq('symbol', symbol)
    else q = q.eq('isin', isin)

    const { data, error } = await q.select('symbol').maybeSingle()
    if (error) {
      console.error('Update error:', error.message, { symbol, isin, patch })
      errors += 1
      continue
    }
    if (!data) {
      console.warn('No row matched:', { symbol, isin })
      skipped += 1
      continue
    }
    updated += 1
  }

  console.log(
    dryRun ? `Dry-run done. Would touch ${updated} rows, skipped ${skipped}.` : `Done. Updated ${updated}, skipped ${skipped}, errors ${errors}.`
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
